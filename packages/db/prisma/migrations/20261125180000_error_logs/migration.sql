-- F9: bảng lỗi tự ghi (25/11/2026). Chỉ thêm bảng mới.

-- CreateEnum
CREATE TYPE "error_source" AS ENUM ('WEB_SERVER', 'WEB_CLIENT', 'MOBILE', 'WORKER');

-- CreateTable
CREATE TABLE "error_logs" (
    "id" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "source" "error_source" NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "path" TEXT,
    "app_version" TEXT,
    "context" JSONB NOT NULL DEFAULT '{}',
    "user_id" UUID,
    "count" INTEGER NOT NULL DEFAULT 1,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "error_logs_fingerprint_key" ON "error_logs"("fingerprint");

-- CreateIndex
CREATE INDEX "error_logs_resolved_at_last_seen_at_idx" ON "error_logs"("resolved_at", "last_seen_at" DESC);


INSERT INTO "permissions" ("id", "code", "name")
VALUES (gen_random_uuid(), 'admin.error-log.read', 'Xem Lỗi hệ thống')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r
WHERE p."code" = 'admin.error-log.read' AND r."code" = 'admin'
ON CONFLICT DO NOTHING;
