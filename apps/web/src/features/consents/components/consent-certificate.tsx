import type { ReactNode } from 'react';
import {
  CONSENT_ACTION_LABEL,
  CONSENT_CHANNEL_LABEL,
  CONSENT_KIND_LABEL,
  shortConsentCode,
  type ConsentRecordView,
} from '@seedgw/contracts/consents';
import { formatDateTime } from '@seedgw/contracts/format';
import { Logo } from '@seedgw/ui/logo';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-text-muted">{label}</dt>
      <dd className="break-words">{children}</dd>
    </>
  );
}

/**
 * Giấy xác nhận đồng ý (25/11/2026): một dòng trong sổ đồng ý, đủ toàn văn đã hiển thị và mã kiểm chứng,
 * in được hoặc lưu PDF từ trình duyệt.
 */
export function ConsentCertificate({ record }: { record: ConsentRecordView }) {
  const device = [record.deviceName, record.devicePlatform].filter(Boolean).join(', ');
  return (
    <article className="rounded-md border border-border bg-surface p-5 print:border-0 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Logo variant="color" size="m" />
        <p className="text-sm text-text-muted">Số thứ tự trong sổ: {record.seq}</p>
      </div>
      <h1 className="mt-4 text-xl font-bold text-brand">
        Giấy xác nhận {CONSENT_ACTION_LABEL[record.action].toLowerCase()} xử lý dữ liệu cá nhân
      </h1>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
        <Row label="Người">
          {record.fullName} ({record.employeeCode})
        </Row>
        <Row label="Nội dung">{CONSENT_KIND_LABEL[record.kind] ?? record.kind}</Row>
        <Row label="Hành động">{CONSENT_ACTION_LABEL[record.action]}</Row>
        <Row label="Thời điểm">
          {formatDateTime(record.recordedAt)} (giờ Việt Nam, theo máy chủ)
        </Row>
        <Row label="Kênh">{CONSENT_CHANNEL_LABEL[record.channel]}</Row>
        {device ? <Row label="Thiết bị">{device}</Row> : null}
        {record.userAgent ? <Row label="Trình duyệt">{record.userAgent}</Row> : null}
        {record.ip ? <Row label="Địa chỉ IP">{record.ip}</Row> : null}
        <Row label="Phiên bản nội dung">{record.version}</Row>
      </dl>
      {record.migrated ? (
        <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-sm">
          Dòng này chuyển từ dữ liệu đồng ý trước ngày 25/11/2026: thời điểm, kênh và IP lấy từ dữ
          liệu cũ, nội dung theo phiên bản đã đồng ý. Khi đó chưa ghi thiết bị và trình duyệt.
        </p>
      ) : null}

      <h2 className="mt-5 font-bold">Toàn văn nội dung đã hiển thị</h2>
      <pre className="mt-2 rounded-md border border-border bg-surface-subtle p-3 font-sans text-sm whitespace-pre-wrap print:border-0 print:bg-surface">
        {record.contentText}
      </pre>

      <h2 className="mt-5 font-bold">Mã kiểm chứng</h2>
      <p className="mt-1 text-2xl font-bold tracking-wider text-brand">
        {shortConsentCode(record.recordHash)}
      </p>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
        <Row label="Mã đầy đủ (SHA-256)">
          <span className="font-mono break-all">{record.recordHash}</span>
        </Row>
        <Row label="Mã nội dung">
          <span className="font-mono break-all">{record.contentHash}</span>
        </Row>
        <Row label="Mã dòng trước">
          <span className="font-mono break-all">{record.prevHash}</span>
        </Row>
      </dl>
      <p className="mt-3 text-sm text-text-muted">
        Mã được tính từ toàn văn, người, thời điểm, kênh và mã dòng trước trong sổ đồng ý. Sổ chỉ
        ghi thêm, không sửa, không xoá. Nhập mã ở trang Kiểm chứng đồng ý trên SeedGW để đối chiếu
        với dữ liệu gốc.
      </p>
    </article>
  );
}
