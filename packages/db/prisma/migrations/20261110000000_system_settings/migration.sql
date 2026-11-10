-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "code_sequences" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "digits" INTEGER NOT NULL,
    "range_start" INTEGER NOT NULL,
    "range_end" INTEGER NOT NULL,
    "next_value" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "code_sequences_key_key" ON "code_sequences"("key");

-- DropIndex
DROP INDEX "audit_logs_actor_id_idx";

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_created_at_idx" ON "audit_logs"("entity_type", "created_at" DESC);

-- Tao san dong du lieu de moi moi truong deu co, gia tri tham so mac dinh nam trong @dms/contracts/settings.
INSERT INTO "system_settings" ("id", "key", "value", "updated_at")
VALUES (gen_random_uuid(), 'general', '{}', CURRENT_TIMESTAMP);

INSERT INTO "code_sequences" ("id", "key", "prefix", "digits", "range_start", "range_end", "next_value", "updated_at")
VALUES (gen_random_uuid(), 'dealer', 'DL', 5, 1, 99999, 1, CURRENT_TIMESTAMP);
