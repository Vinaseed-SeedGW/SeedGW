-- K3 (23/11/2026): giao chi tieu tu tren xuong va lich vu. Chi them bang va quyen moi, khong doi du lieu cu.

-- CreateEnum
CREATE TYPE "target_assignee_kind" AS ENUM ('UNIT', 'USER');

-- CreateTable
CREATE TABLE "assigned_sales_targets" (
    "id" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "kind" "target_assignee_kind" NOT NULL,
    "org_unit_id" UUID,
    "user_id" UUID,
    "visit_count_target" INTEGER NOT NULL,
    "dealer_coverage_target" INTEGER NOT NULL,
    "sales_kg_target" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "assigned_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assigned_sales_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assigned_sales_targets_month_org_unit_id_idx" ON "assigned_sales_targets"("month", "org_unit_id");

-- CreateIndex
CREATE INDEX "assigned_sales_targets_month_user_id_idx" ON "assigned_sales_targets"("month", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_name_key" ON "seasons"("name");

-- CreateIndex
CREATE INDEX "seasons_start_date_end_date_idx" ON "seasons"("start_date", "end_date");

-- AddForeignKey
ALTER TABLE "assigned_sales_targets" ADD CONSTRAINT "assigned_sales_targets_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assigned_sales_targets" ADD CONSTRAINT "assigned_sales_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assigned_sales_targets" ADD CONSTRAINT "assigned_sales_targets_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Dong UNIT gan don vi, dong USER gan nhan vien (kem don vi luc giao de ap pham vi).
ALTER TABLE "assigned_sales_targets" ADD CONSTRAINT "assigned_sales_targets_assignee_check"
  CHECK (("kind" = 'UNIT' AND "org_unit_id" IS NOT NULL AND "user_id" IS NULL)
      OR ("kind" = 'USER' AND "user_id" IS NOT NULL));

-- Moi don vi, moi nhan vien chi mot chi tieu duoc giao moi thang.
CREATE UNIQUE INDEX "assigned_sales_targets_unit_month_key" ON "assigned_sales_targets"("month", "org_unit_id")
WHERE "kind" = 'UNIT';
CREATE UNIQUE INDEX "assigned_sales_targets_user_month_key" ON "assigned_sales_targets"("month", "user_id")
WHERE "kind" = 'USER';

-- Quyen giao chi tieu cho Quan tri he thong va Lanh dao don vi; sua Lich vu chi Quan tri he thong (theo ROLE_PRESETS).
INSERT INTO "permissions" ("id", "code", "name")
VALUES
  (gen_random_uuid(), 'sales.target.assign', 'Giao Chỉ tiêu cho đơn vị và nhân viên'),
  (gen_random_uuid(), 'admin.season.manage', 'Sửa Lịch vụ')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r
WHERE p."code" = 'sales.target.assign' AND r."code" IN ('admin', 'unit-leader')
ON CONFLICT DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r
WHERE p."code" = 'admin.season.manage' AND r."code" = 'admin'
ON CONFLICT DO NOTHING;

