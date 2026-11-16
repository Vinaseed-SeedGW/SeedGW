-- M4 (16/11/2026): toa do dai ly tu check-in. Chi them cot, bang va quyen moi, khong doi du lieu cu.

-- CreateEnum
CREATE TYPE "dealer_location_proposal_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "check_ins" ADD COLUMN     "dealer_distance_m" DOUBLE PRECISION,
ADD COLUMN     "far_reason" TEXT;

-- CreateTable
CREATE TABLE "dealer_location_proposals" (
    "id" UUID NOT NULL,
    "dealer_id" UUID NOT NULL,
    "org_unit_id" UUID,
    "check_in_id" UUID NOT NULL,
    "proposed_by_id" UUID NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracy_m" DOUBLE PRECISION,
    "status" "dealer_location_proposal_status" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealer_location_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dealer_location_proposals_check_in_id_key" ON "dealer_location_proposals"("check_in_id");

-- CreateIndex
CREATE INDEX "dealer_location_proposals_status_org_unit_id_created_at_idx" ON "dealer_location_proposals"("status", "org_unit_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "dealer_location_proposals_dealer_id_idx" ON "dealer_location_proposals"("dealer_id");

-- AddForeignKey
ALTER TABLE "dealer_location_proposals" ADD CONSTRAINT "dealer_location_proposals_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_location_proposals" ADD CONSTRAINT "dealer_location_proposals_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_location_proposals" ADD CONSTRAINT "dealer_location_proposals_check_in_id_fkey" FOREIGN KEY ("check_in_id") REFERENCES "check_ins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_location_proposals" ADD CONSTRAINT "dealer_location_proposals_proposed_by_id_fkey" FOREIGN KEY ("proposed_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_location_proposals" ADD CONSTRAINT "dealer_location_proposals_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Moi dai ly chi co mot de xuat toa do cho duyet; lan check-in sau khi con de xuat cho duyet thi bo qua.
CREATE UNIQUE INDEX "dealer_location_proposals_one_pending_idx" ON "dealer_location_proposals"("dealer_id")
WHERE "status" = 'PENDING';

-- Quyen duyet toa do cho Quan tri he thong va Quan tri don vi (theo ROLE_PRESETS).
INSERT INTO "permissions" ("id", "code", "name")
VALUES (gen_random_uuid(), 'admin.dealer-location.approve', 'Duyệt toạ độ Đại lý')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r
WHERE p."code" = 'admin.dealer-location.approve' AND r."code" IN ('admin', 'operations')
ON CONFLICT DO NOTHING;
