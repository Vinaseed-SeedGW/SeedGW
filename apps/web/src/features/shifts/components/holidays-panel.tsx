'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { formatDateOnly } from '@dms/contracts/format';
import {
  HOLIDAY_KIND_LABEL,
  HOLIDAY_KIND_OPTIONS,
  WEEKDAY_LABEL,
  createHolidayInput,
  weekdayOf,
  type CreateHolidayInput,
  type HolidayKind,
  type HolidayRow,
} from '@dms/contracts/shifts';
import { cn } from '@dms/ui/cn';
import { ConfirmDialog } from '@dms/ui/confirm-dialog';
import { Form } from '@dms/ui/form';
import { FormSheet } from '@dms/ui/form-sheet';
import { createHolidayAction, deleteHolidayAction } from '@/server/actions/shifts';

const KIND_CLASS: Record<HolidayKind, string> = {
  HOLIDAY: 'bg-brand-soft text-brand',
  MAKEUP_WORKDAY: 'bg-warning-soft text-text',
};

const YEAR_LINK_CLASS =
  'inline-flex h-9 items-center rounded-md border border-border px-3 font-bold text-brand hover:bg-brand-soft';

function HolidaySheet({ onClose }: { onClose: () => void }) {
  const form = useForm<CreateHolidayInput>({
    resolver: zodResolver(createHolidayInput),
    defaultValues: { startDate: '', endDate: '', name: '', kind: 'HOLIDAY' },
  });

  return (
    <FormSheet.Root title="Thêm vào lịch nghỉ" onClose={onClose}>
      <Form.Root
        form={form}
        action={createHolidayAction}
        successMessage="Đã thêm vào lịch nghỉ"
        onSuccess={onClose}
      >
        <Form.Field name="kind" label="Loại ngày">
          <Form.ChoiceSelect options={HOLIDAY_KIND_OPTIONS} />
        </Form.Field>
        <Form.Field name="name" label="Tên" hint="Ví dụ: Tết Nguyên đán, Quốc khánh">
          <Form.Input autoComplete="off" />
        </Form.Field>
        <Form.Field name="startDate" label="Từ ngày">
          <Form.DateInput />
        </Form.Field>
        <Form.Field name="endDate" label="Đến ngày" hint="Để trống nếu chỉ một ngày">
          <Form.DateInput />
        </Form.Field>
        <Form.Error />
        <Form.Actions>
          <Form.Submit>Thêm</Form.Submit>
          <FormSheet.Close>Huỷ</FormSheet.Close>
        </Form.Actions>
      </Form.Root>
    </FormSheet.Root>
  );
}

type HolidayListProps = {
  year: number;
  holidays: HolidayRow[];
  onDelete?: (holiday: HolidayRow) => void;
};

function HolidayList({ year, holidays, onDelete }: HolidayListProps) {
  if (holidays.length === 0) {
    return (
      <p className="mt-3 text-text-muted">Chưa có ngày nghỉ lễ hoặc làm bù nào trong năm {year}.</p>
    );
  }
  return (
    <ul className="mt-3 divide-y divide-border rounded-md border border-border bg-surface">
      {holidays.map((holiday) => (
        <li key={holiday.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
          <span className="w-28 flex-none font-bold">{formatDateOnly(holiday.date)}</span>
          <span className="w-20 flex-none text-sm text-text-muted">
            {WEEKDAY_LABEL[weekdayOf(holiday.date)]}
          </span>
          <span className="min-w-0 flex-1">{holiday.name}</span>
          <span
            className={cn('rounded-full px-2 py-0.5 text-xs font-bold', KIND_CLASS[holiday.kind])}
          >
            {HOLIDAY_KIND_LABEL[holiday.kind]}
          </span>
          {onDelete ? (
            <button
              type="button"
              className="min-h-11 text-sm text-brand md:min-h-0"
              aria-label={`Xoá ${holiday.name} ngày ${formatDateOnly(holiday.date)}`}
              onClick={() => onDelete(holiday)}
            >
              Xoá
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function YearNav({ year }: { year: number }) {
  return (
    <nav aria-label="Chọn năm" className="flex items-center gap-2">
      <Link href={`?tab=lich-nghi&nam=${year - 1}`} className={YEAR_LINK_CLASS}>
        Năm {year - 1}
      </Link>
      <h2 className="px-2 text-lg font-bold text-brand">Năm {year}</h2>
      <Link href={`?tab=lich-nghi&nam=${year + 1}`} className={YEAR_LINK_CLASS}>
        Năm {year + 1}
      </Link>
    </nav>
  );
}

type PanelProps = { year: number; holidays: HolidayRow[] };

export function HolidaysPanelReadOnly({ year, holidays }: PanelProps) {
  return (
    <>
      <YearNav year={year} />
      <HolidayList year={year} holidays={holidays} />
    </>
  );
}

export function HolidaysPanelManaged({ year, holidays }: PanelProps) {
  const [isCreating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<HolidayRow | null>(null);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <YearNav year={year} />
        <button
          type="button"
          className="h-9 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover"
          onClick={() => setCreating(true)}
        >
          Thêm ngày
        </button>
      </div>
      <p className="mt-2 text-sm text-text-muted">
        Ngày nghỉ lễ không tính là ngày phải làm. Ngày làm bù là ngày phải làm dù rơi vào ngày nghỉ
        trong tuần của ca.
      </p>
      <HolidayList year={year} holidays={holidays} onDelete={setDeleting} />
      {isCreating ? <HolidaySheet onClose={() => setCreating(false)} /> : null}
      {deleting ? (
        <ConfirmDialog
          title="Xoá khỏi lịch nghỉ"
          confirmLabel="Xoá"
          tone="danger"
          successMessage="Đã xoá khỏi lịch nghỉ"
          onConfirm={() => deleteHolidayAction({ id: deleting.id })}
          onClose={() => setDeleting(null)}
        >
          Xoá <b>{deleting.name}</b> ngày {formatDateOnly(deleting.date)} khỏi lịch nghỉ?
        </ConfirmDialog>
      ) : null}
    </>
  );
}
