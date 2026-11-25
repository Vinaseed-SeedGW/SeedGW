import type { Metadata } from 'next';
import { FormPage } from '@seedgw/ui/form-page';
import { CustomerFormCreate } from '@/features/customers/components/customer-form';
import { requirePermission } from '@/server/auth/can';
import { getCustomerFormOptions } from '@/server/queries/customers';

export const metadata: Metadata = { title: 'Thêm khách hàng' };

export default async function NewCustomerPage() {
  await requirePermission('sales.customer.create');
  const options = await getCustomerFormOptions();
  return (
    <FormPage
      title="Thêm khách hàng"
      backHref="/kinh-doanh/khach-hang"
      backLabel="Về danh sách khách hàng"
    >
      <CustomerFormCreate users={options.users} listHref="/kinh-doanh/khach-hang" />
    </FormPage>
  );
}
