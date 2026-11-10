import type { OrgUnitLink } from './org-tree';
import type {
  ApprovalMode,
  ApprovalStepInput,
  DealerTier,
  EscalationType,
  StepCondition,
} from './workflows';

// Dong co thuan, khong doc du lieu, de xem truoc va chay that cho cung mot ket qua.

export type ApprovalFacts = {
  orgUnitId: string;
  creatorId: string | null;
  totalVnd: number;
  discountPercent: number;
  isOverCredit: boolean;
  isLowStock: boolean;
  productGroups: readonly string[];
  dealerTier: DealerTier | null;
};

export type DirectoryUser = {
  id: string;
  fullName: string;
  orgUnitId: string | null;
  jobTitle: string | null;
  roleIds: readonly string[];
};

export type ActiveDelegation = {
  delegatorId: string;
  delegateId: string;
  startDate: string;
  endDate: string;
};

export type ApprovalDirectory = {
  units: readonly OrgUnitLink[];
  // Chi gom nguoi dang hoat dong.
  users: readonly DirectoryUser[];
  delegations: readonly ActiveDelegation[];
};

export type WorkflowDefinition = {
  version: number | null;
  steps: readonly ApprovalStepInput[];
};

export type EffectiveWorkflow<T> = {
  workflow: T;
  sourceUnitId: string;
  isInherited: boolean;
};

export type ChainStepStatus =
  'WAITING' | 'NOT_TRIGGERED' | 'SKIPPED_SELF' | 'SKIPPED_BELOW_LIMIT' | 'NO_APPROVER';

export type ChainApprover = {
  userId: string;
  fullName: string;
  delegatedFromId: string | null;
  delegatedFromName: string | null;
};

export type ChainStep = {
  position: number;
  name: string;
  status: ChainStepStatus;
  approvalMode: ApprovalMode;
  slaHours: number;
  escalationType: EscalationType;
  escalationUserId: string | null;
  approvers: ChainApprover[];
};

// Ban chup luu vao don khi gui duyet, sua quy trinh sau do khong lam doi ban nay.
export type ApprovalChain = {
  workflowVersion: number | null;
  steps: ChainStep[];
};

export type ApprovalRecord = { position: number; userId: string };

// Tu don vi di len goc, co chan vong lap neu du lieu cay bi hong.
function unitLineage(units: readonly OrgUnitLink[], orgUnitId: string): string[] {
  const parents = new Map(units.map((unit) => [unit.id, unit.parentId]));
  const lineage: string[] = [];
  let current: string | null | undefined = orgUnitId;
  while (current && !lineage.includes(current) && parents.has(current)) {
    lineage.push(current);
    current = parents.get(current);
  }
  return lineage;
}

export function resolveEffectiveWorkflow<T>(
  units: readonly OrgUnitLink[],
  ownByUnit: ReadonlyMap<string, T>,
  orgUnitId: string,
): EffectiveWorkflow<T> | null {
  for (const unitId of unitLineage(units, orgUnitId)) {
    const workflow = ownByUnit.get(unitId);
    if (workflow) {
      return { workflow, sourceUnitId: unitId, isInherited: unitId !== orgUnitId };
    }
  }
  return null;
}

function normalize(text: string): string {
  return text.trim().toLocaleLowerCase('vi');
}

function conditionHolds(condition: StepCondition, facts: ApprovalFacts): boolean {
  switch (condition.type) {
    case 'TOTAL_ABOVE':
      return facts.totalVnd > condition.amountVnd;
    case 'DISCOUNT_ABOVE':
      return facts.discountPercent > condition.percent;
    case 'OVER_CREDIT':
      return facts.isOverCredit;
    case 'LOW_STOCK':
      return facts.isLowStock;
    case 'PRODUCT_GROUP':
      return facts.productGroups.some(
        (group) => normalize(group) === normalize(condition.productGroup),
      );
    case 'DEALER_TIER':
      return facts.dealerTier === condition.dealerTier;
  }
}

function isStepTriggered(step: ApprovalStepInput, facts: ApprovalFacts): boolean {
  if (step.conditions.length === 0) return true;
  const holds = (condition: StepCondition) => conditionHolds(condition, facts);
  return step.conditionMatch === 'ALL' ? step.conditions.every(holds) : step.conditions.some(holds);
}

// Vai tro va chuc danh lay don vi gan nhat co nguoi giu, tinh tu don vi nguoi tao di len.
function nearestHolders(
  lineage: readonly string[],
  users: readonly DirectoryUser[],
  matches: (user: DirectoryUser) => boolean,
): DirectoryUser[] {
  for (const unitId of lineage) {
    const holders = users.filter((user) => user.orgUnitId === unitId && matches(user));
    if (holders.length > 0) return holders;
  }
  return [];
}

function stepApprovers(
  step: ApprovalStepInput,
  lineage: readonly string[],
  users: readonly DirectoryUser[],
): DirectoryUser[] {
  switch (step.approverType) {
    case 'ROLE':
      return nearestHolders(lineage, users, (user) =>
        user.roleIds.includes(step.approverRoleId ?? ''),
      );
    case 'JOB_TITLE': {
      const title = normalize(step.approverJobTitle ?? '');
      return nearestHolders(
        lineage,
        users,
        (user) => user.jobTitle !== null && normalize(user.jobTitle) === title,
      );
    }
    case 'USER':
      return users.filter((user) => user.id === step.approverUserId);
  }
}

