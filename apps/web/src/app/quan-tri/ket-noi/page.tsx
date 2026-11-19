import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  FAST_SYNC_STATUS_LABEL,
  type FastOverview,
  type FastSyncStatus,
} from '@dms/contracts/fast';
import { formatDateTime, formatNumber } from '@dms/contracts/format';
import { FastConnectionFormEdit } from '@/features/connections/components/fast-connection-form';
import { FastSyncNowButton } from '@/features/connections/components/fast-sync-now';
import { can, requirePermission } from '@/server/auth/can';
import { getFastOverview } from '@/server/queries/fast';

export const metadata: Metadata = { title: 'Kết nối' };

const STATUS_TONE: Record<FastSyncStatus, string> = {
  RUNNING: 'bg-warning-soft text-text',
  OK: 'bg-brand-soft text-brand',
  FAILED: 'bg-danger-soft text-danger',
  SKIPPED: 'bg-surface-subtle text-text-muted',
};

function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {aside}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-xl font-bold">{value}</dd>
    </div>
  );
}

function ConnectionSummary({ overview }: { overview: FastOverview }) {
  const { connection } = overview;
  if (!connection.configured) return <p className="text-text-muted">Chưa nhập cấu hình FAST.</p>;
  return (
    <dl className="grid gap-2 sm:grid-cols-[160px_1fr]">
      <dt className="text-text-muted">Địa chỉ API</dt>
      <dd className="break-all">{connection.baseUrl}</dd>
      <dt className="text-text-muted">Tên đăng nhập</dt>
      <dd>{connection.username}</dd>
      <dt className="text-text-muted">Đồng bộ</dt>
      <dd>{connection.enabled ? 'Đang bật' : 'Đang tắt'}</dd>
    </dl>
  );
}

export default async function ConnectionsPage() {
  const user = await requirePermission('admin.connection.read');
  const canManage = can(user, 'admin.connection.manage');
  const overview = await getFastOverview();
  const { stats } = overview;

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Kết nối</h1>
      <p className="mt-1 max-w-3xl text-text-muted">
        Đồng bộ danh mục khách hàng từ FAST Business Online sang DMS theo API FAST cấp (đặc tả bản
        1.7). FAST là gốc cho tên, địa chỉ, điện thoại, mã số thuế, trạng thái; DMS giữ toạ độ, nhân
        viên phụ trách và cấp đại lý. Công nợ, hoá đơn tạm chưa đồng bộ.
      </p>

      <div className="mt-5 grid max-w-5xl gap-4 xl:grid-cols-2">
        <Section title="Cấu hình FAST">
          {canManage ? (
            <FastConnectionFormEdit
              key={overview.connection.updatedAt ?? 'moi'}
              connection={overview.connection}
            />
          ) : (
            <ConnectionSummary overview={overview} />
          )}
          {overview.connection.updatedAt ? (
            <p className="mt-3 text-sm text-text-muted">
              Lưu lần cuối {formatDateTime(overview.connection.updatedAt)}. Mật khẩu được mã hoá
              trước khi lưu.
            </p>
          ) : null}
        </Section>

        <Section title="Đồng bộ khách hàng" aside={canManage ? <FastSyncNowButton /> : null}>
          <dl className="grid grid-cols-2 gap-3">
            <Stat label="Khách hàng nhận từ FAST" value={formatNumber(stats.fastCustomers)} />
            <Stat label="Đã ghép với đại lý DMS" value={formatNumber(stats.matchedDealers)} />
            <Stat label="Đại lý DMS có mã FAST" value={formatNumber(stats.dealersWithCode)} />
            <Stat
              label="Có mã nhưng chưa có trên FAST"
              value={
                stats.dealersNotOnFast === null ? 'Chưa biết' : formatNumber(stats.dealersNotOnFast)
              }
            />
          </dl>
          <p className="mt-3 text-sm text-text-muted">
            Tự đồng bộ {overview.syncMinutes} phút một lần (đổi ở{' '}
            <Link href="/quan-tri/tham-so" className="text-brand hover:underline">
              Tham số
            </Link>
            ).{' '}
            {stats.lastFullSyncAt
              ? `Lần lấy toàn bộ gần nhất ${formatDateTime(stats.lastFullSyncAt)}.`
              : 'Chưa lấy toàn bộ lần nào; số đại lý chưa có trên FAST hiện sau lần đầu.'}
          </p>
        </Section>
      </div>

      <div className="mt-4 max-w-5xl">
        <Section title="Các lần đồng bộ gần nhất">
          {overview.runs.length === 0 ? (
            <p className="text-text-muted">Chưa đồng bộ lần nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-sm text-text-muted">
                  <tr>
                    <th className="py-1 pr-3 font-normal">Bắt đầu</th>
                    <th className="py-1 pr-3 font-normal">Cách chạy</th>
                    <th className="py-1 pr-3 font-normal">Kết quả</th>
                    <th className="py-1 font-normal">Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.runs.map((run) => (
                    <tr key={run.id} className="border-t border-border align-top">
                      <td className="py-1.5 pr-3 whitespace-nowrap">
                        {formatDateTime(run.startedAt)}
                      </td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">
                        {run.trigger === 'MANUAL' ? 'Bấm đồng bộ' : 'Tự động'}
                        <span className="block text-sm text-text-muted">
                          {run.sinceAt ? `Sửa từ ${formatDateTime(run.sinceAt)}` : 'Lấy toàn bộ'}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3">
                        <span
                          className={`rounded-sm px-1.5 text-sm font-bold whitespace-nowrap ${STATUS_TONE[run.status]}`}
                        >
                          {FAST_SYNC_STATUS_LABEL[run.status]}
                        </span>
                      </td>
                      <td className="py-1.5 text-sm">{run.message ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      {overview.errors.length > 0 ? (
        <div className="mt-4 max-w-5xl">
          <Section title="Dòng lỗi của lần có lỗi gần nhất">
            <ul className="grid gap-1.5">
              {overview.errors.map((error) => (
                <li key={error.id} className="text-sm">
                  <span className="font-bold">{error.fastCode ?? 'Không rõ mã'}</span>:{' '}
                  {error.message}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      ) : null}
    </>
  );
}
