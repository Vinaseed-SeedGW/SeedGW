import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  currentVnMonth,
  formatMonthLabel,
  salesTargetsUrlParams,
  shiftMonth,
  type ListSalesTargetsInput,
  type SalesTargetTab,
} from '@dms/contracts/sales-targets';
import { DataTableSkeleton } from '@dms/ui/data-table-skeleton';
import { MyTargets } from '@/features/sales-targets/components/my-targets';
import { ScopeTargetsTable } from '@/features/sales-targets/components/scope-targets-table';
import { can, requirePermission } from '@/server/auth/can';
import { getMyTargets, listSalesTargets } from '@/server/queries/sales-targets';

export const metadata: Metadata = { title: 'Chỉ tiêu' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TAB_LABEL: Record<SalesTargetTab, string> = {
  'cua-toi': 'Chỉ tiêu của tôi',
  'pham-vi': 'Trong phạm vi',
};

export default async function SalesTargetsPage({ searchParams }: PageProps) {
  const user = await requirePermission('sales.target.read');
  const tabs: SalesTargetTab[] = [];
  if (can(user, 'sales.target.register')) tabs.push('cua-toi');
  // Nhân viên chỉ thấy chính mình nên không cần tab Trong phạm vi.
  if (user.dataScope !== 'OWN') tabs.push('pham-vi');
  const parsed = salesTargetsUrlParams.parse(await searchParams);
  const input: ListSalesTargetsInput = tabs.includes(parsed.tab)
    ? parsed
    : { ...parsed, tab: tabs[0] ?? 'cua-toi' };

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Chỉ tiêu</h1>
      <p className="mt-1 max-w-3xl text-text-muted">
        Mỗi người tự đăng ký chỉ tiêu tháng (lượt ghé thăm, số đại lý được ghé, Thực bán) rồi gửi
        duyệt. Đăng ký hoặc sửa được tháng này và tháng sau; % hoàn thành tính theo chỉ tiêu đã
        duyệt và check-in trong tháng.
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
      ) : input.tab === 'cua-toi' ? (
        <Suspense fallback={<DataTableSkeleton columns={4} rows={4} />}>
          <MyTargetResults canOpenApproval={can(user, 'sales.approval.read')} />
        </Suspense>
      ) : (
        <Suspense key={JSON.stringify(input)} fallback={<DataTableSkeleton columns={5} rows={6} />}>
          <ScopeResults input={input} />
        </Suspense>
      )}
    </>
  );
}

async function MyTargetResults({ canOpenApproval }: { canOpenApproval: boolean }) {
  return <MyTargets data={await getMyTargets()} canOpenApproval={canOpenApproval} />;
}

async function ScopeResults({ input }: { input: ListSalesTargetsInput }) {
  const data = await listSalesTargets(input);
  const current = currentVnMonth();
  const months = [1, -1, -2, -3].map((delta) => {
    const value = shiftMonth(current, delta);
    return { value, label: formatMonthLabel(value) };
  });
  return <ScopeTargetsTable data={data} months={months} />;
}
