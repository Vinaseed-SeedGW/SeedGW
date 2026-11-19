import 'server-only';
import { Queue } from 'bullmq';
import { FAST_SYNC_QUEUE } from '@seedgw/contracts/fast';
import { DomainError } from '@/server/services/domain-error';

// Nút Đồng bộ ngay: đẩy việc vào hàng đợi, worker gọi FAST (A8). Web không gọi FAST trực tiếp để đồng bộ.
let queue: Queue | null = null;

export async function requestFastSync(): Promise<void> {
  const url = process.env.REDIS_URL?.trim();
  if (!url)
    throw new DomainError('INTEGRATION', 'Máy chủ chưa có hàng đợi (REDIS_URL), chưa đồng bộ được');
  queue ??= new Queue(FAST_SYNC_QUEUE, { connection: { url, maxRetriesPerRequest: null } });
  // Bấm nhiều lần trong cùng một phút chỉ tính một lần.
  // Mã việc của BullMQ không được có dấu hai chấm, nên bỏ hết ký tự không phải số.
  const minute = new Date().toISOString().slice(0, 16).replace(/\D/g, '');
  await queue.add(
    'manual',
    {},
    { jobId: `manual-${minute}`, removeOnComplete: 100, removeOnFail: 100 },
  );
}
