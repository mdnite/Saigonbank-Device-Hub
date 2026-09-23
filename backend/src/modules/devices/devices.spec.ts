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

describe('Devices: /devices, /device-types', () => {
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
  }, 30_000);

  afterEach(async () => {
    expect(prisma.device.delete).not.toHaveBeenCalled();
    await app.close();
  });

  const newDevice = (over: Record<string, unknown> = {}) => ({
    deviceCode: 'LT-000001',
    deviceName: 'Dell Latitude 5420',
    specDetail: 'i5 · 16GB · 512GB',
    unit: 'Cái',
    deviceTypeId: 1,
    ...over,
  });

  it('tạo thiết bị thành công', async () => {
    const res = await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice())
      .expect(201);
    expect(res.body.data.deviceCode).toBe('LT-000001');
    expect(res.body.data.status).toBe('Trong kho');
    expect(res.body.message).toBe('Đã tạo thiết bị');
  });

  it('đặt trạng thái "Đã cấp phát" khi có người sở hữu', async () => {
    const res = await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice({ currentUserId: staff.id }))
      .expect(201);
    expect(res.body.data.status).toBe('Đã cấp phát');
  });

  it('chặn mã thiết bị trùng', async () => {
    await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice())
      .expect(201);
    const res = await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice())
      .expect(409);
    expect(res.body.message).toBe('Mã thiết bị đã tồn tại');
  });

  it('chặn số serial trùng', async () => {
    await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice({ serialNumber: 'SN-1' }))
      .expect(201);
    const res = await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice({ deviceCode: 'LT-000002', serialNumber: 'SN-1' }))
      .expect(409);
    expect(res.body.message).toBe('Số serial đã tồn tại');
  });

  it('chặn mã sai định dạng', async () => {
    const res = await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice({ deviceCode: 'LT-1' }))
      .expect(400);
    expect(res.body.message).toContain('Mã thiết bị phải có dạng PC-000123');
  });

  it('chặn mã có tiền tố không khớp loại thiết bị', async () => {
    const res = await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice({ deviceCode: 'PC-000001', deviceTypeId: 1 }))
      .expect(400);
    expect(res.body.message).toBe(
      'Mã thiết bị phải bắt đầu bằng "LT" theo loại thiết bị đã chọn',
    );
  });

  it('chặn loại thiết bị không tồn tại', async () => {
    const res = await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice({ deviceTypeId: 99 }))
      .expect(400);
    expect(res.body.message).toBe('Loại thiết bị không tồn tại');
  });

  it('PATCH không cho đặt trạng thái "Đã xóa"', async () => {
    const created = await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice())
      .expect(201);
    const res = await http()
      .patch(`/devices/${created.body.data.id}`)
      .set('Authorization', tokenOf(admin))
      .send({ status: 'Đã xóa' })
      .expect(400);
    expect(res.body.message).toBe('Trạng thái không hợp lệ');
  });

  it('PATCH gửi accessories thay toàn bộ danh sách linh kiện cũ', async () => {
    const created = await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(
        newDevice({
          accessories: [
            {
              accessoryCode: 'LK-001',
              accessoryName: 'Sạc',
              accessoryType: 'Nguồn',
              unit: 'Cái',
            },
          ],
        }),
      )
      .expect(201);
    const res = await http()
      .patch(`/devices/${created.body.data.id}`)
      .set('Authorization', tokenOf(admin))
      .send({
        accessories: [
          {
            accessoryCode: 'LK-002',
            accessoryName: 'Chuột',
            accessoryType: 'Ngoại vi',
            unit: 'Cái',
          },
        ],
      })
      .expect(200);
    expect(
      res.body.data.accessories.map(
        (a: { accessoryCode: string }) => a.accessoryCode,
      ),
    ).toEqual(['LK-002']);
  });

  it('PATCH đổi loại thiết bị mà không gửi mã: kiểm mã cũ theo tiền tố loại mới', async () => {
    const created = await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice())
      .expect(201);
    const res = await http()
      .patch(`/devices/${created.body.data.id}`)
      .set('Authorization', tokenOf(admin))
      .send({ deviceTypeId: 2 })
      .expect(400);
    expect(res.body.message).toBe(
      'Mã thiết bị phải bắt đầu bằng "PC" theo loại thiết bị đã chọn',
    );
  });

  it('xoá mềm: không xoá row, thiết bị biến khỏi danh sách', async () => {
    const created = await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice())
      .expect(201);
    const id = created.body.data.id;
    await http()
      .delete(`/devices/${id}`)
      .set('Authorization', tokenOf(admin))
      .expect(200);
    expect(prisma.device.delete).not.toHaveBeenCalled();
    expect(prisma.devices.find((d) => d.id === id)!.status).toBe('Đã xóa');
    const list = await http()
      .get('/devices')
      .set('Authorization', tokenOf(admin))
      .expect(200);
    expect(list.body.data.some((d: { id: number }) => d.id === id)).toBe(false);
  });

  it('lọc theo trạng thái "Đã xóa" trả về thiết bị đã xoá mềm', async () => {
    const created = await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice())
      .expect(201);
    const id = created.body.data.id;
    await http()
      .delete(`/devices/${id}`)
      .set('Authorization', tokenOf(admin))
      .expect(200);
    const res = await http()
      .get('/devices')
      .query({ status: 'Đã xóa' })
      .set('Authorization', tokenOf(admin))
      .expect(200);
    expect(res.body.data.some((d: { id: number }) => d.id === id)).toBe(true);
  });

  it('thao tác trên thiết bị đã xoá trả 404', async () => {
    const created = await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice())
      .expect(201);
    const id = created.body.data.id;
    await http()
      .delete(`/devices/${id}`)
      .set('Authorization', tokenOf(admin))
      .expect(200);
    const res = await http()
      .delete(`/devices/${id}`)
      .set('Authorization', tokenOf(admin))
      .expect(404);
    expect(res.body.message).toBe('Thiết bị không tồn tại');
  });

  it('id vượt phạm vi int32 trả 404 chứ không phải 500', async () => {
    await http()
      .get('/devices/9999999999')
      .set('Authorization', tokenOf(admin))
      .expect(404);
  });

  it('POST /devices/purge (Admin): xoá vĩnh viễn thiết bị đã xoá mềm, bỏ qua id chưa xoá', async () => {
    const deleted = await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice())
      .expect(201);
    const deletedId = deleted.body.data.id;
    await http()
      .delete(`/devices/${deletedId}`)
      .set('Authorization', tokenOf(admin))
      .expect(200);

    const active = await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice({ deviceCode: 'LT-000002' }))
      .expect(201);
    const activeId = active.body.data.id;

    const res = await http()
      .post('/devices/purge')
      .set('Authorization', tokenOf(admin))
      .send({ ids: [deletedId, activeId] })
      .expect(201);

    expect(res.body.data.count).toBe(1);
    expect(prisma.devices.some((d) => d.id === deletedId)).toBe(false);
    expect(prisma.devices.find((d) => d.id === activeId)?.status).toBe(
      'Trong kho',
    );
    expect(prisma.device.deleteMany).toHaveBeenCalled();
  });

  it('POST /devices/purge: Nhân viên không được gọi', async () => {
    const res = await http()
      .post('/devices/purge')
      .set('Authorization', tokenOf(staff))
      .send({ ids: [1] })
      .expect(403);
    expect(res.body.message).toBe('Bạn không có quyền thực hiện thao tác này');
  });

  it('Nhân viên không được tạo thiết bị', async () => {
    const res = await http()
      .post('/devices')
      .set('Authorization', tokenOf(staff))
      .send(newDevice())
      .expect(403);
    expect(res.body.message).toBe('Bạn không có quyền thực hiện thao tác này');
  });

  it('Trưởng phòng Kế toán không được tạo, Trưởng phòng Kỹ thuật thì được', async () => {
    const ketoan = addUser('tpketoan', 2);
    ketoan.departmentId = 2;
    await http()
      .post('/devices')
      .set('Authorization', tokenOf(ketoan))
      .send(newDevice())
      .expect(403);

    const kythuat = addUser('tpkythuat', 2); // addUser đặt departmentId = 1 (KYTHUAT)
    await http()
      .post('/devices')
      .set('Authorization', tokenOf(kythuat))
      .send(newDevice({ deviceCode: 'LT-000009' }))
      .expect(201);
  });

  it('Nhân viên vẫn đọc được danh sách và danh mục loại thiết bị', async () => {
    await http()
      .get('/devices')
      .set('Authorization', tokenOf(staff))
      .expect(200);
    const types = await http()
      .get('/device-types')
      .set('Authorization', tokenOf(staff))
      .expect(200);
    expect(types.body.data.length).toBeGreaterThanOrEqual(2);
  });
});
