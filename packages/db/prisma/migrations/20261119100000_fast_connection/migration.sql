-- A8 (19/11/2026): kết nối FAST, đồng bộ danh mục khách hàng. Chỉ thêm bảng và quyền.
-- CreateEnum
CREATE TYPE "fast_sync_status" AS ENUM ('RUNNING', 'OK', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "integration_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "fast_sync_runs" (
    "id" UUID NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" "fast_sync_status" NOT NULL DEFAULT 'RUNNING',
    "since_at" TIMESTAMP(3),
    "cursor_at" TIMESTAMP(3),
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "unchanged" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "fast_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fast_sync_errors" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "fast_code" TEXT,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fast_sync_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fast_customers" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tax_code" TEXT,
    "address" TEXT,
    "province_code" TEXT,
    "district_code" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "unit_code" TEXT,
    "groups" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT,
    "fast_created_at" TIMESTAMP(3),
    "fast_updated_at" TIMESTAMP(3),
    "dealer_id" UUID,
    "synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fast_customers_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "fast_sync_runs_started_at_idx" ON "fast_sync_runs"("started_at" DESC);

-- CreateIndex
CREATE INDEX "fast_sync_errors_run_id_idx" ON "fast_sync_errors"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "fast_customers_dealer_id_key" ON "fast_customers"("dealer_id");

-- CreateIndex
CREATE INDEX "fast_customers_fast_updated_at_idx" ON "fast_customers"("fast_updated_at");

-- AddForeignKey
ALTER TABLE "fast_sync_errors" ADD CONSTRAINT "fast_sync_errors_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "fast_sync_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fast_customers" ADD CONSTRAINT "fast_customers_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Quyền Sửa Kết nối: chỉ Quản trị hệ thống.
INSERT INTO "permissions" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'admin.connection.manage', 'Sửa Kết nối')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r
WHERE p."code" = 'admin.connection.manage' AND r."code" = 'admin'
ON CONFLICT DO NOTHING;
