import { z } from 'zod';
import { pageResult } from './common';
import { parseDisplayDate } from './format';

// Ca lam viec, gan ca va lich nghi. Dong co resolveWorkday dung chung cho tra cuu va tong hop cong (T1).

export const WEEKDAY_LABEL = {
  MON: 'Thứ 2',
  TUE: 'Thứ 3',
  WED: 'Thứ 4',
  THU: 'Thứ 5',
  FRI: 'Thứ 6',
  SAT: 'Thứ 7',
  SUN: 'Chủ nhật',
} as const;
export type Weekday = keyof typeof WEEKDAY_LABEL;
export const WEEKDAYS = Object.keys(WEEKDAY_LABEL) as [Weekday, ...Weekday[]];
export const WEEKDAY_OPTIONS = WEEKDAYS.map((value) => ({ value, label: WEEKDAY_LABEL[value] }));

const WEEKDAY_SHORT: Record<Weekday, string> = {
  MON: 'T2',
  TUE: 'T3',
  WED: 'T4',
  THU: 'T5',
  FRI: 'T6',
  SAT: 'T7',
  SUN: 'CN',
};

// getUTCDay tra 0 la Chu nhat.
const WEEKDAY_BY_UTC_DAY: readonly Weekday[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function weekdayOf(isoDate: string): Weekday {
  return WEEKDAY_BY_UTC_DAY[new Date(`${isoDate}T00:00:00.000Z`).getUTCDay()] ?? 'MON';
}

export function formatWeekdays(days: readonly Weekday[]): string {
  if (days.length === 0) return 'Không có ngày làm';
  return WEEKDAYS.filter((day) => days.includes(day))
    .map((day) => WEEKDAY_SHORT[day])
    .join(', ');
}

export const HOLIDAY_KIND_LABEL = {
  HOLIDAY: 'Nghỉ lễ',
  MAKEUP_WORKDAY: 'Ngày làm bù',
} as const;
export type HolidayKind = keyof typeof HOLIDAY_KIND_LABEL;
export const HOLIDAY_KIND_OPTIONS = (Object.keys(HOLIDAY_KIND_LABEL) as HolidayKind[]).map(
  (value) => ({ value, label: HOLIDAY_KIND_LABEL[value] }),
);

// Gio trong ngay luu bang so phut tinh tu 0 gio de so sanh va tinh toan cho de.
export const MINUTES_PER_DAY = 24 * 60;

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [hours, minutes] = [Number(match[1]), Number(match[2])];
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

// Gio ra nho hon gio vao nghia la ca qua dem.
export function isOvernight(shift: { startMinute: number; endMinute: number }): boolean {
  return shift.endMinute <= shift.startMinute;
}

function spanMinutes(start: number, end: number): number {
  return end > start ? end - start : end + MINUTES_PER_DAY - start;
}

export function workingMinutes(shift: ShiftTimes): number {
  const total = spanMinutes(shift.startMinute, shift.endMinute);
  const rest =
    shift.breakStartMinute === null || shift.breakEndMinute === null
      ? 0
      : spanMinutes(shift.breakStartMinute, shift.breakEndMinute);
  return total - rest;
}

// Vi tri cua moc gio tinh tu gio vao ca, de biet moc do co nam trong ca khong.
function offsetFromStart(shift: ShiftTimes, minute: number): number {
  return (minute - shift.startMinute + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

export function formatShiftHours(shift: { startMinute: number; endMinute: number }): string {
  const range = `${minutesToTime(shift.startMinute)} đến ${minutesToTime(shift.endMinute)}`;
  return isOvernight(shift) ? `${range} hôm sau` : range;
}

export function formatBreak(shift: ShiftTimes): string {
  if (shift.breakStartMinute === null || shift.breakEndMinute === null) return 'Không nghỉ giữa ca';
  return `${minutesToTime(shift.breakStartMinute)} đến ${minutesToTime(shift.breakEndMinute)}`;
}

export function formatWorkUnits(value: number): string {
  return `${String(value).replace('.', ',')} công`;
}

export type ShiftTimes = {
  startMinute: number;
  endMinute: number;
  breakStartMinute: number | null;
  breakEndMinute: number | null;
};

export type ShiftRule = ShiftTimes & {
  id: string;
  code: string;
  name: string;
  lateGraceMinutes: number;
  earlyGraceMinutes: number;
  workUnits: number;
  workWeekdays: readonly Weekday[];
};

// ---------- Dau vao ----------

function timeField(label: string) {
  return z
    .string()
    .trim()
    .refine((value) => timeToMinutes(value) !== null, `${label} cần dạng giờ:phút, ví dụ 08:00`);
}

function optionalTimeField(label: string) {
  return z
    .string()
    .trim()
    .refine(
      (value) => value === '' || timeToMinutes(value) !== null,
      `${label} cần dạng giờ:phút, ví dụ 12:00`,
    );
}

function minutesInRange(label: string, max: number) {
  const message = `${label} là số phút nguyên từ 0 đến ${max}`;
  return z.coerce.number<number>({ error: message }).int(message).min(0, message).max(max, message);
}

const workUnitsField = z.coerce
  .number<number>({ error: 'Số công cần là số, ví dụ 1 hoặc 0,5' })
  .min(0.25, 'Số công tối thiểu 0,25')
  .max(3, 'Số công tối đa 3')
  .refine((value) => Number.isInteger(value * 4), 'Số công là bội của 0,25, ví dụ 0,5 hoặc 1');

export const shiftForm = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{1,20}$/, 'Mã gồm chữ không dấu, số, gạch ngang, tối đa 20 ký tự'),
    name: z.string().trim().min(2, 'Tên ca cần ít nhất 2 ký tự').max(80, 'Tên ca tối đa 80 ký tự'),
    startTime: timeField('Giờ vào'),
    endTime: timeField('Giờ ra'),
    breakStartTime: optionalTimeField('Bắt đầu nghỉ'),
    breakEndTime: optionalTimeField('Kết thúc nghỉ'),
    lateGraceMinutes: minutesInRange('Cho phép đi muộn', 240),
    earlyGraceMinutes: minutesInRange('Cho phép về sớm', 240),
    workUnits: workUnitsField,
    workWeekdays: z.array(z.enum(WEEKDAYS)).min(1, 'Chọn ít nhất một ngày làm việc'),
  })
  .superRefine((value, context) => {
    const start = timeToMinutes(value.startTime);
    const end = timeToMinutes(value.endTime);
    if (start === null || end === null) return;
    if (start === end) {
      context.addIssue({ code: 'custom', path: ['endTime'], message: 'Giờ ra phải khác giờ vào' });
    }

    const hasBreakStart = value.breakStartTime !== '';
    const hasBreakEnd = value.breakEndTime !== '';
    if (hasBreakStart !== hasBreakEnd) {
      const path = hasBreakStart ? 'breakEndTime' : 'breakStartTime';
      context.addIssue({
        code: 'custom',
        path: [path],
        message: 'Nhập đủ cả giờ bắt đầu và kết thúc nghỉ, hoặc để trống cả hai',
      });
      return;
    }
    if (!hasBreakStart) return;

    const breakStart = timeToMinutes(value.breakStartTime);
    const breakEnd = timeToMinutes(value.breakEndTime);
    if (breakStart === null || breakEnd === null) return;
    const shift = {
      startMinute: start,
      endMinute: end,
      breakStartMinute: null,
      breakEndMinute: null,
    };
    const length = spanMinutes(start, end);
    const breakStartOffset = offsetFromStart(shift, breakStart);
    const breakEndOffset = offsetFromStart(shift, breakEnd);
    if (breakStartOffset === 0 || breakEndOffset <= breakStartOffset || breakEndOffset >= length) {
      context.addIssue({
        code: 'custom',
        path: ['breakEndTime'],
        message: 'Giờ nghỉ phải nằm trong ca và kết thúc sau khi bắt đầu',
      });
    }
  });
