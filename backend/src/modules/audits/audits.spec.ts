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

  const as = (user: User) => ({ Authorization: tokenOf(user) });
  /** Lập lịch 1 đợt phòng Kỹ thuật có 1 máy (kèm 1 linh kiện nếu withAccessory) và trả về chi tiết. */
  async function newAudit(withAccessory = true) {
    const d = allocatedTo(techStaff);
    if (withAccessory) addAccessory(d.id, `SAC-${d.id}`);
    const res = await schedule().expect(201);
    return res.body.data as {
      id: number;
      items: { id: number; deviceId: number; accessories: { id: number }[] }[];
    };
  }
  const post = (path: string, user: User, body?: object) =>
    http().post(path).set(as(user)).send(body);

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
        `Thành viên tham gia không hợp lệ hoặc đã ngừng hoạt động: ${locked.fullName}`,
      );
    });

    it('thành viên không tồn tại: thông báo nêu #id', async () => {
      allocatedTo(techStaff);
      const res = await schedule({ memberIds: [9999] }).expect(400);
      expect(res.body.message).toBe(
        'Thành viên tham gia không hợp lệ hoặc đã ngừng hoạt động: #9999',
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

  describe('vòng đời', () => {
    it('Bắt đầu: Chưa kiểm kê → Đang kiểm kê; bấm lần 2: 400; TP: 403', async () => {
      const a = await newAudit();
      const res = await post(`/audits/${a.id}/start`, acctCollab).expect(201);
      expect(res.body.data.status).toBe('Đang kiểm kê');
      expect(res.body.data.startedAt).not.toBeNull();
      expect(res.body.message).toBe('Đã bắt đầu kiểm kê');
      const again = await post(`/audits/${a.id}/start`, acctCollab).expect(400);
      expect(again.body.message).toBe(
        'Đợt kiểm kê đã được xử lý hoặc không ở trạng thái phù hợp',
      );
      await post(`/audits/${a.id}/start`, acctHead).expect(403);
    });

    it('Huỷ: chỉ khi Chưa kiểm kê, nhả máy cho đợt mới', async () => {
      const a = await newAudit();
      const res = await post(`/audits/${a.id}/cancel`, acctCollab).expect(201);
      expect(res.body.data.status).toBe('Đã hủy');
      await schedule().expect(201); // cùng máy, lập lại được

      const b = (await http().get('/audits').set(as(acctCollab))).body.data[0];
      await post(`/audits/${b.id}/start`, acctCollab).expect(201);
      await post(`/audits/${b.id}/cancel`, acctCollab).expect(400);
    });

    it('Nhập kết quả + ghi chú từng dòng; ghi chú rỗng → null', async () => {
      const a = await newAudit();
      await post(`/audits/${a.id}/start`, acctCollab).expect(201);
      const itemId = a.items[0].id;
      const accId = a.items[0].accessories[0].id;

      let res = await http()
        .patch(`/audits/${a.id}/items/${itemId}`)
        .set(as(acctCollab))
        .send({ result: 'Thiếu', note: '  không thấy  ' })
        .expect(200);
      expect(res.body.data.items[0]).toMatchObject({
        result: 'Thiếu',
        note: 'không thấy',
      });

      res = await http()
        .patch(`/audits/${a.id}/items/${itemId}`)
        .set(as(acctCollab))
        .send({ note: '' })
        .expect(200);
      expect(res.body.data.items[0]).toMatchObject({
        result: 'Thiếu',
        note: null,
      });

      res = await http()
        .patch(`/audits/${a.id}/accessories/${accId}`)
        .set(as(acctCollab))
        .send({ result: 'Hỏng' })
        .expect(200);
      expect(res.body.data.items[0].accessories[0].result).toBe('Hỏng');
      expect(res.body.data.countedLines).toBe(2);
    });

    it('Nhập khi chưa bắt đầu: 400; kết quả lạ: 400; dòng của đợt khác: 404', async () => {
      const a = await newAudit();
      const itemId = a.items[0].id;
      await http()
        .patch(`/audits/${a.id}/items/${itemId}`)
        .set(as(acctCollab))
        .send({ result: 'Đủ' })
        .expect(400);
      await post(`/audits/${a.id}/start`, acctCollab).expect(201);
      const bad = await http()
        .patch(`/audits/${a.id}/items/${itemId}`)
        .set(as(acctCollab))
        .send({ result: 'Mất' })
        .expect(400);
      expect(bad.body.message).toContain('Kết quả kiểm kê không hợp lệ');

      addDevice({ id: 50, deviceCode: 'PC-000050' }); // máy Kho cho đợt thứ 2
      const other = (await schedule({ departmentId: null }).expect(201)).body
        .data;
      const res = await http()
        .patch(`/audits/${a.id}/items/${other.items[0].id}`)
        .set(as(acctCollab))
        .send({ result: 'Đủ' })
        .expect(404);
      expect(res.body.message).toBe('Dòng kiểm kê không tồn tại');
      await http()
        .patch(`/audits/${a.id}/accessories/9999`)
        .set(as(acctCollab))
        .send({ result: 'Đủ' })
        .expect(404);
    });

    it('Ghi Đủ cho dòng chưa đếm: không đè dòng đã có kết quả', async () => {
      const a = await newAudit();
      await post(`/audits/${a.id}/start`, acctCollab).expect(201);
      await http()
        .patch(`/audits/${a.id}/items/${a.items[0].id}`)
        .set(as(acctCollab))
        .send({ result: 'Hỏng' })
        .expect(200);
      const res = await post(
        `/audits/${a.id}/mark-uncounted-ok`,
        acctCollab,
      ).expect(201);
      expect(res.body.data.items[0].result).toBe('Hỏng');
      expect(res.body.data.items[0].accessories[0].result).toBe('Đủ');
      expect(res.body.data.countedLines).toBe(res.body.data.totalLines);
    });

    it('Đợt không có linh kiện nào: Ghi Đủ rồi Gửi duyệt vẫn chạy', async () => {
      const a = await newAudit(false);
      await post(`/audits/${a.id}/start`, acctCollab).expect(201);
      await post(`/audits/${a.id}/mark-uncounted-ok`, acctCollab).expect(201);
      const res = await post(`/audits/${a.id}/submit`, acctCollab).expect(201);
      expect(res.body.data.status).toBe('Chờ duyệt');
    });

    it('Gửi duyệt khi còn dòng chưa đếm: 400 nêu số dòng', async () => {
      const a = await newAudit();
      await post(`/audits/${a.id}/start`, acctCollab).expect(201);
      await http()
        .patch(`/audits/${a.id}/items/${a.items[0].id}`)
        .set(as(acctCollab))
        .send({ result: 'Đủ' })
        .expect(200);
      const res = await post(`/audits/${a.id}/submit`, acctCollab).expect(400);
      expect(res.body.message).toBe('Còn 1 dòng chưa có kết quả kiểm kê');
    });

    it('Gửi duyệt → Chờ duyệt, khoá nhập; Từ chối (TP) → Đang kiểm kê + lý do; gửi lại xoá lý do', async () => {
      const a = await newAudit();
      await post(`/audits/${a.id}/start`, acctCollab).expect(201);
      await post(`/audits/${a.id}/mark-uncounted-ok`, acctCollab).expect(201);
      const sent = await post(`/audits/${a.id}/submit`, acctCollab).expect(201);
      expect(sent.body.data.status).toBe('Chờ duyệt');
      expect(sent.body.message).toBe('Đã gửi duyệt');
      await http()
        .patch(`/audits/${a.id}/items/${a.items[0].id}`)
        .set(as(acctCollab))
        .send({ result: 'Thiếu' })
        .expect(400);

      await post(`/audits/${a.id}/reject`, acctCollab, { reason: 'x' }).expect(
        403,
      );
      const noReason = await post(`/audits/${a.id}/reject`, acctHead, {
        reason: '  ',
      }).expect(400);
      expect(noReason.body.message).toContain('Vui lòng nhập lý do từ chối');

      const rejected = await post(`/audits/${a.id}/reject`, acctHead, {
        reason: 'Đếm lại tầng 3',
      }).expect(201);
      expect(rejected.body.data).toMatchObject({
        status: 'Đang kiểm kê',
        rejectReason: 'Đếm lại tầng 3',
      });
      expect(rejected.body.data.decidedBy.id).toBe(acctHead.id);

      const resent = await post(`/audits/${a.id}/submit`, acctCollab).expect(
        201,
      );
      expect(resent.body.data.rejectReason).toBeNull();
    });

    it('Thành viên: thay toàn bộ; user ngừng hoạt động: 400; sau khi gửi duyệt: 400', async () => {
      const a = await newAudit();
      let res = await http()
        .put(`/audits/${a.id}/members`)
        .set(as(acctCollab))
        .send({ userIds: [techStaff.id, acctHead.id] })
        .expect(200);
      expect(
        res.body.data.members.map((m: { id: number }) => m.id).sort(),
      ).toEqual([techStaff.id, acctHead.id].sort());
      res = await http()
        .put(`/audits/${a.id}/members`)
        .set(as(acctCollab))
        .send({ userIds: [] })
        .expect(200);
      expect(res.body.data.members).toEqual([]);

      const locked = addUser('locked2', 3, 1, USER_STATUS.INACTIVE);
      await http()
        .put(`/audits/${a.id}/members`)
        .set(as(acctCollab))
        .send({ userIds: [locked.id] })
        .expect(400);

      await post(`/audits/${a.id}/start`, acctCollab).expect(201);
      await post(`/audits/${a.id}/mark-uncounted-ok`, acctCollab).expect(201);
      await post(`/audits/${a.id}/submit`, acctCollab).expect(201);
      await http()
        .put(`/audits/${a.id}/members`)
        .set(as(acctCollab))
        .send({ userIds: [techStaff.id] })
        .expect(400);
    });
  });

  /** Đợt phòng Kỹ thuật với các máy đã cho, đã nhập `results` (theo thứ tự máy), đã gửi duyệt. */
  async function submittedAudit(
    devices: Device[],
    results: string[],
    departmentId: number | null = 1,
  ) {
    const created = (await schedule({ departmentId }).expect(201)).body.data;
    await post(`/audits/${created.id}/start`, acctCollab).expect(201);
    for (const [i, item] of (created.items as { id: number }[]).entries()) {
      await http()
        .patch(`/audits/${created.id}/items/${item.id}`)
        .set(as(acctCollab))
        .send({ result: results[i] })
        .expect(200);
    }
    await post(`/audits/${created.id}/mark-uncounted-ok`, acctCollab).expect(
      201,
    );
    await post(`/audits/${created.id}/submit`, acctCollab).expect(201);
    expect(devices).toHaveLength(created.items.length);
    return created.id as number;
  }
  const deviceById = (id: number) => prisma.devices.find((d) => d.id === id)!;

  describe('POST /audits/:id/approve', () => {
    it('Thiếu → Thất lạc, Hỏng → Chờ thanh lý, giữ người sở hữu; Đủ không đổi', async () => {
      const ok = allocatedTo(techStaff);
      const missing = allocatedTo(techStaff);
      const broken = allocatedTo(techStaff);
      const id = await submittedAudit(
        [ok, missing, broken],
        ['Đủ', 'Thiếu', 'Hỏng'],
      );

      const res = await post(`/audits/${id}/approve`, acctHead).expect(201);
      expect(res.body.message).toBe('Đã duyệt kết quả kiểm kê');
      expect(res.body.data.status).toBe('Đã duyệt');
      expect(res.body.data.decidedBy.id).toBe(acctHead.id);
      expect(deviceById(ok.id).status).toBe('Đã cấp phát');
      expect(deviceById(missing.id)).toMatchObject({
        status: 'Thất lạc',
        currentUserId: techStaff.id,
      });
      expect(deviceById(broken.id)).toMatchObject({
        status: 'Chờ thanh lý',
        currentUserId: techStaff.id,
      });
    });

    it('đợt Kho (người sở hữu null): Thiếu vẫn sang Thất lạc', async () => {
      const stock = addDevice();
      const id = await submittedAudit([stock], ['Thiếu'], null);
      await post(`/audits/${id}/approve`, acctHead).expect(201);
      expect(deviceById(stock.id)).toMatchObject({
        status: 'Thất lạc',
        currentUserId: null,
      });
    });

    it('máy Thiếu/Hỏng đã đổi người giữ hoặc bị xoá: 400 liệt kê mã, không ghi gì, đợt vẫn Chờ duyệt', async () => {
      const a = allocatedTo(techStaff);
      const b = allocatedTo(techStaff);
      const id = await submittedAudit([a, b], ['Thiếu', 'Hỏng']);
      Object.assign(deviceById(a.id), { currentUserId: acctStaff.id });
      Object.assign(deviceById(b.id), { status: 'Đã xóa' });

      const res = await post(`/audits/${id}/approve`, acctHead).expect(400);
      expect(res.body.message).toBe(
        `Thiết bị ${a.deviceCode}, ${b.deviceCode} đã thay đổi kể từ lúc lập lịch — từ chối đợt và sửa kết quả các dòng này`,
      );
      expect(deviceById(a.id).status).toBe('Đã cấp phát');
      const after = await http()
        .get(`/audits/${id}`)
        .set(as(acctHead))
        .expect(200);
      expect(after.body.data.status).toBe('Chờ duyệt');
    });

    it('máy Đủ đã đổi không chặn duyệt', async () => {
      const a = allocatedTo(techStaff);
      const id = await submittedAudit([a], ['Đủ']);
      Object.assign(deviceById(a.id), { status: 'Đang chờ duyệt' });
      await post(`/audits/${id}/approve`, acctHead).expect(201);
      expect(deviceById(a.id).status).toBe('Đang chờ duyệt');
    });

    it('duyệt 2 lần: 400; chưa gửi duyệt: 400; CTV Kế toán / TP Kỹ thuật: 403', async () => {
      const a = allocatedTo(techStaff);
      const id = await submittedAudit([a], ['Đủ']);
      await post(`/audits/${id}/approve`, acctCollab).expect(403);
      await post(`/audits/${id}/approve`, techHead).expect(403);
      await post(`/audits/${id}/approve`, acctHead).expect(201);
      const again = await post(`/audits/${id}/approve`, acctHead).expect(400);
      expect(again.body.message).toBe(
        'Đợt kiểm kê đã được xử lý hoặc không ở trạng thái phù hợp',
      );

      allocatedTo(techStaff);
      const fresh = (await schedule().expect(201)).body.data;
      await post(`/audits/${fresh.id}/approve`, acctHead).expect(400);
    });

    it('đợt đã duyệt nhả máy: máy Đủ vào được đợt mới, máy Thất lạc thì không', async () => {
      const ok = allocatedTo(techStaff);
      const lost = allocatedTo(techStaff);
      const id = await submittedAudit([ok, lost], ['Đủ', 'Thiếu']);
      await post(`/audits/${id}/approve`, acctHead).expect(201);
      const next = await schedule().expect(201);
      expect(
        next.body.data.items.map((i: { deviceId: number }) => i.deviceId),
      ).toEqual([ok.id]);
    });
  });

  describe('POST /devices/:id/found', () => {
    it('TP Kỹ thuật: Thất lạc có người giữ → Đã cấp phát; không người giữ → Trong kho', async () => {
      const held = addDevice({
        status: 'Thất lạc',
        currentUserId: techStaff.id,
      });
      const stock = addDevice({ status: 'Thất lạc' });
      const res = await post(`/devices/${held.id}/found`, techHead).expect(201);
      expect(res.body.message).toBe('Đã ghi nhận tìm thấy thiết bị');
      expect(res.body.data.status).toBe('Đã cấp phát');
      await post(`/devices/${stock.id}/found`, techHead).expect(201);
      expect(deviceById(stock.id).status).toBe('Trong kho');
    });

    it('máy không Thất lạc: 400; CTV Kỹ thuật / Kế toán: 403; không tồn tại: 404', async () => {
      const d = allocatedTo(techStaff);
      const res = await post(`/devices/${d.id}/found`, techHead).expect(400);
      expect(res.body.message).toBe('Thiết bị không ở trạng thái Thất lạc');
      await post(`/devices/${d.id}/found`, techCollab).expect(403);
      await post(`/devices/${d.id}/found`, acctHead).expect(403);
      await post('/devices/999/found', techHead).expect(404);
    });
  });

  describe('/audit-summaries', () => {
    async function twoApprovedAudits() {
      const a1 = allocatedTo(techStaff);
      const a2 = allocatedTo(techStaff);
      const first = await submittedAudit([a1, a2], ['Đủ', 'Thiếu']);
      await post(`/audits/${first}/approve`, acctHead).expect(201);
      const stock = addDevice({ deviceTypeId: 2 });
      const second = await submittedAudit([stock], ['Hỏng'], null);
      await post(`/audits/${second}/approve`, acctHead).expect(201);
      return [first, second];
    }

    it('CTV Kế toán lập bảng từ các đợt Đã duyệt; chi tiết có ma trận', async () => {
      const ids = await twoApprovedAudits();
      const res = await post('/audit-summaries', acctCollab, {
        title: '  Kiểm kê quý 3  ',
        purpose: 'Định kỳ',
        auditIds: ids,
      }).expect(201);
      expect(res.body.message).toBe('Đã lập bảng tổng hợp');
      const s = res.body.data;
      expect(s).toMatchObject({
        title: 'Kiểm kê quý 3',
        purpose: 'Định kỳ',
        auditCount: 2,
      });
      expect(s.createdBy.id).toBe(acctCollab.id);
      expect(s.audits.map((a: { id: number }) => a.id)).toEqual(ids);
      expect(s.matrix).toEqual([
        {
          unitName: 'Kho',
          deviceTypeName: 'Máy tính để bàn',
          total: 1,
          ok: 0,
          missing: 0,
          broken: 1,
        },
        {
          unitName: 'Phòng Kỹ thuật',
          deviceTypeName: 'Laptop',
          total: 2,
          ok: 1,
          missing: 1,
          broken: 0,
        },
      ]);

      const list = await http()
        .get('/audit-summaries')
        .set(as(acctHead))
        .expect(200);
      expect(list.body.data).toEqual([
        expect.objectContaining({ id: s.id, auditCount: 2 }),
      ]);
      const one = await http()
        .get(`/audit-summaries/${s.id}`)
        .set(as(acctHead))
        .expect(200);
      expect(one.body.data.matrix).toHaveLength(2);
    });

    it('một đợt vào được nhiều bảng tổng hợp', async () => {
      const ids = await twoApprovedAudits();
      await post('/audit-summaries', acctCollab, {
        title: 'Quý 3',
        auditIds: ids,
      }).expect(201);
      await post('/audit-summaries', acctCollab, {
        title: 'Cả năm',
        auditIds: [ids[0]],
      }).expect(201);
    });

    it('đợt chưa Đã duyệt hoặc không tồn tại: 400 liệt kê id', async () => {
      allocatedTo(techStaff);
      const open = (await schedule().expect(201)).body.data.id;
      const res = await post('/audit-summaries', acctCollab, {
        title: 'X',
        auditIds: [open, 999],
      }).expect(400);
      expect(res.body.message).toBe(
        `Chỉ tổng hợp được đợt kiểm kê đã duyệt (không hợp lệ: #${open}, #999)`,
      );
    });

    it('thiếu tiêu đề / không chọn đợt: 400; TP Kế toán lập: 403; Admin xem: 403; 404', async () => {
      const t = await post('/audit-summaries', acctCollab, {
        title: ' ',
        auditIds: [1],
      }).expect(400);
      expect(t.body.message).toContain('Vui lòng nhập tiêu đề');
      const e = await post('/audit-summaries', acctCollab, {
        title: 'X',
        auditIds: [],
      }).expect(400);
      expect(e.body.message).toContain('Vui lòng chọn ít nhất 1 đợt kiểm kê');
      await post('/audit-summaries', acctHead, {
        title: 'X',
        auditIds: [1],
      }).expect(403);
      await http().get('/audit-summaries').set(as(admin)).expect(403);
      const nf = await http()
        .get('/audit-summaries/77')
        .set(as(acctHead))
        .expect(404);
      expect(nf.body.message).toBe('Bảng tổng hợp không tồn tại');
    });
  });

  describe('dọn thùng rác bỏ qua dữ liệu kiểm kê', () => {
    it('thiết bị đã nằm trong một đợt: /devices/purge không xoá cứng', async () => {
      const d = allocatedTo(techStaff);
      await schedule().expect(201);
      d.status = 'Đã xóa';
      const res = await post('/devices/purge', techHead, {
        ids: [d.id],
      }).expect(201);
      expect(res.body.data.count).toBe(0);
      expect(prisma.devices.some((x) => x.id === d.id)).toBe(true);
    });

    it('user lập đợt / thành viên: /users/purge bỏ qua', async () => {
      const member = addUser('member', 3, 1);
      allocatedTo(techStaff);
      const id = (await schedule({ memberIds: [member.id] }).expect(201)).body
        .data.id;
      expect(id).toBeGreaterThan(0);
      for (const u of [acctCollab, member]) u.status = USER_STATUS.DELETED;
      const res = await post('/users/purge', admin, {
        ids: [acctCollab.id, member.id],
      }).expect(201);
      expect(res.body.data.count).toBe(0);
      expect(prisma.users.some((u) => u.id === member.id)).toBe(true);
    });
  });
});
