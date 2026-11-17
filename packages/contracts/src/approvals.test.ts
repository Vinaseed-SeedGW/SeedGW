import { describe, expect, it } from 'vitest';
import {
  approvalsUrlParams,
  resolveApprovalChain,
  returnDecisionInput,
  type ApprovalChainUnit,
} from './approvals';

const UNITS: ApprovalChainUnit[] = [
  { id: 'root', parentId: null, managerId: 'ceo', managerActive: true, hasManagerLevel: false },
  {
    id: 'branch-a',
    parentId: 'root',
    managerId: 'leader-a',
    managerActive: true,
    hasManagerLevel: true,
  },
  {
    id: 'branch-b',
    parentId: 'root',
    managerId: 'leader-b',
    managerActive: true,
    hasManagerLevel: false,
  },
  {
    id: 'team-no-leader',
    parentId: 'branch-b',
    managerId: null,
    managerActive: false,
    hasManagerLevel: true,
  },
  {
    id: 'orphan',
    parentId: null,
    managerId: null,
    managerActive: false,
    hasManagerLevel: false,
  },
];

describe('resolveApprovalChain', () => {
  it('routes through manager then leader when unit enables manager level', () => {
    const result = resolveApprovalChain({
      submitterId: 'nvkd-1',
      submitterOrgUnitId: 'branch-a',
      submitterDirectManagerId: 'ql-1',
      submitterDirectManagerActive: true,
      units: UNITS,
    });
    expect(result).toEqual({
      ok: true,
      mode: 'TWO_STEP',
      managerApproverId: 'ql-1',
      leaderApproverId: 'leader-a',
      sameApprover: false,
      skipReason: null,
    });
  });

  it('goes straight to leader when unit disables manager level (B1)', () => {
    const result = resolveApprovalChain({
      submitterId: 'nvkd-2',
      submitterOrgUnitId: 'branch-b',
      submitterDirectManagerId: 'ql-1',
      submitterDirectManagerActive: true,
      units: UNITS,
    });
    expect(result).toEqual({
      ok: true,
      mode: 'LEADER_ONLY',
      managerApproverId: null,
      leaderApproverId: 'leader-b',
      sameApprover: false,
      skipReason: null,
    });
  });

  it('skips manager step with reason when direct manager is missing or locked (B2)', () => {
    const missing = resolveApprovalChain({
      submitterId: 'nvkd-1',
      submitterOrgUnitId: 'branch-a',
      submitterDirectManagerId: null,
      submitterDirectManagerActive: false,
      units: UNITS,
    });
    expect(missing).toMatchObject({
      ok: true,
      mode: 'LEADER_ONLY',
      managerApproverId: null,
      leaderApproverId: 'leader-a',
    });
    if (missing.ok) expect(missing.skipReason).toBeTruthy();

    const locked = resolveApprovalChain({
      submitterId: 'nvkd-1',
      submitterOrgUnitId: 'branch-a',
      submitterDirectManagerId: 'ql-1',
      submitterDirectManagerActive: false,
      units: UNITS,
    });
    expect(locked).toMatchObject({
      ok: true,
      mode: 'LEADER_ONLY',
      managerApproverId: null,
      leaderApproverId: 'leader-a',
    });
  });

  it('flags sameApprover when direct manager is also unit leader (B5)', () => {
    const result = resolveApprovalChain({
      submitterId: 'nvkd-1',
      submitterOrgUnitId: 'branch-a',
      submitterDirectManagerId: 'leader-a',
      submitterDirectManagerActive: true,
      units: UNITS,
    });
    expect(result).toEqual({
      ok: true,
      mode: 'TWO_STEP',
      managerApproverId: 'leader-a',
      leaderApproverId: 'leader-a',
      sameApprover: true,
      skipReason: null,
    });
  });

  it('self-approves when submitter is unit leader of their unit (B7)', () => {
    const result = resolveApprovalChain({
      submitterId: 'leader-a',
      submitterOrgUnitId: 'branch-a',
      submitterDirectManagerId: 'ceo',
      submitterDirectManagerActive: true,
      units: UNITS,
    });
    expect(result).toMatchObject({
      ok: true,
      mode: 'SELF_APPROVED',
      managerApproverId: null,
      leaderApproverId: 'leader-a',
    });
  });

  it('falls back to parent unit leader if direct unit has no leader', () => {
    const result = resolveApprovalChain({
      submitterId: 'nvkd-3',
      submitterOrgUnitId: 'team-no-leader',
      submitterDirectManagerId: 'ql-3',
      submitterDirectManagerActive: true,
      units: UNITS,
    });
    expect(result).toMatchObject({
      ok: true,
      mode: 'TWO_STEP',
      managerApproverId: 'ql-3',
      leaderApproverId: 'leader-b',
    });
  });

  it('rejects when user has no org unit or no active leader exists up the tree', () => {
    const noOrg = resolveApprovalChain({
      submitterId: 'nvkd-1',
      submitterOrgUnitId: null,
      submitterDirectManagerId: null,
      submitterDirectManagerActive: false,
      units: UNITS,
    });
    expect(noOrg).toMatchObject({ ok: false, reason: 'NO_ORG_UNIT' });

    const noLeader = resolveApprovalChain({
      submitterId: 'nvkd-1',
      submitterOrgUnitId: 'orphan',
      submitterDirectManagerId: null,
      submitterDirectManagerActive: false,
      units: UNITS,
    });
    expect(noLeader).toMatchObject({ ok: false, reason: 'NO_LEADER' });
  });
});

describe('approval inputs', () => {
  it('requires at least 5 characters for return reason (C1)', () => {
    expect(returnDecisionInput.safeParse({ code: 'CT-2026-00001', reason: 'abc' }).success).toBe(
      false,
    );
    expect(
      returnDecisionInput.safeParse({ code: 'CT-2026-00001', reason: 'Cần tăng chỉ tiêu' }).success,
    ).toBe(true);
  });

  it('parses Vietnamese URL params safely', () => {
    const parsed = approvalsUrlParams.parse({
      tab: 'da-xu-ly',
      loai: 'SALES_TARGET',
      'nop-muon': '1',
      trang: '3',
    });
    expect(parsed).toEqual({
      tab: 'da-xu-ly',
      kind: 'SALES_TARGET',
      orgUnitId: undefined,
      submittedById: undefined,
      lateOnly: true,
      q: undefined,
      page: 3,
      pageSize: 20,
    });
  });
});