// Uy quyen noi tiep duoc theo chuoi. Dung lai truoc nguoi tao don de khong ai tu duyet don cua minh.
function finalDelegate(
  approver: DirectoryUser,
  delegateIdOf: ReadonlyMap<string, string>,
  usersById: ReadonlyMap<string, DirectoryUser>,
  creatorId: string | null,
): DirectoryUser {
  const visited = new Set([approver.id]);
  let current = approver;
  for (;;) {
    const nextId = delegateIdOf.get(current.id);
    const next = nextId ? usersById.get(nextId) : undefined;
    if (!next || visited.has(next.id) || next.id === creatorId) return current;
    visited.add(next.id);
    current = next;
  }
}

function applyDelegations(
  approvers: readonly DirectoryUser[],
  directory: ApprovalDirectory,
  creatorId: string | null,
  today: string,
): ChainApprover[] {
  const usersById = new Map(directory.users.map((user) => [user.id, user]));
  const delegateIdOf = new Map(
    directory.delegations
      .filter(({ startDate, endDate }) => startDate <= today && today <= endDate)
      .map(({ delegatorId, delegateId }) => [delegatorId, delegateId]),
  );

  // Mot nguoi vua la nguoi duyet vua nhan uy quyen thi chi tinh mot lan.
  const resolved = new Map<string, ChainApprover>();
  for (const approver of approvers) {
    const delegate = finalDelegate(approver, delegateIdOf, usersById, creatorId);
    if (resolved.has(delegate.id)) continue;
    const isDelegated = delegate.id !== approver.id;
    resolved.set(delegate.id, {
      userId: delegate.id,
      fullName: delegate.fullName,
      delegatedFromId: isDelegated ? approver.id : null,
      delegatedFromName: isDelegated ? approver.fullName : null,
    });
  }
  return [...resolved.values()];
}

function resolveStep(
  step: ApprovalStepInput,
  position: number,
  facts: ApprovalFacts,
  directory: ApprovalDirectory,
  today: string,
): ChainStep {
  const base = {
    position,
    name: step.name,
    approvalMode: step.approvalMode,
    slaHours: step.slaHours,
    escalationType: step.escalationType,
    escalationUserId: step.escalationUserId,
  };

  if (!isStepTriggered(step, facts)) return { ...base, status: 'NOT_TRIGGERED', approvers: [] };
  if (facts.totalVnd < step.skipBelowVnd) {
    return { ...base, status: 'SKIPPED_BELOW_LIMIT', approvers: [] };
  }

  const lineage = unitLineage(directory.units, facts.orgUnitId);
  const holders = stepApprovers(step, lineage, directory.users);
  if (holders.length === 0) return { ...base, status: 'NO_APPROVER', approvers: [] };

  // Con nguoi khac cung giu vai tro thi ho duyet, chi bo qua khi nguoi tao la nguoi duyet duy nhat.
  const others = holders.filter((user) => user.id !== facts.creatorId);
  if (others.length === 0) return { ...base, status: 'SKIPPED_SELF', approvers: [] };

  return {
    ...base,
    status: 'WAITING',
    approvers: applyDelegations(others, directory, facts.creatorId, today),
  };
}

export function buildApprovalChain(
  workflow: WorkflowDefinition,
  facts: ApprovalFacts,
  directory: ApprovalDirectory,
  today: string,
): ApprovalChain {
  return {
    workflowVersion: workflow.version,
    steps: workflow.steps.map((step, index) =>
      resolveStep(step, index + 1, facts, directory, today),
    ),
  };
}

function isStepComplete(step: ChainStep, approvals: readonly ApprovalRecord[]): boolean {
  const approved = new Set(
    approvals.filter(({ position }) => position === step.position).map(({ userId }) => userId),
  );
  const hasApproved = ({ userId }: ChainApprover) => approved.has(userId);
  return step.approvalMode === 'ANY'
    ? step.approvers.some(hasApproved)
    : step.approvers.every(hasApproved);
}

// Tra ve buoc dang cho, null nghia la don da duyet xong.
export function currentApprovalStep(
  chain: ApprovalChain,
  approvals: readonly ApprovalRecord[],
): ChainStep | null {
  for (const step of chain.steps) {
    if (step.status === 'NO_APPROVER') return step;
    if (step.status === 'WAITING' && !isStepComplete(step, approvals)) return step;
  }
  return null;
}

export function canApproveCurrentStep(
  chain: ApprovalChain,
  approvals: readonly ApprovalRecord[],
  userId: string,
): boolean {
  const step = currentApprovalStep(chain, approvals);
  if (!step) return false;
  const hasApproved = approvals.some(
    (record) => record.position === step.position && record.userId === userId,
  );
  return !hasApproved && step.approvers.some((approver) => approver.userId === userId);
}
