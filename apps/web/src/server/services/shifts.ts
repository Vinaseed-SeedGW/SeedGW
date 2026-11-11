import 'server-only';
import type { Prisma } from '@prisma/client';
import { auditChanges, type AuditChanges, type AuditValue } from '@dms/contracts/audit';
import { formatDateOnly, vietnamToday } from '@dms/contracts/format';
import {
  HOLIDAY_KIND_LABEL,
  INHERIT_SHIFT_VALUE,
  datesInRange,
  formatBreak,
  formatShiftHours,
  formatWeekdays,
  formatWorkUnits,
  shiftLabel,
  shiftTimesFromForm,
  type CreateAssignmentInput,
  type CreateHolidayInput,
  type CreateShiftInput,
  type ShiftForm,
  type ShiftRule,
  type ShiftTimelineEntry,
  type UpdateShiftInput,
  type WorkdayContext,
} from '@dms/contracts/shifts';
import { db } from '@dms/db/client';
import type { CurrentUser } from '@/server/auth/current-user';
import { getAssignableOrgUnitIds, getScopedDb } from '@/server/auth/scoped-db';
import { DomainError } from '@/server/services/domain-error';
import { dateFromInput, dateToInput, isUniqueViolation } from '@/server/services/users';

export type ShiftOutcome = { id: string; label: string; changes: AuditChanges };

export const SHIFT_SELECT = {
  id: true,
  code: true,
  name: true,
  startMinute: true,
  endMinute: true,
  breakStartMinute: true,
  breakEndMinute: true,
  lateGraceMinutes: true,
  earlyGraceMinutes: true,
  workUnits: true,
  workWeekdays: true,
} satisfies Prisma.ShiftSelect;

type ShiftRecord = Prisma.ShiftGetPayload<{ select: typeof SHIFT_SELECT }>;

export function toShiftRule(row: ShiftRecord): ShiftRule {
  return { ...row, workUnits: Number(row.workUnits) };
}

// Ca va lich nghi dung chung ca cong ty, nen chi nguoi co pham vi toan cong ty moi duoc sua.
function assertCompanyScope(actor: CurrentUser, subject: string): void {
  if (actor.dataScope !== 'ALL') {
    throw new DomainError('FORBIDDEN', `Chỉ người có phạm vi toàn công ty mới được sửa ${subject}`);
  }
}

function shiftAuditValues(shift: ShiftRule): Record<string, AuditValue> {
  return {
    code: shift.code,
    name: shift.name,
    hours: formatShiftHours(shift),
    breakTime: formatBreak(shift),
    lateGraceMinutes: shift.lateGraceMinutes,
    earlyGraceMinutes: shift.earlyGraceMinutes,
    workUnits: formatWorkUnits(shift.workUnits),
    workWeekdays: formatWeekdays(shift.workWeekdays),
  };
}

function shiftData(form: ShiftForm) {
  return {
    code: form.code,
    name: form.name,
    ...shiftTimesFromForm(form),
    lateGraceMinutes: form.lateGraceMinutes,
    earlyGraceMinutes: form.earlyGraceMinutes,
    workUnits: form.workUnits,
    workWeekdays: form.workWeekdays,
  };
}

const DUPLICATE_CODE_MESSAGE = 'Mã ca đã tồn tại';

export async function createShift(
  actor: CurrentUser,
  input: CreateShiftInput,
): Promise<ShiftOutcome> {
  assertCompanyScope(actor, 'ca làm việc');
  try {
    const created = await db.shift.create({ data: shiftData(input), select: SHIFT_SELECT });
    const rule = toShiftRule(created);
    return {
      id: rule.id,
      label: shiftLabel(rule),
      changes: auditChanges({}, shiftAuditValues(rule)),
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError('CONFLICT', DUPLICATE_CODE_MESSAGE, { code: DUPLICATE_CODE_MESSAGE });
    }
    throw error;
  }
}

