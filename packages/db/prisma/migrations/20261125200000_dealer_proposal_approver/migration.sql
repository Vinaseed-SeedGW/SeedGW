-- 25/11/2026: đề xuất đại lý mới do Quản lý trực tiếp hoặc Lãnh đạo đơn vị duyệt một bước.
-- Chỉ thêm cột, không xoá dữ liệu. Đề xuất đang chờ được gán người duyệt khi đồng bộ người duyệt.
ALTER TABLE "dealer_proposals" ADD COLUMN "current_approver_id" UUID;

ALTER TABLE "dealer_proposals"
  ADD CONSTRAINT "dealer_proposals_current_approver_id_fkey"
  FOREIGN KEY ("current_approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "dealer_proposals_current_approver_id_status_idx"
  ON "dealer_proposals"("current_approver_id", "status");
