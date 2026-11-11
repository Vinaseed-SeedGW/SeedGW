'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { AuditAction, AuditEntityType } from '@dms/contracts/audit';
import type { ActionResult } from '@dms/contracts/common';
import {
  createAssignmentInput,
  createHolidayInput,
  createShiftInput,
  deleteAssignmentInput,
  deleteHolidayInput,
  lookupWorkdayInput,
  resolveWorkday,
  shiftIdInput,
  updateShiftInput,
  type WorkdayLookup,
} from '@dms/contracts/shifts';
import { db } from '@dms/db/client';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser, type CurrentUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import { getClientIp, writeAudit } from '@/server/services/audit';
import { DomainError } from '@/server/services/domain-error';
import {
  createAssignment,
  createHolidays,
  createShift,
  deleteAssignment,
  deleteHoliday,
  deleteShift,
  loadWorkdayContext,
  updateShift,
  type ShiftOutcome,
} from '@/server/services/shifts';

const SHIFTS_PATH = '/quan-tri/ca-lam-viec';

async function requireShiftManager(): Promise<CurrentUser> {
  const user = await requireUser();
  assertCan(user, 'admin.shift.manage');
  return user;
}

async function recordChange(
  user: CurrentUser,
  action: AuditAction,
  entityType: AuditEntityType,
  outcome: ShiftOutcome,
) {
  if (Object.keys(outcome.changes).length > 0) {
    const ip = await getClientIp();
    after(() =>
      writeAudit({
        actor: user,
        action,
        entityType,
        entityId: outcome.id,
        entityLabel: outcome.label,
        changes: outcome.changes,
        ip,
      }),
    );
  }
  revalidatePath(SHIFTS_PATH);
}

type Done = ActionResult<{ id: string }>;

export async function createShiftAction(raw: unknown): Promise<Done> {
  try {
    const user = await requireShiftManager();
    const parsed = createShiftInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await createShift(user, parsed.data);
    await recordChange(user, 'shift.create', 'Shift', outcome);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateShiftAction(raw: unknown): Promise<Done> {
  try {
    const user = await requireShiftManager();
    const parsed = updateShiftInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await updateShift(user, parsed.data);
    await recordChange(user, 'shift.update', 'Shift', outcome);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteShiftAction(raw: unknown): Promise<Done> {
  try {
    const user = await requireShiftManager();
    const parsed = shiftIdInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await deleteShift(user, parsed.data.id);
    await recordChange(user, 'shift.delete', 'Shift', outcome);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createAssignmentAction(raw: unknown): Promise<Done> {
  try {
    const user = await requireShiftManager();
    const parsed = createAssignmentInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await createAssignment(user, parsed.data);
    await recordChange(user, 'shift-assignment.create', 'ShiftAssignment', outcome);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteAssignmentAction(raw: unknown): Promise<Done> {
  try {
    const user = await requireShiftManager();
    const parsed = deleteAssignmentInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await deleteAssignment(parsed.data.target, parsed.data.id);
    await recordChange(user, 'shift-assignment.delete', 'ShiftAssignment', outcome);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createHolidayAction(raw: unknown): Promise<Done> {
  try {
    const user = await requireShiftManager();
    const parsed = createHolidayInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await createHolidays(user, parsed.data);
    await recordChange(user, 'holiday.create', 'Holiday', outcome);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteHolidayAction(raw: unknown): Promise<Done> {
  try {
    const user = await requireShiftManager();
    const parsed = deleteHolidayInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await deleteHoliday(user, parsed.data.id);
    await recordChange(user, 'holiday.delete', 'Holiday', outcome);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

// Tra cuu chi doc du lieu, dung de kiem tra cau hinh truoc khi tong hop cong.
export async function lookupWorkdayAction(raw: unknown): Promise<ActionResult<WorkdayLookup>> {
  try {
    const [user, scoped] = await Promise.all([requireUser(), getScopedDb()]);
    assertCan(user, 'admin.shift.read');
    const parsed = lookupWorkdayInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const employee = await scoped.user.findFirst({
      where: { id: parsed.data.userId },
      select: { id: true, orgUnitId: true, employeeCode: true, fullName: true },
    });
    if (!employee) {
      throw new DomainError('NOT_FOUND', 'Không tìm thấy nhân viên trong phạm vi của bạn');
    }

    const { date } = parsed.data;
    const context = await loadWorkdayContext(employee, date, date);
    const workday = resolveWorkday(date, context);
    let sourceLabel: string | null = null;
    if (workday.source?.kind === 'USER') sourceLabel = 'Gán riêng cho nhân viên';
    if (workday.source?.kind === 'ORG_UNIT') {
      const unit = await db.orgUnit.findUnique({
        where: { id: workday.source.orgUnitId },
        select: { name: true },
      });
      const isOwnUnit = workday.source.orgUnitId === employee.orgUnitId;
      sourceLabel = `${isOwnUnit ? 'Theo đơn vị' : 'Kế thừa từ đơn vị'} ${unit?.name ?? ''}`.trim();
    }

    return {
      ok: true,
      data: {
        userName: `${employee.employeeCode} - ${employee.fullName}`,
        date,
        dayType: workday.dayType,
        shift: workday.shift,
        sourceLabel,
        holidayName: workday.holidayName,
      },
    };
  } catch (error) {
    return toActionError(error);
  }
}
