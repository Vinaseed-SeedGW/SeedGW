'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import {
  saveFastConnectionInput,
  type FastConnectionView,
  type SaveFastConnectionInput,
} from '@seedgw/contracts/fast';
import { Form } from '@seedgw/ui/form';
import { saveFastConnectionAction, testFastConnectionAction } from '@/server/actions/fast';

/** Cấu hình kết nối FAST cho Quản trị hệ thống. Mật khẩu đã lưu không hiện lại, để trống là giữ nguyên. */
export function FastConnectionFormEdit({ connection }: { connection: FastConnectionView }) {
  const form = useForm<SaveFastConnectionInput>({
    resolver: zodResolver(saveFastConnectionInput),
    defaultValues: {
      baseUrl: connection.baseUrl,
      username: connection.username,
      password: '',
      enabled: connection.enabled,
    },
  });
  const [testing, startTest] = useTransition();
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  function test() {
    setTestResult(null);
    void form.handleSubmit((values) => {
      startTest(async () => {
        const result = await testFastConnectionAction(values);
        setTestResult(
          result.ok
            ? { ok: true, message: result.data.message }
            : { ok: false, message: result.message },
        );
      });
    })();
  }

  return (
    <Form.Root
      form={form}
      action={async (values) => {
        const result = await saveFastConnectionAction(values);
        if (result.ok) form.setValue('password', '');
        return result;
      }}
      successMessage="Đã lưu cấu hình kết nối FAST"
    >
      <Form.Field
        name="baseUrl"
        label="Địa chỉ API FAST"
        hint="FAST cấp, ví dụ https://api.fast.com.vn/vinaseed"
      >
        <Form.Input inputMode="url" autoComplete="off" />
      </Form.Field>
      <Form.Field name="username" label="Tên đăng nhập API">
        <Form.Input autoComplete="off" />
      </Form.Field>
      <Form.Field
        name="password"
        label="Mật khẩu API"
        hint={
          connection.passwordSet
            ? 'Đã lưu mật khẩu. Để trống là giữ mật khẩu cũ.'
            : 'FAST cấp cùng tên đăng nhập.'
        }
      >
        <Form.Input type="password" autoComplete="new-password" />
      </Form.Field>
      <Form.CheckboxField
        name="enabled"
        label="Bật đồng bộ danh mục khách hàng từ FAST"
        hint="Tắt thì worker không gọi FAST; dữ liệu đã đồng bộ giữ nguyên."
      />
      <Form.Error />
      {testResult ? (
        <p
          role="status"
          className={`mt-3.5 rounded-md px-2.5 py-2 ${testResult.ok ? 'bg-brand-soft text-brand' : 'bg-danger-soft text-danger'}`}
        >
          {testResult.message}
        </p>
      ) : null}
      <Form.Actions>
        <Form.Submit>Lưu cấu hình</Form.Submit>
        <button
          type="button"
          onClick={test}
          disabled={testing}
          className="h-9.5 rounded-md border border-brand bg-surface px-4 font-bold text-brand hover:bg-brand-soft disabled:opacity-70"
        >
          {testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
        </button>
      </Form.Actions>
    </Form.Root>
  );
}
