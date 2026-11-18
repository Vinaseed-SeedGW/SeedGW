-- T1 (18/11/2026): Hỗ trợ: yêu cầu, tin trao đổi, tệp, lịch sử, đã xem; nhật ký gửi ra ngoài. Chỉ thêm bảng.
-- CreateEnum
CREATE TYPE "support_type" AS ENUM ('QUESTION', 'BUG', 'FEEDBACK');

-- CreateEnum
CREATE TYPE "support_severity" AS ENUM ('BLOCKER', 'MAJOR', 'MINOR');

-- CreateEnum
CREATE TYPE "support_status" AS ENUM ('NEW', 'IN_PROGRESS', 'WAITING_REQUESTER', 'DONE', 'CLOSED');

-- CreateEnum
CREATE TYPE "support_level" AS ENUM ('UNIT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "support_event_kind" AS ENUM ('CREATE', 'CLAIM', 'ESCALATE', 'STATUS', 'REOPEN', 'AUTO_CLOSE');

-- CreateTable
CREATE TABLE "support_requests" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "requester_id" UUID NOT NULL,
    "org_unit_id" UUID,
    "type" "support_type" NOT NULL,
    "severity" "support_severity",
    "title" TEXT NOT NULL,
    "status" "support_status" NOT NULL DEFAULT 'NEW',
    "level" "support_level" NOT NULL DEFAULT 'UNIT',
    "assignee_id" UUID,
    "context" JSONB NOT NULL DEFAULT '{}',
    "escalation_note" TEXT,
    "escalated_at" TIMESTAMP(3),
    "first_response_at" TIMESTAMP(3),
    "first_response_due_at" TIMESTAMP(3),
    "resolve_due_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "last_requester_activity_at" TIMESTAMP(3) NOT NULL,
    "last_handler_activity_at" TIMESTAMP(3),
    "overdue_alerted_at" TIMESTAMP(3),
    "purged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "author_id" UUID,
    "from_requester" BOOLEAN NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_attachments" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "client_id" UUID,
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "is_image" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_events" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "actor_id" UUID,
    "kind" "support_event_kind" NOT NULL,
    "from_status" "support_status",
    "to_status" "support_status",
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_reads" (
    "request_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "last_read_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_reads_pkey" PRIMARY KEY ("request_id","user_id")
);

-- CreateTable
CREATE TABLE "integration_logs" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "payload" JSONB NOT NULL,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_requests_code_key" ON "support_requests"("code");

-- CreateIndex
CREATE INDEX "support_requests_requester_id_updated_at_idx" ON "support_requests"("requester_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "support_requests_org_unit_id_status_idx" ON "support_requests"("org_unit_id", "status");

-- CreateIndex
CREATE INDEX "support_requests_level_status_idx" ON "support_requests"("level", "status");

-- CreateIndex
CREATE INDEX "support_requests_assignee_id_status_idx" ON "support_requests"("assignee_id", "status");

-- CreateIndex
CREATE INDEX "support_requests_status_resolved_at_idx" ON "support_requests"("status", "resolved_at");

-- CreateIndex
CREATE INDEX "support_requests_created_at_idx" ON "support_requests"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "support_requests_requester_id_client_id_key" ON "support_requests"("requester_id", "client_id");

-- CreateIndex
CREATE INDEX "support_messages_request_id_created_at_idx" ON "support_messages"("request_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "support_messages_request_id_client_id_key" ON "support_messages"("request_id", "client_id");

-- CreateIndex
CREATE INDEX "support_attachments_message_id_idx" ON "support_attachments"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "support_attachments_message_id_client_id_key" ON "support_attachments"("message_id", "client_id");

-- CreateIndex
CREATE INDEX "support_events_request_id_created_at_idx" ON "support_events"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "support_reads_user_id_idx" ON "support_reads"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_logs_idempotency_key_key" ON "integration_logs"("idempotency_key");

-- CreateIndex
CREATE INDEX "integration_logs_provider_status_idx" ON "integration_logs"("provider", "status");

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "support_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "support_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_events" ADD CONSTRAINT "support_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "support_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_events" ADD CONSTRAINT "support_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_reads" ADD CONSTRAINT "support_reads_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "support_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_reads" ADD CONSTRAINT "support_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