export async function updateShift(
  actor: CurrentUser,
  input: UpdateShiftInput,
): Promise<ShiftOutcome> {
  assertCompanyScope(actor, 'ca làm việc');
  const current = await db.shift.findUnique({ where: { id: input.id }, select: SHIFT_SELECT });
  if (!current) throw new DomainError('NOT_FOUND', 'Không tìm thấy ca này');

  try {
    // So updatedAt de nguoi sua sau khong ghi de len thay doi cua nguoi khac.
    const { count } = await db.shift.updateMany({
      where: { id: input.id, updatedAt: new Date(input.expectedUpdatedAt) },
      data: shiftData(input.shift),
    });
    if (count === 0) {
      throw new DomainError('CONFLICT', 'Ca vừa được người khác sửa, vui lòng tải lại trang');
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError('CONFLICT', DUPLICATE_CODE_MESSAGE, {
        'shift.code': DUPLICATE_CODE_MESSAGE,
      });
    }
    throw error;
  }

  const before = toShiftRule(current);
  const after = { ...before, ...shiftData(input.shift) };
  return {
    id: input.id,
    label: shiftLabel(after),
    changes: auditChanges(shiftAuditValues(before), shiftAuditValues(after)),
  };
}

export async function deleteShift(actor: CurrentUser, id: string): Promise<ShiftOutcome> {
  assertCompanyScope(actor, 'ca làm việc');
  const shift = await db.shift.findUnique({
    where: { id },
    select: { ...SHIFT_SELECT, _count: { select: { orgUnitShifts: true, userShifts: true } } },
  });
  if (!shift) throw new DomainError('NOT_FOUND', 'Không tìm thấy ca này');
  // Lan gan cu van can de tinh lai cong cac ngay da qua, nen khong xoa ca da tung duoc gan.
  if (shift._count.orgUnitShifts + shift._count.userShifts > 0) {
    throw new DomainError(
      'CONFLICT',
      'Ca đã được gán cho đơn vị hoặc nhân viên nên không xoá được. Hãy gán ca khác thay thế.',
    );
  }

  await db.shift.delete({ where: { id } });
  const rule = toShiftRule(shift);
  return { id, label: shiftLabel(rule), changes: auditChanges(shiftAuditValues(rule), {}) };
}

