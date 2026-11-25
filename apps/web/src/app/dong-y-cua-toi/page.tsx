import type { Metadata } from 'next';
import { ConsentPageFrame } from '@/features/consents/components/consent-page-frame';
import Link from 'next/link';
import {
  CONSENT_ACTION_LABEL,
  CONSENT_CHANNEL_LABEL,
  LOCATION_CONSENT,
  shortConsentCode,
} from '@seedgw/contracts/consents';
import { formatDateTime } from '@seedgw/contracts/format';
import { OwnConsentButtons } from '@/features/consents/components/own-consent-buttons';
import { getMyConsents } from '@/server/queries/consents';

export const metadata: Metadata = { title: 'Đồng ý của tôi' };

const CELL = 'border-b border-border px-2.5 py-2 align-top';

export default async function MyConsentsPage() {
  const { user, status, records } = await getMyConsents();

  return (
    <ConsentPageFrame>
      <h1 className="text-2xl font-bold text-brand">Đồng ý của tôi</h1>
      <p className="mt-1 max-w-3xl text-text-muted">
        Mỗi lần bạn đồng ý hay rút lại được ghi vào sổ đồng ý, kèm toàn văn bạn đã đọc và mã kiểm
        chứng. Mở từng dòng để in hoặc lưu PDF giấy xác nhận.
      </p>

      <section className="mt-4 rounded-md border border-border bg-surface p-4">
        <h2 className="text-lg font-bold">{LOCATION_CONSENT.title}</h2>
        <p className="mt-1">
          {status.accepted && status.acceptedAt
            ? `Bạn đã đồng ý lúc ${formatDateTime(status.acceptedAt)}.`
            : 'Bạn chưa đồng ý hoặc đã rút lại đồng ý.'}
        </p>
        {user.impersonator ? (
          <p className="mt-2 text-sm text-text-muted">
            Đang đăng nhập thay nên không đồng ý hay rút lại thay người khác được.
          </p>
        ) : (
          <OwnConsentButtons accepted={status.accepted} />
        )}
        <details className="mt-3">
          <summary className="cursor-pointer font-bold text-brand">Xem toàn văn nội dung</summary>
          <p className="mt-2">{LOCATION_CONSENT.intro}</p>
          {LOCATION_CONSENT.sections.map((section) => (
            <div key={section.heading} className="mt-2">
              <h3 className="font-bold">{section.heading}</h3>
              <ul className="ml-5 list-disc">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </details>
      </section>

      <section className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold">Sổ đồng ý của bạn</h2>
          <Link href="/kiem-chung-dong-y" className="font-bold text-brand hover:underline">
            Kiểm chứng một mã
          </Link>
        </div>
        {records.length === 0 ? (
          <p className="mt-2 text-text-muted">Chưa có lần đồng ý hay rút lại nào.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className={`${CELL} font-bold`}>Thời điểm</th>
                  <th className={`${CELL} font-bold`}>Hành động</th>
                  <th className={`${CELL} font-bold max-md:hidden`}>Kênh</th>
                  <th className={`${CELL} font-bold`}>Mã kiểm chứng</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td className={`${CELL} whitespace-nowrap`}>
                      {formatDateTime(record.recordedAt)}
                    </td>
                    <td className={CELL}>{CONSENT_ACTION_LABEL[record.action]}</td>
                    <td className={`${CELL} max-md:hidden`}>
                      {CONSENT_CHANNEL_LABEL[record.channel]}
                      {record.deviceName ? `, ${record.deviceName}` : ''}
                    </td>
                    <td className={CELL}>
                      <Link
                        href={`/giay-xac-nhan-dong-y/${record.id}`}
                        className="font-bold whitespace-nowrap text-brand hover:underline"
                      >
                        {shortConsentCode(record.recordHash)}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </ConsentPageFrame>
  );
}
