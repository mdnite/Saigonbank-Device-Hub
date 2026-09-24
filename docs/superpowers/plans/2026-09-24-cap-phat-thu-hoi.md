# Cấp phát - Thu hồi thiết bị Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/allocation` `ComingSoonPage` with a real Cấp phát - Thu hồi (allocation/recovery) workflow: Trưởng phòng Kỹ thuật creates an order (assign or reclaim one or more devices for one person), Admin approves or rejects it, approval executes the Device change, and an approved order can be printed as a PDF biên bản.

**Architecture:** Two new Prisma tables (`DeviceOrder`, `DeviceOrderItem`) behind a new NestJS module `device-orders`, gated by two new small guards (create = Trưởng phòng Kỹ thuật only, decide = Admin only via the existing `@Roles` mechanism, read = both via a new `OrderAccessGuard`). Approval writes directly to `Device` in a transaction — it never goes through `PATCH /devices/:id`, sidestepping that route's known "can't clear an optional field" bug. Frontend gets a new DDD-lite module `allocation` mirroring `device`'s shape, one list page with inline Duyệt/Từ chối/In biên bản actions, one create page, and a `jspdf`-based PDF generator.

**Tech Stack:** NestJS 11 + Prisma 7 + Postgres (backend, existing); React 18 + Vite + react-router-dom 6 (frontend, existing); `jspdf` (new frontend dependency, this round's only new package).

**Spec:** `docs/superpowers/specs/2026-09-24-cap-phat-thu-hoi-design.md`

## Global Constraints

- UI copy is Vietnamese throughout (labels, buttons, error messages) — no English strings in user-facing text.
- Reuse `window.confirm`/`window.prompt` for approve/reject confirmation — do not build a new Modal component.
- `DeviceOrder.type`/`.status` are stored as the literal Vietnamese strings `"Cấp phát"`/`"Thu hồi"` and `"Chờ duyệt"`/`"Đã duyệt"`/`"Từ chối"` — same convention as `Device.status`/`User.Status`.
- Prisma fields are camelCase with `@map` to PascalCase DB columns; tables use `@@map`. Follow the existing `Device`/`User` models exactly.
- Every new endpoint returns through the existing `{ success, data, error, message }` envelope — this is automatic via `ResponseInterceptor`/`ApiExceptionFilter`, already wired in `app.setup.ts`. Do not hand-roll response shaping in controllers.
- The global `ValidationPipe({ whitelist: true, transform: true })` already enforces every `class-validator` decorator on new DTOs — do not add manual validation in services for anything a decorator already covers.
- FE imports use the `@/` alias to `frontend/src/`; new FE code follows the DDD-lite `domain/application/infrastructure/presentation` layout used by the `device` module.
- No pagination anywhere in this round (matches `/devices` and `/users`).
- `DeviceOrder` rows are never deleted by application code; FKs to `User` are `RESTRICT`, never `CASCADE`/`SET NULL`.
- `jspdf` is the only new dependency this round. No `jspdf-autotable`, no Modal library, no state-management library.

## Review Focus

- Duplicate device ids in one `POST /device-orders` request (`deviceIds: [5, 5]`) must be rejected with 400, not silently create two `DeviceOrderItem` rows and double-write the same `Device` on approval. Covered in Task 3.
- Approving or rejecting an already-decided order (two sequential calls, or two near-simultaneous requests) must 400 on the second call, not silently re-run the `Device` mutation or overwrite `decidedBy`/`decidedAt`. Covered in Task 3 via an atomic `updateMany` status guard.
- A device can change status between order creation and order approval (e.g. a second order gets approved first, or an admin edits the device directly) — approval must re-validate eligibility against the device's *current* state, not trust what was true when the order was created, and must reject with 400 rather than silently overwriting whoever holds the device now. Covered in Task 3.
- A user who created, decided, or is the target of a `DeviceOrder` must not be hard-deletable through `/users/purge` — that would either violate the FK (raw 500) or silently orphan order history. Covered in Task 4.
- A non-numeric or `> int32` `:id` on any `/device-orders/*` route (`GET /device-orders/:id`, `/approve`, `/reject`) must 404, not crash Prisma into an unhandled 500 — mirrors the existing `MAX_INT32` guard pattern on `/devices/:id` and `/users/:id`. Covered in Task 3.

---

## Backend

### Task 1: Prisma schema — `DeviceOrder` / `DeviceOrderItem`

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma models `DeviceOrder` (fields: `id, type, status, targetUserId, note, createdById, decidedById, decidedAt, rejectReason, createdAt`, relations `targetUser`/`createdBy`/`decidedBy`/`items`) and `DeviceOrderItem` (fields: `id, orderId, deviceId`, relations `order`/`device`). Both consumed by Task 3.

- [ ] **Step 1: Add the two new models and the back-relations they require**

Open `backend/prisma/schema.prisma`. Add these two models after `DeviceAccessory` (before the trailing "CHỦ ĐỘNG KHÔNG THÊM" comment block):

```prisma
// --- DeviceOrder ----------------------------------------------------------
// Đơn Cấp phát / Thu hồi. Không bao giờ bị xoá — là hồ sơ lịch sử.
model DeviceOrder {
  id           Int       @id @default(autoincrement()) @map("Id")
  type         String    @map("Type") @db.VarChar(20)
  status       String    @default("Chờ duyệt") @map("Status") @db.VarChar(20)
  targetUserId Int       @map("TargetUserId")
  note         String?   @map("Note") @db.VarChar(255)
  createdById  Int       @map("CreatedById")
  decidedById  Int?      @map("DecidedById")
  decidedAt    DateTime? @map("DecidedAt")
  rejectReason String?   @map("RejectReason") @db.VarChar(255)
  createdAt    DateTime  @default(now()) @map("CreatedAt")

  targetUser User  @relation("DeviceOrderTarget", fields: [targetUserId], references: [id])
  createdBy  User  @relation("DeviceOrderCreatedBy", fields: [createdById], references: [id])
  decidedBy  User? @relation("DeviceOrderDecidedBy", fields: [decidedById], references: [id])
  items      DeviceOrderItem[]

  @@map("DeviceOrder")
}

// --- DeviceOrderItem --------------------------------------------------------
// Từng thiết bị trong 1 đơn. Cascade khi xoá DeviceOrder (không xoá Device) — DeviceOrder
// thực tế không bao giờ bị xoá, cascade này chỉ là an toàn dữ liệu.
model DeviceOrderItem {
  id       Int @id @default(autoincrement()) @map("Id")
  orderId  Int @map("OrderId")
  deviceId Int @map("DeviceId")

  order  DeviceOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  device Device      @relation(fields: [deviceId], references: [id])

  @@map("DeviceOrderItem")
}
```

Then update the existing `User` model: add these three lines inside it, next to the existing `devices Device[]` relation line:

```prisma
  deviceOrdersTarget    DeviceOrder[] @relation("DeviceOrderTarget")
  deviceOrdersCreatedBy DeviceOrder[] @relation("DeviceOrderCreatedBy")
  deviceOrdersDecidedBy DeviceOrder[] @relation("DeviceOrderDecidedBy")
```

And update the existing `Device` model: add this line next to `accessories DeviceAccessory[]`:

```prisma
  orderItems DeviceOrderItem[]
```

- [ ] **Step 2: Run the migration against the local database**

Run (from `backend/`):
```
npx prisma migrate dev --name add_device_order
```
Expected: a new migration folder under `backend/prisma/migrations/` containing only `CREATE TABLE "DeviceOrder"` and `CREATE TABLE "DeviceOrderItem"` plus their FKs and indexes — no `ALTER TABLE` on `User`, `Device`, `Department`, `Role`, or `PasswordResetToken`. Prisma Client regenerates automatically as part of this command.

- [ ] **Step 3: Verify the schema compiles cleanly**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): thêm bảng DeviceOrder, DeviceOrderItem cho luồng cấp phát - thu hồi"
```

---

### Task 2: Shared plumbing — order constants, exported device shape, `currentUserId` device filter

**Files:**
- Create: `backend/src/modules/device-orders/device-order-status.ts`
- Modify: `backend/src/modules/devices/devices.service.ts`
- Modify: `backend/src/modules/devices/devices.dto.ts`
- Modify: `backend/src/modules/devices/devices.spec.ts`

**Interfaces:**
- Produces: `ORDER_TYPE = { ALLOCATE: 'Cấp phát', RECOVER: 'Thu hồi' }`, `ORDER_STATUS = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối' }` — consumed by Task 3.
- Produces: `export const DEVICE_WITH_RELATIONS` and `export function toDeviceItem(d): DeviceListItem` from `devices.service.ts` — consumed by Task 3 to embed `DeviceListItem` shape inside `DeviceOrderDetail.items[].device`.
- Produces: `GET /devices?...&currentUserId=<id>` filter — consumed by the frontend's Task 10 (Thu hồi device picker).

- [ ] **Step 1: Write the failing test for the new device filter**

In `backend/src/modules/devices/devices.spec.ts`, add this test right after the existing `'đặt trạng thái "Đã cấp phát" khi có người sở hữu'` test:

```ts
  it('lọc theo currentUserId', async () => {
    const owned = await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice({ currentUserId: staff.id }))
      .expect(201);
    await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice({ deviceCode: 'LT-000002' }))
      .expect(201);

    const res = await http()
      .get(`/devices?currentUserId=${staff.id}`)
      .set('Authorization', tokenOf(admin))
      .expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(owned.body.data.id);
  });
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend && npx jest devices.spec.ts -t "lọc theo currentUserId"`
Expected: FAIL — `currentUserId` is stripped by the whitelist pipe (unknown property), so the response includes both devices.

- [ ] **Step 3: Add the constants file**

Create `backend/src/modules/device-orders/device-order-status.ts`:

```ts
/** Loại đơn — lưu nguyên văn tiếng Việt trong DB, giống Device.Status. */
export const ORDER_TYPE = {
  ALLOCATE: 'Cấp phát',
  RECOVER: 'Thu hồi',
} as const;

/** Trạng thái đơn. "Chờ duyệt" là mặc định khi tạo — chỉ Admin đổi sang 2 trạng thái còn lại. */
export const ORDER_STATUS = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
} as const;
```

- [ ] **Step 4: Export the device shape helper from `devices.service.ts`**

In `backend/src/modules/devices/devices.service.ts`, rename and export the two module-private symbols. Change:

```ts
const WITH_RELATIONS = {
  deviceType: true,
  department: true,
  currentUser: true,
  accessories: true,
} as const;

type DeviceWithRelations = Prisma.DeviceGetPayload<{
  include: typeof WITH_RELATIONS;
}>;

function toItem(d: DeviceWithRelations) {
```

to:

```ts
export const DEVICE_WITH_RELATIONS = {
  deviceType: true,
  department: true,
  currentUser: true,
  accessories: true,
} as const;

type DeviceWithRelations = Prisma.DeviceGetPayload<{
  include: typeof DEVICE_WITH_RELATIONS;
}>;

export function toDeviceItem(d: DeviceWithRelations) {
```

