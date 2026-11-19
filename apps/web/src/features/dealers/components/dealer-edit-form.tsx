'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import {
  DEALER_LEVEL_LABEL,
  DEALER_LEVELS,
  DEALER_STATUS_LABEL,
  updateDealerInput,
  type DealerDetail,
  type DealerFormOptions,
} from '@seedgw/contracts/dealers';
import { PROVINCES } from '@seedgw/contracts/provinces';
import { Form } from '@seedgw/ui/form';
import { updateDealerAction } from '@/server/actions/dealers';
import { DealerLocationPicker } from './dealer-location-picker';

type FormValues = z.input<typeof updateDealerInput>;

const LEVEL_OPTIONS = DEALER_LEVELS.map((level) => ({
  value: String(level),
  label: DEALER_LEVEL_LABEL[level],
}));
const STATUS_OPTIONS = (['ACTIVE', 'INACTIVE'] as const).map((value) => ({
  value,
  label: DEALER_STATUS_LABEL[value],
}));
const PROVINCE_OPTIONS = PROVINCES.map((name) => ({ value: name, label: name }));

type Props = { dealer: DealerDetail; options: DealerFormOptions };

/** Chỉ sửa trường thuộc SeedGW. Tên, mã FAST, mã số thuế thuộc FAST nên không sửa ở đây. */
export function DealerEditForm({ dealer, options }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(updateDealerInput),
    defaultValues: {
      id: dealer.id,
      level: String(dealer.level),
      status: dealer.status,
      parentCode: dealer.parent?.code ?? dealer.parent?.legacyCode ?? '',
      phone: dealer.phone ?? dealer.phoneRaw ?? '',
      ownerName: dealer.ownerName ?? '',
      ownerPhone: dealer.ownerPhone ?? '',
      address: dealer.address,
      provinceName: dealer.provinceName as FormValues['provinceName'],
      lat: dealer.lat === null ? '' : String(dealer.lat),
      lng: dealer.lng === null ? '' : String(dealer.lng),
      orgUnitId: dealer.orgUnitId ?? '',
      assignedUserId: dealer.assignedUserId,
    },
  });

  // Đơn vị hiện tại có thể nằm ngoài danh sách được chọn, vẫn hiện để không mất giá trị.
  const orgUnits =
    dealer.orgUnitId && !options.orgUnits.some((unit) => unit.value === dealer.orgUnitId)
      ? [
          { value: dealer.orgUnitId, label: dealer.orgUnitName ?? 'Đơn vị hiện tại' },
          ...options.orgUnits,
        ]
      : options.orgUnits;
  const users =
    dealer.assignedUserId && !options.users.some((user) => user.value === dealer.assignedUserId)
      ? [
          { value: dealer.assignedUserId, label: dealer.assignedUserName ?? 'Nhân viên hiện tại' },
          ...options.users,
        ]
      : options.users;

  return (
    <Form.Root
      form={form}
      action={(values) => updateDealerAction(values)}
      successMessage="Đã lưu đại lý"
    >
      <div className="grid gap-x-6 md:grid-cols-2">
        <div>
          <Form.Field name="level" label="Cấp đại lý">
            <Form.ChoiceSelect options={LEVEL_OPTIONS} />
          </Form.Field>
          <Form.Field
            name="parentCode"
            label="Đại lý cấp trên"
            hint="Nhập mã FAST hoặc mã hệ thống cũ, để trống nếu không có"
          >
            <Form.Input autoComplete="off" />
          </Form.Field>
          <Form.Field name="status" label="Trạng thái">
            <Form.ChoiceSelect options={STATUS_OPTIONS} />
          </Form.Field>
          <Form.Field
            name="phone"
            label="Số điện thoại"
            hint={
              dealer.phoneRaw
                ? `Số trên hệ thống cũ không đúng dạng: ${dealer.phoneRaw}`
                : undefined
            }
          >
            <Form.Input inputMode="tel" autoComplete="off" />
          </Form.Field>
          <Form.Field name="ownerName" label="Chủ đại lý">
            <Form.Input autoComplete="off" />
          </Form.Field>
          <Form.Field name="ownerPhone" label="Điện thoại chủ đại lý">
            <Form.Input inputMode="tel" autoComplete="off" />
          </Form.Field>
        </div>
        <div>
          <Form.Field name="address" label="Địa chỉ">
            <Form.Input autoComplete="off" />
          </Form.Field>
          <Form.Field name="provinceName" label="Tỉnh, thành phố">
            <Form.Select options={PROVINCE_OPTIONS} emptyLabel="Chưa chọn" />
          </Form.Field>
          <Form.Field
            name="lat"
            label="Vĩ độ"
            hint="Gõ tay, chọn trên bản đồ bên dưới, hoặc để lần check-in đầu tiên tại đại lý tự đề xuất"
          >
            <Form.Input inputMode="decimal" autoComplete="off" />
          </Form.Field>
          <Form.Field name="lng" label="Kinh độ">
            <Form.Input inputMode="decimal" autoComplete="off" />
          </Form.Field>
          <DealerLocationPicker dealer={dealer} tiles={options.mapTiles} />
          <Form.Field name="orgUnitId" label="Đơn vị phụ trách">
            <Form.ChoiceSelect options={orgUnits} />
          </Form.Field>
          <Form.Field name="assignedUserId" label="Nhân viên phụ trách">
            <Form.Select options={users} emptyLabel="Chờ gán" />
          </Form.Field>
        </div>
      </div>
      <Form.Error />
      <Form.Actions>
        <Form.Submit>Lưu</Form.Submit>
      </Form.Actions>
    </Form.Root>
  );
}
