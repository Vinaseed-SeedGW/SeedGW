import type { Metadata } from 'next';
import { DealerCreatePage } from '@/features/dealers/components/dealer-create-page';
import { requirePermission } from '@/server/auth/can';

export const metadata: Metadata = { title: 'Thêm đại lý' };

export default async function KinhDoanhNewDealerPage() {
  await requirePermission('sales.dealer.propose');
  return <DealerCreatePage basePath="/kinh-doanh/dai-ly" />;
}