export type ShiftForm = z.infer<typeof shiftForm>;

export const createShiftInput = shiftForm;
export type CreateShiftInput = ShiftForm;

export const updateShiftInput = z.object({
  id: z.uuid(),
  expectedUpdatedAt: z.iso.datetime(),
  shift: shiftForm,
});
export type UpdateShiftInput = z.infer<typeof updateShiftInput>;

export const shiftIdInput = z.object({ id: z.uuid() });

export function emptyShiftForm(): ShiftForm {
  return {
    code: '',
    name: '',
    startTime: '',
    endTime: '',
    breakStartTime: '',
    breakEndTime: '',
    lateGraceMinutes: 0,
    earlyGraceMinutes: 0,
    workUnits: 1,
    workWeekdays: [],
  };
}

export function shiftFormValues(shift: ShiftRule): ShiftForm {
  return {
    code: shift.code,
    name: shift.name,
    startTime: minutesToTime(shift.startMinute),
    endTime: minutesToTime(shift.endMinute),
    breakStartTime: shift.breakStartMinute === null ? '' : minutesToTime(shift.breakStartMinute),
    breakEndTime: shift.breakEndMinute === null ? '' : minutesToTime(shift.breakEndMinute),
    lateGraceMinutes: shift.lateGraceMinutes,
    earlyGraceMinutes: shift.earlyGraceMinutes,
    workUnits: shift.workUnits,
    workWeekdays: [...shift.workWeekdays],
  };
}

