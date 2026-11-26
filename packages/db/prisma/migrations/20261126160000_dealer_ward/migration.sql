-- 26/11/2026: địa chỉ đại lý theo tỉnh và xã, phường mới (từ 01/07/2025), không còn cấp huyện.
-- Chỉ thêm cột, không xoá dữ liệu; đại lý và đề xuất cũ để trống.
ALTER TABLE "dealers" ADD COLUMN "ward_name" TEXT;

ALTER TABLE "dealer_proposals" ADD COLUMN "ward_name" TEXT;
