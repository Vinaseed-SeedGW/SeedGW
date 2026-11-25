import { z } from 'zod';

export const hubDepartment = z.object({
  slug: z.enum(['kinh-doanh', 'quan-tri']),
  name: z.string(),
  description: z.string(),
  pendingCount: z.number().int().nonnegative(),
});

export const hubNotification = z.object({
  id: z.uuid(),
  title: z.string(),
  href: z.string(),
  createdAt: z.iso.datetime(),
});

/** D3: việc đang chờ người dùng, chỉ gồm loại việc người đó có quyền xử lý. */
export const hubTodo = z.object({
  key: z.enum(['approvals', 'support', 'locations', 'dealer-proposals', 'devices']),
  label: z.string(),
  count: z.number().int().nonnegative(),
  href: z.string(),
});
export type HubTodo = z.infer<typeof hubTodo>;

export const hubSummary = z.object({
  departments: z.array(hubDepartment),
  todos: z.array(hubTodo),
  notifications: z.array(hubNotification),
  /** Yêu cầu hỗ trợ đang quá hạn trong phạm vi; null với người không xử lý hỗ trợ (T4). */
  supportOverdue: z.number().int().nonnegative().nullable(),
});
export type HubSummary = z.infer<typeof hubSummary>;
