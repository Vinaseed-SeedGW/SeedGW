import type { SystemSettings } from './settings';
import type { SupportDueState, SupportSeverity, SupportStatus, SupportType } from './support';

// Thời hạn yêu cầu hỗ trợ (T4): đếm theo giờ làm việc giờ Việt Nam, chưa trừ ngày lễ.

const VN_OFFSET_MS = 7 * 3_600_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export type WorkCalendar = { startHour: number; endHour: number; daysPerWeek: number };

export function workCalendarOf(settings: SystemSettings): WorkCalendar {
  return {
    startHour: settings.supportWorkStartHour,
    endHour: settings.supportWorkEndHour,
    daysPerWeek: settings.supportWorkDaysPerWeek,
  };
}

function isWorkDay(vnDayStart: number, calendar: WorkCalendar): boolean {
  // 1/1/1970 là thứ Năm; getUTCDay trên mốc đã cộng 7 giờ là thứ theo giờ Việt Nam.
  const weekday = new Date(vnDayStart).getUTCDay();
  if (weekday === 0) return false;
  return weekday <= calendar.daysPerWeek;
}

/** Cộng số giờ làm việc vào một mốc; ngoài giờ thì bắt đầu đếm từ đầu giờ làm việc kế tiếp. */
export function addWorkingHours(start: Date, hours: number, calendar: WorkCalendar): Date {
  let remaining = hours * HOUR_MS;
  let cursor = start.getTime() + VN_OFFSET_MS;
  // Giới hạn vòng lặp để tham số lạ không treo máy chủ (tối đa khoảng 2 năm).
  for (let guard = 0; guard < 800; guard += 1) {
    const dayStart = Math.floor(cursor / DAY_MS) * DAY_MS;
    const open = dayStart + calendar.startHour * HOUR_MS;
    const close = dayStart + calendar.endHour * HOUR_MS;
    if (isWorkDay(dayStart, calendar) && cursor < close) {
      const from = Math.max(cursor, open);
      const available = close - from;
      if (remaining <= available) return new Date(from + remaining - VN_OFFSET_MS);
      remaining -= available;
    }
    cursor = dayStart + DAY_MS;
  }
  return new Date(cursor - VN_OFFSET_MS);
}

type SlaSeverity = SupportSeverity;

/** Hỏi đáp, Góp ý và Báo lỗi chưa chọn mức tính như mức Nhẹ. */
export function slaSeverityOf(type: SupportType, severity: SupportSeverity | null): SlaSeverity {
  return type === 'BUG' && severity ? severity : 'MINOR';
}

export function supportDueDates(
  createdAt: Date,
  type: SupportType,
  severity: SupportSeverity | null,
  settings: SystemSettings,
): { firstResponseDueAt: Date; resolveDueAt: Date } {
  const calendar = workCalendarOf(settings);
  const level = slaSeverityOf(type, severity);
  const hours = {
    BLOCKER: [settings.supportFirstResponseHoursBlocker, settings.supportResolveHoursBlocker],
    MAJOR: [settings.supportFirstResponseHoursMajor, settings.supportResolveHoursMajor],
    MINOR: [settings.supportFirstResponseHoursMinor, settings.supportResolveHoursMinor],
  }[level];
  return {
    firstResponseDueAt: addWorkingHours(createdAt, hours[0] ?? 9, calendar),
    resolveDueAt: addWorkingHours(createdAt, hours[1] ?? 45, calendar),
  };
}

export type SupportDueInput = {
  status: SupportStatus;
  createdAt: Date;
  firstResponseAt: Date | null;
  firstResponseDueAt: Date | null;
  resolveDueAt: Date | null;
};

/**
 * Mốc đang tính và tình trạng. Không tính khi đã xong, đã đóng, hoặc đang chờ người gửi trả lời.
 * Sắp quá hạn khi thời gian còn lại không quá phần trăm ở Tham số của cả khoảng thời hạn.
 */
export function supportDueOf(
  input: SupportDueInput,
  dueSoonPercent: number,
  now = new Date(),
): { stage: 'FIRST_RESPONSE' | 'RESOLVE'; state: SupportDueState; dueAt: Date } | null {
  if (
    input.status === 'DONE' ||
    input.status === 'CLOSED' ||
    input.status === 'WAITING_REQUESTER'
  ) {
    return null;
  }
  const stage = input.firstResponseAt ? 'RESOLVE' : 'FIRST_RESPONSE';
  const dueAt = stage === 'RESOLVE' ? input.resolveDueAt : input.firstResponseDueAt;
  if (!dueAt) return null;
  const left = dueAt.getTime() - now.getTime();
  const span = Math.max(1, dueAt.getTime() - input.createdAt.getTime());
  const state: SupportDueState =
    left < 0 ? 'OVERDUE' : left <= (span * dueSoonPercent) / 100 ? 'DUE_SOON' : 'ON_TIME';
  return { stage, state, dueAt };
}
