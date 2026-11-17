'use client';

import dynamic from 'next/dynamic';

// Recharts chỉ tải khi mở dashboard (AGENTS.md §9), trang khác không phải tải thư viện biểu đồ.
export const VisitsChartLazy = dynamic(
  () => import('./visits-chart').then((mod) => mod.VisitsChart),
  {
    ssr: false,
    loading: () => <div className="h-64 w-full animate-pulse rounded-md bg-surface-subtle" />,
  },
);
