import 'server-only';
import { resolveEffectiveWorkflow } from '@dms/contracts/approval-engine';
import { vietnamToday } from '@dms/contracts/format';
import { buildOrgTree, flattenOrgTree } from '@dms/contracts/org-tree';
import {
  resolveDelegationStatus,
  type ListDelegationsResult,
  type SelectOption,
  type WorkflowDetail,
  type WorkflowFormOptions,
  type WorkflowUnitRow,
} from '@dms/contracts/workflows';
import { db } from '@dms/db/client';
import { assertCan, can } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getAssignableOrgUnitIds, getScopedDb } from '@/server/auth/scoped-db';
import { dateToInput } from '@/server/services/users';
import { VERSION_SELECT, loadActiveWorkflows, toStepView } from '@/server/services/workflows';

const MAX_HISTORY_VERSIONS = 20;
const UNIT_SELECT = { id: true, code: true, name: true, parentId: true } as const;

// Cau hinh quy trinh dung chung nhu cay to chuc va phai doc duoc don vi cha de ke thua,
// nen khong gioi han theo pham vi du lieu. Viec sua moi bi gioi han theo don vi.
export async function listWorkflowUnits(): Promise<WorkflowUnitRow[]> {
  const user = await requireUser();
  assertCan(user, 'admin.workflow.read');

  const [units, active] = await Promise.all([
    db.orgUnit.findMany({ select: UNIT_SELECT }),
    loadActiveWorkflows(),
  ]);
  const nameOf = new Map(units.map(({ id, name }) => [id, name]));

  return units.map((unit) => {
    const effective = resolveEffectiveWorkflow(units, active, unit.id);
    return {
      ...unit,
      source: !effective ? 'NONE' : effective.isInherited ? 'INHERITED' : 'OWN',
      sourceUnitName: effective ? (nameOf.get(effective.sourceUnitId) ?? null) : null,
      version: effective?.workflow.version ?? null,
      stepCount: effective?.workflow.steps.length ?? 0,
    };
  });
}

export async function getWorkflowDetail(orgUnitId: string): Promise<WorkflowDetail | null> {
  const user = await requireUser();
  assertCan(user, 'admin.workflow.read');

  const [units, active, assignable, workflow] = await Promise.all([
    db.orgUnit.findMany({ select: UNIT_SELECT }),
    loadActiveWorkflows(),
    getAssignableOrgUnitIds(),
    db.approvalWorkflow.findUnique({
      where: { orgUnitId_subject: { orgUnitId, subject: 'ORDER' } },
      select: {
        activeVersion: true,
        versions: {
          orderBy: { version: 'desc' },
          take: MAX_HISTORY_VERSIONS,
          select: VERSION_SELECT,
        },
      },
    }),
  ]);

  const unit = units.find(({ id }) => id === orgUnitId);
  if (!unit) return null;

  const own = active.get(orgUnitId) ?? null;
  const effective = own ? null : resolveEffectiveWorkflow(units, active, orgUnitId);

  return {
    unit: { id: unit.id, code: unit.code, name: unit.name, isRoot: unit.parentId === null },
    canManage:
      can(user, 'admin.workflow.manage') && (assignable === null || assignable.has(orgUnitId)),
    own,
    inherited: effective
      ? {
          sourceUnitName: units.find(({ id }) => id === effective.sourceUnitId)?.name ?? '',
          version: effective.workflow.version,
          steps: effective.workflow.steps,
        }
      : null,
    history: (workflow?.versions ?? []).map((version) => ({
      version: version.version,
      isActive: version.version === workflow?.activeVersion,
      createdAt: version.createdAt.toISOString(),
      createdByName: version.createdBy.fullName,
      steps: version.steps.map(toStepView),
    })),
  };
}

function textOption(value: string): SelectOption {
  return { value, label: value };
}

export async function getWorkflowFormOptions(): Promise<WorkflowFormOptions> {
  const user = await requireUser();
  assertCan(user, 'admin.workflow.read');

  // Nguoi duyet co the o ngoai don vi dang cau hinh, vi du Ke toan o van phong cong ty.
  const [roles, users, jobTitles, usedJobTitles, units] = await Promise.all([
    db.role.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { isActive: true },
      orderBy: { employeeCode: 'asc' },
      select: { id: true, employeeCode: true, fullName: true },
    }),
    db.user.findMany({
      where: { isActive: true, jobTitle: { not: null } },
      distinct: ['jobTitle'],
      select: { jobTitle: true },
    }),
    db.approvalStep.findMany({
      where: { approverJobTitle: { not: null } },
      distinct: ['approverJobTitle'],
      select: { approverJobTitle: true },
    }),
    db.orgUnit.findMany({ select: UNIT_SELECT }),
  ]);

  const titles = new Set(
    [
      ...jobTitles.map(({ jobTitle }) => jobTitle),
      ...usedJobTitles.map(({ approverJobTitle }) => approverJobTitle),
    ].flatMap((title) => (title?.trim() ? [title.trim()] : [])),
  );

  return {
    roles: roles.map(({ id, name }) => ({ value: id, label: name })),
    users: users.map(({ id, employeeCode, fullName }) => ({
      value: id,
      label: `${employeeCode} - ${fullName}`,
    })),
    jobTitles: [...titles].sort((a, b) => a.localeCompare(b, 'vi')).map(textOption),
    units: flattenOrgTree<(typeof units)[number]>(buildOrgTree(units)).map(({ id, name }) => ({
      value: id,
      label: name,
    })),
  };
}

export async function listDelegations(input: {
  page: number;
  pageSize: number;
}): Promise<ListDelegationsResult> {
  const [user, scoped] = await Promise.all([requireUser(), getScopedDb()]);
  assertCan(user, 'admin.workflow.read');

  const [rows, total] = await Promise.all([
    scoped.delegation.findMany({
      orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        reason: true,
        revokedAt: true,
        delegator: { select: { fullName: true } },
        delegate: { select: { fullName: true } },
      },
    }),
    scoped.delegation.count(),
  ]);

  const today = vietnamToday();
  return {
    items: rows.map((row) => {
      const startDate = dateToInput(row.startDate);
      const endDate = dateToInput(row.endDate);
      return {
        id: row.id,
        delegatorName: row.delegator.fullName,
        delegateName: row.delegate.fullName,
        startDate,
        endDate,
        reason: row.reason,
        status: resolveDelegationStatus(
          { startDate, endDate, isRevoked: row.revokedAt !== null },
          today,
        ),
      };
    }),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function getDelegationUserOptions(): Promise<SelectOption[]> {
  const [user, scoped] = await Promise.all([requireUser(), getScopedDb()]);
  assertCan(user, 'admin.workflow.manage');

  const rows = await scoped.user.findMany({
    where: { isActive: true },
    orderBy: { employeeCode: 'asc' },
    select: { id: true, employeeCode: true, fullName: true },
  });
  return rows.map(({ id, employeeCode, fullName }) => ({
    value: id,
    label: `${employeeCode} - ${fullName}`,
  }));
}
