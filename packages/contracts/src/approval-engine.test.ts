import { describe, expect, it } from 'vitest';
import {
  buildApprovalChain,
  canApproveCurrentStep,
  approvalProgress,
  carryOverApprovers,
  currentApprovalStep,
  resolveEffectiveWorkflow,
  type ApprovalDirectory,
  type ApprovalFacts,
  type DirectoryUser,
  type WorkflowDefinition,
} from './approval-engine';
import { newApprovalStep, type ApprovalStepInput, type StepCondition } from './workflows';

const TODAY = '2026-11-10';
const ROLE_ASM = 'role-asm';
const ROLE_DEBT = 'role-debt';

const UNITS = [
  { id: 'cty', parentId: null },
  { id: 'mien-bac', parentId: 'cty' },
  { id: 'vung-1', parentId: 'mien-bac' },
  { id: 'kv-1', parentId: 'vung-1' },
  { id: 'mien-nam', parentId: 'cty' },
  { id: 'vung-2', parentId: 'mien-nam' },
];

function user(id: string, orgUnitId: string, extra: Partial<DirectoryUser> = {}): DirectoryUser {
  return { id, fullName: `Ten ${id}`, orgUnitId, jobTitle: null, roleIds: [], ...extra };
}

const USERS = [
  user('nv', 'kv-1'),
  user('asm-1', 'vung-1', { roleIds: [ROLE_ASM] }),
  user('asm-2', 'vung-2', { roleIds: [ROLE_ASM] }),
  user('gd-mien', 'mien-bac', { jobTitle: 'Giám đốc miền' }),
  user('kt-1', 'cty', { roleIds: [ROLE_DEBT] }),
  user('kt-2', 'cty', { roleIds: [ROLE_DEBT] }),
];

const DIRECTORY: ApprovalDirectory = { units: UNITS, users: USERS, delegations: [] };

const FACTS: ApprovalFacts = {
  orgUnitId: 'kv-1',
  creatorId: 'nv',
  totalVnd: 30_000_000,
  discountPercent: 0,
  isOverCredit: false,
  isLowStock: false,
  productGroups: [],
  dealerTier: null,
};

function roleStep(name: string, roleId: string, extra: Partial<ApprovalStepInput> = {}) {
  return {
    ...newApprovalStep(),
    name,
    approverType: 'ROLE',
    approverRoleId: roleId,
    ...extra,
  } satisfies ApprovalStepInput;
}

function chainOf(
  steps: ApprovalStepInput[],
  facts: Partial<ApprovalFacts> = {},
  directory: ApprovalDirectory = DIRECTORY,
) {
  return buildApprovalChain({ version: 1, steps }, { ...FACTS, ...facts }, directory, TODAY);
}

function onlyStep(
  step: ApprovalStepInput,
  facts: Partial<ApprovalFacts> = {},
  directory: ApprovalDirectory = DIRECTORY,
) {
  const [result] = chainOf([step], facts, directory).steps;
  if (!result) throw new Error('Thieu buoc');
  return result;
}

function approverIds(step: { approvers: Array<{ userId: string }> }) {
  return step.approvers.map(({ userId }) => userId);
}

describe('ke thua quy trinh', () => {
  const own = new Map([
    ['cty', 'quy trinh cong ty'],
    ['vung-1', 'quy trinh vung 1'],
  ]);

  it('don vi co quy trinh rieng thi dung cua chinh no', () => {
    expect(resolveEffectiveWorkflow(UNITS, own, 'vung-1')).toEqual({
      workflow: 'quy trinh vung 1',
      sourceUnitId: 'vung-1',
      isInherited: false,
    });
  });

  it('don vi con lay quy trinh cua cap cha gan nhat', () => {
    expect(resolveEffectiveWorkflow(UNITS, own, 'kv-1')).toMatchObject({
      workflow: 'quy trinh vung 1',
      sourceUnitId: 'vung-1',
      isInherited: true,
    });
    expect(resolveEffectiveWorkflow(UNITS, own, 'vung-2')?.sourceUnitId).toBe('cty');
  });

  it('khong co quy trinh nao thi tra null', () => {
    expect(resolveEffectiveWorkflow(UNITS, new Map(), 'kv-1')).toBeNull();
  });

  it('khong treo khi cay bi vong lap', () => {
    const broken = [
      { id: 'a', parentId: 'b' },
      { id: 'b', parentId: 'a' },
    ];
    expect(resolveEffectiveWorkflow(broken, new Map(), 'a')).toBeNull();
  });

  it('chuyen don vi sang cay khac thi ke thua theo cha moi', () => {
    const moved = UNITS.map((unit) =>
      unit.id === 'kv-1' ? { ...unit, parentId: 'vung-2' } : unit,
    );
    expect(resolveEffectiveWorkflow(moved, own, 'kv-1')?.sourceUnitId).toBe('cty');
  });
});

