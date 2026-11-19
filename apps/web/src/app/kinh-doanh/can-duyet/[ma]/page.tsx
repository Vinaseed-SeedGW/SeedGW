import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  APPROVAL_ACTION_LABEL,
  APPROVAL_KIND_LABEL,
  APPROVAL_STEP_LABEL,
  type ApprovalDetail,
} from '@seedgw/contracts/approvals';
import { formatDateTime } from '@seedgw/contracts/format';
import {
  ApprovalReviewButtons,
  ApprovalWithdrawButton,
} from '@/features/approvals/components/approval-decision';
import { ApprovalStatusBadge } from '@/features/approvals/components/approval-status-badge';
import { RouteDays } from '@/features/route-plans/components/route-days';
import { TargetCompare } from '@/features/sales-targets/components/target-compare';
import { requirePermission } from '@/server/auth/can';
import { getApprovalRequest } from '@/server/queries/approvals';

type PageProps = { params: Promise<{ ma: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ma } = await params;
  return { title: `Phiếu ${decodeURIComponent(ma)}` };
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[180px_1fr]">
      <dt className="text-text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Timeline({ approval }: { approval: ApprovalDetail }) {
  return (
    <ol className="mt-3 grid gap-3 border-l-2 border-border pl-4">
      {approval.actions.map((action) => (
        <li key={action.id}>
          <span className="font-bold">{APPROVAL_ACTION_LABEL[action.action]}</span>
          {action.step ? (
            <span className="text-text-muted">, bước {APPROVAL_STEP_LABEL[action.step]}</span>
          ) : null}
          <span className="block text-sm text-text-muted">
            {action.actorName ?? 'Hệ thống'}, {formatDateTime(action.createdAt)}
          </span>
          {action.note ? <p className="mt-0.5 text-sm">{action.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export default async function ApprovalDetailPage({ params }: PageProps) {
  await requirePermission('sales.approval.read');
  const { ma } = await params;
  const data = await getApprovalRequest(decodeURIComponent(ma));
  if (!data) notFound();
  const { approval, target, route } = data;

  return (
    <>
      <Link href="/kinh-doanh/can-duyet" className="text-sm text-brand hover:underline">
        Về danh sách Cần duyệt
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-brand">Phiếu {approval.code}</h1>
        <ApprovalStatusBadge status={approval.status} />
      </div>
      <p className="mt-1 text-text-muted">
        {APPROVAL_KIND_LABEL[approval.kind]}, {approval.periodLabel}
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <dl className="grid gap-2">
            <InfoRow label="Người gửi">
              {approval.submittedByName} ({approval.submittedByCode})
            </InfoRow>
            <InfoRow label="Đơn vị">{approval.orgUnitName ?? 'Chưa gán đơn vị'}</InfoRow>
            <InfoRow label="Gửi lúc">
              {approval.submittedAt ? formatDateTime(approval.submittedAt) : ''}
              {approval.submissionCount > 1 ? `, lần ${approval.submissionCount}` : ''}
            </InfoRow>
            <InfoRow label="Người đang duyệt">
              {approval.currentApproverName ?? 'Không còn chờ ai'}
            </InfoRow>
          </dl>

          {target ? (
            <section className="mt-6">
              <h2 className="text-lg font-bold text-brand">Chỉ tiêu đề nghị</h2>
              <TargetCompare view={target} />
              {target.proposed.note ? (
                <p className="mt-2">
                  <span className="text-text-muted">Ghi chú của người gửi: </span>
                  {target.proposed.note}
                </p>
              ) : null}
            </section>
          ) : null}

          {route ? (
            <section className="mt-6">
              <h2 className="text-lg font-bold text-brand">Tuyến đề nghị</h2>
              {approval.isLate ? (
                <p className="mt-1">
                  <span className="rounded-sm bg-warning-soft px-1.5 text-sm">Nộp muộn</span>
                </p>
              ) : null}
              <RouteDays days={route.proposed} />
              {route.approved ? (
                <details className="mt-4">
                  <summary className="cursor-pointer font-bold text-brand">
                    Xem tuyến đã duyệt đang có hiệu lực
                  </summary>
                  <RouteDays days={route.approved} />
                </details>
              ) : null}
            </section>
          ) : null}

          {approval.onBehalfOf ? (
            <p className="mt-6 rounded-md bg-warning-soft px-3 py-2">
              Phiếu đang chờ <b>{approval.onBehalfOf}</b> duyệt. Bạn là Quản trị hệ thống nên duyệt
              hoặc trả lại thay được; nhật ký sẽ ghi rõ duyệt thay.
            </p>
          ) : null}
          {approval.canReview || approval.canWithdraw ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {approval.canReview ? <ApprovalReviewButtons code={approval.code} /> : null}
              {approval.canWithdraw ? <ApprovalWithdrawButton code={approval.code} /> : null}
            </div>
          ) : null}
        </div>

        <section aria-labelledby="timeline-title">
          <h2 id="timeline-title" className="text-lg font-bold text-brand">
            Nhật ký phiếu
          </h2>
          <Timeline approval={approval} />
        </section>
      </div>
    </>
  );
}
