import 'server-only';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { auditChanges } from '@dms/contracts/audit';
import {
  MAX_DEALER_IMPORT_ROWS,
  normalizeVnPhone,
  parseLegacyDealerCode,
  type DealerImportIssue,
  type DealerImportPreview,
  type DealerImportResult,
  type DealerImportUnit,
  type DealerImportUnitChoice,
  type DealerLevel,
} from '@dms/contracts/dealers';
import { toNewProvince } from '@dms/contracts/provinces';
import { normalizeSearchText } from '@dms/contracts/text';
import { db } from '@dms/db/client';
import type { CurrentUser } from '@/server/auth/current-user';
import { writeAudit } from './audit';
import { DomainError } from './domain-error';

// Nhập file "Danh sách khách hàng" xuất từ DMS cũ (A7). Tìm cột theo tên tiêu đề nên đổi thứ tự cột vẫn đọc được.

const HEADER = {
  legacyCode: 'mã khách hàng (tự sinh)',
  fastCode: 'mã khách hàng (tự nhập)',
  name: 'tên khách hàng/công ty',
  phone: 'số điện thoại',
  taxCode: 'mã số thuế',
  address: 'địa chỉ',
  ownerName: 'tên chủ đại lý',
  ownerPhone: 'điện thoại',
  province: 'tình/thành phố',
  district: 'quận/huyện',
  ward: 'phường/xã',
  unit: 'đơn vị phụ trách',
  assignee: 'người phụ trách',
  status: 'trạng thái',
} as const;
type Field = keyof typeof HEADER;

// File cũ viết sai "Tình/Thành phố", nhận cả cách viết đúng.
const HEADER_ALIASES: Partial<Record<Field, string[]>> = { province: ['tỉnh/thành phố'] };
const MAX_LISTED_ISSUES = 200;
const UPSERT_CHUNK = 1000;
// Đơn vị dùng để thử trên DMS cũ, mặc định bỏ qua khi nhập.
const TEST_UNIT_PATTERN = /test|thu viec|dao tao/;

export type ParsedDealerRow = {
  rowNumber: number;
  legacyCode: string;
  fastCode: string;
  name: string;
  phone: string;
  taxCode: string;
  address: string;
  ownerName: string;
  ownerPhone: string;
  province: string;
  district: string;
  ward: string;
  unit: string;
  assignee: string;
  status: string;
};

type ValidRow = ParsedDealerRow & {
  level: DealerLevel;
  unitPrefix: string;
  code: string | null;
  phoneNormalized: string | null;
  ownerPhoneNormalized: string | null;
  provinceName: string | null;
  isActive: boolean;
};

const headerKey = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();

export async function parseDealerFile(buffer: ArrayBuffer): Promise<ParsedDealerRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new DomainError('VALIDATION', 'Không đọc được file. Hãy chọn file .xlsx xuất từ DMS cũ');
  }

  for (const sheet of workbook.worksheets) {
    for (let headerRow = 1; headerRow <= Math.min(10, sheet.rowCount); headerRow += 1) {
      const columns = new Map<string, number>();
      sheet.getRow(headerRow).eachCell((cell, column) => {
        const key = headerKey(cell.text);
        // Hai cột "Email", "Điện thoại": cột đầu là của khách hàng, cột sau là của chủ đại lý.
        if (columns.has(key)) columns.set(`${key}#2`, column);
        else columns.set(key, column);
      });
      if (!columns.has(HEADER.legacyCode)) continue;

      const find = (field: Field): number | undefined => {
        if (field === 'ownerPhone') return columns.get(HEADER.ownerPhone);
        return (
          columns.get(HEADER[field]) ??
          HEADER_ALIASES[field]?.map((alias) => columns.get(alias)).find(Boolean)
        );
      };
      const index = Object.fromEntries(
        (Object.keys(HEADER) as Field[]).map((field) => [field, find(field)]),
      ) as Record<Field, number | undefined>;
      // "Số điện thoại" là của đại lý, "Điện thoại" đứng sau "Tên chủ đại lý" là của chủ.
      if (index.ownerPhone === index.phone) index.ownerPhone = undefined;

      const rows: ParsedDealerRow[] = [];
      for (let r = headerRow + 1; r <= sheet.rowCount; r += 1) {
        const row = sheet.getRow(r);
        const read = (field: Field) => {
          const column = index[field];
          return column ? String(row.getCell(column).text ?? '').trim() : '';
        };
        const legacyCode = read('legacyCode');
        const name = read('name');
        if (!legacyCode && !name) continue;
        rows.push({
          rowNumber: r,
          legacyCode,
          fastCode: read('fastCode'),
          name,
          phone: read('phone'),
          taxCode: read('taxCode'),
          address: read('address'),
          ownerName: read('ownerName'),
          ownerPhone: read('ownerPhone'),
          province: read('province'),
          district: read('district'),
          ward: read('ward'),
          unit: read('unit'),
          assignee: read('assignee'),
          status: read('status'),
        });
        if (rows.length > MAX_DEALER_IMPORT_ROWS) {
          throw new DomainError(
            'VALIDATION',
            `File có hơn ${MAX_DEALER_IMPORT_ROWS} dòng, hãy chia nhỏ`,
          );
        }
      }
      return rows;
    }
  }
  throw new DomainError(
    'VALIDATION',
    'Không thấy cột "Mã khách hàng (tự sinh)". Hãy dùng file Danh sách khách hàng xuất từ DMS cũ',
  );
}