Then replace every remaining use of `WITH_RELATIONS` with `DEVICE_WITH_RELATIONS` and every remaining use of `toItem(` with `toDeviceItem(` in the same file (both appear 4 more times each — in `list`, `getById`, `create`, `update`).

- [ ] **Step 5: Add the `currentUserId` filter**

In `backend/src/modules/devices/devices.dto.ts`, add this property to `ListDevicesQuery`, right after `departmentId`:

```ts
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Người dùng không hợp lệ' })
  @Min(1, { message: 'Người dùng không hợp lệ' })
  @Max(MAX_INT32, { message: 'Người dùng không hợp lệ' })
  currentUserId?: number;
```

In `backend/src/modules/devices/devices.service.ts`, update the `list` method signature and `where` clause:

```ts
  async list(q: {
    search?: string;
    status?: string;
    deviceTypeId?: number;
    departmentId?: number;
    currentUserId?: number;
  }) {
    const s = q.search?.trim();
    const devices = await this.prisma.device.findMany({
      where: {
        status: q.status ?? { not: DEVICE_STATUS.DELETED },
        deviceTypeId: q.deviceTypeId,
        departmentId: q.departmentId,
        currentUserId: q.currentUserId,
```

(leave the rest of the `where` clause and the rest of the method unchanged).

- [ ] **Step 6: Run the test again, confirm it passes, and run the whole devices suite**

Run: `cd backend && npx jest devices.spec.ts`
Expected: PASS, all cases (the renamed `WITH_RELATIONS`/`toItem` must not have broken any existing case).

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/device-orders/device-order-status.ts backend/src/modules/devices/devices.service.ts backend/src/modules/devices/devices.dto.ts backend/src/modules/devices/devices.spec.ts
git commit -m "feat(devices): lọc theo currentUserId, xuất toDeviceItem cho module device-orders"
```

---

### Task 3: `device-orders` module — guards, DTOs, service, controller, fake Prisma, full spec

This is the core deliverable: the whole `/device-orders` HTTP surface, tested as one integration spec (same style as `devices.spec.ts`) because the guards, DTOs, service and controller only produce observable behavior together.

**Files:**
- Create: `backend/src/shared/auth/order-access.guard.ts`
- Create: `backend/src/shared/auth/order-create.guard.ts`
- Create: `backend/src/modules/device-orders/device-orders.dto.ts`
- Create: `backend/src/modules/device-orders/device-orders.service.ts`
- Create: `backend/src/modules/device-orders/device-orders.controller.ts`
- Create: `backend/src/modules/device-orders/device-orders.module.ts`
- Create: `backend/src/modules/device-orders/device-orders.spec.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/test/fake-prisma.ts`

**Interfaces:**
- Consumes: `ORDER_TYPE`, `ORDER_STATUS` (Task 2), `DEVICE_WITH_RELATIONS`, `toDeviceItem` (Task 2), `AuthedRequest`/`AuthGuard` (`shared/auth/auth.guard.ts`), `Roles`/`ROLES_KEY` (`shared/auth/roles.decorator.ts`), `ROLE` (`modules/identity/roles.ts`), `TECH_DEPARTMENT_CODE` (`shared/auth/device-write.guard.ts`), `MAX_INT32` (`modules/users/users.dto.ts`), `USER_STATUS` (`modules/identity/user-status.ts`), `ResponseMessage` (`shared/http/api-response.ts`).
- Produces: `POST /device-orders`, `GET /device-orders`, `GET /device-orders/:id`, `PATCH /device-orders/:id/approve`, `PATCH /device-orders/:id/reject` — consumed by Task 5 (E2E script) and the whole frontend allocation module (Tasks 8–10).

- [ ] **Step 1: Write the full failing spec**

Create `backend/src/modules/device-orders/device-orders.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend && npx jest device-orders.spec.ts`
Expected: FAIL to even boot — `Cannot find module './device-orders.controller'` (or similar), since nothing exists yet.

- [ ] **Step 3: Implement the guards**

Create `backend/src/shared/auth/order-access.guard.ts`:

```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ROLE } from '../../modules/identity/roles';
import type { AuthedRequest } from './auth.guard';
import { TECH_DEPARTMENT_CODE } from './device-write.guard';

const NO_PERMISSION = 'Bạn không có quyền thực hiện thao tác này';

/**
 * Quyền XEM đơn cấp phát/thu hồi: Quản trị viên, hoặc Trưởng phòng thuộc phòng Kỹ thuật.
 * Cùng điều kiện với DeviceWriteGuard nhưng khác domain (xem đơn, không phải ghi thiết bị) —
 * tách guard riêng để tên guard không gán nhầm ý nghĩa cho route /device-orders.
 * Phải chạy SAU AuthGuard — nó đọc req.user do AuthGuard gắn vào.
 */
@Injectable()
export class OrderAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<AuthedRequest>();
    const allowed =
      user.roleName === ROLE.ADMIN ||
      (user.roleName === ROLE.HEAD && user.departmentCode === TECH_DEPARTMENT_CODE);
    if (!allowed) throw new ForbiddenException(NO_PERMISSION);
    return true;
  }
}
```

Create `backend/src/shared/auth/order-create.guard.ts`:

```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ROLE } from '../../modules/identity/roles';
import type { AuthedRequest } from './auth.guard';
import { TECH_DEPARTMENT_CODE } from './device-write.guard';

const NO_PERMISSION = 'Bạn không có quyền thực hiện thao tác này';

/**
 * Quyền TẠO đơn: chỉ Trưởng phòng thuộc phòng Kỹ thuật — KHÔNG gồm Quản trị viên
 * (khác DeviceWriteGuard). Quản trị viên chỉ duyệt/từ chối, xem device-orders.controller.ts.
 */
@Injectable()
export class OrderCreateGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<AuthedRequest>();
    const allowed = user.roleName === ROLE.HEAD && user.departmentCode === TECH_DEPARTMENT_CODE;
    if (!allowed) throw new ForbiddenException(NO_PERMISSION);
    return true;
  }
}
```

- [ ] **Step 4: Implement the DTOs**

Create `backend/src/modules/device-orders/device-orders.dto.ts`:

```ts
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_INT32 } from '../users/users.dto';
import { ORDER_STATUS, ORDER_TYPE } from './device-order-status';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ListDeviceOrdersQuery {
  @IsOptional()
  @IsIn(Object.values(ORDER_TYPE), { message: 'Loại đơn không hợp lệ' })
  type?: string;

  @IsOptional()
  @IsIn(Object.values(ORDER_STATUS), { message: 'Trạng thái không hợp lệ' })
  status?: string;
}

export class CreateDeviceOrderDto {
  @IsIn(Object.values(ORDER_TYPE), { message: 'Loại đơn không hợp lệ' })
  type!: string;

