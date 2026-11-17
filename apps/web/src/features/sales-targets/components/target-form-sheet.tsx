'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import {
  formatMonthLabel,
  upsertSalesTargetInput,
  type SalesTargetSnapshot,
} from '@dms/contracts/sales-targets';
import { Form } from '@dms/ui/form';
import { FormSheet } from '@dms/ui/form-sheet';
import { submitSalesTargetAction } from '@/server/actions/sales-targets';

type FormValues = z.input<typeof upsertSalesTargetInput>;

const PRIMARY_BUTTON =
  'inline-flex h-9.5 items-center rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover';
const SECONDARY_BUTTON =
  'inline-flex h-9.5 items-center rounded-md border border-border bg-surface px-4 font-bold hover:bg-brand-soft';

function TargetForm({
  month,
  current,
  onDone,
}: {
  month: string;
  current: SalesTargetSnapshot | null;
  onDone: () => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(upsertSalesTargetInput),
    defaultValues: {
      month,
      visitCountTarget: current?.visitCountTarget ?? 0,
      dealerCoverageTarget: current?.dealerCoverageTarget ?? 0,
      salesKgTarget: current?.salesKgTarget ?? 0,
      note: current?.note ?? '',
    },
  });
  return (
    <Form.Root
      form={form}
      action={(values) => submitSalesTargetAction(values)}
      successMessage="Đã gửi chỉ tiêu"
      onSuccess={onDone}
    >
      <Form.Field name="visitCountTarget" label="Lượt ghé thăm trong tháng">
        <Form.Input type="number" inputMode="numeric" min={1} step={1} />
      </Form.Field>
      <Form.Field name="dealerCoverageTarget" label="Số đại lý được ghé">
        <Form.Input type="number" inputMode="numeric" min={1} step={1} />
      </Form.Field>
      <Form.Field
        name="salesKgTarget"
        label="Thực bán (kg)"
        hint="Có % hoàn thành khi nối FAST. Để 0 nếu đơn vị chưa giao."
      >
        <Form.Input type="number" inputMode="decimal" min={0} step="any" />
      </Form.Field>
      <Form.Field name="note" label="Ghi chú (không bắt buộc)">
        <Form.Input maxLength={500} />
      </Form.Field>
      <Form.Error />
      <Form.Actions>
        <Form.Submit>Gửi duyệt</Form.Submit>
        <FormSheet.Close>Huỷ</FormSheet.Close>
      </Form.Actions>
    </Form.Root>
  );
}

/** Nút mở biểu mẫu đăng ký chỉ tiêu tháng chưa có. */
export function TargetRegisterButton({ month }: { month: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={PRIMARY_BUTTON} onClick={() => setOpen(true)}>
        Đăng ký chỉ tiêu
      </button>
      {open ? (
        <FormSheet.Root
          title={`Chỉ tiêu ${formatMonthLabel(month).toLowerCase()}`}
          onClose={() => setOpen(false)}
        >
          <TargetForm month={month} current={null} onDone={() => setOpen(false)} />
        </FormSheet.Root>
      ) : null}
    </>
  );
}

/** Nút mở biểu mẫu sửa chỉ tiêu đã có (đã duyệt, bị trả lại hoặc đã rút lại). */
export function TargetEditButton({
  month,
  current,
  hasApproved,
}: {
  month: string;
  current: SalesTargetSnapshot;
  hasApproved: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={SECONDARY_BUTTON} onClick={() => setOpen(true)}>
        Sửa chỉ tiêu
      </button>
      {open ? (
        <FormSheet.Root
          title={`Sửa chỉ tiêu ${formatMonthLabel(month).toLowerCase()}`}
          onClose={() => setOpen(false)}
        >
          {hasApproved ? (
            <p className="mb-3 rounded-md bg-warning-soft px-2.5 py-2">
              Bản sửa phải được duyệt lại. Trong lúc chờ, chỉ tiêu đã duyệt vẫn có hiệu lực.
            </p>
          ) : null}
          <TargetForm month={month} current={current} onDone={() => setOpen(false)} />
        </FormSheet.Root>
      ) : null}
    </>
  );
}
