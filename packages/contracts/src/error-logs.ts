import { z } from 'zod';
import { pageResult } from './common';

// F9: lỗi tự ghi của web, app, worker, xem ở Quản trị › Lỗi hệ thống.

export const errorSource = z.enum(['WEB_SERVER', 'WEB_CLIENT', 'MOBILE', 'WORKER']);
export type ErrorSource = z.infer<typeof errorSource>;

export const ERROR_SOURCE_LABEL: Record<ErrorSource, string> = {
  WEB_SERVER: 'Máy chủ web',
  WEB_CLIENT: 'Trình duyệt',
  MOBILE: 'App điện thoại',
  WORKER: 'Worker chạy nền',
};

const SOURCE_SLUG: Record<ErrorSource, string> = {
  WEB_SERVER: 'may-chu',
  WEB_CLIENT: 'trinh-duyet',
  MOBILE: 'app',
  WORKER: 'worker',
};

export const ERROR_SOURCE_OPTIONS = errorSource.options.map((value) => ({
  value: SOURCE_SLUG[value],
  label: ERROR_SOURCE_LABEL[value],
}));

export const errorLogRow = z.object({
  id: z.uuid(),
  source: errorSource,
  message: z.string(),
  stack: z.string().nullable(),
  path: z.string().nullable(),
  appVersion: z.string().nullable(),
  userName: z.string().nullable(),
  count: z.number().int(),
  firstSeenAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().nullable(),
});
export type ErrorLogRow = z.infer<typeof errorLogRow>;

export type ListErrorLogsInput = {
  source?: ErrorSource;
  resolved: boolean;
  page: number;
  pageSize: number;
};

export const listErrorLogsResult = pageResult(errorLogRow);
export type ListErrorLogsResult = z.infer<typeof listErrorLogsResult>;

export const errorLogsUrlParams = z
  .object({
    nguon: z.enum(['may-chu', 'trinh-duyet', 'app', 'worker']).optional().catch(undefined),
    'trang-thai': z.enum(['da-xu-ly']).optional().catch(undefined),
    trang: z.coerce.number().int().positive().max(100_000).catch(1),
  })
  .transform((url): ListErrorLogsInput => ({
    source: errorSource.options.find((value) => SOURCE_SLUG[value] === url.nguon),
    resolved: url['trang-thai'] === 'da-xu-ly',
    page: url.trang,
    pageSize: 30,
  }));

export const resolveErrorLogsInput = z.object({ ids: z.array(z.uuid()).min(1).max(100) });
