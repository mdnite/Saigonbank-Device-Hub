# Điều chuyển thiết bị Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Điều chuyển (device transfer) feature: Admin creates a transfer order moving one or more devices directly from one current holder to another (never through "Trong kho"), Trưởng phòng Kỹ thuật approves or rejects it, approval executes the Device change, an approved transfer prints as a PDF biên bản.

**Architecture:** Mirrors the Cấp phát - Thu hồi round almost exactly (same order→approve/reject→Device-write shape, same atomic-update race guard, same PDF approach) but with every permission reversed (Admin creates, Trưởng phòng Kỹ thuật decides) and a genuinely different Device state transition (holder A → holder B, `status` never changes). New backend module `device-transfers`, new frontend module `transfer`. Reuses the already-embedded DejaVu Sans font (relocated to a shared location first, not re-embedded).

**Tech Stack:** NestJS 11 + Prisma 7 + Postgres (backend); React 18 + Vite + react-router-dom 6 (frontend); `jspdf` (already a dependency, no new install this round).

**Spec:** `docs/superpowers/specs/2026-09-25-dieu-chuyen-design.md`

## Global Constraints

- UI copy is Vietnamese throughout.
- Reuse `window.confirm`/`window.prompt` for approve/reject — no new Modal component.
- `DeviceTransfer.status` is stored as the literal Vietnamese strings `"Chờ duyệt"`/`"Đã duyệt"`/`"Từ chối"` — same convention as `DeviceOrder.status`/`Device.status`.
- Prisma fields camelCase with `@map`; follow `DeviceOrder`/`DeviceOrderItem` exactly, including `@@map` table names.
- Every new endpoint returns through the existing `{ success, data, error, message }` envelope — automatic, do not hand-roll.
- The global `ValidationPipe({ whitelist: true, transform: true })` already enforces class-validator decorators.
- No pagination anywhere in this round.
- `DeviceTransfer` rows are never deleted by application code.
- **Every FK relation to `User` in this round's schema — including the three *required* ones, not just the optional `decidedBy` — must declare `onDelete: Restrict` explicitly.** (Lesson from last round: Prisma's default for an optional relation is `SetNull`, not `Restrict`, and leaving any relation's `onDelete` to infer silently is what caused a real bug there. Being explicit on all four removes the need to reason about Prisma's defaults at all.)
- Create: only `Trưởng phòng` + `departmentCode === 'KYTHUAT'` is WRONG for this round — re-read: **Create: only `Quản trị viên`. Decide (approve/reject): only `Trưởng phòng` + `departmentCode === 'KYTHUAT'`.** This is the reverse of the Cấp phát - Thu hồi round; do not copy that round's guard assignment by pattern-matching alone.
- `jspdf` is already installed (`^4.2.1`) — this round adds zero new dependencies.

## Review Focus

- Two different PENDING transfers that concurrently target the same device, approved at nearly the same moment: the second approval must 400, not silently overwrite the first (same class of race the previous round's Task 3 had to fix mid-review — this plan builds the atomic `updateMany`+`count` guard in from Task 2's first pass, not as a later fix).
- `fromUserId === toUserId` on create must 400 — a "transfer to yourself" is meaningless and was explicitly locked as a reject-at-create-time case, not a silent no-op.
- A device that is NOT currently held by the stated `fromUserId` (wrong holder, or in any status other than `"Đã cấp phát"`) must be rejected at both create time and approve time — re-validate at approve, don't trust what was true at creation.
- `toUserId` soft-deleted after order creation but before approval must 400 at approve time with the same "Người dùng không tồn tại" message `create()` already uses — not just checked once at creation.
- A non-numeric `:id` (e.g. `/device-transfers/abc`) on any route must 404, not 500 — this plan's Task 2 includes this test from the start (last round only added the int32-overflow case initially and had to add the non-numeric case in the final review).

---

## Backend

### Task 1: Prisma schema — `DeviceTransfer` / `DeviceTransferItem`

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma models `DeviceTransfer` (fields: `id, status, fromUserId, toUserId, note, createdById, decidedById, decidedAt, rejectReason, createdAt`, relations `fromUser/toUser/createdBy/decidedBy/items`) and `DeviceTransferItem` (fields: `id, transferId, deviceId`, relations `transfer/device`). Consumed by Task 2.

- [ ] **Step 1: Add the two new models and the back-relations they require**

Open `backend/prisma/schema.prisma`. Add these two models after `DeviceOrderItem` (or wherever the `DeviceOrder`/`DeviceOrderItem` models currently end):

```prisma
// --- DeviceTransfer --------------------------------------------------------
// Đơn Điều chuyển: chuyển thiết bị "Đã cấp phát" thẳng từ người giữ sang người nhận,
// không qua "Trong kho". Không bao giờ bị xoá — là hồ sơ lịch sử.
model DeviceTransfer {
  id           Int       @id @default(autoincrement()) @map("Id")
  status       String    @default("Chờ duyệt") @map("Status") @db.VarChar(20)
  fromUserId   Int       @map("FromUserId")
  toUserId     Int       @map("ToUserId")
  note         String?   @map("Note") @db.VarChar(255)
  createdById  Int       @map("CreatedById")
  decidedById  Int?      @map("DecidedById")
  decidedAt    DateTime? @map("DecidedAt")
  rejectReason String?   @map("RejectReason") @db.VarChar(255)
  createdAt    DateTime  @default(now()) @map("CreatedAt")

  fromUser  User  @relation("DeviceTransferFrom", fields: [fromUserId], references: [id], onDelete: Restrict)
  toUser    User  @relation("DeviceTransferTo", fields: [toUserId], references: [id], onDelete: Restrict)
  createdBy User  @relation("DeviceTransferCreatedBy", fields: [createdById], references: [id], onDelete: Restrict)
  decidedBy User? @relation("DeviceTransferDecidedBy", fields: [decidedById], references: [id], onDelete: Restrict)
  items     DeviceTransferItem[]

  @@map("DeviceTransfer")
}

// --- DeviceTransferItem -----------------------------------------------------
// Từng thiết bị trong 1 lệnh điều chuyển. Cascade khi xoá DeviceTransfer (không xoá Device) —
// DeviceTransfer không bao giờ bị xoá trong luồng bình thường, đây chỉ là an toàn dữ liệu.
model DeviceTransferItem {
  id         Int @id @default(autoincrement()) @map("Id")
  transferId Int @map("TransferId")
  deviceId   Int @map("DeviceId")

  transfer DeviceTransfer @relation(fields: [transferId], references: [id], onDelete: Cascade)
  device   Device         @relation(fields: [deviceId], references: [id])

  @@map("DeviceTransferItem")
}
```

Then update the existing `User` model: add these four lines inside it, next to the existing `deviceOrdersTarget`/`deviceOrdersCreatedBy`/`deviceOrdersDecidedBy` relation lines:

```prisma
  deviceTransfersFrom      DeviceTransfer[] @relation("DeviceTransferFrom")
  deviceTransfersTo        DeviceTransfer[] @relation("DeviceTransferTo")
  deviceTransfersCreatedBy DeviceTransfer[] @relation("DeviceTransferCreatedBy")
  deviceTransfersDecidedBy DeviceTransfer[] @relation("DeviceTransferDecidedBy")
```

And update the existing `Device` model: add this line next to `orderItems DeviceOrderItem[]`:

```prisma
  transferItems DeviceTransferItem[]
```

- [ ] **Step 2: Run the migration against the local database**

Run (from `backend/`):
```
npx prisma migrate dev --name add_device_transfer
```
Expected: a new migration folder under `backend/prisma/migrations/` containing only `CREATE TABLE "DeviceTransfer"` and `CREATE TABLE "DeviceTransferItem"` plus their FKs/indexes — no `ALTER TABLE` on any pre-existing table.

- [ ] **Step 3: Verify every FK to `User` is RESTRICT, not just by inspection**

Open the generated migration SQL file and read every `ADD CONSTRAINT ... FOREIGN KEY` line touching `"User"`. All four (`FromUserId`, `ToUserId`, `CreatedById`, `DecidedById`) must say `ON DELETE RESTRICT`. If any says `ON DELETE SET NULL` or `ON DELETE CASCADE`, the `onDelete: Restrict` on that relation in the schema is missing or misspelled — fix the schema and regenerate the migration (delete the bad migration folder first, then re-run Step 2) rather than hand-editing the generated SQL.

- [ ] **Step 4: `npx prisma validate`**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): thêm bảng DeviceTransfer, DeviceTransferItem cho luồng điều chuyển"
```

---

### Task 2: `device-transfers` module — guards, DTOs, service, controller, fake Prisma, full spec

Core deliverable: the whole `/device-transfers` HTTP surface, tested as one integration spec (same style as `device-orders.spec.ts`).

**Files:**
- Create: `backend/src/shared/auth/transfer-decide.guard.ts`
- Create: `backend/src/shared/auth/transfer-access.guard.ts`
- Create: `backend/src/modules/device-transfers/device-transfer-status.ts`
- Create: `backend/src/modules/device-transfers/device-transfers.dto.ts`
- Create: `backend/src/modules/device-transfers/device-transfers.service.ts`
- Create: `backend/src/modules/device-transfers/device-transfers.controller.ts`
- Create: `backend/src/modules/device-transfers/device-transfers.module.ts`
- Create: `backend/src/modules/device-transfers/device-transfers.spec.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/test/fake-prisma.ts`

**Interfaces:**
- Consumes: `DEVICE_WITH_RELATIONS`, `toDeviceItem` (`backend/src/modules/devices/devices.service.ts`, already exported), `DEVICE_STATUS` (`backend/src/modules/devices/device-status.ts`), `AuthedRequest`/`AuthGuard` (`shared/auth/auth.guard.ts`), `Roles`/`ROLES_KEY` (`shared/auth/roles.decorator.ts`), `ROLE` (`modules/identity/roles.ts`), `TECH_DEPARTMENT_CODE` (`shared/auth/device-write.guard.ts`), `MAX_INT32` (`modules/users/users.dto.ts`), `USER_STATUS` (`modules/identity/user-status.ts`), `ResponseMessage` (`shared/http/api-response.ts`).
- Produces: `POST /device-transfers`, `GET /device-transfers`, `GET /device-transfers/:id`, `PATCH /device-transfers/:id/approve`, `PATCH /device-transfers/:id/reject` — consumed by Task 5 (E2E script) and the whole frontend `transfer` module (Tasks 9–11).

- [ ] **Step 1: Write the full failing spec**

Create `backend/src/modules/device-transfers/device-transfers.spec.ts`:

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
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend && npx jest device-transfers.spec.ts`
Expected: FAIL to boot — module doesn't exist yet.

- [ ] **Step 3: Implement the guards**

Create `backend/src/shared/auth/transfer-decide.guard.ts`:

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
 * Quyền DUYỆT/TỪ CHỐI lệnh điều chuyển: chỉ Trưởng phòng thuộc phòng Kỹ thuật — KHÔNG gồm
 * Quản trị viên (ngược với device-orders: ở đó Admin duyệt). Quản trị viên chỉ tạo lệnh,
 * xem device-transfers.controller.ts.
 */
