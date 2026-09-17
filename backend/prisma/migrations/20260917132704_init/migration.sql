-- CreateTable
CREATE TABLE "Role" (
    "Id" SERIAL NOT NULL,
    "RoleName" VARCHAR(100) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Department" (
    "Id" SERIAL NOT NULL,
    "DepartmentCode" VARCHAR(50) NOT NULL,
    "DepartmentName" VARCHAR(150) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "User" (
    "Id" SERIAL NOT NULL,
    "RoleId" INTEGER NOT NULL,
    "DepartmentId" INTEGER,
    "Username" VARCHAR(100) NOT NULL,
    "Password" VARCHAR(255) NOT NULL,
    "FullName" VARCHAR(150) NOT NULL,
    "Email" VARCHAR(150) NOT NULL,
    "Status" VARCHAR(50) NOT NULL DEFAULT 'Đang hoạt động',
    "IsVerified" BOOLEAN NOT NULL DEFAULT false,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "Id" SERIAL NOT NULL,
    "UserId" INTEGER NOT NULL,
    "TokenHash" VARCHAR(255) NOT NULL,
    "ExpiresAt" TIMESTAMP(3) NOT NULL,
    "UsedAt" TIMESTAMP(3),
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_DepartmentCode_key" ON "Department"("DepartmentCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_Username_key" ON "User"("Username");

-- CreateIndex
CREATE UNIQUE INDEX "User_Email_key" ON "User"("Email");

-- CreateIndex
CREATE INDEX "PasswordResetToken_TokenHash_idx" ON "PasswordResetToken"("TokenHash");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_RoleId_fkey" FOREIGN KEY ("RoleId") REFERENCES "Role"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_DepartmentId_fkey" FOREIGN KEY ("DepartmentId") REFERENCES "Department"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