describe('dieu kien kich hoat buoc', () => {
  function status(conditions: StepCondition[], facts: Partial<ApprovalFacts>, match?: 'ANY') {
    return onlyStep(
      roleStep('Buoc', ROLE_ASM, { conditions, conditionMatch: match ?? 'ALL' }),
      facts,
    ).status;
  }

  it('khong co dieu kien thi luon chay', () => {
    expect(status([], {})).toBe('WAITING');
  });

  it('tong tien phai lon hon nguong, bang nguong thi khong chay', () => {
    const conditions: StepCondition[] = [{ type: 'TOTAL_ABOVE', amountVnd: 50_000_000 }];
    expect(status(conditions, { totalVnd: 50_000_001 })).toBe('WAITING');
    expect(status(conditions, { totalVnd: 50_000_000 })).toBe('NOT_TRIGGERED');
  });

  it('chiet khau phai lon hon nguong', () => {
    const conditions: StepCondition[] = [{ type: 'DISCOUNT_ABOVE', percent: 5 }];
    expect(status(conditions, { discountPercent: 5.5 })).toBe('WAITING');
    expect(status(conditions, { discountPercent: 5 })).toBe('NOT_TRIGGERED');
  });

  it('co vuot cong no va thieu ton', () => {
    expect(status([{ type: 'OVER_CREDIT' }], { isOverCredit: true })).toBe('WAITING');
    expect(status([{ type: 'OVER_CREDIT' }], {})).toBe('NOT_TRIGGERED');
    expect(status([{ type: 'LOW_STOCK' }], { isLowStock: true })).toBe('WAITING');
    expect(status([{ type: 'LOW_STOCK' }], {})).toBe('NOT_TRIGGERED');
  });

  it('nhom san pham khong phan biet hoa thuong', () => {
    const conditions: StepCondition[] = [{ type: 'PRODUCT_GROUP', productGroup: 'Lúa' }];
    expect(status(conditions, { productGroups: ['ngô', 'LÚA'] })).toBe('WAITING');
    expect(status(conditions, { productGroups: ['ngô'] })).toBe('NOT_TRIGGERED');
  });

  it('loai dai ly', () => {
    const conditions: StepCondition[] = [{ type: 'DEALER_TIER', dealerTier: 'LEVEL_1' }];
    expect(status(conditions, { dealerTier: 'LEVEL_1' })).toBe('WAITING');
    expect(status(conditions, { dealerTier: 'LEVEL_2' })).toBe('NOT_TRIGGERED');
    expect(status(conditions, {})).toBe('NOT_TRIGGERED');
  });

  it('dung tat ca va dung mot trong cac dieu kien', () => {
    const conditions: StepCondition[] = [{ type: 'OVER_CREDIT' }, { type: 'LOW_STOCK' }];
    expect(status(conditions, { isOverCredit: true })).toBe('NOT_TRIGGERED');
    expect(status(conditions, { isOverCredit: true }, 'ANY')).toBe('WAITING');
  });

  it('don khong co thi chi ASM, vuot cong no thi them Ke toan', () => {
    const steps = [
      roleStep('ASM', ROLE_ASM),
      roleStep('Ke toan cong no', ROLE_DEBT, { conditions: [{ type: 'OVER_CREDIT' }] }),
    ];
    const waiting = (facts: Partial<ApprovalFacts>) =>
      chainOf(steps, facts)
        .steps.filter((step) => step.status === 'WAITING')
        .map((step) => step.name);

    expect(waiting({})).toEqual(['ASM']);
    expect(waiting({ isOverCredit: true })).toEqual(['ASM', 'Ke toan cong no']);
  });
});

