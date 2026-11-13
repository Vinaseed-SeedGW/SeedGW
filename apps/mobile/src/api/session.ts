import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { MobileProfile, MobileSession } from '@dms/contracts/check-ins';

// Địa chỉ máy chủ DMS. Để trống thì app chạy kiểu bản thử R3: dữ liệu chỉ nằm trên máy, không cần đăng nhập.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export function serverEnabled(): boolean {
  return API_URL.length > 0;
}

const SESSION_KEY = 'dms_session';
const DEVICE_KEY = 'dms_device_key';

let cached: MobileSession | null | undefined;
const listeners = new Set<(session: MobileSession | null) => void>();

/** Mã ngẫu nhiên dạng UUID. Máy có crypto.randomUUID thì dùng, không thì tự sinh. */
export function newId(): string {
  const native = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID;
  if (native) return native.call((globalThis as { crypto: object }).crypto);
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

export async function getDeviceIdentity() {
  let key = await SecureStore.getItemAsync(DEVICE_KEY);
  if (!key) {
    key = `dms-${newId()}`;
    await SecureStore.setItemAsync(DEVICE_KEY, key);
  }
  return {
    key,
    name: `${Platform.OS === 'ios' ? 'iPhone' : 'Android'} ${String(Platform.Version)}`,
    platform: Platform.OS === 'ios' ? ('ios' as const) : ('android' as const),
  };
}

export async function loadSession(): Promise<MobileSession | null> {
  if (cached !== undefined) return cached;
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  try {
    cached = raw ? (JSON.parse(raw) as MobileSession) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export async function saveSession(session: MobileSession | null): Promise<void> {
  cached = session;
  if (session) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  else await SecureStore.deleteItemAsync(SESSION_KEY);
  for (const listener of listeners) listener(session);
}

export function currentProfile(): MobileProfile | null {
  return cached ? cached.user : null;
}

export function onSessionChange(listener: (session: MobileSession | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
