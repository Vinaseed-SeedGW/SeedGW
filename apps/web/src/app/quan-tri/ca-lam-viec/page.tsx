import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { vietnamToday } from '@dms/contracts/format';
import { shiftsUrlParams } from '@dms/contracts/shifts';
import { cn } from '@dms/ui/cn';
import { DataTableSkeleton } from '@dms/ui/data-table-skeleton';
import {
  AssignmentsTableManaged,
  AssignmentsTableReadOnly,
} from '@/features/shifts/components/assignments-table';
import {
  HolidaysPanelManaged,
  HolidaysPanelReadOnly,
} from '@/features/shifts/components/holidays-panel';
import { ShiftsTableManaged, ShiftsTableReadOnly } from '@/features/shifts/components/shifts-table';
import { WorkdayLookup } from '@/features/shifts/components/workday-lookup';
import { can, requirePermission } from '@/server/auth/can';
import {
  getShiftFormOptions,
  listAssignments,
  listHolidays,
  listShifts,
} from '@/server/queries/shifts';

export const metadata: Metadata = { title: 'Ca làm việc' };

const BASE_PATH = '/quan-tri/ca-lam-viec';

const TABS = [
  { key: 'ca', label: 'Ca làm việc', href: BASE_PATH },
  { key: 'gan-ca', label: 'Gán ca', href: `${BASE_PATH}?tab=gan-ca` },
  { key: 'lich-nghi', label: 'Lịch nghỉ', href: `${BASE_PATH}?tab=lich-nghi` },
] as const;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ShiftsPage({ searchParams }: PageProps) {
  const user = await requirePermission('admin.shift.read');
  const { tab, page, pageSize, year } = shiftsUrlParams(vietnamToday()).parse(await searchParams);
  const canManage = can(user, 'admin.shift.manage');

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Ca làm việc</h1>
      <p className="mt-1 text-text-muted">
        Khai báo ca, gán ca cho đơn vị hoặc từng nhân viên và đặt lịch nghỉ lễ. Đây là căn cứ để
        tính ngày công từ Vào ca, Ra ca.
      </p>
      <nav className="mt-3 flex gap-1 border-b border-border" aria-label="Nội dung trang">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={tab === item.key ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 font-bold',
              tab === item.key ? 'border-brand text-brand' : 'border-transparent text-text-muted',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-4">
        {tab === 'gan-ca' ? (
          <Suspense key={page} fallback={<DataTableSkeleton columns={4} rows={6} />}>
            <AssignmentResults page={page} pageSize={pageSize} canManage={canManage} />
          </Suspense>
        ) : tab === 'lich-nghi' ? (
          <Suspense key={year} fallback={<p className="text-text-muted">Đang tải lịch nghỉ...</p>}>
            <HolidayResults year={year} canManage={canManage} />
          </Suspense>
        ) : (
          <Suspense key={page} fallback={<DataTableSkeleton columns={7} rows={4} />}>
            <ShiftResults page={page} pageSize={pageSize} canManage={canManage} />
          </Suspense>
        )}
      </div>
    </>
  );
}

type ResultsProps = { page: number; pageSize: number; canManage: boolean };

async function ShiftResults({ page, pageSize, canManage }: ResultsProps) {
  const data = await listShifts({ page, pageSize });
  return canManage ? <ShiftsTableManaged data={data} /> : <ShiftsTableReadOnly data={data} />;
}

async function AssignmentResults({ page, pageSize, canManage }: ResultsProps) {
  const [data, options] = await Promise.all([
    listAssignments({ page, pageSize }),
    getShiftFormOptions(),
  ]);
  return (
    <>
      {canManage ? (
        <AssignmentsTableManaged data={data} options={options} />
      ) : (
        <AssignmentsTableReadOnly data={data} />
      )}
      <WorkdayLookup users={options.users} />
    </>
  );
}

async function HolidayResults({ year, canManage }: { year: number; canManage: boolean }) {
  const holidays = await listHolidays(year);
  return canManage ? (
    <HolidaysPanelManaged year={year} holidays={holidays} />
  ) : (
    <HolidaysPanelReadOnly year={year} holidays={holidays} />
  );
}
