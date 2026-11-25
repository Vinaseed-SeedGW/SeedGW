-- 25/11/2026: sổ đồng ý dữ liệu cá nhân chỉ ghi thêm. Chỉ tạo bảng mới, không đụng dữ liệu cũ.
CREATE TYPE "consent_action" AS ENUM ('ACCEPT', 'WITHDRAW');

CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "employee_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "action" "consent_action" NOT NULL,
    "channel" "consent_channel" NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "device_name" TEXT,
    "device_platform" TEXT,
    "content_text" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "prev_hash" TEXT NOT NULL,
    "record_hash" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "migrated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consent_records_seq_key" ON "consent_records"("seq");
CREATE UNIQUE INDEX "consent_records_record_hash_key" ON "consent_records"("record_hash");
CREATE INDEX "consent_records_user_id_recorded_at_idx" ON "consent_records"("user_id", "recorded_at" DESC);

ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Không cho sửa, xoá dòng đã ghi, kể cả từ công cụ quản trị CSDL dùng tài khoản ứng dụng.
CREATE FUNCTION consent_records_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'consent_records chỉ được ghi thêm, không sửa hoặc xoá';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER consent_records_no_update_delete
  BEFORE UPDATE OR DELETE ON "consent_records"
  FOR EACH ROW EXECUTE FUNCTION consent_records_append_only();

CREATE TRIGGER consent_records_no_truncate
  BEFORE TRUNCATE ON "consent_records"
  FOR EACH STATEMENT EXECUTE FUNCTION consent_records_append_only();
