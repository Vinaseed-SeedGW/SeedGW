-- Bo phan don hang (13/11/2026): xoa Quy trinh duyet, uy quyen va cac quyen cua don hang, ton kho,
-- bang gia, san pham, kho, dong bo don hang sang FAST. Cac bang bi xoa deu dang khong co dong nao.

-- DropForeignKey
ALTER TABLE "approval_steps" DROP CONSTRAINT "approval_steps_approver_role_id_fkey";

-- DropForeignKey
ALTER TABLE "approval_steps" DROP CONSTRAINT "approval_steps_approver_user_id_fkey";

-- DropForeignKey
ALTER TABLE "approval_steps" DROP CONSTRAINT "approval_steps_escalation_user_id_fkey";

-- DropForeignKey
ALTER TABLE "approval_steps" DROP CONSTRAINT "approval_steps_version_id_fkey";

-- DropForeignKey
ALTER TABLE "approval_workflow_versions" DROP CONSTRAINT "approval_workflow_versions_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "approval_workflow_versions" DROP CONSTRAINT "approval_workflow_versions_workflow_id_fkey";

-- DropForeignKey
ALTER TABLE "approval_workflows" DROP CONSTRAINT "approval_workflows_org_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "delegations" DROP CONSTRAINT "delegations_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "delegations" DROP CONSTRAINT "delegations_delegate_id_fkey";

-- DropForeignKey
ALTER TABLE "delegations" DROP CONSTRAINT "delegations_delegator_id_fkey";

-- DropTable
DROP TABLE "approval_steps";

-- DropTable
DROP TABLE "approval_workflow_versions";

-- DropTable
DROP TABLE "approval_workflows";

-- DropTable
DROP TABLE "delegations";

-- DropEnum
DROP TYPE "approval_mode";

-- DropEnum
DROP TYPE "approval_subject";

-- DropEnum
DROP TYPE "approver_type";

-- DropEnum
DROP TYPE "condition_match";

-- DropEnum
DROP TYPE "escalation_type";


-- Quyen khong con dung. Xoa lien ket voi vai tro truoc roi xoa quyen.
DELETE FROM "_role_permissions" WHERE "A" IN (
  SELECT "id" FROM "permissions" WHERE "code" IN (
    'sales.approval.read', 'sales.order.read', 'sales.order.create', 'sales.order.approve',
    'sales.inventory.read', 'sales.fast-sync.read', 'admin.product.read', 'admin.warehouse.read',
    'admin.price-list.read', 'admin.workflow.read', 'admin.workflow.manage'
  )
);
DELETE FROM "permissions" WHERE "code" IN (
  'sales.approval.read', 'sales.order.read', 'sales.order.create', 'sales.order.approve',
  'sales.inventory.read', 'sales.fast-sync.read', 'admin.product.read', 'admin.warehouse.read',
  'admin.price-list.read', 'admin.workflow.read', 'admin.workflow.manage'
);