@Injectable()
export class TransferDecideGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<AuthedRequest>();
    const allowed = user.roleName === ROLE.HEAD && user.departmentCode === TECH_DEPARTMENT_CODE;
    if (!allowed) throw new ForbiddenException(NO_PERMISSION);
    return true;
  }
}
```

Create `backend/src/shared/auth/transfer-access.guard.ts`:

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
 * Quyền XEM lệnh điều chuyển: Quản trị viên, hoặc Trưởng phòng thuộc phòng Kỹ thuật. Cùng điều
 * kiện với OrderAccessGuard (device-orders) nhưng tách guard riêng — khác domain concern, có thể
 * lệch nhau sau này. Phải chạy SAU AuthGuard — nó đọc req.user do AuthGuard gắn vào.
 */
@Injectable()
export class TransferAccessGuard implements CanActivate {
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

- [ ] **Step 4: Add the constants file**

Create `backend/src/modules/device-transfers/device-transfer-status.ts`:

```ts
/** Trạng thái lệnh điều chuyển — cùng 3 giá trị tiếng Việt của DeviceOrder, định nghĩa riêng để
 *  không import chéo module (giống cách DEVICE_STATUS/ORDER_STATUS đã tách nhau). */
export const TRANSFER_STATUS = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
} as const;
```

- [ ] **Step 5: Implement the DTOs**

Create `backend/src/modules/device-transfers/device-transfers.dto.ts`:

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
import { TRANSFER_STATUS } from './device-transfer-status';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ListDeviceTransfersQuery {
  @IsOptional()
  @IsIn(Object.values(TRANSFER_STATUS), { message: 'Trạng thái không hợp lệ' })
  status?: string;
}

export class CreateDeviceTransferDto {
  @Type(() => Number)
  @IsInt({ message: 'Người dùng không hợp lệ' })
  @Min(1, { message: 'Người dùng không hợp lệ' })
  @Max(MAX_INT32, { message: 'Người dùng không hợp lệ' })
  fromUserId!: number;

  @Type(() => Number)
  @IsInt({ message: 'Người dùng không hợp lệ' })
  @Min(1, { message: 'Người dùng không hợp lệ' })
  @Max(MAX_INT32, { message: 'Người dùng không hợp lệ' })
  toUserId!: number;

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

export class RejectDeviceTransferDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập lý do từ chối' })
  @MaxLength(255)
  reason!: string;
}
```

Note: `fromUserId === toUserId` is NOT a class-validator decorator check (cross-field comparison isn't natural in this DTO style elsewhere in the repo) — validate it in the service instead (Step 6).

- [ ] **Step 6: Implement the service**

Create `backend/src/modules/device-transfers/device-transfers.service.ts`:

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { DEVICE_STATUS } from '../devices/device-status';
import { DEVICE_WITH_RELATIONS, toDeviceItem } from '../devices/devices.service';
import { USER_STATUS } from '../identity/user-status';
import { MAX_INT32 } from '../users/users.dto';
import { TRANSFER_STATUS } from './device-transfer-status';
import type { CreateDeviceTransferDto, ListDeviceTransfersQuery } from './device-transfers.dto';

export const TRANSFER_NOT_FOUND = 'Đơn không tồn tại';
const TRANSFER_ALREADY_DECIDED = 'Đơn đã được xử lý';

const WITH_RELATIONS = {
  fromUser: true,
  toUser: true,
  createdBy: true,
  decidedBy: true,
  items: { include: { device: { include: DEVICE_WITH_RELATIONS } } },
} as const;

type TransferWithRelations = Prisma.DeviceTransferGetPayload<{
  include: typeof WITH_RELATIONS;
}>;

function toListItem(t: TransferWithRelations) {
  return {
    id: t.id,
    status: t.status,
    note: t.note,
    rejectReason: t.rejectReason,
    decidedAt: t.decidedAt,
    createdAt: t.createdAt,
    fromUser: { id: t.fromUser.id, fullName: t.fromUser.fullName, username: t.fromUser.username },
    toUser: { id: t.toUser.id, fullName: t.toUser.fullName, username: t.toUser.username },
    createdBy: { id: t.createdBy.id, fullName: t.createdBy.fullName },
    decidedBy: t.decidedBy && { id: t.decidedBy.id, fullName: t.decidedBy.fullName },
    deviceCount: t.items.length,
  };
}

function toDetail(t: TransferWithRelations) {
  return {
    ...toListItem(t),
    items: t.items.map((i) => ({ id: i.id, device: toDeviceItem(i.device) })),
  };
}

@Injectable()
export class DeviceTransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ListDeviceTransfersQuery) {
    const transfers = await this.prisma.deviceTransfer.findMany({
      where: { status: q.status },
      include: WITH_RELATIONS,
      orderBy: { id: 'desc' },
    });
    return transfers.map(toListItem);
  }

  async getById(id: number) {
    const transfer = await this.findTransfer(id);
    return toDetail(transfer);
  }

  async create(dto: CreateDeviceTransferDto, createdById: number) {
    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException('Người nhận phải khác người đang giữ');
    }
    await this.requireUser(dto.fromUserId);
    await this.requireUser(dto.toUserId);
    await this.requireEligibleDevices(dto.deviceIds, dto.fromUserId);

    const transfer = await this.prisma.deviceTransfer.create({
      data: {
        note: dto.note ?? null,
        fromUserId: dto.fromUserId,
        toUserId: dto.toUserId,
        createdById,
        items: { create: dto.deviceIds.map((deviceId) => ({ deviceId })) },
      },
      include: WITH_RELATIONS,
    });
    return toDetail(transfer);
  }

  async approve(id: number, decidedById: number) {
    const transfer = await this.findPendingTransfer(id);
    // Người nhận có thể đã bị xoá mềm SAU khi lệnh được tạo (create() chỉ kiểm tra lúc tạo) —
    // kiểm tra lại ở đây để không duyệt lệnh cho người dùng không còn tồn tại.
    await this.requireUser(transfer.toUserId);
    const deviceIds = transfer.items.map((i) => i.deviceId);
    const devicesById = await this.requireEligibleDevices(deviceIds, transfer.fromUserId);

    await this.prisma.$transaction(async (tx) => {
      const data = {
        currentUserId: transfer.toUserId,
        departmentId: transfer.toUser.departmentId,
        allocatedOn: new Date(),
      };
      // Ghi có điều kiện — where lặp lại đúng điều kiện requireEligibleDevices đã kiểm tra ở
      // trên, ngay trong câu update — chặn trường hợp 2 lệnh cùng nhắm 1 thiết bị được duyệt
      // gần như đồng thời: chỉ lệnh nào ghi Device trước mới còn khớp where khi tới lượt nó;
      // lệnh còn lại count=0 → báo lỗi thay vì âm thầm ghi đè.
      const eligibleWhere = this.eligibleWhere(transfer.fromUserId);
      for (const deviceId of deviceIds) {
        const { count } = await tx.device.updateMany({
          where: { id: deviceId, ...eligibleWhere },
          data,
        });
        if (count === 0) {
          const device = devicesById.get(deviceId)!;
          throw new BadRequestException(this.ineligibleMessage(device.deviceCode));
        }
      }
      await this.decide(tx, id, decidedById, TRANSFER_STATUS.APPROVED);
    });

    return this.getById(id);
  }

  async reject(id: number, decidedById: number, reason: string) {
    await this.findPendingTransfer(id);
    await this.decide(this.prisma, id, decidedById, TRANSFER_STATUS.REJECTED, reason);
    return this.getById(id);
  }

  // --- helpers ---------------------------------------------------------

  /** Ghi có điều kiện status="Chờ duyệt" ngay trong câu update — chặn 2 request duyệt/từ chối
   *  gần như đồng thời cùng lọt qua findPendingTransfer() (đọc-rồi-ghi là 2 câu lệnh riêng,
   *  không atomic). count=0 nghĩa là lệnh đã bị xử lý giữa lúc đọc và lúc ghi. */
  private async decide(
    tx: Pick<PrismaService, 'deviceTransfer'>,
    id: number,
    decidedById: number,
    status: string,
    rejectReason?: string,
  ) {
    const { count } = await tx.deviceTransfer.updateMany({
      where: { id, status: TRANSFER_STATUS.PENDING },
      data: {
        status,
        decidedById,
        decidedAt: new Date(),
        rejectReason: rejectReason ?? null,
      },
    });
    if (count === 0) throw new BadRequestException(TRANSFER_ALREADY_DECIDED);
  }

  /** Trả về map deviceId -> Device đã kiểm tra hợp lệ, để approve() tái dùng deviceCode khi cần
   *  báo lỗi ở bước ghi có điều kiện trong transaction (khỏi truy vấn lại). */
  private async requireEligibleDevices(deviceIds: number[], fromUserId: number) {
    const devices = await this.prisma.device.findMany({ where: { id: { in: deviceIds } } });
    const byId = new Map(devices.map((d) => [d.id, d]));
    for (const id of deviceIds) {
      const device = byId.get(id);
      if (!device) throw new BadRequestException('Thiết bị không tồn tại');
      if (!(device.status === DEVICE_STATUS.ALLOCATED && device.currentUserId === fromUserId)) {
        throw new BadRequestException(this.ineligibleMessage(device.deviceCode));
      }
    }
    return byId;
  }

  /** Where bổ sung để lặp lại đúng điều kiện eligible ngay trong câu ghi Device lúc duyệt. */
  private eligibleWhere(fromUserId: number) {
    return { status: DEVICE_STATUS.ALLOCATED, currentUserId: fromUserId };
  }

  private ineligibleMessage(deviceCode: string): string {
    return `Thiết bị "${deviceCode}" không do người này đang giữ`;
  }

  private async requireUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.status === USER_STATUS.DELETED) {
      throw new BadRequestException('Người dùng không tồn tại');
    }
    return user;
  }

  private async findTransfer(id: number) {
    if (Math.abs(id) > MAX_INT32) throw new NotFoundException(TRANSFER_NOT_FOUND);
    const transfer = await this.prisma.deviceTransfer.findUnique({
      where: { id },
      include: WITH_RELATIONS,
    });
    if (!transfer) throw new NotFoundException(TRANSFER_NOT_FOUND);
    return transfer;
  }

  private async findPendingTransfer(id: number) {
    const transfer = await this.findTransfer(id);
    if (transfer.status !== TRANSFER_STATUS.PENDING) {
      throw new BadRequestException(TRANSFER_ALREADY_DECIDED);
    }
    return transfer;
  }
}
```

- [ ] **Step 7: Implement the controller**

Create `backend/src/modules/device-transfers/device-transfers.controller.ts`:

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
import { Roles } from '../../shared/auth/roles.decorator';
import { TransferAccessGuard } from '../../shared/auth/transfer-access.guard';
import { TransferDecideGuard } from '../../shared/auth/transfer-decide.guard';
import { ResponseMessage } from '../../shared/http/api-response';
import { ROLE } from '../identity/roles';
import {
  CreateDeviceTransferDto,
  ListDeviceTransfersQuery,
  RejectDeviceTransferDto,
} from './device-transfers.dto';
import { DeviceTransfersService, TRANSFER_NOT_FOUND } from './device-transfers.service';

const TransferId = () =>
  Param(
    'id',
    new ParseIntPipe({
      exceptionFactory: () => new NotFoundException(TRANSFER_NOT_FOUND),
    }),
  );

@Controller('device-transfers')
@UseGuards(AuthGuard, TransferAccessGuard)
export class DeviceTransfersController {
  constructor(private readonly transfers: DeviceTransfersService) {}

  @Get()
  list(@Query() query: ListDeviceTransfersQuery) {
    return this.transfers.list(query);
  }

  @Get(':id')
  get(@TransferId() id: number) {
    return this.transfers.getById(id);
  }

  @Post()
  @Roles(ROLE.ADMIN)
  @ResponseMessage('Đã tạo lệnh điều chuyển')
  create(@Body() dto: CreateDeviceTransferDto, @Req() req: AuthedRequest) {
    return this.transfers.create(dto, req.user.id);
  }

  @Patch(':id/approve')
  @UseGuards(TransferDecideGuard)
  @ResponseMessage('Đã duyệt lệnh điều chuyển')
  approve(@TransferId() id: number, @Req() req: AuthedRequest) {
    return this.transfers.approve(id, req.user.id);
  }

  @Patch(':id/reject')
  @UseGuards(TransferDecideGuard)
  @ResponseMessage('Đã từ chối lệnh điều chuyển')
  reject(
    @TransferId() id: number,
    @Body() dto: RejectDeviceTransferDto,
    @Req() req: AuthedRequest,
  ) {
    return this.transfers.reject(id, req.user.id, dto.reason);
  }
}
```

