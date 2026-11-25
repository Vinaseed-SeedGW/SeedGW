import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  CUSTOMER_KIND_LABEL,
  formatAreaHa,
  type CustomerDetail,
  type CustomerOption,
  type CustomerVisit,
} from '@seedgw/contracts/customers';
import { formatDate, formatDateTime } from '@seedgw/contracts/format';
import { CustomerFormEdit } from './customer-form';

type Props = {
  customer: CustomerDetail;
  backHref: string;
  dealerHref: string;
  users: CustomerOption[] | null;
  visits: CustomerVisit[];
  canSeeVisits: boolean;
};

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="mt-0.5">{children || <span className="text-text-muted">Chưa có</span>}</dd>
    </div>
  );
}

/** Hồ sơ khách hàng (S1): thông tin, sửa nếu có quyền, lượt viếng thăm. */
export function CustomerProfile({
  customer,
  backHref,
  dealerHref,
  users,
  visits,
  canSeeVisits,
}: Props) {
  return (
    <>
      <Link href={backHref} className="text-brand hover:underline">
        Về danh sách khách hàng
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-brand">{customer.name}</h1>
      <p className="text-text-muted">
        {`Mã ${customer.code}, ${CUSTOMER_KIND_LABEL[customer.kind]}`}
        {customer.lastVisitedAt
          ? `, ghé gần nhất ${formatDate(customer.lastVisitedAt)}`
          : ', chưa ghé'}
      </p>

      <section className="mt-5 rounded-md border border-border bg-surface p-4">
        <h2 className="text-lg font-bold">Thông tin</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Item label="Số điện thoại">{customer.phone}</Item>
          <Item label="Địa chỉ">
            {[customer.address, customer.provinceName].filter(Boolean).join(', ')}
          </Item>
          <Item label="Cây trồng">{customer.crops.join(', ')}</Item>
          <Item label="Diện tích canh tác">
            {customer.areaHa === null ? '' : formatAreaHa(customer.areaHa)}
          </Item>
          <Item label="Nhân viên phụ trách">{customer.assignedUserName}</Item>
          <Item label="Đơn vị">{customer.orgUnitName}</Item>
          <Item label="Đại lý hay mua">
            {customer.dealers.length > 0 ? (
              <ul>
                {customer.dealers.map((dealer) => (
                  <li key={dealer.id}>
                    <Link
                      href={`${dealerHref}/${dealer.id}`}
                      className="text-brand hover:underline"
                    >
                      {dealer.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              ''
            )}
          </Item>
          <Item label="Ghi chú">{customer.note}</Item>
          <Item label="Người tạo">
            {customer.createdByName
              ? `${customer.createdByName}, ${formatDateTime(customer.createdAt)}`
              : formatDateTime(customer.createdAt)}
          </Item>
        </dl>
      </section>

      {users ? (
        <section className="mt-5 rounded-md border border-border bg-surface p-4">
          <h2 className="text-lg font-bold">Sửa thông tin</h2>
          <div className="mt-3">
            <CustomerFormEdit customer={customer} users={users} />
          </div>
        </section>
      ) : null}

      {canSeeVisits ? <Visits visits={visits} /> : null}
    </>
  );
}

function Visits({ visits }: { visits: CustomerVisit[] }) {
  const cell = 'border-b border-border px-2.5 py-2 align-top';
  return (
    <section className="mt-5 rounded-md border border-border bg-surface p-4">
      <h2 className="text-lg font-bold">Viếng thăm</h2>
      {visits.length === 0 ? (
        <p className="mt-2 text-text-muted">
          Chưa có lượt check-in nào. Nhân viên chọn khách hàng này khi check-in loại Khách hàng trên
          app.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="text-left text-sm text-text-muted">
                <th className={cell}>Thời điểm</th>
                <th className={cell}>Nhân viên</th>
                <th className={cell}>Ghi chú</th>
                <th className={cell}>Địa chỉ lúc chụp</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((visit) => (
                <tr key={visit.id}>
                  <td className={`${cell} whitespace-nowrap tabular-nums`}>
                    {formatDateTime(visit.capturedAt)}
                    {visit.flagged ? (
                      <span className="mt-1 block w-fit rounded-md bg-warning-soft px-1.5 text-sm">
                        Có cờ nghi vấn
                      </span>
                    ) : null}
                  </td>
                  <td className={cell}>{visit.userName}</td>
                  <td className={cell}>
                    {visit.note || <span className="text-text-muted">Không có</span>}
                  </td>
                  <td className={cell}>
                    {visit.address ?? <span className="text-text-muted">Đang lấy</span>}
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
