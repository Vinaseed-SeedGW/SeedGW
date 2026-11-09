'use client';

import type { UserFormOptions } from '@dms/contracts/users';
import { Form } from '@dms/ui/form';

export function UserProfileFields({ options }: { options: UserFormOptions }) {
  return (
    <>
      <Form.Field name="fullName" label="Họ tên">
        <Form.Input autoComplete="off" />
      </Form.Field>
      <Form.Field name="phone" label="Số điện thoại">
        <Form.Input inputMode="tel" autoComplete="off" />
      </Form.Field>
      <Form.Field name="email" label="Email">
        <Form.Input type="email" autoComplete="off" />
      </Form.Field>
      <Form.Field name="orgUnitId" label="Đơn vị">
        <Form.Select options={options.orgUnits} emptyLabel="Chọn đơn vị" />
      </Form.Field>
      <Form.Field name="jobTitle" label="Chức danh">
        <Form.Input autoComplete="off" />
      </Form.Field>
      <Form.Field name="hiredAt" label="Ngày vào làm">
        <Form.Input type="date" />
      </Form.Field>
      <Form.Field name="managerId" label="Quản lý trực tiếp">
        <Form.Select options={options.managers} emptyLabel="Không có" />
      </Form.Field>
      <Form.CheckboxGroup name="roleIds" label="Vai trò" options={options.roles} />
    </>
  );
}
