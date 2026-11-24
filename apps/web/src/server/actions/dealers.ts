'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import { auditChanges } from '@seedgw/contracts/audit';
import { MAX_EXPORT_ROWS, type ActionResult, type ExportedFile } from '@seedgw/contracts/common';
import {
  bulkAssignDealersInput,
  bulkMoveDealersInput,
  commitDealerImportInput,
  DEALER_LEVEL_LABEL,
  DEALER_STATUS_LABEL,
  dealerFilter,
  MAX_DEALER_IMPORT_BYTES,
  updateDealerInput,
  type DealerImportPreview,
  type DealerImportResult,
  type DealerLevel,
} from '@seedgw/contracts/dealers';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan, can, ForbiddenError } from '@/server/auth/can';
import { requireUser, type CurrentUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import { getClientIp, writeAudit } from '@/server/services/audit';
import {
  commitDealerImport,
  parseDealerFile,
  previewDealerImport,
  rematchDealerAssignees,
} from '@/server/services/dealer-import';
import {
  bulkAssignDealers,
  bulkMoveDealers,
  buildDealerWhere,
  updateDealer,
} from '@/server/services/dealers';
import { buildWorkbookBase64, type ExcelColumn } from '@/server/services/excel';
import { DomainError } from '@/server/services/domain-error';

function assertCanEditDealers(user: CurrentUser): void {
  if (!can(user, 'sales.dealer.update') && !can(user, 'admin.dealer.manage')) {
    throw new ForbiddenError('sales.dealer.update');
  }
}

function revalidateDealers() {
  revalidatePath('/kinh-doanh/dai-ly', 'layout');
  revalidatePath('/quan-tri/dai-ly', 'layout');
}

export async function updateDealerAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    assertCanEditDealers(user);
    const parsed = updateDealerInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const [outcome, ip] = await Promise.all([updateDealer(user, parsed.data), getClientIp()]);
    if (Object.keys(outcome.changes).length > 0) {
      after(() =>
        writeAudit({
          actor: user,
          action: 'dealer.update',
          entityType: 'Dealer',
          entityId: outcome.id,
          entityLabel: outcome.label,
          changes: outcome.changes,
          ip,
        }),
      );
    }
    revalidateDealers();
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function bulkAssignDealersAction(
  raw: unknown,
): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requireUser();
    assertCanEditDealers(user);
    const parsed = bulkAssignDealersInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const [{ count, skipped, userName }, ip] = await Promise.all([
      bulkAssignDealers(parsed.data),
      getClientIp(),
    ]);
    if (count === 0 && skipped > 0) {
      return {
        ok: false,
        code: 'VALIDATION',
        message: `Không gán được: ${skipped} đại lý đều thuộc đơn vị khác, nhân viên chỉ phụ trách đại lý của đơn vị mình.`,
      };
    }
    after(() =>
      writeAudit({
        actor: user,
        action: 'dealer.assign',
        entityType: 'Dealer',
        entityId: `bulk-${new Date().toISOString()}`,
        entityLabel: `${count} đại lý`,
        changes: auditChanges(
          {},
          { assignedUser: userName ?? '(bỏ gán)', dealerCount: String(count) },
        ),
        ip,
      }),
    );
    revalidateDealers();
    return {
      ok: true,
      data: { count },
      ...(skipped > 0
        ? {
            warnings: [
              {
                code: 'ASSIGNEE_OUTSIDE_UNIT',
                message: `Đã gán ${count} đại lý. Bỏ qua ${skipped} đại lý thuộc đơn vị khác, nhân viên chỉ phụ trách đại lý của đơn vị mình.`,
              },
            ],
          }
        : {}),
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function bulkMoveDealersAction(
  raw: unknown,
): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requireUser();
    assertCanEditDealers(user);
    const parsed = bulkMoveDealersInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const [{ count, cleared, unitName }, ip] = await Promise.all([
      bulkMoveDealers(parsed.data),
      getClientIp(),
    ]);
    after(() =>
      writeAudit({
        actor: user,
        action: 'dealer.move',
        entityType: 'Dealer',
        entityId: `bulk-${new Date().toISOString()}`,
        entityLabel: `${count} đại lý`,
        changes: auditChanges(
          {},
          {
            orgUnit: unitName,
            dealerCount: String(count),
            ...(cleared > 0 ? { 'Bỏ gán nhân viên ngoài đơn vị mới': String(cleared) } : {}),
          },
        ),
        ip,
      }),
    );
    revalidateDealers();
    return {
      ok: true,
      data: { count },
      ...(cleared > 0
        ? {
            warnings: [
              {
                code: 'ASSIGNEE_CLEARED',
                message: `${cleared} đại lý đã bỏ gán nhân viên vì nhân viên không thuộc ${unitName}, cần gán lại.`,
              },
            ],
          }
        : {}),
    };
  } catch (error) {
    return toActionError(error);
  }
}