async function assertUnitManageable(orgUnitId: string): Promise<void> {
  const assignable = await getAssignableOrgUnitIds();
  if (assignable && !assignable.has(orgUnitId)) {
    throw new DomainError('FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
  }
}

async function resolveTarget(input: CreateAssignmentInput): Promise<{ label: string }> {
  if (input.target === 'ORG_UNIT') {
    const orgUnitId = input.orgUnitId ?? '';
    await assertUnitManageable(orgUnitId);
    const unit = await db.orgUnit.findUnique({ where: { id: orgUnitId }, select: { name: true } });
    if (!unit) {
      const message = 'Đơn vị không tồn tại';
      throw new DomainError('VALIDATION', message, { orgUnitId: message });
    }
    return { label: `Đơn vị ${unit.name}` };
  }

  const scoped = await getScopedDb();
  const user = await scoped.user.findFirst({
    where: { id: input.userId ?? '' },
    select: { employeeCode: true, fullName: true },
  });
  if (!user) {
    const message = 'Nhân viên không tồn tại hoặc ngoài phạm vi của bạn';
    throw new DomainError('VALIDATION', message, { userId: message });
  }
  return { label: `Nhân viên ${user.employeeCode} - ${user.fullName}` };
}

async function resolveShiftChoice(shiftId: string): Promise<{ id: string | null; label: string }> {
  if (shiftId === INHERIT_SHIFT_VALUE) return { id: null, label: 'Theo đơn vị cấp trên' };
  const shift = await db.shift.findUnique({
    where: { id: shiftId },
    select: { id: true, code: true, name: true },
  });
  if (!shift) {
    const message = 'Ca không tồn tại';
    throw new DomainError('VALIDATION', message, { shiftId: message });
  }
  return { id: shift.id, label: shiftLabel(shift) };
}

const DUPLICATE_ASSIGNMENT_MESSAGE =
  'Đã có lần gán bắt đầu đúng ngày này, hãy xoá lần gán đó trước';

export async function createAssignment(
  actor: CurrentUser,
  input: CreateAssignmentInput,
): Promise<ShiftOutcome> {
  const [target, shift] = await Promise.all([
    resolveTarget(input),
    resolveShiftChoice(input.shiftId),
  ]);
  const effectiveFrom = dateFromInput(input.effectiveFrom) as Date;
  const data = { shiftId: shift.id, effectiveFrom, createdById: actor.id };

  try {
    const created =
      input.target === 'ORG_UNIT'
        ? await db.orgUnitShift.create({
            data: { ...data, orgUnitId: input.orgUnitId ?? '' },
            select: { id: true },
          })
        : await db.userShift.create({
            data: { ...data, userId: input.userId ?? '' },
            select: { id: true },
          });
    return {
      id: created.id,
      label: target.label,
      changes: auditChanges(
        {},
        { shift: shift.label, effectiveFrom: formatDateOnly(input.effectiveFrom) },
      ),
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError('CONFLICT', DUPLICATE_ASSIGNMENT_MESSAGE, {
        effectiveFrom: DUPLICATE_ASSIGNMENT_MESSAGE,
      });
    }
    throw error;
  }
}

const ASSIGNMENT_SELECT = {
  id: true,
  effectiveFrom: true,
  shift: { select: { code: true, name: true } },
} as const;

export async function deleteAssignment(
  target: 'ORG_UNIT' | 'USER',
  id: string,
): Promise<ShiftOutcome> {
  const scoped = await getScopedDb();
  const found =
    target === 'ORG_UNIT'
      ? await scoped.orgUnitShift.findFirst({
          where: { id },
          select: { ...ASSIGNMENT_SELECT, orgUnitId: true, orgUnit: { select: { name: true } } },
        })
      : await scoped.userShift.findFirst({
          where: { id },
          select: {
            ...ASSIGNMENT_SELECT,
            user: { select: { employeeCode: true, fullName: true } },
          },
        });
  if (!found) throw new DomainError('NOT_FOUND', 'Không tìm thấy lần gán ca này');
  // Lan gan da toi ngay la can cu tinh cong cac ngay da qua, muon doi thi tao lan gan moi.
  if (dateToInput(found.effectiveFrom) <= vietnamToday()) {
    throw new DomainError(
      'CONFLICT',
      'Lần gán này đã có hiệu lực nên không xoá được. Hãy tạo lần gán mới từ ngày cần đổi.',
    );
  }

  let label: string;
  if ('orgUnit' in found) {
    await assertUnitManageable(found.orgUnitId);
    label = `Đơn vị ${found.orgUnit.name}`;
    await db.orgUnitShift.delete({ where: { id } });
  } else {
    label = `Nhân viên ${found.user.employeeCode} - ${found.user.fullName}`;
    await db.userShift.delete({ where: { id } });
  }

  return {
    id,
    label,
    changes: auditChanges(
      {
        shift: found.shift ? shiftLabel(found.shift) : 'Theo đơn vị cấp trên',
        effectiveFrom: formatDateOnly(dateToInput(found.effectiveFrom)),
      },
      {},
    ),
  };
}

export async function createHolidays(
  actor: CurrentUser,
  input: CreateHolidayInput,
): Promise<ShiftOutcome> {
  assertCompanyScope(actor, 'lịch nghỉ');
  const dates = datesInRange(input.startDate, input.endDate || input.startDate);
  const asDates = dates.map((date) => dateFromInput(date) as Date);

  const existing = await db.holiday.findMany({
    where: { date: { in: asDates } },
    select: { date: true },
  });
  if (existing.length > 0) {
    const taken = existing.map(({ date }) => formatDateOnly(dateToInput(date))).join(', ');
    const message = `Đã có trong lịch nghỉ: ${taken}`;
    throw new DomainError('CONFLICT', message, { startDate: message });
  }

  let createdIds: string[];
  try {
    const created = await db.holiday.createManyAndReturn({
      data: asDates.map((date) => ({ date, name: input.name, kind: input.kind })),
      select: { id: true },
    });
    createdIds = created.map(({ id }) => id);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError('CONFLICT', 'Lịch nghỉ vừa được người khác thêm, vui lòng tải lại');
    }
    throw error;
  }

  const first = dates[0] ?? input.startDate;
  const last = dates.at(-1) ?? first;
  const period =
    first === last ? formatDateOnly(first) : `${formatDateOnly(first)} đến ${formatDateOnly(last)}`;
  return {
    id: createdIds[0] ?? first,
    label: input.name,
    changes: auditChanges({}, { date: period, kind: HOLIDAY_KIND_LABEL[input.kind] }),
  };
}

