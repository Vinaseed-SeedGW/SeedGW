import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatDateTime } from '@dms/contracts/format';
import {
  isSupportCode,
  SUPPORT_LEVEL_LABEL,
  supportInboxUrlParams,
  type SupportDetail,
  type SupportListResult,
} from '@dms/contracts/support';
import { notFound } from 'next/navigation';
import {
  SupportDueBadge,
  SupportStatusBadge,
  supportKindText,
} from '@/features/support/components/support-badges';
import {
  SupportHandlerActions,
  SupportHandlerComposer,
} from '@/features/support/components/support-handler-actions';
import { SupportLiveRefresh } from '@/features/support/components/support-live-refresh';
import { SupportThreadMessages } from '@/features/support/components/support-thread';
import { requirePermission } from '@/server/auth/can';
import { getSupportDetailForHandler, getSupportInbox } from '@/server/queries/support';
import { DomainError } from '@/server/services/domain-error';

type PageProps = {
  params: Promise<{ ma: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ma } = await params;
  return { title: `Yêu cầu ${decodeURIComponent(ma)}` };
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[140px_1fr]">
      <dt className="text-text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function contextText(detail: SupportDetail): string | null {
  const { page, appVersion, platform, device, screen } = detail.context;
  if (page) return `Trang web ${page}`;
  const parts = [
    appVersion ? `App ${appVersion}` : '',
    platform ?? '',
    device ?? '',
    screen ? `màn hình ${screen}` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

function SideList({
  list,
  current,
  query,
}: {
  list: SupportListResult;
  current: string;
  query: string;
}) {
  return (
    <nav aria-label="Danh sách yêu cầu" className="max-lg:hidden">
      <ul className="grid gap-1.5">
        {list.items.map((item) => (
          <li key={item.code}>
            <Link
              href={`/quan-tri/ho-tro/${item.code}${query ? `?${query}` : ''}`}
              aria-current={item.code === current ? 'page' : undefined}
              className={`grid gap-0.5 rounded-md border px-3 py-2 hover:bg-brand-soft ${item.code === current ? 'border-brand bg-brand-soft' : 'border-border'}`}
            >
              <span className="truncate font-bold">{item.title}</span>
              <span className="flex flex-wrap items-center gap-1.5 text-sm text-text-muted">
                <SupportStatusBadge status={item.status} />
                {item.code}
                {item.needsReply ? <span className="font-bold text-text">Cần trả lời</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {list.total > list.items.length ? (
        <p className="mt-2 text-sm text-text-muted">
          Đang hiện {list.items.length} trên {list.total} yêu cầu.
        </p>
      ) : null}
    </nav>
  );
}

async function loadDetail(code: string): Promise<SupportDetail | null> {
  try {
    return await getSupportDetailForHandler(code);
  } catch (error) {
    if (error instanceof DomainError && error.code === 'NOT_FOUND') return null;
    throw error;
  }
}

export default async function SupportDetailPage({ params, searchParams }: PageProps) {
  await requirePermission('support.request.manage');
  const { ma } = await params;
  const code = decodeURIComponent(ma);
  if (!isSupportCode(code)) notFound();
  const search = await searchParams;
  const query = new URLSearchParams(
    Object.entries(search).flatMap(([key, value]) =>
      typeof value === 'string' ? [[key, value]] : [],
    ),
  ).toString();
  const [detail, list] = await Promise.all([
    loadDetail(code),
    getSupportInbox(supportInboxUrlParams.parse(search)),
  ]);
  if (!detail) notFound();
  const context = contextText(detail);

  return (
    <>
      <SupportLiveRefresh />
      <Link
        href={`/quan-tri/ho-tro${query ? `?${query}` : ''}`}
        className="text-sm text-brand hover:underline"
      >
        Về danh sách Hỗ trợ
      </Link>
      <div className="mt-3 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <SideList list={list} current={detail.code} query={query} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-brand">{detail.title}</h1>
            <SupportStatusBadge status={detail.status} />
          </div>
          <p className="mt-1 text-text-muted">
            {detail.code}, {supportKindText(detail.type, detail.severity)}
          </p>
          <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              <SupportThreadMessages detail={detail} />
              {detail.actions.canReply ? (
                <div className="mt-4">
                  <SupportHandlerComposer code={detail.code} />
                </div>
              ) : null}
            </div>
            <aside className="grid content-start gap-4">
              <dl className="grid gap-2 rounded-md border border-border p-3">
                <InfoRow label="Người gửi">
                  {detail.requesterName}
                  <span className="block text-sm text-text-muted">
                    {detail.requesterCode}
                    {detail.orgUnitName ? `, ${detail.orgUnitName}` : ''}
                  </span>
                </InfoRow>
                <InfoRow label="Gửi lúc">{formatDateTime(detail.createdAt)}</InfoRow>
                <InfoRow label="Cấp xử lý">{SUPPORT_LEVEL_LABEL[detail.level]}</InfoRow>
                <InfoRow label="Người nhận">{detail.assigneeName ?? 'Chưa ai nhận'}</InfoRow>
                {detail.due ? (
                  <InfoRow label="Thời hạn">
                    <SupportDueBadge due={detail.due} />
                  </InfoRow>
                ) : null}
                {context ? <InfoRow label="Gửi từ">{context}</InfoRow> : null}
                {detail.escalationNote ? (
                  <InfoRow label="Ghi chú chuyển lên">{detail.escalationNote}</InfoRow>
                ) : null}
              </dl>
              <SupportHandlerActions detail={detail} />
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
