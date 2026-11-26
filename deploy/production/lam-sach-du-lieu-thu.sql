-- Làm sạch dữ liệu đợt thử sau khi khôi phục bản sao lưu máy chủ thử sang máy chủ thật (chốt 26/11/2026).
-- CHỈ chạy trên máy chủ thật, một lần, ngay sau restore.sh. Chạy trong một giao dịch: lỗi ở đâu thì không đổi gì.
--   docker compose -f deploy/production/docker-compose.yml -p seedgw exec -T postgres \
--     sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < deploy/production/lam-sach-du-lieu-thu.sql
--
-- Giữ: cơ cấu tổ chức, 291 nhân viên thật, đại lý (cả toạ độ đã duyệt), vùng tỉnh, lịch vụ, tham số, chỉ tiêu,
-- tuyến, yêu cầu Hỗ trợ, nhật ký thao tác, sổ đồng ý dữ liệu cá nhân (sổ chỉ ghi thêm, không xoá được).
-- Khoá (không xoá vì còn gắn nhật ký và sổ đồng ý): tài khoản mẫu QT001, KD001, CS001, LD001, QL001.
-- Xoá: lượt check-in thử và mọi thứ đi kèm (điểm GPS, phiên ghi, đề xuất đại lý và toạ độ từ check-in, số liệu
-- gộp theo ngày), phiên đăng nhập app và mã nhận thông báo của tài khoản mẫu.
-- ADMIN vẫn giữ để đăng nhập lần đầu; đổi mật khẩu ADMIN ngay trên web sau khi chạy.

BEGIN;

\echo 'Truoc khi lam sach:'
SELECT
  (SELECT count(*) FROM users) AS tai_khoan,
  (SELECT count(*) FROM dealers) AS dai_ly,
  (SELECT count(*) FROM check_ins) AS check_in,
  (SELECT count(*) FROM track_points) AS diem_gps;

-- Tài khoản mẫu: khoá, bỏ phiên đăng nhập app và mã nhận thông báo.
CREATE TEMP TABLE sample_users ON COMMIT DROP AS
  SELECT id FROM users WHERE employee_code IN ('QT001', 'KD001', 'CS001', 'LD001', 'QL001');

UPDATE users SET is_active = false WHERE id IN (SELECT id FROM sample_users);
DELETE FROM mobile_refresh_tokens WHERE user_id IN (SELECT id FROM sample_users);
DELETE FROM push_tokens WHERE user_id IN (SELECT id FROM sample_users);
-- Đại lý và khách hàng đang giao cho tài khoản mẫu chuyển về chờ gán.
UPDATE dealers SET assigned_user_id = NULL WHERE assigned_user_id IN (SELECT id FROM sample_users);
UPDATE customers SET assigned_user_id = NULL WHERE assigned_user_id IN (SELECT id FROM sample_users);

-- Check-in thử. Đề xuất đại lý mới và đề xuất toạ độ kèm check-in tự xoá theo (ON DELETE CASCADE).
DELETE FROM track_points;
DELETE FROM track_sessions;
DELETE FROM check_ins;
DELETE FROM daily_visit_stats;
UPDATE dealers SET last_visited_at = NULL WHERE last_visited_at IS NOT NULL;

\echo 'Sau khi lam sach:'
SELECT
  (SELECT count(*) FROM users WHERE is_active) AS tai_khoan_hoat_dong,
  (SELECT count(*) FROM users WHERE NOT is_active) AS tai_khoan_khoa,
  (SELECT count(*) FROM dealers) AS dai_ly,
  (SELECT count(*) FROM check_ins) AS check_in,
  (SELECT count(*) FROM track_points) AS diem_gps;

COMMIT;
