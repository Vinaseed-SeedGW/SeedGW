-- CreateEnum
CREATE TYPE "data_scope" AS ENUM ('OWN', 'ORG_UNIT', 'ORG_UNIT_TREE', 'ALL');

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "data_scope" "data_scope" NOT NULL DEFAULT 'OWN';
