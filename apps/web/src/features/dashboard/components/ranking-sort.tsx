'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import {
  DASHBOARD_RANKING_LABEL,
  DASHBOARD_RANKINGS,
  type DashboardRanking,
} from '@seedgw/contracts/dashboard';

/** Chọn cách xếp hạng nhân viên (K4c), lưu trên URL như các bộ lọc khác. */
export function RankingSort({ value }: { value: DashboardRanking }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm" aria-busy={isPending}>
      Xếp theo
      <select
        className="h-9 min-w-0 rounded-md border border-border bg-surface px-2"
        value={value}
        onChange={(event) => {
          const next = new URLSearchParams(searchParams.toString());
          if (event.target.value === 'luot') next.delete('sap-xep');
          else next.set('sap-xep', event.target.value);
          startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
        }}
      >
        {DASHBOARD_RANKINGS.map((ranking) => (
          <option key={ranking} value={ranking}>
            {DASHBOARD_RANKING_LABEL[ranking]}
          </option>
        ))}
      </select>
    </label>
  );
}