Note the guard placement is the mirror image of `device-orders.controller.ts`: there, `@Roles(ROLE.ADMIN)` guards approve/reject and `OrderCreateGuard` guards create; here, `@Roles(ROLE.ADMIN)` guards create (it's the simple Admin-only case with no department condition) and the new `TransferDecideGuard` guards approve/reject (the department-conditioned case). Double check you have not copied the previous round's assignment by habit.

- [ ] **Step 8: Implement the module and register it**

Create `backend/src/modules/device-transfers/device-transfers.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { DeviceTransfersController } from './device-transfers.controller';
import { DeviceTransfersService } from './device-transfers.service';

@Module({
  controllers: [DeviceTransfersController],
  providers: [DeviceTransfersService],
})
export class DeviceTransfersModule {}
```

In `backend/src/app.module.ts`, add the import:

```ts
import { DeviceTransfersModule } from './modules/device-transfers/device-transfers.module';
```

and add `DeviceTransfersModule,` to the `imports` array, after `DeviceOrdersModule,`.

- [ ] **Step 9: Extend `fake-prisma.ts` with `deviceTransfer`**

In `backend/src/test/fake-prisma.ts`:

Add `DeviceTransfer` and `DeviceTransferItem` to the type import at the top (alongside the existing `DeviceOrder`/`DeviceOrderItem`):

```ts
import type {
  Department,
  Device,
  DeviceAccessory,
  DeviceOrder,
  DeviceOrderItem,
  DeviceTransfer,
  DeviceTransferItem,
  DeviceType,
  PasswordResetToken,
  Role,
  User,
} from '@prisma/client';
```

Add these type declarations near the existing `OrderInclude`/`OrderWithRelations`/`OrderCreateData` types:

```ts
type TransferInclude = {
  fromUser?: boolean;
  toUser?: boolean;
  createdBy?: boolean;
  decidedBy?: boolean;
  items?: { include?: { device?: { include?: DeviceInclude } } };
};
type TransferWithRelations = DeviceTransfer & {
  fromUser?: User;
  toUser?: User;
  createdBy?: User;
  decidedBy?: User | null;
  items?: (DeviceTransferItem & { device?: DeviceWithRelations })[];
};
type TransferItemCreateInput = { deviceId: number };
type TransferCreateData = Pick<
  DeviceTransfer,
  'fromUserId' | 'toUserId' | 'createdById'
> &
  Partial<DeviceTransfer> & { items?: { create: TransferItemCreateInput[] } };
```

Inside `createFakePrisma()`, add storage arrays next to `const deviceOrderItems: DeviceOrderItem[] = [];`:

```ts
  const deviceTransfers: DeviceTransfer[] = [];
  const deviceTransferItems: DeviceTransferItem[] = [];
```

Add the relation-resolving helper next to `withOrderRelations`:

```ts
  const withTransferRelations = (
    t: DeviceTransfer,
    include?: TransferInclude,
  ): TransferWithRelations =>
    include
      ? {
          ...t,
          ...(include.fromUser && { fromUser: users.find((u) => u.id === t.fromUserId)! }),
          ...(include.toUser && { toUser: users.find((u) => u.id === t.toUserId)! }),
          ...(include.createdBy && { createdBy: users.find((u) => u.id === t.createdById)! }),
          ...(include.decidedBy && {
            decidedBy: users.find((u) => u.id === t.decidedById) ?? null,
          }),
          ...(include.items && {
            items: deviceTransferItems
              .filter((i) => i.transferId === t.id)
              .map((i) => ({
                ...i,
                ...(include.items!.include?.device && {
                  device: withDeviceRelations(
                    devices.find((d) => d.id === i.deviceId)!,
                    include.items!.include.device.include,
                  ),
                }),
              })),
          }),
        }
      : t;
```

Add `deviceTransfers` and `deviceTransferItems` to the object returned by `createFakePrisma()`, next to the existing `deviceOrders, deviceOrderItems,` line:

```ts
    deviceOrders,
    deviceOrderItems,
    deviceTransfers,
    deviceTransferItems,
```

Add the `deviceTransfer` and `deviceTransferItem` model stubs, next to the `deviceOrderItem: {...}` block:

```ts
    deviceTransfer: {
      findMany: jest.fn(
        async ({
          where,
          include,
          select,
        }: {
          where?: Where;
          include?: TransferInclude;
          select?: Select;
        }) =>
          deviceTransfers
            .filter((t) => matches(t, where))
            .sort((a, b) => b.id - a.id)
            .map((t) => project(withTransferRelations(t, include), select)),
      ),
      findUnique: jest.fn(
        async ({ where, include }: { where: Where; include?: TransferInclude }) => {
          const hit = deviceTransfers.find((t) => matches(t, where));
          return hit ? withTransferRelations(hit, include) : null;
        },
      ),
      create: jest.fn(
        async ({ data, include }: { data: TransferCreateData; include?: TransferInclude }) => {
          const { items, ...rest } = data;
          const row: DeviceTransfer = {
            id: deviceTransfers.length + 1,
            status: 'Chờ duyệt',
            note: null,
            decidedById: null,
            decidedAt: null,
            rejectReason: null,
            createdAt: new Date(),
            ...rest,
          };
          deviceTransfers.push(row);
          for (const item of items?.create ?? []) {
            deviceTransferItems.push({
              id: deviceTransferItems.length + 1,
              transferId: row.id,
              ...item,
            });
          }
          return withTransferRelations(row, include);
        },
      ),
      updateMany: jest.fn(
        async ({ where, data }: { where: Where; data: Partial<DeviceTransfer> }) => {
          const hit = deviceTransfers.filter((t) => matches(t, where));
          hit.forEach((t) => Object.assign(t, data));
          return { count: hit.length };
        },
      ),
      delete: jest.fn(forbidden),
    },
    // Chỉ /devices/purge dùng — RESTRICT thật trong schema (DeviceTransferItem.deviceId).
    deviceTransferItem: {
      findMany: jest.fn(async ({ where }: { where?: Where }) =>
        deviceTransferItems.filter((i) => matches(i, where)),
      ),
    },
```

- [ ] **Step 10: Run the full spec, fix until green, then run the whole backend suite**

Run: `cd backend && npx jest device-transfers.spec.ts`
Expected: PASS, all cases.

Then run: `cd backend && npm test`
Expected: PASS, every existing spec file (`auth.spec.ts`, `devices.spec.ts`, `users.spec.ts`, `device-orders.spec.ts`, `device-transfers.spec.ts`) green — no regressions.

- [ ] **Step 11: Commit**

```bash
git add backend/src/shared/auth/transfer-decide.guard.ts backend/src/shared/auth/transfer-access.guard.ts backend/src/modules/device-transfers backend/src/app.module.ts backend/src/test/fake-prisma.ts
git commit -m "feat(device-transfers): API tạo/duyệt/từ chối lệnh điều chuyển"
```

---

### Task 3: `/users/purge` must not orphan `DeviceTransfer` history

**Files:**
- Modify: `backend/src/modules/users/users.service.ts`
- Modify: `backend/src/modules/users/users.spec.ts`

**Interfaces:**
- Consumes: `prisma.deviceTransfer.findMany` (Task 2).
- Produces: `UsersService.purge(ids)` now also skips any id still referenced by a `DeviceTransfer` (4 columns), on top of the existing `DeviceOrder` check — no change to its public signature.

- [ ] **Step 1: Write the failing test**

In `backend/src/modules/users/users.spec.ts`, inside `describe('POST /users/purge', ...)`, add this test after the existing `'Admin: bỏ qua id còn bị tham chiếu trong DeviceOrder'` test:

```ts
    it('Admin: bỏ qua id còn bị tham chiếu trong DeviceTransfer', async () => {
      const removed3 = addUser('removed3', 3, USER_STATUS.DELETED);
      prisma.deviceTransfers.push({
        id: 1,
        status: 'Chờ duyệt',
        fromUserId: staff.id,
        toUserId: removed3.id,
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
        .send({ ids: [removed.id, removed3.id] })
        .expect(201);

      expect(res.body.data).toEqual({ count: 1 });
      expect(prisma.users.some((u) => u.id === removed.id)).toBe(false);
      expect(prisma.users.some((u) => u.id === removed3.id)).toBe(true);
    });
```

(The existing `addUser` helper in `users.spec.ts` takes `(username, roleId, status)` — 3 args. Do not change its signature.)

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend && npx jest users.spec.ts -t "bỏ qua id còn bị tham chiếu trong DeviceTransfer"`
Expected: FAIL — `count` is `2` (both purged), because `purge()` doesn't know about `DeviceTransfer` yet.

- [ ] **Step 3: Update `purge()`**

In `backend/src/modules/users/users.service.ts`, replace the `purge` method:

```ts
  /** Dọn thùng rác: xoá cứng — chỉ những id đã ở Status "Đã xóa", id khác bị bỏ qua.
   *  PasswordResetToken.userId là RESTRICT (khác DeviceAccessory là CASCADE của thiết bị)
   *  nên phải xoá token của các user này trước, không thì DB chặn. Device.currentUserId là
   *  SET NULL, không cần dọn tay. DeviceOrder/DeviceTransfer đều RESTRICT nhưng KHÔNG được
   *  dọn theo (đơn/lệnh là hồ sơ lịch sử) — id còn bị đơn/lệnh nào tham chiếu thì bị loại khỏi
   *  danh sách xoá, lặng lẽ như cách id không đủ status="Đã xóa" bị bỏ qua. */
  async purge(ids: number[]): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const referencedOrders = await tx.deviceOrder.findMany({
        where: {
          OR: [
            { targetUserId: { in: ids } },
            { createdById: { in: ids } },
            { decidedById: { in: ids } },
          ],
        },
        select: { targetUserId: true, createdById: true, decidedById: true },
      });
      const referencedTransfers = await tx.deviceTransfer.findMany({
        where: {
          OR: [
            { fromUserId: { in: ids } },
            { toUserId: { in: ids } },
            { createdById: { in: ids } },
            { decidedById: { in: ids } },
          ],
        },
        select: { fromUserId: true, toUserId: true, createdById: true, decidedById: true },
      });
      const blocked = new Set<number>();
      for (const o of referencedOrders) {
        blocked.add(o.targetUserId);
        blocked.add(o.createdById);
        if (o.decidedById !== null) blocked.add(o.decidedById);
      }
      for (const t of referencedTransfers) {
        blocked.add(t.fromUserId);
        blocked.add(t.toUserId);
        blocked.add(t.createdById);
        if (t.decidedById !== null) blocked.add(t.decidedById);
      }
      const purgeable = ids.filter((id) => !blocked.has(id));

      await tx.passwordResetToken.deleteMany({
        where: { userId: { in: purgeable } },
      });
      const { count } = await tx.user.deleteMany({
        where: { id: { in: purgeable }, status: USER_STATUS.DELETED },
      });
      return count;
    });
  }
