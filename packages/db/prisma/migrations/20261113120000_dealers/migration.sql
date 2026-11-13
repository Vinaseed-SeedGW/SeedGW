-- CreateEnum
CREATE TYPE "dealer_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "check_ins" ADD COLUMN     "dealer_id" UUID;

-- CreateTable
CREATE TABLE "dealers" (
    "id" UUID NOT NULL,
    "code" TEXT,
    "legacy_code" TEXT,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "parent_id" UUID,
    "tax_code" TEXT,
    "status" "dealer_status" NOT NULL DEFAULT 'ACTIVE',
    "phone" TEXT,
    "phone_raw" TEXT,
    "owner_name" TEXT,
    "owner_phone" TEXT,
    "address" TEXT NOT NULL,
    "province_name" TEXT,
    "legacy_admin_area" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "located_at" TIMESTAMP(3),
    "org_unit_id" UUID,
    "assigned_user_id" UUID,
    "legacy_org_unit_name" TEXT,
    "legacy_assignee_name" TEXT,
    -- Tim kiem khong dau theo ma FAST, ma DMS cu, ten, so dien thoai, ma so thue.
    "search_text" TEXT GENERATED ALWAYS AS (lower(immutable_unaccent(coalesce("code", '') || ' ' || coalesce("legacy_code", '') || ' ' || "name" || ' ' || coalesce("phone", '') || ' ' || coalesce("owner_phone", '') || ' ' || coalesce("tax_code", '')))) STORED,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dealers_code_key" ON "dealers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "dealers_legacy_code_key" ON "dealers"("legacy_code");

-- CreateIndex
CREATE INDEX "dealers_search_text_trgm_idx" ON "dealers" USING GIN ("search_text" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "dealers_org_unit_id_idx" ON "dealers"("org_unit_id");

-- CreateIndex
CREATE INDEX "dealers_assigned_user_id_idx" ON "dealers"("assigned_user_id");

-- CreateIndex
CREATE INDEX "dealers_parent_id_idx" ON "dealers"("parent_id");

-- CreateIndex
CREATE INDEX "check_ins_dealer_id_captured_at_idx" ON "check_ins"("dealer_id", "captured_at" DESC);

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "dealers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Quyen moi cua A7. Sua dai ly cap cho vai tro dang co quyen Them dai ly, quan ly danh muc cap cho Quan tri he thong.
INSERT INTO "permissions" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'sales.dealer.update', 'Sửa Đại lý'),
  (gen_random_uuid(), 'admin.dealer.manage', 'Quản lý danh mục Đại lý')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", rp."B"
FROM "permissions" p
JOIN "permissions" source ON source."code" = 'sales.dealer.create'
JOIN "_role_permissions" rp ON rp."A" = source."id"
WHERE p."code" = 'sales.dealer.update'
ON CONFLICT DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id"
FROM "permissions" p, "roles" r
WHERE p."code" = 'admin.dealer.manage' AND r."code" = 'admin'
ON CONFLICT DO NOTHING;
