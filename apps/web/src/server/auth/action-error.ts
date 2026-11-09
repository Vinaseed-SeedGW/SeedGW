import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import type { ActionResult } from '@dms/contracts/common';
import type { z } from 'zod';
import { ForbiddenError } from './can';

export function validationError(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.');
    fieldErrors[path] ??= issue.message;
  }
  return {
    ok: false,
    code: 'VALIDATION',
    message: 'Vui lòng kiểm tra lại thông tin đã nhập',
    fieldErrors,
  };
}

export function toActionError(error: unknown): ActionResult<never> {
  // Next.js dung loi noi bo de chuyen huong, phai nem lai de khong nuot mat.
  unstable_rethrow(error);

  if (error instanceof ForbiddenError) {
    return { ok: false, code: 'FORBIDDEN', message: 'Bạn không có quyền thực hiện thao tác này' };
  }
  console.error(error);
  return { ok: false, code: 'INTERNAL', message: 'Đã xảy ra lỗi, vui lòng thử lại' };
}
