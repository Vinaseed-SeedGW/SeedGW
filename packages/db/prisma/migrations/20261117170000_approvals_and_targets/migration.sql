-- A10b + K3a (17/11/2026, quyet dinh 31): bang phe duyet Tuyen/Chi tieu, chi tieu thang tu dang ky,
-- quyen sales.approval.review va dai ma TV-, CT-.

CREATE TYPE "approval_kind" AS ENUM ('ROUTE_PLAN', 'SALES_TARGET');
CREATE TYPE "approval_status" AS ENUM ('DRAFT', 'PENDING_MANAGER', 'PENDING_LEADER', 'RETURNED', 'APPROVED', 'WITHDRAWN');
CREATE TYPE "approval_action_type" AS ENUM ('SUBMIT', 'APPROVE', 'RETURN', 'WITHDRAW', 'AUTO_PASS', 'SKIP_STEP', 'REASSIGN');
CREATE TYPE "approval_step" AS ENUM ('MANAGER', 'LEADER');

CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "approval_kind" NOT NULL,
    "subject_id" UUID NOT NULL,
    "submitted_by_id" UUID NOT NULL,
    "org_unit_id" UUID,
    "status" "approval_status" NOT NULL DEFAULT 'DRAFT',
    "current_approver_id" UUID,
    "manager_approver_id" UUID,
    "leader_approver_id" UUID,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "period_label" TEXT NOT NULL,
    "summary_text" TEXT NOT NULL DEFAULT '',
    "is_late" BOOLEAN NOT NULL DEFAULT false,
    "submission_count" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_actions" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" "approval_action_type" NOT NULL,
    "step" "approval_step",
    "note" TEXT NOT NULL DEFAULT '',
    "snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "monthly_sales_targets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "org_unit_id" UUID,
    "month" TEXT NOT NULL,
    "visit_count_target" INTEGER NOT NULL,
    "dealer_coverage_target" INTEGER NOT NULL,
    "sales_kg_target" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT NOT NULL DEFAULT '',
    "approved_visit_count" INTEGER,
    "approved_dealer_coverage" INTEGER,
    "approved_sales_kg" DOUBLE PRECISION,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_sales_targets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "approval_requests_code_key" ON "approval_requests"("code");
CREATE UNIQUE INDEX "approval_requests_kind_subject_id_key" ON "approval_requests"("kind", "subject_id");
CREATE INDEX "approval_requests_current_approver_id_status_idx" ON "approval_requests"("current_approver_id", "status");
CREATE INDEX "approval_requests_org_unit_id_status_submitted_at_idx" ON "approval_requests"("org_unit_id", "status", "submitted_at" DESC);
CREATE INDEX "approval_requests_submitted_by_id_kind_status_idx" ON "approval_requests"("submitted_by_id", "kind", "status");

CREATE INDEX "approval_actions_request_id_created_at_idx" ON "approval_actions"("request_id", "created_at" ASC);
CREATE INDEX "approval_actions_actor_id_created_at_idx" ON "approval_actions"("actor_id", "created_at" DESC);

CREATE UNIQUE INDEX "monthly_sales_targets_user_id_month_key" ON "monthly_sales_targets"("user_id", "month");
CREATE INDEX "monthly_sales_targets_org_unit_id_month_idx" ON "monthly_sales_targets"("org_unit_id", "month");

ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_current_approver_id_fkey" FOREIGN KEY ("current_approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_manager_approver_id_fkey" FOREIGN KEY ("manager_approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_leader_approver_id_fkey" FOREIGN KEY ("leader_approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "monthly_sales_targets" ADD CONSTRAINT "monthly_sales_targets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monthly_sales_targets" ADD CONSTRAINT "monthly_sales_targets_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Xem phieu: admin, operations (Quan tri don vi chi xem de ho tro), unit-leader, manager.
-- Duyet: admin, unit-leader, manager.
INSERT INTO "permissions" ("id", "code", "name") VALUES
  (gen_random_uuid(), 'sales.approval.read', 'Xem phiếu Tuyến và Chỉ tiêu'),
  (gen_random_uuid(), 'sales.approval.review', 'Duyệt Tuyến và Chỉ tiêu'),
  (gen_random_uuid(), 'sales.target.register', 'Đăng ký Chỉ tiêu tháng của mình')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r
WHERE p."code" = 'sales.approval.read' AND r."code" IN ('admin', 'operations', 'unit-leader', 'manager')
ON CONFLICT DO NOTHING;

INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r
WHERE p."code" = 'sales.approval.review' AND r."code" IN ('admin', 'unit-leader', 'manager')
ON CONFLICT DO NOTHING;

-- Dang ky chi tieu cua minh: NVKD, Quan ly, Lanh dao don vi (va admin).
INSERT INTO "_role_permissions" ("A", "B")
SELECT p."id", r."id" FROM "permissions" p CROSS JOIN "roles" r
WHERE p."code" = 'sales.target.register' AND r."code" IN ('admin', 'unit-leader', 'manager', 'staff')
ON CONFLICT DO NOTHING;

-- Dai ma phieu Tuyen (TV) va Chi tieu (CT).
INSERT INTO "code_sequences" ("id", "key", "prefix", "digits", "range_start", "range_end", "next_value", "updated_at") VALUES
  (gen_random_uuid(), 'route-plan', 'TV', 5, 1, 99999, 1, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'sales-target', 'CT', 5, 1, 99999, 1, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
