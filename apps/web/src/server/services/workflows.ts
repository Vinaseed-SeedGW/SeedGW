import 'server-only';
import type { Prisma } from '@prisma/client';
import {
  buildApprovalChain,
  resolveEffectiveWorkflow,
  type ApprovalChain,
  type ApprovalDirectory,
  type ApprovalFacts,
  type EffectiveWorkflow,
} from '@dms/contracts/approval-engine';
import { auditChanges, type AuditChanges } from '@dms/contracts/audit';
import { vietnamToday } from '@dms/contracts/format';
import {
  stepConditions,
  summarizeSteps,
  type ApprovalStepInput,
  type InheritWorkflowInput,
  type PublishWorkflowInput,
  type StepView,
} from '@dms/contracts/workflows';
import { db } from '@dms/db/client';
import type { CurrentUser } from '@/server/auth/current-user';
import { getAssignableOrgUnitIds } from '@/server/auth/scoped-db';
import { DomainError } from '@/server/services/domain-error';
import { isUniqueViolation } from '@/server/services/users';

export type WorkflowOutcome = { id: string; label: string; changes: AuditChanges };

type StepRow = Prisma.ApprovalStepGetPayload<{ select: typeof STEP_SELECT }>;

const SUBJECT = 'ORDER' as const;
const STALE_WORKFLOW_MESSAGE = 'Quy trình vừa được người khác sửa, vui lòng tải lại trang';

const STEP_SELECT = {
  name: true,
  approverType: true,
  approverRoleId: true,
  approverJobTitle: true,
  approverUserId: true,
  approvalMode: true,
  slaHours: true,
  escalationType: true,
  escalationUserId: true,
  skipBelowVnd: true,
  conditionMatch: true,
  conditions: true,
  approverRole: { select: { name: true } },
  approverUser: { select: { fullName: true } },
  escalationUser: { select: { fullName: true } },
} satisfies Prisma.ApprovalStepSelect;

export const VERSION_SELECT = {
  workflowId: true,
  version: true,
  createdAt: true,
  createdBy: { select: { fullName: true } },
  steps: { orderBy: { position: 'asc' }, select: STEP_SELECT },
} satisfies Prisma.ApprovalWorkflowVersionSelect;

function toStepInput(row: StepRow): ApprovalStepInput {
  return {
    name: row.name,
    approverType: row.approverType,
    approverRoleId: row.approverRoleId,
    approverJobTitle: row.approverJobTitle,
    approverUserId: row.approverUserId,
    approvalMode: row.approvalMode,
    slaHours: row.slaHours,
    escalationType: row.escalationType,
    escalationUserId: row.escalationUserId,
    skipBelowVnd: Number(row.skipBelowVnd),
    conditionMatch: row.conditionMatch,
    conditions: stepConditions.parse(row.conditions),
  };
}

export function toStepView(row: StepRow): StepView {
  return {
    input: toStepInput(row),
    approverLabel:
      row.approverRole?.name ?? row.approverUser?.fullName ?? row.approverJobTitle ?? '(đã xoá)',
    escalationLabel: row.escalationUser?.fullName ?? null,
  };
}

export type ActiveWorkflow = { version: number; steps: StepView[] };

export async function loadActiveWorkflows(): Promise<Map<string, ActiveWorkflow>> {
  const workflows = await db.approvalWorkflow.findMany({
    where: { subject: SUBJECT, activeVersion: { not: null } },
    select: { id: true, orgUnitId: true, activeVersion: true },
  });
  if (workflows.length === 0) return new Map();

  const versions = await db.approvalWorkflowVersion.findMany({
    where: {
      OR: workflows.map(({ id, activeVersion }) => ({
        workflowId: id,
        version: activeVersion ?? 0,
      })),
    },
    select: VERSION_SELECT,
  });
  const unitOfWorkflow = new Map(workflows.map(({ id, orgUnitId }) => [id, orgUnitId]));

  return new Map(
    versions.flatMap((version) => {
      const orgUnitId = unitOfWorkflow.get(version.workflowId);
      if (!orgUnitId) return [];
      const active = { version: version.version, steps: version.steps.map(toStepView) };
      return [[orgUnitId, active] as const];
    }),
  );
}

