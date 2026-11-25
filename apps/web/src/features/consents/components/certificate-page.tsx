import Link from 'next/link';
import type { ConsentRecordView } from '@seedgw/contracts/consents';
import { AppFooter } from '@seedgw/ui/app-footer';
import { MAIN_CONTENT_ID, SkipLink } from '@seedgw/ui/skip-link';
import { ConsentCertificate } from './consent-certificate';
import { PrintButton } from './print-button';

/** Khung trang in giấy xác nhận: không có menu, chỉ nút quay lại và nút in (ẩn khi in). */
export function CertificatePage({
  record,
  backHref,
  backLabel,
}: {
  record: ConsentRecordView;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 outline-none sm:px-6 print:max-w-none print:p-0"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href={backHref} className="font-bold text-brand hover:underline">
            {backLabel}
          </Link>
          <PrintButton />
        </div>
        <ConsentCertificate record={record} />
      </main>
      <AppFooter variant="compact" />
    </div>
  );
}
