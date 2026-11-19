import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import type {
  CreateSupportRequestInput,
  SupportContext,
  SupportType,
  SupportSeverity,
} from '@seedgw/contracts/support';
import { apiCall } from '../api/client';
import { newId } from '../api/session';
import { base64ToBytes } from './xlsx';

// Hàng đợi Hỗ trợ trên máy (T3): soạn lúc mất mạng thì lưu ở đây, có mạng gửi theo đúng thứ tự.
// Mỗi yêu cầu, tin, tệp có clientId riêng nên gửi lại bao nhiêu lần máy chủ cũng không tạo trùng.

const DB_NAME = 'seedgw-support.db';

export type OutboxFile = { clientId: string; fileName: string; base64: string };

type OutboxRow = {
  id: number;
  kind: 'REQUEST' | 'MESSAGE';
  client_id: string;
  request_client_id: string;
  request_code: string | null;
  payload: string;
  status: 'pending' | 'row_sent' | 'failed';
  error: string | null;
  created_at: number;
};

export type PendingSupportItem = {
  id: number;
  kind: 'REQUEST' | 'MESSAGE';
  clientId: string;
  requestClientId: string;
  requestCode: string | null;
  title: string | null;
  body: string;
  fileCount: number;
  failed: string | null;
  createdAt: number;
};

let db: SQLiteDatabase | null = null;