describe('xac dinh nguoi duyet', () => {
  it('vai tro lay don vi gan nhat co nguoi giu, tu duoi di len', () => {
    expect(approverIds(onlyStep(roleStep('ASM', ROLE_ASM)))).toEqual(['asm-1']);
  });

  it('chuc danh tim o don vi cap tren', () => {
    const step = {
      ...newApprovalStep(),
      name: 'Giam doc',
      approverType: 'JOB_TITLE',
      approverJobTitle: 'giám đốc MIỀN',
    } satisfies ApprovalStepInput;
    expect(approverIds(onlyStep(step))).toEqual(['gd-mien']);
    expect(onlyStep(step, { orgUnitId: 'vung-2' }).status).toBe('NO_APPROVER');
  });

  it('nguoi cu the, da khoa thi khong tim thay', () => {
    const step = {
      ...newApprovalStep(),
      name: 'Chi dinh',
      approverType: 'USER',
      approverUserId: 'kt-1',
    } satisfies ApprovalStepInput;
    expect(approverIds(onlyStep(step))).toEqual(['kt-1']);

    const withoutUser = { ...DIRECTORY, users: USERS.filter(({ id }) => id !== 'kt-1') };
    expect(onlyStep(step, {}, withoutUser).status).toBe('NO_APPROVER');
  });

  it('khong ai giu vai tro thi bao khong co nguoi duyet', () => {
    expect(onlyStep(roleStep('X', 'role-khac')).status).toBe('NO_APPROVER');
  });
});

describe('tu duyet', () => {
  it('nguoi tao la nguoi duyet duy nhat thi bo qua buoc', () => {
    expect(onlyStep(roleStep('ASM', ROLE_ASM), { creatorId: 'asm-1' }).status).toBe('SKIPPED_SELF');
  });

  it('con nguoi khac cung vai tro thi nguoi do duyet', () => {
    const step = onlyStep(roleStep('Ke toan', ROLE_DEBT), { creatorId: 'kt-1' });
    expect(step.status).toBe('WAITING');
    expect(approverIds(step)).toEqual(['kt-2']);
  });

  it('don duoi nguong cua buoc thi tu duyet, bang nguong van phai duyet', () => {
    const step = roleStep('ASM', ROLE_ASM, { skipBelowVnd: 10_000_000 });
    expect(onlyStep(step, { totalVnd: 9_999_999 }).status).toBe('SKIPPED_BELOW_LIMIT');
    expect(onlyStep(step, { totalVnd: 10_000_000 }).status).toBe('WAITING');
  });

  it('nguong bang 0 thi khong tu duyet', () => {
    expect(onlyStep(roleStep('ASM', ROLE_ASM), { totalVnd: 0 }).status).toBe('WAITING');
  });

  it('moi buoc deu bo qua thi don khong con buoc cho', () => {
    const chain = chainOf([roleStep('ASM', ROLE_ASM, { skipBelowVnd: 100_000_000 })]);
    expect(currentApprovalStep(chain, [])).toBeNull();
  });
});

