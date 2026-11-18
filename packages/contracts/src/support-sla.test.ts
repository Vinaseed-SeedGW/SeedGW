import { describe, expect, it } from 'vitest';
import { resolveSystemSettings } from './settings';
import { addWorkingHours, supportDueDates, supportDueOf } from './support-sla';

const calendar = { startHour: 8, endHour: 17, daysPerWeek: 5 };
// Giờ Việt Nam viết dạng +07:00 cho dễ đọc.
const vn = (value: string) => new Date(`${value}+07:00`);
const iso = (date: Date) => new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(0, 16);

describe('addWorkingHours', () => {
  it('counts inside the same working day', () => {
    expect(iso(addWorkingHours(vn('2026-11-18T09:00'), 4, calendar))).toBe('2026-11-18T13:00');
  });

  it('starts at opening time when sent before work', () => {
    expect(iso(addWorkingHours(vn('2026-11-18T06:30'), 1, calendar))).toBe('2026-11-18T09:00');
  });

  it('carries over the night', () => {
    expect(iso(addWorkingHours(vn('2026-11-18T16:00'), 4, calendar))).toBe('2026-11-19T11:00');
  });

  it('skips the weekend for a 5 day week, keeps Saturday for 6', () => {
    // 20/11/2026 là thứ Sáu.
    expect(iso(addWorkingHours(vn('2026-11-20T16:00'), 2, calendar))).toBe('2026-11-23T09:00');
    expect(iso(addWorkingHours(vn('2026-11-20T16:00'), 2, { ...calendar, daysPerWeek: 6 }))).toBe(
      '2026-11-21T09:00',
    );
  });

  it('starts Monday for a request sent on Sunday', () => {
    expect(iso(addWorkingHours(vn('2026-11-22T10:00'), 9, calendar))).toBe('2026-11-23T17:00');
  });
});

describe('supportDueDates', () => {
  const settings = resolveSystemSettings({});
  it('uses severity hours for bugs and minor hours for questions', () => {
    const blocker = supportDueDates(vn('2026-11-18T09:00'), 'BUG', 'BLOCKER', settings);
    expect(iso(blocker.firstResponseDueAt)).toBe('2026-11-18T10:00');
    expect(iso(blocker.resolveDueAt)).toBe('2026-11-18T13:00');
    const question = supportDueDates(vn('2026-11-18T09:00'), 'QUESTION', null, settings);
    expect(iso(question.firstResponseDueAt)).toBe('2026-11-19T09:00');
  });
});

describe('supportDueOf', () => {
  const base = {
    status: 'NEW' as const,
    createdAt: vn('2026-11-18T09:00'),
    firstResponseAt: null,
    firstResponseDueAt: vn('2026-11-18T13:00'),
    resolveDueAt: vn('2026-11-19T13:00'),
  };

  it('moves from on time to due soon to overdue', () => {
    expect(supportDueOf(base, 25, vn('2026-11-18T10:00'))?.state).toBe('ON_TIME');
    expect(supportDueOf(base, 25, vn('2026-11-18T12:30'))?.state).toBe('DUE_SOON');
    expect(supportDueOf(base, 25, vn('2026-11-18T13:01'))?.state).toBe('OVERDUE');
  });

  it('tracks the resolve deadline after the first response', () => {
    const due = supportDueOf(
      { ...base, firstResponseAt: vn('2026-11-18T09:30') },
      25,
      vn('2026-11-18T14:00'),
    );
    expect(due?.stage).toBe('RESOLVE');
    expect(due?.state).toBe('ON_TIME');
  });

  it('pauses while waiting for the requester and stops when done', () => {
    expect(supportDueOf({ ...base, status: 'WAITING_REQUESTER' }, 25)).toBeNull();
    expect(supportDueOf({ ...base, status: 'DONE' }, 25)).toBeNull();
  });
});