  @Type(() => Number)
  @IsInt({ message: 'Người dùng không hợp lệ' })
  @Min(1, { message: 'Người dùng không hợp lệ' })
  @Max(MAX_INT32, { message: 'Người dùng không hợp lệ' })
  targetUserId!: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  note?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Vui lòng chọn ít nhất 1 thiết bị' })
  @ArrayUnique({ message: 'Danh sách thiết bị bị trùng' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Thiết bị không hợp lệ' })
  @Min(1, { each: true, message: 'Thiết bị không hợp lệ' })
  @Max(MAX_INT32, { each: true, message: 'Thiết bị không hợp lệ' })
  deviceIds!: number[];
}

export class RejectDeviceOrderDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập lý do từ chối' })
  @MaxLength(255)
  reason!: string;
}
```

- [ ] **Step 5: Implement the service**

Create `backend/src/modules/device-orders/device-orders.service.ts`:

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { DEVICE_STATUS } from '../devices/device-status';
import { DEVICE_WITH_RELATIONS, toDeviceItem } from '../devices/devices.service';
import { USER_STATUS } from '../identity/user-status';
import { MAX_INT32 } from '../users/users.dto';
import { ORDER_STATUS, ORDER_TYPE } from './device-order-status';
import type { CreateDeviceOrderDto, ListDeviceOrdersQuery } from './device-orders.dto';

export const ORDER_NOT_FOUND = 'Đơn không tồn tại';
const ORDER_ALREADY_DECIDED = 'Đơn đã được xử lý';

// Cùng cách devices.service.ts làm với DEVICE_WITH_RELATIONS: include lồng nhau tới tận Device
// dùng lại đúng hằng số đó, nên Prisma.DeviceOrderGetPayload ở dưới suy ra field `device` khớp
// 1:1 với DeviceWithRelations nội bộ của devices.service.ts — toDeviceItem() nhận thẳng được.
const WITH_RELATIONS = {
  targetUser: true,
  createdBy: true,
  decidedBy: true,
  items: { include: { device: { include: DEVICE_WITH_RELATIONS } } },
} as const;

type OrderWithRelations = Prisma.DeviceOrderGetPayload<{ include: typeof WITH_RELATIONS }>;

function toListItem(o: OrderWithRelations) {
  return {
    id: o.id,
    type: o.type,
    status: o.status,
    note: o.note,
    rejectReason: o.rejectReason,
    decidedAt: o.decidedAt,
    createdAt: o.createdAt,
    targetUser: { id: o.targetUser.id, fullName: o.targetUser.fullName, username: o.targetUser.username },
    createdBy: { id: o.createdBy.id, fullName: o.createdBy.fullName },
    decidedBy: o.decidedBy && { id: o.decidedBy.id, fullName: o.decidedBy.fullName },
    deviceCount: o.items.length,
  };
}

function toDetail(o: OrderWithRelations) {
  return {
    ...toListItem(o),
    items: o.items.map((i) => ({ id: i.id, device: toDeviceItem(i.device) })),
  };
}

@Injectable()
export class DeviceOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ListDeviceOrdersQuery) {
    const orders = await this.prisma.deviceOrder.findMany({
      where: { type: q.type, status: q.status },
      include: WITH_RELATIONS,
      orderBy: { id: 'desc' },
    });
    return orders.map(toListItem);
  }

  async getById(id: number) {
    const order = await this.findOrder(id);
    return toDetail(order);
  }

  async create(dto: CreateDeviceOrderDto, createdById: number) {
    const targetUser = await this.requireUser(dto.targetUserId);
    await this.requireEligibleDevices(dto.type, dto.deviceIds, targetUser.id);

    const order = await this.prisma.deviceOrder.create({
      data: {
        type: dto.type,
        note: dto.note ?? null,
        targetUserId: dto.targetUserId,
        createdById,
        items: { create: dto.deviceIds.map((deviceId) => ({ deviceId })) },
      },
      include: WITH_RELATIONS,
    });
    return toDetail(order);
  }

  async approve(id: number, decidedById: number) {
    const order = await this.findPendingOrder(id);
    const deviceIds = order.items.map((i) => i.deviceId);
    await this.requireEligibleDevices(order.type, deviceIds, order.targetUserId);

    await this.prisma.$transaction(async (tx) => {
      const data =
        order.type === ORDER_TYPE.ALLOCATE
          ? {
              status: DEVICE_STATUS.ALLOCATED,
              currentUserId: order.targetUserId,
              departmentId: order.targetUser.departmentId,
              allocatedOn: new Date(),
            }
          : { status: DEVICE_STATUS.IN_STOCK, currentUserId: null, departmentId: null, allocatedOn: null };
      for (const deviceId of deviceIds) {
        await tx.device.update({ where: { id: deviceId }, data });
      }
      await this.decide(tx, id, decidedById, ORDER_STATUS.APPROVED);
    });

    return this.getById(id);
  }

  async reject(id: number, decidedById: number, reason: string) {
    await this.findPendingOrder(id);
    await this.decide(this.prisma, id, decidedById, ORDER_STATUS.REJECTED, reason);
    return this.getById(id);
  }

  // --- helpers ---------------------------------------------------------

  /** Ghi có điều kiện status="Chờ duyệt" ngay trong câu update — chặn 2 request duyệt/từ chối
   *  gần như đồng thời cùng lọt qua findPendingOrder() (đọc-rồi-ghi là 2 câu lệnh riêng, không
   *  atomic). count=0 nghĩa là đơn đã bị người khác xử lý giữa lúc đọc và lúc ghi. */
  private async decide(
    tx: Pick<PrismaService, 'deviceOrder'>,
    id: number,
    decidedById: number,
    status: string,
    rejectReason?: string,
  ) {
    const { count } = await tx.deviceOrder.updateMany({
      where: { id, status: ORDER_STATUS.PENDING },
      data: { status, decidedById, decidedAt: new Date(), rejectReason: rejectReason ?? null },
    });
    if (count === 0) throw new BadRequestException(ORDER_ALREADY_DECIDED);
  }

  private async requireEligibleDevices(type: string, deviceIds: number[], targetUserId: number) {
    const devices = await this.prisma.device.findMany({ where: { id: { in: deviceIds } } });
    const byId = new Map(devices.map((d) => [d.id, d]));
    for (const id of deviceIds) {
      const device = byId.get(id);
      if (!device) throw new BadRequestException('Thiết bị không tồn tại');
      if (type === ORDER_TYPE.ALLOCATE && device.status !== DEVICE_STATUS.IN_STOCK) {
        throw new BadRequestException(`Thiết bị "${device.deviceCode}" không còn trong kho`);
      }
      if (
        type === ORDER_TYPE.RECOVER &&
        !(device.status === DEVICE_STATUS.ALLOCATED && device.currentUserId === targetUserId)
      ) {
        throw new BadRequestException(`Thiết bị "${device.deviceCode}" không do người này đang giữ`);
      }
    }
  }

  private async requireUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.status === USER_STATUS.DELETED) {
      throw new BadRequestException('Người dùng không tồn tại');
    }
    return user;
  }

  private async findOrder(id: number) {
    if (Math.abs(id) > MAX_INT32) throw new NotFoundException(ORDER_NOT_FOUND);
    const order = await this.prisma.deviceOrder.findUnique({ where: { id }, include: WITH_RELATIONS });
    if (!order) throw new NotFoundException(ORDER_NOT_FOUND);
    return order;
  }

  private async findPendingOrder(id: number) {
    const order = await this.findOrder(id);
    if (order.status !== ORDER_STATUS.PENDING) throw new BadRequestException(ORDER_ALREADY_DECIDED);
    return order;
  }
}
```

- [ ] **Step 6: Implement the controller**

Create `backend/src/modules/device-orders/device-orders.controller.ts`:

```ts
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthedRequest } from '../../shared/auth/auth.guard';
import { OrderAccessGuard } from '../../shared/auth/order-access.guard';
import { OrderCreateGuard } from '../../shared/auth/order-create.guard';
import { Roles } from '../../shared/auth/roles.decorator';
import { ResponseMessage } from '../../shared/http/api-response';
import { ROLE } from '../identity/roles';
import { CreateDeviceOrderDto, ListDeviceOrdersQuery, RejectDeviceOrderDto } from './device-orders.dto';
import { DeviceOrdersService, ORDER_NOT_FOUND } from './device-orders.service';

const OrderId = () =>
  Param(
    'id',
    new ParseIntPipe({
      exceptionFactory: () => new NotFoundException(ORDER_NOT_FOUND),
    }),
  );

@Controller('device-orders')
@UseGuards(AuthGuard, OrderAccessGuard)
export class DeviceOrdersController {
  constructor(private readonly orders: DeviceOrdersService) {}

  @Get()
  list(@Query() query: ListDeviceOrdersQuery) {
    return this.orders.list(query);
  }

  @Get(':id')
  get(@OrderId() id: number) {
    return this.orders.getById(id);
  }

  @Post()
  @UseGuards(OrderCreateGuard)
  @ResponseMessage('Đã tạo đơn')
  create(@Body() dto: CreateDeviceOrderDto, @Req() req: AuthedRequest) {
    return this.orders.create(dto, req.user.id);
  }

  @Patch(':id/approve')
  @Roles(ROLE.ADMIN)
  @ResponseMessage('Đã duyệt đơn')
  approve(@OrderId() id: number, @Req() req: AuthedRequest) {
    return this.orders.approve(id, req.user.id);
  }

  @Patch(':id/reject')
  @Roles(ROLE.ADMIN)
  @ResponseMessage('Đã từ chối đơn')
  reject(@OrderId() id: number, @Body() dto: RejectDeviceOrderDto, @Req() req: AuthedRequest) {
    return this.orders.reject(id, req.user.id, dto.reason);
  }
}
```

- [ ] **Step 7: Implement the module and register it**

Create `backend/src/modules/device-orders/device-orders.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { DeviceOrdersController } from './device-orders.controller';
import { DeviceOrdersService } from './device-orders.service';

@Module({
  controllers: [DeviceOrdersController],
  providers: [DeviceOrdersService],
})
export class DeviceOrdersModule {}
```

In `backend/src/app.module.ts`, add the import and register it:

```ts
import { DeviceOrdersModule } from './modules/device-orders/device-orders.module';
```

and add `DeviceOrdersModule,` to the `imports` array, after `DevicesModule,`.

- [ ] **Step 8: Extend `fake-prisma.ts` with `deviceOrder`**

In `backend/src/test/fake-prisma.ts`:

Add `DeviceOrder` and `DeviceOrderItem` to the type import at the top:

```ts
import type {
  Department,
  Device,
  DeviceAccessory,
  DeviceOrder,
  DeviceOrderItem,
  DeviceType,
  PasswordResetToken,
  Role,
  User,
} from '@prisma/client';
```

Add these type declarations near the other `Device*` types:

```ts
type OrderInclude = {
  targetUser?: boolean;
  createdBy?: boolean;
  decidedBy?: boolean;
  items?: { include?: { device?: DeviceInclude } };
};
type OrderWithRelations = DeviceOrder & {
  targetUser?: User;
  createdBy?: User;
  decidedBy?: User | null;
  items?: (DeviceOrderItem & { device?: DeviceWithRelations })[];
};
type OrderItemCreateInput = { deviceId: number };
type OrderCreateData = Pick<DeviceOrder, 'type' | 'targetUserId' | 'createdById'> &
  Partial<DeviceOrder> & { items?: { create: OrderItemCreateInput[] } };
```

Inside `createFakePrisma()`, add storage arrays next to `const deviceAccessories: DeviceAccessory[] = [];`:

```ts
  const deviceOrders: DeviceOrder[] = [];
  const deviceOrderItems: DeviceOrderItem[] = [];
```

Add the relation-resolving helper next to `withDeviceRelations`:

```ts
  const withOrderRelations = (o: DeviceOrder, include?: OrderInclude): OrderWithRelations =>
    include
      ? {
          ...o,
          ...(include.targetUser && { targetUser: users.find((u) => u.id === o.targetUserId)! }),
          ...(include.createdBy && { createdBy: users.find((u) => u.id === o.createdById)! }),
          ...(include.decidedBy && {
            decidedBy: users.find((u) => u.id === o.decidedById) ?? null,
          }),
          ...(include.items && {
            items: deviceOrderItems
              .filter((i) => i.orderId === o.id)
              .map((i) => ({
                ...i,
                ...(include.items!.include?.device && {
                  device: withDeviceRelations(
                    devices.find((d) => d.id === i.deviceId)!,
                    include.items!.include!.device,
                  ),
                }),
              })),
          }),
        }
      : o;
```

Add `deviceOrders` and `deviceOrderItems` to the object returned by `createFakePrisma()`, next to the existing `devices, deviceTypes, deviceAccessories,` line:

```ts
    devices,
    deviceTypes,
    deviceAccessories,
    deviceOrders,
    deviceOrderItems,
```

Add the `deviceOrder` model stub, next to the `device: {...}` block:

```ts
    deviceOrder: {
      findMany: jest.fn(
        async ({
          where,
          include,
          select,
        }: {
          where?: Where;
          include?: OrderInclude;
          select?: Select;
        }) =>
          deviceOrders
            .filter((o) => matches(o, where))
            .sort((a, b) => b.id - a.id)
            .map((o) => project(withOrderRelations(o, include), select)),
      ),
      findUnique: jest.fn(
        async ({ where, include }: { where: Where; include?: OrderInclude }) => {
          const hit = deviceOrders.find((o) => matches(o, where));
          return hit ? withOrderRelations(hit, include) : null;
        },
      ),
      create: jest.fn(
        async ({ data, include }: { data: OrderCreateData; include?: OrderInclude }) => {
          const { items, ...rest } = data;
          const row: DeviceOrder = {
            id: deviceOrders.length + 1,
            status: 'Chờ duyệt',
            note: null,
            decidedById: null,
            decidedAt: null,
            rejectReason: null,
            createdAt: new Date(),
            ...rest,
          };
          deviceOrders.push(row);
          for (const item of items?.create ?? []) {
            deviceOrderItems.push({ id: deviceOrderItems.length + 1, orderId: row.id, ...item });
          }
          return withOrderRelations(row, include);
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
          include,
        }: {
          where: Where;
          data: Partial<DeviceOrder>;
          include?: OrderInclude;
        }) => {
          const row = deviceOrders.find((o) => matches(o, where))!;
          Object.assign(row, data);
          return withOrderRelations(row, include);
        },
      ),
      updateMany: jest.fn(
        async ({ where, data }: { where: Where; data: Partial<DeviceOrder> }) => {
          const hit = deviceOrders.filter((o) => matches(o, where));
          hit.forEach((o) => Object.assign(o, data));
          return { count: hit.length };
        },
      ),
      delete: jest.fn(forbidden),
    },
```

- [ ] **Step 9: Run the full spec, fix until green, then run the whole backend suite**

Run: `cd backend && npx jest device-orders.spec.ts`
Expected: PASS, all cases.

Then run: `cd backend && npm test`
Expected: PASS, every existing spec file (`auth.spec.ts`, `devices.spec.ts`, `users.spec.ts`, `device-orders.spec.ts`) green — no regressions from the `devices.service.ts` rename in Task 2 or the new module.

- [ ] **Step 10: Commit**

```bash
git add backend/src/shared/auth/order-access.guard.ts backend/src/shared/auth/order-create.guard.ts backend/src/modules/device-orders backend/src/app.module.ts backend/src/test/fake-prisma.ts
git commit -m "feat(device-orders): API tạo/duyệt/từ chối đơn cấp phát - thu hồi"
```

---

### Task 4: `/users/purge` must not orphan `DeviceOrder` history

**Files:**
- Modify: `backend/src/modules/users/users.service.ts`
- Modify: `backend/src/modules/users/users.spec.ts`

**Interfaces:**
- Consumes: `prisma.deviceOrder.findMany` (Task 3).
- Produces: `UsersService.purge(ids)` now silently skips any id still referenced by a `DeviceOrder` — no change to its public signature, so nothing downstream needs updating.

- [ ] **Step 1: Write the failing test**

In `backend/src/modules/users/users.spec.ts`, inside `describe('POST /users/purge', ...)`, add this test after the existing `'Admin: xoá vĩnh viễn user đã xoá mềm...'` test:

```ts
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
```

(Note the existing `addUser` helper in `users.spec.ts` takes `(username, roleId, status)` — 3 args, not 4 like the one written for `device-orders.spec.ts` in Task 3. Do not change its signature; `addUser('removed2', 3, USER_STATUS.DELETED)` matches it as-is.)

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend && npx jest users.spec.ts -t "bỏ qua id còn bị tham chiếu"`
Expected: FAIL — `count` is `2` (both purged), because `purge()` doesn't know about `DeviceOrder` yet, and the referenced user row is gone from `prisma.users`.

- [ ] **Step 3: Update `purge()`**

In `backend/src/modules/users/users.service.ts`, replace the `purge` method:

```ts
  /** Dọn thùng rác: xoá cứng — chỉ những id đã ở Status "Đã xóa", id khác bị bỏ qua.
   *  PasswordResetToken.userId là RESTRICT (khác DeviceAccessory là CASCADE của thiết bị)
   *  nên phải xoá token của các user này trước, không thì DB chặn. Device.currentUserId là
   *  SET NULL, không cần dọn tay. DeviceOrder.targetUserId/createdById/decidedById cũng
   *  RESTRICT nhưng KHÔNG được dọn theo (đơn là hồ sơ lịch sử) — id còn bị đơn nào tham chiếu
   *  thì bị loại khỏi danh sách xoá, lặng lẽ như cách id không đủ status="Đã xóa" bị bỏ qua. */
  async purge(ids: number[]): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const referenced = await tx.deviceOrder.findMany({
        where: {
          OR: [
            { targetUserId: { in: ids } },
            { createdById: { in: ids } },
            { decidedById: { in: ids } },
          ],
        },
        select: { targetUserId: true, createdById: true, decidedById: true },
      });
      const blocked = new Set<number>();
      for (const o of referenced) {
        blocked.add(o.targetUserId);
        blocked.add(o.createdById);
        if (o.decidedById !== null) blocked.add(o.decidedById);
      }
      const purgeable = ids.filter((id) => !blocked.has(id));

