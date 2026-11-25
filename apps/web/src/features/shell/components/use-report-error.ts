'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { reportClientErrorAction } from '@/server/actions/error-report';

/** F9: trang lỗi gửi lỗi về máy chủ một lần khi hiện. Lỗi khi gửi thì bỏ qua. */
export function useReportError(error: Error & { digest?: string }) {
  const pathname = usePathname();
  useEffect(() => {
    void reportClientErrorAction({
      message: error.message || 'Lỗi không rõ trên trình duyệt',
      digest: error.digest ?? null,
      path: pathname,
    }).catch(() => undefined);
  }, [error, pathname]);
}
