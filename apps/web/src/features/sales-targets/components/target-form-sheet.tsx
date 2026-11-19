'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import {
  formatMonthLabel,
  upsertSalesTargetInput,
  type SalesTargetSnapshot,
} from '@seedgw/contracts/sales-targets';
import { Form } from '@seedgw/ui/form';
import { FormSheet } from '@seedgw/ui/form-sheet';
import { submitSalesTargetAction } from '@/server/actions/sales-targets';

type FormValues = z.input<typeof upsertSalesTargetInput>;

const PRIMARY_BUTTON =
  'inline-flex h-9.5 items-center rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover';
const SECONDARY_BUTTON =
  'inline-flex h-9.5 items-center rounded-md border border-border bg-surface px-4 font-bold hover:bg-brand-soft';

function TargetForm({
  month,
  current,
  forUserId,
  onDone,
}: {
  month: string;
  current: SalesTargetSnapshot | null;
  /** null là chỉ tiêu của chính mình; có giá trị khi Quản trị hệ thống gửi thay. */
  forUserId: string | null;
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
      action={(values) => submitSalesTargetAction(values, forUserId)}
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
          <TargetForm month={month} current={null} forUserId={null} onDone={() => setOpen(false)} />
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
          <TargetForm
            month={month}
            current={current}
            forUserId={null}
            onDone={() => setOpen(false)}
          />
        </FormSheet.Root>
      ) : null}
    </>
  );
}

type Option = { value: string; label: string };

/** Quản trị hệ thống sửa thay chỉ tiêu đã có của một nhân viên. */
export function TargetOnBehalfEditButton({
  forUserId,
  userLabel,
  month,
  current,
}: {
  forUserId: string;
  userLabel: string;
  month: string;
  current: SalesTargetSnapshot;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="text-sm font-bold text-brand hover:underline"
        onClick={() => setOpen(true)}
      >
        Sửa thay
      </button>
      {open ? (
        <FormSheet.Root
          title={`Sửa thay chỉ tiêu ${formatMonthLabel(month).toLowerCase()}`}
          onClose={() => setOpen(false)}
        >
          <p className="mb-3 rounded-md bg-warning-soft px-2.5 py-2">
            Sửa thay {userLabel}. Phiếu đứng tên nhân viên, đi đúng luồng duyệt của nhân viên đó.
          </p>
          <TargetForm
            month={month}
            current={current}
            forUserId={forUserId}
            onDone={() => setOpen(false)}
          />
        </FormSheet.Root>
      ) : null}
    </>
  );
}

/** Quản trị hệ thống đăng ký thay chỉ tiêu cho nhân viên chưa có chỉ tiêu tháng đó. */
export function TargetOnBehalfCreateButton({
  employees,
  months,
}: {
  employees: readonly Option[];
  months: readonly Option[];
}) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [month, setMonth] = useState(months[0]?.value ?? '');
  const control = 'h-9.5 w-full rounded-md border border-input bg-surface px-2.5';
  return (
    <>
      <button type="button" className={SECONDARY_BUTTON} onClick={() => setOpen(true)}>
        Đăng ký chỉ tiêu thay nhân viên
      </button>
      {open ? (
        <FormSheet.Root title="Đăng ký chỉ tiêu thay nhân viên" onClose={() => setOpen(false)}>
          <label className="block text-sm font-bold" htmlFor="on-behalf-user">
            Nhân viên
          </label>
          <select
            id="on-behalf-user"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className={control}
          >
            <option value="">Chọn nhân viên</option>
            {employees.map((employee) => (
              <option key={employee.value} value={employee.value}>
                {employee.label}
              </option>
            ))}
          </select>
          <label className="mt-3 block text-sm font-bold" htmlFor="on-behalf-month">
            Tháng
          </label>
          <select
            id="on-behalf-month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className={control}
          >
            {months.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <div className="mt-4">
            {userId && month ? (
              <TargetForm
                key={`${userId}-${month}`}
                month={month}
                current={null}
                forUserId={userId}
                onDone={() => setOpen(false)}
              />
            ) : (
              <p className="text-text-muted">Chọn nhân viên và tháng để nhập chỉ tiêu.</p>
            )}
          </div>
        </FormSheet.Root>
      ) : null}
    </>
  );
}
