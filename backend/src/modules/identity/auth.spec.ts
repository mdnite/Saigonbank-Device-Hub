import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { User } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { setupApp } from '../../app.setup';
import { MailService } from '../../shared/mail/mail.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { hashPassword } from '../../shared/security/password';
import { createFakePrisma, type FakePrisma } from '../../test/fake-prisma';
import { MAX_OTP_ATTEMPTS } from './password-reset.service';
import { USER_STATUS } from './user-status';

// Test chạy toàn bộ pipeline Nest (ValidationPipe, interceptor, filter, JWT); chỉ Prisma và Resend là giả lập trong RAM.
// Khi có Postgres thật, nên chạy thêm bản test này trên DB thật để bắt khác biệt ngữ nghĩa query.

describe('Identity: /auth', () => {
  let app: INestApplication;
  let prisma: FakePrisma;
  const mail = {
    sendOtpEmail: jest.fn<Promise<void>, [string, string, number]>(),
  };
  const http = () => request(app.getHttpServer());
  const lastOtp = () => mail.sendOtpEmail.mock.calls.at(-1)![1];

  let secretHash: string;

  function addUser(username: string, status: string) {
    const user: User = {
      id: prisma.users.length + 1,
      roleId: 3,
      departmentId: null,
      username,
      password: secretHash,
      fullName: `User ${username}`,
      email: `${username}@saigonbank.com.vn`,
      status,
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.users.push(user);
    return user;
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    secretHash = await hashPassword('Secret@123');
  });

  beforeEach(async () => {
    prisma = createFakePrisma();
    mail.sendOtpEmail.mockReset().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(MailService)
      .useValue(mail)
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    addUser('active', USER_STATUS.ACTIVE);
    addUser('locked', USER_STATUS.INACTIVE);
    addUser('removed', USER_STATUS.DELETED);
  }, 30_000);

  afterEach(async () => {
    // Quy ước xoá mềm: không luồng nào được phép xoá cứng row.
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.delete).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.deleteMany).not.toHaveBeenCalled();
    await app.close();
  });

  describe('POST /auth/login', () => {
    const wrongCredentials = {
      success: false,
      data: null,
      error: 'UNAUTHORIZED',
      message: 'Sai tên đăng nhập hoặc mật khẩu',
    };

    it('đăng nhập bằng username: 200, wrapper chuẩn, JWT chứa userId + roleId, không trả password', async () => {
      const res = await http()
        .post('/auth/login')
        .send({ identifier: 'active', password: 'Secret@123' })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        error: null,
        message: 'Đăng nhập thành công',
      });
      expect(res.body.data.user).toMatchObject({
        id: 1,
        username: 'active',
        roleId: 3,
      });
      expect(res.body.data.user).not.toHaveProperty('password');
      const payload = app.get(JwtService).verify(res.body.data.accessToken);
      expect(payload).toMatchObject({ userId: 1, roleId: 3 });
    });

    it('đăng nhập bằng email: 200', async () => {
      await http()
        .post('/auth/login')
        .send({
          identifier: 'active@saigonbank.com.vn',
          password: 'Secret@123',
        })
        .expect(200);
    });

    it('identifier không tồn tại: 401', async () => {
      const res = await http()
        .post('/auth/login')
        .send({ identifier: 'ghost', password: 'x' })
        .expect(401);
      expect(res.body).toEqual(wrongCredentials);
    });

    it('sai mật khẩu: 401', async () => {
      const res = await http()
        .post('/auth/login')
        .send({ identifier: 'active', password: 'wrong' })
        .expect(401);
      expect(res.body).toEqual(wrongCredentials);
    });

    it('"Ngừng hoạt động" + đúng mật khẩu: 403 "Tài khoản đã bị khoá"', async () => {
      const res = await http()
        .post('/auth/login')
        .send({ identifier: 'locked', password: 'Secret@123' })
        .expect(403);
      expect(res.body).toEqual({
        success: false,
        data: null,
        error: 'FORBIDDEN',
        message: 'Tài khoản đã bị khoá',
      });
    });

    it('"Ngừng hoạt động" + sai mật khẩu: 401, không lộ trạng thái khoá', async () => {
      const res = await http()
        .post('/auth/login')
        .send({ identifier: 'locked', password: 'wrong' })
        .expect(401);
      expect(res.body).toEqual(wrongCredentials);
    });

    it('"Đã xóa" + đúng mật khẩu: 401 y hệt sai mật khẩu', async () => {
      const res = await http()
        .post('/auth/login')
        .send({ identifier: 'removed', password: 'Secret@123' })
        .expect(401);
      expect(res.body).toEqual(wrongCredentials);
    });

    it('body rỗng: 400 trong wrapper lỗi', async () => {
      const res = await http().post('/auth/login').send({}).expect(400);
      expect(res.body).toMatchObject({
        success: false,
        data: null,
        error: 'BAD_REQUEST',
      });
      expect(res.body.message).toContain('Vui lòng nhập mật khẩu');
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('email hợp lệ: 200, lưu hash OTP (không plaintext), hạn 5 phút, gửi mail đúng người', async () => {
      const before = Date.now();
      const res = await http()
        .post('/auth/forgot-password')
        .send({ email: 'active@saigonbank.com.vn' })
        .expect(200);

      expect(res.body).toEqual({
        success: true,
        data: null,
        error: null,
        message: 'Đã gửi mã xác thực',
      });
      const [to, otp, ttl] = mail.sendOtpEmail.mock.calls[0];
      expect(to).toBe('active@saigonbank.com.vn');
      expect(otp).toMatch(/^\d{4}$/);
      expect(ttl).toBe(5);

      const [token] = prisma.tokens;
      expect(token.userId).toBe(1);
      expect(token.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(token.tokenHash).not.toContain(otp);
      const ttlMs = token.expiresAt.getTime() - before;
      expect(ttlMs).toBeGreaterThanOrEqual(5 * 60_000);
      expect(ttlMs).toBeLessThan(5 * 60_000 + 5_000);
    });

    it.each([
      'ghost@saigonbank.com.vn',
      'locked@saigonbank.com.vn',
      'removed@saigonbank.com.vn',
    ])(
      '%s: 404 "Email không tồn tại", không tạo token, không gửi mail',
      async (email) => {
        const res = await http()
          .post('/auth/forgot-password')
          .send({ email })
          .expect(404);
        expect(res.body).toEqual({
          success: false,
          data: null,
          error: 'NOT_FOUND',
          message: 'Email không tồn tại',
        });
        expect(prisma.tokens).toHaveLength(0);
        expect(mail.sendOtpEmail).not.toHaveBeenCalled();
      },
    );
  });

  describe('POST /auth/verify-otp', () => {
    const email = 'active@saigonbank.com.vn';
    const invalid = {
      success: false,
      data: null,
      error: 'BAD_REQUEST',
      message: 'Mã không đúng hoặc đã hết hạn',
    };
    const requestOtp = async () => {
      await http().post('/auth/forgot-password').send({ email }).expect(200);
      return lastOtp();
    };
    const wrongOf = (otp: string) => (otp === '0000' ? '0001' : '0000');

    it('mã đúng: 200 và KHÔNG đánh dấu usedAt', async () => {
      const otp = await requestOtp();
      const res = await http()
        .post('/auth/verify-otp')
        .send({ email, otp })
        .expect(200);
      expect(res.body.message).toBe('Mã xác thực hợp lệ');
      expect(prisma.tokens[0].usedAt).toBeNull();
    });

    it('mã sai: 400', async () => {
      const otp = await requestOtp();
      const res = await http()
        .post('/auth/verify-otp')
        .send({ email, otp: wrongOf(otp) })
        .expect(400);
      expect(res.body).toEqual(invalid);
    });

    it('mã hết hạn: 400', async () => {
      const otp = await requestOtp();
      prisma.tokens[0].expiresAt = new Date(Date.now() - 1);
      expect(
        (await http().post('/auth/verify-otp').send({ email, otp }).expect(400))
          .body,
      ).toEqual(invalid);
    });

    it('mã đã dùng: 400', async () => {
      const otp = await requestOtp();
      prisma.tokens[0].usedAt = new Date();
      expect(
        (await http().post('/auth/verify-otp').send({ email, otp }).expect(400))
          .body,
      ).toEqual(invalid);
    });

    it('email không tồn tại: 400 cùng message', async () => {
      const res = await http()
        .post('/auth/verify-otp')
        .send({ email: 'ghost@saigonbank.com.vn', otp: '1234' })
        .expect(400);
      expect(res.body).toEqual(invalid);
    });

    it('chỉ mã mới nhất có hiệu lực', async () => {
      const first = await requestOtp();
      const second = await requestOtp();
      if (first !== second) {
        await http()
          .post('/auth/verify-otp')
          .send({ email, otp: first })
          .expect(400);
      }
      await http()
        .post('/auth/verify-otp')
        .send({ email, otp: second })
        .expect(200);
    });

    it(`sai ${MAX_OTP_ATTEMPTS} lần thì mã đúng cũng bị từ chối (chống dò mã 4 số)`, async () => {
      const otp = await requestOtp();
      for (let i = 0; i < MAX_OTP_ATTEMPTS; i++) {
        await http()
          .post('/auth/verify-otp')
          .send({ email, otp: wrongOf(otp) })
          .expect(400);
      }
      await http().post('/auth/verify-otp').send({ email, otp }).expect(400);
    });

    it('otp sai định dạng: 400 từ validation', async () => {
      const res = await http()
        .post('/auth/verify-otp')
        .send({ email, otp: '12a4' })
        .expect(400);
      expect(res.body.message).toContain('Mã xác thực phải gồm 4 chữ số');
    });
  });

  describe('POST /auth/reset-password', () => {
    const email = 'active@saigonbank.com.vn';

    it('luồng đầy đủ forgot → verify → reset → login: đổi mật khẩu, set usedAt, giữ row token', async () => {
      await http().post('/auth/forgot-password').send({ email }).expect(200);
      const otp = lastOtp();
      await http().post('/auth/verify-otp').send({ email, otp }).expect(200);

      const res = await http()
        .post('/auth/reset-password')
        .send({ email, otp, newPassword: 'NewPass@1' })
        .expect(200);
      expect(res.body).toEqual({
        success: true,
        data: null,
        error: null,
        message: 'Đặt lại mật khẩu thành công',
      });

      expect(prisma.tokens).toHaveLength(1);
      expect(prisma.tokens[0].usedAt).toBeInstanceOf(Date);
      await http()
        .post('/auth/login')
        .send({ identifier: 'active', password: 'Secret@123' })
        .expect(401);
      await http()
        .post('/auth/login')
        .send({ identifier: 'active', password: 'NewPass@1' })
        .expect(200);

      // Mã đã dùng không dùng lại được.
      await http()
        .post('/auth/reset-password')
        .send({ email, otp, newPassword: 'Another@1' })
        .expect(400);
    });

    it('bỏ qua verify-otp nhưng gửi mã sai: 400 và mật khẩu không đổi (BE luôn tự xác thực lại)', async () => {
      await http().post('/auth/forgot-password').send({ email }).expect(200);
      const otp = lastOtp();
      const passwordBefore = prisma.users[0].password;

      await http()
        .post('/auth/reset-password')
        .send({
          email,
          otp: otp === '0000' ? '0001' : '0000',
          newPassword: 'NewPass@1',
        })
        .expect(400);
      expect(prisma.users[0].password).toBe(passwordBefore);
      expect(prisma.tokens[0].usedAt).toBeNull();
    });

    it('mật khẩu mới dưới 6 ký tự: 400', async () => {
      const res = await http()
        .post('/auth/reset-password')
        .send({ email, otp: '1234', newPassword: '123' })
        .expect(400);
      expect(res.body.message).toContain('Mật khẩu phải có ít nhất 6 ký tự');
    });
  });
});
