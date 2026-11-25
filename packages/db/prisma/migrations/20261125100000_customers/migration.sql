-- S1: khách hàng nông dân, hợp tác xã (25/11/2026). Chỉ thêm bảng và cột mới, không đổi dữ liệu cũ.

-- CreateEnum
CREATE TYPE "customer_kind" AS ENUM ('FARMER', 'COOPERATIVE');

-- AlterTable
ALTER TABLE "check_ins" ADD COLUMN     "customer_id" UUID;

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "customer_kind" NOT NULL DEFAULT 'FARMER',
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "province_name" TEXT,
    "address" TEXT NOT NULL DEFAULT '',
    "crops" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "area_ha" DOUBLE PRECISION,
    "note" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "last_visited_at" TIMESTAMP(3),
    "org_unit_id" UUID,
    "assigned_user_id" UUID,
    "created_by_id" UUID,
    -- Tìm không dấu theo mã, tên, số điện thoại.
    "search_text" TEXT GENERATED ALWAYS AS (lower(immutable_unaccent("code" || ' ' || "name" || ' ' || coalesce("phone", '')))) STORED,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_dealers" (
    "customer_id" UUID NOT NULL,
    "dealer_id" UUID NOT NULL,

    CONSTRAINT "customer_dealers_pkey" PRIMARY KEY ("customer_id","dealer_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE INDEX "customers_search_text_trgm_idx" ON "customers" USING GIN ("search_text" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "customers_org_unit_id_idx" ON "customers"("org_unit_id");

-- CreateIndex
CREATE INDEX "customers_assigned_user_id_idx" ON "customers"("assigned_user_id");

-- CreateIndex
CREATE INDEX "customers_province_name_idx" ON "customers"("province_name");

-- CreateIndex
CREATE INDEX "customer_dealers_dealer_id_idx" ON "customer_dealers"("dealer_id");

-- CreateIndex
CREATE INDEX "check_ins_customer_id_captured_at_idx" ON "check_ins"("customer_id", "captured_at" DESC);

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_dealers" ADD CONSTRAINT "customer_dealers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_dealers" ADD CONSTRAINT "customer_dealers_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Dải mã khách hàng KH00001 tới KH99999.
INSERT INTO "code_sequences" ("id", "key", "prefix", "digits", "range_start", "range_end", "next_value", "updated_at")
VALUES (gen_random_uuid(), 'customer', 'KH', 5, 1, 99999, 1, now())
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "permissions" ("id", "code", "name")
VALUES
  (gen_random_uuid(), 'sales.customer.create', 'Thêm Khách hàng'),
  (gen_random_uuid(), 'sales.customer.update', 'Sửa Khách hàng')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r
WHERE p."code" IN ('sales.customer.create', 'sales.customer.update')
  AND r."code" IN ('admin', 'operations', 'unit-leader', 'manager', 'staff')
ON CONFLICT DO NOTHING;
