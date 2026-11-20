-- M10 (20/11/2026): de xuat dai ly moi tren app. Chi them bang va quyen moi, khong doi du lieu cu.

-- CreateEnum
CREATE TYPE "dealer_proposal_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE');

-- CreateTable
CREATE TABLE "dealer_proposals" (
    "id" UUID NOT NULL,
    "check_in_id" UUID NOT NULL,
    "org_unit_id" UUID,
    "proposed_by_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "owner_name" TEXT,
    "tax_code" TEXT,
    "level" INTEGER NOT NULL,
    "status" "dealer_proposal_status" NOT NULL DEFAULT 'PENDING',
    "dealer_id" UUID,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealer_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dealer_proposals_check_in_id_key" ON "dealer_proposals"("check_in_id");

-- CreateIndex
CREATE INDEX "dealer_proposals_status_org_unit_id_created_at_idx" ON "dealer_proposals"("status", "org_unit_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "dealer_proposals_proposed_by_id_created_at_idx" ON "dealer_proposals"("proposed_by_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "dealer_proposals_phone_idx" ON "dealer_proposals"("phone");

-- AddForeignKey
ALTER TABLE "dealer_proposals" ADD CONSTRAINT "dealer_proposals_check_in_id_fkey" FOREIGN KEY ("check_in_id") REFERENCES "check_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_proposals" ADD CONSTRAINT "dealer_proposals_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_proposals" ADD CONSTRAINT "dealer_proposals_proposed_by_id_fkey" FOREIGN KEY ("proposed_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_proposals" ADD CONSTRAINT "dealer_proposals_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_proposals" ADD CONSTRAINT "dealer_proposals_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Quyen de xuat cho cac vai tro check-in, quyen duyet cho Quan tri he thong va Quan tri don vi (theo ROLE_PRESETS).
INSERT INTO "permissions" ("id", "code", "name")
VALUES
  (gen_random_uuid(), 'sales.dealer.propose', 'Đề xuất Đại lý mới trên app'),
  (gen_random_uuid(), 'admin.dealer-proposal.approve', 'Duyệt Đại lý mới')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r
WHERE p."code" = 'sales.dealer.propose'
  AND r."code" IN ('admin', 'operations', 'unit-leader', 'manager', 'staff')
ON CONFLICT DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r
WHERE p."code" = 'admin.dealer-proposal.approve' AND r."code" IN ('admin', 'operations')
ON CONFLICT DO NOTHING;
