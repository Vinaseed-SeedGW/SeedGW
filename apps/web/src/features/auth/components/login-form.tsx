'use client';

import { useActionState, useState } from 'react';
import { loginAction } from '@/server/actions/auth';

const FIELD_STYLE = {
  display: 'block',
  width: '100%',
  height: 38,
  marginTop: 4,
  padding: '0 10px',
};

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [result, submit, pending] = useActionState(loginAction, null);
  // Giu ma nhan vien sau khi dang nhap sai, React tu xoa cac o khong kiem soat.
  const [employeeCode, setEmployeeCode] = useState('');

  return (
    <form action={submit}>
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
      <p>
        <label htmlFor="employeeCode">Mã nhân viên</label>
        <input
          id="employeeCode"
          name="employeeCode"
          autoComplete="username"
          value={employeeCode}
          onChange={(event) => setEmployeeCode(event.target.value)}
          style={FIELD_STYLE}
        />
      </p>
      <p>
        <label htmlFor="password">Mật khẩu</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          style={FIELD_STYLE}
        />
      </p>
      {result && !result.ok ? <p role="alert">{result.message}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Đang đăng nhập...' : 'Đăng nhập'}
      </button>
    </form>
  );
}
