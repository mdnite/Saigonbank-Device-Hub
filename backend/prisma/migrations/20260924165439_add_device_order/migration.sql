-- CreateTable
CREATE TABLE "DeviceOrder" (
    "Id" SERIAL NOT NULL,
    "Type" VARCHAR(20) NOT NULL,
    "Status" VARCHAR(20) NOT NULL DEFAULT 'Chờ duyệt',
    "TargetUserId" INTEGER NOT NULL,
    "Note" VARCHAR(255),
    "CreatedById" INTEGER NOT NULL,
    "DecidedById" INTEGER,
    "DecidedAt" TIMESTAMP(3),
    "RejectReason" VARCHAR(255),
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceOrder_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "DeviceOrderItem" (
    "Id" SERIAL NOT NULL,
    "OrderId" INTEGER NOT NULL,
    "DeviceId" INTEGER NOT NULL,

    CONSTRAINT "DeviceOrderItem_pkey" PRIMARY KEY ("Id")
);

-- AddForeignKey
ALTER TABLE "DeviceOrder" ADD CONSTRAINT "DeviceOrder_TargetUserId_fkey" FOREIGN KEY ("TargetUserId") REFERENCES "User"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceOrder" ADD CONSTRAINT "DeviceOrder_CreatedById_fkey" FOREIGN KEY ("CreatedById") REFERENCES "User"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceOrder" ADD CONSTRAINT "DeviceOrder_DecidedById_fkey" FOREIGN KEY ("DecidedById") REFERENCES "User"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceOrderItem" ADD CONSTRAINT "DeviceOrderItem_OrderId_fkey" FOREIGN KEY ("OrderId") REFERENCES "DeviceOrder"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceOrderItem" ADD CONSTRAINT "DeviceOrderItem_DeviceId_fkey" FOREIGN KEY ("DeviceId") REFERENCES "Device"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
