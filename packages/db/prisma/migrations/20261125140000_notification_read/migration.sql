-- D4: trung tâm thông báo (25/11/2026). Chỉ thêm cột và chỉ mục, không đổi dữ liệu cũ.
ALTER TABLE "push_messages" ADD COLUMN "read_at" TIMESTAMP(3);

CREATE INDEX "push_messages_user_id_read_at_idx" ON "push_messages"("user_id", "read_at");
