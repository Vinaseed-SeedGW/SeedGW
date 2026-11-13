import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { reverseGeocode } from '../api/reverse-geocode';
import { buildDayReport } from './day-report-sheets';
import { vnDayKey } from './geo';
import {
  getTesterProfile,
  readDayTrack,
  readPhotosBetween,
  readPointsBetween,
  updatePhotoAddress,
  type PhotoRecord,
} from './track-db';

const DAY_MS = 86_400_000;
// Mỗi lần xuất chỉ hỏi địa chỉ còn thiếu cho số ảnh này, tránh treo khi mạng yếu.
const MAX_ADDRESS_BACKFILL = 30;

/** Ảnh chụp lúc mất mạng chưa có địa chỉ: hỏi lại lúc xuất, có mạng thì lưu luôn vào máy. */
async function fillMissingAddresses(photos: PhotoRecord[]): Promise<number> {
  let missing = 0;
  let asked = 0;
  for (const photo of photos) {
    if (photo.address) continue;
    if (asked >= MAX_ADDRESS_BACKFILL) {
      missing += 1;
      continue;
    }
    asked += 1;
    const result = await reverseGeocode(photo);
    if (result.ok) {
      photo.address = result.address;
      updatePhotoAddress(photo.id, result.address);
    } else {
      missing += 1;
    }
  }
  return missing;
}

export type ExportResult =
  | { ok: true; fileName: string; checkIns: number; missingAddress: number }
  | { ok: false; message: string };

/** Dựng file Excel báo cáo cự ly một ngày rồi mở bảng chia sẻ để lưu vào Tệp, gửi Zalo, Mail. */
export async function shareDayReport(dayStart: number): Promise<ExportResult> {
  const dayEnd = dayStart + DAY_MS;
  const photos = readPhotosBetween(dayStart, dayEnd);
  const missingAddress = await fillMissingAddresses(photos);
  const { sessions, track } = readDayTrack(dayStart);
  const points = readPointsBetween(dayStart, dayEnd);

  try {
    const bytes = buildDayReport({
      dayStart,
      generatedAt: Date.now(),
      profile: getTesterProfile(),
      photos,
      sessions,
      track,
      points,
      missingAddress,
    });
    const fileName = `Bao-cao-cu-ly-di-chuyen_${vnDayKey(dayStart)}.xlsx`;
    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create();
    await file.write(bytes);
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, message: 'Máy này không mở được bảng chia sẻ file.' };
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
      dialogTitle: 'Gửi báo cáo cự ly',
    });
    return { ok: true, fileName, checkIns: photos.length, missingAddress };
  } catch (cause) {
    return {
      ok: false,
      message: `Không tạo được file Excel: ${cause instanceof Error ? cause.message : 'lỗi không rõ'}.`,
    };
  }
}
