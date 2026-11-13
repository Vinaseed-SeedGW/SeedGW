import { formatCoord, formatVnDate, formatVnTime } from './geo';
import { cumulativeAt, FILTER, type FilteredTrack } from './track-filter';
import type { PhotoRecord, PlaceKind, SessionRow, TesterProfile, TrackPoint } from './track-db';
import {
  base64ToBytes,
  buildXlsx,
  excelDateVn,
  jpegSize,
  num,
  text,
  type Cell,
  type Sheet,
  type SheetImage,
  type SheetRow,
} from './xlsx';

// Dựng file Excel báo cáo cự ly một ngày. Tách khỏi phần đọc máy và chia sẻ để chạy thử được trên máy tính.

const HEADER_ROW_INDEX = 4;
const PHOTO_COLUMN = 14;
const PHOTO_WIDTH_PX = 170;

const HEADERS = [
  'STT',
  'Tên đơn vị',
  'Mã nhân viên',
  'Tên nhân viên',
  'Ngày',
  'Thời gian checkin',
  'Địa chỉ',
  'Khách hàng',
  'Tên đại lý',
  'Ghi chú',
  'Khoảng cách (km)',
  'Khoảng cách theo GPS (km)',
  'Toạ độ (bấm để xem bản đồ)',
  'Sai số GPS (m)',
  'Ảnh check-in',
];
const WIDTHS = [6, 22, 14, 24, 12, 11, 42, 22, 22, 32, 12, 14, 24, 9, 26];

const END_REASON_TEXT: Record<NonNullable<SessionRow['end_reason']>, string> = {
  USER: 'bấm Kết thúc ngày',
  AUTO_CUTOFF: 'tự dừng theo giờ',
};

function hhmm(epochMs: number): string {
  return formatVnTime(epochMs).slice(0, 5);
}

function kmValue(meters: number): number {
  return Math.round(meters) / 1000;
}

function placeColumns(kind: PlaceKind | null, name: string | null, note: string | null) {
  const cleanName = name?.trim() ?? '';
  const cleanNote = note?.trim() ?? '';
  if (kind === 'CUSTOMER') return { customer: cleanName, dealer: '', note: cleanNote };
  if (kind === 'DEALER') return { customer: '', dealer: cleanName, note: cleanNote };
  const other = cleanName ? `Điểm khác: ${cleanName}` : '';
  return { customer: '', dealer: '', note: [other, cleanNote].filter(Boolean).join('. ') };
}

function photoImage(photo: PhotoRecord, row: number): SheetImage | null {
  const comma = photo.dataUri.indexOf(',');
  if (comma < 0) return null;
  const jpeg = base64ToBytes(photo.dataUri.slice(comma + 1));
  const size = jpegSize(jpeg);
  if (!size || size.width === 0) return null;
  return {
    row,
    col: PHOTO_COLUMN,
    jpeg,
    widthPx: PHOTO_WIDTH_PX,
    heightPx: Math.round((PHOTO_WIDTH_PX * size.height) / size.width),
  };
}

export type DayReportInput = {
  dayStart: number;
  generatedAt: number;
  profile: TesterProfile;
  photos: PhotoRecord[];
  sessions: SessionRow[];
  track: FilteredTrack;
  points: TrackPoint[];
  missingAddress: number;
};

type Legs = Map<number, number>;

