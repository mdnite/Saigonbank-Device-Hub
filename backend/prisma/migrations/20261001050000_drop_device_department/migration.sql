-- DropForeignKey
ALTER TABLE "Device" DROP CONSTRAINT "Device_DepartmentId_fkey";

-- AlterTable
ALTER TABLE "Device" DROP COLUMN "DepartmentId";

