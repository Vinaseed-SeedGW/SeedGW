'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  createCustomerInput,
  CROP_SUGGESTIONS,
  CUSTOMER_KIND_LABEL,
  customerKind,
  updateCustomerInput,
  type CustomerDetail,
  type CustomerOption,
} from '@seedgw/contracts/customers';
import { PROVINCES } from '@seedgw/contracts/provinces';
import { Form } from '@seedgw/ui/form';
import { createCustomerAction, updateCustomerAction } from '@/server/actions/customers';
import { DealerMultiPicker } from './dealer-multi-picker';

const KIND_OPTIONS = customerKind.options.map((value) => ({
  value,
  label: CUSTOMER_KIND_LABEL[value],
}));
const PROVINCE_OPTIONS = PROVINCES.map((name) => ({ value: name, label: name }));
const CROP_OPTIONS = CROP_SUGGESTIONS.map((name) => ({ value: name, label: name }));
const SUGGESTED = new Set<string>(CROP_SUGGESTIONS);

// Cây trồng ngoài danh sách gợi ý gõ ở ô riêng, cách nhau bằng dấu phẩy, gộp lại trước khi gửi.
const otherCropsField = z.string().trim().max(300, 'Tối đa 300 ký tự');

function splitCrops(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const createSchema = createCustomerInput.extend({ otherCrops: otherCropsField });
const updateSchema = updateCustomerInput.extend({ otherCrops: otherCropsField });

type CreateValues = z.input<typeof createSchema>;
type UpdateValues = z.input<typeof updateSchema>;

function Fields({
  users,
  initialDealers,
}: {
  users: CustomerOption[];
  initialDealers: CustomerOption[];
}) {
  return (
    <div className="grid gap-x-6 md:grid-cols-2">
      <div>
        <Form.Field name="kind" label="Loại khách hàng">
          <Form.ChoiceSelect options={KIND_OPTIONS} />
        </Form.Field>
        <Form.Field name="name" label="Tên khách hàng">
          <Form.Input autoComplete="off" />
        </Form.Field>
        <Form.Field name="phone" label="Số điện thoại">
          <Form.Input inputMode="tel" autoComplete="off" />
        </Form.Field>
        <Form.Field name="provinceName" label="Tỉnh, thành phố">
          <Form.Select options={PROVINCE_OPTIONS} emptyLabel="Chưa chọn" />
        </Form.Field>
        <Form.Field name="address" label="Địa chỉ" hint="Thôn, xã để nhân viên dễ tìm">
          <Form.Input autoComplete="off" />
        </Form.Field>
        <Form.Field
          name="assignedUserId"
          label="Nhân viên phụ trách"
          hint="Để trống thì bạn là người phụ trách"
        >
          <Form.Select options={users} emptyLabel="Tôi phụ trách" />
        </Form.Field>
      </div>
      <div>
        <Form.CheckboxGroup name="crops" label="Cây trồng" options={CROP_OPTIONS} />
        <Form.Field name="otherCrops" label="Cây trồng khác" hint="Cách nhau bằng dấu phẩy">
          <Form.Input autoComplete="off" />
        </Form.Field>
        <Form.Field
          name="areaHa"
          label="Diện tích canh tác (ha)"
          hint="Ví dụ 1,5. Để trống nếu chưa rõ"
        >
          <Form.Input inputMode="decimal" autoComplete="off" />
        </Form.Field>
        <DealerMultiPicker initial={initialDealers} />
        <Form.Field name="note" label="Ghi chú">
          <Form.Textarea rows={3} />
        </Form.Field>
      </div>
    </div>
  );
}

type CreateProps = { users: CustomerOption[]; listHref: string };

export function CustomerFormCreate({ users, listHref }: CreateProps) {
  const router = useRouter();
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      kind: 'FARMER',
      name: '',
      phone: '',
      provinceName: null,
      address: '',
      crops: [],
      otherCrops: '',
      areaHa: '',
      dealerIds: [],
      assignedUserId: null,
      note: '',
    },
  });

  return (
    <Form.Root
      form={form}
      action={(values) => {
        const { otherCrops, ...rest } = createSchema.parse(values);
        return createCustomerAction({ ...rest, crops: [...rest.crops, ...splitCrops(otherCrops)] });
      }}
      successMessage="Đã thêm khách hàng"
      onSuccess={(data) => router.push(`${listHref}/${data.id}`)}
    >
      <Fields users={users} initialDealers={[]} />
      <Form.Error />
      <Form.Actions>
        <Form.Submit>Thêm khách hàng</Form.Submit>
      </Form.Actions>
    </Form.Root>
  );
}

type EditProps = { customer: CustomerDetail; users: CustomerOption[] };

export function CustomerFormEdit({ customer, users }: EditProps) {
  const router = useRouter();
  const form = useForm<UpdateValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      id: customer.id,
      kind: customer.kind,
      name: customer.name,
      phone: customer.phone ?? '',
      provinceName: customer.provinceName as UpdateValues['provinceName'],
      address: customer.address,
      crops: customer.crops.filter((crop) => SUGGESTED.has(crop)),
      otherCrops: customer.crops.filter((crop) => !SUGGESTED.has(crop)).join(', '),
      areaHa: customer.areaHa === null ? '' : String(customer.areaHa).replace('.', ','),
      dealerIds: customer.dealers.map((dealer) => dealer.id),
      assignedUserId: customer.assignedUserId,
      note: customer.note ?? '',
    },
  });
  // Người phụ trách hiện tại có thể nằm ngoài danh sách được chọn, vẫn hiện để không mất giá trị.
  const userOptions =
    customer.assignedUserId && !users.some((user) => user.value === customer.assignedUserId)
      ? [
          { value: customer.assignedUserId, label: customer.assignedUserName ?? 'Người hiện tại' },
          ...users,
        ]
      : users;

  return (
    <Form.Root
      form={form}
      action={(values) => {
        const { otherCrops, ...rest } = updateSchema.parse(values);
        return updateCustomerAction({ ...rest, crops: [...rest.crops, ...splitCrops(otherCrops)] });
      }}
      successMessage="Đã lưu khách hàng"
      onSuccess={() => router.refresh()}
    >
      <Fields
        users={userOptions}
        initialDealers={customer.dealers.map((dealer) => ({
          value: dealer.id,
          label: dealer.code ? `${dealer.name}, ${dealer.code}` : dealer.name,
        }))}
      />
      <Form.Error />
      <Form.Actions>
        <Form.Submit>Lưu thay đổi</Form.Submit>
      </Form.Actions>
    </Form.Root>
  );
}