      await tx.passwordResetToken.deleteMany({ where: { userId: { in: purgeable } } });
      const { count } = await tx.user.deleteMany({
        where: { id: { in: purgeable }, status: USER_STATUS.DELETED },
      });
      return count;
    });
  }
```

- [ ] **Step 4: Run it, confirm it passes, then run the whole backend suite**

Run: `cd backend && npx jest users.spec.ts`
Expected: PASS, all cases.

Run: `cd backend && npm test`
Expected: PASS, everything green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/users/users.service.ts backend/src/modules/users/users.spec.ts
git commit -m "fix(users): purge bỏ qua user còn bị DeviceOrder tham chiếu"
```

---

### Task 5: E2E script against the real database

**Files:**
- Create: `backend/scripts/e2e-device-orders.ps1`

**Interfaces:**
- Consumes: `/device-orders*` (Task 3), same `Api`/`ExpectStatus`/`Psql` helper pattern as `backend/scripts/e2e-devices.ps1`.

- [ ] **Step 1: Write the script**

Create `backend/scripts/e2e-device-orders.ps1` — copy the header/params/`Api`/`ExpectStatus`/`Psql`/`Suffix6` boilerplate verbatim from `backend/scripts/e2e-devices.ps1` (same `param()` block, same `Ok`/`Fail`/`Step`/`Api`/`ExpectStatus`/`Psql` functions, same `$stamp`/`Suffix6` setup, same Step 0 backend-alive check), then replace everything from `Step "1. Đăng nhập admin"` onward with:

```powershell
Step "1. Dang nhap admin, tao Truong phong Ky thuat va nguoi nhan"
$login = Api -Method Post -Path '/auth/login' -Body @{ identifier = $AdminUsername; password = $AdminPassword }
$adminToken = $login.data.accessToken
if ($adminToken) { Ok "admin dang nhap duoc" } else { Fail "khong lay duoc accessToken"; exit 1 }

$techUname = "e2etech$stamp"
$techPass = 'E2e@1234'
Api -Method Post -Path '/users' -Token $adminToken -Body @{
  username = $techUname; email = "$techUname@e2e.local"; fullName = 'Truong phong Ky thuat E2E'
  password = $techPass; roleId = 2; departmentId = 1
} | Out-Null
$techToken = (Api -Method Post -Path '/auth/login' -Body @{ identifier = $techUname; password = $techPass }).data.accessToken
if ($techToken) { Ok "$techUname dang nhap duoc" } else { Fail "$techUname khong dang nhap duoc"; exit 1 }

$staffUname = "e2estaff$stamp"
$staffPass = 'E2e@1234'
$staff = (Api -Method Post -Path '/users' -Token $adminToken -Body @{
  username = $staffUname; email = "$staffUname@e2e.local"; fullName = 'Nhan vien nhan thiet bi E2E'
  password = $staffPass; roleId = 3; departmentId = 1
}).data
if ($staff.id) { Ok "$staffUname tao duoc (id=$($staff.id))" } else { Fail "khong tao duoc $staffUname"; exit 1 }

Step "2. Tao thiet bi Trong kho"
$types = (Api -Method Get -Path '/device-types' -Token $adminToken).data
$laptop = $types | Where-Object { $_.prefix -eq 'LT' } | Select-Object -First 1
$device = (Api -Method Post -Path '/devices' -Token $adminToken -Body @{
  deviceCode = "LT-$(Suffix6 0)"; deviceName = "Laptop E2E don $stamp"
  specDetail = 'Core i5, 16GB'; unit = 'Cai'; deviceTypeId = $laptop.id
}).data
$deviceId = $device.id
if ($deviceId -and $device.status -eq 'Trong kho') { Ok "tao thiet bi id=$deviceId, status='Trong kho'" }
else { Fail "tao thiet bi that bai hoac sai status"; exit 1 }

Step "3. Tao va duyet don Cap phat"
$order = (Api -Method Post -Path '/device-orders' -Token $techToken -Body @{
  type = 'Cấp phát'; targetUserId = $staff.id; deviceIds = @($deviceId)
}).data
if ($order.id -and $order.status -eq 'Chờ duyệt') { Ok "tao don Cap phat id=$($order.id)" }
else { Fail "tao don Cap phat that bai"; exit 1 }

Api -Method Patch -Path "/device-orders/$($order.id)/approve" -Token $adminToken | Out-Null
$afterAllocate = (Api -Method Get -Path "/devices/$deviceId" -Token $adminToken).data
if ($afterAllocate.status -eq 'Đã cấp phát' -and $afterAllocate.currentUser.id -eq $staff.id) {
  Ok "duyet xong: Device status='Đã cấp phát', currentUser=$($afterAllocate.currentUser.id)"
} else {
  Fail "duyet don Cap phat khong ghi dung Device: status='$($afterAllocate.status)'"
}
$dbStatus = Psql "SELECT ""Status"" FROM ""Device"" WHERE ""Id"" = $deviceId;"
if ($dbStatus -eq 'Đã cấp phát') { Ok "DB xac nhan Status='Đã cấp phát'" } else { Fail "DB Status='$dbStatus', mong 'Đã cấp phát'" }

Step "4. Tao va duyet don Thu hoi"
$recoverOrder = (Api -Method Post -Path '/device-orders' -Token $techToken -Body @{
  type = 'Thu hồi'; targetUserId = $staff.id; deviceIds = @($deviceId)
}).data
if ($recoverOrder.id) { Ok "tao don Thu hoi id=$($recoverOrder.id)" } else { Fail "tao don Thu hoi that bai"; exit 1 }

Api -Method Patch -Path "/device-orders/$($recoverOrder.id)/approve" -Token $adminToken | Out-Null
$afterRecover = (Api -Method Get -Path "/devices/$deviceId" -Token $adminToken).data
if ($afterRecover.status -eq 'Trong kho' -and $null -eq $afterRecover.currentUser -and $null -eq $afterRecover.department) {
  Ok "duyet xong: Device ve 'Trong kho', currentUser/department = null"
} else {
  Fail "duyet don Thu hoi khong xoa dung Device: status='$($afterRecover.status)'"
}

Step "5. Tao don roi tu choi"
$device2 = (Api -Method Post -Path '/devices' -Token $adminToken -Body @{
  deviceCode = "LT-$(Suffix6 1)"; deviceName = "Laptop E2E tu choi $stamp"
  specDetail = 'Core i5, 16GB'; unit = 'Cai'; deviceTypeId = $laptop.id
}).data
$rejectOrder = (Api -Method Post -Path '/device-orders' -Token $techToken -Body @{
  type = 'Cấp phát'; targetUserId = $staff.id; deviceIds = @($device2.id)
}).data
Api -Method Patch -Path "/device-orders/$($rejectOrder.id)/reject" -Token $adminToken -Body @{ reason = 'E2E tu choi' } | Out-Null
$afterReject = (Api -Method Get -Path "/devices/$($device2.id)" -Token $adminToken).data
if ($afterReject.status -eq 'Trong kho') { Ok "tu choi don: Device van 'Trong kho'" }
else { Fail "tu choi don nhung Device status='$($afterReject.status)', mong 'Trong kho'" }

Step "6. Nhan vien khong xem duoc danh sach don"
$staffToken = (Api -Method Post -Path '/auth/login' -Body @{ identifier = $staffUname; password = $staffPass }).data.accessToken
ExpectStatus -Method Get -Path '/device-orders' -Token $staffToken -Expected 403 -Label "Nhan vien GET /device-orders"

Write-Host ""
if ($script:Failed -eq 0) {
  Write-Host "TAT CA BUOC E2E DON CAP PHAT - THU HOI DEU XANH" -ForegroundColor Green
  exit 0
} else {
  Write-Host "$($script:Failed) BUOC HONG" -ForegroundColor Red
  exit 1
}
```

Note: unlike `e2e-devices.ps1`, this script's step bodies avoid Vietnamese diacritics in `Write-Host`/`Step`/`Ok`/`Fail` *labels* (ASCII only) as a defensive simplification — the BOM requirement from `e2e-devices.ps1` still applies (the file must be saved UTF-8 **with BOM**) because the `Body` payloads sent to the API (`'Cấp phát'`, `'Thu hồi'`) and the SQL string literal (`'Đã cấp phát'`) still contain real Vietnamese text that PowerShell 5.1 must read correctly from disk.

- [ ] **Step 2: Save with BOM and run it**

