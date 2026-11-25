import { z } from 'zod';

// D3: ô tìm nhanh Ctrl+K. Máy chủ chỉ trả kết quả trong phạm vi và theo quyền của người tìm.

export const globalSearchInput = z.string().trim().max(100);

export const searchGroup = z.enum(['dealer', 'customer', 'user', 'support']);
export type SearchGroup = z.infer<typeof searchGroup>;

export const SEARCH_GROUP_LABEL: Record<SearchGroup, string> = {
  dealer: 'Đại lý',
  customer: 'Khách hàng',
  user: 'Tài khoản',
  support: 'Yêu cầu hỗ trợ',
};

export type SearchHit = {
  group: SearchGroup;
  id: string;
  title: string;
  detail: string;
  href: string;
};

export type SearchPage = { href: string; label: string; section: string };

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_LIMIT_PER_GROUP = 5;
