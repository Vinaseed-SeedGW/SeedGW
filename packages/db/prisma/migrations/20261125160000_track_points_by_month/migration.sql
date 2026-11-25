-- D5 (25/11/2026, người dùng đồng ý): chia bảng điểm GPS theo tháng. Khoảng 800.000 điểm mỗi ngày với 300 người;
-- chia theo tháng để tìm theo ngày nhanh và xoá điểm quá 45 ngày bằng cách bỏ cả tháng thay vì xoá từng dòng.
-- Chuyển dữ liệu: đổi tên bảng cũ, tạo bảng chia tháng, chép sang, bỏ bảng cũ. Sao lưu CSDL trước khi chạy.

ALTER TABLE "track_points" RENAME TO "track_points_old";
ALTER TABLE "track_points_old" RENAME CONSTRAINT "track_points_pkey" TO "track_points_old_pkey";
ALTER TABLE "track_points_old" RENAME CONSTRAINT "track_points_user_id_fkey" TO "track_points_old_user_id_fkey";
ALTER INDEX "track_points_user_id_recorded_at_key" RENAME TO "track_points_old_user_id_recorded_at_key";

CREATE TABLE "track_points" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracy_m" DOUBLE PRECISION,
    "speed_mps" DOUBLE PRECISION,
    "is_mocked" BOOLEAN NOT NULL,
    "is_background" BOOLEAN NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Bảng chia theo recorded_at nên khoá chính và khoá duy nhất phải gồm recorded_at.
    CONSTRAINT "track_points_pkey" PRIMARY KEY ("id", "recorded_at")
) PARTITION BY RANGE ("recorded_at");

CREATE UNIQUE INDEX "track_points_user_id_recorded_at_key" ON "track_points"("user_id", "recorded_at");

ALTER TABLE "track_points" ADD CONSTRAINT "track_points_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Điểm có giờ máy sai lệch ra ngoài các tháng đã tạo vẫn nhận, nằm ở bảng mặc định.
CREATE TABLE "track_points_default" PARTITION OF "track_points" DEFAULT;

-- Tạo bảng tháng từ tháng có điểm cũ nhất tới 2 tháng sau tháng hiện tại; worker tạo tiếp mỗi đêm.
DO $$
DECLARE
  first_month DATE := date_trunc('month', COALESCE((SELECT min("recorded_at") FROM "track_points_old"), now()))::date;
  last_month DATE := (date_trunc('month', now()) + interval '2 months')::date;
  month DATE := first_month;
BEGIN
  WHILE month <= last_month LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF "track_points" FOR VALUES FROM (%L) TO (%L)',
      'track_points_' || to_char(month, 'YYYY_MM'),
      month,
      (month + interval '1 month')::date
    );
    month := (month + interval '1 month')::date;
  END LOOP;
END $$;

INSERT INTO "track_points" SELECT
  "id", "user_id", "recorded_at", "lat", "lng", "accuracy_m", "speed_mps", "is_mocked", "is_background", "received_at"
FROM "track_points_old";

DROP TABLE "track_points_old";
