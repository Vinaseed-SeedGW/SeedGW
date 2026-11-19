import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { FAST_SETTING_KEY, fastConfig, type FastConfig } from '@dms/contracts/fast';
import { db } from './client';

// Cấu hình kết nối ra ngoài (A8): mã hoá AES-256-GCM trước khi lưu, khoá lấy từ INTEGRATION_SECRET_KEY.
// Lộ bản sao lưu database cũng không đọc được mật khẩu FAST nếu không có khoá trên máy chủ.

const VERSION = 'v1';

export class IntegrationKeyMissingError extends Error {
  constructor() {
    super('Máy chủ chưa đặt khoá INTEGRATION_SECRET_KEY, chưa lưu được cấu hình kết nối');
  }
}

function key(): Buffer {
  const secret = process.env.INTEGRATION_SECRET_KEY?.trim();
  if (!secret || secret.length < 16) throw new IntegrationKeyMissingError();
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${VERSION}:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')}`;
}

export function decryptSecret(stored: string): string {
  const [version, payload] = stored.split(':');
  if (version !== VERSION || !payload) throw new Error('Cấu hình kết nối sai định dạng');
  const raw = Buffer.from(payload, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

export async function readFastConfig(): Promise<{ config: FastConfig; updatedAt: Date } | null> {
  const row = await db.integrationSetting.findUnique({ where: { key: FAST_SETTING_KEY } });
  if (!row) return null;
  const parsed = fastConfig.safeParse(JSON.parse(decryptSecret(row.value)));
  return parsed.success ? { config: parsed.data, updatedAt: row.updatedAt } : null;
}

export async function writeFastConfig(config: FastConfig, updatedById: string): Promise<Date> {
  const value = encryptSecret(JSON.stringify(config));
  const row = await db.integrationSetting.upsert({
    where: { key: FAST_SETTING_KEY },
    create: { key: FAST_SETTING_KEY, value, updatedById },
    update: { value, updatedById },
  });
  return row.updatedAt;
}
