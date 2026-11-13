import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import type { LocationObject } from 'expo-location';
import { filterTrack, segmentOf, type FilteredTrack, type RawPoint } from './track-filter';

// Bản thử R3: dữ liệu chỉ nằm trên máy để đo GPS, pin và vết đứt. Đồng bộ lên máy chủ làm ở M3, M12.
const DB_NAME = 'dms-r3.db';
const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export type SessionEndReason = 'USER' | 'AUTO_CUTOFF';
export type PlaceKind = 'DEALER' | 'CUSTOMER' | 'OTHER';

type PointRow = {
  recorded_at: number;
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  mocked: number;
  app_state: string | null;
};

export type SessionRow = {
  id: number;
  started_at: number;
  ended_at: number | null;
  end_reason: SessionEndReason | null;
};

type PhotoRow = {
  id: number;
  taken_at: number;
  lat: number;
  lng: number;
  accuracy: number | null;
  mocked: number;
  size_bytes: number;
  data_uri: string;
  address: string | null;
  place_kind: PlaceKind | null;
  place_name: string | null;
  note: string | null;
};

export type PhotoSummary = {
  id: number;
  takenAt: number;
  sizeBytes: number;
  address: string | null;
  placeName: string | null;
};

export type PhotoRecord = {
  id: number;
  takenAt: number;
  lat: number;
  lng: number;
  accuracy: number | null;
  mocked: boolean;
  dataUri: string;
  address: string | null;
  placeKind: PlaceKind | null;
  placeName: string | null;
  note: string | null;
};

export type TrackPoint = {
  recordedAt: number;
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  mocked: boolean;
  appState: string | null;
};

export type TesterProfile = { employeeCode: string; employeeName: string; orgUnitName: string };

export type DayStats = {
  pointCount: number;
  keptCount: number;
  poorAccuracyCount: number;
  stopCount: number;
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
  // Máy đã cài bản thử trước có bảng ảnh chưa có các cột này, thêm vào mà không mất ảnh cũ.
  const photoColumns = new Set(
    opened.getAllSync<{ name: string }>('PRAGMA table_info(photos)').map((c) => c.name),
  );
  for (const column of ['address', 'place_kind', 'place_name', 'note']) {
    if (!photoColumns.has(column)) opened.execSync(`ALTER TABLE photos ADD COLUMN ${column} TEXT`);
  }
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

function getMeta(key: string): string | null {
  return (
    getDb().getFirstSync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key)?.value ??
    null
  );
}

function setMeta(key: string, value: string): void {
  getDb().runSync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
}

export function getConsentAt(): number | null {
  const value = getMeta('consent_at');
  return value ? Number(value) : null;
}

export function saveConsent(at: number): void {
  setMeta('consent_at', String(at));
}

/** Bản thử chưa có đăng nhập, người thử tự nhập để file Excel có đủ cột nhân viên. */
export function getTesterProfile(): TesterProfile {
  return {
    employeeCode: getMeta('employee_code') ?? '',
    employeeName: getMeta('employee_name') ?? '',
    orgUnitName: getMeta('org_unit_name') ?? '',
  };
}

