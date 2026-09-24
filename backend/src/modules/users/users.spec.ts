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
import { USER_STATUS } from '../identity/user-status';

// Role id trong fake: 1 Quản trị viên, 2 Trưởng phòng, 3 Nhân viên. Phòng ban: 1 KYTHUAT, 2 KETOAN.

describe('Users: /users, /roles, /departments', () => {
  let app: INestApplication;
  let prisma: FakePrisma;
  let secretHash: string;
  const http = () => request(app.getHttpServer());

  function addUser(
    username: string,
    roleId: number,
    status: string = USER_STATUS.ACTIVE,
  ): User {
    const now = new Date();
    const user: User = {
      id: prisma.users.length + 1,
      roleId,
      departmentId: 1,
      username,
      password: secretHash,
      fullName: `User ${username}`,
      email: `${username}@saigonbank.com.vn`,
      status,
      isVerified: true,
      createdAt: now,
      updatedAt: now,
    };
    prisma.users.push(user);
    return user;
  }
  const tokenOf = (user: User) =>
    `Bearer ${app.get(JwtService).sign({ userId: user.id, roleId: user.roleId })}`;

  let admin: User;
  let staff: User;
  let locked: User;
  let removed: User;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    secretHash = await hashPassword('Secret@123');
  });

  beforeEach(async () => {
    prisma = createFakePrisma();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(MailService)
      .useValue({ sendOtpEmail: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();

    admin = addUser('admin', 1);
    staff = addUser('staff', 3);
    locked = addUser('locked', 3, USER_STATUS.INACTIVE);
    removed = addUser('removed', 3, USER_STATUS.DELETED);
  }, 30_000);

  afterEach(async () => {
    expect(prisma.user.delete).not.toHaveBeenCalled();
    await app.close();
  });

  describe('guard', () => {
    const expired = {
      success: false,
      data: null,
      error: 'UNAUTHORIZED',
      message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
    };

    it('không có token: 401', async () => {
      expect((await http().get('/users').expect(401)).body).toEqual(expired);
    });

    it('token rác: 401', async () => {
      await http().get('/users').set('Authorization', 'Bearer abc').expect(401);
    });

    it('token của user đã bị khoá: 401 (khoá có hiệu lực ngay)', async () => {
      await http()
        .get('/roles')
        .set('Authorization', tokenOf(locked))
        .expect(401);
    });

    it('token của user đã xoá: 401', async () => {
      await http()
        .get('/roles')
        .set('Authorization', tokenOf(removed))
        .expect(401);
    });

    it('Nhân viên gọi /users: 403', async () => {
      const res = await http()
        .get('/users')
        .set('Authorization', tokenOf(staff))
        .expect(403);
      expect(res.body).toEqual({
        success: false,
        data: null,
        error: 'FORBIDDEN',
        message: 'Bạn không có quyền thực hiện thao tác này',
      });
    });
  });

  describe('GET /roles, /departments', () => {
    it('user đã đăng nhập bất kỳ role nào đều đọc được', async () => {
      const roles = await http()
        .get('/roles')
        .set('Authorization', tokenOf(staff))
        .expect(200);
      expect(roles.body.data).toEqual([
        { id: 1, roleName: 'Quản trị viên' },
        { id: 2, roleName: 'Trưởng phòng' },
        { id: 3, roleName: 'Nhân viên' },
      ]);
      const deps = await http()
        .get('/departments')
        .set('Authorization', tokenOf(staff))
        .expect(200);
      expect(deps.body.data).toEqual([
        { id: 1, departmentCode: 'KYTHUAT', departmentName: 'Phòng Kỹ thuật' },
        { id: 2, departmentCode: 'KETOAN', departmentName: 'Phòng Kế toán' },
      ]);
    });
  });

  describe('GET /users/lookup', () => {
    // 200 (không phải 403) cho Nhân viên cũng chứng minh route không bị UsersController nuốt.
    it('chỉ trả id/fullName/username, bỏ user "Đã xóa"', async () => {
      const res = await http()
        .get('/users/lookup')
        .set('Authorization', tokenOf(staff))
        .expect(200);
      expect(res.body.data).toEqual([
        { id: admin.id, fullName: admin.fullName, username: 'admin' },
        { id: staff.id, fullName: staff.fullName, username: 'staff' },
        { id: locked.id, fullName: locked.fullName, username: 'locked' },
      ]);
      expect(
        res.body.data.some(
          (u: { username: string }) => u.username === 'removed',
        ),
      ).toBe(false);
    });
  });

  describe('GET /users', () => {
    it('mặc định ẩn "Đã xóa", có role + department, không có password', async () => {
      const res = await http()
        .get('/users')
        .set('Authorization', tokenOf(admin))
        .expect(200);
      expect(
        res.body.data.map((u: { username: string }) => u.username),
      ).toEqual(['admin', 'staff', 'locked']);
      expect(res.body.data[0]).toMatchObject({
        id: admin.id,
        role: { id: 1, roleName: 'Quản trị viên' },
        department: {
          id: 1,
          departmentCode: 'KYTHUAT',
          departmentName: 'Phòng Kỹ thuật',
        },
        isVerified: true,
      });
      expect(res.body.data[0]).not.toHaveProperty('password');
      expect(res.body.data[0]).not.toHaveProperty('roleId');
    });

    it('lọc status "Đã xóa" thì thấy user đã xoá', async () => {
      const res = await http()
        .get('/users')
        .query({ status: USER_STATUS.DELETED })
        .set('Authorization', tokenOf(admin))
        .expect(200);
      expect(
        res.body.data.map((u: { username: string }) => u.username),
      ).toEqual(['removed']);
    });

    it('search không phân biệt hoa thường, lọc theo roleId', async () => {
      const res = await http()
        .get('/users')
        .query({ search: 'STAF', roleId: 3 })
        .set('Authorization', tokenOf(admin))
        .expect(200);
      expect(
        res.body.data.map((u: { username: string }) => u.username),
      ).toEqual(['staff']);
    });

    it('status không hợp lệ: 400', async () => {
      await http()
        .get('/users')
        .query({ status: 'abc' })
        .set('Authorization', tokenOf(admin))
        .expect(400);
    });
  });

  describe('POST /users', () => {
    const body = {
      username: '  tp.ketoan ',
      email: 'TP.KeToan@SaigonBank.com.vn',
      fullName: 'Trưởng phòng Kế toán',
      password: 'Init@123',
      roleId: 2,
      departmentId: 2,
    };

    it('201: tạo user chưa xác minh, hash mật khẩu, không trả password', async () => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send(body)
        .expect(201);
      expect(res.body).toMatchObject({
        success: true,
        message: 'Đã tạo người dùng',
      });
      expect(res.body.data).toMatchObject({
        username: 'tp.ketoan',
        email: 'tp.ketoan@saigonbank.com.vn',
        status: USER_STATUS.ACTIVE,
        isVerified: false,
        role: { id: 2, roleName: 'Trưởng phòng' },
        department: {
          id: 2,
          departmentCode: 'KETOAN',
          departmentName: 'Phòng Kế toán',
        },
      });
      expect(res.body.data).not.toHaveProperty('password');
      const saved = prisma.users.at(-1)!;
      expect(saved.password).not.toBe('Init@123');
      expect(saved.password).toMatch(/^\$2[aby]\$/);
    });

    it('không có departmentId: department null', async () => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({ ...body, departmentId: undefined })
        .expect(201);
      expect(res.body.data.department).toBeNull();
    });

    it('409 trùng username', async () => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({ ...body, username: 'staff' })
        .expect(409);
      expect(res.body.message).toBe('Tên đăng nhập đã tồn tại');
    });

    it('409 trùng email (kể cả khác hoa thường)', async () => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({ ...body, email: 'STAFF@saigonbank.com.vn' })
        .expect(409);
      expect(res.body.message).toBe('Email đã tồn tại');
    });

    it('400 role không tồn tại', async () => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({ ...body, roleId: 99 })
        .expect(400);
      expect(res.body.message).toBe('Vai trò không tồn tại');
    });

    it('400 phòng ban không tồn tại', async () => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({ ...body, departmentId: 99 })
        .expect(400);
      expect(res.body.message).toBe('Phòng ban không tồn tại');
    });

    it('400 validate: mật khẩu ngắn, email sai', async () => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({ ...body, password: '123', email: 'x' })
        .expect(400);
      expect(res.body.message).toContain('Mật khẩu phải có ít nhất 6 ký tự');
      expect(res.body.message).toContain('Email không hợp lệ');
    });
  });

  describe('PATCH /users/:id/status', () => {
    it('khoá rồi mở khoá', async () => {
      const lock = await http()
        .patch(`/users/${staff.id}/status`)
        .set('Authorization', tokenOf(admin))
        .send({ status: USER_STATUS.INACTIVE })
        .expect(200);
      expect(lock.body).toMatchObject({
        message: 'Đã cập nhật trạng thái',
        data: { id: staff.id, status: USER_STATUS.INACTIVE },
      });
      // Token cũ của user vừa bị khoá không dùng được nữa.
      await http()
        .get('/roles')
        .set('Authorization', tokenOf(staff))
        .expect(401);

      await http()
        .patch(`/users/${staff.id}/status`)
        .set('Authorization', tokenOf(admin))
        .send({ status: USER_STATUS.ACTIVE })
        .expect(200);
      expect(prisma.users[staff.id - 1].status).toBe(USER_STATUS.ACTIVE);
    });

    it('không cho đặt "Đã xóa" qua PATCH: 400', async () => {
      await http()
        .patch(`/users/${staff.id}/status`)
        .set('Authorization', tokenOf(admin))
        .send({ status: USER_STATUS.DELETED })
        .expect(400);
    });

    it('tự khoá mình: 400', async () => {
      const res = await http()
        .patch(`/users/${admin.id}/status`)
        .set('Authorization', tokenOf(admin))
        .send({ status: USER_STATUS.INACTIVE })
        .expect(400);
      expect(res.body.message).toBe('Không thể tự khoá tài khoản của mình');
    });

    it('user đã xoá / không tồn tại / id không phải số: 404', async () => {
      for (const id of [removed.id, 999, 'abc']) {
        const res = await http()
          .patch(`/users/${id}/status`)
          .set('Authorization', tokenOf(admin))
          .send({ status: USER_STATUS.INACTIVE })
          .expect(404);
        expect(res.body.message).toBe('Người dùng không tồn tại');
      }
    });
  });

  describe('DELETE /users/:id', () => {
    it('xoá mềm: row còn, status "Đã xóa", login sau đó 401', async () => {
      const res = await http()
        .delete(`/users/${staff.id}`)
        .set('Authorization', tokenOf(admin))
        .expect(200);
      expect(res.body).toEqual({
        success: true,
        data: null,
        error: null,
        message: 'Đã xoá người dùng',
      });
      expect(prisma.users[staff.id - 1].status).toBe(USER_STATUS.DELETED);
      await http()
        .post('/auth/login')
        .send({ identifier: 'staff', password: 'Secret@123' })
        .expect(401);
    });

    it('tự xoá mình: 400', async () => {
      const res = await http()
        .delete(`/users/${admin.id}`)
        .set('Authorization', tokenOf(admin))
        .expect(400);
      expect(res.body.message).toBe('Không thể tự xoá tài khoản của mình');
    });

    it('đã xoá rồi: 404', async () => {
      await http()
        .delete(`/users/${removed.id}`)
        .set('Authorization', tokenOf(admin))
        .expect(404);
    });
  });

  describe('POST /users/purge', () => {
    it('Admin: xoá vĩnh viễn user đã xoá mềm, bỏ qua id chưa xoá, dọn cả token reset mật khẩu', async () => {
      prisma.tokens.push({
        id: 1,
        userId: removed.id,
        tokenHash: 'x',
        expiresAt: new Date(),
        usedAt: null,
        createdAt: new Date(),
      });

      const res = await http()
        .post('/users/purge')
        .set('Authorization', tokenOf(admin))
        .send({ ids: [removed.id, staff.id] })
        .expect(201);

      expect(res.body).toEqual({
        success: true,
        data: { count: 1 },
        error: null,
        message: 'Đã dọn thùng rác',
      });
      expect(prisma.users.some((u) => u.id === removed.id)).toBe(false);
      expect(prisma.users.some((u) => u.id === staff.id)).toBe(true);
      expect(prisma.tokens.some((t) => t.userId === removed.id)).toBe(false);
      expect(prisma.user.deleteMany).toHaveBeenCalled();
    });

    it('Admin: bỏ qua id còn bị tham chiếu trong DeviceOrder', async () => {
      const removed2 = addUser('removed2', 3, USER_STATUS.DELETED);
      prisma.deviceOrders.push({
        id: 1,
        type: 'Cấp phát',
        status: 'Chờ duyệt',
        targetUserId: removed2.id,
        note: null,
        createdById: admin.id,
        decidedById: null,
        decidedAt: null,
        rejectReason: null,
        createdAt: new Date(),
      });

      const res = await http()
        .post('/users/purge')
        .set('Authorization', tokenOf(admin))
        .send({ ids: [removed.id, removed2.id] })
        .expect(201);

      expect(res.body.data).toEqual({ count: 1 });
      expect(prisma.users.some((u) => u.id === removed.id)).toBe(false);
      expect(prisma.users.some((u) => u.id === removed2.id)).toBe(true);
    });

    it('Nhân viên không được gọi: 403', async () => {
      const res = await http()
        .post('/users/purge')
        .set('Authorization', tokenOf(staff))
        .send({ ids: [removed.id] })
        .expect(403);
      expect(res.body.message).toBe(
        'Bạn không có quyền thực hiện thao tác này',
      );
    });
  });

  // Id/khoá ngoại vượt phạm vi Int (int4) của Postgres: Prisma ném lỗi => 500 nếu không chặn.
  describe('số nguyên vượt phạm vi int32', () => {
    const HUGE = 9_999_999_999;

    it('PATCH/DELETE với id quá lớn: 404, không truy vấn DB', async () => {
      const queriedHugeId = () =>
        prisma.user.findUnique.mock.calls.some(
          ([args]) => (args.where as { id?: number }).id === HUGE,
        );

      await http()
        .delete(`/users/${HUGE}`)
        .set('Authorization', tokenOf(admin))
        .expect(404);
      expect(queriedHugeId()).toBe(false);

      const res = await http()
        .patch(`/users/${HUGE}/status`)
        .set('Authorization', tokenOf(admin))
        .send({ status: USER_STATUS.INACTIVE })
        .expect(404);
      expect(res.body.message).toBe('Người dùng không tồn tại');
      expect(queriedHugeId()).toBe(false);
    });

    it('roleId / departmentId quá lớn: 400', async () => {
      await http()
        .get(`/users?roleId=${HUGE}`)
        .set('Authorization', tokenOf(admin))
        .expect(400);

      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({
          username: 'huge',
          email: 'huge@saigonbank.com.vn',
          fullName: 'Huge',
          password: 'Secret@123',
          roleId: HUGE,
        })
        .expect(400);
      expect(res.body.message).toBe('Vai trò không hợp lệ');
    });
  });
});
