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

describe('Device orders: /device-orders', () => {
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

  let admin: User;
  let techHead: User;
  let financeHead: User;
  let staff: User;

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
    staff = addUser('staff', 3, 1);
  }, 30_000);

  afterEach(async () => {
    expect(prisma.deviceOrder.delete).not.toHaveBeenCalled();
    await app.close();
  });

  describe('POST /device-orders', () => {
    it('tạo đơn Cấp phát thành công', async () => {
      const deviceId = await createDevice();
      const res = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(techHead))
        .send({ type: 'Cấp phát', targetUserId: staff.id, deviceIds: [deviceId] })
        .expect(201);
      expect(res.body.data.type).toBe('Cấp phát');
      expect(res.body.data.status).toBe('Chờ duyệt');
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].device.id).toBe(deviceId);
      expect(res.body.message).toBe('Đã tạo đơn');
    });

    it('tạo đơn Thu hồi thành công', async () => {
      const deviceId = await createDevice({ currentUserId: staff.id, departmentId: staff.departmentId });
      const res = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(techHead))
        .send({ type: 'Thu hồi', targetUserId: staff.id, deviceIds: [deviceId] })
        .expect(201);
      expect(res.body.data.type).toBe('Thu hồi');
      expect(res.body.data.status).toBe('Chờ duyệt');
    });

    it('thiếu deviceIds: 400', async () => {
      const res = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(techHead))
        .send({ type: 'Cấp phát', targetUserId: staff.id, deviceIds: [] })
        .expect(400);
      expect(res.body.message).toContain('Vui lòng chọn ít nhất 1 thiết bị');
    });

    it('deviceIds trùng nhau: 400', async () => {
      const deviceId = await createDevice();
      const res = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(techHead))
        .send({ type: 'Cấp phát', targetUserId: staff.id, deviceIds: [deviceId, deviceId] })
        .expect(400);
      expect(res.body.message).toContain('trùng');
    });

    it('Cấp phát thiết bị không còn trong kho: 400', async () => {
      const deviceId = await createDevice({ currentUserId: staff.id });
      const res = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(techHead))
        .send({ type: 'Cấp phát', targetUserId: staff.id, deviceIds: [deviceId] })
        .expect(400);
      expect(res.body.message).toContain('không còn trong kho');
    });

    it('Thu hồi thiết bị không do người này giữ: 400', async () => {
      const other = addUser('other', 3, 1);
      const deviceId = await createDevice({ currentUserId: other.id });
      const res = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(techHead))
        .send({ type: 'Thu hồi', targetUserId: staff.id, deviceIds: [deviceId] })
        .expect(400);
      expect(res.body.message).toContain('không do người này đang giữ');
    });

    it('targetUserId không tồn tại: 400', async () => {
      const deviceId = await createDevice();
      const res = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(techHead))
        .send({ type: 'Cấp phát', targetUserId: 9999, deviceIds: [deviceId] })
        .expect(400);
      expect(res.body.message).toBe('Người dùng không tồn tại');
    });

    it('Admin không được tạo đơn: 403', async () => {
      const deviceId = await createDevice();
      const res = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(admin))
        .send({ type: 'Cấp phát', targetUserId: staff.id, deviceIds: [deviceId] })
        .expect(403);
      expect(res.body.message).toBe('Bạn không có quyền thực hiện thao tác này');
    });

    it('Trưởng phòng Kế toán không được tạo đơn: 403', async () => {
      const deviceId = await createDevice();
      await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(financeHead))
        .send({ type: 'Cấp phát', targetUserId: staff.id, deviceIds: [deviceId] })
        .expect(403);
    });
  });

  describe('GET /device-orders', () => {
    it('Nhân viên không xem được: 403', async () => {
      await http().get('/device-orders').set('Authorization', tokenOf(staff)).expect(403);
    });

    it('đơn không tồn tại: 404', async () => {
      const res = await http()
        .get('/device-orders/9999')
        .set('Authorization', tokenOf(admin))
        .expect(404);
      expect(res.body.message).toBe('Đơn không tồn tại');
    });
  });

  describe('PATCH /device-orders/:id/approve, /reject', () => {
    it('duyệt đơn Cấp phát: ghi đúng Device', async () => {
      const deviceId = await createDevice();
      const created = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(techHead))
        .send({ type: 'Cấp phát', targetUserId: staff.id, deviceIds: [deviceId] })
        .expect(201);
      const orderId = created.body.data.id;

      const res = await http()
        .patch(`/device-orders/${orderId}/approve`)
        .set('Authorization', tokenOf(admin))
        .expect(200);
      expect(res.body.data.status).toBe('Đã duyệt');
      expect(res.body.message).toBe('Đã duyệt đơn');

      const device = (
        await http().get(`/devices/${deviceId}`).set('Authorization', tokenOf(admin))
      ).body.data;
      expect(device.status).toBe('Đã cấp phát');
      expect(device.currentUser.id).toBe(staff.id);
      expect(device.department.id).toBe(staff.departmentId);
      expect(device.allocatedOn).not.toBeNull();
    });

    it('duyệt đơn Thu hồi: xoá currentUserId/departmentId/allocatedOn', async () => {
      const deviceId = await createDevice({
        currentUserId: staff.id,
        departmentId: staff.departmentId,
        allocatedOn: '2026-01-01',
      });
      const created = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(techHead))
        .send({ type: 'Thu hồi', targetUserId: staff.id, deviceIds: [deviceId] })
        .expect(201);

      await http()
        .patch(`/device-orders/${created.body.data.id}/approve`)
        .set('Authorization', tokenOf(admin))
        .expect(200);

      const device = (
        await http().get(`/devices/${deviceId}`).set('Authorization', tokenOf(admin))
      ).body.data;
      expect(device.status).toBe('Trong kho');
      expect(device.currentUser).toBeNull();
      expect(device.department).toBeNull();
      expect(device.allocatedOn).toBeNull();
    });

    it('duyệt lại đơn đã xử lý: 400', async () => {
      const deviceId = await createDevice();
      const created = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(techHead))
        .send({ type: 'Cấp phát', targetUserId: staff.id, deviceIds: [deviceId] })
        .expect(201);
      const orderId = created.body.data.id;
      await http().patch(`/device-orders/${orderId}/approve`).set('Authorization', tokenOf(admin)).expect(200);

      const res = await http()
        .patch(`/device-orders/${orderId}/approve`)
        .set('Authorization', tokenOf(admin))
        .expect(400);
      expect(res.body.message).toBe('Đơn đã được xử lý');
    });

    it('duyệt đơn khi thiết bị đã đổi trạng thái sau khi tạo đơn: 400, không ghi đè Device', async () => {
      const deviceId = await createDevice();
      const created = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(techHead))
        .send({ type: 'Cấp phát', targetUserId: staff.id, deviceIds: [deviceId] })
        .expect(201);
      const orderId = created.body.data.id;

      // Thiết bị được cấp phát qua đường khác trước khi đơn này kịp duyệt.
      await http()
        .patch(`/devices/${deviceId}`)
        .set('Authorization', tokenOf(admin))
        .send({ currentUserId: staff.id, status: 'Đã cấp phát' })
        .expect(200);

      const res = await http()
        .patch(`/device-orders/${orderId}/approve`)
        .set('Authorization', tokenOf(admin))
        .expect(400);
      expect(res.body.message).toContain('không còn trong kho');
    });

    it('từ chối thiếu lý do: 400', async () => {
      const deviceId = await createDevice();
      const created = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(techHead))
        .send({ type: 'Cấp phát', targetUserId: staff.id, deviceIds: [deviceId] })
        .expect(201);
      const res = await http()
        .patch(`/device-orders/${created.body.data.id}/reject`)
        .set('Authorization', tokenOf(admin))
        .send({ reason: '' })
        .expect(400);
      expect(res.body.message).toContain('Vui lòng nhập lý do từ chối');
    });

    it('từ chối ghi đúng lý do, không đổi Device', async () => {
      const deviceId = await createDevice();
      const created = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(techHead))
        .send({ type: 'Cấp phát', targetUserId: staff.id, deviceIds: [deviceId] })
        .expect(201);
      const orderId = created.body.data.id;

      const res = await http()
        .patch(`/device-orders/${orderId}/reject`)
        .set('Authorization', tokenOf(admin))
        .send({ reason: 'Không đủ thiết bị dự phòng' })
        .expect(200);
      expect(res.body.data.status).toBe('Từ chối');
      expect(res.body.data.rejectReason).toBe('Không đủ thiết bị dự phòng');
      expect(res.body.message).toBe('Đã từ chối đơn');

      const device = (
        await http().get(`/devices/${deviceId}`).set('Authorization', tokenOf(admin))
      ).body.data;
      expect(device.status).toBe('Trong kho');
      expect(device.currentUser).toBeNull();
    });

    it('Trưởng phòng Kỹ thuật không được duyệt/từ chối: 403', async () => {
      const deviceId = await createDevice();
      const created = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(techHead))
        .send({ type: 'Cấp phát', targetUserId: staff.id, deviceIds: [deviceId] })
        .expect(201);
      const orderId = created.body.data.id;
      await http()
        .patch(`/device-orders/${orderId}/approve`)
        .set('Authorization', tokenOf(techHead))
        .expect(403);
      await http()
        .patch(`/device-orders/${orderId}/reject`)
        .set('Authorization', tokenOf(techHead))
        .send({ reason: 'x' })
        .expect(403);
    });

    it('id đơn ngoài phạm vi int32: 404', async () => {
      await http()
        .patch('/device-orders/9999999999/approve')
        .set('Authorization', tokenOf(admin))
        .expect(404);
    });
  });
});