type ExportRow = {
  code: string | null;
  legacyCode: string | null;
  name: string;
  level: number;
  status: 'ACTIVE' | 'INACTIVE';
  phone: string | null;
  phoneRaw: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  taxCode: string | null;
  address: string;
  provinceName: string | null;
  legacyAdminArea: string | null;
  lat: number | null;
  lng: number | null;
  orgUnit: { name: string } | null;
  assignedUser: { employeeCode: string; fullName: string } | null;
  legacyAssigneeName: string | null;
  parent: { code: string | null; legacyCode: string | null } | null;
};

const EXPORT_COLUMNS: ExcelColumn<ExportRow>[] = [
  { header: 'Mã đại lý (FAST)', width: 16, value: (r) => r.code ?? '', numberFormat: '@' },
  { header: 'Mã hệ thống cũ', width: 18, value: (r) => r.legacyCode ?? '', numberFormat: '@' },
  { header: 'Tên đại lý', width: 34, value: (r) => r.name },
  { header: 'Cấp', width: 8, value: (r) => DEALER_LEVEL_LABEL[r.level as DealerLevel] },
  {
    header: 'Đại lý cấp trên',
    width: 18,
    value: (r) => r.parent?.code ?? r.parent?.legacyCode ?? '',
    numberFormat: '@',
  },
  { header: 'Trạng thái', width: 16, value: (r) => DEALER_STATUS_LABEL[r.status] },
  {
    header: 'Số điện thoại',
    width: 14,
    value: (r) => r.phone ?? r.phoneRaw ?? '',
    numberFormat: '@',
  },
  { header: 'Chủ đại lý', width: 24, value: (r) => r.ownerName ?? '' },
  {
    header: 'Điện thoại chủ đại lý',
    width: 14,
    value: (r) => r.ownerPhone ?? '',
    numberFormat: '@',
  },
  { header: 'Mã số thuế', width: 16, value: (r) => r.taxCode ?? '', numberFormat: '@' },
  { header: 'Địa chỉ', width: 44, value: (r) => r.address },
  { header: 'Tỉnh, thành phố', width: 22, value: (r) => r.provinceName ?? '' },
  { header: 'Xã, huyện, tỉnh cũ', width: 40, value: (r) => r.legacyAdminArea ?? '' },
  { header: 'Vĩ độ', width: 11, value: (r) => r.lat ?? '' },
  { header: 'Kinh độ', width: 11, value: (r) => r.lng ?? '' },
  { header: 'Đơn vị phụ trách', width: 30, value: (r) => r.orgUnit?.name ?? '' },
  {
    header: 'Nhân viên phụ trách',
    width: 28,
    value: (r) =>
      r.assignedUser
        ? `${r.assignedUser.employeeCode} - ${r.assignedUser.fullName}`
        : r.legacyAssigneeName
          ? `Chờ gán (hệ thống cũ: ${r.legacyAssigneeName})`
          : '',
  },
];

