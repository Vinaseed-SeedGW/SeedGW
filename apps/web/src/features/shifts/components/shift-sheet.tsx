'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import {
  WEEKDAY_OPTIONS,
  emptyShiftForm,
  formatShiftHours,
  isOvernight,
  shiftForm,
  shiftFormValues,
  timeToMinutes,
  updateShiftInput,
  type ShiftForm,
  type ShiftRow,
  type UpdateShiftInput,
} from '@dms/contracts/shifts';
import { Form } from '@dms/ui/form';
import { FormSheet } from '@dms/ui/form-sheet';
import { createShiftAction, updateShiftAction } from '@/server/actions/shifts';

function OvernightNote({ prefix }: { prefix: string }) {
  const [start, end] = useWatch({ name: [`${prefix}startTime`, `${prefix}endTime`] }) as [
    string,
    string,
  ];
  const startMinute = timeToMinutes(start ?? '');
  const endMinute = timeToMinutes(end ?? '');
  if (startMinute === null || endMinute === null || startMinute === endMinute) return null;
  const times = { startMinute, endMinute };
  if (!isOvernight(times)) return null;
  return (
    <p className="mt-2 rounded-md bg-brand-soft px-2.5 py-1.5 text-sm">
      Ca qua đêm: {formatShiftHours(times)}.
    </p>
  );
}

// prefix rong khi tao, la "shift." khi sua vi form sua boc them id va moc thoi gian.
function ShiftFields({ prefix }: { prefix: string }) {
  const name = (field: keyof ShiftForm) => `${prefix}${field}`;
  return (
    <>
      <div className="grid items-start gap-3.5 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <div>
          <Form.Field name={name('code')} label="Mã ca">
            <Form.Input autoComplete="off" maxLength={20} />
          </Form.Field>
        </div>
        <div>
          <Form.Field name={name('name')} label="Tên ca">
            <Form.Input autoComplete="off" />
          </Form.Field>
        </div>
      </div>
      <div className="mt-3.5 grid items-start gap-3.5 sm:grid-cols-2">
        <div>
          <Form.Field name={name('startTime')} label="Giờ vào" hint="Dạng giờ:phút, ví dụ 08:00">
            <Form.Input autoComplete="off" maxLength={5} />
          </Form.Field>
        </div>
        <div>
          <Form.Field name={name('endTime')} label="Giờ ra" hint="Nhỏ hơn giờ vào là ca qua đêm">
            <Form.Input autoComplete="off" maxLength={5} />
          </Form.Field>
        </div>
      </div>
      <OvernightNote prefix={prefix} />
      <div className="mt-3.5 grid items-start gap-3.5 sm:grid-cols-2">
        <div>
          <Form.Field name={name('breakStartTime')} label="Bắt đầu nghỉ giữa ca">
            <Form.Input autoComplete="off" maxLength={5} />
          </Form.Field>
        </div>
        <div>
          <Form.Field
            name={name('breakEndTime')}
            label="Kết thúc nghỉ giữa ca"
            hint="Để trống cả hai nếu ca không nghỉ"
          >
            <Form.Input autoComplete="off" maxLength={5} />
          </Form.Field>
        </div>
      </div>
      <div className="mt-3.5 grid items-start gap-3.5 sm:grid-cols-3">
        <div>
          <Form.Field name={name('lateGraceMinutes')} label="Cho phép đi muộn (phút)">
            <Form.Input type="number" inputMode="numeric" min={0} max={240} />
          </Form.Field>
        </div>
        <div>
          <Form.Field name={name('earlyGraceMinutes')} label="Cho phép về sớm (phút)">
            <Form.Input type="number" inputMode="numeric" min={0} max={240} />
          </Form.Field>
        </div>
        <div>
          <Form.Field name={name('workUnits')} label="Số công của ca">
            <Form.Input type="number" inputMode="decimal" min={0.25} max={3} step={0.25} />
          </Form.Field>
        </div>
      </div>
      <Form.CheckboxGroup
        name={name('workWeekdays')}
        label="Ngày làm việc trong tuần"
        hint="Ngày không chọn là ngày nghỉ của ca. Ngày lễ và ngày làm bù đặt ở tab Lịch nghỉ."
        options={WEEKDAY_OPTIONS}
      />
    </>
  );
}

export function ShiftSheetCreate({ onClose }: { onClose: () => void }) {
  const form = useForm<ShiftForm>({
    resolver: zodResolver(shiftForm),
    defaultValues: emptyShiftForm(),
  });

  return (
    <FormSheet.Root title="Tạo ca làm việc" onClose={onClose}>
      <Form.Root
        form={form}
        action={createShiftAction}
        successMessage="Đã tạo ca"
        onSuccess={onClose}
      >
        <ShiftFields prefix="" />
        <Form.Error />
        <Form.Actions>
          <Form.Submit>Tạo ca</Form.Submit>
          <FormSheet.Close>Huỷ</FormSheet.Close>
        </Form.Actions>
      </Form.Root>
    </FormSheet.Root>
  );
}

export function ShiftSheetEdit({ shift, onClose }: { shift: ShiftRow; onClose: () => void }) {
  const form = useForm<UpdateShiftInput>({
    resolver: zodResolver(updateShiftInput),
    defaultValues: {
      id: shift.id,
      expectedUpdatedAt: shift.updatedAt,
      shift: shiftFormValues(shift),
    },
  });

  return (
    <FormSheet.Root title={`Sửa ca ${shift.code}`} onClose={onClose}>
      <Form.Root
        form={form}
        action={updateShiftAction}
        successMessage="Đã lưu ca"
        onSuccess={onClose}
      >
        {shift.assignmentCount > 0 ? (
          <p className="mb-3 rounded-md bg-warning-soft px-2.5 py-2 text-sm">
            Ca đang được gán {shift.assignmentCount} lần. Thay đổi áp dụng cho mọi ngày công chưa
            chốt kỳ.
          </p>
        ) : null}
        <ShiftFields prefix="shift." />
        <Form.Error />
        <Form.Actions>
          <Form.Submit>Lưu</Form.Submit>
          <FormSheet.Close>Huỷ</FormSheet.Close>
        </Form.Actions>
      </Form.Root>
    </FormSheet.Root>
  );
}
