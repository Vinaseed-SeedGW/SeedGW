-- S8 (duyet 17/11/2026): tuyen theo tuan hoac theo ngay, kieu tuyen cua don vi, quyen dang ky tuyen.
-- Chi them bang va cot, khong xoa du lieu.

-- CreateEnum
CREATE TYPE "route_kind" AS ENUM ('WEEKLY', 'DAILY');

-- AlterTable
ALTER TABLE "org_units" ADD COLUMN     "route_kind" "route_kind" NOT NULL DEFAULT 'WEEKLY';

-- CreateTable
CREATE TABLE "route_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "org_unit_id" UUID,
    "kind" "route_kind" NOT NULL,
    "period_start" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "current_revision" INTEGER NOT NULL DEFAULT 0,
    "approved_revision" INTEGER,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_plan_stops" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "day" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "dealer_id" UUID NOT NULL,

    CONSTRAINT "route_plan_stops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "route_plans_org_unit_id_period_start_idx" ON "route_plans"("org_unit_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "route_plans_user_id_kind_period_start_key" ON "route_plans"("user_id", "kind", "period_start");

-- CreateIndex
CREATE INDEX "route_plan_stops_dealer_id_idx" ON "route_plan_stops"("dealer_id");

-- CreateIndex
CREATE UNIQUE INDEX "route_plan_stops_plan_id_revision_day_position_key" ON "route_plan_stops"("plan_id", "revision", "day", "position");

-- AddForeignKey
ALTER TABLE "route_plans" ADD CONSTRAINT "route_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_plans" ADD CONSTRAINT "route_plans_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_plan_stops" ADD CONSTRAINT "route_plan_stops_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "route_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_plan_stops" ADD CONSTRAINT "route_plan_stops_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Dang ky tuyen cua minh: NVKD, Quan ly, Lanh dao don vi (va admin). Quan tri don vi chi xem.
INSERT INTO "permissions" ("id", "code", "name")
VALUES (gen_random_uuid(), 'sales.route.register', 'Đăng ký Tuyến của mình')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r
WHERE p."code" = 'sales.route.register' AND r."code" IN ('admin', 'unit-leader', 'manager', 'staff')
ON CONFLICT DO NOTHING;