function reportSheet(
  { dayStart, generatedAt, photos, profile }: DayReportInput,
  legMeters: Legs,
): Sheet {
  const lastColumn = 'O';
  const rows: SheetRow[] = [
    { cells: [] },
    { cells: [] },
    { cells: [text('BÁO CÁO CỰ LY DI CHUYỂN', 'title')] },
    {
      cells: [
        text(
          `Ngày ${formatVnDate(dayStart)}. Xuất từ app DMS bản thử R3 lúc ${hhmm(generatedAt)} ngày ${formatVnDate(generatedAt)}.`,
          'plain',
        ),
      ],
    },
    { cells: HEADERS.map((h) => text(h, 'header')), heightPt: 32 },
  ];
  const images: SheetImage[] = [];
  const merges = [`A3:${lastColumn}3`, `A4:${lastColumn}4`];

  // Giữ thứ tự như mẫu: giờ mới nhất ở trên.
  const newestFirst = [...photos].sort((a, b) => b.takenAt - a.takenAt);
  newestFirst.forEach((photo, index) => {
    const place = placeColumns(photo.placeKind, photo.placeName, photo.note);
    const rowIndex = rows.length;
    const image = photoImage(photo, rowIndex);
    if (image) images.push(image);
    const coord = `${formatCoord(photo.lat)}, ${formatCoord(photo.lng)}`;
    const cells: Cell[] = [
      num(index + 1),
      text(profile.orgUnitName),
      text(profile.employeeCode),
      text(profile.employeeName),
      num(excelDateVn(photo.takenAt), 'date'),
      text(hhmm(photo.takenAt)),
      text(
        photo.address ?? 'Chưa lấy được địa chỉ (máy không có mạng lúc chụp và lúc xuất)',
        'text',
      ),
      text(place.customer, 'text'),
      text(place.dealer, 'text'),
      text(
        [place.note, photo.mocked ? 'Vị trí từ ứng dụng giả lập' : ''].filter(Boolean).join('. '),
        'text',
      ),
      text(''),
      num(kmValue(legMeters.get(photo.id) ?? 0), 'km'),
      {
        kind: 'link',
        url: `https://www.google.com/maps/search/?api=1&query=${photo.lat},${photo.lng}`,
        label: coord,
        style: 'link',
      },
      num(Math.round(photo.accuracy ?? 0)),
      text(''),
    ];
    rows.push({ cells, heightPt: image ? Math.round((image.heightPx + 10) * 0.75) : 30 });
  });

  if (photos.length === 0) {
    const r = rows.length + 1;
    rows.push({ cells: [text('Chưa có lượt check-in nào trong ngày.', 'text')] });
    merges.push(`A${r}:${lastColumn}${r}`);
  } else {
    const r = rows.length + 1;
    const total = [...legMeters.values()].reduce((sum, m) => sum + kmValue(m), 0);
    const cells: Cell[] = Array.from({ length: HEADERS.length }, () => text(''));
    cells[0] = text('Tổng', 'header');
    cells[11] = num(Math.round(total * 1000) / 1000, 'km');
    rows.push({ cells, heightPt: 20 });
    merges.push(`A${r}:K${r}`);
  }

  rows.push({ cells: [] });
  for (const note of [
    'Ghi chú cách tính:',
    'Khoảng cách theo GPS là quãng đường từ lượt check-in trước tới lượt này. Lượt đầu ngày bằng 0, giống mẫu cũ.',
    `Đã bỏ điểm GPS sai số trên ${FILTER.maxAccuracyM} m và gộp chỗ đứng yên từ ${FILTER.stopMinSeconds / 60} phút trong bán kính ${FILTER.stopRadiusM} m thành một điểm, để không cộng km giả khi đứng yên.`,
    'Cột Khoảng cách (km) theo đường đi thực tế sẽ có khi nối máy chủ bản đồ (task R4, V1). Bản thử chỉ có km theo GPS.',
    'Địa chỉ lấy từ bản đồ Vietmap theo toạ độ lúc chụp. Chữ "Gần" nghĩa là số nhà gần nhất cách chỗ chụp hơn 100 m.',
  ]) {
    const r = rows.length + 1;
    rows.push({ cells: [text(note, note.endsWith(':') ? 'label' : 'plain')] });
    merges.push(`A${r}:${lastColumn}${r}`);
  }

  return {
    name: 'Báo cáo cự ly',
    columnWidths: WIDTHS,
    rows,
    merges,
    images,
    freezeRows: HEADER_ROW_INDEX + 1,
  };
}

