import { z } from 'zod';
import { MAX_EXPORT_ROWS, MAX_PAGE_SIZE, pageResult } from './common';

export const userStatus = z.enum(['ACTIVE', 'LOCKED']);
export type UserStatus = z.infer<typeof userStatus>;

export const userSummary = z.object({
  id: z.uuid(),
  employeeCode: z.string(),
  fullName: z.string(),
  orgUnitName: z.string().nullable(),
  jobTitle: z.string().nullable(),
  roleNames: z.array(z.string()),
  status: userStatus,
  createdAt: z.iso.datetime(),
});
export type UserSummary = z.infer<typeof userSummary>;

const userSort = z.enum([
  'employeeCode',
  '-employeeCode',
  'fullName',
  '-fullName',
  'createdAt',
  '-createdAt',
]);

const DEFAULT_USER_SORT = 'employeeCode';
const USERS_PAGE_SIZE = 20;

export const listUsersInput = z.object({
  q: z.string().trim().max(100).optional(),
  status: userStatus.optional(),
  sort: userSort.default(DEFAULT_USER_SORT),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(MAX_PAGE_SIZE).default(USERS_PAGE_SIZE),
});
export type ListUsersInput = z.infer<typeof listUsersInput>;

export const listUsersResult = pageResult(userSummary);
export type ListUsersResult = z.infer<typeof listUsersResult>;

// Doi tham so tren URL sang dau vao cua ham. Gia tri sai thi dung mac dinh.
export const usersUrlParams = z
  .object({
    q: z.string().trim().max(100).optional().catch(undefined),
    'trang-thai': userStatus.optional().catch(undefined),
    'sap-xep': userSort.catch(DEFAULT_USER_SORT),
    trang: z.coerce.number().int().positive().max(1_000_000).catch(1),
  })
  .transform((url): ListUsersInput => ({
    q: url.q || undefined,
    status: url['trang-thai'],
    sort: url['sap-xep'],
    page: url.trang,
    pageSize: USERS_PAGE_SIZE,
  }));

export const employeeCodeField = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z0-9._-]{2,30}$/,
    'Mã nhân viên gồm 2 đến 30 ký tự: chữ không dấu, số, dấu chấm hoặc gạch',
  );

// Cac truong khong bat buoc giu kieu chuoi, chuoi rong duoc luu thanh null o may chu.
export const userProfileFields = {
  fullName: z
    .string()
    .trim()
    .min(2, 'Họ tên cần ít nhất 2 ký tự')
    .max(100, 'Họ tên tối đa 100 ký tự'),
  phone: z
    .string()
    .trim()
    .regex(/^(0\d{9,10})?$/, 'Số điện thoại gồm 10 hoặc 11 chữ số, bắt đầu bằng 0'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, 'Email quá dài')
    .refine((value) => value === '' || z.email().safeParse(value).success, 'Email không hợp lệ'),
  jobTitle: z.string().trim().max(100, 'Chức danh tối đa 100 ký tự'),
};

const userAssignmentFields = {
  hiredAt: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || z.iso.date().safeParse(value).success,
      'Ngày vào làm không hợp lệ, cần dạng dd/mm/yyyy',
    ),
  orgUnitId: z.uuid({ error: 'Vui lòng chọn đơn vị' }),
  managerId: z.uuid({ error: 'Quản lý trực tiếp không hợp lệ' }).nullable(),
  roleIds: z
    .array(z.uuid({ error: 'Vai trò không hợp lệ' }))
    .min(1, 'Vui lòng chọn ít nhất một vai trò')
    .max(20, 'Chọn tối đa 20 vai trò'),
};

export const createUserInput = z.object({
  employeeCode: employeeCodeField,
  ...userProfileFields,
  ...userAssignmentFields,
});
export type CreateUserInput = z.infer<typeof createUserInput>;

export const updateUserInput = z.object({
  id: z.uuid(),
  ...userProfileFields,
  ...userAssignmentFields,
});
export type UpdateUserInput = z.infer<typeof updateUserInput>;

export type SelectOption = { value: string; label: string };

export type UserFormOptions = {
  orgUnits: SelectOption[];
  managers: SelectOption[];
  roles: SelectOption[];
};

export const MAX_BULK_USERS = 500;

export const setUsersActiveInput = z.object({
  ids: z.array(z.uuid()).min(1).max(MAX_BULK_USERS, `Chỉ xử lý tối đa ${MAX_BULK_USERS} dòng`),
  isActive: z.boolean(),
});

export const mobileDeviceStatus = z.enum(['PENDING', 'ACTIVE', 'REVOKED']);
export type MobileDeviceStatus = z.infer<typeof mobileDeviceStatus>;

export const MOBILE_DEVICE_STATUS_LABEL: Record<MobileDeviceStatus, string> = {
  PENDING: 'Chờ duyệt',
  ACTIVE: 'Đang dùng',
  REVOKED: 'Đã thu hồi',
};

export const setMobileDeviceStatusInput = z.object({
  deviceId: z.uuid(),
  status: z.enum(['ACTIVE', 'REVOKED']),
});

export type UserDevice = {
  id: string;
  name: string;
  platform: string;
  status: MobileDeviceStatus;
  lastSeenAt: string | null;
  /** M5: null là app chưa báo (bản cũ). */
  isRooted: boolean | null;
  createdAt: string;
};

// Do may chu tinh, giao dien chi dung de an hien nut.
export type UserAllowedActions = {
  edit: boolean;
  lock: boolean;
  resetPassword: boolean;
  impersonate: boolean;
};

export type UserDetail = {
  id: string;
  employeeCode: string;
  fullName: string;
  phone: string;
  email: string;
  jobTitle: string;
  hiredAt: string;
  orgUnitId: string | null;
  managerId: string | null;
  roleIds: string[];
  roleNames: string[];
  status: UserStatus;
  mustChangePassword: boolean;
  loginLockedUntil: string | null;
  devices: UserDevice[];
  allowed: UserAllowedActions;
};

export type CreatedUser = { id: string; employeeCode: string; temporaryPassword: string };

export const exportUsersInput = z.object({
  filter: listUsersInput.pick({ q: true, status: true, sort: true }),
  ids: z.array(z.uuid()).max(MAX_EXPORT_ROWS),
});
