import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { Device, User } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { setupApp } from '../../app.setup';
import { MailService } from '../../shared/mail/mail.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { hashPassword } from '../../shared/security/password';
import { createFakePrisma, type FakePrisma } from '../../test/fake-prisma';
import { USER_STATUS } from '../identity/user-status';

// Role id trong fake: 1 Quản trị viên, 2 Trưởng phòng, 3 Nhân viên, 4 Cộng tác viên.
// Phòng ban: 1 KYTHUAT "Phòng Kỹ thuật", 2 KETOAN "Phòng Kế toán". DeviceType: 1 Laptop, 2 Máy tính để bàn.

describe('Kiểm kê: /audits', () => {
  let app: INestApplication;
  let prisma: FakePrisma;
  let secretHash: string;
  const http = () => request(app.getHttpServer());

  function addUser(
    username: string,
    roleId: number,
    departmentId: number | null,
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

  /** Dựng thiết bị thẳng trong fake — API thiết bị không đặt được người giữ / trạng thái. */
  function addDevice(over: Partial<Device> = {}): Device {
    const id = prisma.devices.length + 1;
    const now = new Date();
    const device: Device = {
      id,
      deviceCode: `LT-${String(id).padStart(6, '0')}`,
      deviceName: 'Dell Latitude 5420',
      serialNumber: `SN-${id}`,
      specDetail: 'i5 · 16GB',
      unit: 'Cái',
      location: null,
      purchaseDate: null,
      supplier: null,
      warrantyMonths: null,
      warrantyCondition: null,
      warrantyExpiresOn: null,
      status: 'Trong kho',
      allocatedOn: null,
      deviceTypeId: 1,
      currentUserId: null,
      createdAt: now,
      updatedAt: now,
      ...over,
    };
    prisma.devices.push(device);
    return device;
  }
  const allocatedTo = (holder: User, over: Partial<Device> = {}) =>
    addDevice({
      status: 'Đã cấp phát',
      currentUserId: holder.id,
      allocatedOn: new Date('2026-01-01'),
      ...over,
    });
  function addAccessory(deviceId: number, accessoryCode: string) {
    prisma.deviceAccessories.push({
      id: prisma.deviceAccessories.length + 1,
      deviceId,
      accessoryCode,
      accessoryName: 'Sạc 65W',
      accessoryType: 'Nguồn',
      unit: 'Cái',
    });
  }
  const schedule = (body: Record<string, unknown> = {}, as?: User) =>
    http()
      .post('/audits')
      .set('Authorization', tokenOf(as ?? acctCollab))
      .send({
        departmentId: 1,
        dueDate: '2026-10-31',
        purpose: 'Định kỳ',
        ...body,
      });

  let admin: User;
  let techHead: User;
  let techCollab: User;
  let acctHead: User;
  let acctCollab: User;
  let techStaff: User;
  let acctStaff: User;

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
    techCollab = addUser('techcollab', 4, 1);
    acctHead = addUser('accthead', 2, 2);
    acctCollab = addUser('acctcollab', 4, 2);
    techStaff = addUser('techstaff', 3, 1);
    acctStaff = addUser('acctstaff', 3, 2);
  }, 30_000);

  afterEach(async () => {
    expect(prisma.audit.delete).not.toHaveBeenCalled();
    await app.close();
  });

  describe('POST /audits — lập lịch', () => {
    it('phòng Kỹ thuật: snapshot máy đã cấp cho người phòng đó, kèm linh kiện và thành viên', async () => {
      const mine = allocatedTo(techStaff, { location: 'Tầng 3' });
      addAccessory(mine.id, 'SAC-01');
      allocatedTo(acctStaff); // phòng khác
      addDevice(); // Trong kho

      const res = await schedule({
        memberIds: [acctStaff.id, techStaff.id],
      }).expect(201);
      const a = res.body.data;
      expect(res.body.message).toBe('Đã lập lịch kiểm kê');
      expect(a.status).toBe('Chưa kiểm kê');
      expect(a.unitName).toBe('Phòng Kỹ thuật');
      expect(a.departmentId).toBe(1);
      expect(a.dueDate.slice(0, 10)).toBe('2026-10-31');
      expect(a.createdBy.id).toBe(acctCollab.id);
      expect(a.items).toHaveLength(1);
      expect(a.items[0]).toMatchObject({
        deviceId: mine.id,
        deviceCode: mine.deviceCode,
        serialNumber: mine.serialNumber,
        deviceTypeName: 'Laptop',
        unit: 'Cái',
        holderName: techStaff.fullName,
        departmentName: 'Phòng Kỹ thuật',
        deviceStatus: 'Đã cấp phát',
        result: null,
        note: null,
      });
      expect(a.items[0].accessories).toEqual([
        expect.objectContaining({
          accessoryCode: 'SAC-01',
          accessoryType: 'Nguồn',
          result: null,
        }),
      ]);
      expect(a.members.map((m: { id: number }) => m.id).sort()).toEqual(
        [techStaff.id, acctStaff.id].sort(),
      );
      expect(a).toMatchObject({
        deviceCount: 1,
        totalLines: 2,
        countedLines: 0,
      });
      // Snapshot người sở hữu lưu thẳng id để lúc duyệt so lại.
      expect(prisma.auditItems[0].holderUserId).toBe(techStaff.id);
    });

    it('đơn vị "Kho" (departmentId null): chỉ máy Trong kho, departmentName null', async () => {
      const stock = addDevice();
      allocatedTo(techStaff);

      const res = await schedule({ departmentId: null }).expect(201);
      expect(res.body.data.unitName).toBe('Kho');
      expect(res.body.data.departmentId).toBeNull();
      expect(
        res.body.data.items.map((i: { deviceId: number }) => i.deviceId),
      ).toEqual([stock.id]);
      expect(res.body.data.items[0]).toMatchObject({
        holderName: null,
        departmentName: null,
      });
    });

    it('lọc theo loại thiết bị và vị trí', async () => {
      const hit = allocatedTo(techStaff, {
        deviceTypeId: 2,
        location: 'Tầng 3',
      });
      allocatedTo(techStaff, { deviceTypeId: 1, location: 'Tầng 3' });
      allocatedTo(techStaff, { deviceTypeId: 2, location: 'Tầng 4' });

      const res = await schedule({
        deviceTypeId: 2,
        location: '  Tầng 3 ',
      }).expect(201);
      expect(
        res.body.data.items.map((i: { deviceId: number }) => i.deviceId),
      ).toEqual([hit.id]);
      expect(res.body.data.deviceTypeName).toBe('Máy tính để bàn');
      expect(res.body.data.location).toBe('Tầng 3');
    });

    it('bỏ qua máy Đang chờ duyệt / Chờ thanh lý / Thất lạc / Đã xóa', async () => {
      const ok = allocatedTo(techStaff);
      for (const status of [
        'Đang chờ duyệt',
        'Chờ thanh lý',
        'Thất lạc',
        'Đã xóa',
      ]) {
        addDevice({ status, currentUserId: techStaff.id });
      }
      const res = await schedule().expect(201);
      expect(
        res.body.data.items.map((i: { deviceId: number }) => i.deviceId),
      ).toEqual([ok.id]);
    });

    it('không máy nào khớp (kể cả phòng ban chưa có ai): 400', async () => {
      const res = await schedule().expect(400);
      expect(res.body.message).toBe('Không có thiết bị nào khớp bộ lọc');
      expect(prisma.audits).toHaveLength(0);
    });

    it('máy đang thuộc đợt đang mở khác: 400 cả đợt, liệt kê mã', async () => {
      const d = allocatedTo(techStaff);
      allocatedTo(techStaff);
      await schedule().expect(201);

      const res = await schedule().expect(400);
      expect(res.body.message).toBe(
        `Thiết bị đang thuộc đợt kiểm kê khác chưa xong: ${d.deviceCode}, LT-000002`,
      );
      expect(prisma.audits).toHaveLength(1);
    });

    it.each([
      [{ departmentId: undefined }, 'Vui lòng chọn đơn vị kiểm kê'],
      [{ purpose: 'Bất chợt' }, 'Mục đích không hợp lệ'],
      [{ dueDate: 'không phải ngày' }, 'Ngày kiểm kê không hợp lệ'],
    ])('body sai %j: 400 "%s"', async (body, message) => {
      allocatedTo(techStaff);
      const res = await schedule(body).expect(400);
      expect(res.body.message).toContain(message);
    });

    it('phòng ban không tồn tại: 400', async () => {
      const res = await schedule({ departmentId: 99 }).expect(400);
      expect(res.body.message).toBe('Đơn vị kiểm kê không tồn tại');
    });

    it('thành viên đã ngừng hoạt động: 400', async () => {
      allocatedTo(techStaff);
      const locked = addUser('locked', 3, 2, USER_STATUS.INACTIVE);
      const res = await schedule({ memberIds: [locked.id] }).expect(400);
      expect(res.body.message).toBe(
        'Thành viên tham gia không hợp lệ hoặc đã ngừng hoạt động',
      );
    });

    it('snapshot không đổi khi thiết bị đổi sau đó', async () => {
      const d = allocatedTo(techStaff);
      const res = await schedule().expect(201);
      Object.assign(d, { deviceName: 'Tên mới', currentUserId: acctStaff.id });
      const after = await http()
        .get(`/audits/${res.body.data.id}`)
        .set('Authorization', tokenOf(acctHead))
        .expect(200);
      expect(after.body.data.items[0]).toMatchObject({
        deviceName: 'Dell Latitude 5420',
        holderName: techStaff.fullName,
      });
    });
  });

  describe('quyền', () => {
    it.each([
      ['Quản trị viên', () => admin, 403],
      ['TP Kỹ thuật', () => techHead, 403],
      ['CTV Kỹ thuật', () => techCollab, 403],
      ['Nhân viên', () => acctStaff, 403],
      ['TP Kế toán', () => acctHead, 200],
      ['CTV Kế toán', () => acctCollab, 200],
    ])('GET /audits — %s → %i', async (_label, who, status) => {
      await http()
        .get('/audits')
        .set('Authorization', tokenOf(who()))
        .expect(status);
    });

    it('TP Kế toán không lập lịch được: 403', async () => {
      allocatedTo(techStaff);
      await schedule({}, acctHead).expect(403);
    });

    it('chưa đăng nhập: 401', async () => {
      await http().get('/audits').expect(401);
    });
  });

  describe('GET /audits, /audits/:id, /audits/locations', () => {
    it('danh sách mới nhất trước, lọc trạng thái, tìm theo đơn vị / mục đích, không có items', async () => {
      allocatedTo(techStaff);
      addDevice();
      await schedule().expect(201);
      await schedule({ departmentId: null, purpose: 'Cuối năm' }).expect(201);

      const all = await http()
        .get('/audits')
        .set('Authorization', tokenOf(acctHead))
        .expect(200);
      expect(
        all.body.data.map((a: { unitName: string }) => a.unitName),
      ).toEqual(['Kho', 'Phòng Kỹ thuật']);
      expect(all.body.data[0].items).toBeUndefined();
      expect(all.body.data[0]).toMatchObject({
        deviceCount: 1,
        totalLines: 1,
        countedLines: 0,
      });

      const found = await http()
        .get('/audits?q=cuối')
        .set('Authorization', tokenOf(acctHead))
        .expect(200);
      expect(found.body.data).toHaveLength(1);

      const byStatus = await http()
        .get('/audits?status=Đã duyệt')
        .set('Authorization', tokenOf(acctHead))
        .expect(200);
      expect(byStatus.body.data).toHaveLength(0);
    });

    it('id không tồn tại / không phải số / ngoài int4: 404', async () => {
      for (const id of ['999', 'abc', '99999999999']) {
        const res = await http()
          .get(`/audits/${id}`)
          .set('Authorization', tokenOf(acctHead))
          .expect(404);
        expect(res.body.message).toBe('Đợt kiểm kê không tồn tại');
      }
    });

    it('locations: không trùng, bỏ null và máy Đã xóa, sắp A→Z', async () => {
      addDevice({ location: 'Tầng 3' });
      addDevice({ location: 'Kho chính' });
      addDevice({ location: 'Tầng 3' });
      addDevice({ location: null });
      addDevice({ location: 'Đã bỏ', status: 'Đã xóa' });
      const res = await http()
        .get('/audits/locations')
        .set('Authorization', tokenOf(acctCollab))
        .expect(200);
      expect(res.body.data).toEqual(['Kho chính', 'Tầng 3']);
    });
  });
});
