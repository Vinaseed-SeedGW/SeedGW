import Link from 'next/link';
import type { ReactNode } from 'react';
import { CHECK_IN_PLACE_KIND_LABEL, formatKm, type CheckInRow } from '@seedgw/contracts/check-ins';
import {
  DEALER_LEVEL_LABEL,
  DEALER_STATUS_LABEL,
  type DealerDetail,
  type DealerFormOptions,
} from '@seedgw/contracts/dealers';
import { formatDateTime } from '@seedgw/contracts/format';
import { DealerEditForm } from './dealer-edit-form';
import { APP_NAME } from '@seedgw/config/brand';

type Props = {
  dealer: DealerDetail;
  backHref: string;
  editOptions: DealerFormOptions | null;
  visits: CheckInRow[] | null;
};

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="mt-0.5">{children || <span className="text-text-muted">Chưa có</span>}</dd>
    </div>
  );
}

/** Một hồ sơ, hai lối vào (IA §1): Kinh doanh và Quản trị dùng chung, chỉ khác đường quay lại. */
export function DealerProfile({ dealer, backHref, editOptions, visits }: Props) {
  return (
    <>
      <Link href={backHref} className="text-brand">
        Về danh sách đại lý
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-brand">{dealer.name}</h1>
      {dealer.mergedInto ? (
        <p className="mt-2 rounded-md bg-warning-soft px-3 py-2">
          Đại lý này đã gộp vào{' '}
          <Link
            href={`${backHref.split('?')[0]}/${dealer.mergedInto.id}`}
            className="font-bold text-brand hover:underline"
          >
            {dealer.mergedInto.name}
          </Link>
          , dữ liệu check-in và tuyến đã chuyển sang đại lý đó.
        </p>
      ) : null}
      <p className="text-text-muted">
        {dealer.code ? `Mã ${dealer.code}` : 'Chưa có mã FAST'}
        {dealer.legacyCode ? `, mã hệ thống cũ ${dealer.legacyCode}` : ''}
        {`, ${DEALER_LEVEL_LABEL[dealer.level]}, ${DEALER_STATUS_LABEL[dealer.status]}`}
      </p>

      <section className="mt-5 rounded-md border border-border bg-surface p-4">
        <h2 className="text-lg font-bold">Thông tin</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Item label="Nhân viên phụ trách">
            {dealer.assignedUserName ??
              (dealer.legacyAssigneeName
                ? `Chờ gán (hệ thống cũ: ${dealer.legacyAssigneeName})`
                : '')}
          </Item>
          <Item label="Đơn vị phụ trách">{dealer.orgUnitName}</Item>
          <Item label="Đại lý cấp trên">
            {dealer.parent
              ? `${dealer.parent.name}${dealer.parent.code ? ` (${dealer.parent.code})` : ''}`
              : ''}
          </Item>
          <Item label="Số điện thoại">{dealer.phone ?? dealer.phoneRaw}</Item>
          <Item label="Chủ đại lý">
            {[dealer.ownerName, dealer.ownerPhone].filter(Boolean).join(', ')}
          </Item>
          <Item label="Mã số thuế">{dealer.taxCode}</Item>
          <Item label="Địa chỉ">
            {[dealer.address, dealer.provinceName].filter(Boolean).join(', ')}
          </Item>
          <Item label="Xã, huyện, tỉnh cũ (trước 01/07/2025)">{dealer.legacyAdminArea}</Item>
          <Item label="Toạ độ">
            {dealer.lat !== null && dealer.lng !== null ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${dealer.lat},${dealer.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-brand"
              >
                {dealer.lat.toFixed(6)}, {dealer.lng.toFixed(6)}
              </a>
            ) : (
              ''
            )}
          </Item>
        </dl>
        <p className="mt-3 text-sm text-text-muted">
          Tên, mã FAST và mã số thuế lấy theo FAST, sửa trên FAST rồi đồng bộ về. Công nợ và hạn mức
          sẽ hiện khi nối FAST.
        </p>
      </section>

      {editOptions ? (
        <section className="mt-5 rounded-md border border-border bg-surface p-4">
          <h2 className="text-lg font-bold">Sửa thông tin trên {APP_NAME}</h2>
          <div className="mt-3">
            <DealerEditForm dealer={dealer} options={editOptions} />
          </div>
        </section>
      ) : null}

      {visits ? <Visits visits={visits} /> : null}
    </>
  );
}

function Visits({ visits }: { visits: CheckInRow[] }) {
  const cell = 'border-b border-border px-2.5 py-1.5 align-top';
  return (
    <section className="mt-5 rounded-md border border-border bg-surface p-4">
      <h2 className="text-lg font-bold">Viếng thăm</h2>
      {visits.length === 0 ? (
        <p className="mt-2 text-text-muted">Chưa có lượt check-in nào tại đại lý này.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                {['Thời gian', 'Nhân viên', 'Nơi check-in', 'Ghi chú', 'Km theo GPS'].map(
                  (header) => (
                    <th key={header} className={`${cell} font-bold whitespace-nowrap`}>
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {visits.map((visit) => (
                <tr key={visit.id}>
                  <td className={`${cell} whitespace-nowrap`}>
                    {formatDateTime(visit.capturedAt)}
                  </td>
                  <td className={cell}>{visit.employeeName}</td>
                  <td className={cell}>
                    {CHECK_IN_PLACE_KIND_LABEL[visit.placeKind]} {visit.placeName}
                  </td>
                  <td className={cell}>{visit.note}</td>
                  <td className={`${cell} text-right`}>
                    {visit.gpsDistanceKm === null ? '' : formatKm(visit.gpsDistanceKm)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