describe('uy quyen', () => {
  const withDelegations = (delegations: ApprovalDirectory['delegations']) => ({
    ...DIRECTORY,
    delegations,
  });
  const period = { startDate: '2026-11-09', endDate: '2026-11-10' };
  const asmStep = roleStep('ASM', ROLE_ASM);

  it('trong thoi gian uy quyen thi nguoi nhan duyet thay', () => {
    const directory = withDelegations([{ delegatorId: 'asm-1', delegateId: 'kt-1', ...period }]);
    const [approver] = onlyStep(asmStep, {}, directory).approvers;
    expect(approver).toMatchObject({
      userId: 'kt-1',
      delegatedFromId: 'asm-1',
      delegatedFromName: 'Ten asm-1',
    });
  });

  it('ngoai thoi gian uy quyen thi nguoi cu duyet', () => {
    const directory = withDelegations([
      { delegatorId: 'asm-1', delegateId: 'kt-1', startDate: '2026-11-11', endDate: '2026-11-12' },
      { delegatorId: 'asm-1', delegateId: 'kt-2', startDate: '2026-11-01', endDate: '2026-11-09' },
    ]);
    expect(approverIds(onlyStep(asmStep, {}, directory))).toEqual(['asm-1']);
  });

  it('uy quyen noi tiep den nguoi cuoi chuoi', () => {
    const directory = withDelegations([
      { delegatorId: 'asm-1', delegateId: 'kt-1', ...period },
      { delegatorId: 'kt-1', delegateId: 'kt-2', ...period },
    ]);
    const [approver] = onlyStep(asmStep, {}, directory).approvers;
    expect(approver).toMatchObject({ userId: 'kt-2', delegatedFromId: 'asm-1' });
  });

  it('khong treo khi hai nguoi uy quyen cho nhau', () => {
    const directory = withDelegations([
      { delegatorId: 'asm-1', delegateId: 'kt-1', ...period },
      { delegatorId: 'kt-1', delegateId: 'asm-1', ...period },
    ]);
    expect(approverIds(onlyStep(asmStep, {}, directory))).toEqual(['kt-1']);
  });

  it('khong uy quyen ve tay nguoi tao don', () => {
    const directory = withDelegations([{ delegatorId: 'asm-1', delegateId: 'nv', ...period }]);
    expect(approverIds(onlyStep(asmStep, {}, directory))).toEqual(['asm-1']);
  });

  it('nguoi nhan da bi khoa thi nguoi cu van duyet', () => {
    const directory = withDelegations([{ delegatorId: 'asm-1', delegateId: 'da-khoa', ...period }]);
    expect(approverIds(onlyStep(asmStep, {}, directory))).toEqual(['asm-1']);
  });

  it('nguoi nhan cung la nguoi duyet thi chi tinh mot lan', () => {
    const directory = withDelegations([{ delegatorId: 'kt-1', delegateId: 'kt-2', ...period }]);
    expect(approverIds(onlyStep(roleStep('Ke toan', ROLE_DEBT), {}, directory))).toEqual(['kt-2']);
  });
});

describe('kieu duyet', () => {
  const steps = [
    roleStep('Ke toan', ROLE_DEBT, { approvalMode: 'ANY' }),
    roleStep('Ke toan ca hai', ROLE_DEBT, { approvalMode: 'ALL' }),
  ];

  it('mot nguoi bat ky duyet la xong buoc', () => {
    const chain = chainOf(steps);
    expect(currentApprovalStep(chain, [])?.position).toBe(1);
    expect(currentApprovalStep(chain, [{ position: 1, userId: 'kt-2' }])?.position).toBe(2);
  });

  it('tat ca phai duyet moi xong buoc', () => {
    const chain = chainOf(steps);
    const first = { position: 1, userId: 'kt-1' };
    expect(currentApprovalStep(chain, [first, { position: 2, userId: 'kt-1' }])?.position).toBe(2);
    expect(
      currentApprovalStep(chain, [
        first,
        { position: 2, userId: 'kt-1' },
        { position: 2, userId: 'kt-2' },
      ]),
    ).toBeNull();
  });

  it('chi nguoi duyet cua buoc hien tai moi duyet duoc va khong duyet hai lan', () => {
    const chain = chainOf(steps);
    expect(canApproveCurrentStep(chain, [], 'kt-1')).toBe(true);
    expect(canApproveCurrentStep(chain, [], 'nv')).toBe(false);
    const secondStep = [
      { position: 1, userId: 'kt-1' },
      { position: 2, userId: 'kt-1' },
    ];
    expect(canApproveCurrentStep(chain, secondStep, 'kt-1')).toBe(false);
    expect(canApproveCurrentStep(chain, secondStep, 'kt-2')).toBe(true);
  });

  it('buoc khong co nguoi duyet giu don lai, khong tu cho qua', () => {
    const chain = chainOf([roleStep('X', 'role-khac'), roleStep('ASM', ROLE_ASM)]);
    expect(currentApprovalStep(chain, [])?.position).toBe(1);
    expect(canApproveCurrentStep(chain, [], 'asm-1')).toBe(false);
  });
});

