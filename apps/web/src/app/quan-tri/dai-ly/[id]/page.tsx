import type { Metadata } from 'next';
import { DealerDetailPage } from '@/features/dealers/components/dealer-pages';

export const metadata: Metadata = { title: 'Hồ sơ đại lý' };

type PageProps = { params: Promise<{ id: string }> };

export default function QuanTriDealerPage({ params }: PageProps) {
  return <DealerDetailPage entry="admin.dealer.read" basePath="/quan-tri/dai-ly" params={params} />;
}
