import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { customersUrlParams, type ListCustomersInput } from '@seedgw/contracts/customers';
import { PROVINCES } from '@seedgw/contracts/provinces';
import { provinceSlug, shortProvinceName } from '@seedgw/contracts/regions';
import { DataTableSkeleton } from '@seedgw/ui/data-table-skeleton';
import { CustomersTable } from '@/features/customers/components/customers-table';
import { can, requirePermission } from '@/server/auth/can';
import { listCustomerCropFilter, listCustomers } from '@/server/queries/customers';

export const metadata: Metadata = { title: 'Khách hàng' };

const BASE_PATH = '/kinh-doanh/khach-hang';
const PROVINCE_OPTIONS = PROVINCES.map((name) => ({
  value: provinceSlug(name),
  label: shortProvinceName(name),
}));

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CustomersPage({ searchParams }: PageProps) {
  const user = await requirePermission('sales.customer.read');
  const input = customersUrlParams.parse(await searchParams);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand">Khách hàng</h1>
        {can(user, 'sales.customer.create') ? (
          <Link
            href={`${BASE_PATH}/tao-moi`}
            className="inline-flex h-10 items-center rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover"
          >
            Thêm khách hàng
          </Link>
        ) : null}
      </div>
      <p className="mt-1 text-text-muted">
        Nông dân và hợp tác xã trong phạm vi bạn phụ trách. Nhân viên chọn khách hàng khi check-in
        loại Khách hàng trên app.
      </p>
      <Suspense fallback={<DataTableSkeleton columns={7} rows={8} />}>
        <CustomerResults input={input} />
      </Suspense>
    </>
  );
}

async function CustomerResults({ input }: { input: ListCustomersInput }) {
  const [data, crops] = await Promise.all([listCustomers(input), listCustomerCropFilter()]);
  return (
    <CustomersTable
      data={data}
      basePath={BASE_PATH}
      provinceOptions={PROVINCE_OPTIONS}
      cropOptions={crops.map((crop) => ({ value: crop, label: crop }))}
    />
  );
}