```

- [ ] **Step 4: Run it, confirm it passes, then run the whole backend suite**

Run: `cd backend && npx jest users.spec.ts`
Expected: PASS, all cases including the pre-existing `DeviceOrder` one.

Run: `cd backend && npm test`
Expected: PASS, everything green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/users/users.service.ts backend/src/modules/users/users.spec.ts
git commit -m "fix(users): purge bỏ qua user còn bị DeviceTransfer tham chiếu"
```

---

### Task 4: `/devices/purge` must not orphan `DeviceTransferItem` history

**Files:**
- Modify: `backend/src/modules/devices/devices.service.ts`
- Modify: `backend/src/modules/devices/devices.spec.ts`

**Interfaces:**
- Consumes: `prisma.deviceTransferItem.findMany` (Task 2).
- Produces: `DevicesService.purge(ids)` now also skips any id still referenced by a `DeviceTransferItem`, on top of the existing `DeviceOrderItem` check.

- [ ] **Step 1: Write the failing test**

In `backend/src/modules/devices/devices.spec.ts`, add this test after the existing `'POST /devices/purge: bỏ qua id còn bị tham chiếu trong DeviceOrderItem'` test:

```ts
  it('POST /devices/purge: bỏ qua id còn bị tham chiếu trong DeviceTransferItem', async () => {
    const referenced = await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice({ deviceCode: 'LT-000003' }))
      .expect(201);
    const referencedId = referenced.body.data.id;
    await http()
      .delete(`/devices/${referencedId}`)
      .set('Authorization', tokenOf(admin))
      .expect(200);
    prisma.deviceTransfers.push({
      id: 1,
      status: 'Đã duyệt',
      fromUserId: staff.id,
      toUserId: admin.id,
      note: null,
      createdById: admin.id,
      decidedById: admin.id,
      decidedAt: new Date(),
      rejectReason: null,
      createdAt: new Date(),
    });
    prisma.deviceTransferItems.push({ id: 1, transferId: 1, deviceId: referencedId });

    const unreferenced = await http()
      .post('/devices')
      .set('Authorization', tokenOf(admin))
      .send(newDevice({ deviceCode: 'LT-000004' }))
      .expect(201);
    const unreferencedId = unreferenced.body.data.id;
    await http()
      .delete(`/devices/${unreferencedId}`)
      .set('Authorization', tokenOf(admin))
      .expect(200);

    const res = await http()
      .post('/devices/purge')
      .set('Authorization', tokenOf(admin))
      .send({ ids: [referencedId, unreferencedId] })
      .expect(201);

    expect(res.body.data.count).toBe(1);
    expect(prisma.devices.some((d) => d.id === referencedId)).toBe(true);
    expect(prisma.devices.some((d) => d.id === unreferencedId)).toBe(false);
  });
```

(Check the `staff` fixture exists in this file's `beforeEach` under that exact name — `devices.spec.ts` already sets up `admin`/`staff` users per its own established pattern; reuse them, don't create new ones.)

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd backend && npx jest devices.spec.ts -t "bỏ qua id còn bị tham chiếu trong DeviceTransferItem"`
Expected: FAIL — `count` is `2`.

- [ ] **Step 3: Update `purge()`**

In `backend/src/modules/devices/devices.service.ts`, replace the `purge` method:

```ts
  /** Dọn thùng rác: xoá cứng — chỉ những id đã ở Status "Đã xóa", id khác bị bỏ qua. */
  async purge(ids: number[]): Promise<number> {
    // DeviceOrderItem.deviceId và DeviceTransferItem.deviceId đều FK RESTRICT — thiết bị từng
    // nằm trong bất kỳ đơn/lệnh nào (đã duyệt/từ chối/còn chờ) không thể xoá cứng. Bỏ qua các
    // id đó, giống cách users.service.ts đã làm với DeviceOrder/DeviceTransfer cho /users/purge.
    const [referencedByOrders, referencedByTransfers] = await Promise.all([
      this.prisma.deviceOrderItem.findMany({
        where: { deviceId: { in: ids } },
        select: { deviceId: true },
      }),
      this.prisma.deviceTransferItem.findMany({
        where: { deviceId: { in: ids } },
        select: { deviceId: true },
      }),
    ]);
    const blocked = new Set([
      ...referencedByOrders.map((i) => i.deviceId),
      ...referencedByTransfers.map((i) => i.deviceId),
    ]);
    const purgeable = ids.filter((id) => !blocked.has(id));

    const { count } = await this.prisma.device.deleteMany({
      where: { id: { in: purgeable }, status: DEVICE_STATUS.DELETED },
    });
    return count;
  }
```

- [ ] **Step 4: Run it, confirm it passes, then run the whole backend suite**

Run: `cd backend && npx jest devices.spec.ts`
Expected: PASS, all cases including the pre-existing `DeviceOrderItem` one.

Run: `cd backend && npm test`
Expected: PASS, everything green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/devices/devices.service.ts backend/src/modules/devices/devices.spec.ts
git commit -m "fix(devices): purge bỏ qua thiết bị còn bị DeviceTransferItem tham chiếu"
```

---

### Task 5: E2E script against the real database

**Files:**
- Create: `backend/scripts/e2e-device-transfers.ps1`

**Interfaces:**
- Consumes: `/device-transfers*` (Task 2), same `Api`/`ExpectStatus`/`Psql` helper pattern as `backend/scripts/e2e-device-orders.ps1`.

- [ ] **Step 1: Write the script**

Create `backend/scripts/e2e-device-transfers.ps1` — copy the header/params/`Api`/`ExpectStatus`/`Psql`/`Suffix6` boilerplate verbatim from `backend/scripts/e2e-device-orders.ps1` (same `param()` block, same helper functions, same Step 0 backend-alive check, same ASCII-only `Write-Host` labels with UTF-8-with-BOM file encoding), then replace everything from `Step "1. ..."` onward with:

```powershell
Step "1. Dang nhap admin, tao Truong phong Ky thuat va 2 nguoi dung"
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

$staffAUname = "e2estaffa$stamp"
$staffAPass = 'E2e@1234'
$staffA = (Api -Method Post -Path '/users' -Token $adminToken -Body @{
  username = $staffAUname; email = "$staffAUname@e2e.local"; fullName = 'Nhan vien A giu thiet bi E2E'
  password = $staffAPass; roleId = 3; departmentId = 1
}).data
if ($staffA.id) { Ok "$staffAUname tao duoc (id=$($staffA.id))" } else { Fail "khong tao duoc $staffAUname"; exit 1 }

$staffBUname = "e2estaffb$stamp"
$staffBPass = 'E2e@1234'
$staffB = (Api -Method Post -Path '/users' -Token $adminToken -Body @{
  username = $staffBUname; email = "$staffBUname@e2e.local"; fullName = 'Nhan vien B nhan thiet bi E2E'
  password = $staffBPass; roleId = 3; departmentId = 2
}).data
if ($staffB.id) { Ok "$staffBUname tao duoc (id=$($staffB.id))" } else { Fail "khong tao duoc $staffBUname"; exit 1 }

Step "2. Tao thiet bi va cap phat truc tiep cho staffA (qua PATCH, khong qua don Cap phat)"
$types = (Api -Method Get -Path '/device-types' -Token $adminToken).data
$laptop = $types | Where-Object { $_.prefix -eq 'LT' } | Select-Object -First 1
$device = (Api -Method Post -Path '/devices' -Token $adminToken -Body @{
  deviceCode = "LT-$(Suffix6 0)"; deviceName = "Laptop E2E dieu chuyen $stamp"
  specDetail = 'Core i5, 16GB'; unit = 'Cai'; deviceTypeId = $laptop.id
  currentUserId = $staffA.id
}).data
$deviceId = $device.id
if ($deviceId -and $device.status -eq 'Đã cấp phát' -and $device.currentUser.id -eq $staffA.id) {
  Ok "tao thiet bi id=$deviceId, da cap phat cho staffA"
} else { Fail "tao/cap phat thiet bi that bai"; exit 1 }

Step "3. Tao va duyet lenh dieu chuyen staffA -> staffB"
$transfer = (Api -Method Post -Path '/device-transfers' -Token $adminToken -Body @{
  fromUserId = $staffA.id; toUserId = $staffB.id; deviceIds = @($deviceId)
}).data
if ($transfer.id -and $transfer.status -eq 'Chờ duyệt') { Ok "tao lenh dieu chuyen id=$($transfer.id)" }
else { Fail "tao lenh dieu chuyen that bai"; exit 1 }

Api -Method Patch -Path "/device-transfers/$($transfer.id)/approve" -Token $techToken | Out-Null
$afterTransfer = (Api -Method Get -Path "/devices/$deviceId" -Token $adminToken).data
if ($afterTransfer.status -eq 'Đã cấp phát' -and $afterTransfer.currentUser.id -eq $staffB.id) {
  Ok "duyet xong: currentUser chuyen sang staffB, status van la 'Đã cấp phát'"
} else {
  Fail "duyet lenh khong chuyen dung chu hoac doi status sai: status='$($afterTransfer.status)', currentUser=$($afterTransfer.currentUser.id)"
}
$dbCurrentUserId = Psql "SELECT ""CurrentUserId"" FROM ""Device"" WHERE ""Id"" = $deviceId;"
if ($dbCurrentUserId -eq "$($staffB.id)") { Ok "DB xac nhan CurrentUserId=$($staffB.id)" }
else { Fail "DB CurrentUserId='$dbCurrentUserId', mong $($staffB.id)" }

Step "4. Tao lenh roi tu choi"
$device2 = (Api -Method Post -Path '/devices' -Token $adminToken -Body @{
  deviceCode = "LT-$(Suffix6 1)"; deviceName = "Laptop E2E tu choi dieu chuyen $stamp"
  specDetail = 'Core i5, 16GB'; unit = 'Cai'; deviceTypeId = $laptop.id
  currentUserId = $staffA.id
}).data
$rejectTransfer = (Api -Method Post -Path '/device-transfers' -Token $adminToken -Body @{
  fromUserId = $staffA.id; toUserId = $staffB.id; deviceIds = @($device2.id)
}).data
Api -Method Patch -Path "/device-transfers/$($rejectTransfer.id)/reject" -Token $techToken -Body @{ reason = 'E2E tu choi dieu chuyen' } | Out-Null
$afterReject = (Api -Method Get -Path "/devices/$($device2.id)" -Token $adminToken).data
if ($afterReject.currentUser.id -eq $staffA.id) { Ok "tu choi lenh: thiet bi van do staffA giu" }
else { Fail "tu choi lenh nhung currentUser da doi: $($afterReject.currentUser.id)" }

Step "5. Nhan vien khong xem duoc danh sach lenh"
$staffAToken = (Api -Method Post -Path '/auth/login' -Body @{ identifier = $staffAUname; password = $staffAPass }).data.accessToken
ExpectStatus -Method Get -Path '/device-transfers' -Token $staffAToken -Expected 403 -Label "Nhan vien GET /device-transfers"

Step "6. Admin khong duoc duyet lenh (chi Truong phong Ky thuat)"
$device3 = (Api -Method Post -Path '/devices' -Token $adminToken -Body @{
  deviceCode = "LT-$(Suffix6 2)"; deviceName = "Laptop E2E admin khong duyet duoc $stamp"
  specDetail = 'Core i5, 16GB'; unit = 'Cai'; deviceTypeId = $laptop.id
  currentUserId = $staffA.id
}).data
$transfer3 = (Api -Method Post -Path '/device-transfers' -Token $adminToken -Body @{
  fromUserId = $staffA.id; toUserId = $staffB.id; deviceIds = @($device3.id)
}).data
ExpectStatus -Method Patch -Path "/device-transfers/$($transfer3.id)/approve" -Token $adminToken -Expected 403 -Label "Admin PATCH approve"

Write-Host ""
if ($script:Failed -eq 0) {
  Write-Host "TAT CA BUOC E2E DIEU CHUYEN THIET BI DEU XANH" -ForegroundColor Green
  exit 0
} else {
  Write-Host "$($script:Failed) BUOC HONG" -ForegroundColor Red
  exit 1
}
```

