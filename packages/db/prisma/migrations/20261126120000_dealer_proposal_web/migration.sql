-- 26/11/2026: thêm đại lý trên web cho mọi vai trò. Đề xuất từ web không kèm check-in, toạ độ chọn trên
-- bản đồ nếu có. Chỉ thêm cột và bỏ ràng buộc bắt buộc, không xoá dữ liệu; đề xuất cũ là nguồn App.
CREATE TYPE "dealer_proposal_source" AS ENUM ('APP', 'WEB');

ALTER TABLE "dealer_proposals"
  ADD COLUMN "source" "dealer_proposal_source" NOT NULL DEFAULT 'APP',
  ADD COLUMN "lat" DOUBLE PRECISION,
  ADD COLUMN "lng" DOUBLE PRECISION,
  ADD COLUMN "province_name" TEXT;

ALTER TABLE "dealer_proposals" ALTER COLUMN "check_in_id" DROP NOT NULL;
