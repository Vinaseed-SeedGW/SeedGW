-- K0 (17/11/2026): lan ghe gan nhat cua dai ly cho dashboard. Them cot va chi muc, dien gia tri tu check-in da co.

-- AlterTable
ALTER TABLE "dealers" ADD COLUMN     "last_visited_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "dealers_status_level_last_visited_at_idx" ON "dealers"("status", "level", "last_visited_at");


-- Dien lan ghe gan nhat tu cac luot check-in da co, chi ghi vao cot moi.
UPDATE "dealers" d SET "last_visited_at" = v.last
FROM (SELECT "dealer_id", MAX("captured_at") AS last FROM "check_ins" WHERE "dealer_id" IS NOT NULL GROUP BY "dealer_id") v
WHERE d."id" = v."dealer_id";
