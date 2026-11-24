-- AlterTable
ALTER TABLE "seasons" ADD COLUMN     "region_id" UUID;

-- CreateTable
CREATE TABLE "regions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "province_regions" (
    "province_name" TEXT NOT NULL,
    "region_id" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "province_regions_pkey" PRIMARY KEY ("province_name")
);

-- CreateTable
CREATE TABLE "org_unit_provinces" (
    "org_unit_id" UUID NOT NULL,
    "province_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_unit_provinces_pkey" PRIMARY KEY ("org_unit_id","province_name")
);

-- CreateIndex
CREATE UNIQUE INDEX "regions_name_key" ON "regions"("name");

-- CreateIndex
CREATE INDEX "province_regions_region_id_idx" ON "province_regions"("region_id");

-- CreateIndex
CREATE INDEX "org_unit_provinces_province_name_idx" ON "org_unit_provinces"("province_name");

-- CreateIndex
CREATE INDEX "dealers_province_name_idx" ON "dealers"("province_name");

-- CreateIndex
CREATE INDEX "seasons_region_id_idx" ON "seasons"("region_id");

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "province_regions" ADD CONSTRAINT "province_regions_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_unit_provinces" ADD CONSTRAINT "org_unit_provinces_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- 7 vung canh tac va 34 tinh moi (duyet 23/11/2026). Tinh moi gop tu tinh cu o hai vung xep theo phan trong
-- lua chinh; Quan tri he thong doi duoc o trang Vung va tinh.
INSERT INTO "regions" ("id", "name", "sort_order", "updated_at")
VALUES
  (gen_random_uuid(), 'Đồng bằng sông Hồng', 1, now()),
  (gen_random_uuid(), 'Trung du và Miền núi phía Bắc', 2, now()),
  (gen_random_uuid(), 'Bắc Trung Bộ', 3, now()),
  (gen_random_uuid(), 'Duyên hải Nam Trung Bộ', 4, now()),
  (gen_random_uuid(), 'Tây Nguyên', 5, now()),
  (gen_random_uuid(), 'Đông Nam Bộ', 6, now()),
  (gen_random_uuid(), 'Đồng bằng sông Cửu Long', 7, now())
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "province_regions" ("province_name", "region_id", "updated_at")
SELECT m.province_name, r."id", now()
FROM (VALUES
  ('Thành phố Hà Nội', 'Đồng bằng sông Hồng'),
  ('Thành phố Hải Phòng', 'Đồng bằng sông Hồng'),
  ('Tỉnh Hưng Yên', 'Đồng bằng sông Hồng'),
  ('Tỉnh Ninh Bình', 'Đồng bằng sông Hồng'),
  ('Tỉnh Bắc Ninh', 'Đồng bằng sông Hồng'),
  ('Tỉnh Quảng Ninh', 'Đồng bằng sông Hồng'),
  ('Tỉnh Lai Châu', 'Trung du và Miền núi phía Bắc'),
  ('Tỉnh Điện Biên', 'Trung du và Miền núi phía Bắc'),
  ('Tỉnh Sơn La', 'Trung du và Miền núi phía Bắc'),
  ('Tỉnh Lạng Sơn', 'Trung du và Miền núi phía Bắc'),
  ('Tỉnh Cao Bằng', 'Trung du và Miền núi phía Bắc'),
  ('Tỉnh Tuyên Quang', 'Trung du và Miền núi phía Bắc'),
  ('Tỉnh Lào Cai', 'Trung du và Miền núi phía Bắc'),
  ('Tỉnh Thái Nguyên', 'Trung du và Miền núi phía Bắc'),
  ('Tỉnh Phú Thọ', 'Trung du và Miền núi phía Bắc'),
  ('Tỉnh Thanh Hóa', 'Bắc Trung Bộ'),
  ('Tỉnh Nghệ An', 'Bắc Trung Bộ'),
  ('Tỉnh Hà Tĩnh', 'Bắc Trung Bộ'),
  ('Tỉnh Quảng Trị', 'Bắc Trung Bộ'),
  ('Thành phố Huế', 'Bắc Trung Bộ'),
  ('Thành phố Đà Nẵng', 'Duyên hải Nam Trung Bộ'),
  ('Tỉnh Quảng Ngãi', 'Duyên hải Nam Trung Bộ'),
  ('Tỉnh Khánh Hòa', 'Duyên hải Nam Trung Bộ'),
  ('Tỉnh Gia Lai', 'Duyên hải Nam Trung Bộ'),
  ('Tỉnh Đắk Lắk', 'Tây Nguyên'),
  ('Tỉnh Lâm Đồng', 'Tây Nguyên'),
  ('Thành phố Hồ Chí Minh', 'Đông Nam Bộ'),
  ('Tỉnh Đồng Nai', 'Đông Nam Bộ'),
  ('Tỉnh Tây Ninh', 'Đông Nam Bộ'),
  ('Thành phố Cần Thơ', 'Đồng bằng sông Cửu Long'),
  ('Tỉnh Vĩnh Long', 'Đồng bằng sông Cửu Long'),
  ('Tỉnh Đồng Tháp', 'Đồng bằng sông Cửu Long'),
  ('Tỉnh Cà Mau', 'Đồng bằng sông Cửu Long'),
  ('Tỉnh An Giang', 'Đồng bằng sông Cửu Long')
) AS m(province_name, region_name)
JOIN "regions" r ON r."name" = m.region_name
ON CONFLICT ("province_name") DO NOTHING;

-- Quyen xem, sua Vung va tinh cho Quan tri he thong (theo ROLE_PRESETS).
INSERT INTO "permissions" ("id", "code", "name")
VALUES
  (gen_random_uuid(), 'admin.region.read', 'Xem Vùng và tỉnh'),
  (gen_random_uuid(), 'admin.region.manage', 'Sửa Vùng và tỉnh')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r
WHERE p."code" IN ('admin.region.read', 'admin.region.manage') AND r."code" = 'admin'
ON CONFLICT DO NOTHING;
