-- AlterTable
ALTER TABLE "org_units" ADD COLUMN     "manager_id" UUID;

-- AddForeignKey
ALTER TABLE "org_units" ADD CONSTRAINT "org_units_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
