import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  CONSENT_STATUS_LABEL,
  consentStatusUrlParams,
  type ConsentStatusInput,
} from '@seedgw/contracts/consents';
import { formatNumber } from '@seedgw/contracts/format';
import { DataTableSkeleton } from '@seedgw/ui/data-table-skeleton';
import { Can } from '@/features/auth/components/can';
import {
  ConsentExportButton,
  ConsentStatusTable,
} from '@/features/consents/components/consent-status-table';
import { requirePermission } from '@/server/auth/can';
import { countConsentStatuses, listConsentStatuses } from '@/server/queries/consents';

export const metadata: Metadata = { title: 'Đồng ý dữ liệu cá nhân' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ConsentAdminPage({ searchParams }: PageProps) {
  await requirePermission('admin.user.read');
  const input = consentStatusUrlParams.parse(await searchParams);

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand">Đồng ý dữ liệu cá nhân</h1>
        <Link href="/kiem-chung-dong-y" className="font-bold text-brand hover:underline">
          Kiểm chứng một mã
        </Link>
      </div>
      <p className="mt-1 max-w-3xl text-text-muted">
        Tình trạng đồng ý chia sẻ vị trí của tài khoản đang hoạt động trong phạm vi bạn quản lý. Mỗi
        lần đồng ý hay rút lại được ghi vào sổ chỉ ghi thêm, có toàn văn và mã kiểm chứng; mở Giấy
        xác nhận để in hoặc lưu PDF.
      </p>
      <Suspense fallback={<p className="mt-3 text-text-muted">Đang đếm...</p>}>
        <StatusCounts />
      </Suspense>
      <Suspense key={JSON.stringify(input)} fallback={<DataTableSkeleton columns={5} rows={10} />}>
        <ConsentResults input={input} />
      </Suspense>
    </>
  );
}

async function StatusCounts() {
  const counts = await countConsentStatuses();
  return (
    <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
      {(['ACCEPTED', 'WITHDRAWN', 'NONE'] as const).map((status) => (
        <span key={status}>
          {CONSENT_STATUS_LABEL[status]}: <b>{formatNumber(counts[status])}</b>
        </span>
      ))}
    </p>
  );
}

async function ConsentResults({ input }: { input: ConsentStatusInput }) {
  const data = await listConsentStatuses(input);
  return (
    <ConsentStatusTable data={data}>
      <Can permission="admin.user.export">
        <ConsentExportButton filter={{ q: input.q, status: input.status }} />
      </Can>
    </ConsentStatusTable>
  );
}