- [ ] **Step 2: Save with BOM and run it**

Verify the file was saved as UTF-8 with BOM. With the backend running (`cd backend && npm run start:dev`) and the local PostgreSQL up, run:
```
powershell -ExecutionPolicy Bypass -File backend/scripts/e2e-device-transfers.ps1
```
Expected: `TAT CA BUOC E2E DIEU CHUYEN THIET BI DEU XANH`, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/e2e-device-transfers.ps1
git commit -m "test(device-transfers): script E2E dieu chuyen thiet bi tren PostgreSQL that"
```

---

## Frontend

### Task 6: `session.ts` — transfer permission helpers

**Files:**
- Modify: `frontend/src/modules/auth/domain/session.ts`
- Modify: `frontend/src/modules/auth/domain/session.test.ts`

**Interfaces:**
- Produces: `canAccessTransfers`, `canCreateTransfer`, `canDecideTransfer` (all `(session: AuthSession | null) => boolean`) — consumed by Tasks 10, 11, 13.

- [ ] **Step 1: Write the failing tests**

In `frontend/src/modules/auth/domain/session.test.ts`, add these after the existing `canDecideOrder` tests, and add `canAccessTransfers, canCreateTransfer, canDecideTransfer` to the existing import line from `./session`:

```ts
it('canAccessTransfers: Admin hoặc Trưởng phòng Kỹ thuật', () => {
  expect(canAccessTransfers({ ...base, roleName: 'Quản trị viên', departmentCode: null })).toBe(true);
  expect(canAccessTransfers({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KYTHUAT' })).toBe(true);
  expect(canAccessTransfers({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KETOAN' })).toBe(false);
  expect(canAccessTransfers(base)).toBe(false);
});
it('canCreateTransfer: CHỈ Admin, không gồm Trưởng phòng Kỹ thuật', () => {
  expect(canCreateTransfer({ ...base, roleName: 'Quản trị viên', departmentCode: null })).toBe(true);
  expect(canCreateTransfer({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KYTHUAT' })).toBe(false);
});
it('canDecideTransfer: CHỈ Trưởng phòng Kỹ thuật, không gồm Admin', () => {
  expect(canDecideTransfer({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KYTHUAT' })).toBe(true);
  expect(canDecideTransfer({ ...base, roleName: 'Quản trị viên', departmentCode: null })).toBe(false);
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd frontend && npx vitest run session.test.ts`
Expected: FAIL — the three new functions aren't exported yet.

- [ ] **Step 3: Implement**

In `frontend/src/modules/auth/domain/session.ts`, add these three lines after the existing `canDecideOrder` export:

```ts
/** Xem lệnh Điều chuyển: Quản trị viên hoặc Trưởng phòng Kỹ thuật. */
export const canAccessTransfers = (session: AuthSession | null): boolean =>
  isAdmin(session) || isTechHead(session);

/** Tạo lệnh điều chuyển: CHỈ Quản trị viên — ngược với canCreateOrder. */
export const canCreateTransfer = (session: AuthSession | null): boolean => isAdmin(session);

/** Duyệt/từ chối lệnh điều chuyển: CHỈ Trưởng phòng Kỹ thuật — ngược với canDecideOrder. */
export const canDecideTransfer = (session: AuthSession | null): boolean => isTechHead(session);
```

- [ ] **Step 4: Run it, confirm it passes**

Run: `cd frontend && npx vitest run session.test.ts`
Expected: PASS, all cases including the pre-existing order ones (unchanged).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/auth/domain/session.ts frontend/src/modules/auth/domain/session.test.ts
git commit -m "feat(auth): thêm canAccessTransfers/canCreateTransfer/canDecideTransfer"
```

---

### Task 7: Relocate the shared PDF font — dùng chung, không nhúng lại

**Files:**
- Move: `frontend/src/modules/allocation/presentation/print/DejaVuSansBase64.ts` → `frontend/src/shared/print/DejaVuSansBase64.ts`
- Modify: `frontend/src/modules/allocation/presentation/print/generateBienBan.ts`

**Interfaces:**
- Produces: `DEJAVU_SANS_BASE64` now importable from `@/shared/print/DejaVuSansBase64` — consumed by Task 12 (`transfer` module's own `generateBienBan.ts`), and still by `allocation`'s own `generateBienBan.ts` via the new path.

This is a pure mechanical relocation — no behavior change. Verified by the existing `allocation` PDF test staying green.

- [ ] **Step 1: Move the file**

Move `frontend/src/modules/allocation/presentation/print/DejaVuSansBase64.ts` to `frontend/src/shared/print/DejaVuSansBase64.ts` (same file content, unchanged — this is a ~1MB generated file, do not retype or regenerate it, just relocate it).

- [ ] **Step 2: Update the import in `generateBienBan.ts`**

In `frontend/src/modules/allocation/presentation/print/generateBienBan.ts`, change:

```ts
import { DEJAVU_SANS_BASE64 } from './DejaVuSansBase64';
```

to:

```ts
import { DEJAVU_SANS_BASE64 } from '@/shared/print/DejaVuSansBase64';
```

No other line in this file changes.

- [ ] **Step 3: Run `allocation`'s existing PDF test and the whole frontend suite to confirm nothing broke**

Run: `cd frontend && npx vitest run generateBienBan.test.ts`
Expected: PASS, all 4 existing cases (unchanged — this test only exercises `buildBienBanContent`, which this task didn't touch; it's here to confirm the import path change didn't break the module's load).

Run: `cd frontend && npm test`
Expected: PASS, all files.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/shared/print/DejaVuSansBase64.ts frontend/src/modules/allocation/presentation/print/DejaVuSansBase64.ts frontend/src/modules/allocation/presentation/print/generateBienBan.ts
git commit -m "refactor(print): dời font DejaVu Sans sang shared/print để module transfer dùng chung"
```

(The `git add` includes both the new path and the old path's removal — a `git mv` followed by `git add` on both paths stages the rename correctly; if your tool created the file fresh at the new path and deleted the old one via separate operations, `git add -A -- frontend/src/shared/print frontend/src/modules/allocation/presentation/print` covers both.)

---

### Task 8: `transfer` module — domain layer

**Files:**
- Create: `frontend/src/modules/transfer/domain/deviceTransfer.ts`
- Create: `frontend/src/modules/transfer/domain/validateTransferDraft.ts`
- Create: `frontend/src/modules/transfer/domain/validateTransferDraft.test.ts`

**Interfaces:**
- Produces: `TRANSFER_STATUS`, type `TransferStatus`, `UserRef`, `DeviceTransfer`, `DeviceTransferDetail`, `TransferDraft`, `emptyTransferDraft()`, `validateTransferDraft()`, `hasErrors()` — consumed by Tasks 9, 10, 11, 12.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/transfer/domain/validateTransferDraft.test.ts`:

```ts
import { expect, it } from 'vitest';
import { emptyTransferDraft, hasErrors, validateTransferDraft } from './validateTransferDraft';

it('trống hoàn toàn: thiếu cả 3 trường bắt buộc', () => {
  const errors = validateTransferDraft(emptyTransferDraft());
  expect(errors.fromUserId).toBeDefined();
  expect(errors.toUserId).toBeDefined();
  expect(errors.deviceIds).toBeDefined();
});

it('đủ 3 trường, fromUserId khác toUserId: không lỗi', () => {
  const errors = validateTransferDraft({ fromUserId: 1, toUserId: 2, deviceIds: [1], note: '' });
  expect(hasErrors(errors)).toBe(false);
});

it('fromUserId === toUserId: báo lỗi toUserId', () => {
  const errors = validateTransferDraft({ fromUserId: 1, toUserId: 1, deviceIds: [1], note: '' });
  expect(hasErrors(errors)).toBe(true);
  expect(errors.toUserId).toBeDefined();
});

it('thiếu deviceIds: chỉ báo lỗi deviceIds', () => {
  const errors = validateTransferDraft({ fromUserId: 1, toUserId: 2, deviceIds: [], note: '' });
  expect(hasErrors(errors)).toBe(true);
  expect(errors.deviceIds).toBeDefined();
  expect(errors.fromUserId).toBeUndefined();
  expect(errors.toUserId).toBeUndefined();
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd frontend && npx vitest run validateTransferDraft.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the domain types**

Create `frontend/src/modules/transfer/domain/deviceTransfer.ts`:

```ts
import type { Device } from '@/modules/device/domain/device';

export const TRANSFER_STATUS = { PENDING: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Từ chối' } as const;
export type TransferStatus = (typeof TRANSFER_STATUS)[keyof typeof TRANSFER_STATUS];

export interface UserRef {
  id: number;
  fullName: string;
  username: string;
}

export interface DeviceTransfer {
  id: number;
  status: TransferStatus;
  note: string | null;
  rejectReason: string | null;
  decidedAt: string | null;
  createdAt: string;
  fromUser: UserRef;
  toUser: UserRef;
  createdBy: { id: number; fullName: string };
  decidedBy: { id: number; fullName: string } | null;
  deviceCount: number;
}

export interface DeviceTransferDetail extends DeviceTransfer {
  items: { id: number; device: Device }[];
}
```

- [ ] **Step 4: Implement the draft + validator**

Create `frontend/src/modules/transfer/domain/validateTransferDraft.ts`:

```ts
export interface TransferDraft {
  fromUserId: number | null;
  toUserId: number | null;
  deviceIds: number[];
  note: string;
}

export function emptyTransferDraft(): TransferDraft {
  return { fromUserId: null, toUserId: null, deviceIds: [], note: '' };
}

export type TransferDraftErrors = Partial<Record<'fromUserId' | 'toUserId' | 'deviceIds', string>>;

const REQUIRED = 'Bắt buộc';

export function validateTransferDraft(d: TransferDraft): TransferDraftErrors {
  const errors: TransferDraftErrors = {};
  if (d.fromUserId === null) errors.fromUserId = REQUIRED;
  if (d.toUserId === null) errors.toUserId = REQUIRED;
  else if (d.fromUserId !== null && d.toUserId === d.fromUserId) {
    errors.toUserId = 'Người nhận phải khác người đang giữ';
  }
  if (d.deviceIds.length === 0) errors.deviceIds = 'Vui lòng chọn ít nhất 1 thiết bị';
  return errors;
}

export function hasErrors(errors: TransferDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}
```

- [ ] **Step 5: Run it, confirm it passes**

Run: `cd frontend && npx vitest run validateTransferDraft.test.ts`
Expected: PASS, all 4 cases.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/transfer/domain
git commit -m "feat(transfer): domain layer — kiểu DeviceTransfer và validate draft"
```

---

### Task 9: `transfer` module — application + infrastructure

**Files:**
- Create: `frontend/src/modules/transfer/application/DeviceTransferRepository.ts`
- Create: `frontend/src/modules/transfer/infrastructure/HttpDeviceTransferRepository.ts`
- Create: `frontend/src/modules/transfer/infrastructure/HttpDeviceTransferRepository.test.ts`
- Create: `frontend/src/modules/transfer/infrastructure/container.ts`

**Interfaces:**
- Consumes: `apiGet/apiPatch/apiPost` (`@/shared/lib/apiClient`), `TransferDraft`/`DeviceTransfer`/`DeviceTransferDetail`/`UserRef` (Task 8).
- Produces: `deviceTransferService` (list/get/create/approve/reject/users), `TransferValidationError` — consumed by Tasks 10, 11.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/modules/transfer/infrastructure/HttpDeviceTransferRepository.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyTransferDraft, type TransferDraft } from '../domain/validateTransferDraft';
import { HttpDeviceTransferRepository } from './HttpDeviceTransferRepository';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, error: null, message: 'OK' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const sentBody = (fetchMock: ReturnType<typeof vi.fn>) =>
  JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);

const draft = (over: Partial<TransferDraft> = {}): TransferDraft => ({
  ...emptyTransferDraft(),
  fromUserId: 5,
  toUserId: 7,
  deviceIds: [1, 2],
  ...over,
});

describe('HttpDeviceTransferRepository', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation(async () => envelope({ id: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
  });

  it('create: gửi fromUserId/toUserId/deviceIds, bỏ note rỗng', async () => {
    await new HttpDeviceTransferRepository().create(draft());
    expect(sentBody(fetchMock)).toEqual({ fromUserId: 5, toUserId: 7, deviceIds: [1, 2] });
  });

  it('create: giữ note khi có nội dung', async () => {
    await new HttpDeviceTransferRepository().create(draft({ note: '  Gấp  ' }));
    expect(sentBody(fetchMock).note).toBe('Gấp');
  });

  it('approve: gọi PATCH /device-transfers/:id/approve, không gửi body', async () => {
    await new HttpDeviceTransferRepository().approve(5);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/device-transfers/5/approve');
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBeUndefined();
  });

  it('reject: gửi reason', async () => {
    await new HttpDeviceTransferRepository().reject(5, 'Không đủ điều kiện');
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/device-transfers/5/reject');
    expect(sentBody(fetchMock)).toEqual({ reason: 'Không đủ điều kiện' });
  });

  it('list: gọi GET /device-transfers với query status', async () => {
    fetchMock.mockImplementation(async () => envelope([]));
    await new HttpDeviceTransferRepository().list({ status: 'Chờ duyệt' });
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/device-transfers');
    expect(url.searchParams.get('status')).toBe('Chờ duyệt');
  });

  it('users: gọi GET /users/lookup', async () => {
    fetchMock.mockImplementation(async () => envelope([]));
    await new HttpDeviceTransferRepository().users();
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/users/lookup');
  });
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd frontend && npx vitest run HttpDeviceTransferRepository.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the application layer**

Create `frontend/src/modules/transfer/application/DeviceTransferRepository.ts`:

```ts
import { hasErrors, validateTransferDraft, type TransferDraft } from '../domain/validateTransferDraft';
import type { DeviceTransfer, DeviceTransferDetail, UserRef } from '../domain/deviceTransfer';

export interface DeviceTransferQuery {
  status?: string;
}

export interface DeviceTransferRepository {
  list(query?: DeviceTransferQuery): Promise<DeviceTransfer[]>;
  getById(id: number): Promise<DeviceTransferDetail>;
  create(draft: TransferDraft): Promise<DeviceTransferDetail>;
  approve(id: number): Promise<DeviceTransferDetail>;
  reject(id: number, reason: string): Promise<DeviceTransferDetail>;
  /** Danh sách rút gọn cho dropdown người giao/người nhận — cùng /users/lookup module device dùng. */
  users(): Promise<UserRef[]>;
}

export class TransferValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super('Biểu mẫu chưa hợp lệ');
    this.name = 'TransferValidationError';
  }
}

function assertValid(draft: TransferDraft) {
  const errors = validateTransferDraft(draft);
  if (hasErrors(errors)) throw new TransferValidationError(errors as Record<string, string>);
}

export function makeDeviceTransferService(repo: DeviceTransferRepository) {
  return {
    list: (query?: DeviceTransferQuery) => repo.list(query),
    get: (id: number) => repo.getById(id),
    create: (draft: TransferDraft) => {
      assertValid(draft);
      return repo.create(draft);
    },
    approve: (id: number) => repo.approve(id),
    reject: (id: number, reason: string) => repo.reject(id, reason),
    users: () => repo.users(),
  };
}

export type DeviceTransferService = ReturnType<typeof makeDeviceTransferService>;
```

- [ ] **Step 4: Implement the HTTP adapter**

Create `frontend/src/modules/transfer/infrastructure/HttpDeviceTransferRepository.ts`:

```ts
import { apiGet, apiPatch, apiPost } from '@/shared/lib/apiClient';
import type { DeviceTransfer, DeviceTransferDetail, UserRef } from '../domain/deviceTransfer';
import type { TransferDraft } from '../domain/validateTransferDraft';
import type { DeviceTransferQuery, DeviceTransferRepository } from '../application/DeviceTransferRepository';

function toBody(d: TransferDraft) {
  return {
    fromUserId: d.fromUserId ?? undefined,
    toUserId: d.toUserId ?? undefined,
    note: d.note.trim() ? d.note.trim() : undefined,
    deviceIds: d.deviceIds,
  };
}

/** Adapter gọi module `device-transfers` của backend (backend/src/modules/device-transfers). */
export class HttpDeviceTransferRepository implements DeviceTransferRepository {
  list(query: DeviceTransferQuery = {}): Promise<DeviceTransfer[]> {
    return apiGet<DeviceTransfer[]>(
      '/device-transfers',
      query as Record<string, string | number | undefined>,
    );
  }
  getById(id: number): Promise<DeviceTransferDetail> {
    return apiGet<DeviceTransferDetail>(`/device-transfers/${id}`);
  }
  create(draft: TransferDraft): Promise<DeviceTransferDetail> {
    return apiPost<DeviceTransferDetail>('/device-transfers', toBody(draft));
  }
  approve(id: number): Promise<DeviceTransferDetail> {
    return apiPatch<DeviceTransferDetail>(`/device-transfers/${id}/approve`, undefined);
  }
  reject(id: number, reason: string): Promise<DeviceTransferDetail> {
    return apiPatch<DeviceTransferDetail>(`/device-transfers/${id}/reject`, { reason });
  }
  users(): Promise<UserRef[]> {
    return apiGet<UserRef[]>('/users/lookup');
  }
}
```

Create `frontend/src/modules/transfer/infrastructure/container.ts`:

```ts
import { makeDeviceTransferService } from '../application/DeviceTransferRepository';
import { HttpDeviceTransferRepository } from './HttpDeviceTransferRepository';

export const deviceTransferService = makeDeviceTransferService(new HttpDeviceTransferRepository());
```

- [ ] **Step 5: Run it, confirm it passes**

Run: `cd frontend && npx vitest run HttpDeviceTransferRepository.test.ts`
Expected: PASS, all 6 cases.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/transfer/application frontend/src/modules/transfer/infrastructure
git commit -m "feat(transfer): application + infrastructure — HttpDeviceTransferRepository"
```

---

### Task 10: `DeviceTransferListPage` — list, filter, Duyệt/Từ chối

**Files:**
- Create: `frontend/src/modules/transfer/presentation/useDeviceTransfers.ts`
- Create: `frontend/src/modules/transfer/presentation/transferStatusTone.ts`
- Create: `frontend/src/modules/transfer/presentation/DeviceTransferListPage.tsx`
- Create: `frontend/src/modules/transfer/presentation/DeviceTransferListPage.test.tsx`
- Create: `frontend/src/modules/transfer/presentation/print/generateBienBan.ts` (placeholder — Task 12 replaces it)

**Interfaces:**
- Consumes: `deviceTransferService` (Task 9), `canCreateTransfer`/`canDecideTransfer` (Task 6), shared UI (`PageHeader`, `Button`, `Card`, `Badge`, `DataTable`, `Select`, `useAsyncAction`, `useAsyncData`).
- Produces: `<DeviceTransferListPage />` — consumed by Task 13 (router).

Same deliberate scaffold-then-replace as the `allocation` module's Task 9 did: this task creates a minimal placeholder `print/generateBienBan.ts` (`downloadBienBan` throws) purely so this page compiles and its own tests (which never click "In biên bản") stay green; Task 12 replaces that file's contents entirely.

- [ ] **Step 1: Create the placeholder print module**

Create `frontend/src/modules/transfer/presentation/print/generateBienBan.ts`:

```ts
import type { DeviceTransferDetail } from '../../domain/deviceTransfer';

// ponytail: implementation thật (jsPDF, font dùng chung từ shared/print) nằm ở Task 12 của plan
// này — đây chỉ là chữ ký hàm để biên dịch được.
export function downloadBienBan(_transfer: DeviceTransferDetail): void {
  throw new Error('Chưa triển khai — xem Task 12');
}
```

- [ ] **Step 2: Write the failing test**

Create `frontend/src/modules/transfer/presentation/DeviceTransferListPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '@/app/session/SessionContext';
import { fakeJwt, inOneHour } from '@/test/fakeJwt';
import { DeviceTransferListPage } from './DeviceTransferListPage';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const transfer = (id: number, status = 'Chờ duyệt') => ({
  id,
  status,
  note: null,
  rejectReason: null,
  decidedAt: null,
  createdAt: '2026-09-25T00:00:00.000Z',
  fromUser: { id: 5, fullName: 'Nhân viên A', username: 'a' },
  toUser: { id: 6, fullName: 'Nhân viên B', username: 'b' },
  createdBy: { id: 1, fullName: 'Quản trị viên' },
  decidedBy: null,
  deviceCount: 1,
});

const envelope = (data: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify({ success: true, data, error: null, message: 'OK' }), { status: 200 }),
  );

function renderPage(roleName: string, departmentCode: string | null, transfers = [transfer(1)]) {
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
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => envelope(transfers)));
  render(
    <SessionProvider>
      <MemoryRouter>
        <DeviceTransferListPage />
      </MemoryRouter>
    </SessionProvider>,
  );
}

it('Admin: thấy nút "Tạo lệnh", không thấy Duyệt/Từ chối', async () => {
  renderPage('Quản trị viên', null);
  await waitFor(() => expect(screen.getByText('Nhân viên A')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Tạo lệnh' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
});

it('Trưởng phòng Kỹ thuật: thấy Duyệt/Từ chối trên lệnh Chờ duyệt, không thấy "Tạo lệnh"', async () => {
  renderPage('Trưởng phòng', 'KYTHUAT');
  await waitFor(() => expect(screen.getByText('Nhân viên A')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Tạo lệnh' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Duyệt' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Từ chối' })).toBeInTheDocument();
});

it('Trưởng phòng Kỹ thuật: lệnh "Đã duyệt" hiện nút "In biên bản", không hiện Duyệt/Từ chối', async () => {
  renderPage('Trưởng phòng', 'KYTHUAT', [transfer(1, 'Đã duyệt')]);
  await waitFor(() => expect(screen.getByText('Nhân viên A')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'In biên bản' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
});
```

- [ ] **Step 3: Run it, confirm it fails**

Run: `cd frontend && npx vitest run DeviceTransferListPage.test.tsx`
Expected: FAIL — module doesn't exist.

- [ ] **Step 4: Implement**

Create `frontend/src/modules/transfer/presentation/transferStatusTone.ts`:

```ts
import type { BadgeTone } from '@/shared/ui/Badge';
import { TRANSFER_STATUS, type TransferStatus } from '../domain/deviceTransfer';

export const TRANSFER_STATUS_TONE: Record<TransferStatus, BadgeTone> = {
  [TRANSFER_STATUS.PENDING]: 'warn',
  [TRANSFER_STATUS.APPROVED]: 'ok',
  [TRANSFER_STATUS.REJECTED]: 'danger',
};
```

Create `frontend/src/modules/transfer/presentation/useDeviceTransfers.ts`:

```ts
import { useAsyncData } from '@/shared/lib/useAsyncData';
import type { DeviceTransferQuery } from '../application/DeviceTransferRepository';
import { deviceTransferService } from '../infrastructure/container';

export function useDeviceTransfers(query: DeviceTransferQuery, reloadKey = 0) {
  return useAsyncData(() => deviceTransferService.list(query), [query.status, reloadKey]);
}
```

Create `frontend/src/modules/transfer/presentation/DeviceTransferListPage.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useSession } from '@/app/session/SessionContext';
import { canCreateTransfer, canDecideTransfer } from '@/modules/auth/domain/session';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { Select } from '@/shared/ui/inputs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { TRANSFER_STATUS, type DeviceTransfer, type TransferStatus } from '../domain/deviceTransfer';
import { deviceTransferService } from '../infrastructure/container';
import { useDeviceTransfers } from './useDeviceTransfers';
import { TRANSFER_STATUS_TONE } from './transferStatusTone';

export function DeviceTransferListPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const canCreate = canCreateTransfer(session);
  const canDecide = canDecideTransfer(session);
  const [status, setStatus] = useState<TransferStatus | ''>('');
  const [reloadKey, setReloadKey] = useState(0);
  const { data: transfers, loading, error } = useDeviceTransfers(
    { status: status || undefined },
    reloadKey,
  );

  const approve = useAsyncAction(async (t: DeviceTransfer) => {
    if (!window.confirm('Duyệt lệnh điều chuyển này?')) return;
    await deviceTransferService.approve(t.id);
    setReloadKey((k) => k + 1);
  });

  const reject = useAsyncAction(async (t: DeviceTransfer) => {
    const reason = window.prompt('Lý do từ chối');
    if (!reason || !reason.trim()) return;
    await deviceTransferService.reject(t.id, reason.trim());
    setReloadKey((k) => k + 1);
  });

  const print = useAsyncAction(async (t: DeviceTransfer) => {
    const detail = await deviceTransferService.get(t.id);
    const { downloadBienBan } = await import('./print/generateBienBan');
    downloadBienBan(detail);
  });

  const columns: Array<Column<DeviceTransfer>> = [
    { key: 'from', header: 'Người giao', cell: (t) => t.fromUser.fullName },
    { key: 'to', header: 'Người nhận', cell: (t) => t.toUser.fullName },
    { key: 'count', header: 'Số thiết bị', cell: (t) => String(t.deviceCount), align: 'right' },
    {
      key: 'status',
      header: 'Trạng thái',
      cell: (t) => <Badge tone={TRANSFER_STATUS_TONE[t.status]}>{t.status}</Badge>,
    },
    { key: 'createdAt', header: 'Ngày tạo', cell: (t) => t.createdAt.slice(0, 10) },
    { key: 'createdBy', header: 'Người tạo', cell: (t) => t.createdBy.fullName },
    {
      key: 'actions',
      header: 'Hoạt động',
      align: 'right',
      cell: (t) => (
        <div className="flex justify-end gap-2">
          {canDecide && t.status === TRANSFER_STATUS.PENDING && (
            <>
              <Button size="sm" variant="outline" disabled={approve.pending} onClick={() => void approve.run(t)}>
                Duyệt
              </Button>
              <Button size="sm" variant="outline" disabled={reject.pending} onClick={() => void reject.run(t)}>
                Từ chối
              </Button>
            </>
          )}
          {t.status === TRANSFER_STATUS.APPROVED && (
            <Button size="sm" variant="outline" disabled={print.pending} onClick={() => void print.run(t)}>
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
        breadcrumb={[{ label: 'Trang chủ', to: '/dashboard' }, { label: 'Điều chuyển' }]}
        title="Điều chuyển"
        actions={
          canCreate && (
            <Button size="sm" leadingIcon={<Plus className="h-4 w-4" />} onClick={() => navigate('/transfers/new')}>
              Tạo lệnh
            </Button>
          )
        }
      />

      <Card className="p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Select className="sm:w-56" value={status} onChange={(e) => setStatus(e.target.value as TransferStatus | '')}>
            <option value="">Trạng thái (Tất cả)</option>
            <option value={TRANSFER_STATUS.PENDING}>{TRANSFER_STATUS.PENDING}</option>
            <option value={TRANSFER_STATUS.APPROVED}>{TRANSFER_STATUS.APPROVED}</option>
            <option value={TRANSFER_STATUS.REJECTED}>{TRANSFER_STATUS.REJECTED}</option>
          </Select>
        </div>

        {(approve.error ?? reject.error ?? print.error ?? error) && (
          <p className="mb-3 text-sm text-status-dangerFg">
            {approve.error ?? reject.error ?? print.error ?? error}
          </p>
        )}

        <DataTable
          columns={columns}
          rows={transfers ?? []}
          rowKey={(t) => String(t.id)}
          empty={loading ? 'Đang tải…' : 'Không có lệnh nào'}
        />
      </Card>
    </>
  );
}
```

- [ ] **Step 5: Run it, confirm it passes**

Run: `cd frontend && npx vitest run DeviceTransferListPage.test.tsx`
Expected: PASS, all 3 cases.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/transfer/presentation/useDeviceTransfers.ts frontend/src/modules/transfer/presentation/transferStatusTone.ts frontend/src/modules/transfer/presentation/DeviceTransferListPage.tsx frontend/src/modules/transfer/presentation/DeviceTransferListPage.test.tsx frontend/src/modules/transfer/presentation/print/generateBienBan.ts
git commit -m "feat(transfer): trang danh sách lệnh — lọc, Duyệt, Từ chối"
```

---

### Task 11: `CreateTransferPage` — tạo lệnh điều chuyển

**Files:**
- Create: `frontend/src/modules/transfer/presentation/CreateTransferPage.tsx`

**Interfaces:**
- Consumes: `deviceTransferService` (Task 9), `deviceService` + `DEVICE_STATUS`/`Device` (`@/modules/device/infrastructure/container`, `@/modules/device/domain/device`), `TransferValidationError` (Task 9), `emptyTransferDraft` (Task 8).
- Produces: `<CreateTransferPage />` — consumed by Task 13 (router).

No dedicated component test for this task, same rationale as `CreateOrderPage.tsx` — its logic is thin composition over already-tested pieces (`deviceService.list()`, `validateTransferDraft`); exercised by manual QA in Task 14.

- [ ] **Step 1: Implement**

Create `frontend/src/modules/transfer/presentation/CreateTransferPage.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/layout/PageHeader';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { Checkbox, Select, Textarea } from '@/shared/ui/inputs';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { DEVICE_STATUS, type Device } from '@/modules/device/domain/device';
import { deviceService } from '@/modules/device/infrastructure/container';
import { emptyTransferDraft } from '../domain/validateTransferDraft';
import { TransferValidationError } from '../application/DeviceTransferRepository';
import { deviceTransferService } from '../infrastructure/container';

export function CreateTransferPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(emptyTransferDraft());
  const { data: users } = useAsyncData(() => deviceTransferService.users(), []);

  const { data: eligibleDevices, loading: loadingDevices } = useAsyncData<Device[]>(() => {
    if (draft.fromUserId === null) return Promise.resolve([]);
    return deviceService.list({ status: DEVICE_STATUS.ALLOCATED, currentUserId: draft.fromUserId });
  }, [draft.fromUserId]);

  const toggleDevice = (id: number, checked: boolean) => {
    setDraft((d) => ({
      ...d,
      deviceIds: checked ? [...d.deviceIds, id] : d.deviceIds.filter((x) => x !== id),
    }));
  };

  const submit = useAsyncAction(async () => {
    try {
      await deviceTransferService.create(draft);
      navigate('/transfers');
    } catch (e) {
      if (e instanceof TransferValidationError) throw new Error('Vui lòng kiểm tra các trường bắt buộc');
      throw e;
    }
  });

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Trang chủ', to: '/dashboard' },
          { label: 'Điều chuyển', to: '/transfers' },
          { label: 'Tạo lệnh' },
        ]}
        title="Tạo lệnh điều chuyển"
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
            <h3 className="mb-4 text-base font-semibold text-ink">Người đang giữ</h3>
            <Field label="Người giao">
              <Select
                value={draft.fromUserId ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    fromUserId: e.target.value ? Number(e.target.value) : null,
                    deviceIds: [],
                    toUserId: null,
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
            {draft.fromUserId === null ? (
              <p className="text-sm text-ink-muted">Chọn người đang giữ trước.</p>
            ) : loadingDevices ? (
              <p className="text-sm text-ink-muted">Đang tải…</p>
            ) : (eligibleDevices ?? []).length === 0 ? (
              <p className="text-sm text-ink-muted">Người này không đang giữ thiết bị nào.</p>
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
            <h3 className="mb-4 text-base font-semibold text-ink">Người nhận</h3>
            <Field label="Người nhận">
              <Select
                value={draft.toUserId ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, toUserId: e.target.value ? Number(e.target.value) : null }))
                }
              >
                <option value="">— Chọn người —</option>
                {(users ?? [])
                  .filter((u) => u.id !== draft.fromUserId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
              </Select>
            </Field>
          </section>

          <section className="p-6">
            <h3 className="mb-4 text-base font-semibold text-ink">Ghi chú</h3>
            <Textarea value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} />
          </section>

          {submit.error && <p className="px-6 pb-2 text-sm text-status-dangerFg">{submit.error}</p>}

          <section className="flex justify-end gap-2 p-6">
            <Button type="button" variant="outline" onClick={() => navigate('/transfers')}>
              Huỷ
            </Button>
            <Button type="submit" disabled={submit.pending}>
              Tạo lệnh
            </Button>
          </section>
        </form>
      </Card>
    </>
  );
}
```

Note the `toUserId` dropdown filters out `draft.fromUserId` client-side (UX convenience matching spec §7) — the real enforcement is the backend's `fromUserId === toUserId` check from Task 2, not this filter.

- [ ] **Step 2: Type-check**

Run: `cd frontend && npm run lint` (this repo's `lint` script is `tsc -b --noEmit`)
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/transfer/presentation/CreateTransferPage.tsx
git commit -m "feat(transfer): trang tạo lệnh điều chuyển"
```

---

### Task 12: Biên bản PDF cho Điều chuyển — dùng font đã dời sang shared

**Files:**
- Modify: `frontend/src/modules/transfer/presentation/print/generateBienBan.ts` (replaces the Task 10 placeholder)
- Create: `frontend/src/modules/transfer/presentation/print/generateBienBan.test.ts`

**Interfaces:**
- Consumes: `DEJAVU_SANS_BASE64` from `@/shared/print/DejaVuSansBase64` (Task 7 — already relocated, no new font embed in this task).
- Produces: `buildBienBanContent(transfer): string[]` (pure, tested) and `downloadBienBan(transfer): void` — `downloadBienBan` already consumed by `DeviceTransferListPage` since Task 10.

No new dependency and no new font asset in this task — it only imports the already-shared `DEJAVU_SANS_BASE64` and mirrors `allocation`'s `generateBienBan.ts` structure.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/modules/transfer/presentation/print/generateBienBan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { DeviceTransferDetail } from '../../domain/deviceTransfer';
import { buildBienBanContent } from './generateBienBan';

const device = (over: Partial<DeviceTransferDetail['items'][number]['device']> = {}) => ({
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

const transfer = (over: Partial<DeviceTransferDetail> = {}): DeviceTransferDetail => ({
  id: 1,
  status: 'Đã duyệt',
  note: null,
  rejectReason: null,
  decidedAt: '2026-09-25T00:00:00.000Z',
  createdAt: '2026-09-24T00:00:00.000Z',
  fromUser: { id: 5, fullName: 'Nhân viên A', username: 'a' },
  toUser: { id: 6, fullName: 'Nhân viên B', username: 'b' },
  createdBy: { id: 1, fullName: 'Quản trị viên' },
  decidedBy: { id: 2, fullName: 'Trưởng phòng Kỹ thuật' },
  deviceCount: 1,
  items: [{ id: 1, device: device() }],
  ...over,
});

describe('buildBienBanContent (transfer)', () => {
  it('tiêu đề đúng', () => {
    expect(buildBienBanContent(transfer())[0]).toBe('BIÊN BẢN ĐIỀU CHUYỂN THIẾT BỊ');
  });

  it('có tên người giao và người nhận', () => {
    const lines = buildBienBanContent(transfer());
    expect(lines.some((l) => l.includes('Nhân viên A'))).toBe(true);
    expect(lines.some((l) => l.includes('Nhân viên B'))).toBe(true);
  });

  it('liệt kê đúng mã thiết bị trong danh sách', () => {
    const lines = buildBienBanContent(transfer());
    expect(lines.some((l) => l.includes('LT-000001'))).toBe(true);
  });

  it('nhiều thiết bị: liệt kê đủ từng dòng', () => {
    const lines = buildBienBanContent(
      transfer({
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

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd frontend && npx vitest run generateBienBan.test.ts`
Expected: two files share this test filename (`allocation` and `transfer`); scope the run to just this new one if needed: `cd frontend && npx vitest run frontend/src/modules/transfer/presentation/print/generateBienBan.test.ts`. The `transfer` one FAILs — `buildBienBanContent` throws the Task 10 placeholder's error, or isn't exported.

- [ ] **Step 3: Implement**

Replace the entire contents of `frontend/src/modules/transfer/presentation/print/generateBienBan.ts` with:

```ts
import jsPDF from 'jspdf';
import { DEJAVU_SANS_BASE64 } from '@/shared/print/DejaVuSansBase64';
import type { DeviceTransferDetail } from '../../domain/deviceTransfer';

// A4 rộng 210mm, lề trái 14mm — chừa lề phải tương ứng nên bề rộng khả dụng ~180mm.
const MAX_TEXT_WIDTH_MM = 180;
const LEFT_MARGIN_MM = 14;
const LINE_HEIGHT_MM = 6;

/** Nội dung biên bản, tách riêng khỏi việc vẽ PDF để test được. */
export function buildBienBanContent(t: DeviceTransferDetail): string[] {
  return [
    'BIÊN BẢN ĐIỀU CHUYỂN THIẾT BỊ',
    `Số đơn: ${t.id}`,
    `Ngày duyệt: ${t.decidedAt ? t.decidedAt.slice(0, 10) : ''}`,
    `Người lập: ${t.createdBy.fullName}`,
    `Người duyệt: ${t.decidedBy?.fullName ?? ''}`,
    `Người giao: ${t.fromUser.fullName}`,
    `Người nhận: ${t.toUser.fullName}`,
    '',
    'Danh sách thiết bị:',
    ...t.items.map((i) => `- ${i.device.deviceCode} · ${i.device.deviceName} · ${i.device.specDetail}`),
    '',
    'Người giao: ______________________        Người nhận: ______________________',
  ];
}

/** Vẽ và tải file PDF — không letterhead, không nhiều trang, đủ để in ký tay. Dùng lại đúng font
 *  DejaVu Sans đã nhúng sẵn ở shared/print/ (không nhúng lại — xem Task 7 của plan này). */
export function downloadBienBan(t: DeviceTransferDetail): void {
  const doc = new jsPDF();
  doc.addFileToVFS('DejaVuSans.ttf', DEJAVU_SANS_BASE64);
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
  doc.setFont('DejaVuSans');
  doc.setFontSize(11);

  let y = 20;
  for (const line of buildBienBanContent(t)) {
    const wrapped: string[] = doc.splitTextToSize(line, MAX_TEXT_WIDTH_MM);
    doc.text(wrapped, LEFT_MARGIN_MM, y);
    y += wrapped.length * LINE_HEIGHT_MM;
  }
  doc.save(`bien-ban-dieu-chuyen-${t.id}.pdf`);
}
```

- [ ] **Step 4: Run it, confirm it passes, then run the whole frontend suite**

Run: `cd frontend && npx vitest run generateBienBan.test.ts`
Expected: PASS — both the `allocation` and `transfer` files matching this test filename pass (4 cases each).

Run: `cd frontend && npm test`
Expected: PASS, all files.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/transfer/presentation/print/generateBienBan.ts frontend/src/modules/transfer/presentation/print/generateBienBan.test.ts
git commit -m "feat(transfer): xuất biên bản PDF điều chuyển, dùng font DejaVu Sans dùng chung"
```

---

### Task 13: Routing + navigation visibility

**Files:**
- Create: `frontend/src/app/session/RequireTransferAccess.tsx`
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/shared/layout/navItems.ts`
- Modify: `frontend/src/shared/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `canAccessTransfers` (Task 6), `<DeviceTransferListPage />` (Task 10), `<CreateTransferPage />` (Task 11).
- Produces: `/transfers` and `/transfers/new` now render real pages, gated to Admin/Trưởng phòng Kỹ thuật; the sidebar hides "Điều chuyển" for everyone else.

This touches shared, load-bearing app files used by every page — make the minimal, precise change; don't touch anything else in `router.tsx`/`Sidebar.tsx`.

- [ ] **Step 1: Implement the route guard**

Create `frontend/src/app/session/RequireTransferAccess.tsx`:

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { canAccessTransfers } from '@/modules/auth/domain/session';
import { useSession } from './SessionContext';

/** Chỉ Quản trị viên hoặc Trưởng phòng Kỹ thuật vào được; role khác về /dashboard. */
export function RequireTransferAccess() {
  const { session } = useSession();
  return canAccessTransfers(session) ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
```

- [ ] **Step 2: Wire the routes**

In `frontend/src/app/router.tsx`, add these imports (alongside the existing `allocation` ones):

```ts
import { RequireTransferAccess } from './session/RequireTransferAccess';
import { DeviceTransferListPage } from '@/modules/transfer/presentation/DeviceTransferListPage';
import { CreateTransferPage } from '@/modules/transfer/presentation/CreateTransferPage';
```

Replace this line:

```tsx
          { path: '/transfers', element: <ComingSoonPage title="Điều chuyển" /> },
```

with:

```tsx
          {
            element: <RequireTransferAccess />,
            children: [
              { path: '/transfers', element: <DeviceTransferListPage /> },
              { path: '/transfers/new', element: <CreateTransferPage /> },
            ],
          },
```

(`ComingSoonPage` stays imported and used — `/audit` still uses it. This is the only line removed from the routes array; every other route, including the `RequireOrderAccess`/`RequireAdmin` blocks, is untouched.)

- [ ] **Step 3: Hide the nav item for other roles**

In `frontend/src/shared/layout/navItems.ts`, update the `NavItem` interface and the Điều chuyển entry:

```ts
export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Chỉ hiện với Quản trị viên. */
  adminOnly?: boolean;
  /** Chỉ hiện với Quản trị viên hoặc Trưởng phòng Kỹ thuật. */
  orderAccessOnly?: boolean;
  /** Chỉ hiện với Quản trị viên hoặc Trưởng phòng Kỹ thuật. */
  transferAccessOnly?: boolean;
}
```

```ts
  { label: 'Điều chuyển', to: '/transfers', icon: ArrowLeftRight, transferAccessOnly: true },
```

In `frontend/src/shared/layout/Sidebar.tsx`, add the import and update the filter:

```ts
import { canAccessOrders, canAccessTransfers, isAdmin } from '@/modules/auth/domain/session';
```

```tsx
        {PRIMARY_NAV.filter(
          (item) =>
            (!item.adminOnly || isAdmin(session)) &&
            (!item.orderAccessOnly || canAccessOrders(session)) &&
            (!item.transferAccessOnly || canAccessTransfers(session)),
        ).map((item) => (
```

- [ ] **Step 4: Run the whole frontend suite, lint, and build**

Run: `cd frontend && npm test`
Expected: PASS, every test file green.

Run: `cd frontend && npm run lint && npm run build`
Expected: both clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/session/RequireTransferAccess.tsx frontend/src/app/router.tsx frontend/src/shared/layout/navItems.ts frontend/src/shared/layout/Sidebar.tsx
git commit -m "feat(transfer): gắn route /transfers, /transfers/new và ẩn nav theo quyền"
```

---

### Task 14: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full backend suite**

Run: `cd backend && npm test`
Expected: all spec files green — `auth.spec.ts`, `devices.spec.ts`, `users.spec.ts`, `device-orders.spec.ts`, `device-transfers.spec.ts`.

- [ ] **Step 2: Backend build + lint**

Run: `cd backend && npm run build && npm run lint`
Expected: both clean.

- [ ] **Step 3: Backend E2E scripts against the real database**

With `cd backend && npm run start:dev` running and local PostgreSQL up, run all four:
```
powershell -ExecutionPolicy Bypass -File backend/scripts/e2e-users.ps1
powershell -ExecutionPolicy Bypass -File backend/scripts/e2e-devices.ps1
powershell -ExecutionPolicy Bypass -File backend/scripts/e2e-device-orders.ps1
powershell -ExecutionPolicy Bypass -File backend/scripts/e2e-device-transfers.ps1
```
Expected: all four fully green — the first three confirm this round didn't regress anything earlier; the fourth is this round's own script (Task 5).

- [ ] **Step 4: Full frontend suite, build, lint**

Run: `cd frontend && npm test && npm run lint && npm run build`
Expected: all clean.

- [ ] **Step 5: Report counts and remaining manual step**

Report the final BE jest / FE vitest counts. State explicitly that the on-screen walkthrough — log in as Admin, create a transfer order, log in as Trưởng phòng Kỹ thuật, approve it, verify the device shows the new holder, try a rejection, print a biên bản PDF and confirm the Vietnamese text renders correctly — still needs to be done by hand (or via the same `playwright-core` + local Edge approach used to verify the Cấp phát - Thu hồi round, if repeating that check is wanted).

No commit for this task (verification only; if Step 3's E2E scripts fail, fix forward in a new commit before reporting done).

