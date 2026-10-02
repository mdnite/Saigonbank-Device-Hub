-- CreateTable
CREATE TABLE "Audit" (
    "Id" SERIAL NOT NULL,
    "Status" VARCHAR(20) NOT NULL DEFAULT 'Chưa kiểm kê',
    "DepartmentId" INTEGER,
    "UnitName" VARCHAR(150) NOT NULL,
    "DueDate" DATE NOT NULL,
    "Purpose" VARCHAR(20) NOT NULL,
    "DeviceTypeId" INTEGER,
    "Location" VARCHAR(150),
    "CreatedById" INTEGER NOT NULL,
    "StartedAt" TIMESTAMP(3),
    "SubmittedAt" TIMESTAMP(3),
    "DecidedById" INTEGER,
    "DecidedAt" TIMESTAMP(3),
    "RejectReason" VARCHAR(255),
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "AuditItem" (
    "Id" SERIAL NOT NULL,
    "AuditId" INTEGER NOT NULL,
    "DeviceId" INTEGER NOT NULL,
    "DeviceCode" VARCHAR(20) NOT NULL,
    "DeviceName" VARCHAR(150) NOT NULL,
    "SerialNumber" VARCHAR(100),
    "DeviceTypeName" VARCHAR(100) NOT NULL,
    "Unit" VARCHAR(20) NOT NULL,
    "HolderUserId" INTEGER,
    "HolderName" VARCHAR(150),
    "DepartmentName" VARCHAR(150),
    "DeviceStatus" VARCHAR(50) NOT NULL,
    "Result" VARCHAR(10),
    "Note" VARCHAR(255),

    CONSTRAINT "AuditItem_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "AuditItemAccessory" (
    "Id" SERIAL NOT NULL,
    "AuditItemId" INTEGER NOT NULL,
    "AccessoryCode" VARCHAR(50) NOT NULL,
    "AccessoryName" VARCHAR(150) NOT NULL,
    "AccessoryType" VARCHAR(100) NOT NULL,
    "Unit" VARCHAR(20) NOT NULL,
    "Result" VARCHAR(10),
    "Note" VARCHAR(255),

    CONSTRAINT "AuditItemAccessory_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "AuditMember" (
    "AuditId" INTEGER NOT NULL,
    "UserId" INTEGER NOT NULL,

    CONSTRAINT "AuditMember_pkey" PRIMARY KEY ("AuditId","UserId")
);

-- CreateTable
CREATE TABLE "AuditSummary" (
    "Id" SERIAL NOT NULL,
    "Title" VARCHAR(150) NOT NULL,
    "Purpose" VARCHAR(20),
    "CreatedById" INTEGER NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditSummary_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "AuditSummaryAudit" (
    "SummaryId" INTEGER NOT NULL,
    "AuditId" INTEGER NOT NULL,

    CONSTRAINT "AuditSummaryAudit_pkey" PRIMARY KEY ("SummaryId","AuditId")
);

-- CreateIndex
CREATE INDEX "AuditItem_DeviceId_idx" ON "AuditItem"("DeviceId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditItem_AuditId_DeviceId_key" ON "AuditItem"("AuditId", "DeviceId");

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_DepartmentId_fkey" FOREIGN KEY ("DepartmentId") REFERENCES "Department"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_DeviceTypeId_fkey" FOREIGN KEY ("DeviceTypeId") REFERENCES "DeviceType"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_CreatedById_fkey" FOREIGN KEY ("CreatedById") REFERENCES "User"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_DecidedById_fkey" FOREIGN KEY ("DecidedById") REFERENCES "User"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditItem" ADD CONSTRAINT "AuditItem_AuditId_fkey" FOREIGN KEY ("AuditId") REFERENCES "Audit"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditItem" ADD CONSTRAINT "AuditItem_DeviceId_fkey" FOREIGN KEY ("DeviceId") REFERENCES "Device"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditItemAccessory" ADD CONSTRAINT "AuditItemAccessory_AuditItemId_fkey" FOREIGN KEY ("AuditItemId") REFERENCES "AuditItem"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditMember" ADD CONSTRAINT "AuditMember_AuditId_fkey" FOREIGN KEY ("AuditId") REFERENCES "Audit"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditMember" ADD CONSTRAINT "AuditMember_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSummary" ADD CONSTRAINT "AuditSummary_CreatedById_fkey" FOREIGN KEY ("CreatedById") REFERENCES "User"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSummaryAudit" ADD CONSTRAINT "AuditSummaryAudit_SummaryId_fkey" FOREIGN KEY ("SummaryId") REFERENCES "AuditSummary"("Id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSummaryAudit" ADD CONSTRAINT "AuditSummaryAudit_AuditId_fkey" FOREIGN KEY ("AuditId") REFERENCES "Audit"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
