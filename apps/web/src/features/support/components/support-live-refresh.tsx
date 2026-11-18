'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { useSupportEvents } from '../use-support-events';

/** Trang Quản trị › Hỗ trợ tự tải lại khi có yêu cầu đổi (T1); gộp các sự kiện dồn dập trong 1 giây. */
export function SupportLiveRefresh() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useSupportEvents(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 1000);
  });
  return null;
}
