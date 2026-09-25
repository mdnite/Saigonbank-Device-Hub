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
// DeviceType id trong fake: 1 Laptop (LT), 2 Máy tính để bàn (PC).

describe('Device transfers: /device-transfers', () => {
  let app: INestApplication;
  let prisma: FakePrisma;
  let secretHash: string;
  const http = () => request(app.getHttpServer());

  function addUser(
    username: string,
    roleId: number,
    departmentId: number | null = 1,
    status: string = USER_STATUS.ACTIVE,
  ): User {
    const now = new Date();
    const user: User = {
      id: prisma.users.length + 1,
      roleId,
      departmentId,
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

  const newDevice = (over: Record<string, unknown> = {}) => ({
    deviceCode: `LT-${String(prisma.devices.length + 1).padStart(6, '0')}`,
    deviceName: 'Dell Latitude 5420',
    specDetail: 'i5 · 16GB · 512GB',
    unit: 'Cái',
    deviceTypeId: 1,
    ...over,
  });
  async function createDevice(over: Record<string, unknown> = {}): Promise<number> {
    const res = await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice(over))
      .expect(201);
    return res.body.data.id as number;
  }
  /** Tạo thiết bị "Đã cấp phát" cho đúng `holder` — dùng làm dữ liệu nền cho các test điều chuyển. */
  async function createAllocatedDevice(holder: User, over: Record<string, unknown> = {}): Promise<number> {
    return createDevice({ currentUserId: holder.id, departmentId: holder.departmentId, ...over });
  }

  let admin: User;
  let techHead: User;
  let financeHead: User;
  let staffA: User;
  let staffB: User;

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

    admin = addUser('admin', 1, null);
    techHead = addUser('techhead', 2, 1);
    financeHead = addUser('financehead', 2, 2);
    staffA = addUser('staffa', 3, 1);
    staffB = addUser('staffb', 3, 2);
  }, 30_000);

  afterEach(async () => {
    expect(prisma.deviceOrder.delete).not.toHaveBeenCalled();
    await app.close();
  });

  describe('POST /device-transfers', () => {
    it('tạo lệnh thành công', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      const res = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(admin))
        .send({ fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [deviceId] })
        .expect(201);
      expect(res.body.data.status).toBe('Chờ duyệt');
      expect(res.body.data.fromUser.id).toBe(staffA.id);
      expect(res.body.data.toUser.id).toBe(staffB.id);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.message).toBe('Đã tạo lệnh điều chuyển');
    });

    it('thiếu deviceIds: 400', async () => {
      const res = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(admin))
        .send({ fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [] })
        .expect(400);
      expect(res.body.message).toContain('Vui lòng chọn ít nhất 1 thiết bị');
    });

    it('deviceIds trùng nhau: 400', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      const res = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(admin))
        .send({ fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [deviceId, deviceId] })
        .expect(400);
      expect(res.body.message).toContain('trùng');
    });

    it('fromUserId === toUserId: 400', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      const res = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(admin))
        .send({ fromUserId: staffA.id, toUserId: staffA.id, deviceIds: [deviceId] })
        .expect(400);
      expect(res.body.message).toBe('Người nhận phải khác người đang giữ');
    });

    it('thiết bị không do fromUserId giữ: 400', async () => {
      const deviceId = await createAllocatedDevice(staffB);
      const res = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(admin))
        .send({ fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [deviceId] })
        .expect(400);
      expect(res.body.message).toContain('không do người này đang giữ');
    });

    it('thiết bị đang Trong kho (chưa cấp phát cho ai): 400', async () => {
      const deviceId = await createDevice();
      const res = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(admin))
        .send({ fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [deviceId] })
        .expect(400);
      expect(res.body.message).toContain('không do người này đang giữ');
    });

    it('fromUserId/toUserId không tồn tại: 400', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      const res = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(admin))
        .send({ fromUserId: staffA.id, toUserId: 9999, deviceIds: [deviceId] })
        .expect(400);
      expect(res.body.message).toBe('Người dùng không tồn tại');
    });

    it('Trưởng phòng Kỹ thuật không được tạo lệnh: 403', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      const res = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(techHead))
        .send({ fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [deviceId] })
        .expect(403);
      expect(res.body.message).toBe('Bạn không có quyền thực hiện thao tác này');
    });
  });

  describe('GET /device-transfers', () => {
    it('Nhân viên không xem được: 403', async () => {
      await http().get('/device-transfers').set('Authorization', tokenOf(staffA)).expect(403);
    });

    it('lệnh không tồn tại: 404', async () => {
      const res = await http()
        .get('/device-transfers/9999')
        .set('Authorization', tokenOf(admin))
        .expect(404);
      expect(res.body.message).toBe('Đơn không tồn tại');
    });

    it('id không phải số: 404', async () => {
      await http()
        .get('/device-transfers/abc')
        .set('Authorization', tokenOf(admin))
        .expect(404);
    });

    it('id vượt phạm vi int32: 404', async () => {
      await http()
        .patch('/device-transfers/9999999999/approve')
        .set('Authorization', tokenOf(techHead))
        .expect(404);
    });
  });

  describe('PATCH /device-transfers/:id/approve, /reject', () => {
    it('duyệt: chuyển đúng chủ, status không đổi', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      const created = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(admin))
        .send({ fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [deviceId] })
        .expect(201);
      const transferId = created.body.data.id;

      const res = await http()
        .patch(`/device-transfers/${transferId}/approve`)
        .set('Authorization', tokenOf(techHead))
        .expect(200);
      expect(res.body.data.status).toBe('Đã duyệt');
      expect(res.body.message).toBe('Đã duyệt lệnh điều chuyển');

      const device = (
        await http().get(`/devices/${deviceId}`).set('Authorization', tokenOf(admin))
      ).body.data;
      expect(device.status).toBe('Đã cấp phát');
      expect(device.currentUser.id).toBe(staffB.id);
      expect(device.department.id).toBe(staffB.departmentId);
      expect(device.allocatedOn).not.toBeNull();
    });

    it('duyệt lại lệnh đã xử lý: 400', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      const created = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(admin))
        .send({ fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [deviceId] })
        .expect(201);
      const transferId = created.body.data.id;
      await http()
        .patch(`/device-transfers/${transferId}/approve`)
        .set('Authorization', tokenOf(techHead))
        .expect(200);

      const res = await http()
        .patch(`/device-transfers/${transferId}/approve`)
        .set('Authorization', tokenOf(techHead))
        .expect(400);
      expect(res.body.message).toBe('Đơn đã được xử lý');
    });

    it('duyệt khi thiết bị đã đổi chủ sau khi tạo lệnh: 400', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      const created = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(admin))
        .send({ fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [deviceId] })
        .expect(201);
      const transferId = created.body.data.id;

      // Thiết bị đổi chủ qua đường khác trước khi lệnh này kịp duyệt.
      await http()
        .patch(`/devices/${deviceId}`)
        .set('Authorization', tokenOf(admin))
        .send({ currentUserId: staffB.id, status: 'Đã cấp phát' })
        .expect(200);

      const res = await http()
        .patch(`/device-transfers/${transferId}/approve`)
        .set('Authorization', tokenOf(techHead))
        .expect(400);
      expect(res.body.message).toContain('không do người này đang giữ');
    });

    it('duyệt đồng thời 2 lệnh cùng nhắm 1 thiết bị: lệnh thua báo lỗi, không ghi đè', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      const order1 = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(admin))
        .send({ fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [deviceId] })
        .expect(201);
      const order2 = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(admin))
        .send({ fromUserId: staffA.id, toUserId: financeHead.id, deviceIds: [deviceId] })
        .expect(201);

      const realTransaction = prisma.$transaction;
      let intercepted = false;
      prisma.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
        if (!intercepted) {
          intercepted = true;
          await http()
            .patch(`/device-transfers/${order2.body.data.id}/approve`)
            .set('Authorization', tokenOf(techHead))
            .expect(200);
        }
        return realTransaction(fn);
      });

      const res = await http()
        .patch(`/device-transfers/${order1.body.data.id}/approve`)
        .set('Authorization', tokenOf(techHead))
        .expect(400);
      expect(res.body.message).toContain('không do người này đang giữ');

      const device = (
        await http().get(`/devices/${deviceId}`).set('Authorization', tokenOf(admin))
      ).body.data;
      expect(device.currentUser.id).toBe(financeHead.id);
    });

    it('duyệt khi toUserId đã bị xoá mềm sau khi tạo lệnh: 400', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      const created = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(admin))
        .send({ fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [deviceId] })
        .expect(201);
      const transferId = created.body.data.id;

      await http()
        .patch(`/users/${staffB.id}/status`)
        .set('Authorization', tokenOf(admin))
        .send({ status: 'Ngừng hoạt động' })
        .expect(200);
      await http().delete(`/users/${staffB.id}`).set('Authorization', tokenOf(admin)).expect(200);

      const res = await http()
        .patch(`/device-transfers/${transferId}/approve`)
        .set('Authorization', tokenOf(techHead))
        .expect(400);
      expect(res.body.message).toBe('Người dùng không tồn tại');

      const device = (
        await http().get(`/devices/${deviceId}`).set('Authorization', tokenOf(admin))
      ).body.data;
      expect(device.currentUser.id).toBe(staffA.id);
    });

    it('từ chối thiếu lý do: 400', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      const created = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(admin))
        .send({ fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [deviceId] })
        .expect(201);
      const res = await http()
        .patch(`/device-transfers/${created.body.data.id}/reject`)
        .set('Authorization', tokenOf(techHead))
        .send({ reason: '' })
        .expect(400);
      expect(res.body.message).toContain('Vui lòng nhập lý do từ chối');
    });

    it('từ chối ghi đúng lý do, không đổi Device', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      const created = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(admin))
        .send({ fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [deviceId] })
        .expect(201);
      const transferId = created.body.data.id;

      const res = await http()
        .patch(`/device-transfers/${transferId}/reject`)
        .set('Authorization', tokenOf(techHead))
        .send({ reason: 'Thiết bị đang cần bảo trì' })
        .expect(200);
      expect(res.body.data.status).toBe('Từ chối');
      expect(res.body.data.rejectReason).toBe('Thiết bị đang cần bảo trì');

      const device = (
        await http().get(`/devices/${deviceId}`).set('Authorization', tokenOf(admin))
      ).body.data;
      expect(device.currentUser.id).toBe(staffA.id);
    });

    it('Admin không được duyệt/từ chối: 403', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      const created = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(admin))
        .send({ fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [deviceId] })
        .expect(201);
      const transferId = created.body.data.id;
      await http()
        .patch(`/device-transfers/${transferId}/approve`)
        .set('Authorization', tokenOf(admin))
        .expect(403);
      await http()
        .patch(`/device-transfers/${transferId}/reject`)
        .set('Authorization', tokenOf(admin))
        .send({ reason: 'x' })
        .expect(403);
    });

    it('Trưởng phòng Kế toán không được duyệt: 403', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      const created = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(admin))
        .send({ fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [deviceId] })
        .expect(201);
      await http()
        .patch(`/device-transfers/${created.body.data.id}/approve`)
        .set('Authorization', tokenOf(financeHead))
        .expect(403);
    });
  });
});
