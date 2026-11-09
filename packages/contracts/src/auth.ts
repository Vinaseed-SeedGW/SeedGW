import { z } from 'zod';

export const loginInput = z.object({
  employeeCode: z.string().trim().min(1, 'Vui lòng nhập mã nhân viên'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});
export type LoginInput = z.infer<typeof loginInput>;
