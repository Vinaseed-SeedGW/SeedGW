-- V1b (duyet 18/11/2026): danh dau km theo duong uoc tinh va luc tinh. Chi them cot, khong xoa du lieu.
-- AlterTable
ALTER TABLE "check_ins" ADD COLUMN     "is_road_estimated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "road_computed_at" TIMESTAMP(3);

