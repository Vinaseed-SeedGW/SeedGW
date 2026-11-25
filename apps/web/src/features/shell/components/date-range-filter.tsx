'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { DateInput } from '@seedgw/ui/date-input';

const CONTROL = 'h-9.5 rounded-md border border-border bg-surface px-2.5';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// Tham số kỳ cũ (nút Tháng này, Vụ...) bỏ đi khi người dùng nhập ngày.
const LEGACY_PARAMS = ['ky', 'vu', 'nien-vu', 'trang'];

type DateRangeFilterProps = {
  /** Khoảng đang xem, dạng yyyy-mm-dd, máy chủ đã tính (Đến ngày trống là hôm nay). */
  from: string;
  to: string;
  /** Ghi chú dưới hai ô, ví dụ giới hạn số ngày. */
  hint?: string;
};

/**
 * Bộ lọc thời gian chung (25/11/2026): Từ ngày, Đến ngày dạng dd/mm/yyyy, lưu trên URL tu-ngay, den-ngay.
 * Xoá Đến ngày thì tính tới hôm nay.
 */
export function DateRangeFilter({ from, to, hint }: DateRangeFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function apply(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const name of LEGACY_PARAMS) next.delete(name);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  return (
    <div className="grid gap-1" aria-busy={isPending}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          Từ ngày
          <DateInput
            className="w-40"
            inputClassName={CONTROL}
            value={from}
            onValueChange={(value) => {
              if (ISO_DATE.test(value)) {
                apply({ 'tu-ngay': value, 'den-ngay': searchParams.get('den-ngay') });
              }
            }}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Đến ngày
          <DateInput
            className="w-40"
            inputClassName={CONTROL}
            value={to}
            onValueChange={(value) => {
              // Giữ Từ ngày đang xem để đổi Đến ngày không làm nhảy Từ ngày về mặc định.
              if (value === '') apply({ 'tu-ngay': from, 'den-ngay': null });
              else if (ISO_DATE.test(value)) apply({ 'tu-ngay': from, 'den-ngay': value });
            }}
          />
        </label>
      </div>
      <p className="text-sm text-text-muted">
        Để trống Đến ngày thì tính tới hôm nay.{hint ? ` ${hint}` : ''}
      </p>
    </div>
  );
}
