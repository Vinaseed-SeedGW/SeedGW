'use client';

import { useActionState, useState } from 'react';
import { loginAction } from '@/server/actions/auth';

const LABEL_CLASS = 'mb-1 block text-sm font-bold';
const INPUT_CLASS = 'border-input h-9.5 w-full rounded-md border bg-surface px-2.5';

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [result, submit, pending] = useActionState(loginAction, null);
  // Giu ma nhan vien sau khi dang nhap sai, React tu xoa cac o khong kiem soat.
  const [employeeCode, setEmployeeCode] = useState('');

  return (
    <form action={submit}>
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
      <div className="mt-3.5">
        <label htmlFor="employeeCode" className={LABEL_CLASS}>
          Mã nhân viên
        </label>
        <input
          id="employeeCode"
          name="employeeCode"
          autoComplete="username"
          placeholder="Nhập mã nhân viên"
          value={employeeCode}
          onChange={(event) => setEmployeeCode(event.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <div className="mt-3.5">
        <label htmlFor="password" className={LABEL_CLASS}>
          Mật khẩu
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Nhập mật khẩu"
          className={INPUT_CLASS}
        />
      </div>
      {result && !result.ok ? (
        <p role="alert" className="mt-3.5 rounded-md bg-danger-soft px-2.5 py-2 text-danger">
          {result.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-5 h-9.5 w-full rounded-md bg-brand font-bold text-primary-foreground hover:bg-brand-hover disabled:opacity-70"
      >
        {pending ? 'Đang đăng nhập...' : 'Đăng nhập'}
      </button>
    </form>
  );
}
