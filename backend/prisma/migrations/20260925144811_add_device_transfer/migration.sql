-- CreateTable
CREATE TABLE "DeviceTransfer" (
    "Id" SERIAL NOT NULL,
    "Status" VARCHAR(20) NOT NULL DEFAULT 'Chờ duyệt',
    "FromUserId" INTEGER NOT NULL,
    "ToUserId" INTEGER NOT NULL,
    "Note" VARCHAR(255),
    "CreatedById" INTEGER NOT NULL,
    "DecidedById" INTEGER,
    "DecidedAt" TIMESTAMP(3),
    "RejectReason" VARCHAR(255),
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceTransfer_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "DeviceTransferItem" (
    "Id" SERIAL NOT NULL,
    "TransferId" INTEGER NOT NULL,
    "DeviceId" INTEGER NOT NULL,

    CONSTRAINT "DeviceTransferItem_pkey" PRIMARY KEY ("Id")
);

-- AddForeignKey
ALTER TABLE "DeviceTransfer" ADD CONSTRAINT "DeviceTransfer_FromUserId_fkey" FOREIGN KEY ("FromUserId") REFERENCES "User"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceTransfer" ADD CONSTRAINT "DeviceTransfer_ToUserId_fkey" FOREIGN KEY ("ToUserId") REFERENCES "User"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceTransfer" ADD CONSTRAINT "DeviceTransfer_CreatedById_fkey" FOREIGN KEY ("CreatedById") REFERENCES "User"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceTransfer" ADD CONSTRAINT "DeviceTransfer_DecidedById_fkey" FOREIGN KEY ("DecidedById") REFERENCES "User"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceTransferItem" ADD CONSTRAINT "DeviceTransferItem_TransferId_fkey" FOREIGN KEY ("TransferId") REFERENCES "DeviceTransfer"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceTransferItem" ADD CONSTRAINT "DeviceTransferItem_DeviceId_fkey" FOREIGN KEY ("DeviceId") REFERENCES "Device"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
