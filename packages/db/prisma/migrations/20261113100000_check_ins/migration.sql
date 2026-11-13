-- CreateEnum
CREATE TYPE "check_in_place_kind" AS ENUM ('DEALER', 'CUSTOMER', 'OTHER');

-- CreateEnum
CREATE TYPE "track_session_end_reason" AS ENUM ('USER', 'AUTO_CUTOFF');

-- CreateTable
CREATE TABLE "mobile_refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "session_version" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mobile_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "org_unit_id" UUID,
    "device_id" UUID,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracy_m" DOUBLE PRECISION,
    "is_mocked" BOOLEAN NOT NULL,
    "place_kind" "check_in_place_kind" NOT NULL,
    "place_name" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "address" TEXT,
    "address_on_photo" TEXT,
    "address_attempts" INTEGER NOT NULL DEFAULT 0,
    "photo_key" TEXT,
    "photo_bytes" INTEGER,
    "gps_distance_km" DOUBLE PRECISION,
    "road_distance_km" DOUBLE PRECISION,
    "is_distance_estimated" BOOLEAN NOT NULL DEFAULT false,
    "flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_points" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracy_m" DOUBLE PRECISION,
    "speed_mps" DOUBLE PRECISION,
    "is_mocked" BOOLEAN NOT NULL,
    "is_background" BOOLEAN NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "track_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "track_sessions" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "end_reason" "track_session_end_reason",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "track_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mobile_refresh_tokens_token_hash_key" ON "mobile_refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "mobile_refresh_tokens_user_id_idx" ON "mobile_refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "check_ins_client_id_key" ON "check_ins"("client_id");

-- CreateIndex
CREATE INDEX "check_ins_user_id_captured_at_idx" ON "check_ins"("user_id", "captured_at" DESC);

-- CreateIndex
CREATE INDEX "check_ins_org_unit_id_captured_at_idx" ON "check_ins"("org_unit_id", "captured_at" DESC);

-- CreateIndex
CREATE INDEX "check_ins_captured_at_idx" ON "check_ins"("captured_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "track_points_user_id_recorded_at_key" ON "track_points"("user_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "track_sessions_client_id_key" ON "track_sessions"("client_id");

-- CreateIndex
CREATE INDEX "track_sessions_user_id_started_at_idx" ON "track_sessions"("user_id", "started_at");

-- AddForeignKey
ALTER TABLE "mobile_refresh_tokens" ADD CONSTRAINT "mobile_refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_refresh_tokens" ADD CONSTRAINT "mobile_refresh_tokens_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "mobile_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "mobile_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_points" ADD CONSTRAINT "track_points_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "track_sessions" ADD CONSTRAINT "track_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Quyen moi cho app check-in. Cap cho cac vai tro dang co quyen xem Check-in, giu nguyen phan quyen da chinh.
INSERT INTO "permissions" ("id", "code", "name")
VALUES (gen_random_uuid(), 'sales.check-in.create', 'Check-in trên app')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", rp."B"
FROM "permissions" p
JOIN "permissions" r ON r."code" = 'sales.check-in.read'
JOIN "_role_permissions" rp ON rp."A" = r."id"
WHERE p."code" = 'sales.check-in.create'
ON CONFLICT DO NOTHING;
