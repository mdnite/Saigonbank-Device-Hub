-- DropForeignKey
ALTER TABLE "DeviceOrder" DROP CONSTRAINT "DeviceOrder_DecidedById_fkey";

-- AddForeignKey
ALTER TABLE "DeviceOrder" ADD CONSTRAINT "DeviceOrder_DecidedById_fkey" FOREIGN KEY ("DecidedById") REFERENCES "User"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
