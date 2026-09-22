-- CreateTable
CREATE TABLE "DeviceType" (
    "Id" SERIAL NOT NULL,
    "TypeName" VARCHAR(100) NOT NULL,
    "Prefix" VARCHAR(4) NOT NULL,

    CONSTRAINT "DeviceType_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Device" (
    "Id" SERIAL NOT NULL,
    "DeviceCode" VARCHAR(20) NOT NULL,
    "DeviceName" VARCHAR(150) NOT NULL,
    "SerialNumber" VARCHAR(100),
    "SpecDetail" VARCHAR(255) NOT NULL,
    "Unit" VARCHAR(20) NOT NULL,
    "Location" VARCHAR(150),
    "PurchaseDate" DATE,
    "Supplier" VARCHAR(150),
    "WarrantyMonths" INTEGER,
    "WarrantyCondition" VARCHAR(255),
    "WarrantyExpiresOn" DATE,
    "Status" VARCHAR(50) NOT NULL,
    "AllocatedOn" DATE,
    "DeviceTypeId" INTEGER NOT NULL,
    "DepartmentId" INTEGER,
    "CurrentUserId" INTEGER,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "DeviceAccessory" (
    "Id" SERIAL NOT NULL,
    "DeviceId" INTEGER NOT NULL,
    "AccessoryCode" VARCHAR(50) NOT NULL,
    "AccessoryName" VARCHAR(150) NOT NULL,
    "AccessoryType" VARCHAR(100) NOT NULL,
    "Unit" VARCHAR(20) NOT NULL,

    CONSTRAINT "DeviceAccessory_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceType_Prefix_key" ON "DeviceType"("Prefix");

-- CreateIndex
CREATE UNIQUE INDEX "Device_DeviceCode_key" ON "Device"("DeviceCode");

-- CreateIndex
CREATE UNIQUE INDEX "Device_SerialNumber_key" ON "Device"("SerialNumber");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_DeviceTypeId_fkey" FOREIGN KEY ("DeviceTypeId") REFERENCES "DeviceType"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_DepartmentId_fkey" FOREIGN KEY ("DepartmentId") REFERENCES "Department"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_CurrentUserId_fkey" FOREIGN KEY ("CurrentUserId") REFERENCES "User"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceAccessory" ADD CONSTRAINT "DeviceAccessory_DeviceId_fkey" FOREIGN KEY ("DeviceId") REFERENCES "Device"("Id") ON DELETE CASCADE ON UPDATE CASCADE;
