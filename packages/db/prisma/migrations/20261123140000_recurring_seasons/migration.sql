-- K3 (23/11/2026): lich vu lap lai moi nam theo ngay, thang. Nguoi dung duyet 23/11/2026 viec bo cot ngay co
-- nam (start_date, end_date) va bo nam khoi ten vu. Chuyen du lieu cu: giu ngay, thang.

ALTER TABLE "seasons"
  ADD COLUMN "start_day" INTEGER,
  ADD COLUMN "start_month" INTEGER,
  ADD COLUMN "end_day" INTEGER,
  ADD COLUMN "end_month" INTEGER;

UPDATE "seasons" SET
  "start_day" = EXTRACT(DAY FROM "start_date")::INTEGER,
  "start_month" = EXTRACT(MONTH FROM "start_date")::INTEGER,
  "end_day" = EXTRACT(DAY FROM "end_date")::INTEGER,
  "end_month" = EXTRACT(MONTH FROM "end_date")::INTEGER,
  -- "Đông Xuân 2026-2027, ĐBSCL" thanh "Đông Xuân, ĐBSCL"; "Hè Thu 2027, Tây Nguyên" thanh "Hè Thu, Tây Nguyên".
  "name" = regexp_replace("name", '\s+\d{4}(-\d{4})?(?=,|$)', '', 'g');

-- 29/02 khong dung duoc vi nam thuong khong co.
UPDATE "seasons" SET "start_day" = 28 WHERE "start_month" = 2 AND "start_day" = 29;
UPDATE "seasons" SET "end_day" = 28 WHERE "end_month" = 2 AND "end_day" = 29;

ALTER TABLE "seasons"
  ALTER COLUMN "start_day" SET NOT NULL,
  ALTER COLUMN "start_month" SET NOT NULL,
  ALTER COLUMN "end_day" SET NOT NULL,
  ALTER COLUMN "end_month" SET NOT NULL;

DROP INDEX IF EXISTS "seasons_start_date_end_date_idx";
ALTER TABLE "seasons" DROP COLUMN "start_date", DROP COLUMN "end_date";
