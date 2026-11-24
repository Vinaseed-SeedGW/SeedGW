import { Prisma } from '@prisma/client';
import { db } from './client';

// K1: bảng gộp lượt ghé thăm theo ngày giờ Việt Nam. Xoá rồi ghi lại các ngày cần tính trong một giao dịch,
// nên chạy lại bao nhiêu lần cũng ra cùng kết quả. Cách tính giống phần nạp sẵn trong migration daily_visit_stats.

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Tính lại các ngày (yyyy-MM-dd theo giờ Việt Nam). Trả số dòng gộp đã ghi. */
export async function recomputeDailyVisitStats(days: readonly string[]): Promise<number> {
  const list = [...new Set(days)].filter((day) => DAY_PATTERN.test(day)).sort();
  const first = list[0];
  const last = list[list.length - 1];
  if (!first || !last) return 0;
  const dayList = Prisma.join(list.map((day) => Prisma.sql`${day}::date`));
  // Khoảng giờ UTC bao các ngày cần tính, để truy vấn dùng chỉ mục captured_at.
  const from = new Date(`${first}T00:00:00+07:00`);
  const to = new Date(new Date(`${last}T00:00:00+07:00`).getTime() + 86_400_000);
  const [, inserted] = await db.$transaction([
    db.$executeRaw`DELETE FROM "daily_visit_stats" WHERE "day" IN (${dayList})`,
    db.$executeRaw`
      INSERT INTO "daily_visit_stats" ("id", "day", "org_unit_id", "user_id", "place_kind", "province_name",
        "visits", "flagged", "road_km", "road_visits", "gps_km", "gps_visits", "computed_at")
      SELECT gen_random_uuid(), (c."captured_at" + interval '7 hours')::date, c."org_unit_id", c."user_id",
        c."place_kind", d."province_name",
        count(*)::int,
        (count(*) FILTER (WHERE coalesce(cardinality(c."flags"), 0) > 0))::int,
        coalesce(sum(c."road_distance_km"), 0),
        count(c."road_distance_km")::int,
        coalesce(sum(c."gps_distance_km") FILTER (WHERE c."road_distance_km" IS NULL), 0),
        (count(*) FILTER (WHERE c."road_distance_km" IS NULL AND c."gps_distance_km" > 0))::int,
        now()
      FROM "check_ins" c
      LEFT JOIN "dealers" d ON d."id" = c."dealer_id"
      WHERE c."captured_at" >= ${from} AND c."captured_at" < ${to}
        AND (c."captured_at" + interval '7 hours')::date IN (${dayList})
      GROUP BY 2, 3, 4, 5, 6`,
  ]);
  return inserted;
}

/** Các ngày có check-in được tạo hoặc sửa từ mốc này (kể cả check-in gửi trễ khi mất mạng). */
export async function touchedVisitDays(since: Date): Promise<string[]> {
  const rows = await db.$queryRaw<Array<{ day: string }>>`
    SELECT DISTINCT to_char((c."captured_at" + interval '7 hours')::date, 'YYYY-MM-DD') AS "day"
    FROM "check_ins" c
    WHERE c."updated_at" >= ${since} OR c."created_at" >= ${since}`;
  return rows.map((row) => row.day);
}
