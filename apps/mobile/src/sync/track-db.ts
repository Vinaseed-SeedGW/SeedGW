import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import type { LocationObject } from 'expo-location';
import { distanceMeters, formatCoord, formatVnDate, formatVnTime } from './geo';

// Bản thử R3: dữ liệu chỉ nằm trên máy để đo GPS, pin và vết đứt. Đồng bộ lên máy chủ làm ở M3, M12.
const DB_NAME = 'dms-r3.db';

/** Ngưỡng lọc giống CHECK_IN_PLAN §3.4, để số km theo GPS trên app gần với số máy chủ sẽ tính. */
export const FILTER = {
  maxAccuracyM: 50,
  maxSpeedKmh: 150,
  gapMinutes: 5,
  gapMeters: 300,
} as const;

export type SessionEndReason = 'USER' | 'AUTO_CUTOFF';

type PointRow = {
  recorded_at: number;
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  mocked: number;
  app_state: string | null;
};

type SessionRow = {
  id: number;
  started_at: number;
  ended_at: number | null;
  end_reason: SessionEndReason | null;
};

export type PhotoSummary = { id: number; takenAt: number; sizeBytes: number };

export type DayStats = {
  pointCount: number;
  keptCount: number;
  poorAccuracyCount: number;
  mockedCount: number;
  backgroundCount: number;
  gpsDistanceM: number;
  gapCount: number;
  longestGapMinutes: number;
  lastPoint: { recordedAt: number; accuracy: number | null } | null;
  photoCount: number;
};

let db: SQLiteDatabase | null = null;

function getDb(): SQLiteDatabase {
  if (db) return db;
  const opened = openDatabaseSync(DB_NAME);
  opened.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS track_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at INTEGER NOT NULL UNIQUE,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      accuracy REAL,
      speed REAL,
      mocked INTEGER NOT NULL DEFAULT 0,
      app_state TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      end_reason TEXT
    );
    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      taken_at INTEGER NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      accuracy REAL,
      mocked INTEGER NOT NULL DEFAULT 0,
      size_bytes INTEGER NOT NULL,
      data_uri TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS task_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at INTEGER NOT NULL,
      message TEXT NOT NULL
    );
  `);
  db = opened;
  return opened;
}

export function insertTrackPoints(
  locations: readonly LocationObject[],
  appState: string | null,
): number {
  if (locations.length === 0) return 0;
  const database = getDb();
  let inserted = 0;
  database.withTransactionSync(() => {
    const statement = database.prepareSync(
      `INSERT OR IGNORE INTO track_points (recorded_at, lat, lng, accuracy, speed, mocked, app_state)
       VALUES ($recordedAt, $lat, $lng, $accuracy, $speed, $mocked, $appState)`,
    );
    try {
      for (const location of locations) {
        const result = statement.executeSync({
          $recordedAt: Math.round(location.timestamp),
          $lat: location.coords.latitude,
          $lng: location.coords.longitude,
          $accuracy: location.coords.accuracy,
          $speed: location.coords.speed,
          $mocked: location.mocked ? 1 : 0,
          $appState: appState,
        });
        inserted += result.changes;
      }
    } finally {
      statement.finalizeSync();
    }
  });
  return inserted;
}

export function recordTaskError(message: string): void {
  getDb().runSync(
    'INSERT INTO task_errors (at, message) VALUES (?, ?)',
    Date.now(),
    message.slice(0, 500),
  );
}

export function countTaskErrorsSince(since: number): number {
  return (
    getDb().getFirstSync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM task_errors WHERE at >= ?',
      since,
    )?.n ?? 0
  );
}

export function getConsentAt(): number | null {
  const row = getDb().getFirstSync<{ value: string }>(
    "SELECT value FROM meta WHERE key = 'consent_at'",
  );
  return row ? Number(row.value) : null;
}

export function saveConsent(at: number): void {
  getDb().runSync("INSERT OR REPLACE INTO meta (key, value) VALUES ('consent_at', ?)", String(at));
}

export function getOpenSession(): SessionRow | null {
  return getDb().getFirstSync<SessionRow>(
    'SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
  );
}

export function openSession(at: number): void {
  if (getOpenSession()) return;
  getDb().runSync('INSERT INTO sessions (started_at) VALUES (?)', at);
}

export function closeSession(at: number, reason: SessionEndReason): void {
  getDb().runSync(
    'UPDATE sessions SET ended_at = ?, end_reason = ? WHERE ended_at IS NULL',
    at,
    reason,
  );
}

export function listSessionsSince(since: number): SessionRow[] {
  return getDb().getAllSync<SessionRow>(
    'SELECT * FROM sessions WHERE started_at >= ? ORDER BY started_at',
    since,
  );
}

export function insertPhoto(photo: {
  takenAt: number;
  lat: number;
  lng: number;
  accuracy: number | null;
  mocked: boolean;
  dataUri: string;
}): void {
  const base64Length = photo.dataUri.length - photo.dataUri.indexOf(',') - 1;
  getDb().runSync(
    `INSERT INTO photos (taken_at, lat, lng, accuracy, mocked, size_bytes, data_uri)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    photo.takenAt,
    photo.lat,
    photo.lng,
    photo.accuracy,
    photo.mocked ? 1 : 0,
    Math.round((base64Length * 3) / 4),
    photo.dataUri,
  );
}

