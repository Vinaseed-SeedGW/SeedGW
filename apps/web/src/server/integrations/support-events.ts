import 'server-only';
import { EventEmitter } from 'node:events';
import { Redis } from 'ioredis';
import { SUPPORT_EVENTS_CHANNEL, type SupportChangeEvent } from '@dms/contracts/support';

// Cập nhật tức thì cho Hỗ trợ (T1): mỗi thay đổi phát qua Redis để mọi tiến trình web cùng biết,
// mỗi tiến trình giữ một kết nối nghe chung rồi chia cho các trình duyệt đang mở SSE.

const REDIS_URL = process.env.REDIS_URL?.trim();

let publisher: Redis | null = null;
let subscriber: Redis | null = null;
const local = new EventEmitter();
local.setMaxListeners(0);

function connect(): Redis | null {
  if (!REDIS_URL) return null;
  return new Redis(REDIS_URL, { maxRetriesPerRequest: 2, lazyConnect: false });
}

/** Báo một yêu cầu vừa đổi. Lỗi Redis chỉ ghi log, không làm hỏng thao tác của người dùng. */
export async function publishSupportChange(event: SupportChangeEvent): Promise<void> {
  try {
    publisher ??= connect();
    if (!publisher) {
      local.emit('change', event);
      return;
    }
    await publisher.publish(SUPPORT_EVENTS_CHANNEL, JSON.stringify(event));
  } catch (error) {
    console.error('Không phát được sự kiện hỗ trợ', error);
  }
}

function ensureSubscriber(): void {
  if (subscriber || !REDIS_URL) return;
  subscriber = connect();
  if (!subscriber) return;
  subscriber.on('message', (_channel: string, message: string) => {
    try {
      local.emit('change', JSON.parse(message) as SupportChangeEvent);
    } catch {
      // Tin không đúng dạng thì bỏ qua.
    }
  });
  subscriber.on('error', (error: Error) => console.error('Redis hỗ trợ lỗi', error.message));
  void subscriber.subscribe(SUPPORT_EVENTS_CHANNEL);
}

/** Nghe thay đổi; trả hàm huỷ nghe khi trình duyệt đóng kết nối. */
export function onSupportChange(listener: (event: SupportChangeEvent) => void): () => void {
  ensureSubscriber();
  local.on('change', listener);
  return () => {
    local.off('change', listener);
  };
}
