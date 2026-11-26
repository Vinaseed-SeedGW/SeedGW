'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm, useFormContext, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import {
  createDealerWebInput,
  DEFAULT_PROPOSED_LEVEL,
  type CreateDealerWebResult,
  type DealerProposalOptions,
} from '@seedgw/contracts/dealer-proposals';
import {
  DEALER_LEVEL_LABEL,
  DEALER_LEVELS,
  userFitsUnit,
  type DealerFormOptions,
} from '@seedgw/contracts/dealers';
import { PROVINCES, type ProvinceName } from '@seedgw/contracts/provinces';
import { Form } from '@seedgw/ui/form';
import { createDealerWebAction } from '@/server/actions/dealer-proposals';
import { DealerLocationPicker } from './dealer-location-picker';

// Thêm đại lý trên web (26/11/2026). Quản trị chọn đơn vị và nhân viên phụ trách; người khác thêm thì đại lý
// thuộc đơn vị của mình, nhân viên chờ duyệt như đề xuất trên app.

type FormValues = z.input<typeof createDealerWebInput>;

const LEVEL_OPTIONS = DEALER_LEVELS.map((level) => ({
  value: String(level),
  label: DEALER_LEVEL_LABEL[level],
}));
const PROVINCE_OPTIONS = PROVINCES.map((name) => ({ value: name, label: name }));
const NEW_DEALER = { lat: null, lng: null, lastCheckInPoint: null, provinceName: null };

const DEFAULT_VALUES: FormValues = {
  name: '',
  phone: '',
  address: '',
  ownerName: '',
  taxCode: '',
  level: String(DEFAULT_PROPOSED_LEVEL),
  provinceName: null,
  wardName: '',
  lat: '',
  lng: '',
  orgUnitId: '',
  assignedUserId: null,
};

type Common = {
  /** Đường dẫn danh sách đại lý của bộ phận, để mở hồ sơ đại lý vừa tạo. */
  basePath: string;
  mapTiles: DealerFormOptions['mapTiles'];
};

function useDealerCreateForm(): UseFormReturn<FormValues> {
  return useForm<FormValues>({
    resolver: zodResolver(createDealerWebInput),
    defaultValues: DEFAULT_VALUES,
  });
}

/** Sau khi lưu: mở hồ sơ đại lý đã tạo hoặc đại lý có sẵn; chờ duyệt thì mở trang Đại lý đề xuất. */
function useAfterSave(basePath: string): (data: CreateDealerWebResult) => void {
  const router = useRouter();
  return (data) => {
    router.push(data.dealerId ? `${basePath}/${data.dealerId}` : '/kinh-doanh/dai-ly/de-xuat');
  };
}

function InfoFields() {
  return (
    <>
      <Form.Field name="name" label="Tên đại lý">
        <Form.Input autoComplete="off" />
      </Form.Field>
      <Form.Field name="phone" label="Số điện thoại" hint="10 số, bắt đầu bằng 0">
        <Form.Input inputMode="tel" autoComplete="off" />
      </Form.Field>
      <Form.Field name="ownerName" label="Chủ đại lý">
        <Form.Input autoComplete="off" />
      </Form.Field>
      <Form.Field name="taxCode" label="Mã số thuế" hint="Không bắt buộc">
        <Form.Input inputMode="numeric" autoComplete="off" />
      </Form.Field>
      <Form.Field name="level" label="Cấp đại lý">
        <Form.ChoiceSelect options={LEVEL_OPTIONS} />
      </Form.Field>
    </>
  );
}

type WardList = Record<ProvinceName, readonly string[]>;

/** Danh sách xã, phường (82 KB) chỉ tải khi mở form, không nằm trong gói chung của trang. */
function useWardList(): WardList | null {
  const [wards, setWards] = useState<WardList | null>(null);
  useEffect(() => {
    let active = true;
    void import('@seedgw/contracts/wards').then((module) => {
      if (active) setWards(module.WARDS);
    });
    return () => {
      active = false;
    };
  }, []);
  return wards;
}

/**
 * Địa chỉ theo đơn vị hành chính từ 01/07/2025: tỉnh, xã, phường (không còn huyện), rồi số nhà, thôn, đường.
 * Đổi tỉnh thì bỏ xã không thuộc tỉnh mới. Toạ độ không bắt buộc vì người thêm có thể ở xa đại lý.
 */
function PlaceFields({ mapTiles }: { mapTiles: DealerFormOptions['mapTiles'] }) {
  const form = useFormContext<FormValues>();
  const listId = useId();
  const wards = useWardList();
  const provinceName = form.watch('provinceName');
  const options = provinceName && wards ? wards[provinceName] : [];

  useEffect(() => {
    if (!wards) return;
    const ward = form.getValues('wardName');
    if (ward && !(provinceName && wards[provinceName]?.includes(ward))) {
      form.setValue('wardName', '');
    }
  }, [form, provinceName, wards]);

  return (
    <>
      <Form.Field name="provinceName" label="Tỉnh, thành phố">
        <Form.Select options={PROVINCE_OPTIONS} emptyLabel="Chọn tỉnh, thành phố" />
      </Form.Field>
      <Form.Field
        name="wardName"
        label="Xã, phường"
        hint={
          provinceName
            ? 'Không bắt buộc. Gõ vài chữ để chọn trong danh sách xã, phường mới từ 01/07/2025'
            : 'Chọn tỉnh trước'
        }
      >
        <Form.Input list={listId} autoComplete="off" disabled={!provinceName} />
      </Form.Field>
      <datalist id={listId}>
        {options.map((ward) => (
          <option key={ward} value={ward} />
        ))}
      </datalist>
      <Form.Field name="address" label="Địa chỉ đại lý" hint="Số nhà, thôn, xóm, đường">
        <Form.Input autoComplete="off" />
      </Form.Field>
      <Form.Field
        name="lat"
        label="Vĩ độ"
        hint="Không bắt buộc. Ở xa đại lý hoặc không biết vị trí thì bỏ trống, lần check-in đầu tiên tại đại lý sẽ tự đề xuất toạ độ"
      >
        <Form.Input inputMode="decimal" autoComplete="off" />
      </Form.Field>
      <Form.Field name="lng" label="Kinh độ">
        <Form.Input inputMode="decimal" autoComplete="off" />
      </Form.Field>
      <DealerLocationPicker dealer={NEW_DEALER} tiles={mapTiles} />
    </>
  );
}

