-- CreateEnum
CREATE TYPE "mobile_device_status" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "impersonator_id" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email" TEXT,
ADD COLUMN     "failed_login_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failed_login_started_at" TIMESTAMP(3),
ADD COLUMN     "hired_at" DATE,
ADD COLUMN     "job_title" TEXT,
ADD COLUMN     "login_locked_until" TIMESTAMP(3),
ADD COLUMN     "manager_id" UUID,
ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "session_version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "mobile_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" "mobile_device_status" NOT NULL DEFAULT 'PENDING',
    "approved_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobile_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impersonation_sessions" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mobile_devices_user_id_status_idx" ON "mobile_devices"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "mobile_devices_user_id_device_key_key" ON "mobile_devices"("user_id", "device_key");

-- CreateIndex
CREATE INDEX "impersonation_sessions_actor_id_ended_at_idx" ON "impersonation_sessions"("actor_id", "ended_at");

-- CreateIndex
CREATE INDEX "users_manager_id_idx" ON "users"("manager_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_impersonator_id_fkey" FOREIGN KEY ("impersonator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