export async function deleteHoliday(actor: CurrentUser, id: string): Promise<ShiftOutcome> {
  assertCompanyScope(actor, 'lịch nghỉ');
  const holiday = await db.holiday.findUnique({
    where: { id },
    select: { date: true, name: true, kind: true },
  });
  if (!holiday) throw new DomainError('NOT_FOUND', 'Không tìm thấy ngày này trong lịch nghỉ');

  await db.holiday.delete({ where: { id } });
  return {
    id,
    label: holiday.name,
    changes: auditChanges(
      {
        date: formatDateOnly(dateToInput(holiday.date)),
        kind: HOLIDAY_KIND_LABEL[holiday.kind],
      },
      {},
    ),
  };
}

function toTimeline(
  rows: ReadonlyArray<{ shiftId: string | null; effectiveFrom: Date }>,
): ShiftTimelineEntry[] {
  return rows.map(({ shiftId, effectiveFrom }) => ({
    shiftId,
    effectiveFrom: dateToInput(effectiveFrom),
  }));
}

// Du lieu de xac dinh ca cua mot nhan vien trong khoang ngay, dung cho tra cuu va tong hop cong.
export async function loadWorkdayContext(
  user: { id: string; orgUnitId: string | null },
  from: string,
  to: string,
): Promise<WorkdayContext> {
  const [units, userRows, unitRows, shifts, holidays] = await Promise.all([
    db.orgUnit.findMany({ select: { id: true, parentId: true } }),
    db.userShift.findMany({
      where: { userId: user.id },
      select: { shiftId: true, effectiveFrom: true },
    }),
    db.orgUnitShift.findMany({ select: { orgUnitId: true, shiftId: true, effectiveFrom: true } }),
    db.shift.findMany({ select: SHIFT_SELECT }),
    db.holiday.findMany({
      where: { date: { gte: dateFromInput(from) as Date, lte: dateFromInput(to) as Date } },
      select: { date: true, name: true, kind: true },
    }),
  ]);

  const parentOf = new Map(units.map(({ id, parentId }) => [id, parentId]));
  const unitLineage: string[] = [];
  for (
    let current = user.orgUnitId;
    current && !unitLineage.includes(current);
    current = parentOf.get(current) ?? null
  ) {
    unitLineage.push(current);
  }

  const unitTimelines = new Map<string, ShiftTimelineEntry[]>();
  for (const row of unitRows) {
    const list = unitTimelines.get(row.orgUnitId) ?? [];
    list.push(...toTimeline([row]));
    unitTimelines.set(row.orgUnitId, list);
  }

  return {
    unitLineage,
    userTimeline: toTimeline(userRows),
    unitTimelines,
    shifts: new Map(shifts.map((shift) => [shift.id, toShiftRule(shift)])),
    holidays: new Map(holidays.map(({ date, name, kind }) => [dateToInput(date), { name, kind }])),
  };
}