export function saveTesterProfile(profile: TesterProfile): void {
  getDb().withTransactionSync(() => {
    setMeta('employee_code', profile.employeeCode.trim());
    setMeta('employee_name', profile.employeeName.trim());
    setMeta('org_unit_name', profile.orgUnitName.trim());
  });
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

export function insertPhoto(photo: {
  takenAt: number;
  lat: number;
  lng: number;
  accuracy: number | null;
  mocked: boolean;
  dataUri: string;
  address: string | null;
}): number {
  const base64Length = photo.dataUri.length - photo.dataUri.indexOf(',') - 1;
  const result = getDb().runSync(
    `INSERT INTO photos (taken_at, lat, lng, accuracy, mocked, size_bytes, data_uri, address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    photo.takenAt,
    photo.lat,
    photo.lng,
    photo.accuracy,
    photo.mocked ? 1 : 0,
    Math.round((base64Length * 3) / 4),
    photo.dataUri,
    photo.address,
  );
  return result.lastInsertRowId;
}

export function updatePhotoPlace(
  id: number,
  place: { kind: PlaceKind; name: string; note: string },
): void {
  getDb().runSync(
    'UPDATE photos SET place_kind = ?, place_name = ?, note = ? WHERE id = ?',
    place.kind,
    place.name.trim() || null,
    place.note.trim() || null,
    id,
  );
}

export function updatePhotoAddress(id: number, address: string): void {
  getDb().runSync('UPDATE photos SET address = ? WHERE id = ?', address, id);
}

export function listPhotosBetween(from: number, to: number): PhotoSummary[] {
  return getDb()
    .getAllSync<Pick<PhotoRow, 'id' | 'taken_at' | 'size_bytes' | 'address' | 'place_name'>>(
      `SELECT id, taken_at, size_bytes, address, place_name FROM photos
       WHERE taken_at >= ? AND taken_at < ? ORDER BY taken_at DESC`,
      from,
      to,
    )
    .map((row) => ({
      id: row.id,
      takenAt: row.taken_at,
      sizeBytes: row.size_bytes,
      address: row.address,
      placeName: row.place_name,
    }));
}

export function getPhotoDataUri(id: number): string | null {
  return (
    getDb().getFirstSync<{ data_uri: string }>('SELECT data_uri FROM photos WHERE id = ?', id)
      ?.data_uri ?? null
  );
}

export function readPhotosBetween(from: number, to: number): PhotoRecord[] {
  return getDb()
    .getAllSync<PhotoRow>(
      'SELECT * FROM photos WHERE taken_at >= ? AND taken_at < ? ORDER BY taken_at',
      from,
      to,
    )
    .map((row) => ({
      id: row.id,
      takenAt: row.taken_at,
      lat: row.lat,
      lng: row.lng,
      accuracy: row.accuracy,
      mocked: row.mocked === 1,
      dataUri: row.data_uri,
      address: row.address,
      placeKind: row.place_kind,
      placeName: row.place_name,
      note: row.note,
    }));
}

function pointsBetween(from: number, to: number): PointRow[] {
  return getDb().getAllSync<PointRow>(
    `SELECT recorded_at, lat, lng, accuracy, speed, mocked, app_state
     FROM track_points WHERE recorded_at >= ? AND recorded_at < ? ORDER BY recorded_at`,
    from,
    to,
  );
}

export function readPointsBetween(from: number, to: number): TrackPoint[] {
  return pointsBetween(from, to).map((p) => ({
    recordedAt: p.recorded_at,
    lat: p.lat,
    lng: p.lng,
    accuracy: p.accuracy,
    speed: p.speed,
    mocked: p.mocked === 1,
    appState: p.app_state,
  }));
}

export type DayTrack = { sessions: SessionRow[]; track: FilteredTrack; points: PointRow[] };

/** Đọc và lọc vết một ngày. Km không cộng đoạn nối giữa hai phiên vì lúc đó app không ghi. */
export function readDayTrack(dayStart: number): DayTrack {
  const dayEnd = dayStart + DAY_MS;
  const points = pointsBetween(dayStart, dayEnd);
  // Phiên mở từ hôm trước vẫn tính cho các điểm sáng nay.
  const sessions = getDb().getAllSync<SessionRow>(
    `SELECT * FROM sessions WHERE started_at < ? AND (ended_at IS NULL OR ended_at >= ?)
     ORDER BY started_at`,
    dayEnd,
    dayStart,
  );
  const starts = sessions.map((s) => s.started_at);
  const raw: RawPoint[] = points.map((p) => ({
    recordedAt: p.recorded_at,
    lat: p.lat,
    lng: p.lng,
    accuracy: p.accuracy,
    segment: segmentOf(starts, p.recorded_at),
  }));
  return { sessions, track: filterTrack(raw), points };
}

export function computeDayStats(dayStart: number): DayStats {
  const dayEnd = dayStart + DAY_MS;
  const { track, points } = readDayTrack(dayStart);
  let mockedCount = 0;
  let backgroundCount = 0;
  for (const point of points) {
    if (point.mocked) mockedCount += 1;
    if (point.app_state && point.app_state !== 'active') backgroundCount += 1;
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
    keptCount: track.kept.length,
    poorAccuracyCount: track.poorAccuracyCount,
    stopCount: track.stopCount,
    mockedCount,
    backgroundCount,
    gpsDistanceM: track.distanceM,
    gapCount: track.gapCount,
    longestGapMinutes: track.longestGapMinutes,
    lastPoint: last ? { recordedAt: last.recorded_at, accuracy: last.accuracy } : null,
    photoCount,
  };
}

/** Các ngày (mốc 00:00 giờ Việt Nam) có điểm GPS hoặc ảnh, mới nhất trước. */
export function listDaysWithData(limit: number): number[] {
  const rows = getDb().getAllSync<{ day: number }>(
    `SELECT day FROM (
       SELECT (recorded_at + ${VN_OFFSET_MS}) / ${DAY_MS} AS day FROM track_points
       UNION SELECT (taken_at + ${VN_OFFSET_MS}) / ${DAY_MS} AS day FROM photos
     ) GROUP BY day ORDER BY day DESC LIMIT ?`,
    limit,
  );
  return rows.map((row) => row.day * DAY_MS - VN_OFFSET_MS);
}

export function clearAllTestData(): void {
  getDb().execSync(
    'DELETE FROM track_points; DELETE FROM photos; DELETE FROM sessions; DELETE FROM task_errors;',
  );
}
