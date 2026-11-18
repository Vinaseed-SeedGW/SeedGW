'use client';

import { useEffect, useRef } from 'react';

/**
 * Nghe thay đổi yêu cầu hỗ trợ qua SSE (T1). Trình duyệt tự nối lại khi rớt mạng; mỗi lần nối lại
 * cũng gọi onChange(null) để tải lại, vì có thể đã lỡ sự kiện lúc mất kết nối.
 */
export function useSupportEvents(onChange: (code: string | null) => void): void {
  const handler = useRef(onChange);
  useEffect(() => {
    handler.current = onChange;
  });

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const source = new EventSource('/api/sse/ho-tro');
    let opened = false;
    source.addEventListener('open', () => {
      if (opened) handler.current(null);
      opened = true;
    });
    source.addEventListener('change', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent<string>).data) as { code?: string };
        handler.current(data.code ?? null);
      } catch {
        handler.current(null);
      }
    });
    return () => source.close();
  }, []);
}
