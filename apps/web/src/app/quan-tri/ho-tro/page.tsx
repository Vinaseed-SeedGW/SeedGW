import type { Metadata } from 'next';
import { Suspense } from 'react';
import { supportInboxUrlParams, type ListSupportInboxInput } from '@dms/contracts/support';
import { DataTableSkeleton } from '@dms/ui/data-table-skeleton';
import { SupportInboxTabs } from '@/features/support/components/support-inbox-tabs';
import { SupportInboxTable } from '@/features/support/components/support-inbox-table';
import { SupportLiveRefresh } from '@/features/support/components/support-live-refresh';
import { requirePermission } from '@/server/auth/can';
import { getSupportInbox } from '@/server/queries/support';

export const metadata: Metadata = { title: 'Hỗ trợ' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Giữ bộ lọc khi mở chi tiết và quay lại. */
function queryOf(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value) search.set(key, value);
  }
  return search.toString();
}

export default async function SupportInboxPage({ searchParams }: PageProps) {
  await requirePermission('support.request.manage');
  const params = await searchParams;
  const input = supportInboxUrlParams.parse(params);

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Hỗ trợ</h1>
      <p className="mt-1 max-w-3xl text-text-muted">
        Yêu cầu hỏi đáp, báo lỗi, góp ý của cán bộ nhân viên. Quản trị đơn vị nhận ở hộp chung của
        đơn vị, cần thì Chuyển lên Quản trị hệ thống. Danh sách tự cập nhật khi có yêu cầu hoặc trả
        lời mới.
      </p>
      <SupportInboxTabs active={input.view} />
      <SupportLiveRefresh />
      <Suspense key={JSON.stringify(input)} fallback={<DataTableSkeleton columns={5} rows={6} />}>
        <InboxResults input={input} query={queryOf(params)} />
      </Suspense>
    </>
  );
}

async function InboxResults({ input, query }: { input: ListSupportInboxInput; query: string }) {
  return <SupportInboxTable data={await getSupportInbox(input)} query={query} />;
}
