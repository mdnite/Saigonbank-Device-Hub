// Dữ liệu CHỈ dành cho môi trường dev — không chạy seed này trên production.
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/shared/security/password';
import { USER_STATUS } from '../src/modules/identity/user-status';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const role =
    (await prisma.role.findFirst({ where: { roleName: 'Quản trị viên' } })) ??
    (await prisma.role.create({ data: { roleName: 'Quản trị viên' } }));

  const department = await prisma.department.upsert({
    where: { departmentCode: 'IT' },
    update: {},
    create: {
      departmentCode: 'IT',
      departmentName: 'Phòng Công nghệ thông tin',
    },
  });

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@saigonbank.com.vn',
      password: await hashPassword('Admin@123'),
      fullName: 'Quản trị viên hệ thống',
      roleId: role.id,
      departmentId: department.id,
      status: USER_STATUS.ACTIVE,
      isVerified: true,
    },
  });

  console.log(
    `Seed xong: role=${role.id}, department=${department.id}, user=${admin.username}`,
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
        roleId: role.id,
        departmentId: department.id,
        status: USER_STATUS.ACTIVE,
        isVerified: true,
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