function getDb(): SQLiteDatabase {
  if (db) return db;
  const opened = openDatabaseSync(DB_NAME);
  opened.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      client_id TEXT NOT NULL UNIQUE,
      request_client_id TEXT NOT NULL,
      request_code TEXT,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS outbox_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      outbox_id INTEGER NOT NULL,
      client_id TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      data_base64 TEXT NOT NULL,
      sent INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS request_codes (
      request_client_id TEXT PRIMARY KEY NOT NULL,
      code TEXT NOT NULL
    );
  `);
  db = opened;
  return opened;
}

function addFiles(database: SQLiteDatabase, outboxId: number, files: readonly OutboxFile[]) {
  for (const file of files) {
    database.runSync(
      'INSERT INTO outbox_files (outbox_id, client_id, file_name, data_base64) VALUES (?, ?, ?, ?)',
      outboxId,
      file.clientId,
      file.fileName,
      file.base64,
    );
  }
}

export type NewRequestDraft = {
  type: SupportType;
  severity: SupportSeverity | null;
  title: string;
  body: string;
  context: SupportContext;
  files: readonly OutboxFile[];
};

/** Lưu yêu cầu mới vào hàng đợi; trả clientId để mở xem ngay cả khi chưa gửi được. */
export function queueSupportRequest(draft: NewRequestDraft, now = Date.now()): string {
  const database = getDb();
  const clientId = newId();
  const payload: CreateSupportRequestInput = {
    clientId,
    type: draft.type,
    severity: draft.severity ?? undefined,
    title: draft.title,
    body: draft.body,
    context: draft.context,
  };
  const result = database.runSync(
    'INSERT INTO outbox (kind, client_id, request_client_id, payload, created_at) VALUES (?, ?, ?, ?, ?)',
    'REQUEST',
    clientId,
    clientId,
    JSON.stringify(payload),
    now,
  );
  addFiles(database, Number(result.lastInsertRowId), draft.files);
  return clientId;
}

/** Lưu tin trả lời; yêu cầu chưa gửi xong thì tin chờ theo sau yêu cầu đó. */
export function queueSupportMessage(
  target: { code: string | null; requestClientId: string },
  body: string,
  files: readonly OutboxFile[],
  now = Date.now(),
): void {
  const database = getDb();
  const clientId = newId();
  const result = database.runSync(
    'INSERT INTO outbox (kind, client_id, request_client_id, request_code, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    'MESSAGE',
    clientId,
    target.requestClientId,
    target.code,
    JSON.stringify({ clientId, body, hasFiles: files.length > 0 }),
    now,
  );
  addFiles(database, Number(result.lastInsertRowId), files);
}

function codeFor(row: OutboxRow): string | null {
  if (row.request_code) return row.request_code;
  const found = getDb().getFirstSync<{ code: string }>(
    'SELECT code FROM request_codes WHERE request_client_id = ?',
    row.request_client_id,
  );
  return found?.code ?? null;
}

/** Mã yêu cầu máy chủ đã cấp cho yêu cầu soạn trên máy; null là chưa gửi xong. */
export function codeOfLocalRequest(requestClientId: string): string | null {
  return (
    getDb().getFirstSync<{ code: string }>(
      'SELECT code FROM request_codes WHERE request_client_id = ?',
      requestClientId,
    )?.code ?? null
  );
}

export function listPendingSupport(): PendingSupportItem[] {
  const database = getDb();
  const rows = database.getAllSync<OutboxRow & { file_count: number }>(
    `SELECT outbox.*, (SELECT COUNT(*) FROM outbox_files WHERE outbox_id = outbox.id) AS file_count
     FROM outbox ORDER BY id`,
  );
  return rows.map((row) => {
    const payload = JSON.parse(row.payload) as { title?: string; body?: string };
    return {
      id: row.id,
      kind: row.kind,
      clientId: row.client_id,
      requestClientId: row.request_client_id,
      requestCode: codeFor(row),
      title: payload.title ?? null,
      body: payload.body ?? '',
      fileCount: row.file_count,
      failed: row.status === 'failed' ? row.error : null,
      createdAt: row.created_at,
    };
  });
}

export function countPendingSupport(): number {
  return (
    getDb().getFirstSync<{ total: number }>('SELECT COUNT(*) AS total FROM outbox')?.total ?? 0
  );
}

/** Bỏ một mục lỗi không gửi được (ví dụ tệp bị máy chủ từ chối) khỏi hàng đợi. */
export function discardPendingSupport(id: number): void {
  const database = getDb();
  database.runSync('DELETE FROM outbox_files WHERE outbox_id = ?', id);
  database.runSync('DELETE FROM outbox WHERE id = ?', id);
}

async function sendFiles(row: OutboxRow, code: string): Promise<string | null> {
  const database = getDb();
  const files = database.getAllSync<{
    id: number;
    client_id: string;
    file_name: string;
    data_base64: string;
  }>(
    'SELECT id, client_id, file_name, data_base64 FROM outbox_files WHERE outbox_id = ? AND sent = 0 ORDER BY id',
    row.id,
  );
  for (const file of files) {
    const bytes = base64ToBytes(file.data_base64);
    const query = `tin=${row.client_id}&tep=${file.client_id}&ten=${encodeURIComponent(file.file_name)}`;
    const result = await apiCall(`/api/mobile/support/${code}/attachments?${query}`, {
      method: 'PUT',
      body: bytes.buffer as ArrayBuffer,
      contentType: 'application/octet-stream',
    });
    if (!result.ok) {
      if (!result.retryable) {
        database.runSync(
          "UPDATE outbox SET status = 'failed', error = ? WHERE id = ?",
          result.message,
          row.id,
        );
      }
      return result.message;
    }
    database.runSync('UPDATE outbox_files SET sent = 1 WHERE id = ?', file.id);
  }
  return null;
}

let running: Promise<string | null> | null = null;

/** Gửi hàng đợi theo thứ tự. Mất mạng thì dừng chờ lần sau; lỗi dữ liệu thì đánh dấu lỗi rồi gửi tiếp mục khác. */
export function syncSupportOutbox(): Promise<string | null> {
  running ??= run().finally(() => {
    running = null;
  });
  return running;
}

async function run(): Promise<string | null> {
  const database = getDb();
  const rows = database.getAllSync<OutboxRow>(
    "SELECT * FROM outbox WHERE status != 'failed' ORDER BY id",
  );
  for (const row of rows) {
    let code = codeFor(row);
    if (row.status === 'pending') {
      if (row.kind === 'REQUEST') {
        const result = await apiCall<{ code: string }>('/api/mobile/support', {
          method: 'POST',
          json: JSON.parse(row.payload) as unknown,
        });
        if (!result.ok) {
          if (result.retryable || result.status === 401) return result.message;
          database.runSync(
            "UPDATE outbox SET status = 'failed', error = ? WHERE id = ?",
            result.message,
            row.id,
          );
          continue;
        }
        code = result.data.code;
        database.runSync(
          'INSERT OR REPLACE INTO request_codes (request_client_id, code) VALUES (?, ?)',
          row.request_client_id,
          code,
        );
      } else {
        // Yêu cầu chứa tin này chưa gửi xong thì chờ, giữ đúng thứ tự.
        if (!code) continue;
        const result = await apiCall(`/api/mobile/support/${code}/messages`, {
          method: 'POST',
          json: JSON.parse(row.payload) as unknown,
        });
        if (!result.ok) {
          if (result.retryable || result.status === 401) return result.message;
          database.runSync(
            "UPDATE outbox SET status = 'failed', error = ? WHERE id = ?",
            result.message,
            row.id,
          );
          continue;
        }
      }
      database.runSync(
        "UPDATE outbox SET status = 'row_sent', request_code = ? WHERE id = ?",
        code,
        row.id,
      );
    }
    if (!code) continue;
    const fileError = await sendFiles(row, code);
    if (fileError) return fileError;
    discardPendingSupport(row.id);
  }
  return null;
}