function summarySheet(input: DayReportInput, legMeters: Legs): Sheet {
  const { profile, sessions, track, points } = input;
  const legTotal = [...legMeters.values()].reduce((sum, m) => sum + kmValue(m), 0);
  const background = points.filter((p) => p.appState && p.appState !== 'active').length;
  const mocked = points.filter((p) => p.mocked).length;
  const pairs: [string, string | number][] = [
    ['Nhân viên', profile.employeeName || 'Chưa nhập tên'],
    ['Mã nhân viên', profile.employeeCode || 'Chưa nhập'],
    ['Đơn vị', profile.orgUnitName || 'Chưa nhập'],
    ['Ngày', formatVnDate(input.dayStart)],
    ['Số lượt check-in', input.photos.length],
    ['Km theo GPS giữa các lượt check-in', Math.round(legTotal * 1000) / 1000],
    ['Km theo GPS cả ngày (gồm cả đoạn sau lượt cuối)', kmValue(track.distanceM)],
    ['Số phiên ghi hành trình', sessions.length],
    ...sessions.map((s, i): [string, string] => [
      `Phiên ${i + 1}`,
      s.ended_at === null
        ? `Từ ${hhmm(s.started_at)}, đang ghi`
        : `${hhmm(s.started_at)} đến ${hhmm(s.ended_at)}, ${s.end_reason ? END_REASON_TEXT[s.end_reason] : 'đã dừng'}`,
    ]),
    ['Số điểm GPS', points.length],
    ['Điểm ghi khi app chạy nền', background],
    [`Điểm sai số trên ${FILTER.maxAccuracyM} m (đã bỏ)`, track.poorAccuracyCount],
    ['Chỗ đứng yên đã gộp', track.stopCount],
    [`Đoạn đứt (quá ${FILTER.gapMinutes} phút và quá ${FILTER.gapMeters} m)`, track.gapCount],
    ['Điểm từ ứng dụng giả lập vị trí', mocked],
    ['Ảnh chưa có địa chỉ', input.missingAddress],
  ];
  return {
    name: 'Tổng hợp',
    columnWidths: [48, 40],
    rows: [
      { cells: [text('TỔNG HỢP HÀNH TRÌNH TRONG NGÀY', 'title')] },
      { cells: [] },
      ...pairs.map(([label, value]) => ({
        cells: [
          text(label, 'text'),
          typeof value === 'number'
            ? num(value, Number.isInteger(value) ? 'body' : 'km')
            : text(value, 'text'),
        ],
      })),
    ],
    merges: ['A1:B1'],
  };
}

function pointsSheet(points: readonly TrackPoint[]): Sheet {
  const headers = [
    'Giờ',
    'Vĩ độ',
    'Kinh độ',
    'Sai số (m)',
    'Tốc độ (km/h)',
    'App',
    'Giả lập',
    'Mốc thời gian (ms)',
  ];
  return {
    name: 'Điểm GPS',
    columnWidths: [10, 12, 12, 10, 12, 12, 9, 16],
    freezeRows: 1,
    rows: [
      { cells: headers.map((h) => text(h, 'header')), heightPt: 30 },
      ...points.map((p) => ({
        cells: [
          text(formatVnTime(p.recordedAt)),
          num(Number(formatCoord(p.lat))),
          num(Number(formatCoord(p.lng))),
          p.accuracy === null ? text('') : num(Math.round(p.accuracy * 10) / 10),
          p.speed === null || p.speed < 0 ? text('') : num(Math.round(p.speed * 36) / 10),
          text(p.appState === 'active' ? 'đang mở' : 'chạy nền'),
          text(p.mocked ? 'có' : ''),
          num(p.recordedAt),
        ],
      })),
    ],
  };
}

/** Km theo GPS của từng lượt check-in: từ lượt trước tới lượt này, lượt đầu ngày bằng 0. */
export function legMetersOf(photos: readonly PhotoRecord[], track: FilteredTrack): Legs {
  const legs: Legs = new Map();
  let previous: number | null = null;
  for (const photo of [...photos].sort((a, b) => a.takenAt - b.takenAt)) {
    const cumulative = cumulativeAt(track.kept, photo.takenAt);
    legs.set(photo.id, previous === null ? 0 : Math.max(0, cumulative - previous));
    previous = cumulative;
  }
  return legs;
}

export function buildDayReport(input: DayReportInput): Uint8Array {
  const legs = legMetersOf(input.photos, input.track);
  return buildXlsx([
    reportSheet(input, legs),
    summarySheet(input, legs),
    pointsSheet(input.points),
  ]);
}