// Doi form sang so phut, chi goi sau khi da validate.
export function shiftTimesFromForm(form: ShiftForm): ShiftTimes {
  const minutes = (value: string) => (value === '' ? null : timeToMinutes(value));
  return {
    startMinute: timeToMinutes(form.startTime) ?? 0,
    endMinute: timeToMinutes(form.endTime) ?? 0,
    breakStartMinute: minutes(form.breakStartTime),
    breakEndMinute: minutes(form.breakEndTime),
  };
}

function isoDateField(message: string) {
  return z.string().refine((value) => parseDisplayDate(value) !== null, message);
}

export const ASSIGNMENT_TARGET_LABEL = {
  ORG_UNIT: 'Đơn vị',
  USER: 'Nhân viên',
} as const;
export type AssignmentTarget = keyof typeof ASSIGNMENT_TARGET_LABEL;
export const ASSIGNMENT_TARGET_OPTIONS = (
  Object.keys(ASSIGNMENT_TARGET_LABEL) as AssignmentTarget[]
).map((value) => ({ value, label: ASSIGNMENT_TARGET_LABEL[value] }));

// Gia tri cua o chon ca khi muon bo gan rieng va theo don vi cap tren.
export const INHERIT_SHIFT_VALUE = 'THEO_CAP_TREN';

export const createAssignmentInput = z
  .object({
    target: z.enum(['ORG_UNIT', 'USER']),
    orgUnitId: z.uuid({ error: 'Vui lòng chọn đơn vị' }).nullable(),
    userId: z.uuid({ error: 'Vui lòng chọn nhân viên' }).nullable(),
    shiftId: z.union([z.uuid(), z.literal(INHERIT_SHIFT_VALUE)], { error: 'Vui lòng chọn ca' }),
    effectiveFrom: isoDateField('Từ ngày không hợp lệ, cần dạng dd/mm/yyyy'),
  })
  .superRefine((value, context) => {
    if (value.target === 'ORG_UNIT' && !value.orgUnitId) {
      context.addIssue({ code: 'custom', path: ['orgUnitId'], message: 'Vui lòng chọn đơn vị' });
    }
    if (value.target === 'USER' && !value.userId) {
      context.addIssue({ code: 'custom', path: ['userId'], message: 'Vui lòng chọn nhân viên' });
    }
  })
  // Bo gia tri cua loai doi tuong khong chon de may chu khong phai doan.
  .transform((value) => ({
    ...value,
    orgUnitId: value.target === 'ORG_UNIT' ? value.orgUnitId : null,
    userId: value.target === 'USER' ? value.userId : null,
  }));
export type CreateAssignmentForm = z.input<typeof createAssignmentInput>;
export type CreateAssignmentInput = z.output<typeof createAssignmentInput>;

export const deleteAssignmentInput = z.object({
  target: z.enum(['ORG_UNIT', 'USER']),
  id: z.uuid(),
});

const MAX_HOLIDAY_RANGE_DAYS = 31;

