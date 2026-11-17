-- F3b (17/11/2026, quyet dinh 31): pham vi TEAM cho vai tro Quan ly va o Co cap Quan ly cua don vi.
-- Chi them gia tri va cot moi, khong doi du lieu cu. Gia tri TEAM dung o migration sau vi Postgres
-- khong cho dung gia tri enum vua them trong cung giao dich.

-- AlterEnum
ALTER TYPE "data_scope" ADD VALUE 'TEAM' BEFORE 'ORG_UNIT';

-- AlterTable
ALTER TABLE "org_units" ADD COLUMN     "has_manager_level" BOOLEAN NOT NULL DEFAULT false;
