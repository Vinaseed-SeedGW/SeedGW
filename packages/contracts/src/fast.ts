import { z } from 'zod';

// Kết nối FAST Business Online (A8, 19/11/2026) theo đặc tả kỹ thuật API của FAST bản 1.7 (27/02/2023).
// Chỉ làm chiều FAST sang SeedGW cho danh mục khách hàng; công nợ, hoá đơn tạm hold (features.ts).

const VN_OFFSET_MS = 7 * 3_600_000;
const FAST_TIMEOUT_MS = 30_000;

// ---------- Cấu hình ----------

export const fastConfig = z.object({
  baseUrl: z.string(),
  username: z.string(),
  password: z.string(),
  enabled: z.boolean(),
});
export type FastConfig = z.infer<typeof fastConfig>;

export const saveFastConnectionInput = z.object({
  baseUrl: z
    .string()
    .trim()
    .url('Nhập địa chỉ đầy đủ, ví dụ https://api.fast.com.vn/vinaseed')
    .refine((value) => /^https?:\/\//.test(value), 'Địa chỉ phải bắt đầu bằng http hoặc https'),
  username: z.string().trim().min(1, 'Nhập tên đăng nhập API').max(30, 'Tối đa 30 ký tự'),
  // Để trống là giữ mật khẩu đang lưu.
  password: z.string().max(256, 'Tối đa 256 ký tự'),
  enabled: z.boolean(),
});
export type SaveFastConnectionInput = z.infer<typeof saveFastConnectionInput>;

export type FastConnectionView = {
  configured: boolean;
  enabled: boolean;
  baseUrl: string;
  username: string;
  passwordSet: boolean;
  updatedAt: string | null;
};

// ---------- Ngày giờ ----------

/** Ngày giờ theo dạng FAST nhận ở tham số ngay_sua_tu: yyyy-mm-dd hh:mm:ss, giờ Việt Nam. */
export function formatFastDateTime(date: Date): string {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Đọc ngày giờ FAST trả về. Tài liệu không ghi múi giờ nên coi là giờ Việt Nam (câu hỏi 5 gửi FAST).
 * Nhận cả dạng có T, có phần nghìn giây, chỉ có ngày. Sai dạng thì null.
 */
export function parseFastDateTime(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?/.exec(
    value.trim(),
  );
  if (!match) return null;
  const [, y, mo, d, h = '00', mi = '00', s = '00'] = match;
  const utc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  return Number.isNaN(utc) ? null : new Date(utc - VN_OFFSET_MS);
}

// ---------- Khách hàng ----------

const text = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((value) =>
    value === null || value === undefined ? null : String(value).trim() || null,
  );

/** Một dòng của GET /customers. Mọi trường trừ mã đều có thể thiếu, tên trường giữ nguyên như FAST. */
export const fastCustomerRecord = z.object({
  ma_kh: z.union([z.string(), z.number()]).transform((value) => String(value).trim()),
  ten_kh: text,
  ma_so_thue: text,
  dia_chi: text,
  ma_tinh: text,
  ma_huyen: text,
  dien_thoai: text,
  e_mail: text,
  ma_dvcs: text,
  nh_kh1: text,
  nh_kh2: text,
  nh_kh3: text,
  nh_kh4: text,
  nh_kh5: text,
  nh_kh6: text,
  status: text,
  ngay_tao: text,
  ngay_sua: text,
});
export type FastCustomerRecord = z.infer<typeof fastCustomerRecord>;

/** Trạng thái FAST: 1 là đang dùng, 0 là ngừng (tài liệu chỉ ghi 0 hoặc 1). Lạ thì coi là đang dùng. */
export function fastCustomerActive(status: string | null): boolean {
  return status !== '0';
}

export function fastCustomerGroups(record: FastCustomerRecord): Record<string, string> {
  return Object.fromEntries(
    (['nh_kh1', 'nh_kh2', 'nh_kh3', 'nh_kh4', 'nh_kh5', 'nh_kh6'] as const).flatMap((key) =>
      record[key] ? [[key, record[key]]] : [],
    ),
  );
}

// ---------- Gọi API ----------

export class FastApiError extends Error {
  constructor(
    message: string,
    readonly kind: 'NETWORK' | 'AUTH' | 'RESPONSE',
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path}`;
}

async function call(fetchImpl: Fetch, url: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(FAST_TIMEOUT_MS) });
  } catch (error) {
    throw new FastApiError(
      `Không gọi được máy chủ FAST (${error instanceof Error ? error.message : 'lỗi mạng'})`,
      'NETWORK',
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (response.status === 401 || response.status === 403) {
    throw new FastApiError(
      'FAST từ chối đăng nhập, kiểm tra tên đăng nhập và mật khẩu API',
      'AUTH',
    );
  }
  if (!response.ok) {
    throw new FastApiError(`FAST trả mã ${response.status}`, 'RESPONSE');
  }
  return body;
}

/** POST /login, trả token. FAST báo lỗi bằng Success false hoặc Status E2. */
export async function fastLogin(config: FastConfig, fetchImpl: Fetch = fetch): Promise<string> {
  const body = (await call(fetchImpl, endpoint(config.baseUrl, 'login'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: config.username, password: config.password }),
  })) as {
    Success?: unknown;
    Token?: unknown;
    token?: unknown;
    Status?: unknown;
    status?: unknown;
  } | null;
  const token = body?.Token ?? body?.token;
  if (body?.Success === false || typeof token !== 'string' || !token) {
    throw new FastApiError(
      'FAST từ chối đăng nhập, kiểm tra tên đăng nhập và mật khẩu API',
      'AUTH',
    );
  }
  return token;
}

export type FastCustomerPage = {
  records: FastCustomerRecord[];
  invalid: { raw: unknown; message: string }[];
};

/** GET /customers?ngay_sua_tu=..., để trống mốc là lấy toàn bộ. */
export async function fastGetCustomers(
  config: FastConfig,
  token: string,
  since: Date | null,
  fetchImpl: Fetch = fetch,
): Promise<FastCustomerPage> {
  const url = new URL(endpoint(config.baseUrl, 'customers'));
  if (since) url.searchParams.set('ngay_sua_tu', formatFastDateTime(since));
  const body = (await call(fetchImpl, url.toString(), {
    method: 'GET',
    headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
  })) as { customers?: unknown } | unknown[] | null;
  const list = Array.isArray(body) ? body : (body as { customers?: unknown } | null)?.customers;
  if (!Array.isArray(list)) {
    throw new FastApiError(
      'FAST trả danh mục khách hàng không đúng dạng (thiếu mảng customers)',
      'RESPONSE',
    );
  }
  const page: FastCustomerPage = { records: [], invalid: [] };
  for (const raw of list) {
    const parsed = fastCustomerRecord.safeParse(raw);
    if (parsed.success && parsed.data.ma_kh) page.records.push(parsed.data);
    else page.invalid.push({ raw, message: 'Thiếu mã khách hàng hoặc sai kiểu dữ liệu' });
  }
  return page;
}

// ---------- Hiển thị ----------

export const fastSyncStatus = z.enum(['RUNNING', 'OK', 'FAILED', 'SKIPPED']);
export type FastSyncStatus = z.infer<typeof fastSyncStatus>;
export const FAST_SYNC_STATUS_LABEL: Record<FastSyncStatus, string> = {
  RUNNING: 'Đang chạy',
  OK: 'Thành công',
  FAILED: 'Lỗi',
  SKIPPED: 'Bỏ qua',
};

export type FastSyncRunView = {
  id: string;
  trigger: string;
  status: FastSyncStatus;
  sinceAt: string | null;
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  message: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type FastSyncErrorView = {
  id: string;
  fastCode: string | null;
  message: string;
  createdAt: string;
};

export type FastOverview = {
  connection: FastConnectionView;
  syncMinutes: number;
  runs: FastSyncRunView[];
  errors: FastSyncErrorView[];
  stats: {
    fastCustomers: number;
    matchedDealers: number;
    dealersWithCode: number;
    /** Đại lý có mã FAST nhưng không thấy trên FAST sau lần lấy toàn bộ. */
    dealersNotOnFast: number | null;
    lastFullSyncAt: string | null;
  };
};

export const FAST_SYNC_QUEUE = 'fast-sync';
export const FAST_SETTING_KEY = 'fast';
