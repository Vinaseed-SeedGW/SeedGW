import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CertificatePage } from '@/features/consents/components/certificate-page';
import { getConsentRecord } from '@/server/queries/consents';

export const metadata: Metadata = { title: 'Giấy xác nhận đồng ý' };

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Trang in độc lập, không có menu. Chính chủ hoặc người quản lý tài khoản trong phạm vi mới mở được.
export default async function ConsentCertificateRoute({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const record = await getConsentRecord(id);
  if (!record) notFound();
  const fromAdmin = query.ve === 'quan-tri';
  return (
    <CertificatePage
      record={record}
      backHref={fromAdmin ? '/quan-tri/dong-y' : '/dong-y-cua-toi'}
      backLabel={fromAdmin ? 'Về Đồng ý dữ liệu cá nhân' : 'Về Đồng ý của tôi'}
    />
  );
}
