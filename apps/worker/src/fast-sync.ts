import { normalizeVnPhone } from '@seedgw/contracts/dealers';
import {
  FastApiError,
  fastCustomerActive,
  fastCustomerGroups,
  fastGetCustomers,
  fastLogin,
  parseFastDateTime,
  type FastCustomerRecord,
} from '@seedgw/contracts/fast';
import { resolveSystemSettings } from '@seedgw/contracts/settings';
import { db } from '@seedgw/db/client';
import { readFastConfig } from '@seedgw/db/integration-settings';

// Đồng bộ danh mục khách hàng FAST sang SeedGW (A8). FAST là gốc cho tên, địa chỉ, điện thoại, mã số thuế,
// trạng thái; SeedGW giữ toạ độ, nhân viên phụ trách, chủ đại lý, cấp. Ghép theo mã FAST (cột dealers.code).

export type FastSyncTrigger = 'SCHEDULE' | 'MANUAL';

const OVERLAP_MS = 60_000;
const STUCK_RUN_MS = 30 * 60_000;

type DealerPatch = {
  name?: string;
  address?: string;
  taxCode?: string | null;
  phone?: string | null;
  phoneRaw?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
};

function patchFrom(record: FastCustomerRecord): DealerPatch {
  const patch: DealerPatch = { status: fastCustomerActive(record.status) ? 'ACTIVE' : 'INACTIVE' };
  if (record.ten_kh) patch.name = record.ten_kh;
  if (record.dia_chi) patch.address = record.dia_chi;
  if (record.ma_so_thue) patch.taxCode = record.ma_so_thue;
  if (record.dien_thoai) {
    patch.phoneRaw = record.dien_thoai;
    patch.phone = normalizeVnPhone(record.dien_thoai);
  }
  return patch;
}

async function syncMinutes(): Promise<number> {
  const row = await db.systemSetting.findUnique({
    where: { key: 'general' },
    select: { value: true },
  });
  return resolveSystemSettings(row?.value).fastCatalogSyncMinutes;
}

async function applyRecord(
  record: FastCustomerRecord,
  now: Date,
): Promise<'created' | 'updated' | 'unchanged'> {
  const patch = patchFrom(record);
  const dealer = await db.dealer.findFirst({
    where: { code: { equals: record.ma_kh, mode: 'insensitive' } },
    select: {
      id: true,
      name: true,
      address: true,
      taxCode: true,
      phone: true,
      phoneRaw: true,
      status: true,
    },
  });
  let outcome: 'created' | 'updated' | 'unchanged';
  let dealerId: string;
  if (dealer) {
    const changed = (Object.keys(patch) as (keyof DealerPatch)[]).filter(
      (field) => patch[field] !== undefined && patch[field] !== dealer[field],
    );
    if (changed.length > 0) {
      await db.dealer.update({
        where: { id: dealer.id },
        data: Object.fromEntries(changed.map((field) => [field, patch[field]])),
      });
      outcome = 'updated';
    } else outcome = 'unchanged';
    dealerId = dealer.id;
  } else {
    // Khách hàng mới trên FAST: thêm vào SeedGW, chờ gán đơn vị và nhân viên. Cấp chưa biết (câu hỏi 7 gửi FAST),
    // tạm để cấp 1 vì mã FAST chỉ có ở khách mua hàng trực tiếp của Vinaseed.
    const created = await db.dealer.create({
      data: {
        code: record.ma_kh,
        name: patch.name ?? record.ma_kh,
        address: patch.address ?? '',
        level: 1,
        status: patch.status ?? 'ACTIVE',
        taxCode: patch.taxCode ?? null,
        phone: patch.phone ?? null,
        phoneRaw: patch.phoneRaw ?? null,
      },
      select: { id: true },
    });
    dealerId = created.id;
    outcome = 'created';
  }
  const mirror = {
    name: record.ten_kh ?? record.ma_kh,
    taxCode: record.ma_so_thue,
    address: record.dia_chi,
    provinceCode: record.ma_tinh,
    districtCode: record.ma_huyen,
    phone: record.dien_thoai,
    email: record.e_mail,
    unitCode: record.ma_dvcs,
    groups: fastCustomerGroups(record),
    status: record.status,
    fastCreatedAt: parseFastDateTime(record.ngay_tao),
    fastUpdatedAt: parseFastDateTime(record.ngay_sua),
    dealerId,
    syncedAt: now,
  };
  await db.fastCustomer.upsert({
    where: { code: record.ma_kh },
    create: { code: record.ma_kh, ...mirror },
    update: mirror,
  });
  return outcome;
}

