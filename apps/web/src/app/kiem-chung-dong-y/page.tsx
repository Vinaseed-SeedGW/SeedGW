import { CircleCheck, CircleX } from 'lucide-react';
import type { Metadata } from 'next';
import { ConsentPageFrame } from '@/features/consents/components/consent-page-frame';
import Link from 'next/link';
import { CONSENT_ACTION_LABEL, shortConsentCode } from '@seedgw/contracts/consents';
import { formatDateTime } from '@seedgw/contracts/format';
import { signedInUser, verifyConsentCode } from '@/server/queries/consents';

export const metadata: Metadata = { title: 'Kiểm chứng đồng ý' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function Check({ ok, label }: { ok: boolean; label: string }) {
  const Icon = ok ? CircleCheck : CircleX;
  return (
    <li className={`flex items-center gap-2 ${ok ? 'text-brand' : 'text-danger'}`}>
      <Icon size={18} aria-hidden />
      {label}: {ok ? 'khớp' : 'không khớp'}
    </li>
  );
}

export default async function VerifyConsentPage({ searchParams }: PageProps) {
  const user = await signedInUser();
  const raw = (await searchParams).ma;
  const code = typeof raw === 'string' ? raw.trim().slice(0, 100) : '';
  const result = code ? await verifyConsentCode(code) : null;
  const allOk = result
    ? result.contentMatches && result.recordMatches && result.chainMatches
    : false;

  return (
    <ConsentPageFrame>
      <h1 className="text-2xl font-bold text-brand">Kiểm chứng đồng ý</h1>
      <p className="mt-1 max-w-3xl text-text-muted">
        Nhập mã kiểm chứng in trên giấy xác nhận (16 ký tự, ví dụ AB12-CD34-EF56-7890) hoặc mã đầy
        đủ 64 ký tự. Hệ thống tính lại mã từ dữ liệu gốc trong sổ đồng ý và đối chiếu. Bạn kiểm
        chứng được mã của mình; quản trị kiểm chứng được mã của người trong phạm vi.
      </p>
      <form method="get" className="mt-4 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm">
          Mã kiểm chứng
          <input
            name="ma"
            defaultValue={code}
            autoComplete="off"
            className="h-9.5 w-80 max-w-full rounded-md border border-input bg-surface px-2.5"
          />
        </label>
        <button
          type="submit"
          className="h-9.5 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover"
        >
          Kiểm chứng
        </button>
      </form>

      {code && !result ? (
        <p role="alert" className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-danger">
          Không tìm thấy mã này trong sổ đồng ý, hoặc mã thuộc người ngoài phạm vi bạn được xem.
        </p>
      ) : null}
      {result ? (
        <section
          className={`mt-4 rounded-md border p-4 ${allOk ? 'border-brand bg-brand-soft' : 'border-danger bg-danger-soft'}`}
        >
          <h2 className="text-lg font-bold">
            {allOk ? 'Bản ghi nguyên vẹn' : 'Bản ghi không còn nguyên vẹn'}
          </h2>
          <p className="mt-1">
            {CONSENT_ACTION_LABEL[result.record.action]} của {result.record.fullName} (
            {result.record.employeeCode}) lúc {formatDateTime(result.record.recordedAt)}, mã{' '}
            {shortConsentCode(result.record.recordHash)}.
          </p>
          <ul className="mt-2 grid gap-1">
            <Check ok={result.contentMatches} label="Toàn văn nội dung" />
            <Check ok={result.recordMatches} label="Thông tin bản ghi" />
            <Check ok={result.chainMatches} label="Nối với dòng trước và dòng sau trong sổ" />
          </ul>
          <Link
            href={`/giay-xac-nhan-dong-y/${result.record.id}${
              result.record.employeeCode === user.employeeCode ? '' : '?ve=quan-tri'
            }`}
            className="mt-3 inline-block font-bold text-brand hover:underline"
          >
            Xem giấy xác nhận
          </Link>
        </section>
      ) : null}
    </ConsentPageFrame>
  );
}
