import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { CustomerProfile } from '@/features/customers/components/customer-profile';
import { can, requirePermission } from '@/server/auth/can';
import {
  getCustomer,
  getCustomerFormOptions,
  listCustomerVisits,
} from '@/server/queries/customers';

export const metadata: Metadata = { title: 'Hồ sơ khách hàng' };

type PageProps = { params: Promise<{ id: string }> };

export default async function CustomerPage({ params }: PageProps) {
  const user = await requirePermission('sales.customer.read');
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const [customer, options, visits] = await Promise.all([
    getCustomer(id.data),
    getCustomerFormOptions(),
    listCustomerVisits(id.data),
  ]);
  if (!customer) notFound();

  return (
    <CustomerProfile
      customer={customer}
      backHref="/kinh-doanh/khach-hang"
      dealerHref="/kinh-doanh/dai-ly"
      users={options.canUpdate ? options.users : null}
      visits={visits}
      canSeeVisits={can(user, 'sales.check-in.read')}
    />
  );
}
