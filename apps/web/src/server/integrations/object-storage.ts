import 'server-only';
import { createHash, createHmac } from 'node:crypto';

// Gọi MinIO theo chuẩn S3 (chữ ký AWS Signature V4), tự viết để không thêm thư viện S3 nặng.
// Chỉ dùng 3 việc: tạo bucket kèm luật tự xoá, ghi ảnh, cấp link xem ảnh có hạn.

const REGION = process.env.S3_REGION || 'us-east-1';
const ENDPOINT = (process.env.S3_ENDPOINT || 'http://localhost:9000').replace(/\/$/, '');
// Trình duyệt mở ảnh qua địa chỉ này. Máy chủ thật đặt sau tên miền nên khác địa chỉ nội bộ.
const PUBLIC_ENDPOINT = (process.env.S3_PUBLIC_ENDPOINT || ENDPOINT).replace(/\/$/, '');
const BUCKET = process.env.S3_BUCKET || 'dms';
const ACCESS_KEY = process.env.S3_ACCESS_KEY || process.env.MINIO_ROOT_USER || '';
const SECRET_KEY = process.env.S3_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD || '';

/** Ảnh check-in tự xoá sau 45 ngày (DESIGN_BRIEF quyết định 22). */
export const CHECK_IN_PHOTO_PREFIX = 'check-ins/';
export const CHECK_IN_PHOTO_RETENTION_DAYS = 45;

const sha256Hex = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const hmac = (key: Buffer | string, data: string) =>
  createHmac('sha256', key).update(data).digest();

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function objectPath(key?: string): string {
  const parts = [BUCKET, ...(key ? key.split('/') : [])];
  return `/${parts.map(encodeRfc3986).join('/')}`;
}

function amzDates(now: Date) {
  const amzDate = now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

function signingKey(dateStamp: string): Buffer {
  const kDate = hmac(`AWS4${SECRET_KEY}`, dateStamp);
  return hmac(hmac(hmac(kDate, REGION), 's3'), 'aws4_request');
}

function sign(
  method: string,
  url: URL,
  headers: Record<string, string>,
  payloadHash: string,
  now: Date,
): string {
  const { amzDate, dateStamp } = amzDates(now);
  const scope = `${dateStamp}/${REGION}/s3/aws4_request`;
  const names = Object.keys(headers)
    .map((name) => name.toLowerCase())
    .sort();
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const canonicalHeaders = names.map((name) => `${name}:${String(lower[name]).trim()}\n`).join('');
  const query = [...url.searchParams.entries()]
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
    .sort()
    .join('&');
  const canonicalRequest = [
    method,
    url.pathname,
    query,
    canonicalHeaders,
    names.join(';'),
    payloadHash,
  ].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const signature = createHmac('sha256', signingKey(dateStamp)).update(stringToSign).digest('hex');
  return `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
}

async function s3Request(
  method: 'PUT' | 'GET' | 'HEAD',
  path: string,
  options: {
    query?: Record<string, string>;
    body?: Buffer;
    contentType?: string;
    extraHeaders?: Record<string, string>;
  } = {},
): Promise<Response> {
  const url = new URL(`${ENDPOINT}${path}`);
  for (const [k, v] of Object.entries(options.query ?? {})) url.searchParams.set(k, v);
  const now = new Date();
  const body = options.body ?? Buffer.alloc(0);
  const payloadHash = sha256Hex(body);
  const headers: Record<string, string> = {
    host: url.host,
    'x-amz-date': amzDates(now).amzDate,
    'x-amz-content-sha256': payloadHash,
    ...(options.contentType ? { 'content-type': options.contentType } : {}),
    ...options.extraHeaders,
  };
  const authorization = sign(method, url, headers, payloadHash, now);
  // fetch tự đặt header host, chỉ cần host khi ký.
  const sendHeaders = Object.fromEntries(
    Object.entries(headers).filter(([name]) => name !== 'host'),
  );
  return fetch(url, {
    method,
    headers: { ...sendHeaders, authorization },
    body: method === 'PUT' ? new Uint8Array(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
}

let bucketReady: Promise<void> | null = null;

/** Tạo bucket nếu chưa có và đặt luật tự xoá ảnh check-in sau 45 ngày. Chạy một lần mỗi tiến trình. */
export function ensureBucket(): Promise<void> {
  bucketReady ??= (async () => {
    const created = await s3Request('PUT', objectPath());
    if (!created.ok && created.status !== 409) {
      throw new Error(`Không tạo được bucket ảnh (${created.status})`);
    }
    const lifecycle =
      '<LifecycleConfiguration><Rule><ID>check-in-photos</ID><Status>Enabled</Status>' +
      `<Filter><Prefix>${CHECK_IN_PHOTO_PREFIX}</Prefix></Filter>` +
      `<Expiration><Days>${CHECK_IN_PHOTO_RETENTION_DAYS}</Days></Expiration></Rule></LifecycleConfiguration>`;
    const body = Buffer.from(lifecycle);
    const response = await s3Request('PUT', objectPath(), {
      query: { lifecycle: '' },
      body,
      contentType: 'application/xml',
      extraHeaders: { 'content-md5': createHash('md5').update(body).digest('base64') },
    });
    if (!response.ok) throw new Error(`Không đặt được thời gian lưu ảnh (${response.status})`);
  })().catch((error: unknown) => {
    bucketReady = null;
    throw error;
  });
  return bucketReady;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await ensureBucket();
  let response = await s3Request('PUT', objectPath(key), { body, contentType });
  // Bucket bị xoá trong lúc web đang chạy (ví dụ sau khi khôi phục sao lưu): tạo lại rồi gửi lại một lần.
  if (response.status === 404) {
    bucketReady = null;
    await ensureBucket();
    response = await s3Request('PUT', objectPath(key), { body, contentType });
  }
  if (!response.ok) throw new Error(`Không lưu được ảnh (${response.status})`);
}

/** Link xem ảnh có hạn, trình duyệt tải thẳng từ MinIO, không đi qua máy chủ web. */
export function presignGetUrl(key: string, expiresSeconds = 15 * 60, now = new Date()): string {
  const url = new URL(`${PUBLIC_ENDPOINT}${objectPath(key)}`);
  const { amzDate, dateStamp } = amzDates(now);
  const scope = `${dateStamp}/${REGION}/s3/aws4_request`;
  url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
  url.searchParams.set('X-Amz-Credential', `${ACCESS_KEY}/${scope}`);
  url.searchParams.set('X-Amz-Date', amzDate);
  url.searchParams.set('X-Amz-Expires', String(expiresSeconds));
  url.searchParams.set('X-Amz-SignedHeaders', 'host');
  const query = [...url.searchParams.entries()]
    .map(([k, v]) => `${encodeRfc3986(k)}=${encodeRfc3986(v)}`)
    .sort()
    .join('&');
  const canonicalRequest = [
    'GET',
    url.pathname,
    query,
    `host:${url.host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const signature = createHmac('sha256', signingKey(dateStamp)).update(stringToSign).digest('hex');
  return `${url.origin}${url.pathname}?${query}&X-Amz-Signature=${signature}`;
}

/** Kiểm tra kho ảnh còn trả lời, dùng cho trang kiểm tra sức khoẻ. */
export async function pingStorage(): Promise<boolean> {
  try {
    const response = await s3Request('HEAD', objectPath());
    // 404 là bucket chưa tạo (tạo khi có ảnh đầu tiên), MinIO vẫn đang chạy.
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}
