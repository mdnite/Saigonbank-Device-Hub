// Dữ liệu CHỈ dành cho môi trường dev — không chạy seed này trên production.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/shared/security/password';
import { USER_STATUS } from '../src/modules/identity/user-status';
import { ROLE } from '../src/modules/identity/roles';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // findFirst-or-create: RoleName không unique trong schema nên không upsert được.
  const roleIds: Record<string, number> = {};
  for (const roleName of Object.values(ROLE)) {
    const role =
      (await prisma.role.findFirst({ where: { roleName } })) ??
      (await prisma.role.create({ data: { roleName } }));
    roleIds[roleName] = role.id;
  }

  const departments = [
    { departmentCode: 'KYTHUAT', departmentName: 'Phòng Kỹ thuật' },
    { departmentCode: 'KETOAN', departmentName: 'Phòng Kế toán' },
  ];
  const departmentIds: Record<string, number> = {};
  for (const d of departments) {
    const dep = await prisma.department.upsert({
      where: { departmentCode: d.departmentCode },
      update: {},
      create: d,
    });
    departmentIds[d.departmentCode] = dep.id;
  }

  // Loại thiết bị: `prefix` quyết định tiền tố hợp lệ của DeviceCode.
  const deviceTypes = [
    { typeName: 'Laptop', prefix: 'LT' },
    { typeName: 'Máy tính để bàn', prefix: 'PC' },
    { typeName: 'Màn hình', prefix: 'MN' },
    { typeName: 'Máy in', prefix: 'MI' },
  ];
  for (const t of deviceTypes) {
    await prisma.deviceType.upsert({
      where: { prefix: t.prefix },
      update: { typeName: t.typeName },
      create: t,
    });
  }

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@saigonbank.com.vn',
      password: await hashPassword('Admin@123'),
      fullName: 'Quản trị viên hệ thống',
      roleId: roleIds[ROLE.ADMIN],
      departmentId: null, // Quản trị viên không thuộc phòng ban nghiệp vụ
      status: USER_STATUS.ACTIVE,
      isVerified: true,
    },
  });

  console.log(
    `Seed xong: ${Object.keys(roleIds).length} role, ${departments.length} phòng ban, ` +
      `${deviceTypes.length} loại thiết bị, user=${admin.username}`,
  );

  // User để test luồng quên mật khẩu: Resend (onboarding@resend.dev) chỉ gửi được tới email chủ tài khoản.
  // Email lấy từ .env để không commit email cá nhân vào repo.
  const devEmail = process.env.DEV_USER_EMAIL?.trim().toLowerCase();
  if (devEmail) {
    const dev = await prisma.user.upsert({
      where: { username: 'dev' },
      update: { email: devEmail },
      create: {
        username: 'dev',
        email: devEmail,
        password: await hashPassword('Dev@1234'),
        fullName: 'Người dùng thử nghiệm',
        roleId: roleIds[ROLE.STAFF],
        departmentId: departmentIds.KYTHUAT,
        status: USER_STATUS.ACTIVE,
        isVerified: false,
      },
    });
    console.log(`Seed user dev: ${dev.username} <${dev.email}>`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