export const createHolidayInput = z
  .object({
    startDate: isoDateField('Từ ngày không hợp lệ, cần dạng dd/mm/yyyy'),
    endDate: z
      .string()
      .refine(
        (value) => value === '' || parseDisplayDate(value) !== null,
        'Đến ngày không hợp lệ, cần dạng dd/mm/yyyy',
      ),
    name: z.string().trim().min(2, 'Tên ngày cần ít nhất 2 ký tự').max(100, 'Tên tối đa 100 ký tự'),
    kind: z.enum(['HOLIDAY', 'MAKEUP_WORKDAY']),
  })
  .superRefine(({ startDate, endDate }, context) => {
    if (endDate === '') return;
    if (endDate < startDate) {
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Đến ngày phải sau hoặc bằng Từ ngày',
      });
      return;
    }
    if (daysBetween(startDate, endDate) >= MAX_HOLIDAY_RANGE_DAYS) {
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: `Mỗi lần thêm tối đa ${MAX_HOLIDAY_RANGE_DAYS} ngày`,
      });
    }
  });
export type CreateHolidayInput = z.infer<typeof createHolidayInput>;

export const deleteHolidayInput = z.object({ id: z.uuid() });

const ONE_DAY_MS = 86_400_000;

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / ONE_DAY_MS,
  );
}

// Moi ngay trong khoang, ca hai dau.
export function datesInRange(from: string, to: string): string[] {
  const count = daysBetween(from, to) + 1;
  return Array.from({ length: Math.max(count, 0) }, (_, index) =>
    new Date(Date.parse(`${from}T00:00:00.000Z`) + index * ONE_DAY_MS).toISOString().slice(0, 10),
  );
}

export const lookupWorkdayInput = z.object({
  userId: z.uuid({ error: 'Vui lòng chọn nhân viên' }),
  date: isoDateField('Ngày không hợp lệ, cần dạng dd/mm/yyyy'),
});
export type LookupWorkdayInput = z.infer<typeof lookupWorkdayInput>;

// ---------- Dong co xac dinh ca cua mot ngay ----------

// shiftId null nghia la khong gan rieng, theo don vi cap tren.
export type ShiftTimelineEntry = { shiftId: string | null; effectiveFrom: string };

export type WorkdayContext = {
  // Don vi cua nhan vien roi di len goc.
  unitLineage: readonly string[];
  userTimeline: readonly ShiftTimelineEntry[];
  unitTimelines: ReadonlyMap<string, readonly ShiftTimelineEntry[]>;
  shifts: ReadonlyMap<string, ShiftRule>;
  holidays: ReadonlyMap<string, { name: string; kind: HolidayKind }>;
};

export type ShiftSource = { kind: 'USER' } | { kind: 'ORG_UNIT'; orgUnitId: string };

export type DayType = 'WORKDAY' | 'DAY_OFF' | 'HOLIDAY' | 'NO_SHIFT';

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  WORKDAY: 'Ngày làm việc',
  DAY_OFF: 'Ngày nghỉ trong tuần',
  HOLIDAY: 'Nghỉ lễ',
  NO_SHIFT: 'Chưa được gán ca',
};

export type Workday = {
  date: string;
  dayType: DayType;
  shift: ShiftRule | null;
  source: ShiftSource | null;
  holidayName: string | null;
};

// Lan gan co hieu luc moi nhat tinh den ngay do.
export function entryOn<T extends { effectiveFrom: string }>(
  timeline: readonly T[],
  date: string,
): T | null {
  let latest: T | null = null;
  for (const entry of timeline) {
    if (entry.effectiveFrom > date) continue;
    if (!latest || entry.effectiveFrom > latest.effectiveFrom) latest = entry;
  }
  return latest;
}

function findShift(
  date: string,
  context: WorkdayContext,
): { shift: ShiftRule; source: ShiftSource } | null {
  const own = entryOn(context.userTimeline, date);
  const ownShift = own?.shiftId ? context.shifts.get(own.shiftId) : undefined;
  if (ownShift) return { shift: ownShift, source: { kind: 'USER' } };

  for (const orgUnitId of context.unitLineage) {
    const entry = entryOn(context.unitTimelines.get(orgUnitId) ?? [], date);
    const shift = entry?.shiftId ? context.shifts.get(entry.shiftId) : undefined;
    if (shift) return { shift, source: { kind: 'ORG_UNIT', orgUnitId } };
  }
  return null;
}

/*
 * Gan rieng cho nhan vien uu tien hon gan theo don vi. Don vi chua gan thi lay don vi cap tren
 * gan nhat. Ngay le luon la ngay nghi. Ngay lam bu luon la ngay lam, ke ca roi vao ngay nghi
 * trong tuan cua ca.
 */
