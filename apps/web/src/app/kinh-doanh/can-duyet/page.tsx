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
import { DealerProposalsApproverTable } from '@/features/dealers/components/dealer-proposals-table';
import { can, requirePermission } from '@/server/auth/can';
import { listApprovalRequests } from '@/server/queries/approvals';
import {
  countProposalsWaitingForMe,
  getDealerProposalOptions,
  listProposalsWaitingForMe,
} from '@/server/queries/dealer-proposals';
import { getPeopleFilterOptions } from '@/server/queries/people-filters';

export const metadata: Metadata = { title: 'Cần duyệt' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// 25/11/2026: tab Đại lý mới cho đề xuất đại lý chờ Quản lý, Lãnh đạo đơn vị duyệt một bước.
const PROPOSAL_TAB = 'dai-ly-moi';
const PROPOSAL_PAGE_SIZE = 20;

const TABS: { value: ApprovalTab | typeof PROPOSAL_TAB; label: string; reviewerOnly: boolean }[] = [
  { value: 'cho-toi-duyet', label: 'Chờ tôi duyệt', reviewerOnly: true },
  { value: PROPOSAL_TAB, label: 'Đại lý mới', reviewerOnly: true },
  { value: 'da-xu-ly', label: 'Đã xử lý', reviewerOnly: true },
  { value: 'tat-ca', label: 'Tất cả trong phạm vi', reviewerOnly: false },
];

export default async function ApprovalsPage({ searchParams }: PageProps) {
  const user = await requirePermission('sales.approval.read');
  const canReview = can(user, 'sales.approval.review');
  // Quản trị đơn vị chỉ xem để hỗ trợ, không duyệt (duyệt 17/11/2026).
  const tabs = TABS.filter((tab) => canReview || !tab.reviewerOnly);
  const params = await searchParams;
  const showProposals = canReview && params.tab === PROPOSAL_TAB;
  const parsed = approvalsUrlParams.parse(params);
  const input: ListApprovalsInput = tabs.some((tab) => tab.value === parsed.tab)
    ? parsed
    : { ...parsed, tab: canReview ? 'cho-toi-duyet' : 'tat-ca' };
  const activeTab = showProposals ? PROPOSAL_TAB : input.tab;
  const proposalPage = Math.min(Math.max(Math.floor(Number(params.trang)) || 1, 1), 1_000_000);
  const proposalCount = canReview ? await countProposalsWaitingForMe() : 0;

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Cần duyệt</h1>
      <p className="mt-1 max-w-3xl text-text-muted">
        Phiếu Tuyến viếng thăm đi qua Quản lý trực tiếp nếu đơn vị có cấp Quản lý, rồi Lãnh đạo đơn
        vị. Đại lý mới do nhân viên đề xuất chỉ cần một người duyệt. Đổi Trưởng đơn vị hoặc Quản lý
        thì việc đang chờ tự chuyển sang người mới.
      </p>
      <nav aria-label="Nhóm phiếu" className="mt-4 flex flex-wrap gap-2 border-b border-border">
        {tabs.map((tab) => {
          const active = tab.value === activeTab;
          return (
            <Link
              key={tab.value}
              href={`/kinh-doanh/can-duyet?tab=${tab.value}`}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px border-b-2 px-3 py-2 font-bold ${active ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-brand'}`}
            >
              {tab.value === PROPOSAL_TAB && proposalCount > 0
                ? `${tab.label} (${proposalCount})`
                : tab.label}
            </Link>
          );
        })}
      </nav>
      {showProposals ? (
        <Suspense
          key={`proposals-${String(params.trang ?? 1)}`}
          fallback={<DataTableSkeleton columns={5} rows={6} />}
        >
          <ProposalResults page={proposalPage} />
        </Suspense>
      ) : (
        <Suspense key={JSON.stringify(input)} fallback={<DataTableSkeleton columns={5} rows={6} />}>
          <ApprovalResults input={input} />
        </Suspense>
      )}
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

async function ProposalResults({ page }: { page: number }) {
  const [data, options] = await Promise.all([
    listProposalsWaitingForMe(page, PROPOSAL_PAGE_SIZE),
    getDealerProposalOptions(),
  ]);
  return <DealerProposalsApproverTable data={data} options={options} />;
}