export async function exportDealersAction(
  rawFilter: unknown,
  rawIds: unknown,
): Promise<ActionResult<ExportedFile>> {
  try {
    const user = await requireUser();
    if (!can(user, 'sales.dealer.read') && !can(user, 'admin.dealer.read')) {
      throw new ForbiddenError('sales.dealer.read');
    }
    const parsed = z
      .object({ filter: dealerFilter, ids: z.array(z.uuid()).max(MAX_EXPORT_ROWS) })
      .safeParse({ filter: rawFilter, ids: rawIds });
    if (!parsed.success) return validationError(parsed.error);

    const scoped = await getScopedDb();
    const where =
      parsed.data.ids.length > 0
        ? { id: { in: parsed.data.ids } }
        : await buildDealerWhere(parsed.data.filter);
    const total = await scoped.dealer.count({ where });
    if (total > MAX_EXPORT_ROWS) {
      return {
        ok: false,
        code: 'CONFLICT',
        message: 'Có quá nhiều dòng để xuất. Vui lòng thu hẹp bộ lọc.',
      };
    }
    const rows = await scoped.dealer.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        code: true,
        legacyCode: true,
        name: true,
        level: true,
        status: true,
        phone: true,
        phoneRaw: true,
        ownerName: true,
        ownerPhone: true,
        taxCode: true,
        address: true,
        provinceName: true,
        legacyAdminArea: true,
        lat: true,
        lng: true,
        legacyAssigneeName: true,
        orgUnit: { select: { name: true } },
        assignedUser: { select: { employeeCode: true, fullName: true } },
        parent: { select: { code: true, legacyCode: true } },
      },
    });
    const base64 = await buildWorkbookBase64('Đại lý', EXPORT_COLUMNS, rows);
    return { ok: true, data: { fileName: 'dai-ly.xlsx', base64 } };
  } catch (error) {
    return toActionError(error);
  }
}

async function readImportFile(formData: FormData): Promise<ArrayBuffer> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    throw new DomainError('VALIDATION', 'Vui lòng chọn file Excel');
  }
  if (file.size > MAX_DEALER_IMPORT_BYTES) {
    throw new DomainError('VALIDATION', 'File quá lớn, tối đa 12 MB');
  }
  return file.arrayBuffer();
}

export async function previewDealerImportAction(
  formData: FormData,
): Promise<ActionResult<DealerImportPreview>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.dealer.manage');
    const rows = await parseDealerFile(await readImportFile(formData));
    return { ok: true, data: await previewDealerImport(rows) };
  } catch (error) {
    return toActionError(error);
  }
}

/** Gửi lại file cùng cách xử lý từng đơn vị. Đọc lại file ở máy chủ, không tin dữ liệu xem trước. */
export async function commitDealerImportAction(
  formData: FormData,
): Promise<ActionResult<DealerImportResult>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.dealer.manage');
    let choices: unknown;
    try {
      choices = JSON.parse(String(formData.get('units') ?? '[]'));
    } catch {
      return { ok: false, code: 'VALIDATION', message: 'Cách xử lý đơn vị không hợp lệ' };
    }
    const parsed = commitDealerImportInput.safeParse({ units: choices });
    if (!parsed.success) return validationError(parsed.error);

    const [rows, ip] = await Promise.all([
      readImportFile(formData).then(parseDealerFile),
      getClientIp(),
    ]);
    const result = await commitDealerImport(user, rows, parsed.data.units, ip);
    revalidateDealers();
    revalidatePath('/quan-tri/co-cau-to-chuc');
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error);
  }
}

export async function rematchDealerAssigneesAction(): Promise<ActionResult<{ matched: number }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.dealer.manage');
    const [matched, ip] = await Promise.all([rematchDealerAssignees(), getClientIp()]);
    after(() =>
      writeAudit({
        actor: user,
        action: 'dealer.assign',
        entityType: 'Dealer',
        entityId: `rematch-${new Date().toISOString()}`,
        entityLabel: `Ghép theo tên: ${matched} đại lý`,
        changes: auditChanges({}, { dealerCount: String(matched) }),
        ip,
      }),
    );
    revalidateDealers();
    return { ok: true, data: { matched } };
  } catch (error) {
    return toActionError(error);
  }
}