async function assertUnitManageable(orgUnitId: string): Promise<void> {
  const assignable = await getAssignableOrgUnitIds();
  if (assignable && !assignable.has(orgUnitId)) {
    throw new DomainError('FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
  }
}

async function findUnit(orgUnitId: string) {
  const unit = await db.orgUnit.findUnique({
    where: { id: orgUnitId },
    select: { code: true, parentId: true },
  });
  if (!unit) throw new DomainError('NOT_FOUND', 'Không tìm thấy đơn vị này');
  return unit;
}

function fieldError(path: string, message: string): DomainError {
  return new DomainError('VALIDATION', message, { [path]: message });
}

// Doc nhan de ghi nhat ky, dong thoi chan vai tro da xoa va nguoi da khoa.
async function loadStepViews(steps: readonly ApprovalStepInput[]): Promise<StepView[]> {
  const roleIds = steps.flatMap(({ approverRoleId }) => approverRoleId ?? []);
  const userIds = steps.flatMap((step) => [step.approverUserId, step.escalationUserId] as const);
  const [roles, users] = await Promise.all([
    db.role.findMany({ where: { id: { in: roleIds } }, select: { id: true, name: true } }),
    db.user.findMany({
      where: { id: { in: userIds.flatMap((id) => id ?? []) }, isActive: true },
      select: { id: true, fullName: true },
    }),
  ]);
  const roleName = new Map(roles.map(({ id, name }) => [id, name]));
  const userName = new Map(users.map(({ id, fullName }) => [id, fullName]));
  const inactiveMessage = 'Người này không còn hoạt động, vui lòng chọn người khác';

  return steps.map((step, index) => {
    if (step.approverRoleId && !roleName.has(step.approverRoleId)) {
      throw fieldError(`steps.${index}.approverRoleId`, 'Vai trò này không còn tồn tại');
    }
    if (step.approverUserId && !userName.has(step.approverUserId)) {
      throw fieldError(`steps.${index}.approverUserId`, inactiveMessage);
    }
    if (step.escalationUserId && !userName.has(step.escalationUserId)) {
      throw fieldError(`steps.${index}.escalationUserId`, inactiveMessage);
    }
    return {
      input: step,
      approverLabel:
        (step.approverRoleId && roleName.get(step.approverRoleId)) ||
        (step.approverUserId && userName.get(step.approverUserId)) ||
        (step.approverJobTitle ?? ''),
      escalationLabel: step.escalationUserId ? (userName.get(step.escalationUserId) ?? null) : null,
    };
  });
}

export async function publishWorkflow(
  actor: CurrentUser,
  input: PublishWorkflowInput,
): Promise<WorkflowOutcome> {
  await assertUnitManageable(input.orgUnitId);
  const [unit, views] = await Promise.all([findUnit(input.orgUnitId), loadStepViews(input.steps)]);
  const staleError = new DomainError('CONFLICT', STALE_WORKFLOW_MESSAGE);

  try {
    return await db.$transaction(async (tx) => {
      const workflow = await tx.approvalWorkflow.upsert({
        where: { orgUnitId_subject: { orgUnitId: input.orgUnitId, subject: SUBJECT } },
        create: { orgUnitId: input.orgUnitId, subject: SUBJECT },
        update: {},
        select: { id: true, activeVersion: true },
      });
      if (workflow.activeVersion !== input.expectedVersion) throw staleError;

      const current = workflow.activeVersion
        ? await tx.approvalWorkflowVersion.findUniqueOrThrow({
            where: {
              workflowId_version: { workflowId: workflow.id, version: workflow.activeVersion },
            },
            select: VERSION_SELECT,
          })
        : null;
      const currentViews = current?.steps.map(toStepView) ?? [];
      const isUnchanged =
        current !== null &&
        JSON.stringify(currentViews.map((view) => view.input)) === JSON.stringify(input.steps);
      if (isUnchanged) return { id: workflow.id, label: unit.code, changes: {} };

      const { _max } = await tx.approvalWorkflowVersion.aggregate({
        where: { workflowId: workflow.id },
        _max: { version: true },
      });
      const nextVersion = (_max.version ?? 0) + 1;

      await tx.approvalWorkflowVersion.create({
        data: {
          workflowId: workflow.id,
          version: nextVersion,
          createdById: actor.id,
          steps: {
            createMany: {
              data: input.steps.map((step, index) => ({ ...step, position: index + 1 })),
            },
          },
        },
      });
      const { count } = await tx.approvalWorkflow.updateMany({
        where: { id: workflow.id, activeVersion: input.expectedVersion },
        data: { activeVersion: nextVersion },
      });
      if (count === 0) throw staleError;

      return {
        id: workflow.id,
        label: unit.code,
        changes: auditChanges(
          {
            version: workflow.activeVersion,
            steps: current ? summarizeSteps(currentViews) : null,
          },
          { version: nextVersion, steps: summarizeSteps(views) },
        ),
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw staleError;
    throw error;
  }
}

export async function inheritWorkflow(input: InheritWorkflowInput): Promise<WorkflowOutcome> {
  await assertUnitManageable(input.orgUnitId);
  const unit = await findUnit(input.orgUnitId);
  if (unit.parentId === null) {
    throw new DomainError('CONFLICT', 'Đơn vị gốc không có cấp trên để kế thừa');
  }

  const workflow = await db.approvalWorkflow.findUnique({
    where: { orgUnitId_subject: { orgUnitId: input.orgUnitId, subject: SUBJECT } },
    select: { id: true },
  });
  if (!workflow) throw new DomainError('CONFLICT', STALE_WORKFLOW_MESSAGE);

  const { count } = await db.approvalWorkflow.updateMany({
    where: { id: workflow.id, activeVersion: input.expectedVersion },
    data: { activeVersion: null },
  });
  if (count === 0) throw new DomainError('CONFLICT', STALE_WORKFLOW_MESSAGE);

  return {
    id: workflow.id,
    label: unit.code,
    changes: auditChanges({ version: input.expectedVersion }, { version: null }),
  };
}

async function loadApprovalDirectory(today: string): Promise<ApprovalDirectory> {
  const [units, users, delegations] = await Promise.all([
    db.orgUnit.findMany({ select: { id: true, parentId: true } }),
    db.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        fullName: true,
        orgUnitId: true,
        jobTitle: true,
        roles: { select: { roleId: true } },
      },
    }),
    db.delegation.findMany({
      where: {
        revokedAt: null,
        startDate: { lte: new Date(`${today}T00:00:00.000Z`) },
        endDate: { gte: new Date(`${today}T00:00:00.000Z`) },
      },
      select: { delegatorId: true, delegateId: true, startDate: true, endDate: true },
    }),
  ]);

  return {
    units,
    users: users.map(({ roles, ...user }) => ({
      ...user,
      roleIds: roles.map(({ roleId }) => roleId),
    })),
    delegations: delegations.map((delegation) => ({
      ...delegation,
      startDate: delegation.startDate.toISOString().slice(0, 10),
      endDate: delegation.endDate.toISOString().slice(0, 10),
    })),
  };
}

type WorkflowDraft = { orgUnitId: string; steps: readonly ApprovalStepInput[] };

export type ResolvedApproval = {
  sourceUnitName: string;
  isInherited: boolean;
  isDraft: boolean;
  chain: ApprovalChain;
};

type RunnableWorkflow = { version: number | null; steps: readonly ApprovalStepInput[] };

// Xem truoc va gui duyet that (S4) cung di qua ham nay de ket qua luon khop nhau.
export async function resolveApprovalChain(
  facts: ApprovalFacts,
  draft: WorkflowDraft | null,
): Promise<ResolvedApproval | null> {
  const today = vietnamToday();
  const [active, directory, unitNames] = await Promise.all([
    loadActiveWorkflows(),
    loadApprovalDirectory(today),
    db.orgUnit.findMany({ select: { id: true, name: true } }),
  ]);

  const runnable = new Map<string, RunnableWorkflow>(
    [...active].map(([unitId, workflow]) => [
      unitId,
      { version: workflow.version, steps: workflow.steps.map((view) => view.input) },
    ]),
  );
  if (draft) runnable.set(draft.orgUnitId, { version: null, steps: draft.steps });

  const effective: EffectiveWorkflow<RunnableWorkflow> | null = resolveEffectiveWorkflow(
    directory.units,
    runnable,
    facts.orgUnitId,
  );
  if (!effective) return null;

  return {
    sourceUnitName: unitNames.find(({ id }) => id === effective.sourceUnitId)?.name ?? '',
    isInherited: effective.isInherited,
    isDraft: effective.workflow.version === null,
    chain: buildApprovalChain(effective.workflow, facts, directory, today),
  };
}
