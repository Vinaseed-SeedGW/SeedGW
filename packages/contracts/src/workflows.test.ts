import { describe, expect, it } from 'vitest';
import {
  approvalStepInput,
  createDelegationInput,
  newApprovalStep,
  resolveDelegationStatus,
  stepDetailLines,
  type ApprovalStepInput,
} from './workflows';

const ROLE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_USER_ID = '33333333-3333-4333-8333-333333333333';

function validStep(extra: Partial<ApprovalStepInput> = {}): ApprovalStepInput {
  return { ...newApprovalStep(), name: 'ASM duyệt', approverRoleId: ROLE_ID, ...extra };
}

function issuePaths(result: { error?: { issues: Array<{ path: PropertyKey[] }> } }) {
  return result.error?.issues.map((issue) => issue.path.join('.')) ?? [];
}

describe('approvalStepInput', () => {
  it('bat buoc chon doi tuong theo kieu nguoi duyet', () => {
    expect(issuePaths(approvalStepInput.safeParse(validStep({ approverRoleId: null })))).toEqual([
      'approverRoleId',
    ]);
    expect(issuePaths(approvalStepInput.safeParse(validStep({ approverType: 'USER' })))).toEqual([
      'approverUserId',
    ]);
    expect(
      issuePaths(approvalStepInput.safeParse(validStep({ approverType: 'JOB_TITLE' }))),
    ).toEqual(['approverJobTitle']);
  });

  it('bo gia tri thua cua kieu nguoi duyet truoc do', () => {
    const parsed = approvalStepInput.parse(
      validStep({ approverType: 'USER', approverUserId: USER_ID }),
    );
    expect(parsed.approverRoleId).toBeNull();
    expect(parsed.approverUserId).toBe(USER_ID);
  });

  it('leo thang len nguoi cu the thi phai chon nguoi', () => {
    expect(issuePaths(approvalStepInput.safeParse(validStep({ escalationType: 'USER' })))).toEqual([
      'escalationUserId',
    ]);
  });

  it('dieu kien tien phai lon hon 0 va doi chuoi tu form sang so', () => {
    const invalid = validStep({ conditions: [{ type: 'TOTAL_ABOVE', amountVnd: 0 }] });
    expect(issuePaths(approvalStepInput.safeParse(invalid))).toEqual(['conditions.0.amountVnd']);

    const fromForm = validStep({
      conditions: [{ type: 'TOTAL_ABOVE', amountVnd: '50000000' as unknown as number }],
    });
    expect(approvalStepInput.parse(fromForm).conditions[0]).toEqual({
      type: 'TOTAL_ABOVE',
      amountVnd: 50_000_000,
    });
  });
});

describe('createDelegationInput', () => {
  const base = {
    delegatorId: USER_ID,
    delegateId: OTHER_USER_ID,
    startDate: '2026-11-10',
    endDate: '2026-11-12',
    reason: 'Đi công tác',
  };

  it('nhan khoang ngay hop le', () => {
    expect(createDelegationInput.safeParse(base).success).toBe(true);
    expect(createDelegationInput.safeParse({ ...base, endDate: base.startDate }).success).toBe(
      true,
    );
  });

  it('chan tu uy quyen cho chinh minh', () => {
    expect(issuePaths(createDelegationInput.safeParse({ ...base, delegateId: USER_ID }))).toEqual([
      'delegateId',
    ]);
  });

  it('chan den ngay truoc tu ngay va ngay khong co that', () => {
    expect(issuePaths(createDelegationInput.safeParse({ ...base, endDate: '2026-11-09' }))).toEqual(
      ['endDate'],
    );
    expect(issuePaths(createDelegationInput.safeParse({ ...base, endDate: '31/02' }))).toContain(
      'endDate',
    );
  });
});

describe('resolveDelegationStatus', () => {
  const period = { startDate: '2026-11-09', endDate: '2026-11-10', isRevoked: false };

  it('tinh theo ngay, gom ca hai dau', () => {
    expect(resolveDelegationStatus(period, '2026-11-08')).toBe('SCHEDULED');
    expect(resolveDelegationStatus(period, '2026-11-09')).toBe('ACTIVE');
    expect(resolveDelegationStatus(period, '2026-11-10')).toBe('ACTIVE');
    expect(resolveDelegationStatus(period, '2026-11-11')).toBe('EXPIRED');
  });

  it('da thu hoi thi luon la thu hoi', () => {
    expect(resolveDelegationStatus({ ...period, isRevoked: true }, '2026-11-09')).toBe('REVOKED');
  });
});

describe('stepDetailLines', () => {
  it('mo ta day du buoc', () => {
    const lines = stepDetailLines({
      input: validStep({
        skipBelowVnd: 5_000_000,
        conditionMatch: 'ANY',
        conditions: [{ type: 'OVER_CREDIT' }, { type: 'LOW_STOCK' }],
      }),
      approverLabel: 'Quản lý vùng',
      escalationLabel: null,
    });
    expect(lines).toEqual([
      'Người duyệt: Vai trò Quản lý vùng trong đơn vị người tạo',
      'Kiểu duyệt: Một người bất kỳ',
      'SLA 24 giờ, không leo thang',
      'Tự duyệt khi đơn dưới 5.000.000 đ',
      'Chỉ chạy khi: Đơn có cờ vượt hạn mức công nợ hoặc Đơn có cờ thiếu tồn kho',
    ]);
  });
});
