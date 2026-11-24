'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { formatNumber } from '@seedgw/contracts/format';
import { shortProvinceName, type ProvinceRow, type RegionOption } from '@seedgw/contracts/regions';
import { DataTable, type ColumnDef } from '@seedgw/ui/data-table';
import { useToast } from '@seedgw/ui/toast';
import { setProvinceRegionAction } from '@/server/actions/regions';

const CONTROL = 'h-9.5 w-full min-w-48 rounded-md border border-input bg-surface px-2';

function RegionSelect({ row, regions }: { row: ProvinceRow; regions: RegionOption[] }) {
  const router = useRouter();
  const { actions: toast } = useToast();
  const [isPending, startTransition] = useTransition();
  return (
    <select
      className={CONTROL}
      aria-label={`Vùng của ${row.name}`}
      value={row.regionId ?? ''}
      disabled={isPending}
      onChange={(event) => {
        const regionId = event.target.value;
        startTransition(async () => {
          const result = await setProvinceRegionAction({ provinceName: row.name, regionId });
          if (!result.ok) {
            toast.show({ tone: 'error', message: result.message });
            return;
          }
          toast.show({
            tone: 'success',
            message: `Đã đổi vùng của ${shortProvinceName(row.name)}`,
          });
          router.refresh();
        });
      }}
    >
      {row.regionId ? null : <option value="">Chưa xếp vùng</option>}
      {regions.map((region) => (
        <option key={region.id} value={region.id}>
          {region.name}
        </option>
      ))}
    </select>
  );
}

function columns(regions: RegionOption[], canManage: boolean): ColumnDef<ProvinceRow>[] {
  const regionName = new Map(regions.map((region) => [region.id, region.name]));
  return [
    {
      accessorKey: 'name',
      header: 'Tỉnh',
      meta: { label: 'Tỉnh' },
      cell: ({ row }) => <span className="font-bold">{row.original.name}</span>,
    },
    {
      id: 'region',
      header: 'Vùng',
      meta: { label: 'Vùng' },
      cell: ({ row }) =>
        canManage ? (
          <RegionSelect row={row.original} regions={regions} />
        ) : (
          (regionName.get(row.original.regionId ?? '') ?? 'Chưa xếp vùng')
        ),
    },
    {
      id: 'dealers',
      header: 'Đại lý',
      meta: { label: 'Đại lý', className: 'text-right' },
      cell: ({ row }) => formatNumber(row.original.dealerCount),
    },
    {
      id: 'units',
      header: 'Đơn vị phụ trách',
      meta: { label: 'Đơn vị phụ trách', className: 'min-w-64 whitespace-normal!' },
      cell: ({ row }) =>
        row.original.orgUnitNames.length > 0 ? (
          row.original.orgUnitNames.join(', ')
        ) : (
          <span className="text-text-muted">Chưa có</span>
        ),
    },
  ];
}

function getId(row: ProvinceRow) {
  return row.name;
}

type Props = { rows: ProvinceRow[]; regions: RegionOption[]; canManage: boolean };

export function ProvincesTable({ rows, regions, canManage }: Props) {
  // Xếp theo thứ tự vùng, trong vùng giữ thứ tự tỉnh.
  const order = new Map(regions.map((region, index) => [region.id, index]));
  const sorted = [...rows].sort(
    (a, b) =>
      (order.get(a.regionId ?? '') ?? regions.length) -
      (order.get(b.regionId ?? '') ?? regions.length),
  );
  return (
    <DataTable.Root
      columns={columns(regions, canManage)}
      data={sorted}
      getRowId={getId}
      total={sorted.length}
      page={1}
      pageSize={Math.max(sorted.length, 1)}
    >
      <DataTable.Body emptyMessage="Chưa có tỉnh nào." />
    </DataTable.Root>
  );
}
