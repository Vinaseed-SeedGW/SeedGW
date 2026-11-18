-- A7b (duyet 18/11/2026): gop dai ly trung (khong xoa, chuyen Ngung hoat dong), danh dau khong phai trung,
-- quyen admin.dealer.cleanup cho Quan tri he thong va Quan tri don vi. Chi them cot, bang, khong xoa du lieu.

-- AlterTable
ALTER TABLE "dealers" ADD COLUMN     "merged_into_id" UUID;

-- CreateTable
CREATE TABLE "dealer_merges" (
    "id" UUID NOT NULL,
    "kept_id" UUID NOT NULL,
    "merged_id" UUID NOT NULL,
    "actor_id" UUID,
    "moved_check_ins" INTEGER NOT NULL DEFAULT 0,
    "moved_stops" INTEGER NOT NULL DEFAULT 0,
    "moved_proposals" INTEGER NOT NULL DEFAULT 0,
    "moved_children" INTEGER NOT NULL DEFAULT 0,
    "filled_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_merges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_duplicate_dismissals" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "dismissed_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_duplicate_dismissals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dealer_merges_kept_id_idx" ON "dealer_merges"("kept_id");

-- CreateIndex
CREATE INDEX "dealer_merges_merged_id_idx" ON "dealer_merges"("merged_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_duplicate_dismissals_kind_value_key" ON "dealer_duplicate_dismissals"("kind", "value");

-- AddForeignKey
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "dealers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_merges" ADD CONSTRAINT "dealer_merges_kept_id_fkey" FOREIGN KEY ("kept_id") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_merges" ADD CONSTRAINT "dealer_merges_merged_id_fkey" FOREIGN KEY ("merged_id") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;


INSERT INTO "permissions" ("id", "code", "name")
VALUES (gen_random_uuid(), 'admin.dealer.cleanup', 'Gộp Đại lý trùng, sửa số điện thoại sai')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r
WHERE p."code" = 'admin.dealer.cleanup' AND r."code" IN ('admin', 'operations')
ON CONFLICT DO NOTHING;