export function resolveWorkday(date: string, context: WorkdayContext): Workday {
  const found = findShift(date, context);
  const holiday = context.holidays.get(date);
  const base = {
    date,
    shift: found?.shift ?? null,
    source: found?.source ?? null,
    holidayName: holiday?.name ?? null,
  };

  if (!found) return { ...base, dayType: 'NO_SHIFT' };
  if (holiday?.kind === 'HOLIDAY') return { ...base, dayType: 'HOLIDAY' };
  if (holiday?.kind === 'MAKEUP_WORKDAY') return { ...base, dayType: 'WORKDAY' };
  const isWorkday = found.shift.workWeekdays.includes(weekdayOf(date));
  return { ...base, dayType: isWorkday ? 'WORKDAY' : 'DAY_OFF' };
}

// ---------- Hien thi ----------

export const shiftRow = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  startMinute: z.number(),
  endMinute: z.number(),
  breakStartMinute: z.number().nullable(),
  breakEndMinute: z.number().nullable(),
  lateGraceMinutes: z.number(),
  earlyGraceMinutes: z.number(),
  workUnits: z.number(),
  workWeekdays: z.array(z.enum(WEEKDAYS)),
  assignmentCount: z.number(),
  updatedAt: z.iso.datetime(),
});
export type ShiftRow = z.infer<typeof shiftRow>;

export const listShiftsResult = pageResult(shiftRow);
export type ListShiftsResult = z.infer<typeof listShiftsResult>;

export const assignmentStatus = ['UPCOMING', 'ACTIVE', 'REPLACED'] as const;
export type AssignmentStatus = (typeof assignmentStatus)[number];

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  UPCOMING: 'Sắp áp dụng',
  ACTIVE: 'Đang áp dụng',
  REPLACED: 'Đã thay bằng lần gán sau',
};

// Lan gan moi nhat da toi ngay la dang ap dung, cac lan truoc do da bi thay.
export function resolveAssignmentStatus(
  effectiveFrom: string,
  activeFrom: string | null,
  today: string,
): AssignmentStatus {
  if (effectiveFrom > today) return 'UPCOMING';
  return effectiveFrom === activeFrom ? 'ACTIVE' : 'REPLACED';
}

export const assignmentRow = z.object({
  id: z.uuid(),
  target: z.enum(['ORG_UNIT', 'USER']),
  targetLabel: z.string(),
  shiftLabel: z.string().nullable(),
  effectiveFrom: z.string(),
  status: z.enum(assignmentStatus),
});
export type AssignmentRow = z.infer<typeof assignmentRow>;

export const listAssignmentsResult = pageResult(assignmentRow);
export type ListAssignmentsResult = z.infer<typeof listAssignmentsResult>;

export const holidayRow = z.object({
  id: z.uuid(),
  date: z.string(),
  name: z.string(),
  kind: z.enum(['HOLIDAY', 'MAKEUP_WORKDAY']),
});
export type HolidayRow = z.infer<typeof holidayRow>;

export type WorkdayLookup = {
  userName: string;
  date: string;
  dayType: DayType;
  shift: ShiftRule | null;
  sourceLabel: string | null;
  holidayName: string | null;
};

export type ShiftFormOptions = {
  shifts: Array<{ value: string; label: string }>;
  units: Array<{ value: string; label: string }>;
  users: Array<{ value: string; label: string }>;
};

const SHIFTS_PAGE_SIZE = 20;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

export function shiftsUrlParams(today: string) {
  const currentYear = Number(today.slice(0, 4));
  return z
    .object({
      tab: z.enum(['gan-ca', 'lich-nghi']).optional().catch(undefined),
      trang: z.coerce.number().int().positive().max(1_000_000).catch(1),
      nam: z.coerce.number().int().min(MIN_YEAR).max(MAX_YEAR).catch(currentYear),
    })
    .transform((url) => ({
      tab: url.tab ?? ('ca' as const),
      page: url.trang,
      pageSize: SHIFTS_PAGE_SIZE,
      year: url.nam,
    }));
}

export function shiftLabel(shift: { code: string; name: string }): string {
  return `${shift.code} - ${shift.name}`;
}
