'use client';

import { useId, useState } from 'react';
import { Form } from '@seedgw/ui/form';

/** Ô mật khẩu do quản trị đặt, dùng chung cho Tạo tài khoản và Đặt lại mật khẩu. */
export function AdminPasswordFields() {
  const [isVisible, setIsVisible] = useState(false);
  const toggleId = useId();
  const type = isVisible ? 'text' : 'password';

  return (
    <>
      <Form.Field
        name="password"
        label="Mật khẩu"
        hint="Ít nhất 8 ký tự, có chữ cái và chữ số, không chứa mã nhân viên."
      >
        <Form.Input type={type} autoComplete="new-password" />
      </Form.Field>
      <Form.Field name="confirmPassword" label="Nhập lại mật khẩu">
        <Form.Input type={type} autoComplete="new-password" />
      </Form.Field>
      <label htmlFor={toggleId} className="mt-2 flex w-fit cursor-pointer items-center gap-2">
        <input
          id={toggleId}
          type="checkbox"
          className="size-4 accent-brand"
          checked={isVisible}
          onChange={(event) => setIsVisible(event.target.checked)}
        />
        Hiện mật khẩu
      </label>
      <Form.CheckboxField
        name="mustChangePassword"
        label="Bắt đổi mật khẩu ở lần đăng nhập đầu"
        hint="Khi bật, người dùng phải đổi mật khẩu trên web rồi mới đăng nhập được app."
      />
    </>
  );
}
