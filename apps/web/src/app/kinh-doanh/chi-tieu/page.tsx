import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FEATURES } from '@seedgw/contracts/features';
import { assignableMonths } from '@seedgw/contracts/target-assignments';
import { Suspense } from 'react';
import {
  currentVnMonth,
  editableTargetMonths,
  formatMonthLabel,
  salesTargetsUrlParams,
  shiftMonth,
  type ListSalesTargetsInput,
  type SalesTargetTab,
} from '@seedgw/contracts/sales-targets';
import { DataTableSkeleton } from '@seedgw/ui/data-table-skeleton';
import { MyTargets } from '@/features/sales-targets/components/my-targets';
import { ScopeTargetsTable } from '@/features/sales-targets/components/scope-targets-table';
import { TargetAssignments } from '@/features/sales-targets/components/target-assignments';
import { can, requirePermission } from '@/server/auth/can';
import {
  getMyTargets,
  getOnBehalfEmployees,
  listSalesTargets,
} from '@/server/queries/sales-targets';
import { getTargetAssignments } from '@/server/queries/target-assignments';

export const metadata: Metadata = { title: 'Chỉ tiêu' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TAB_LABEL: Record<SalesTargetTab, string> = {
  'cua-toi': 'Chỉ tiêu của tôi',
  'pham-vi': 'Trong phạm vi',
  giao: 'Giao chỉ tiêu',
};

export default async function SalesTargetsPage({ searchParams }: PageProps) {
  // Chỉ tiêu tạm hold từ 19/11/2026 (features.ts).
  if (!FEATURES.salesTargets) notFound();
  const user = await requirePermission('sales.target.read');
  const tabs: SalesTargetTab[] = [];
  if (can(user, 'sales.target.register')) tabs.push('cua-toi');
  // Nhân viên chỉ thấy chính mình nên không cần tab Trong phạm vi.
  if (user.dataScope !== 'OWN') tabs.push('pham-vi');
  // K3: Lãnh đạo đơn vị và Quản trị hệ thống giao chỉ tiêu cho đơn vị, nhân viên trong phạm vi.
  if (can(user, 'sales.target.assign')) tabs.push('giao');
  const parsed = salesTargetsUrlParams.parse(await searchParams);
  const input: ListSalesTargetsInput = tabs.includes(parsed.tab)
    ? parsed
    : { ...parsed, tab: tabs[0] ?? 'cua-toi' };

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Chỉ tiêu</h1>
      <p className="mt-1 max-w-3xl text-text-muted">
        Chỉ tiêu tháng gồm lượt ghé thăm và số đại lý được ghé. Chỉ tiêu được giao là chỉ tiêu
        chính; tháng chưa được giao thì mỗi người tự đăng ký rồi gửi duyệt (tháng này và tháng sau).
        % hoàn thành tính theo check-in trong tháng.
      </p>
      {tabs.length > 1 ? (
        <nav
          aria-label="Nhóm chỉ tiêu"
          className="mt-4 flex flex-wrap gap-2 border-b border-border"
        >
          {tabs.map((tab) => {
            const active = tab === input.tab;
            return (
              <Link
                key={tab}
                href={`/kinh-doanh/chi-tieu?tab=${tab}`}
                aria-current={active ? 'page' : undefined}
                className={`-mb-px border-b-2 px-3 py-2 font-bold ${active ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-brand'}`}
              >
                {TAB_LABEL[tab]}
              </Link>
            );
          })}
        </nav>
      ) : null}
      {tabs.length === 0 ? (
        <p className="mt-4 text-text-muted">Tài khoản chưa được cấp quyền đăng ký chỉ tiêu.</p>
      ) : input.tab === 'giao' ? (
        <Suspense key={input.month ?? ''} fallback={<DataTableSkeleton columns={4} rows={8} />}>
          <AssignmentResults month={input.month} />
        </Suspense>
      ) : input.tab === 'cua-toi' ? (
        <Suspense fallback={<DataTableSkeleton columns={4} rows={4} />}>
          <MyTargetResults canOpenApproval={can(user, 'sales.approval.read')} />
        </Suspense>
      ) : (
        <Suspense key={JSON.stringify(input)} fallback={<DataTableSkeleton columns={5} rows={6} />}>
          <ScopeResults input={input} canOverride={can(user, 'sales.approval.override')} />
        </Suspense>
      )}
    </>
  );
}

async function MyTargetResults({ canOpenApproval }: { canOpenApproval: boolean }) {
  return <MyTargets data={await getMyTargets()} canOpenApproval={canOpenApproval} />;
}

async function ScopeResults({
  input,
  canOverride,
}: {
  input: ListSalesTargetsInput;
  canOverride: boolean;
}) {
  const [data, employees] = await Promise.all([
    listSalesTargets(input),
    canOverride ? getOnBehalfEmployees() : null,
  ]);
  const current = currentVnMonth();
  const months = [1, -1, -2, -3].map((delta) => {
    const value = shiftMonth(current, delta);
    return { value, label: formatMonthLabel(value) };
  });
  const editableMonths = editableTargetMonths().map((value) => ({
    value,
    label: formatMonthLabel(value),
  }));
  return (
    <ScopeTargetsTable
      data={data}
      months={months}
      override={employees ? { employees, editableMonths } : null}
    />
  );
}

async function AssignmentResults({ month }: { month: string | undefined }) {
  const editableMonths = assignableMonths();
  const current = currentVnMonth();
  const selected = month ?? current;
  const months = [...editableMonths]
    .reverse()
    .concat([1, 2, 3].map((back) => shiftMonth(current, -back)));
  return (
    <TargetAssignments
      data={await getTargetAssignments(selected)}
      months={months.map((value) => ({ value, label: formatMonthLabel(value) }))}
      editable={editableMonths.includes(selected)}
    />
  );
}