/**
 * Đơn vị và nhân viên phụ trách cho Quản trị. Chọn tỉnh thì gợi ý đơn vị phụ trách tỉnh đó (K7b); đổi đơn vị
 * thì bỏ nhân viên không thuộc đơn vị mới.
 */
function AssignFields({
  orgUnits,
  users,
  provinceUnits,
}: Pick<DealerProposalOptions, 'orgUnits' | 'users' | 'provinceUnits'>) {
  const form = useFormContext<FormValues>();
  const provinceName = form.watch('provinceName');
  const orgUnitId = form.watch('orgUnitId') ?? '';
  const lastProvince = useRef(provinceName);

  useEffect(() => {
    if (provinceName === lastProvince.current) return;
    lastProvince.current = provinceName;
    if (!provinceName || form.getValues('orgUnitId')) return;
    const suggested = (provinceUnits[provinceName] ?? []).find((id) =>
      orgUnits.some((unit) => unit.value === id),
    );
    if (suggested) form.setValue('orgUnitId', suggested, { shouldDirty: true });
  }, [form, provinceName, provinceUnits, orgUnits]);

  const fitting = users.filter((user) => userFitsUnit(user, orgUnitId));
  useEffect(() => {
    const current = form.getValues('assignedUserId');
    if (current && !users.some((user) => user.value === current && userFitsUnit(user, orgUnitId))) {
      form.setValue('assignedUserId', null);
    }
  }, [form, orgUnitId, users]);

  return (
    <>
      <Form.Field
        name="orgUnitId"
        label="Đơn vị phụ trách"
        hint="Chọn tỉnh trước thì tự gợi ý đơn vị phụ trách tỉnh đó"
      >
        <Form.Select options={orgUnits} emptyLabel="Chọn đơn vị" />
      </Form.Field>
      <Form.Field
        name="assignedUserId"
        label="Nhân viên phụ trách"
        hint="Chỉ nhân viên thuộc đơn vị phụ trách hoặc đơn vị con"
      >
        <Form.Select options={fitting} emptyLabel="Chờ gán" />
      </Form.Field>
    </>
  );
}

type AssignProps = Common & Pick<DealerProposalOptions, 'orgUnits' | 'users' | 'provinceUnits'>;

/** Quản trị đơn vị, Quản trị hệ thống: tạo đại lý luôn, chọn đơn vị và nhân viên phụ trách. */
export function DealerCreateFormAssign({
  basePath,
  mapTiles,
  orgUnits,
  users,
  provinceUnits,
}: AssignProps) {
  const form = useDealerCreateForm();
  const afterSave = useAfterSave(basePath);
  return (
    <Form.Root
      form={form}
      action={(values) => createDealerWebAction(values)}
      successMessage={(data) => data.message}
      onSuccess={afterSave}
    >
      <p className="mb-4 max-w-3xl text-text-muted">
        Đại lý được tạo ngay, chưa có mã FAST. Trùng số điện thoại hoặc mã số thuế với đại lý có sẵn
        thì không tạo mới mà mở đại lý đó.
      </p>
      <div className="grid gap-x-6 md:grid-cols-2">
        <div>
          <InfoFields />
        </div>
        <div>
          <PlaceFields mapTiles={mapTiles} />
          <AssignFields orgUnits={orgUnits} users={users} provinceUnits={provinceUnits} />
        </div>
      </div>
      <Form.Error />
      <Form.Actions>
        <Form.Submit>Thêm đại lý</Form.Submit>
      </Form.Actions>
    </Form.Root>
  );
}

type OwnUnitProps = Common & {
  /** Câu báo trước khi lưu: tạo luôn, hay chờ ai duyệt. */
  note: string;
  submitLabel: string;
};

/** Quản lý, Lãnh đạo đơn vị (tạo luôn) và nhân viên (chờ duyệt): đại lý thuộc đơn vị của người thêm. */
export function DealerCreateFormOwnUnit({ basePath, mapTiles, note, submitLabel }: OwnUnitProps) {
  const form = useDealerCreateForm();
  const afterSave = useAfterSave(basePath);
  return (
    <Form.Root
      form={form}
      action={(values) => createDealerWebAction(values)}
      successMessage={(data) => data.message}
      onSuccess={afterSave}
    >
      <p className="mb-4 max-w-3xl text-text-muted">{note}</p>
      <div className="grid gap-x-6 md:grid-cols-2">
        <div>
          <InfoFields />
        </div>
        <div>
          <PlaceFields mapTiles={mapTiles} />
        </div>
      </div>
      <Form.Error />
      <Form.Actions>
        <Form.Submit>{submitLabel}</Form.Submit>
      </Form.Actions>
    </Form.Root>
  );
}
