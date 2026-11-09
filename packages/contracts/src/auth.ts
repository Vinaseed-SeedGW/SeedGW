import { z } from 'zod';

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_FAILURE_WINDOW_MINUTES = 15;
export const LOGIN_LOCK_MINUTES = 15;
export const CHANGE_PASSWORD_PATH = '/doi-mat-khau';

export const loginInput = z.object({
  employeeCode: z.string().trim().toUpperCase().min(1, 'Vui lòng nhập mã nhân viên'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});
export type LoginInput = z.infer<typeof loginInput>;

// Gioi han do dai de tranh ton CPU khi bam mat khau qua dai.
export const passwordPolicy = z
  .string()
  .min(8, 'Mật khẩu cần ít nhất 8 ký tự')
  .max(128, 'Mật khẩu tối đa 128 ký tự')
  .regex(/\p{L}/u, 'Mật khẩu cần có ít nhất một chữ cái')
  .regex(/\d/, 'Mật khẩu cần có ít nhất một chữ số');

export const changePasswordInput = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    newPassword: passwordPolicy,
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu mới'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu nhập lại không khớp',
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    path: ['newPassword'],
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
  });
export type ChangePasswordInput = z.infer<typeof changePasswordInput>;
