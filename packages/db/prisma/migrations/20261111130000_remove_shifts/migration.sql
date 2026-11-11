-- DropForeignKey
ALTER TABLE "org_unit_shifts" DROP CONSTRAINT "org_unit_shifts_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "org_unit_shifts" DROP CONSTRAINT "org_unit_shifts_org_unit_id_fkey";

-- DropForeignKey
ALTER TABLE "org_unit_shifts" DROP CONSTRAINT "org_unit_shifts_shift_id_fkey";

-- DropForeignKey
ALTER TABLE "user_shifts" DROP CONSTRAINT "user_shifts_created_by_id_fkey";

-- DropForeignKey
ALTER TABLE "user_shifts" DROP CONSTRAINT "user_shifts_shift_id_fkey";

-- DropForeignKey
ALTER TABLE "user_shifts" DROP CONSTRAINT "user_shifts_user_id_fkey";

-- DropTable
DROP TABLE "holidays";

-- DropTable
DROP TABLE "org_unit_shifts";

-- DropTable
DROP TABLE "shifts";

-- DropTable
DROP TABLE "user_shifts";

-- DropEnum
DROP TYPE "HolidayKind";

-- DropEnum
DROP TYPE "Weekday";

-- Bo quyen cua chuc nang Ca lam viec da loai bo
DELETE FROM "_role_permissions" WHERE "A" IN (SELECT "id" FROM "permissions" WHERE "code" IN ('admin.shift.read', 'admin.shift.manage'));
DELETE FROM "permissions" WHERE "code" IN ('admin.shift.read', 'admin.shift.manage');
