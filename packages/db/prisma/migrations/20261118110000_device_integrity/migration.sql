-- M5 (duyet 18/11/2026): tinh trang may app bao ve (root, jailbreak). Chi them cot, khong xoa du lieu.
ALTER TABLE "mobile_devices" ADD COLUMN     "integrity_checked_at" TIMESTAMP(3),
ADD COLUMN     "is_rooted" BOOLEAN;