type Analysis = {
  valid: ValidRow[];
  errors: DealerImportIssue[];
  warnings: DealerImportIssue[];
};

async function analyze(rows: ParsedDealerRow[]): Promise<Analysis> {
  const errors: DealerImportIssue[] = [];
  const warnings: DealerImportIssue[] = [];
  const seenLegacy = new Set<string>();
  const seenFast = new Map<string, string>();

  // Mã FAST đã gắn cho đại lý khác trong DMS thì không gán lại, tránh trùng mã.
  const existingFast = new Map(
    (
      await db.dealer.findMany({
        where: { code: { not: null } },
        select: { code: true, legacyCode: true },
      })
    ).map((dealer) => [dealer.code ?? '', dealer.legacyCode]),
  );

  const valid: ValidRow[] = [];
  for (const row of rows) {
    const issue = (message: string) => ({
      rowNumber: row.rowNumber,
      legacyCode: row.legacyCode,
      message,
    });
    if (!row.legacyCode || !row.name) {
      errors.push(issue('Thiếu mã khách hàng (tự sinh) hoặc tên'));
      continue;
    }
    const parsed = parseLegacyDealerCode(row.legacyCode);
    if (!parsed) {
      errors.push(issue('Mã tự sinh không có cấp đại lý C1, C2 hoặc C3'));
      continue;
    }
    const legacyKey = row.legacyCode.toUpperCase();
    if (seenLegacy.has(legacyKey)) {
      errors.push(issue('Mã tự sinh bị lặp trong file, bỏ dòng sau'));
      continue;
    }
    seenLegacy.add(legacyKey);

    let code: string | null = row.fastCode ? row.fastCode.toUpperCase() : null;
    if (code) {
      const owner = seenFast.get(code);
      const dbOwner = existingFast.get(code);
      if (owner) {
        warnings.push(issue(`Mã FAST ${code} trùng với dòng mã ${owner}, để trống mã FAST`));
        code = null;
      } else if (dbOwner !== undefined && dbOwner !== row.legacyCode) {
        warnings.push(issue(`Mã FAST ${code} đã thuộc đại lý khác, để trống mã FAST`));
        code = null;
      } else {
        seenFast.set(code, row.legacyCode);
      }
    }

    const phoneNormalized = row.phone ? normalizeVnPhone(row.phone) : null;
    if (row.phone && !phoneNormalized) {
      warnings.push(issue(`Số điện thoại "${row.phone}" không đúng dạng, giữ lại để sửa sau`));
    }
    const provinceName = toNewProvince(row.province);
    if (row.province && !provinceName) {
      warnings.push(issue(`Không nhận ra tỉnh "${row.province}"`));
    }

    valid.push({
      ...row,
      level: parsed.level,
      unitPrefix: parsed.unitPrefix,
      code,
      phoneNormalized,
      ownerPhoneNormalized: row.ownerPhone ? normalizeVnPhone(row.ownerPhone) : null,
      provinceName,
      isActive: !/dừng|ngừng/i.test(row.status),
    });
  }
  return { valid, errors, warnings };
}

type UserIndex = Map<string, { id: string; orgUnitId: string | null }[]>;

async function loadUserIndex(): Promise<UserIndex> {
  const users = await db.user.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true, orgUnitId: true },
  });
  const index: UserIndex = new Map();
  for (const user of users) {
    const key = normalizeSearchText(user.fullName);
    index.set(key, [...(index.get(key) ?? []), { id: user.id, orgUnitId: user.orgUnitId }]);
  }
  return index;
}

