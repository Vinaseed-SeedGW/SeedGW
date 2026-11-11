import 'server-only';
import { vietnamToday } from '@dms/contracts/format';
import { buildOrgTree, flattenOrgTree } from '@dms/contracts/org-tree';
import {
  entryOn,
  resolveAssignmentStatus,
  shiftLabel,
  type AssignmentRow,
  type HolidayRow,
  type ListAssignmentsResult,
  type ListShiftsResult,
  type ShiftFormOptions,
} from '@dms/contracts/shifts';
import { db } from '@dms/db/client';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getAssignableOrgUnitIds, getScopedDb } from '@/server/auth/scoped-db';
import { SHIFT_SELECT, toShiftRule } from '@/server/services/shifts';
import { dateFromInput, dateToInput } from '@/server/services/users';

type PageInput = { page: number; pageSize: number };

// Ca dung chung ca cong ty nen khong gioi han theo pham vi du lieu.
export async function listShifts(input: PageInput): Promise<ListShiftsResult> {
  const user = await requireUser();
  assertCan(user, 'admin.shift.read');

  const [rows, total] = await Promise.all([
    db.shift.findMany({
      orderBy: { code: 'asc' },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        ...SHIFT_SELECT,
        updatedAt: true,
        _count: { select: { orgUnitShifts: true, userShifts: true } },
      },
    }),
    db.shift.count(),
  ]);

  return {
    items: rows.map(({ _count, updatedAt, ...row }) => ({
      ...toShiftRule(row),
      workWeekdays: row.workWeekdays,
      assignmentCount: _count.orgUnitShifts + _count.userShifts,
      updatedAt: updatedAt.toISOString(),
    })),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

type TimelineRow = {
  id: string;
  targetId: string;
  target: AssignmentRow['target'];
  targetLabel: string;
  shiftLabel: string | null;
  effectiveFrom: string;
};

/*
 * Trang thai cua mot lan gan phu thuoc cac lan gan khac cua cung doi tuong, nen doc het roi
 * phan trang tren may chu. So lan gan chi vai tram (moi don vi, nhan vien gan rieng vai lan).
 */
export async function listAssignments(input: PageInput): Promise<ListAssignmentsResult> {
  const [user, scoped] = await Promise.all([requireUser(), getScopedDb()]);
  assertCan(user, 'admin.shift.read');

  const shiftSelect = { select: { code: true, name: true } } as const;
  const [unitRows, userRows] = await Promise.all([
    scoped.orgUnitShift.findMany({
      select: {
        id: true,
        orgUnitId: true,
        effectiveFrom: true,
        shift: shiftSelect,
        orgUnit: { select: { name: true } },
      },
    }),
    scoped.userShift.findMany({
      select: {
        id: true,
        userId: true,
        effectiveFrom: true,
        shift: shiftSelect,
        user: { select: { employeeCode: true, fullName: true } },
      },
    }),
  ]);

  const rows: TimelineRow[] = [
    ...unitRows.map((row) => ({
      id: row.id,
      targetId: row.orgUnitId,
      target: 'ORG_UNIT' as const,
      targetLabel: row.orgUnit.name,
      shiftLabel: row.shift ? shiftLabel(row.shift) : null,
      effectiveFrom: dateToInput(row.effectiveFrom),
    })),
    ...userRows.map((row) => ({
      id: row.id,
      targetId: row.userId,
      target: 'USER' as const,
      targetLabel: `${row.user.employeeCode} - ${row.user.fullName}`,
      shiftLabel: row.shift ? shiftLabel(row.shift) : null,
      effectiveFrom: dateToInput(row.effectiveFrom),
    })),
  ];

  const today = vietnamToday();
  const timelines = new Map<string, TimelineRow[]>();
  for (const row of rows) {
    const key = `${row.target}:${row.targetId}`;
    timelines.set(key, [...(timelines.get(key) ?? []), row]);
  }

  const items = rows
    .map((row) => {
      const active = entryOn(timelines.get(`${row.target}:${row.targetId}`) ?? [], today);
      return {
        id: row.id,
        target: row.target,
        targetLabel: row.targetLabel,
        shiftLabel: row.shiftLabel,
        effectiveFrom: row.effectiveFrom,
        status: resolveAssignmentStatus(row.effectiveFrom, active?.effectiveFrom ?? null, today),
      };
    })
    .sort(
      (a, b) =>
        a.target.localeCompare(b.target) ||
        a.targetLabel.localeCompare(b.targetLabel, 'vi') ||
        b.effectiveFrom.localeCompare(a.effectiveFrom),
    );

  const start = (input.page - 1) * input.pageSize;
  return {
    items: items.slice(start, start + input.pageSize),
    total: items.length,
    page: input.page,
    pageSize: input.pageSize,
  };
}

// Lich nghi cua mot nam chi vai chuc ngay nen tra ve tron nam, khong phan trang.
export async function listHolidays(year: number): Promise<HolidayRow[]> {
  const user = await requireUser();
  assertCan(user, 'admin.shift.read');

  const rows = await db.holiday.findMany({
    where: {
      date: {
        gte: dateFromInput(`${year}-01-01`) as Date,
        lte: dateFromInput(`${year}-12-31`) as Date,
      },
    },
    orderBy: { date: 'asc' },
    select: { id: true, date: true, name: true, kind: true },
  });
  return rows.map((row) => ({ ...row, date: dateToInput(row.date) }));
}

// Don vi va nhan vien chi lay trong pham vi nguoi dang gan ca.
export async function getShiftFormOptions(): Promise<ShiftFormOptions> {
  const [user, scoped, assignable] = await Promise.all([
    requireUser(),
    getScopedDb(),
    getAssignableOrgUnitIds(),
  ]);
  assertCan(user, 'admin.shift.read');

  const [shifts, units, users] = await Promise.all([
    db.shift.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
    db.orgUnit.findMany({ select: { id: true, name: true, parentId: true } }),
    scoped.user.findMany({
      where: { isActive: true },
      orderBy: { employeeCode: 'asc' },
      select: { id: true, employeeCode: true, fullName: true },
    }),
  ]);

  return {
    shifts: shifts.map((shift) => ({ value: shift.id, label: shiftLabel(shift) })),
    units: flattenOrgTree<(typeof units)[number]>(buildOrgTree(units))
      .filter(({ id }) => assignable === null || assignable.has(id))
      .map(({ id, name }) => ({ value: id, label: name })),
    users: users.map(({ id, employeeCode, fullName }) => ({
      value: id,
      label: `${employeeCode} - ${fullName}`,
    })),
  };
}
