import { z } from 'zod';
import { MAX_EXPORT_ROWS, MAX_PAGE_SIZE, pageResult } from './common';

export const userStatus = z.enum(['ACTIVE', 'LOCKED']);
export type UserStatus = z.infer<typeof userStatus>;

export const userSummary = z.object({
  id: z.uuid(),
  employeeCode: z.string(),
  fullName: z.string(),
  orgUnitName: z.string().nullable(),
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

export const exportUsersInput = z.object({
  filter: listUsersInput.pick({ q: true, status: true, sort: true }),
  ids: z.array(z.uuid()).max(MAX_EXPORT_ROWS),
});