/** Ghép người phụ trách theo họ tên. Trùng tên thì ưu tiên người cùng đơn vị, vẫn trùng thì để chờ gán. */
function matchAssignee(index: UserIndex, name: string, orgUnitId: string | null): string | null {
  if (!name) return null;
  const candidates = index.get(normalizeSearchText(name)) ?? [];
  if (candidates.length === 1) return candidates[0]?.id ?? null;
  const sameUnit = candidates.filter((candidate) => candidate.orgUnitId === orgUnitId);
  return sameUnit.length === 1 ? (sameUnit[0]?.id ?? null) : null;
}

function sanitizeCode(prefix: string): string {
  return (
    prefix
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '')
      .slice(0, 30) || 'DV'
  );
}

export async function previewDealerImport(rows: ParsedDealerRow[]): Promise<DealerImportPreview> {
  const [{ valid, errors, warnings }, orgUnits, existing, users] = await Promise.all([
    analyze(rows),
    db.orgUnit.findMany({ select: { id: true, code: true, name: true } }),
    db.dealer.findMany({ select: { legacyCode: true } }),
    loadUserIndex(),
  ]);
  const existingLegacy = new Set(existing.map((dealer) => dealer.legacyCode?.toUpperCase()));
  const unitByName = new Map(orgUnits.map((unit) => [normalizeSearchText(unit.name), unit]));
  const usedCodes = new Set(orgUnits.map((unit) => unit.code));

  const groups = new Map<string, { count: number; prefixes: Map<string, number> }>();
  for (const row of valid) {
    const group = groups.get(row.unit) ?? { count: 0, prefixes: new Map<string, number>() };
    group.count += 1;
    group.prefixes.set(row.unitPrefix, (group.prefixes.get(row.unitPrefix) ?? 0) + 1);
    groups.set(row.unit, group);
  }

  const units: DealerImportUnit[] = [...groups.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([legacyName, group]) => {
      const matched = unitByName.get(normalizeSearchText(legacyName)) ?? null;
      // Mã đơn vị mới lấy theo tiền tố mã đại lý hay gặp nhất, ví dụ VR02, để dễ nhận ra.
      const topPrefix = [...group.prefixes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'DV';
      let suggestedCode = sanitizeCode(topPrefix);
      for (let n = 2; usedCodes.has(suggestedCode); n += 1) {
        suggestedCode = `${sanitizeCode(topPrefix).slice(0, 26)}-${n}`;
      }
      usedCodes.add(suggestedCode);
      const isTest = TEST_UNIT_PATTERN.test(normalizeSearchText(legacyName));
      return {
        legacyName,
        rowCount: group.count,
        suggestedCode,
        suggestedAction: matched ? 'EXISTING' : isTest ? 'SKIP' : 'CREATE',
        matchedOrgUnitId: matched?.id ?? null,
      };
    });

  const unitIdByLegacy = new Map(units.map((unit) => [unit.legacyName, unit.matchedOrgUnitId]));
  let assigneeMatched = 0;
  let assigneeUnmatched = 0;
  for (const row of valid) {
    if (!row.assignee) continue;
    if (matchAssignee(users, row.assignee, unitIdByLegacy.get(row.unit) ?? null)) {
      assigneeMatched += 1;
    } else assigneeUnmatched += 1;
  }

  const levelCounts: Record<DealerLevel, number> = { 1: 0, 2: 0, 3: 0 };
  for (const row of valid) levelCounts[row.level] += 1;
  const newCount = valid.filter((row) => !existingLegacy.has(row.legacyCode.toUpperCase())).length;

  return {
    totalRows: rows.length,
    validRows: valid.length,
    newCount,
    existingCount: valid.length - newCount,
    levelCounts,
    withFastCode: valid.filter((row) => row.code).length,
    invalidPhoneCount: valid.filter((row) => row.phone && !row.phoneNormalized).length,
    unknownProvinceCount: valid.filter((row) => row.province && !row.provinceName).length,
    assigneeMatched,
    assigneeUnmatched,
    errors: errors.slice(0, MAX_LISTED_ISSUES),
    errorCount: errors.length,
    warnings: warnings.slice(0, MAX_LISTED_ISSUES),
    warningCount: warnings.length,
    units,
  };
}

type Tx = Prisma.TransactionClient;

async function rootOrgUnitId(tx: Tx): Promise<string> {
  const roots = await tx.orgUnit.findMany({
    where: { parentId: null },
    select: { id: true, code: true },
    orderBy: { createdAt: 'asc' },
  });
  const root = roots.find((unit) => unit.code === 'VINASEED') ?? roots[0];
  if (!root) throw new DomainError('CONFLICT', 'Chưa có đơn vị gốc trong Cơ cấu tổ chức');
  return root.id;
}

async function resolveUnits(
  tx: Tx,
  choices: DealerImportUnitChoice[],
): Promise<{ unitIds: Map<string, string | null>; createdUnits: number }> {
  const unitIds = new Map<string, string | null>();
  let createdUnits = 0;
  let parentId: string | null = null;
  for (const choice of choices) {
    if (choice.action === 'SKIP') {
      unitIds.set(choice.legacyName, null);
    } else if (choice.action === 'EXISTING' && choice.orgUnitId) {
      const unit = await tx.orgUnit.findUnique({
        where: { id: choice.orgUnitId },
        select: { id: true },
      });
      if (!unit)
        throw new DomainError('NOT_FOUND', `Không thấy đơn vị chọn cho "${choice.legacyName}"`);
      unitIds.set(choice.legacyName, unit.id);
    } else if (choice.action === 'CREATE' && choice.code) {
      parentId ??= await rootOrgUnitId(tx);
      const clash = await tx.orgUnit.findUnique({
        where: { code: choice.code },
        select: { id: true },
      });
      if (clash) {
        throw new DomainError('CONFLICT', `Mã đơn vị ${choice.code} đã có, hãy đổi mã khác`);
      }
      // Đơn vị mới đặt dưới đơn vị gốc, sửa tên, mã, vị trí sau ở trang Cơ cấu tổ chức.
      const created = await tx.orgUnit.create({
        data: { code: choice.code, name: choice.legacyName.slice(0, 120), parentId },
        select: { id: true },
      });
      unitIds.set(choice.legacyName, created.id);
      createdUnits += 1;
    }
  }
  return { unitIds, createdUnits };
}

function adminArea(row: ParsedDealerRow): string | null {
  return [row.ward, row.district, row.province].filter(Boolean).join(', ') || null;
}

/**
 * Lưu đại lý theo mã DMS cũ. Nhập lại lần sau chỉ cập nhật tên, mã FAST, mã số thuế và thông tin cũ;
 * các trường đã sửa trên DMS mới (điện thoại, địa chỉ, đơn vị, nhân viên, toạ độ) giữ nguyên.
 */
export async function commitDealerImport(
  actor: CurrentUser,
  rows: ParsedDealerRow[],
  choices: DealerImportUnitChoice[],
  ip: string | null,
): Promise<DealerImportResult> {
  const { valid, errors } = await analyze(rows);
  const users = await loadUserIndex();
  const choiceByName = new Map(choices.map((choice) => [choice.legacyName, choice]));
  for (const row of valid) {
    if (!choiceByName.has(row.unit)) {
      throw new DomainError(
        'VALIDATION',
        `Chưa chọn cách xử lý cho đơn vị "${row.unit || '(trống)'}"`,
      );
    }
  }

  const result = await db.$transaction(
    async (tx) => {
      const { unitIds, createdUnits } = await resolveUnits(tx, choices);
      const kept = valid.filter((row) => unitIds.get(row.unit));
      let created = 0;
      let updated = 0;

      for (let start = 0; start < kept.length; start += UPSERT_CHUNK) {
        const chunk = kept.slice(start, start + UPSERT_CHUNK);
        const column = <T>(pick: (row: ValidRow) => T) => chunk.map(pick);
        const orgUnitIds = column((row) => unitIds.get(row.unit) ?? null);
        const assignees = chunk.map((row, i) =>
          matchAssignee(users, row.assignee, orgUnitIds[i] ?? null),
        );
        const inserted = await tx.$queryRaw<{ inserted: boolean }[]>`
          INSERT INTO dealers (
            id, legacy_code, code, name, level, tax_code, status, phone, phone_raw,
            owner_name, owner_phone, address, province_name, legacy_admin_area,
            org_unit_id, assigned_user_id, legacy_org_unit_name, legacy_assignee_name,
            created_at, updated_at
          )
          SELECT gen_random_uuid(), t.legacy_code, t.code, t.name, t.level, t.tax_code,
            t.status::dealer_status, t.phone, t.phone_raw, t.owner_name, t.owner_phone,
            t.address, t.province_name, t.legacy_admin_area, t.org_unit_id::uuid,
            t.assigned_user_id::uuid, t.legacy_org_unit_name, t.legacy_assignee_name, now(), now()
          FROM unnest(
            ${column((row) => row.legacyCode)}::text[],
            ${column((row) => row.code)}::text[],
            ${column((row) => row.name)}::text[],
            ${column((row) => row.level)}::int[],
            ${column((row) => row.taxCode || null)}::text[],
            ${column((row) => (row.isActive ? 'ACTIVE' : 'INACTIVE'))}::text[],
            ${column((row) => row.phoneNormalized)}::text[],
            ${column((row) => (row.phone && !row.phoneNormalized ? row.phone : null))}::text[],
            ${column((row) => row.ownerName || null)}::text[],
            ${column((row) => row.ownerPhoneNormalized)}::text[],
            ${column((row) => row.address || [row.ward, row.district].filter(Boolean).join(', ') || '(chưa có địa chỉ)')}::text[],
            ${column((row) => row.provinceName)}::text[],
            ${column(adminArea)}::text[],
            ${orgUnitIds}::text[],
            ${assignees}::text[],
            ${column((row) => row.unit || null)}::text[],
            ${column((row) => row.assignee || null)}::text[]
          ) AS t(legacy_code, code, name, level, tax_code, status, phone, phone_raw, owner_name,
                 owner_phone, address, province_name, legacy_admin_area, org_unit_id,
                 assigned_user_id, legacy_org_unit_name, legacy_assignee_name)
          ON CONFLICT (legacy_code) DO UPDATE SET
            name = EXCLUDED.name,
            code = COALESCE(EXCLUDED.code, dealers.code),
            tax_code = COALESCE(EXCLUDED.tax_code, dealers.tax_code),
            phone = COALESCE(dealers.phone, EXCLUDED.phone),
            owner_name = COALESCE(dealers.owner_name, EXCLUDED.owner_name),
            owner_phone = COALESCE(dealers.owner_phone, EXCLUDED.owner_phone),
            province_name = COALESCE(dealers.province_name, EXCLUDED.province_name),
            legacy_admin_area = EXCLUDED.legacy_admin_area,
            org_unit_id = COALESCE(dealers.org_unit_id, EXCLUDED.org_unit_id),
            assigned_user_id = COALESCE(dealers.assigned_user_id, EXCLUDED.assigned_user_id),
            legacy_org_unit_name = EXCLUDED.legacy_org_unit_name,
            legacy_assignee_name = EXCLUDED.legacy_assignee_name,
            updated_at = now()
          RETURNING (xmax = 0) AS inserted
        `;
        for (const row of inserted) {
          if (row.inserted) created += 1;
          else updated += 1;
        }
      }
      return { created, updated, skipped: valid.length - kept.length, createdUnits };
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  // Một dòng nhật ký cho cả lần nhập, không ghi 15.000 dòng làm ngập trang Nhật ký.
  await writeAudit({
    actor,
    action: 'dealer.import',
    entityType: 'Dealer',
    entityId: `import-${new Date().toISOString()}`,
    entityLabel: `Nhập ${rows.length} dòng`,
    changes: auditChanges(
      {},
      {
        dealerCount: `${result.created} mới, ${result.updated} cập nhật, ${result.skipped} bỏ qua, ${errors.length} lỗi`,
      },
    ),
    ip,
  });

  return { ...result, errorCount: errors.length };
}

/** Ghép lại nhân viên phụ trách theo tên DMS cũ cho đại lý chưa gán, dùng sau khi nhập thêm tài khoản. */
export async function rematchDealerAssignees(): Promise<number> {
  const [users, dealers] = await Promise.all([
    loadUserIndex(),
    db.dealer.findMany({
      where: { assignedUserId: null, legacyAssigneeName: { not: null } },
      select: { id: true, orgUnitId: true, legacyAssigneeName: true },
    }),
  ]);
  const byUser = new Map<string, string[]>();
  for (const dealer of dealers) {
    const userId = matchAssignee(users, dealer.legacyAssigneeName ?? '', dealer.orgUnitId);
    if (userId) byUser.set(userId, [...(byUser.get(userId) ?? []), dealer.id]);
  }
  let matched = 0;
  for (const [userId, ids] of byUser) {
    const result = await db.dealer.updateMany({
      where: { id: { in: ids }, assignedUserId: null },
      data: { assignedUserId: userId },
    });
    matched += result.count;
  }
  return matched;
}