export function listPhotosSince(since: number): PhotoSummary[] {
  return getDb()
    .getAllSync<{ id: number; taken_at: number; size_bytes: number }>(
      'SELECT id, taken_at, size_bytes FROM photos WHERE taken_at >= ? ORDER BY taken_at DESC',
      since,
    )
    .map((row) => ({ id: row.id, takenAt: row.taken_at, sizeBytes: row.size_bytes }));
}

export function getPhotoDataUri(id: number): string | null {
  return (
    getDb().getFirstSync<{ data_uri: string }>('SELECT data_uri FROM photos WHERE id = ?', id)
      ?.data_uri ?? null
  );
}

function pointsBetween(from: number, to: number): PointRow[] {
  return getDb().getAllSync<PointRow>(
    `SELECT recorded_at, lat, lng, accuracy, speed, mocked, app_state
     FROM track_points WHERE recorded_at >= ? AND recorded_at < ? ORDER BY recorded_at`,
    from,
    to,
  );
}

export function computeDayStats(dayStart: number): DayStats {
  const dayEnd = dayStart + 86_400_000;
  const points = pointsBetween(dayStart, dayEnd);
  let keptCount = 0;
  let poorAccuracyCount = 0;
  let mockedCount = 0;
  let backgroundCount = 0;
  let gpsDistanceM = 0;
  let gapCount = 0;
  let longestGapMinutes = 0;
  let previous: PointRow | null = null;

  for (const point of points) {
    if (point.mocked) mockedCount += 1;
    if (point.app_state && point.app_state !== 'active') backgroundCount += 1;
    if (point.accuracy === null || point.accuracy > FILTER.maxAccuracyM) {
      poorAccuracyCount += 1;
      continue;
    }
    if (previous) {
      const meters = distanceMeters(previous, point);
      const seconds = (point.recorded_at - previous.recorded_at) / 1000;
      const speedKmh = seconds > 0 ? (meters / seconds) * 3.6 : Infinity;
      if (speedKmh > FILTER.maxSpeedKmh) continue;
      const gapMinutes = seconds / 60;
      // Đứng yên trong đại lý cũng không sinh điểm, nên chỉ tính là đứt khi đã đi xa mà không có điểm.
      if (gapMinutes > FILTER.gapMinutes && meters > FILTER.gapMeters) {
        gapCount += 1;
        longestGapMinutes = Math.max(longestGapMinutes, gapMinutes);
      }
      gpsDistanceM += meters;
    }
    keptCount += 1;
    previous = point;
  }

  const last = points.at(-1);
  const photoCount =
    getDb().getFirstSync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM photos WHERE taken_at >= ? AND taken_at < ?',
      dayStart,
      dayEnd,
    )?.n ?? 0;

  return {
    pointCount: points.length,
    keptCount,
    poorAccuracyCount,
    mockedCount,
    backgroundCount,
    gpsDistanceM,
    gapCount,
    longestGapMinutes,
    lastPoint: last ? { recordedAt: last.recorded_at, accuracy: last.accuracy } : null,
    photoCount,
  };
}

/** Xuất CSV để gửi cho người phân tích (R4): điểm GPS và vị trí các lần chụp ảnh trong ngày. */
export function exportDayCsv(dayStart: number): string {
  const dayEnd = dayStart + 86_400_000;
  const lines = ['loai,ngay,gio,epoch_ms,lat,lng,sai_so_m,toc_do_ms,gia_lap,trang_thai_app'];
  for (const p of pointsBetween(dayStart, dayEnd)) {
    lines.push(
      [
        'gps',
        formatVnDate(p.recorded_at),
        formatVnTime(p.recorded_at),
        p.recorded_at,
        formatCoord(p.lat),
        formatCoord(p.lng),
        p.accuracy?.toFixed(1) ?? '',
        p.speed?.toFixed(2) ?? '',
        p.mocked,
        p.app_state ?? '',
      ].join(','),
    );
  }
  const photos = getDb().getAllSync<{
    taken_at: number;
    lat: number;
    lng: number;
    accuracy: number | null;
    mocked: number;
  }>(
    'SELECT taken_at, lat, lng, accuracy, mocked FROM photos WHERE taken_at >= ? AND taken_at < ? ORDER BY taken_at',
    dayStart,
    dayEnd,
  );
  for (const photo of photos) {
    lines.push(
      [
        'anh',
        formatVnDate(photo.taken_at),
        formatVnTime(photo.taken_at),
        photo.taken_at,
        formatCoord(photo.lat),
        formatCoord(photo.lng),
        photo.accuracy?.toFixed(1) ?? '',
        '',
        photo.mocked,
        '',
      ].join(','),
    );
  }
  for (const session of listSessionsSince(dayStart)) {
    lines.push(
      [
        'phien',
        formatVnDate(session.started_at),
        formatVnTime(session.started_at),
        session.started_at,
        '',
        '',
        '',
        '',
        '',
        'bat dau',
      ].join(','),
    );
    if (session.ended_at !== null) {
      lines.push(
        [
          'phien',
          formatVnDate(session.ended_at),
          formatVnTime(session.ended_at),
          session.ended_at,
          '',
          '',
          '',
          '',
          '',
          session.end_reason === 'AUTO_CUTOFF' ? 'tu dung theo gio' : 'ket thuc ngay',
        ].join(','),
      );
    }
  }
  return lines.join('\n');
}

export function clearAllTestData(): void {
  getDb().execSync(
    'DELETE FROM track_points; DELETE FROM photos; DELETE FROM sessions; DELETE FROM task_errors;',
  );
}