describe('phien ban quy trinh', () => {
  const v1: WorkflowDefinition = { version: 1, steps: [roleStep('ASM', ROLE_ASM)] };
  const v2: WorkflowDefinition = {
    version: 2,
    steps: [roleStep('ASM', ROLE_ASM), roleStep('Ke toan', ROLE_DEBT)],
  };

  it('don dang chay giu phien ban cu, don moi dung phien ban moi', () => {
    const running = buildApprovalChain(v1, FACTS, DIRECTORY, TODAY);
    const own = new Map([['vung-1', v2]]);
    const effective = resolveEffectiveWorkflow(UNITS, own, 'kv-1');
    if (!effective) throw new Error('Thieu quy trinh');
    const fresh = buildApprovalChain(effective.workflow, FACTS, DIRECTORY, TODAY);

    expect(running.workflowVersion).toBe(1);
    expect(running.steps).toHaveLength(1);
    expect(currentApprovalStep(running, [{ position: 1, userId: 'asm-1' }])).toBeNull();

    expect(fresh.workflowVersion).toBe(2);
    expect(currentApprovalStep(fresh, [{ position: 1, userId: 'asm-1' }])?.name).toBe('Ke toan');
  });

  it('nguoi giu vai tro doi sau khi gui duyet thi don dang chay khong doi nguoi', () => {
    const running = buildApprovalChain(v1, FACTS, DIRECTORY, TODAY);
    expect(running.steps[0]?.approvers[0]?.userId).toBe('asm-1');
  });
});

describe('hai don vi khac nhau', () => {
  it('hai don cung gia tri di hai chuoi duyet khac nhau', () => {
    const own = new Map<string, WorkflowDefinition>([
      ['vung-1', { version: 1, steps: [roleStep('ASM vung 1', ROLE_ASM)] }],
      [
        'vung-2',
        {
          version: 4,
          steps: [
            roleStep('ASM vung 2', ROLE_ASM),
            roleStep('Ke toan', ROLE_DEBT, {
              conditions: [{ type: 'TOTAL_ABOVE', amountVnd: 10_000_000 }],
            }),
          ],
        },
      ],
    ]);
    const chainFor = (orgUnitId: string) => {
      const effective = resolveEffectiveWorkflow(UNITS, own, orgUnitId);
      if (!effective) throw new Error('Thieu quy trinh');
      return buildApprovalChain(
        effective.workflow,
        { ...FACTS, orgUnitId, creatorId: null },
        DIRECTORY,
        TODAY,
      ).steps.filter((step) => step.status === 'WAITING');
    };

    expect(chainFor('vung-1').map((step) => step.name)).toEqual(['ASM vung 1']);
    expect(chainFor('vung-2').map((step) => step.name)).toEqual(['ASM vung 2', 'Ke toan']);
  });
});

