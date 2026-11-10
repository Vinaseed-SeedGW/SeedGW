-- CreateEnum
CREATE TYPE "approval_subject" AS ENUM ('ORDER');

-- CreateEnum
CREATE TYPE "approver_type" AS ENUM ('ROLE', 'JOB_TITLE', 'USER');

-- CreateEnum
CREATE TYPE "approval_mode" AS ENUM ('ANY', 'ALL');

-- CreateEnum
CREATE TYPE "escalation_type" AS ENUM ('NONE', 'DIRECT_MANAGER', 'USER');

-- CreateEnum
CREATE TYPE "condition_match" AS ENUM ('ALL', 'ANY');

-- CreateTable
CREATE TABLE "approval_workflows" (
    "id" UUID NOT NULL,
    "org_unit_id" UUID NOT NULL,
    "subject" "approval_subject" NOT NULL,
    "active_version" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflow_versions" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "approver_type" "approver_type" NOT NULL,
    "approver_role_id" UUID,
    "approver_job_title" TEXT,
    "approver_user_id" UUID,
    "approval_mode" "approval_mode" NOT NULL,
    "sla_hours" INTEGER NOT NULL,
    "escalation_type" "escalation_type" NOT NULL,
    "escalation_user_id" UUID,
    "skip_below_vnd" BIGINT NOT NULL,
    "condition_match" "condition_match" NOT NULL,
    "conditions" JSONB NOT NULL,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegations" (
    "id" UUID NOT NULL,
    "delegator_id" UUID NOT NULL,
    "delegate_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflows_org_unit_id_subject_key" ON "approval_workflows"("org_unit_id", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflow_versions_workflow_id_version_key" ON "approval_workflow_versions"("workflow_id", "version");

-- CreateIndex
CREATE INDEX "approval_steps_approver_role_id_idx" ON "approval_steps"("approver_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_steps_version_id_position_key" ON "approval_steps"("version_id", "position");

-- CreateIndex
CREATE INDEX "delegations_delegator_id_end_date_idx" ON "delegations"("delegator_id", "end_date");

-- CreateIndex
CREATE INDEX "delegations_start_date_end_date_idx" ON "delegations"("start_date", "end_date");

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_org_unit_id_fkey" FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_versions" ADD CONSTRAINT "approval_workflow_versions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "approval_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_versions" ADD CONSTRAINT "approval_workflow_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "approval_workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approver_role_id_fkey" FOREIGN KEY ("approver_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_escalation_user_id_fkey" FOREIGN KEY ("escalation_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_delegator_id_fkey" FOREIGN KEY ("delegator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_delegate_id_fkey" FOREIGN KEY ("delegate_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegations" ADD CONSTRAINT "delegations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
