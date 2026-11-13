import type { Metadata } from 'next';
import { DealerDetailPage } from '@/features/dealers/components/dealer-pages';

export const metadata: Metadata = { title: 'Hồ sơ đại lý' };

type PageProps = { params: Promise<{ id: string }> };

export default function KinhDoanhDealerPage({ params }: PageProps) {
  return (
    <DealerDetailPage entry="sales.dealer.read" basePath="/kinh-doanh/dai-ly" params={params} />
  );
}