describe('mot nguoi duyet hai buoc lien tiep', () => {
  const userStep = (name: string, userId: string, extra: Partial<ApprovalStepInput> = {}) =>
    ({
      ...newApprovalStep(),
      name,
      approverType: 'USER',
      approverUserId: userId,
      ...extra,
    }) satisfies ApprovalStepInput;
  const kt1 = (name: string, extra: Partial<ApprovalStepInput> = {}) =>
    userStep(name, 'kt-1', extra);

  it('buoc lien sau tu qua va duoc ghi la luot duyet chuyen tiep', () => {
    const chain = chainOf([kt1('Ke toan'), kt1('Ke toan lan hai')]);
    const progress = approvalProgress(chain, [{ position: 1, userId: 'kt-1' }]);
    expect(progress.current).toBeNull();
    expect(progress.carried).toEqual([{ position: 2, userId: 'kt-1', fromPosition: 1 }]);
  });

  it('chuyen tiep noi duoc qua nhieu buoc lien tiep', () => {
    const chain = chainOf([kt1('A'), kt1('B'), kt1('C')]);
    const progress = approvalProgress(chain, [{ position: 1, userId: 'kt-1' }]);
    expect(progress.current).toBeNull();
    expect(progress.carried.map(({ position }) => position)).toEqual([2, 3]);
  });

  it('co nguoi khac duyet xen giua thi phai duyet lai', () => {
    const chain = chainOf([kt1('Ke toan'), roleStep('ASM', ROLE_ASM), kt1('Ke toan lan hai')]);
    const approvals = [
      { position: 1, userId: 'kt-1' },
      { position: 2, userId: 'asm-1' },
    ];
    const progress = approvalProgress(chain, approvals);
    expect(progress.current?.position).toBe(3);
    expect(progress.carried).toEqual([]);
    expect(canApproveCurrentStep(chain, approvals, 'kt-1')).toBe(true);
  });

  it('buoc o giua khong chay thi hai buoc hai ben van tinh la lien tiep', () => {
    const overCredit: StepCondition = { type: 'OVER_CREDIT' };
    const chain = chainOf([
      kt1('Ke toan'),
      roleStep('ASM', ROLE_ASM, { conditions: [overCredit] }),
      kt1('Ke toan lan hai'),
    ]);
    expect(currentApprovalStep(chain, [{ position: 1, userId: 'kt-1' }])).toBeNull();
  });

  it('chi nguoi da thuc su duyet buoc truoc moi duoc chuyen tiep', () => {
    const chain = chainOf([roleStep('Ke toan', ROLE_DEBT), kt1('Ke toan truong')]);
    const approvals = [{ position: 1, userId: 'kt-2' }];
    expect(currentApprovalStep(chain, approvals)?.position).toBe(2);
    expect(canApproveCurrentStep(chain, approvals, 'kt-1')).toBe(true);
  });

  it('nguoi nhan uy quyen o buoc sau cung duoc chuyen tiep', () => {
    const directory: ApprovalDirectory = {
      ...DIRECTORY,
      delegations: [{ delegatorId: 'asm-1', delegateId: 'kt-1', startDate: TODAY, endDate: TODAY }],
    };
    const chain = chainOf([kt1('Ke toan'), roleStep('ASM', ROLE_ASM)], {}, directory);
    expect(currentApprovalStep(chain, [{ position: 1, userId: 'kt-1' }])).toBeNull();
  });

  it('buoc tat ca cung duyet chi tinh san nguoi da duyet, nguoi con lai van phai duyet', () => {
    const chain = chainOf([kt1('Ke toan'), roleStep('Ca hai', ROLE_DEBT, { approvalMode: 'ALL' })]);
    const approvals = [{ position: 1, userId: 'kt-1' }];
    expect(currentApprovalStep(chain, approvals)?.position).toBe(2);
    expect(canApproveCurrentStep(chain, approvals, 'kt-1')).toBe(false);
    expect(canApproveCurrentStep(chain, approvals, 'kt-2')).toBe(true);
    expect(currentApprovalStep(chain, [...approvals, { position: 2, userId: 'kt-2' }])).toBeNull();
  });

  it('xem truoc chi ra nguoi se khong phai duyet lai', () => {
    const chain = chainOf([roleStep('Ke toan', ROLE_DEBT), kt1('Ke toan truong'), kt1('Lan ba')]);
    expect(approverIds({ approvers: carryOverApprovers(chain, 1) })).toEqual([]);
    expect(approverIds({ approvers: carryOverApprovers(chain, 2) })).toEqual(['kt-1']);
    expect(approverIds({ approvers: carryOverApprovers(chain, 3) })).toEqual(['kt-1']);
  });
});
