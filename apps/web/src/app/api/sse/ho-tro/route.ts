import { getCurrentUser } from '@/server/auth/current-user';
import { onSupportChange } from '@/server/integrations/support-events';
import { supportEventFilter } from '@/server/services/support';

// SSE cho Hỗ trợ trên web (T1): báo trình duyệt có yêu cầu vừa đổi để tải lại phần liên quan.
// Chỉ gửi mã yêu cầu, không gửi nội dung; trình duyệt đọc nội dung qua query có kiểm quyền.

export const dynamic = 'force-dynamic';

const HEARTBEAT_MS = 25_000;

export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      { code: 'UNAUTHENTICATED', message: 'Phiên đăng nhập đã hết hạn' },
      { status: 401 },
    );
  }
  const canManage = user.permissions.has('support.request.manage');
  const canCreate = user.permissions.has('support.request.create');
  if (!canManage && !canCreate) {
    return Response.json(
      { code: 'FORBIDDEN', message: 'Không có quyền dùng Hỗ trợ' },
      { status: 403 },
    );
  }
  const relevant = await supportEventFilter(user);

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          cleanup();
        }
      };
      send('retry: 5000\n\n');
      const stop = onSupportChange((event) => {
        if (relevant(event))
          send(`event: change\ndata: ${JSON.stringify({ code: event.code })}\n\n`);
      });
      const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);
      cleanup = () => {
        clearInterval(heartbeat);
        stop();
      };
      request.signal.addEventListener('abort', () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Đã đóng.
        }
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}