/**
 * Một lần đồng bộ. Lịch chạy 5 phút một lần nhưng chỉ thực sự gọi FAST khi đã đủ chu kỳ ở Tham số.
 * Lần đầu lấy toàn bộ, các lần sau lấy khách hàng sửa từ mốc lần trước (lùi 1 phút cho chắc).
 */
export async function runFastCustomerSync(
  trigger: FastSyncTrigger,
  now = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: string; message: string }> {
  const [stored, minutes, running, lastRun, lastOk] = await Promise.all([
    readFastConfig().catch((error: unknown) => {
      console.error('Không đọc được cấu hình FAST', error instanceof Error ? error.message : error);
      return null;
    }),
    syncMinutes(),
    db.fastSyncRun.findFirst({
      where: { status: 'RUNNING', startedAt: { gt: new Date(now.getTime() - STUCK_RUN_MS) } },
      select: { id: true },
    }),
    db.fastSyncRun.findFirst({
      where: { status: { in: ['OK', 'FAILED'] } },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    }),
    db.fastSyncRun.findFirst({
      where: { status: 'OK' },
      orderBy: { startedAt: 'desc' },
      select: { cursorAt: true },
    }),
  ]);
  if (!stored?.config.enabled) {
    if (trigger === 'MANUAL') {
      await db.fastSyncRun.create({
        data: {
          trigger,
          status: 'SKIPPED',
          message: 'Chưa nhập cấu hình FAST hoặc đang tắt đồng bộ',
          finishedAt: now,
        },
      });
    }
    return { status: 'SKIPPED', message: 'Chưa bật đồng bộ FAST' };
  }
  if (running) return { status: 'SKIPPED', message: 'Đang có lần đồng bộ khác chạy' };
  if (
    trigger === 'SCHEDULE' &&
    lastRun &&
    now.getTime() - lastRun.startedAt.getTime() < minutes * 60_000 - 30_000
  ) {
    return { status: 'SKIPPED', message: `Chưa đủ chu kỳ ${minutes} phút` };
  }

  const since = lastOk?.cursorAt ? new Date(lastOk.cursorAt.getTime() - OVERLAP_MS) : null;
  const run = await db.fastSyncRun.create({
    data: { trigger, sinceAt: since, startedAt: now },
    select: { id: true },
  });
  const counts = { fetched: 0, created: 0, updated: 0, unchanged: 0, failed: 0 };
  let cursor = lastOk?.cursorAt ?? null;
  try {
    const token = await fastLogin(stored.config, fetchImpl);
    const page = await fastGetCustomers(stored.config, token, since, fetchImpl);
    counts.fetched = page.records.length + page.invalid.length;
    for (const bad of page.invalid) {
      counts.failed += 1;
      await db.fastSyncError.create({
        data: {
          runId: run.id,
          message: bad.message,
          payload: JSON.parse(JSON.stringify(bad.raw ?? null)),
        },
      });
    }
    for (const record of page.records) {
      try {
        counts[await applyRecord(record, now)] += 1;
        const updatedAt = parseFastDateTime(record.ngay_sua);
        if (updatedAt && (!cursor || updatedAt > cursor)) cursor = updatedAt;
      } catch (error) {
        counts.failed += 1;
        await db.fastSyncError.create({
          data: {
            runId: run.id,
            fastCode: record.ma_kh,
            message: (error instanceof Error ? error.message : String(error)).slice(0, 500),
            payload: JSON.parse(JSON.stringify(record)),
          },
        });
      }
    }
    // Không có ngày sửa nào thì lấy giờ bắt đầu lần này làm mốc, để lần sau không lấy lại toàn bộ.
    cursor ??= now;
    const message = `Nhận ${counts.fetched} khách hàng: thêm ${counts.created}, cập nhật ${counts.updated}, không đổi ${counts.unchanged}, lỗi ${counts.failed}`;
    await db.fastSyncRun.update({
      where: { id: run.id },
      data: { ...counts, status: 'OK', cursorAt: cursor, message, finishedAt: new Date() },
    });
    return { status: 'OK', message };
  } catch (error) {
    const message =
      error instanceof FastApiError
        ? error.message
        : `Lỗi khi đồng bộ: ${(error instanceof Error ? error.message : String(error)).slice(0, 300)}`;
    await db.fastSyncRun.update({
      where: { id: run.id },
      data: { ...counts, status: 'FAILED', message, finishedAt: new Date() },
    });
    return { status: 'FAILED', message };
  }
}
