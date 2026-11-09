import { z } from 'zod';

export const MAX_PAGE_SIZE = 100;

export const errorCode = z.enum([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION',
  'CONFLICT',
  'INTEGRATION',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof errorCode>;

export type ActionWarning = { code: string; message: string };

export type ActionResult<T> =
  | { ok: true; data: T; warnings?: ActionWarning[] }
  | { ok: false; code: ErrorCode; message: string; fieldErrors?: Record<string, string> };

export function pageResult<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  });
}
