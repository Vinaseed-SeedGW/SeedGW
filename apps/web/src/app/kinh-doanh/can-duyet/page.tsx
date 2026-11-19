import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  approvalsUrlParams,
  type ApprovalTab,
  type ListApprovalsInput,
} from '@seedgw/contracts/approvals';
import { DataTableSkeleton } from '@seedgw/ui/data-table-skeleton';
import { ApprovalsTable } from '@/features/approvals/components/approvals-table';
import { can, requirePermission } from '@/server/auth/can';
import { listApprovalRequests } from '@/server/queries/approvals';
import { getPeopleFilterOptions } from '@/server/queries/people-filters';

export const metadata: Metadata = { title: 'Cần duyệt' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TABS: { value: ApprovalTab; label: string; reviewerOnly: boolean }[] = [
  { value: 'cho-toi-duyet', label: 'Chờ tôi duyệt', reviewerOnly: true },
  { value: 'da-xu-ly', label: 'Đã xử lý', reviewerOnly: true },
  { value: 'tat-ca', label: 'Tất cả trong phạm vi', reviewerOnly: false },
];

export default async function ApprovalsPage({ searchParams }: PageProps) {
  const user = await requirePermission('sales.approval.read');
  const canReview = can(user, 'sales.approval.review');
  // Quản trị đơn vị chỉ xem để hỗ trợ, không duyệt (duyệt 17/11/2026).
  const tabs = TABS.filter((tab) => canReview || !tab.reviewerOnly);
  const parsed = approvalsUrlParams.parse(await searchParams);
  const input: ListApprovalsInput = tabs.some((tab) => tab.value === parsed.tab)
    ? parsed
    : { ...parsed, tab: tabs[0]?.value ?? 'tat-ca' };

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Cần duyệt</h1>
      <p className="mt-1 max-w-3xl text-text-muted">
        Phiếu Tuyến viếng thăm đi qua Quản lý trực tiếp nếu đơn vị có cấp Quản lý, rồi Lãnh đạo đơn
        vị. Đổi Trưởng đơn vị hoặc Quản lý thì phiếu đang chờ tự chuyển sang người mới.
      </p>
      <nav aria-label="Nhóm phiếu" className="mt-4 flex flex-wrap gap-2 border-b border-border">
        {tabs.map((tab) => {
          const active = tab.value === input.tab;
          return (
            <Link
              key={tab.value}
              href={`/kinh-doanh/can-duyet?tab=${tab.value}`}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px border-b-2 px-3 py-2 font-bold ${active ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-brand'}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <Suspense key={JSON.stringify(input)} fallback={<DataTableSkeleton columns={5} rows={6} />}>
        <ApprovalResults input={input} />
      </Suspense>
    </>
  );
}

async function ApprovalResults({ input }: { input: ListApprovalsInput }) {
  const [data, options] = await Promise.all([
    listApprovalRequests(input),
    getPeopleFilterOptions(null, 'sales.approval.read'),
  ]);
  return (
    <ApprovalsTable
      data={data}
      tab={input.tab}
      orgUnits={options.orgUnits.map((unit) => ({ value: unit.id, label: unit.name }))}
    />
  );
}