Verify the file was saved as UTF-8 with BOM (the same requirement `e2e-devices.ps1` documents — check with a hex/editor view if unsure, or re-save explicitly with a BOM-preserving tool). With the backend running (`cd backend && npm run start:dev`) and the local PostgreSQL up, run:
```
powershell -ExecutionPolicy Bypass -File backend/scripts/e2e-device-orders.ps1
```
Expected: `TAT CA BUOC E2E DON CAP PHAT - THU HOI DEU XANH`, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/e2e-device-orders.ps1
git commit -m "test(device-orders): script E2E cap phat - thu hoi tren PostgreSQL that"
```

---

## Frontend

### Task 6: `session.ts` — order permission helpers

**Files:**
- Modify: `frontend/src/modules/auth/domain/session.ts`
- Modify: `frontend/src/modules/auth/domain/session.test.ts`

**Interfaces:**
- Produces: `isTechHead`, `canAccessOrders`, `canCreateOrder`, `canDecideOrder` (all `(session: AuthSession | null) => boolean`) — consumed by Tasks 9, 10, 12.

- [ ] **Step 1: Write the failing tests**

In `frontend/src/modules/auth/domain/session.test.ts`, add these after the existing `canWriteDevices` tests, and add `canAccessOrders, canCreateOrder, canDecideOrder` to the existing import line from `./session`:

```ts
it('canAccessOrders: Admin hoặc Trưởng phòng Kỹ thuật', () => {
  expect(canAccessOrders({ ...base, roleName: 'Quản trị viên', departmentCode: null })).toBe(true);
  expect(canAccessOrders({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KYTHUAT' })).toBe(true);
  expect(canAccessOrders({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KETOAN' })).toBe(false);
  expect(canAccessOrders(base)).toBe(false);
});
it('canCreateOrder: CHỈ Trưởng phòng Kỹ thuật, không gồm Admin', () => {
  expect(canCreateOrder({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KYTHUAT' })).toBe(true);
  expect(canCreateOrder({ ...base, roleName: 'Quản trị viên', departmentCode: null })).toBe(false);
});
it('canDecideOrder: CHỈ Admin, không gồm Trưởng phòng Kỹ thuật', () => {
  expect(canDecideOrder({ ...base, roleName: 'Quản trị viên', departmentCode: null })).toBe(true);
  expect(canDecideOrder({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KYTHUAT' })).toBe(false);
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd frontend && npx vitest run session.test.ts`
Expected: FAIL — `canAccessOrders` etc. are not exported yet (TypeScript/import error).

- [ ] **Step 3: Implement**

In `frontend/src/modules/auth/domain/session.ts`, replace:

```ts
/** Ghi thiết bị: Quản trị viên, hoặc Trưởng phòng Kỹ thuật. Backend mới là chốt chặn thật. */
export const canWriteDevices = (session: AuthSession | null): boolean =>
  session?.roleName === ADMIN_ROLE ||
  (session?.roleName === HEAD_ROLE && session?.departmentCode === TECH_DEPARTMENT_CODE);
```

with:

```ts
export const isTechHead = (session: AuthSession | null): boolean =>
  session?.roleName === HEAD_ROLE && session?.departmentCode === TECH_DEPARTMENT_CODE;

/** Ghi thiết bị: Quản trị viên, hoặc Trưởng phòng Kỹ thuật. Backend mới là chốt chặn thật. */
export const canWriteDevices = (session: AuthSession | null): boolean =>
  isAdmin(session) || isTechHead(session);

/** Xem đơn Cấp phát - Thu hồi: Quản trị viên hoặc Trưởng phòng Kỹ thuật. */
export const canAccessOrders = (session: AuthSession | null): boolean =>
  isAdmin(session) || isTechHead(session);

/** Tạo đơn: CHỈ Trưởng phòng Kỹ thuật — Admin không tạo đơn (khác canWriteDevices). */
export const canCreateOrder = (session: AuthSession | null): boolean => isTechHead(session);

/** Duyệt/từ chối đơn: CHỈ Quản trị viên. */
export const canDecideOrder = (session: AuthSession | null): boolean => isAdmin(session);
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `cd frontend && npx vitest run session.test.ts`
Expected: PASS, all cases including the pre-existing `canWriteDevices` ones (unchanged behavior).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/auth/domain/session.ts frontend/src/modules/auth/domain/session.test.ts
git commit -m "feat(auth): thêm canAccessOrders/canCreateOrder/canDecideOrder"
```

---

### Task 7: `allocation` module — domain layer

**Files:**
- Create: `frontend/src/modules/allocation/domain/deviceOrder.ts`
- Create: `frontend/src/modules/allocation/domain/validateOrderDraft.ts`
- Create: `frontend/src/modules/allocation/domain/validateOrderDraft.test.ts`

**Interfaces:**
- Produces: `ORDER_TYPE`, `ORDER_STATUS`, types `OrderType`, `OrderStatus`, `UserRef`, `DeviceOrder`, `DeviceOrderDetail`, `OrderDraft`, `emptyOrderDraft()`, `validateOrderDraft()`, `hasErrors()` — consumed by Tasks 8, 9, 10, 11.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/allocation/domain/validateOrderDraft.test.ts`:

```ts
import { expect, it } from 'vitest';
import { emptyOrderDraft, hasErrors, validateOrderDraft } from './validateOrderDraft';

it('trống hoàn toàn: thiếu cả 3 trường bắt buộc', () => {
  const errors = validateOrderDraft(emptyOrderDraft());
  expect(errors.type).toBeDefined();
  expect(errors.targetUserId).toBeDefined();
  expect(errors.deviceIds).toBeDefined();
});

it('đủ 3 trường: không lỗi', () => {
  const errors = validateOrderDraft({ type: 'Cấp phát', targetUserId: 1, deviceIds: [1], note: '' });
  expect(hasErrors(errors)).toBe(false);
});

it('thiếu deviceIds: chỉ báo lỗi deviceIds', () => {
  const errors = validateOrderDraft({ type: 'Cấp phát', targetUserId: 1, deviceIds: [], note: '' });
  expect(hasErrors(errors)).toBe(true);
  expect(errors.deviceIds).toBeDefined();
  expect(errors.type).toBeUndefined();
  expect(errors.targetUserId).toBeUndefined();
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd frontend && npx vitest run validateOrderDraft.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the domain types**

Create `frontend/src/modules/allocation/domain/deviceOrder.ts`:

```ts
import type { Device } from '@/modules/device/domain/device';

export const ORDER_TYPE = { ALLOCATE: 'Cấp phát', RECOVER: 'Thu hồi' } as const;
export type OrderType = (typeof ORDER_TYPE)[keyof typeof ORDER_TYPE];

export const ORDER_STATUS = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối' } as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export interface UserRef {
  id: number;
  fullName: string;
  username: string;
}

export interface DeviceOrder {
  id: number;
  type: OrderType;
  status: OrderStatus;
  note: string | null;
  rejectReason: string | null;
  decidedAt: string | null;
  createdAt: string;
  targetUser: UserRef;
  createdBy: { id: number; fullName: string };
  decidedBy: { id: number; fullName: string } | null;
  deviceCount: number;
}

export interface DeviceOrderDetail extends DeviceOrder {
  items: { id: number; device: Device }[];
}
```

- [ ] **Step 4: Implement the draft + validator**

Create `frontend/src/modules/allocation/domain/validateOrderDraft.ts`:

```ts
import type { OrderType } from './deviceOrder';

export interface OrderDraft {
  type: OrderType | '';
  targetUserId: number | null;
  deviceIds: number[];
  note: string;
}

export function emptyOrderDraft(): OrderDraft {
  return { type: '', targetUserId: null, deviceIds: [], note: '' };
}

export type OrderDraftErrors = Partial<Record<'type' | 'targetUserId' | 'deviceIds', string>>;

const REQUIRED = 'Bắt buộc';

export function validateOrderDraft(d: OrderDraft): OrderDraftErrors {
  const errors: OrderDraftErrors = {};
  if (!d.type) errors.type = REQUIRED;
  if (d.targetUserId === null) errors.targetUserId = REQUIRED;
  if (d.deviceIds.length === 0) errors.deviceIds = 'Vui lòng chọn ít nhất 1 thiết bị';
  return errors;
}

export function hasErrors(errors: OrderDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}
```

- [ ] **Step 5: Run it, confirm it passes**

Run: `cd frontend && npx vitest run validateOrderDraft.test.ts`
Expected: PASS, all 3 cases.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/allocation/domain
git commit -m "feat(allocation): domain layer — kiểu DeviceOrder và validate draft"
```

---

### Task 8: `allocation` module — application + infrastructure, `currentUserId` device query

**Files:**
- Create: `frontend/src/modules/allocation/application/DeviceOrderRepository.ts`
- Create: `frontend/src/modules/allocation/infrastructure/HttpDeviceOrderRepository.ts`
- Create: `frontend/src/modules/allocation/infrastructure/HttpDeviceOrderRepository.test.ts`
- Create: `frontend/src/modules/allocation/infrastructure/container.ts`
- Modify: `frontend/src/modules/device/application/DeviceRepository.ts`
- Modify: `frontend/src/modules/device/infrastructure/HttpDeviceRepository.test.ts`

**Interfaces:**
- Consumes: `apiGet/apiPost/apiPatch` (`@/shared/lib/apiClient`), `OrderDraft`/`DeviceOrder`/`DeviceOrderDetail`/`UserRef` (Task 7).
- Produces: `deviceOrderService` (list/get/create/approve/reject/users), `OrderValidationError` — consumed by Tasks 9, 10.
- Produces: `DeviceQuery.currentUserId?: number` — consumed by Task 10.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/modules/allocation/infrastructure/HttpDeviceOrderRepository.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyOrderDraft, type OrderDraft } from '../domain/validateOrderDraft';
import { HttpDeviceOrderRepository } from './HttpDeviceOrderRepository';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, error: null, message: 'OK' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const sentBody = (fetchMock: ReturnType<typeof vi.fn>) =>
  JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);

const draft = (over: Partial<OrderDraft> = {}): OrderDraft => ({
  ...emptyOrderDraft(),
  type: 'Cấp phát',
  targetUserId: 7,
  deviceIds: [1, 2],
  ...over,
});

describe('HttpDeviceOrderRepository', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation(async () => envelope({ id: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
  });

  it('create: gửi type/targetUserId/deviceIds, bỏ note rỗng', async () => {
    await new HttpDeviceOrderRepository().create(draft());
    expect(sentBody(fetchMock)).toEqual({ type: 'Cấp phát', targetUserId: 7, deviceIds: [1, 2] });
  });

  it('create: giữ note khi có nội dung', async () => {
    await new HttpDeviceOrderRepository().create(draft({ note: '  Ưu tiên gấp  ' }));
    expect(sentBody(fetchMock).note).toBe('Ưu tiên gấp');
  });

  it('approve: gọi PATCH /device-orders/:id/approve, không gửi body', async () => {
    await new HttpDeviceOrderRepository().approve(5);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/device-orders/5/approve');
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBeUndefined();
  });

  it('reject: gửi reason', async () => {
    await new HttpDeviceOrderRepository().reject(5, 'Không đủ thiết bị');
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/device-orders/5/reject');
    expect(sentBody(fetchMock)).toEqual({ reason: 'Không đủ thiết bị' });
  });

  it('list: gọi GET /device-orders với query type', async () => {
    fetchMock.mockImplementation(async () => envelope([]));
    await new HttpDeviceOrderRepository().list({ type: 'Cấp phát' });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/device-orders');
    expect(url.searchParams.get('type')).toBe('Cấp phát');
  });

  it('users: gọi GET /users/lookup', async () => {
    fetchMock.mockImplementation(async () => envelope([]));
    await new HttpDeviceOrderRepository().users();
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/users/lookup');
  });
});
```

Also add this test to the existing `frontend/src/modules/device/infrastructure/HttpDeviceRepository.test.ts`, inside the `describe('HttpDeviceRepository', ...)` block:

```ts
  it('list: truyền currentUserId qua query string', async () => {
    fetchMock.mockImplementation(async () => envelope([]));
    await new HttpDeviceRepository().list({ currentUserId: 7 });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('currentUserId')).toBe('7');
  });
```

- [ ] **Step 2: Run both, confirm they fail**

Run: `cd frontend && npx vitest run HttpDeviceOrderRepository.test.ts HttpDeviceRepository.test.ts`
Expected: FAIL — `HttpDeviceOrderRepository` module doesn't exist; the `currentUserId` case fails because `DeviceQuery` doesn't have that field (TypeScript) / it's silently dropped.

- [ ] **Step 3: Add `currentUserId` to `DeviceQuery`**

In `frontend/src/modules/device/application/DeviceRepository.ts`, add one line to `DeviceQuery`:

```ts
export interface DeviceQuery {
  search?: string;
  status?: DeviceStatus;
  deviceTypeId?: number;
  departmentId?: number;
  currentUserId?: number;
}
```

(No other change needed — `HttpDeviceRepository.list()` already forwards the whole query object to `apiGet`.)

- [ ] **Step 4: Implement the application layer**

Create `frontend/src/modules/allocation/application/DeviceOrderRepository.ts`:

```ts
import { hasErrors, validateOrderDraft, type OrderDraft } from '../domain/validateOrderDraft';
import type { DeviceOrder, DeviceOrderDetail, UserRef } from '../domain/deviceOrder';

export interface DeviceOrderQuery {
  type?: string;
  status?: string;
}

export interface DeviceOrderRepository {
  list(query?: DeviceOrderQuery): Promise<DeviceOrder[]>;
  getById(id: number): Promise<DeviceOrderDetail>;
  create(draft: OrderDraft): Promise<DeviceOrderDetail>;
  approve(id: number): Promise<DeviceOrderDetail>;
  reject(id: number, reason: string): Promise<DeviceOrderDetail>;
  /** Danh sách rút gọn cho dropdown "Người liên quan" — cùng /users/lookup module device dùng. */
  users(): Promise<UserRef[]>;
}

export class OrderValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super('Biểu mẫu chưa hợp lệ');
    this.name = 'OrderValidationError';
  }
}

function assertValid(draft: OrderDraft) {
  const errors = validateOrderDraft(draft);
  if (hasErrors(errors)) throw new OrderValidationError(errors as Record<string, string>);
}

export function makeDeviceOrderService(repo: DeviceOrderRepository) {
  return {
    list: (query?: DeviceOrderQuery) => repo.list(query),
    get: (id: number) => repo.getById(id),
    create: (draft: OrderDraft) => {
      assertValid(draft);
      return repo.create(draft);
    },
    approve: (id: number) => repo.approve(id),
    reject: (id: number, reason: string) => repo.reject(id, reason),
    users: () => repo.users(),
  };
}

export type DeviceOrderService = ReturnType<typeof makeDeviceOrderService>;
```

- [ ] **Step 5: Implement the HTTP adapter**

Create `frontend/src/modules/allocation/infrastructure/HttpDeviceOrderRepository.ts`:

```ts
import { apiGet, apiPatch, apiPost } from '@/shared/lib/apiClient';
import type { DeviceOrder, DeviceOrderDetail, UserRef } from '../domain/deviceOrder';
import type { OrderDraft } from '../domain/validateOrderDraft';
import type { DeviceOrderQuery, DeviceOrderRepository } from '../application/DeviceOrderRepository';

function toBody(d: OrderDraft) {
  return {
    type: d.type,
    targetUserId: d.targetUserId ?? undefined,
    note: d.note.trim() ? d.note.trim() : undefined,
    deviceIds: d.deviceIds,
  };
}

/** Adapter gọi module `device-orders` của backend (backend/src/modules/device-orders). */
export class HttpDeviceOrderRepository implements DeviceOrderRepository {
  list(query: DeviceOrderQuery = {}): Promise<DeviceOrder[]> {
    return apiGet<DeviceOrder[]>('/device-orders', query as Record<string, string | number | undefined>);
  }
  getById(id: number): Promise<DeviceOrderDetail> {
    return apiGet<DeviceOrderDetail>(`/device-orders/${id}`);
  }
  create(draft: OrderDraft): Promise<DeviceOrderDetail> {
    return apiPost<DeviceOrderDetail>('/device-orders', toBody(draft));
  }
  approve(id: number): Promise<DeviceOrderDetail> {
    return apiPatch<DeviceOrderDetail>(`/device-orders/${id}/approve`, undefined);
  }
  reject(id: number, reason: string): Promise<DeviceOrderDetail> {
    return apiPatch<DeviceOrderDetail>(`/device-orders/${id}/reject`, { reason });
  }
  users(): Promise<UserRef[]> {
    return apiGet<UserRef[]>('/users/lookup');
  }
}
```

Create `frontend/src/modules/allocation/infrastructure/container.ts`:

```ts
import { makeDeviceOrderService } from '../application/DeviceOrderRepository';
import { HttpDeviceOrderRepository } from './HttpDeviceOrderRepository';

export const deviceOrderService = makeDeviceOrderService(new HttpDeviceOrderRepository());
```

- [ ] **Step 6: Run both tests, confirm they pass**

Run: `cd frontend && npx vitest run HttpDeviceOrderRepository.test.ts HttpDeviceRepository.test.ts`
Expected: PASS, all cases.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/allocation/application frontend/src/modules/allocation/infrastructure frontend/src/modules/device/application/DeviceRepository.ts frontend/src/modules/device/infrastructure/HttpDeviceRepository.test.ts
git commit -m "feat(allocation): application + infrastructure — HttpDeviceOrderRepository"
```

---

### Task 9: `DeviceOrderListPage` — list, filter, Duyệt/Từ chối

**Files:**
- Create: `frontend/src/modules/allocation/presentation/useDeviceOrders.ts`
- Create: `frontend/src/modules/allocation/presentation/orderStatusTone.ts`
- Create: `frontend/src/modules/allocation/presentation/DeviceOrderListPage.tsx`
- Create: `frontend/src/modules/allocation/presentation/DeviceOrderListPage.test.tsx`

**Interfaces:**
- Consumes: `deviceOrderService` (Task 8), `canCreateOrder`/`canDecideOrder` (Task 6), shared UI (`PageHeader`, `Button`, `Card`, `Badge`, `DataTable`, `Select`, `useAsyncAction`, `useAsyncData`).
- Produces: `<DeviceOrderListPage />` — consumed by Task 12 (router).
- Produces (stub, wired fully in Task 11): calls `downloadBienBan` from `./print/generateBienBan` — that file does not exist yet, so this task creates a minimal placeholder for it that Task 11 replaces.

- [ ] **Step 1: Create a minimal `generateBienBan` placeholder (replaced fully in Task 11)**

Create `frontend/src/modules/allocation/presentation/print/generateBienBan.ts`:

```ts
import type { DeviceOrderDetail } from '../../domain/deviceOrder';

// ponytail: cài jsPDF thật ở Task 11 của plan này — đây chỉ là chữ ký hàm để biên dịch được.
export function downloadBienBan(_order: DeviceOrderDetail): void {
  throw new Error('Chưa triển khai — xem Task 11');
}
```

(This keeps `DeviceOrderListPage.tsx` compiling and its own tests — which never click "In biên bản" — green. Task 11 replaces this file's contents entirely.)

- [ ] **Step 2: Write the failing test**

Create `frontend/src/modules/allocation/presentation/DeviceOrderListPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '@/app/session/SessionContext';
import { fakeJwt, inOneHour } from '@/test/fakeJwt';
import { DeviceOrderListPage } from './DeviceOrderListPage';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const order = (id: number, status = 'Chờ duyệt') => ({
  id,
  type: 'Cấp phát',
  status,
  note: null,
  rejectReason: null,
  decidedAt: null,
  createdAt: '2026-09-24T00:00:00.000Z',
  targetUser: { id: 5, fullName: 'Nguyễn Văn A', username: 'a' },
  createdBy: { id: 2, fullName: 'Trưởng phòng Kỹ thuật' },
  decidedBy: null,
  deviceCount: 1,
});

const envelope = (data: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify({ success: true, data, error: null, message: 'OK' }), { status: 200 }),
  );

function renderPage(roleName: string, departmentCode: string | null, orders = [order(1)]) {
  localStorage.setItem(
    'idsm.session',
    JSON.stringify({
      userId: '1',
      displayName: 'A',
      email: 'a@b.vn',
      token: fakeJwt(inOneHour()),
      roleName,
      departmentCode,
    }),
  );
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => envelope(orders)));
  render(
    <SessionProvider>
      <MemoryRouter>
        <DeviceOrderListPage />
      </MemoryRouter>
    </SessionProvider>,
  );
}

it('Trưởng phòng Kỹ thuật: thấy nút "Tạo đơn", không thấy Duyệt/Từ chối', async () => {
  renderPage('Trưởng phòng', 'KYTHUAT');
  await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Tạo đơn' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
});

it('Admin: thấy Duyệt/Từ chối trên đơn Chờ duyệt, không thấy "Tạo đơn"', async () => {
  renderPage('Quản trị viên', null);
  await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Tạo đơn' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Duyệt' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Từ chối' })).toBeInTheDocument();
});

it('Admin: đơn "Đã duyệt" hiện nút "In biên bản", không hiện Duyệt/Từ chối', async () => {
  renderPage('Quản trị viên', null, [order(1, 'Đã duyệt')]);
  await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'In biên bản' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
});
```

- [ ] **Step 3: Run it, confirm it fails**

Run: `cd frontend && npx vitest run DeviceOrderListPage.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 4: Implement**

Create `frontend/src/modules/allocation/presentation/orderStatusTone.ts`:

```ts
import type { BadgeTone } from '@/shared/ui/Badge';
import { ORDER_STATUS, type OrderStatus } from '../domain/deviceOrder';

export const ORDER_STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  [ORDER_STATUS.PENDING]: 'warn',
  [ORDER_STATUS.APPROVED]: 'ok',
  [ORDER_STATUS.REJECTED]: 'danger',
};
```

Create `frontend/src/modules/allocation/presentation/useDeviceOrders.ts`:

```ts
import { useAsyncData } from '@/shared/lib/useAsyncData';
import type { DeviceOrderQuery } from '../application/DeviceOrderRepository';
import { deviceOrderService } from '../infrastructure/container';

export function useDeviceOrders(query: DeviceOrderQuery, reloadKey = 0) {
  return useAsyncData(() => deviceOrderService.list(query), [query.type, query.status, reloadKey]);
}
```

Create `frontend/src/modules/allocation/presentation/DeviceOrderListPage.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useSession } from '@/app/session/SessionContext';
import { canCreateOrder, canDecideOrder } from '@/modules/auth/domain/session';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { Select } from '@/shared/ui/inputs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { ORDER_STATUS, ORDER_TYPE, type DeviceOrder, type OrderStatus, type OrderType } from '../domain/deviceOrder';
import { deviceOrderService } from '../infrastructure/container';
import { downloadBienBan } from './print/generateBienBan';
import { useDeviceOrders } from './useDeviceOrders';
import { ORDER_STATUS_TONE } from './orderStatusTone';

export function DeviceOrderListPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const canCreate = canCreateOrder(session);
  const canDecide = canDecideOrder(session);
  const [type, setType] = useState<OrderType | ''>('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [reloadKey, setReloadKey] = useState(0);
  const { data: orders, loading, error } = useDeviceOrders(
    { type: type || undefined, status: status || undefined },
    reloadKey,
  );

  const approve = useAsyncAction(async (o: DeviceOrder) => {
    if (!window.confirm('Duyệt đơn này?')) return;
    await deviceOrderService.approve(o.id);
    setReloadKey((k) => k + 1);
  });

  const reject = useAsyncAction(async (o: DeviceOrder) => {
    const reason = window.prompt('Lý do từ chối');
    if (!reason || !reason.trim()) return;
    await deviceOrderService.reject(o.id, reason.trim());
    setReloadKey((k) => k + 1);
  });

  const print = useAsyncAction(async (o: DeviceOrder) => {
    const detail = await deviceOrderService.get(o.id);
    downloadBienBan(detail);
  });

  const columns: Array<Column<DeviceOrder>> = [
    { key: 'type', header: 'Loại', cell: (o) => o.type },
    { key: 'target', header: 'Người liên quan', cell: (o) => o.targetUser.fullName },
    { key: 'count', header: 'Số thiết bị', cell: (o) => String(o.deviceCount), align: 'right' },
    {
      key: 'status',
      header: 'Trạng thái',
      cell: (o) => <Badge tone={ORDER_STATUS_TONE[o.status]}>{o.status}</Badge>,
    },
    { key: 'createdAt', header: 'Ngày tạo', cell: (o) => o.createdAt.slice(0, 10) },
    { key: 'createdBy', header: 'Người tạo', cell: (o) => o.createdBy.fullName },
    {
      key: 'actions',
      header: 'Hoạt động',
      align: 'right',
      cell: (o) => (
        <div className="flex justify-end gap-2">
          {canDecide && o.status === ORDER_STATUS.PENDING && (
            <>
              <Button size="sm" variant="outline" disabled={approve.pending} onClick={() => void approve.run(o)}>
                Duyệt
              </Button>
              <Button size="sm" variant="outline" disabled={reject.pending} onClick={() => void reject.run(o)}>
                Từ chối
              </Button>
            </>
          )}
          {o.status === ORDER_STATUS.APPROVED && (
            <Button size="sm" variant="outline" disabled={print.pending} onClick={() => void print.run(o)}>
              In biên bản
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: 'Trang chủ', to: '/dashboard' }, { label: 'Cấp phát - Thu hồi' }]}
        title="Cấp phát - Thu hồi"
        actions={
          canCreate && (
            <Button size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => navigate('/allocation/new')}>
              Tạo đơn
            </Button>
          )
        }
      />

      <Card className="p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Select className="sm:w-56" value={type} onChange={(e) => setType(e.target.value as OrderType | '')}>
            <option value="">Loại (Tất cả)</option>
            <option value={ORDER_TYPE.ALLOCATE}>{ORDER_TYPE.ALLOCATE}</option>
            <option value={ORDER_TYPE.RECOVER}>{ORDER_TYPE.RECOVER}</option>
          </Select>
          <Select className="sm:w-56" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | '')}>
            <option value="">Trạng thái (Tất cả)</option>
            <option value={ORDER_STATUS.PENDING}>{ORDER_STATUS.PENDING}</option>
            <option value={ORDER_STATUS.APPROVED}>{ORDER_STATUS.APPROVED}</option>
            <option value={ORDER_STATUS.REJECTED}>{ORDER_STATUS.REJECTED}</option>
          </Select>
        </div>

        {(approve.error ?? reject.error ?? print.error ?? error) && (
          <p className="mb-3 text-sm text-status-dangerFg">
            {approve.error ?? reject.error ?? print.error ?? error}
          </p>
        )}

        <DataTable
          columns={columns}
          rows={orders ?? []}
          rowKey={(o) => String(o.id)}
          empty={loading ? 'Đang tải…' : 'Không có đơn nào'}
        />
      </Card>
    </>
  );
}
```

- [ ] **Step 5: Run it, confirm it passes**

Run: `cd frontend && npx vitest run DeviceOrderListPage.test.tsx`
Expected: PASS, all 3 cases.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/allocation/presentation/useDeviceOrders.ts frontend/src/modules/allocation/presentation/orderStatusTone.ts frontend/src/modules/allocation/presentation/DeviceOrderListPage.tsx frontend/src/modules/allocation/presentation/DeviceOrderListPage.test.tsx frontend/src/modules/allocation/presentation/print/generateBienBan.ts
git commit -m "feat(allocation): trang danh sách đơn — lọc, Duyệt, Từ chối"
```

---

### Task 10: `CreateOrderPage` — tạo đơn

**Files:**
- Create: `frontend/src/modules/allocation/presentation/CreateOrderPage.tsx`

**Interfaces:**
- Consumes: `deviceOrderService` (Task 8), `deviceService` + `DEVICE_STATUS`/`Device` (`@/modules/device/infrastructure/container`, `@/modules/device/domain/device`), `OrderValidationError` (Task 8), `emptyOrderDraft` (Task 7).
- Produces: `<CreateOrderPage />` — consumed by Task 12 (router).

No dedicated component test for this task (per the spec's stated test plan) — its device-selection logic is thin composition over `deviceService.list()` (already tested) and `validateOrderDraft` (already tested in Task 7); it is exercised by the manual QA pass in Task 13.

- [ ] **Step 1: Implement**

Create `frontend/src/modules/allocation/presentation/CreateOrderPage.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { Checkbox, Radio, Select, Textarea } from '@/shared/ui/inputs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { DEVICE_STATUS, type Device } from '@/modules/device/domain/device';
import { deviceService } from '@/modules/device/infrastructure/container';
import { ORDER_TYPE } from '../domain/deviceOrder';
import { emptyOrderDraft } from '../domain/validateOrderDraft';
import { OrderValidationError } from '../application/DeviceOrderRepository';
import { deviceOrderService } from '../infrastructure/container';

export function CreateOrderPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(emptyOrderDraft());
  const { data: users } = useAsyncData(() => deviceOrderService.users(), []);

  const { data: eligibleDevices, loading: loadingDevices } = useAsyncData<Device[]>(() => {
    if (!draft.type || draft.targetUserId === null) return Promise.resolve([]);
    return draft.type === ORDER_TYPE.ALLOCATE
      ? deviceService.list({ status: DEVICE_STATUS.IN_STOCK })
      : deviceService.list({ status: DEVICE_STATUS.ALLOCATED, currentUserId: draft.targetUserId });
  }, [draft.type, draft.targetUserId]);

  const toggleDevice = (id: number, checked: boolean) => {
    setDraft((d) => ({
      ...d,
      deviceIds: checked ? [...d.deviceIds, id] : d.deviceIds.filter((x) => x !== id),
    }));
  };

  const submit = useAsyncAction(async () => {
    try {
      await deviceOrderService.create(draft);
      navigate('/allocation');
    } catch (e) {
      if (e instanceof OrderValidationError) throw new Error('Vui lòng kiểm tra các trường bắt buộc');
      throw e;
    }
  });

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Trang chủ', to: '/dashboard' },
          { label: 'Cấp phát - Thu hồi', to: '/allocation' },
          { label: 'Tạo đơn' },
        ]}
        title="Tạo đơn"
      />

      <Card>
        <form
          className="divide-y divide-line"
          onSubmit={(e) => {
            e.preventDefault();
            void submit.run();
          }}
        >
          <section className="p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">Loại đơn</h3>
            <div className="flex gap-6">
              <Radio
                id="type-allocate"
                name="type"
                label={ORDER_TYPE.ALLOCATE}
                checked={draft.type === ORDER_TYPE.ALLOCATE}
                onChange={() => setDraft((d) => ({ ...d, type: ORDER_TYPE.ALLOCATE, deviceIds: [] }))}
              />
              <Radio
                id="type-recover"
                name="type"
                label={ORDER_TYPE.RECOVER}
                checked={draft.type === ORDER_TYPE.RECOVER}
                onChange={() => setDraft((d) => ({ ...d, type: ORDER_TYPE.RECOVER, deviceIds: [] }))}
              />
            </div>
          </section>

          <section className="p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">Người liên quan</h3>
            <Field label={draft.type === ORDER_TYPE.RECOVER ? 'Người đang giữ' : 'Người nhận'}>
              <Select
                value={draft.targetUserId ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    targetUserId: e.target.value ? Number(e.target.value) : null,
                    deviceIds: [],
                  }))
                }
              >
                <option value="">— Chọn người —</option>
                {(users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </Select>
            </Field>
          </section>

          <section className="p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">Thiết bị</h3>
            {!draft.type || draft.targetUserId === null ? (
              <p className="text-sm text-ink-muted">Chọn loại đơn và người liên quan trước.</p>
            ) : loadingDevices ? (
              <p className="text-sm text-ink-muted">Đang tải…</p>
            ) : (eligibleDevices ?? []).length === 0 ? (
              <p className="text-sm text-ink-muted">Không có thiết bị phù hợp.</p>
            ) : (
              <div className="space-y-2">
                {(eligibleDevices ?? []).map((d) => (
                  <Checkbox
                    key={d.id}
                    id={`device-${d.id}`}
                    label={`${d.deviceCode} — ${d.deviceName}`}
                    checked={draft.deviceIds.includes(d.id)}
                    onChange={(e) => toggleDevice(d.id, e.target.checked)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">Ghi chú</h3>
            <Textarea value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
          </section>

          {submit.error && <p className="px-6 pb-2 text-sm text-status-dangerFg">{submit.error}</p>}

          <section className="flex justify-end gap-2 p-6">
            <Button type="button" variant="outline" onClick={() => navigate('/allocation')}>
              Huỷ
            </Button>
            <Button type="submit" disabled={submit.pending}>
              Tạo đơn
            </Button>
          </section>
        </form>
      </Card>
    </>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npm run lint` (this repo's `lint` script is `tsc -b --noEmit`)
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/allocation/presentation/CreateOrderPage.tsx
git commit -m "feat(allocation): trang tạo đơn cấp phát/thu hồi"
```

---

### Task 11: Biên bản PDF (`jspdf`)

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/modules/allocation/presentation/print/generateBienBan.ts` (replaces the Task 9 placeholder)
- Create: `frontend/src/modules/allocation/presentation/print/generateBienBan.test.ts`

**Interfaces:**
- Produces: `buildBienBanContent(order): string[]` (pure, tested) and `downloadBienBan(order): void` (calls `jsPDF`, not unit-tested) — `downloadBienBan` already consumed by `DeviceOrderListPage` since Task 9.

- [ ] **Step 1: Add the dependency**

Run (from repo root):
```
npm install jspdf --workspace frontend
```
Expected: `frontend/package.json` gets a new `"jspdf": "^2.5.2"` (or whatever the installed version resolves to) under `dependencies`, and `package-lock.json` updates.

- [ ] **Step 2: Write the failing test**

Create `frontend/src/modules/allocation/presentation/print/generateBienBan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { DeviceOrderDetail } from '../../domain/deviceOrder';
import { buildBienBanContent } from './generateBienBan';

const device = (over: Partial<DeviceOrderDetail['items'][number]['device']> = {}) => ({
  id: 9,
  deviceCode: 'LT-000001',
  deviceName: 'Dell Latitude 5420',
  serialNumber: null,
  specDetail: 'i5 · 16GB',
  unit: 'Cái',
  status: 'Đã cấp phát',
  allocatedOn: null,
  location: null,
  purchaseDate: null,
  supplier: null,
  warrantyMonths: null,
  warrantyCondition: null,
  warrantyExpiresOn: null,
  deviceType: { id: 1, typeName: 'Laptop', prefix: 'LT' },
  department: null,
  currentUser: null,
  accessories: [],
  ...over,
});

const order = (over: Partial<DeviceOrderDetail> = {}): DeviceOrderDetail => ({
  id: 1,
  type: 'Cấp phát',
  status: 'Đã duyệt',
  note: null,
  rejectReason: null,
  decidedAt: '2026-09-24T00:00:00.000Z',
  createdAt: '2026-09-20T00:00:00.000Z',
  targetUser: { id: 5, fullName: 'Nguyễn Văn A', username: 'a' },
  createdBy: { id: 2, fullName: 'Trưởng phòng Kỹ thuật' },
  decidedBy: { id: 1, fullName: 'Quản trị viên' },
  deviceCount: 1,
  items: [{ id: 1, device: device() }],
  ...over,
});

describe('buildBienBanContent', () => {
  it('tiêu đề đúng theo loại đơn Cấp phát', () => {
    expect(buildBienBanContent(order())[0]).toBe('BIÊN BẢN CẤP PHÁT THIẾT BỊ');
  });

  it('tiêu đề đúng theo loại đơn Thu hồi', () => {
    expect(buildBienBanContent(order({ type: 'Thu hồi' }))[0]).toBe('BIÊN BẢN THU HỒI THIẾT BỊ');
  });

  it('liệt kê đúng mã thiết bị trong danh sách', () => {
    const lines = buildBienBanContent(order());
    expect(lines.some((l) => l.includes('LT-000001'))).toBe(true);
  });

  it('nhiều thiết bị: liệt kê đủ từng dòng', () => {
    const lines = buildBienBanContent(
      order({
        items: [
          { id: 1, device: device({ deviceCode: 'LT-000001' }) },
          { id: 2, device: device({ id: 10, deviceCode: 'LT-000002' }) },
        ],
      }),
    );
    expect(lines.some((l) => l.includes('LT-000001'))).toBe(true);
    expect(lines.some((l) => l.includes('LT-000002'))).toBe(true);
  });
});
```

- [ ] **Step 3: Run it, confirm it fails**

Run: `cd frontend && npx vitest run generateBienBan.test.ts`
Expected: FAIL — `buildBienBanContent` throws `'Chưa triển khai — xem Task 11'` (the Task 9 placeholder), or isn't exported at all.

- [ ] **Step 4: Implement**

Replace the entire contents of `frontend/src/modules/allocation/presentation/print/generateBienBan.ts` with:

```ts
import jsPDF from 'jspdf';
import { ORDER_TYPE } from '../../domain/deviceOrder';
import type { DeviceOrderDetail } from '../../domain/deviceOrder';

/** Nội dung biên bản, tách riêng khỏi việc vẽ PDF để test được. */
export function buildBienBanContent(o: DeviceOrderDetail): string[] {
  const title =
    o.type === ORDER_TYPE.ALLOCATE ? 'BIÊN BẢN CẤP PHÁT THIẾT BỊ' : 'BIÊN BẢN THU HỒI THIẾT BỊ';
  return [
    title,
    `Số đơn: ${o.id}`,
    `Ngày duyệt: ${o.decidedAt ? o.decidedAt.slice(0, 10) : ''}`,
    `Người lập: ${o.createdBy.fullName}`,
    `Người duyệt: ${o.decidedBy?.fullName ?? ''}`,
    o.type === ORDER_TYPE.ALLOCATE
      ? `Người nhận: ${o.targetUser.fullName}`
      : `Người giữ: ${o.targetUser.fullName}`,
    '',
    'Danh sách thiết bị:',
    ...o.items.map((i) => `- ${i.device.deviceCode} · ${i.device.deviceName} · ${i.device.specDetail}`),
    '',
    'Người giao: ______________________        Người nhận: ______________________',
  ];
}

/** Vẽ và tải file PDF — không letterhead, không nhiều trang, đủ để in ký tay. */
export function downloadBienBan(o: DeviceOrderDetail): void {
  const doc = new jsPDF();
  let y = 20;
  for (const line of buildBienBanContent(o)) {
    doc.text(line, 14, y);
    y += 8;
  }
  const kind = o.type === ORDER_TYPE.ALLOCATE ? 'cap-phat' : 'thu-hoi';
  doc.save(`bien-ban-${kind}-${o.id}.pdf`);
}
```

- [ ] **Step 5: Run it, confirm it passes**

Run: `cd frontend && npx vitest run generateBienBan.test.ts`
Expected: PASS, all 4 cases.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/modules/allocation/presentation/print/generateBienBan.ts frontend/src/modules/allocation/presentation/print/generateBienBan.test.ts
git commit -m "feat(allocation): xuất biên bản PDF bằng jsPDF"
```

---

### Task 12: Routing + navigation visibility

**Files:**
- Create: `frontend/src/app/session/RequireOrderAccess.tsx`
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/shared/layout/navItems.ts`
- Modify: `frontend/src/shared/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `canAccessOrders` (Task 6), `<DeviceOrderListPage />` (Task 9), `<CreateOrderPage />` (Task 10).
- Produces: `/allocation` and `/allocation/new` now render real pages, gated to Admin/Trưởng phòng Kỹ thuật; the sidebar hides "Cấp phát - Thu hồi" for everyone else.

- [ ] **Step 1: Implement the route guard**

Create `frontend/src/app/session/RequireOrderAccess.tsx`:

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { canAccessOrders } from '@/modules/auth/domain/session';
import { useSession } from './SessionContext';

/** Chỉ Quản trị viên hoặc Trưởng phòng Kỹ thuật vào được; role khác về /dashboard. */
export function RequireOrderAccess() {
  const { session } = useSession();
  return canAccessOrders(session) ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
```

- [ ] **Step 2: Wire the routes**

In `frontend/src/app/router.tsx`, add these imports:

```ts
import { RequireOrderAccess } from './session/RequireOrderAccess';
import { DeviceOrderListPage } from '@/modules/allocation/presentation/DeviceOrderListPage';
import { CreateOrderPage } from '@/modules/allocation/presentation/CreateOrderPage';
```

Replace this line:

```tsx
          { path: '/allocation', element: <ComingSoonPage title="Cấp phát - Thu hồi" /> },
```

with:

```tsx
          {
            element: <RequireOrderAccess />,
            children: [
              { path: '/allocation', element: <DeviceOrderListPage /> },
              { path: '/allocation/new', element: <CreateOrderPage /> },
            ],
          },
```

(`ComingSoonPage` stays imported and used — `/transfers` and `/audit` still use it.)

- [ ] **Step 3: Hide the nav item for other roles**

In `frontend/src/shared/layout/navItems.ts`, update the `NavItem` interface and the Cấp phát entry:

```ts
export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Chỉ hiện với Quản trị viên. */
  adminOnly?: boolean;
  /** Chỉ hiện với Quản trị viên hoặc Trưởng phòng Kỹ thuật. */
  orderAccessOnly?: boolean;
}
```

```ts
  { label: 'Cấp phát - Thu hồi', to: '/allocation', icon: ClipboardList, orderAccessOnly: true },
```

In `frontend/src/shared/layout/Sidebar.tsx`, add the import and update the filter:

```ts
import { canAccessOrders, isAdmin } from '@/modules/auth/domain/session';
```

```tsx
        {PRIMARY_NAV.filter(
          (item) => (!item.adminOnly || isAdmin(session)) && (!item.orderAccessOnly || canAccessOrders(session)),
        ).map((item) => (
```

- [ ] **Step 4: Run the whole frontend suite and both builds**

Run: `cd frontend && npm test`
Expected: PASS, every test file green (including the ones from Tasks 6–9, and `Sidebar`/router have no existing dedicated test files to break).

Run: `cd frontend && npm run lint && npm run build`
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/session/RequireOrderAccess.tsx frontend/src/app/router.tsx frontend/src/shared/layout/navItems.ts frontend/src/shared/layout/Sidebar.tsx
git commit -m "feat(allocation): gắn route /allocation, /allocation/new và ẩn nav theo quyền"
```

---

### Task 13: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full backend suite**

Run: `cd backend && npm test`
Expected: all spec files green — `auth.spec.ts`, `devices.spec.ts`, `users.spec.ts`, `device-orders.spec.ts`.

- [ ] **Step 2: Backend build + lint**

Run: `cd backend && npm run build && npm run lint`
Expected: both clean.

- [ ] **Step 3: Backend E2E scripts against the real database**

With `cd backend && npm run start:dev` running and local PostgreSQL up, run both:
```
powershell -ExecutionPolicy Bypass -File backend/scripts/e2e-users.ps1
powershell -ExecutionPolicy Bypass -File backend/scripts/e2e-devices.ps1
powershell -ExecutionPolicy Bypass -File backend/scripts/e2e-device-orders.ps1
```
Expected: all three fully green — the first two confirm this round didn't regress the `AuthGuard`/`departmentCode` plumbing or the devices module; the third is this round's own script (Task 5).

- [ ] **Step 4: Full frontend suite, build, lint**

Run: `cd frontend && npm test && npm run lint && npm run build`
Expected: all clean.

- [ ] **Step 5: Report counts and remaining manual step**

Report the final BE jest / FE vitest counts (for the project memory, matching the style of prior rounds: "BE jest N, FE vitest M"). State explicitly that the on-screen walkthrough — log in as Trưởng phòng Kỹ thuật, create a Cấp phát order, log in as Admin, approve it, verify the device shows the new owner, create and approve a Thu hồi order, verify the device returns to stock, try a rejection, print a biên bản PDF and confirm it opens/reads correctly — still needs to be done by the user, since no agent here has a browser.

No commit for this task (verification only; if Step 3's E2E scripts fail, fix forward in a new commit before reporting done).
