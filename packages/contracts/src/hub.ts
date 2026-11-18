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

export const hubSummary = z.object({
  departments: z.array(hubDepartment),
  notifications: z.array(hubNotification),
  /** Yêu cầu hỗ trợ đang quá hạn trong phạm vi; null với người không xử lý hỗ trợ (T4). */
  supportOverdue: z.number().int().nonnegative().nullable(),
});
export type HubSummary = z.infer<typeof hubSummary>;
