# Role Cộng tác viên + trạng thái "Đang chờ duyệt" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm role `Cộng tác viên`, phân lại quyền thiết bị / Cấp phát - Thu hồi / Điều chuyển (CTV Kỹ thuật làm, TP Kỹ thuật duyệt, Quản trị viên chỉ quản lý người dùng và xem), và buộc mọi thay đổi người giữ thiết bị đi qua đơn/lệnh có trạng thái thiết bị `Đang chờ duyệt`.

**Architecture:** Backend thay 5 guard theo miền + `@Roles` bằng `@Allow(...actor)` do `AuthGuard` kiểm. Đơn/lệnh giữ chỗ thiết bị ngay khi tạo (ghi `Đang chờ duyệt` có điều kiện trong transaction), duyệt/từ chối đưa thiết bị về trạng thái đích/cũ. API và form thiết bị thôi nhận người giữ/trạng thái/phòng ban; cột `Device.DepartmentId` bị xoá. Frontend giữ tên helper `can*`, đổi thân, gộp route guard thành `RequireCan`.

**Tech Stack:** NestJS + Prisma (PostgreSQL) + jest/supertest; React + react-router + vitest/RTL; PowerShell 5.1 cho e2e.

**Spec:** `docs/superpowers/specs/2026-09-30-role-cong-tac-vien-design.md`

## Global Constraints

- Branch `feat/role-cong-tac-vien` cắt từ `main`. Mỗi task một commit (người dùng đã đồng ý agent commit theo task). **Không push, không merge** khi chưa được hỏi. Commit message kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tên role nguyên văn: `Quản trị viên`, `Trưởng phòng`, `Cộng tác viên`, `Nhân viên`. Mã phòng ban: `KYTHUAT`, `KETOAN`.
- Trạng thái thiết bị nguyên văn: `Trong kho`, `Đã cấp phát`, `Đang chờ duyệt`, `Chờ thanh lý`, `Đã xóa`.
- Thông báo nguyên văn: 403 `Bạn không có quyền thực hiện thao tác này`; thiếu phòng ban `Vui lòng chọn phòng ban`; `Thiết bị "<mã>" đang chờ duyệt ở đơn/lệnh khác`; `Thiết bị "<mã>" không còn ở trạng thái chờ duyệt`; `Thiết bị đang chờ duyệt, không thể sửa hoặc xoá`.
- UI copy và comment tiếng Việt; import FE dùng alias `@/`. Không thêm dependency.
- Đúng 2 migration Prisma (Task 4, Task 5), tạo bằng `npx prisma migrate dev` trong `backend/` (DB thật: PostgreSQL native, `DATABASE_URL` trong `backend/.env`). Đọc lại SQL sinh ra trước khi commit.
- Backend chạy trong `backend/`: `npm test`, `npm run lint` (là `eslint --fix` — **sửa file trên đĩa**; diff thuần format sau đó là bình thường, commit kèm).
- Frontend chạy trong `frontend/`: `npm test`, `npm run lint` (là `tsc -b --noEmit` — không thay bằng `tsc --noEmit` trần), `npm run build`.
- 4 file `backend/scripts/e2e-*.ps1` phải giữ **UTF-8 có BOM**.
- Khác chữ của spec (đã báo người dùng): route sửa thiết bị là `/devices/:id/edit`; script e2e tự tạo tài khoản TP/CTV qua API (không dùng tài khoản seed).

## Review Focus

1. **TP/CTV không phòng ban (dữ liệu cũ)** → không khớp actor nào, 403 chứ không 500. Test ở Task 1.
2. **`@Allow` ở handler THU HẸP chứ không cộng dồn với class** — Admin đọc được `/device-orders` nhưng `POST` 403. Test ở Task 2.
3. **`POST /users` với `departmentId: null` tường minh** cho TP/CTV → 400, không lọt xuống Prisma. Test ở Task 3.
4. **Hai đơn/lệnh tạo gần như đồng thời cùng nhắm một thiết bị** → đơn ghi sau 400, chỉ một đơn tồn tại; và **đơn/lệnh cũ** (tạo trước khi có giữ chỗ) có thiết bị chưa `Đang chờ duyệt` → duyệt 400, đơn vẫn `Chờ duyệt`. Test ở Task 4.
5. **Gửi kèm `currentUserId`/`status` vào API thiết bị** (client cũ, gọi tay) → bị lờ, thiết bị không đổi người giữ/trạng thái; và gõ thẳng URL `/devices/new` khi chỉ có quyền đọc → về `/devices`. Test ở Task 5 và Task 7.

## File Structure

| File | Việc |
|---|---|
| `backend/src/modules/identity/roles.ts` | `COLLAB`, `DEPARTMENT_REQUIRED_ROLES` |
| `backend/src/shared/auth/actors.ts` (+spec, mới) | `ACTOR`, `Allow`, `ALLOW_KEY` |
| `backend/src/shared/auth/auth.guard.ts` | đọc `ALLOW_KEY` |
| 5 file `*.guard.ts` theo miền + `roles.decorator.ts` | **xoá** |
| 4 controller | `@Allow` |
| `backend/src/modules/users/users.service.ts` | bắt buộc phòng ban |
| `backend/src/modules/devices/device-status.ts` | `PENDING_APPROVAL`, 2 hàm thông báo; xoá `ASSIGNABLE_DEVICE_STATUSES` |
| `backend/src/modules/device-orders/device-orders.service.ts`, `device-transfers/device-transfers.service.ts` | giữ chỗ / duyệt / từ chối |
| `backend/src/modules/devices/devices.{dto,service}.ts` | bỏ field người giữ/trạng thái/phòng ban, chặn sửa/xoá khi chờ |
| `backend/prisma/schema.prisma` + 2 migration | backfill trạng thái, xoá `Device.DepartmentId` |
| `backend/src/test/fake-prisma.ts` + 4 spec | role 4, actor, vòng đời, fixture |
| `backend/prisma/seed.ts`, `backend/scripts/e2e-*.ps1` | tài khoản dev, e2e |
| `frontend/src/modules/auth/domain/session.ts` (+test) | helper |
| `frontend/src/app/session/RequireCan.tsx` (+test, mới), `router.tsx`; xoá 3 `Require*.tsx` | route guard |
| `frontend/src/modules/device/**` | trạng thái mới, form bỏ ô gán người giữ, quyền xoá |
| `frontend/src/modules/user/{domain/userAccount.ts,presentation/CreateUserPage.tsx}` | bắt buộc phòng ban |
| `frontend/src/modules/{allocation,transfer}/presentation/*ListPage.test.tsx`, `print/generateBienBan.test.ts` | test theo actor / fixture |
| `docs/CONTEXT.md`, `docs/Changes.md` | tài liệu |

---

### Task 0: Branch và commit tài liệu thiết kế

- [ ] **Step 1:** Từ `main` sạch (chỉ có 2 file untracked là spec và plan này): `git checkout -b feat/role-cong-tac-vien`.
- [ ] **Step 2:** Commit:

```bash
git add docs/superpowers/specs/2026-09-30-role-cong-tac-vien-design.md docs/superpowers/plans/2026-09-30-role-cong-tac-vien.md
git commit -m "docs: spec và plan role Cộng tác viên + trạng thái Đang chờ duyệt"
```

---

### Task 1: Role `Cộng tác viên` và actor

**Files:**
- Modify: `backend/src/modules/identity/roles.ts`
- Create: `backend/src/shared/auth/actors.ts`, `backend/src/shared/auth/actors.spec.ts`
- Modify: `backend/src/test/fake-prisma.ts:118-122`
- Modify: `backend/src/modules/users/users.spec.ts:14,131-135`

**Interfaces:**
- Consumes: `AuthUser` (`{ id: number; roleName: string; departmentCode: string | null }`) từ `shared/auth/auth.guard.ts`.
- Produces: `ROLE.COLLAB`; `DEPARTMENT_REQUIRED_ROLES: readonly string[]`; `type Actor = (user: AuthUser) => boolean`; `ACTOR.ADMIN | TECH_HEAD | TECH_COLLAB`; `Allow(...actors: Actor[])`; `ALLOW_KEY`; `TECH_DEPARTMENT_CODE`. Role id 4 = `Cộng tác viên` trong fake Prisma.

- [ ] **Step 1: Viết test fail** — `backend/src/shared/auth/actors.spec.ts`:

```ts
import { ROLE } from '../../modules/identity/roles';
import { ACTOR } from './actors';

const matched = (roleName: string, departmentCode: string | null) =>
  Object.entries(ACTOR)
    .filter(([, is]) => is({ id: 1, roleName, departmentCode }))
    .map(([name]) => name);

describe('ACTOR', () => {
  it.each([
    [ROLE.ADMIN, null, ['ADMIN']],
    [ROLE.ADMIN, 'KYTHUAT', ['ADMIN']],
    [ROLE.HEAD, 'KYTHUAT', ['TECH_HEAD']],
    [ROLE.COLLAB, 'KYTHUAT', ['TECH_COLLAB']],
    // Không khớp actor nào: Kế toán, không phòng ban (dữ liệu cũ), Nhân viên.
    [ROLE.HEAD, 'KETOAN', []],
    [ROLE.COLLAB, 'KETOAN', []],
    [ROLE.HEAD, null, []],
    [ROLE.COLLAB, null, []],
    [ROLE.STAFF, 'KYTHUAT', []],
    ['Role lạ', 'KYTHUAT', []],
  ])('%s + %s → %j', (roleName, departmentCode, expected) => {
    expect(matched(roleName, departmentCode)).toEqual(expected);
  });
});
```

- [ ] **Step 2: Chạy, xác nhận fail** — trong `backend/`: `npm test -- actors.spec`. Expected: FAIL `Cannot find module './actors'`.

- [ ] **Step 3: Cài đặt.**

`backend/src/modules/identity/roles.ts` (thay toàn bộ):

```ts
// Tên role đã chốt (cột Role.RoleName). "Trưởng phòng" và "Cộng tác viên" phân biệt
// Kế toán / Kỹ thuật bằng User.DepartmentId.
export const ROLE = {
  ADMIN: 'Quản trị viên',
  HEAD: 'Trưởng phòng',
  STAFF: 'Nhân viên',
  COLLAB: 'Cộng tác viên',
} as const;

/** Role vô nghĩa nếu thiếu phòng ban — bắt buộc chọn phòng ban khi tạo user. */
export const DEPARTMENT_REQUIRED_ROLES: readonly string[] = [
  ROLE.HEAD,
  ROLE.COLLAB,
];
```

(`COLLAB` đặt cuối để seed trên DB trống vẫn cho `Nhân viên` id 3 như các script e2e giả định.)

`backend/src/shared/auth/actors.ts`:

```ts
import { SetMetadata } from '@nestjs/common';
import { ROLE } from '../../modules/identity/roles';
import type { AuthUser } from './auth.guard';

export const TECH_DEPARTMENT_CODE = 'KYTHUAT';

/** Một "vai" nghiệp vụ = role + (tuỳ chọn) phòng ban. */
export type Actor = (user: AuthUser) => boolean;

export const ACTOR = {
  ADMIN: (u) => u.roleName === ROLE.ADMIN,
  TECH_HEAD: (u) =>
    u.roleName === ROLE.HEAD && u.departmentCode === TECH_DEPARTMENT_CODE,
  TECH_COLLAB: (u) =>
    u.roleName === ROLE.COLLAB && u.departmentCode === TECH_DEPARTMENT_CODE,
} satisfies Record<string, Actor>;

export const ALLOW_KEY = 'allow';

/**
 * Chỉ user khớp ÍT NHẤT MỘT actor được gọi handler/controller. Dùng kèm @UseGuards(AuthGuard).
 * @Allow ở handler GHI ĐÈ (không cộng dồn) @Allow ở class.
 */
export const Allow = (...actors: Actor[]) => SetMetadata(ALLOW_KEY, actors);
```

`backend/src/test/fake-prisma.ts` — thêm dòng thứ 4 vào mảng `roles`:

```ts
    { id: 3, roleName: 'Nhân viên' },
    { id: 4, roleName: 'Cộng tác viên' },
```

`backend/src/modules/users/users.spec.ts` — dòng 14 thành `// Role id trong fake: 1 Quản trị viên, 2 Trưởng phòng, 3 Nhân viên, 4 Cộng tác viên. Phòng ban: 1 KYTHUAT, 2 KETOAN.`; trong test `GET /roles` thêm `{ id: 4, roleName: 'Cộng tác viên' },` vào cuối mảng mong đợi.

- [ ] **Step 4: Chạy, xác nhận pass** — `npm test`. Expected: toàn bộ xanh.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/identity/roles.ts backend/src/shared/auth/actors.ts backend/src/shared/auth/actors.spec.ts backend/src/test/fake-prisma.ts backend/src/modules/users/users.spec.ts
git commit -m "feat(auth): thêm role Cộng tác viên và ACTOR/@Allow"
```

---

### Task 2: Chuyển toàn bộ backend sang `@Allow` theo ma trận mới

**Files:**
- Modify: `backend/src/shared/auth/auth.guard.ts`
- Modify: `backend/src/modules/{users/users,devices/devices,device-orders/device-orders,device-transfers/device-transfers}.controller.ts`
- Delete: `backend/src/shared/auth/{device-write,order-access,order-create,transfer-access,transfer-decide}.guard.ts`, `backend/src/shared/auth/roles.decorator.ts`
- Test: `backend/src/modules/devices/devices.spec.ts`, `device-orders/device-orders.spec.ts`, `device-transfers/device-transfers.spec.ts`

**Interfaces:**
- Consumes: `ACTOR`, `Allow`, `ALLOW_KEY`, `Actor` (Task 1); role id 4 trong fake.
- Produces: ma trận HTTP dưới đây; trong 3 spec có biến `techHead` (role 2, KYTHUAT) và `collab` (role 4, KYTHUAT) mà Task 4, 5 dùng tiếp.

| Endpoint | `@Allow` |
|---|---|
| `GET /devices`, `GET /devices/:id`, `GET /device-types` | không có |
| `POST /devices`, `PATCH /devices/:id` | `TECH_HEAD, TECH_COLLAB` |
| `DELETE /devices/:id`, `POST /devices/purge` | `TECH_HEAD` |
| `DeviceOrdersController`, `DeviceTransfersController` (class) | `ADMIN, TECH_HEAD, TECH_COLLAB` |
| `POST /device-orders`, `POST /device-transfers` | `TECH_COLLAB` |
| `PATCH …/approve`, `…/reject` (cả hai) | `TECH_HEAD` |
| `UsersController` (class) | `ADMIN` |
| `LookupController` | không có |

- [ ] **Step 1: Sửa test trước (sẽ fail).**

**`devices.spec.ts`:**
1. Dòng 14: thêm `, 4 Cộng tác viên` vào comment role.
2. Khai báo `let techHead: User; let collab: User;` cạnh `let staff: User;`. Cuối `beforeEach` (sau `staff = …`, để id admin/staff không đổi) thêm:
   ```ts
   techHead = addUser('techhead', 2); // addUser đặt departmentId = 1 (KYTHUAT)
   collab = addUser('collab', 4);
   ```
3. Replace-all `tokenOf(admin)` → `tokenOf(techHead)` trong file. Đổi tên test `POST /devices/purge (Admin): …` thành `POST /devices/purge (Trưởng phòng Kỹ thuật): …`.
4. Xoá test `Trưởng phòng Kế toán không được tạo, Trưởng phòng Kỹ thuật thì được`; thêm cuối `describe`:

```ts
  it('Quản trị viên chỉ đọc: POST/PATCH/DELETE/purge đều 403, GET 200', async () => {
    const created = await http()
      .post('/devices')
      .set('Authorization', tokenOf(techHead))
      .send(newDevice())
      .expect(201);
    const id = created.body.data.id;
    const auth = tokenOf(admin);
    await http().post('/devices').set('Authorization', auth).send(newDevice({ deviceCode: 'LT-000002' })).expect(403);
    await http().patch(`/devices/${id}`).set('Authorization', auth).send({ deviceName: 'X' }).expect(403);
    await http().delete(`/devices/${id}`).set('Authorization', auth).expect(403);
    await http().post('/devices/purge').set('Authorization', auth).send({ ids: [id] }).expect(403);
    await http().get(`/devices/${id}`).set('Authorization', auth).expect(200);
  });

  it('Cộng tác viên Kỹ thuật: tạo + sửa được, xoá mềm và dọn thùng rác 403', async () => {
    const auth = tokenOf(collab);
    const created = await http().post('/devices').set('Authorization', auth).send(newDevice()).expect(201);
    const id = created.body.data.id;
    const patched = await http()
      .patch(`/devices/${id}`)
      .set('Authorization', auth)
      .send({ deviceName: 'Đã sửa' })
      .expect(200);
    expect(patched.body.data.deviceName).toBe('Đã sửa');
    const del = await http().delete(`/devices/${id}`).set('Authorization', auth).expect(403);
    expect(del.body.message).toBe('Bạn không có quyền thực hiện thao tác này');
    await http().post('/devices/purge').set('Authorization', auth).send({ ids: [id] }).expect(403);
    expect(prisma.devices.find((d) => d.id === id)!.status).toBe('Trong kho');
  });

  it('Trưởng phòng / Cộng tác viên Kế toán hoặc không phòng ban: không được tạo', async () => {
    const cases: Array<[number, number | null]> = [[2, 2], [4, 2], [2, null], [4, null]];
    for (const [roleId, departmentId] of cases) {
      const u = addUser(`u${roleId}${departmentId}`, roleId);
      u.departmentId = departmentId;
      await http().post('/devices').set('Authorization', tokenOf(u)).send(newDevice()).expect(403);
    }
  });
```

**`device-orders.spec.ts`:**
1. Dòng 14: thêm `, 4 Cộng tác viên`.
2. Khai báo `let collab: User;`; cuối `beforeEach` thêm `collab = addUser('collab', 4, 1);`.
3. **Theo đúng thứ tự:** (a) replace-all `tokenOf(techHead)` → `tokenOf(collab)` (mọi chỗ hiện có đều là `POST /device-orders`); (b) trong `createDevice` đổi `tokenOf(admin)` → `tokenOf(techHead)`; (c) mọi `.patch(...)` tới `/approve`, `/reject`, và `.patch(\`/devices/${deviceId}\`)` đang dùng `tokenOf(admin)` → `tokenOf(techHead)` (kể cả bên trong `mockImplementationOnce` của test race, `/device-orders/9999999999/approve`, `/device-orders/abc/approve`). Mọi `.get(...)` bằng `tokenOf(admin)` **giữ nguyên**. Test `Admin không được tạo đơn: 403` giữ nguyên.
4. Thay test `Trưởng phòng Kỹ thuật không được duyệt/từ chối: 403` bằng:

```ts
    it('Quản trị viên và Cộng tác viên Kỹ thuật không được duyệt/từ chối: 403', async () => {
      const deviceId = await createDevice();
      const created = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(collab))
        .send({ type: 'Cấp phát', targetUserId: staff.id, deviceIds: [deviceId] })
        .expect(201);
      const orderId = created.body.data.id;
      for (const actor of [admin, collab]) {
        await http()
          .patch(`/device-orders/${orderId}/approve`)
          .set('Authorization', tokenOf(actor))
          .expect(403);
        await http()
          .patch(`/device-orders/${orderId}/reject`)
          .set('Authorization', tokenOf(actor))
          .send({ reason: 'x' })
          .expect(403);
      }
    });

    it('đơn Chờ duyệt cũ do chính Trưởng phòng Kỹ thuật tạo: vẫn duyệt được', async () => {
      const deviceId = await createDevice();
      prisma.deviceOrders.push({
        id: 1,
        type: 'Cấp phát',
        status: 'Chờ duyệt',
        targetUserId: staff.id,
        note: null,
        createdById: techHead.id,
        decidedById: null,
        decidedAt: null,
        rejectReason: null,
        createdAt: new Date(),
      });
      prisma.deviceOrderItems.push({ id: 1, orderId: 1, deviceId });
      const res = await http()
        .patch('/device-orders/1/approve')
        .set('Authorization', tokenOf(techHead))
        .expect(200);
      expect(res.body.data.status).toBe('Đã duyệt');
    });
```

5. Trong `describe('POST /device-orders')` thêm:

```ts
    it('Trưởng phòng Kỹ thuật không còn được tạo đơn: 403', async () => {
      const deviceId = await createDevice();
      await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(techHead))
        .send({ type: 'Cấp phát', targetUserId: staff.id, deviceIds: [deviceId] })
        .expect(403);
    });
```

6. Trong `describe('GET /device-orders')` thêm:

```ts
    it('Quản trị viên, Trưởng phòng Kỹ thuật, Cộng tác viên Kỹ thuật đều xem được', async () => {
      for (const actor of [admin, techHead, collab]) {
        await http().get('/device-orders').set('Authorization', tokenOf(actor)).expect(200);
      }
    });

    it('Cộng tác viên Kế toán không xem được: 403', async () => {
      const financeCollab = addUser('financecollab', 4, 2);
      await http().get('/device-orders').set('Authorization', tokenOf(financeCollab)).expect(403);
    });
```

**`device-transfers.spec.ts`:**
1. Dòng 14: thêm `, 4 Cộng tác viên`.
2. Khai báo `let collab: User;`; cuối `beforeEach` thêm `collab = addUser('collab', 4, 1);`.
3. (a) Trong `createDevice` đổi `tokenOf(admin)` → `tokenOf(techHead)`; (b) mọi `.post('/device-transfers')` dùng `tokenOf(admin)` → `tokenOf(collab)`; (c) `.patch(\`/devices/${deviceId}\`)` dùng `tokenOf(admin)` → `tokenOf(techHead)`. Giữ nguyên: mọi `.get(...)` và các lời gọi `/users/...` bằng `tokenOf(admin)`; test `Trưởng phòng Kỹ thuật không được tạo lệnh: 403`; test `Admin không được duyệt/từ chối: 403`.
4. Trong `describe('POST /device-transfers')` thêm:

```ts
    it('Quản trị viên không còn được tạo lệnh: 403', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(admin))
        .send({ fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [deviceId] })
        .expect(403);
    });
```

5. Trong `describe('GET /device-transfers')` thêm:

```ts
    it('Quản trị viên, Trưởng phòng Kỹ thuật, Cộng tác viên Kỹ thuật đều xem được', async () => {
      for (const actor of [admin, techHead, collab]) {
        await http().get('/device-transfers').set('Authorization', tokenOf(actor)).expect(200);
      }
    });
```

6. Trong `describe('PATCH /device-transfers/:id/approve, /reject')` thêm:

```ts
    it('Cộng tác viên Kỹ thuật không được duyệt lệnh mình tạo: 403', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      const created = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(collab))
        .send({ fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [deviceId] })
        .expect(201);
      await http()
        .patch(`/device-transfers/${created.body.data.id}/approve`)
        .set('Authorization', tokenOf(collab))
        .expect(403);
    });
```

- [ ] **Step 2: Chạy, xác nhận fail** — `npm test`. Expected: FAIL ở 3 spec (vd. CTV `POST /devices` nhận 403; TP duyệt đơn nhận 403).

- [ ] **Step 3: Cài đặt.**

`auth.guard.ts`: đổi `import { ROLES_KEY } from './roles.decorator';` thành `import { ALLOW_KEY, type Actor } from './actors';`; thay đoạn từ `const allowed = …` tới `return true;` bằng:

```ts
    const authUser: AuthUser = {
      id: user.id,
      roleName: user.role.roleName,
      departmentCode: user.department?.departmentCode ?? null,
    };
    const allowed = this.reflector.getAllAndOverride<Actor[] | undefined>(
      ALLOW_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed && !allowed.some((actor) => actor(authUser))) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }

    req.user = authUser;
    return true;
```

`users.controller.ts`: bỏ import `Roles`, `ROLE`; thêm `import { ACTOR, Allow } from '../../shared/auth/actors';`; `@Roles(ROLE.ADMIN)` → `@Allow(ACTOR.ADMIN)`; comment purge thành `(đã áp ở @Allow class-level)`.

`devices.controller.ts`: bỏ import `DeviceWriteGuard`, `Roles`, `ROLE`; thêm import `ACTOR, Allow`. Bốn handler ghi:

```ts
  @Post()
  @Allow(ACTOR.TECH_HEAD, ACTOR.TECH_COLLAB)
  @ResponseMessage('Đã tạo thiết bị')
  create(@Body() dto: CreateDeviceDto) {
    return this.devices.create(dto);
  }

  @Patch(':id')
  @Allow(ACTOR.TECH_HEAD, ACTOR.TECH_COLLAB)
  @ResponseMessage('Đã cập nhật thiết bị')
  update(@DeviceId() id: number, @Body() dto: UpdateDeviceDto) {
    return this.devices.update(id, dto);
  }

  /** Xoá mềm — chỉ Trưởng phòng Kỹ thuật; Cộng tác viên thêm/sửa được nhưng không xoá. */
  @Delete(':id')
  @Allow(ACTOR.TECH_HEAD)
  @ResponseMessage('Đã xoá thiết bị')
  remove(@DeviceId() id: number) {
    return this.devices.softDelete(id);
  }

  /** Dọn thùng rác (xoá cứng) — chỉ Trưởng phòng Kỹ thuật. */
  @Post('purge')
  @Allow(ACTOR.TECH_HEAD)
  @ResponseMessage('Đã dọn thùng rác')
  async purge(@Body() dto: PurgeDevicesDto) {
    const count = await this.devices.purge(dto.ids);
    return { count };
  }
```

`device-orders.controller.ts`: bỏ import `OrderAccessGuard`, `OrderCreateGuard`, `Roles`, `ROLE`; thêm import `ACTOR, Allow`. Class:

```ts
@Controller('device-orders')
@UseGuards(AuthGuard)
@Allow(ACTOR.ADMIN, ACTOR.TECH_HEAD, ACTOR.TECH_COLLAB)
```

`create`: `@UseGuards(OrderCreateGuard)` → `@Allow(ACTOR.TECH_COLLAB)`. `approve`, `reject`: `@Roles(ROLE.ADMIN)` → `@Allow(ACTOR.TECH_HEAD)`.

`device-transfers.controller.ts`: bỏ import `Roles`, `TransferAccessGuard`, `TransferDecideGuard`, `ROLE`; thêm import `ACTOR, Allow`. Class: `@UseGuards(AuthGuard)` + `@Allow(ACTOR.ADMIN, ACTOR.TECH_HEAD, ACTOR.TECH_COLLAB)`. `create`: `@Roles(ROLE.ADMIN)` → `@Allow(ACTOR.TECH_COLLAB)`. `approve`, `reject`: `@UseGuards(TransferDecideGuard)` → `@Allow(ACTOR.TECH_HEAD)`.

Xoá:

```bash
git rm backend/src/shared/auth/device-write.guard.ts backend/src/shared/auth/order-access.guard.ts backend/src/shared/auth/order-create.guard.ts backend/src/shared/auth/transfer-access.guard.ts backend/src/shared/auth/transfer-decide.guard.ts backend/src/shared/auth/roles.decorator.ts
```

- [ ] **Step 4: Chạy, xác nhận pass** — `npm test` rồi `npm run lint`. Expected: xanh. Grep `@Roles|roles\.decorator|(Write|Access|Create|Decide)Guard` trong `backend/src` → 0 kết quả.

- [ ] **Step 5: Commit**

```bash
git add -A backend/src
git commit -m "feat(auth): phân lại quyền thiết bị/đơn/lệnh qua @Allow, bỏ guard theo miền"
```

---

### Task 3: Bắt buộc phòng ban cho Trưởng phòng / Cộng tác viên (backend)

**Files:**
- Modify: `backend/src/modules/users/users.service.ts:79-89`
- Test: `backend/src/modules/users/users.spec.ts` (`describe('POST /users')`)

**Interfaces:**
- Consumes: `DEPARTMENT_REQUIRED_ROLES` (Task 1).
- Produces: `POST /users` → 400 `Vui lòng chọn phòng ban` khi role TP/CTV mà `departmentId` thiếu hoặc `null`.

- [ ] **Step 1: Viết test fail.** Trong `describe('POST /users')`: test `không có departmentId: department null` gửi `{ ...body, roleId: 3, departmentId: undefined }` (Nhân viên vẫn được phép), rồi thêm:

```ts
    it.each([
      ['Trưởng phòng thiếu phòng ban', 2, undefined],
      ['Cộng tác viên thiếu phòng ban', 4, undefined],
      ['Cộng tác viên gửi departmentId: null', 4, null],
    ])('400 %s', async (_label, roleId, departmentId) => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({ ...body, roleId, departmentId })
        .expect(400);
      expect(res.body.message).toBe('Vui lòng chọn phòng ban');
      expect(prisma.users.some((u) => u.username === 'tp.ketoan')).toBe(false);
    });

    it('201 Cộng tác viên có phòng ban', async () => {
      const res = await http()
        .post('/users')
        .set('Authorization', tokenOf(admin))
        .send({ ...body, roleId: 4, departmentId: 1 })
        .expect(201);
      expect(res.body.data.role).toEqual({ id: 4, roleName: 'Cộng tác viên' });
      expect(res.body.data.department.departmentCode).toBe('KYTHUAT');
    });
```

- [ ] **Step 2: Chạy, xác nhận fail** — `npm test -- users.spec`. Expected: 3 case 400 FAIL (nhận 201).

- [ ] **Step 3: Cài đặt.** `users.service.ts`: thêm `import { DEPARTMENT_REQUIRED_ROLES } from '../identity/roles';`; thay hai khối kiểm role / phòng ban trong `create`:

```ts
    const role = await this.prisma.role.findUnique({
      where: { id: dto.roleId },
    });
    if (!role) throw new BadRequestException('Vai trò không tồn tại');
    // `== null`: @IsOptional cho cả null lẫn undefined lọt qua DTO.
    if (dto.departmentId == null) {
      if (DEPARTMENT_REQUIRED_ROLES.includes(role.roleName)) {
        throw new BadRequestException('Vui lòng chọn phòng ban');
      }
    } else if (
      !(await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      }))
    ) {
      throw new BadRequestException('Phòng ban không tồn tại');
    }
```

- [ ] **Step 4: Chạy, xác nhận pass** — `npm test`, `npm run lint`. Expected: xanh.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/users
git commit -m "feat(users): bắt buộc phòng ban khi tạo Trưởng phòng / Cộng tác viên"
```

---

### Task 4: Vòng đời "Đang chờ duyệt" trong Cấp phát - Thu hồi và Điều chuyển (backend)

**Files:**
- Modify: `backend/src/modules/devices/device-status.ts`
- Modify: `backend/src/modules/device-orders/device-orders.service.ts`
- Modify: `backend/src/modules/device-transfers/device-transfers.service.ts`
- Create: `backend/prisma/migrations/<timestamp>_device_pending_approval/migration.sql`
- Test: `backend/src/modules/device-orders/device-orders.spec.ts`, `backend/src/modules/device-transfers/device-transfers.spec.ts`

**Interfaces:**
- Consumes: biến `techHead`, `collab` trong spec (Task 2).
- Produces: `DEVICE_STATUS.PENDING_APPROVAL = 'Đang chờ duyệt'`; `pendingElsewhere(deviceCode: string): string`; `noLongerPending(deviceCode: string): string` (export từ `device-status.ts`). Vòng đời theo bảng mục 6.2 của spec. Approve **không ghi `departmentId` nữa**.

- [ ] **Step 1: Viết test fail.**

**`device-orders.spec.ts`:**
1. Xoá 2 test: `duyệt đơn khi thiết bị đã đổi trạng thái sau khi tạo đơn: 400, không ghi đè Device` và `2 đơn Cấp phát cùng nhắm 1 thiết bị, duyệt gần như đồng thời: …` (giữ chỗ lúc tạo thay thế cả hai tình huống).
2. Test `duyệt đơn Cấp phát: ghi đúng Device`: xoá dòng `expect(device.department.id).toBe(staff.departmentId);`.
3. Test `duyệt đơn Thu hồi: xoá currentUserId/departmentId/allocatedOn`: đổi tên thành `duyệt đơn Thu hồi: xoá người giữ và ngày cấp`, xoá dòng `expect(device.department).toBeNull();`.
4. Test `duyệt đơn khi người nhận đã bị xoá mềm sau khi tạo đơn: …`: dòng `expect(device.status).toBe('Trong kho');` → `expect(device.status).toBe('Đang chờ duyệt');`.
5. Test `từ chối ghi đúng lý do, không đổi Device` đổi tên thành `từ chối đơn Cấp phát: ghi lý do, thiết bị về "Trong kho"` (thân giữ nguyên).
6. Test `đơn Chờ duyệt cũ do chính Trưởng phòng Kỹ thuật tạo: vẫn duyệt được` (Task 2): ngay sau `const deviceId = await createDevice();` thêm `prisma.devices.find((d) => d.id === deviceId)!.status = 'Đang chờ duyệt';`.
7. Trong `describe('POST /device-orders')` thêm:

```ts
    it('tạo đơn giữ chỗ thiết bị ("Đang chờ duyệt"); đơn thứ hai cùng thiết bị: 400', async () => {
      const deviceId = await createDevice();
      const body = { type: 'Cấp phát', targetUserId: staff.id, deviceIds: [deviceId] };
      await http().post('/device-orders').set('Authorization', tokenOf(collab)).send(body).expect(201);
      expect(prisma.devices.find((d) => d.id === deviceId)!.status).toBe('Đang chờ duyệt');

      const res = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(collab))
        .send(body)
        .expect(400);
      expect(res.body.message).toBe('Thiết bị "LT-000001" đang chờ duyệt ở đơn/lệnh khác');
      expect(prisma.deviceOrders).toHaveLength(1);
    });

    it('2 đơn tạo gần như đồng thời cùng nhắm 1 thiết bị: đơn ghi sau bị chặn, chỉ còn 1 đơn', async () => {
      const otherStaff = addUser('staff2', 3, 1);
      const deviceId = await createDevice();
      const realTransaction = prisma.$transaction.getMockImplementation()!;
      // Chèn trọn việc tạo đơn 2 vào đúng lúc đơn 1 đã qua requireEligibleDevices (đọc ngoài
      // transaction, thấy thiết bị còn "Trong kho") nhưng chưa kịp ghi giữ chỗ.
      prisma.$transaction.mockImplementationOnce(
        async (fn: (tx: unknown) => Promise<unknown>) => {
          await http()
            .post('/device-orders')
            .set('Authorization', tokenOf(collab))
            .send({ type: 'Cấp phát', targetUserId: otherStaff.id, deviceIds: [deviceId] })
            .expect(201);
          return realTransaction(fn);
        },
      );

      const res = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(collab))
        .send({ type: 'Cấp phát', targetUserId: staff.id, deviceIds: [deviceId] })
        .expect(400);
      expect(res.body.message).toContain('không còn trong kho');
      expect(prisma.deviceOrders).toHaveLength(1);
      expect(prisma.deviceOrders[0].targetUserId).toBe(otherStaff.id);
    });
```

8. Trong `describe('PATCH /device-orders/:id/approve, /reject')` thêm:

```ts
    it('từ chối đơn Thu hồi: thiết bị về "Đã cấp phát", vẫn do người đó giữ', async () => {
      const deviceId = await createDevice({ currentUserId: staff.id });
      const created = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(collab))
        .send({ type: 'Thu hồi', targetUserId: staff.id, deviceIds: [deviceId] })
        .expect(201);
      await http()
        .patch(`/device-orders/${created.body.data.id}/reject`)
        .set('Authorization', tokenOf(techHead))
        .send({ reason: 'Chưa tới hạn thu hồi' })
        .expect(200);
      expect(prisma.devices.find((d) => d.id === deviceId)).toMatchObject({
        status: 'Đã cấp phát',
        currentUserId: staff.id,
      });
    });

    it('đơn cũ (trước khi có giữ chỗ) mà thiết bị chưa "Đang chờ duyệt": duyệt 400, đơn vẫn Chờ duyệt', async () => {
      const deviceId = await createDevice(); // "Trong kho" — migration không giữ chỗ được
      prisma.deviceOrders.push({
        id: 1,
        type: 'Cấp phát',
        status: 'Chờ duyệt',
        targetUserId: staff.id,
        note: null,
        createdById: techHead.id,
        decidedById: null,
        decidedAt: null,
        rejectReason: null,
        createdAt: new Date(),
      });
      prisma.deviceOrderItems.push({ id: 1, orderId: 1, deviceId });
      const res = await http()
        .patch('/device-orders/1/approve')
        .set('Authorization', tokenOf(techHead))
        .expect(400);
      expect(res.body.message).toBe('Thiết bị "LT-000001" không còn ở trạng thái chờ duyệt');
      expect(prisma.deviceOrders[0].status).toBe('Chờ duyệt');
    });
```

**`device-transfers.spec.ts`:**
1. Xoá 2 test: `duyệt khi thiết bị đã đổi chủ sau khi tạo lệnh: 400` và `duyệt đồng thời 2 lệnh cùng nhắm 1 thiết bị: lệnh thua báo lỗi, không ghi đè`.
2. Test `duyệt: chuyển đúng chủ, status không đổi`: xoá dòng `expect(device.department.id).toBe(staffB.departmentId);`.
3. Test `duyệt khi toUserId đã bị xoá mềm sau khi tạo lệnh: 400`: thêm cuối `expect(device.status).toBe('Đang chờ duyệt');`.
4. Test `từ chối ghi đúng lý do, không đổi Device`: đổi tên thành `từ chối: ghi lý do, thiết bị về "Đã cấp phát" của người giao`, thêm cuối `expect(device.status).toBe('Đã cấp phát');`.
5. Trong `describe('POST /device-transfers')` thêm:

```ts
    it('tạo lệnh giữ chỗ thiết bị; lệnh thứ hai hoặc đơn Thu hồi cùng thiết bị: 400', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      const body = { fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [deviceId] };
      await http().post('/device-transfers').set('Authorization', tokenOf(collab)).send(body).expect(201);
      expect(prisma.devices.find((d) => d.id === deviceId)!.status).toBe('Đang chờ duyệt');

      const again = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(collab))
        .send(body)
        .expect(400);
      expect(again.body.message).toBe('Thiết bị "LT-000001" đang chờ duyệt ở đơn/lệnh khác');

      const recover = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(collab))
        .send({ type: 'Thu hồi', targetUserId: staffA.id, deviceIds: [deviceId] })
        .expect(400);
      expect(recover.body.message).toBe('Thiết bị "LT-000001" đang chờ duyệt ở đơn/lệnh khác');
      expect(prisma.deviceTransfers).toHaveLength(1);
    });
```

6. Trong `describe('PATCH /device-transfers/:id/approve, /reject')` thêm:

```ts
    it('lệnh cũ (trước khi có giữ chỗ) mà thiết bị chưa "Đang chờ duyệt": duyệt 400, lệnh vẫn Chờ duyệt', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      prisma.deviceTransfers.push({
        id: 1,
        status: 'Chờ duyệt',
        fromUserId: staffA.id,
        toUserId: staffB.id,
        note: null,
        createdById: admin.id,
        decidedById: null,
        decidedAt: null,
        rejectReason: null,
        createdAt: new Date(),
      });
      prisma.deviceTransferItems.push({ id: 1, transferId: 1, deviceId });
      const res = await http()
        .patch('/device-transfers/1/approve')
        .set('Authorization', tokenOf(techHead))
        .expect(400);
      expect(res.body.message).toBe('Thiết bị "LT-000001" không còn ở trạng thái chờ duyệt');
      expect(prisma.deviceTransfers[0].status).toBe('Chờ duyệt');
    });
```

- [ ] **Step 2: Chạy, xác nhận fail** — `npm test -- device-orders device-transfers`. Expected: FAIL (thiết bị vẫn `Trong kho`/`Đã cấp phát` sau khi tạo; đơn thứ hai 201).

- [ ] **Step 3: Cài đặt.**

`device-status.ts` — thay `DEVICE_STATUS` và thêm 2 hàm (giữ nguyên phần còn lại của file ở task này):

```ts
/** Trạng thái thiết bị — lưu nguyên văn tiếng Việt trong DB, giống User.Status. */
export const DEVICE_STATUS = {
  IN_STOCK: 'Trong kho',
  ALLOCATED: 'Đã cấp phát',
  /** Đang nằm trong một đơn Cấp phát / Thu hồi hoặc lệnh Điều chuyển chờ duyệt — bị khoá. */
  PENDING_APPROVAL: 'Đang chờ duyệt',
  PENDING_DISPOSAL: 'Chờ thanh lý',
  DELETED: 'Đã xóa',
} as const;

/** Dùng chung cho Cấp phát - Thu hồi và Điều chuyển: thiết bị đã bị đơn/lệnh khác giữ chỗ. */
export const pendingElsewhere = (deviceCode: string) =>
  `Thiết bị "${deviceCode}" đang chờ duyệt ở đơn/lệnh khác`;

/** Lúc duyệt: thiết bị không còn ở trạng thái giữ chỗ (dữ liệu cũ, hoặc đã bị xử lý). */
export const noLongerPending = (deviceCode: string) =>
  `Thiết bị "${deviceCode}" không còn ở trạng thái chờ duyệt`;
```

`device-orders.service.ts`:
- import: `import { DEVICE_STATUS, noLongerPending, pendingElsewhere } from '../devices/device-status';`
- thay `create`, `approve`, `reject`:

```ts
  async create(dto: CreateDeviceOrderDto, createdById: number) {
    const targetUser = await this.requireUser(dto.targetUserId);
    const devicesById = await this.requireEligibleDevices(
      dto.type,
      dto.deviceIds,
      targetUser.id,
    );

    const order = await this.prisma.$transaction(async (tx) => {
      // Giữ chỗ ngay khi tạo: thiết bị sang "Đang chờ duyệt", đơn/lệnh khác không lấy được nữa.
      await this.writeDevices(
        tx,
        dto.deviceIds,
        this.eligibleWhere(dto.type, targetUser.id),
        { status: DEVICE_STATUS.PENDING_APPROVAL },
        (deviceId) =>
          this.ineligibleMessage(dto.type, devicesById.get(deviceId)!.deviceCode),
      );
      return tx.deviceOrder.create({
        data: {
          type: dto.type,
          note: dto.note ?? null,
          targetUserId: dto.targetUserId,
          createdById,
          items: { create: dto.deviceIds.map((deviceId) => ({ deviceId })) },
        },
        include: WITH_RELATIONS,
      });
    });
    return toDetail(order);
  }

  async approve(id: number, decidedById: number) {
    const order = await this.findPendingOrder(id);
    // Người nhận có thể đã bị xoá mềm SAU khi đơn được tạo — kiểm tra lại trước khi duyệt.
    await this.requireUser(order.targetUserId);
    const codeOf = (deviceId: number) =>
      order.items.find((i) => i.deviceId === deviceId)!.device.deviceCode;

    await this.prisma.$transaction(async (tx) => {
      await this.writeDevices(
        tx,
        order.items.map((i) => i.deviceId),
        this.pendingWhere(order.type, order.targetUserId),
        order.type === ORDER_TYPE.ALLOCATE
          ? {
              status: DEVICE_STATUS.ALLOCATED,
              currentUserId: order.targetUserId,
              allocatedOn: new Date(),
            }
          : {
              status: DEVICE_STATUS.IN_STOCK,
              currentUserId: null,
              allocatedOn: null,
            },
        (deviceId) => noLongerPending(codeOf(deviceId)),
      );
      await this.decide(tx, id, decidedById, ORDER_STATUS.APPROVED);
    });

    return this.getById(id);
  }

  async reject(id: number, decidedById: number, reason: string) {
    const order = await this.findPendingOrder(id);
    await this.prisma.$transaction(async (tx) => {
      await this.decide(tx, id, decidedById, ORDER_STATUS.REJECTED, reason);
      // Chỉ trả lại thiết bị còn "Đang chờ duyệt": dữ liệu trước khi có giữ chỗ có thể có thiết bị
      // nằm trong nhiều đơn/lệnh cùng lúc, cái khác có thể đã được duyệt.
      await tx.device.updateMany({
        where: {
          id: { in: order.items.map((i) => i.deviceId) },
          status: DEVICE_STATUS.PENDING_APPROVAL,
        },
        data: {
          status:
            order.type === ORDER_TYPE.ALLOCATE
              ? DEVICE_STATUS.IN_STOCK
              : DEVICE_STATUS.ALLOCATED,
        },
      });
    });
    return this.getById(id);
  }
```

- helpers: trong `requireEligibleDevices`, ngay sau dòng `if (!device) throw …` thêm:

```ts
      if (device.status === DEVICE_STATUS.PENDING_APPROVAL) {
        throw new BadRequestException(pendingElsewhere(device.deviceCode));
      }
```

  và thêm hai helper (đặt sau `eligibleWhere`):

```ts
  /** Where lúc duyệt: thiết bị phải còn đang được chính đơn này giữ chỗ. */
  private pendingWhere(type: string, targetUserId: number) {
    return type === ORDER_TYPE.ALLOCATE
      ? { status: DEVICE_STATUS.PENDING_APPROVAL }
      : { status: DEVICE_STATUS.PENDING_APPROVAL, currentUserId: targetUserId };
  }

  /** Ghi Device có điều kiện: `where` lặp lại đúng điều kiện đã kiểm, ngay trong câu update —
   *  count=0 nghĩa là thiết bị đã đổi giữa lúc đọc và lúc ghi (đơn/lệnh khác chen vào). */
  private async writeDevices(
    tx: Pick<PrismaService, 'device'>,
    deviceIds: number[],
    where: Prisma.DeviceWhereInput,
    data: Prisma.DeviceUncheckedUpdateManyInput,
    failMessage: (deviceId: number) => string,
  ) {
    for (const deviceId of deviceIds) {
      const { count } = await tx.device.updateMany({
        where: { id: deviceId, ...where },
        data,
      });
      if (count === 0) throw new BadRequestException(failMessage(deviceId));
    }
  }
```

  Cập nhật comment `ORDER_STATUS` ở `device-order-status.ts`: `chỉ Admin đổi` → `chỉ Trưởng phòng Kỹ thuật đổi`. Không còn dùng biến `devicesById` trong `approve`; import `type Device` vẫn dùng ở `isEligible`.

`device-transfers.service.ts`:
- import: `import { DEVICE_STATUS, noLongerPending, pendingElsewhere } from '../devices/device-status';`
- thay `create`, `approve`, `reject`:

```ts
  async create(dto: CreateDeviceTransferDto, createdById: number) {
    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException('Người nhận phải khác người đang giữ');
    }
    await this.requireUser(dto.fromUserId);
    await this.requireUser(dto.toUserId);
    const devicesById = await this.requireEligibleDevices(dto.deviceIds, dto.fromUserId);

    const transfer = await this.prisma.$transaction(async (tx) => {
      // Giữ chỗ ngay khi tạo: thiết bị sang "Đang chờ duyệt", đơn/lệnh khác không lấy được nữa.
      await this.writeDevices(
        tx,
        dto.deviceIds,
        this.eligibleWhere(dto.fromUserId),
        { status: DEVICE_STATUS.PENDING_APPROVAL },
        (deviceId) => this.ineligibleMessage(devicesById.get(deviceId)!.deviceCode),
      );
      return tx.deviceTransfer.create({
        data: {
          note: dto.note ?? null,
          fromUserId: dto.fromUserId,
          toUserId: dto.toUserId,
          createdById,
          items: { create: dto.deviceIds.map((deviceId) => ({ deviceId })) },
        },
        include: WITH_RELATIONS,
      });
    });
    return toDetail(transfer);
  }

  async approve(id: number, decidedById: number) {
    const transfer = await this.findPendingTransfer(id);
    // Người nhận có thể đã bị xoá mềm SAU khi lệnh được tạo — kiểm tra lại trước khi duyệt.
    await this.requireUser(transfer.toUserId);
    const codeOf = (deviceId: number) =>
      transfer.items.find((i) => i.deviceId === deviceId)!.device.deviceCode;

    await this.prisma.$transaction(async (tx) => {
      await this.writeDevices(
        tx,
        transfer.items.map((i) => i.deviceId),
        { status: DEVICE_STATUS.PENDING_APPROVAL, currentUserId: transfer.fromUserId },
        {
          status: DEVICE_STATUS.ALLOCATED,
          currentUserId: transfer.toUserId,
          allocatedOn: new Date(),
        },
        (deviceId) => noLongerPending(codeOf(deviceId)),
      );
      await this.decide(tx, id, decidedById, TRANSFER_STATUS.APPROVED);
    });

    return this.getById(id);
  }

  async reject(id: number, decidedById: number, reason: string) {
    const transfer = await this.findPendingTransfer(id);
    await this.prisma.$transaction(async (tx) => {
      await this.decide(tx, id, decidedById, TRANSFER_STATUS.REJECTED, reason);
      // Chỉ trả lại thiết bị còn "Đang chờ duyệt" — xem ghi chú cùng chỗ ở device-orders.service.ts.
      await tx.device.updateMany({
        where: {
          id: { in: transfer.items.map((i) => i.deviceId) },
          status: DEVICE_STATUS.PENDING_APPROVAL,
        },
        data: { status: DEVICE_STATUS.ALLOCATED },
      });
    });
    return this.getById(id);
  }
```

- trong `requireEligibleDevices`, sau `if (!device) throw …` thêm cùng khối kiểm `PENDING_APPROVAL` → `pendingElsewhere(device.deviceCode)` như bên đơn; thêm helper `writeDevices` (y hệt code bên `device-orders.service.ts` ở trên — mỗi module giữ bản riêng, như quy ước tách guard/hằng số theo miền đã có).

**Migration dữ liệu.** Trong `backend/`: `npx prisma migrate dev --create-only --name device_pending_approval`, rồi ghi `migration.sql` vừa sinh thành:

```sql
-- Thiết bị đang nằm trong đơn/lệnh "Chờ duyệt" tạo trước khi có giữ chỗ → "Đang chờ duyệt", để duyệt /
-- từ chối các đơn/lệnh đó chạy đúng luồng mới. Chỉ đổi thiết bị còn đúng điều kiện tạo của đơn/lệnh.
-- ponytail: thiết bị nằm trong nhiều đơn/lệnh chờ duyệt cùng lúc (được phép trước đây) chỉ được giữ chỗ
-- cho một — Trưởng phòng Kỹ thuật cần từ chối bớt đơn/lệnh trùng trước khi duyệt.
UPDATE "Device" AS d SET "Status" = 'Đang chờ duyệt'
FROM "DeviceOrderItem" AS i
JOIN "DeviceOrder" AS o ON o."Id" = i."OrderId"
WHERE i."DeviceId" = d."Id"
  AND o."Status" = 'Chờ duyệt'
  AND (
    (o."Type" = 'Cấp phát' AND d."Status" = 'Trong kho')
    OR (o."Type" = 'Thu hồi' AND d."Status" = 'Đã cấp phát' AND d."CurrentUserId" = o."TargetUserId")
  );

UPDATE "Device" AS d SET "Status" = 'Đang chờ duyệt'
FROM "DeviceTransferItem" AS i
JOIN "DeviceTransfer" AS t ON t."Id" = i."TransferId"
WHERE i."DeviceId" = d."Id"
  AND t."Status" = 'Chờ duyệt'
  AND d."Status" = 'Đã cấp phát'
  AND d."CurrentUserId" = t."FromUserId";
```

Áp: `npx prisma migrate dev`. Expected: migration áp thành công, không đòi reset DB.

- [ ] **Step 4: Chạy, xác nhận pass** — `npm test`, `npm run lint`. Expected: xanh.

- [ ] **Step 5: Commit**

```bash
git add backend/src backend/prisma/migrations
git commit -m "feat(device): giữ chỗ thiết bị \"Đang chờ duyệt\" khi tạo đơn/lệnh, trả lại khi từ chối"
```

---

### Task 5: Khoá API thiết bị và bỏ `Device.DepartmentId` (backend)

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `Device`, model `Department`)
- Create: `backend/prisma/migrations/<timestamp>_drop_device_department/migration.sql` (sinh tự động)
- Modify: `backend/src/modules/devices/device-status.ts`, `devices.dto.ts`, `devices.service.ts`
- Modify: `backend/src/test/fake-prisma.ts`
- Test: `backend/src/modules/devices/devices.spec.ts`, `device-orders/device-orders.spec.ts`, `device-transfers/device-transfers.spec.ts`

**Interfaces:**
- Consumes: `DEVICE_STATUS.PENDING_APPROVAL` (Task 4).
- Produces: `DEVICE_PENDING = 'Thiết bị đang chờ duyệt, không thể sửa hoặc xoá'` (export từ `devices.service.ts`). Item thiết bị **không còn** field `department`. `CreateDeviceDto`/`UpdateDeviceDto` không còn `currentUserId`, `departmentId`, `allocatedOn`, `status`; `ListDevicesQuery` không còn `departmentId`.

- [ ] **Step 1: Viết test fail.**

Thêm helper vào **cả ba** spec (`devices.spec.ts` ngay sau `tokenOf`; hai spec còn lại ngay sau `createDevice`):

```ts
  /** Dựng thẳng "Đã cấp phát" trong fake — API thiết bị không còn gán người giữ (chỉ đơn/lệnh). */
  function allocate(deviceId: number, holder: User): number {
    Object.assign(prisma.devices.find((d) => d.id === deviceId)!, {
      status: 'Đã cấp phát',
      currentUserId: holder.id,
      allocatedOn: new Date('2026-01-01'),
    });
    return deviceId;
  }
```

**`devices.spec.ts`:**
1. Thay test `đặt trạng thái "Đã cấp phát" khi có người sở hữu` bằng:

```ts
  it('POST lờ đi currentUserId/departmentId/allocatedOn: thiết bị mới luôn "Trong kho", không người giữ', async () => {
    const res = await http()
      .post('/devices')
      .set('Authorization', tokenOf(techHead))
      .send(newDevice({ currentUserId: staff.id, departmentId: 1, allocatedOn: '2026-01-01' }))
      .expect(201);
    expect(res.body.data).toMatchObject({ status: 'Trong kho', currentUser: null, allocatedOn: null });
    expect(res.body.data).not.toHaveProperty('department');
  });
```

2. Test `lọc theo currentUserId`: thay request tạo `owned` (đang gửi `currentUserId: staff.id`) bằng:

```ts
    const owned = await http()
      .post('/devices')
      .set('Authorization', tokenOf(techHead))
      .send(newDevice())
      .expect(201);
    allocate(owned.body.data.id, staff);
```

3. Thay test `PATCH không cho đặt trạng thái "Đã xóa"` bằng:

```ts
  it('PATCH lờ đi status/currentUserId/allocatedOn, chỉ sửa thông tin thiết bị', async () => {
    const created = await http()
      .post('/devices')
      .set('Authorization', tokenOf(techHead))
      .send(newDevice())
      .expect(201);
    const res = await http()
      .patch(`/devices/${created.body.data.id}`)
      .set('Authorization', tokenOf(techHead))
      .send({ status: 'Đã cấp phát', currentUserId: staff.id, allocatedOn: '2026-01-01', deviceName: 'Đổi tên' })
      .expect(200);
    expect(res.body.data).toMatchObject({
      status: 'Trong kho',
      currentUser: null,
      allocatedOn: null,
      deviceName: 'Đổi tên',
    });
  });

  it('thiết bị "Đang chờ duyệt": PATCH và DELETE đều 400, không đổi gì', async () => {
    const created = await http()
      .post('/devices')
      .set('Authorization', tokenOf(techHead))
      .send(newDevice())
      .expect(201);
    const id = created.body.data.id;
    prisma.devices.find((d) => d.id === id)!.status = 'Đang chờ duyệt';

    const patch = await http()
      .patch(`/devices/${id}`)
      .set('Authorization', tokenOf(collab))
      .send({ deviceName: 'X' })
      .expect(400);
    expect(patch.body.message).toBe('Thiết bị đang chờ duyệt, không thể sửa hoặc xoá');
    await http().delete(`/devices/${id}`).set('Authorization', tokenOf(techHead)).expect(400);
    expect(prisma.devices.find((d) => d.id === id)).toMatchObject({
      status: 'Đang chờ duyệt',
      deviceName: 'Dell Latitude 5420',
    });
  });
```

**`device-orders.spec.ts`:** mọi lời gọi `createDevice({ currentUserId: <u>.id, … })` (kể cả kèm `departmentId`/`allocatedOn`) → `allocate(await createDevice(), <u>)`. Các chỗ: `tạo đơn Thu hồi thành công`, `Cấp phát thiết bị không còn trong kho: 400`, `Thu hồi thiết bị không do người này giữ: 400`, `duyệt đơn Thu hồi: xoá người giữ và ngày cấp`, `từ chối đơn Thu hồi: …`. Sau đó grep `currentUserId:` trong file chỉ còn ở các `toMatchObject`/`expect`, không còn trong body gửi lên.

**`device-transfers.spec.ts`:** thân `createAllocatedDevice` → `return allocate(await createDevice(over), holder);`.

- [ ] **Step 2: Chạy, xác nhận fail** — `npm test -- devices.spec`. Expected: FAIL (POST với `currentUserId` cho `Đã cấp phát`; PATCH thiết bị chờ duyệt 200).

- [ ] **Step 3: Cài đặt.**

`schema.prisma`: trong `model Device` xoá dòng `departmentId  Int? @map("DepartmentId")` và dòng `department  Department? @relation(fields: [departmentId], references: [id])`; trong `model Department` xoá dòng `devices Device[]`. Chạy trong `backend/`: `npx prisma migrate dev --name drop_device_department`. Đọc `migration.sql` sinh ra: phải chỉ có `DROP CONSTRAINT "Device_DepartmentId_fkey"` và `DROP COLUMN "DepartmentId"` trên `"Device"`.

`device-status.ts`: xoá `ASSIGNABLE_DEVICE_STATUSES` (cả comment của nó).

`devices.dto.ts`:
- import từ `./device-status` chỉ còn `DEVICE_CODE_MESSAGE, DEVICE_CODE_PATTERN, DEVICE_STATUS`.
- `ListDevicesQuery`: xoá field `departmentId` (cả 5 decorator). Comment trên `status` thành `// Lọc danh sách chấp nhận mọi trạng thái, kể cả "Đã xóa".`
- `CreateDeviceDto` và `UpdateDeviceDto`: xoá các field `departmentId`, `currentUserId`, `allocatedOn` (kèm decorator); `UpdateDeviceDto` xoá thêm `status`. Comment trên `UpdateDeviceDto` thành `/** Mọi trường của Create ở dạng optional. Người giữ / trạng thái chỉ đổi qua đơn/lệnh được duyệt. */`.

`devices.service.ts`:
- thêm `export const DEVICE_PENDING = 'Thiết bị đang chờ duyệt, không thể sửa hoặc xoá';`
- `DEVICE_WITH_RELATIONS`: xoá `department: true`. `toDeviceItem`: xoá khối `department: …`.
- `list`: tham số và `where` bỏ `departmentId`.
- `create`: xoá `await this.requireDepartment(dto.departmentId);` và `await this.requireUser(dto.currentUserId);`; `status` thành:

```ts
          // Thiết bị mới luôn vào kho — người giữ chỉ được gán khi đơn Cấp phát được duyệt.
          status: DEVICE_STATUS.IN_STOCK,
```

- `update`: ngay sau `const current = await this.findLiveDevice(id);` thêm `this.requireNotPending(current.status);`; xoá `requireDepartment`/`requireUser` và dòng `...(dto.status ? { status: dto.status } : {}),`.
- `softDelete`:

```ts
  async softDelete(id: number): Promise<void> {
    const current = await this.findLiveDevice(id);
    this.requireNotPending(current.status);
    await this.prisma.device.update({
      where: { id },
      data: { status: DEVICE_STATUS.DELETED },
    });
  }
```

- `createScalars` và `updateScalars`: xoá 3 dòng `departmentId`, `currentUserId`, `allocatedOn`.
- xoá helper `requireDepartment`, `requireUser`; thêm:

```ts
  /** Thiết bị đang nằm trong đơn/lệnh chờ duyệt bị khoá — sửa/xoá lúc này làm lệch đơn/lệnh đó. */
  private requireNotPending(status: string) {
    if (status === DEVICE_STATUS.PENDING_APPROVAL) {
      throw new BadRequestException(DEVICE_PENDING);
    }
  }
```

`fake-prisma.ts`: `DeviceInclude` xoá `department?: boolean;`; `DeviceWithRelations` xoá `department?: Department | null;`; `withDeviceRelations` xoá khối `...(include.department && { department: … })`; trong `device.create` xoá dòng `departmentId: null,`.

- [ ] **Step 4: Chạy, xác nhận pass** — `npm test`, `npm run lint`. Expected: xanh. Grep `departmentId` trong `backend/src/modules/devices`, `device-orders/*.service.ts`, `device-transfers/*.service.ts` → 0 kết quả.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma backend/src
git commit -m "feat(device): chỉ đơn/lệnh mới đổi người giữ; bỏ Device.DepartmentId, khoá sửa/xoá khi chờ duyệt"
```

---

### Task 6: Frontend — helper quyền trong `session.ts`

**Files:**
- Modify: `frontend/src/modules/auth/domain/session.ts:13-44`
- Test: `frontend/src/modules/auth/domain/session.test.ts`, `frontend/src/modules/allocation/presentation/DeviceOrderListPage.test.tsx`, `frontend/src/modules/transfer/presentation/DeviceTransferListPage.test.tsx`

**Interfaces:**
- Produces (đều `(session: AuthSession | null) => boolean`): `isAdmin`, `isTechHead`, `isTechCollab`, `canWriteDevices`, `canDeleteDevices` (mới), `canAccessOrders`, `canCreateOrder`, `canDecideOrder`, `canAccessTransfers`, `canCreateTransfer`, `canDecideTransfer`; hằng `ADMIN_ROLE`, `HEAD_ROLE`, `COLLAB_ROLE`, `TECH_DEPARTMENT_CODE`.

- [ ] **Step 1: Viết test fail.**

`session.test.ts` — dòng import thành:

```ts
import { canWriteDevices, canDeleteDevices, canAccessOrders, canCreateOrder, canDecideOrder, canAccessTransfers, canCreateTransfer, canDecideTransfer, isAdmin, isTokenExpired, type AuthSession } from './session';
```

và thay mọi test từ `cho phép Quản trị viên ghi thiết bị` tới hết file bằng:

```ts
const as = (roleName: string, departmentCode: string | null): AuthSession => ({ ...base, roleName, departmentCode });
const admin = as('Quản trị viên', null);
const techHead = as('Trưởng phòng', 'KYTHUAT');
const techCollab = as('Cộng tác viên', 'KYTHUAT');
// Không khớp vai nào: Kế toán, không phòng ban (dữ liệu cũ), Nhân viên, chưa đăng nhập.
const outsiders = [
  as('Trưởng phòng', 'KETOAN'),
  as('Cộng tác viên', 'KETOAN'),
  as('Trưởng phòng', null),
  as('Cộng tác viên', null),
  as('Nhân viên', 'KYTHUAT'),
  null,
];

it.each([
  ['canWriteDevices', canWriteDevices, false, true, true],
  ['canDeleteDevices', canDeleteDevices, false, true, false],
  ['canAccessOrders', canAccessOrders, true, true, true],
  ['canCreateOrder', canCreateOrder, false, false, true],
  ['canDecideOrder', canDecideOrder, false, true, false],
  ['canAccessTransfers', canAccessTransfers, true, true, true],
  ['canCreateTransfer', canCreateTransfer, false, false, true],
  ['canDecideTransfer', canDecideTransfer, false, true, false],
])('%s: Admin / TP Kỹ thuật / CTV Kỹ thuật', (_name, can, forAdmin, forHead, forCollab) => {
  expect(can(admin)).toBe(forAdmin);
  expect(can(techHead)).toBe(forHead);
  expect(can(techCollab)).toBe(forCollab);
  for (const s of outsiders) expect(can(s)).toBe(false);
});
```

`DeviceOrderListPage.test.tsx` — thay 3 test cuối bằng:

```tsx
it('Cộng tác viên Kỹ thuật: thấy nút "Tạo đơn", không thấy Duyệt/Từ chối', async () => {
  renderPage('Cộng tác viên', 'KYTHUAT');
  await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Tạo đơn' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
});

it('Trưởng phòng Kỹ thuật: thấy Duyệt/Từ chối trên đơn Chờ duyệt, không thấy "Tạo đơn"', async () => {
  renderPage('Trưởng phòng', 'KYTHUAT');
  await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Tạo đơn' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Duyệt' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Từ chối' })).toBeInTheDocument();
});

it('Quản trị viên chỉ xem: không "Tạo đơn", không Duyệt/Từ chối', async () => {
  renderPage('Quản trị viên', null);
  await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Tạo đơn' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Từ chối' })).toBeNull();
});

it('Quản trị viên: đơn "Đã duyệt" vẫn hiện nút "In biên bản"', async () => {
  renderPage('Quản trị viên', null, [order(1, 'Đã duyệt')]);
  await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'In biên bản' })).toBeInTheDocument();
});
```

`DeviceTransferListPage.test.tsx` — thay test đầu (`Admin: thấy nút "Tạo lệnh"…`) bằng hai test sau, giữ nguyên hai test Trưởng phòng Kỹ thuật:

```tsx
it('Cộng tác viên Kỹ thuật: thấy nút "Tạo lệnh", không thấy Duyệt/Từ chối', async () => {
  renderPage('Cộng tác viên', 'KYTHUAT');
  await waitFor(() => expect(screen.getByText('Nhân viên A')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Tạo lệnh' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
});

it('Quản trị viên chỉ xem: không "Tạo lệnh", không Duyệt/Từ chối', async () => {
  renderPage('Quản trị viên', null);
  await waitFor(() => expect(screen.getByText('Nhân viên A')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Tạo lệnh' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
});
```

- [ ] **Step 2: Chạy, xác nhận fail** — trong `frontend/`: `npm test -- session DeviceOrderListPage DeviceTransferListPage`. Expected: FAIL.

- [ ] **Step 3: Cài đặt.** Trong `session.ts` thay khối từ `export const ADMIN_ROLE` tới hết `canDecideTransfer`:

```ts
export const ADMIN_ROLE = 'Quản trị viên';
export const HEAD_ROLE = 'Trưởng phòng';
export const COLLAB_ROLE = 'Cộng tác viên';
export const TECH_DEPARTMENT_CODE = 'KYTHUAT';

// Backend mới là chốt chặn thật (backend/src/shared/auth/actors.ts) — các hàm dưới chỉ để ẩn/hiện UI.
type Can = (session: AuthSession | null) => boolean;

export const isAdmin: Can = (session) => session?.roleName === ADMIN_ROLE;

export const isTechHead: Can = (session) =>
  session?.roleName === HEAD_ROLE && session?.departmentCode === TECH_DEPARTMENT_CODE;

export const isTechCollab: Can = (session) =>
  session?.roleName === COLLAB_ROLE && session?.departmentCode === TECH_DEPARTMENT_CODE;

const isTechTeam: Can = (session) => isTechHead(session) || isTechCollab(session);
const isAdminOrTechTeam: Can = (session) => isAdmin(session) || isTechTeam(session);

/** Thêm/sửa thông tin thiết bị: Trưởng phòng Kỹ thuật hoặc Cộng tác viên Kỹ thuật. */
export const canWriteDevices = isTechTeam;

/** Xoá mềm + dọn thùng rác thiết bị: CHỈ Trưởng phòng Kỹ thuật. */
export const canDeleteDevices = isTechHead;

/** Xem đơn Cấp phát - Thu hồi: Quản trị viên (chỉ xem), Trưởng phòng và Cộng tác viên Kỹ thuật. */
export const canAccessOrders = isAdminOrTechTeam;

/** Tạo đơn: CHỈ Cộng tác viên Kỹ thuật. */
export const canCreateOrder = isTechCollab;

/** Duyệt/từ chối đơn: CHỈ Trưởng phòng Kỹ thuật. */
export const canDecideOrder = isTechHead;

/** Xem lệnh Điều chuyển: cùng tập với canAccessOrders. */
export const canAccessTransfers = isAdminOrTechTeam;

/** Tạo lệnh điều chuyển: CHỈ Cộng tác viên Kỹ thuật. */
export const canCreateTransfer = isTechCollab;

/** Duyệt/từ chối lệnh điều chuyển: CHỈ Trưởng phòng Kỹ thuật. */
export const canDecideTransfer = isTechHead;
```

- [ ] **Step 4: Chạy, xác nhận pass** — `npm test`, `npm run lint`. Expected: xanh.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/auth/domain frontend/src/modules/allocation/presentation/DeviceOrderListPage.test.tsx frontend/src/modules/transfer/presentation/DeviceTransferListPage.test.tsx
git commit -m "feat(auth): helper quyền FE theo role Cộng tác viên"
```

---

### Task 7: Frontend — route guard và quyền trên danh mục thiết bị

**Files:**
- Create: `frontend/src/app/session/RequireCan.tsx`, `frontend/src/app/session/RequireCan.test.tsx`
- Modify: `frontend/src/app/router.tsx`
- Delete: `frontend/src/app/session/{RequireAdmin,RequireOrderAccess,RequireTransferAccess}.tsx`
- Modify: `frontend/src/modules/device/presentation/DeviceCatalogPage.tsx:5,25,39,70-93`
- Test: `frontend/src/modules/device/presentation/DeviceCatalogPage.test.tsx`

**Interfaces:**
- Consumes: helper của Task 6; `useSession()` từ `./SessionContext`.
- Produces: `RequireCan({ can, to? })` — `can: (s: AuthSession | null) => boolean`, `to` mặc định `'/dashboard'`.

- [ ] **Step 1: Viết test fail.**

`RequireCan.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { canWriteDevices } from '@/modules/auth/domain/session';
import { fakeJwt, inOneHour } from '@/test/fakeJwt';
import { RequireCan } from './RequireCan';
import { SessionProvider } from './SessionContext';

afterEach(() => localStorage.clear());

function openDeviceForm(roleName: string, departmentCode: string | null) {
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
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={['/devices/new']}>
        <Routes>
          <Route element={<RequireCan can={canWriteDevices} to="/devices" />}>
            <Route path="/devices/new" element={<p>FORM</p>} />
          </Route>
          <Route path="/devices" element={<p>LIST</p>} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );
}

it('Cộng tác viên Kỹ thuật vào được trang thêm thiết bị', () => {
  openDeviceForm('Cộng tác viên', 'KYTHUAT');
  expect(screen.getByText('FORM')).toBeInTheDocument();
});

it('Quản trị viên gõ thẳng URL trang thêm thiết bị: bị đưa về danh sách', () => {
  openDeviceForm('Quản trị viên', null);
  expect(screen.queryByText('FORM')).toBeNull();
  expect(screen.getByText('LIST')).toBeInTheDocument();
});
```

`DeviceCatalogPage.test.tsx` — `renderPage(roleName: string)` → `renderPage(roleName: string, departmentCode: string | null = null)` và dùng `departmentCode` trong object session. Thay 3 test cuối bằng:

```tsx
it('Dọn thùng rác (Trưởng phòng Kỹ thuật, đang lọc "Đã xóa"): xoá vĩnh viễn toàn bộ thiết bị đang hiển thị', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const fetchMock = renderPage('Trưởng phòng', 'KYTHUAT');
  await waitFor(() => expect(screen.getByText('LT-000001')).toBeInTheDocument());

  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Đã xóa' } });
  await waitFor(() => expect(screen.getByText('PC-000009')).toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: 'Dọn thùng rác' }));

  await waitFor(() => expect(screen.getByText('Không tìm thấy thiết bị nào')).toBeInTheDocument());
  const purgeCall = fetchMock.mock.calls.find((c) => (c[0] as string).endsWith('/devices/purge'))!;
  expect(JSON.parse((purgeCall[1] as RequestInit).body as string)).toEqual({ ids: [9] });
});

it('Trưởng phòng Kỹ thuật chưa lọc "Đã xóa": không thấy "Dọn thùng rác", thấy Xoá và Xem', async () => {
  renderPage('Trưởng phòng', 'KYTHUAT');
  await waitFor(() => expect(screen.getByText('LT-000001')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Dọn thùng rác' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Xoá thiết bị' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xem chi tiết' })).toBeInTheDocument();
});

it('Cộng tác viên Kỹ thuật: thêm/sửa được, không thấy Xoá và "Dọn thùng rác"', async () => {
  renderPage('Cộng tác viên', 'KYTHUAT');
  await waitFor(() => expect(screen.getByText('LT-000001')).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Thêm thiết bị' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Xem chi tiết' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Xoá thiết bị' })).toBeNull();

  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Đã xóa' } });
  await waitFor(() => expect(screen.getByText('PC-000009')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Dọn thùng rác' })).toBeNull();
});

it('Quản trị viên chỉ xem: không Thêm, không Xoá, không Xem chi tiết, không "Dọn thùng rác"', async () => {
  renderPage('Quản trị viên');
  await waitFor(() => expect(screen.getByText('LT-000001')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Thêm thiết bị' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Xoá thiết bị' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Xem chi tiết' })).toBeNull();

  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Đã xóa' } });
  await waitFor(() => expect(screen.getByText('PC-000009')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Dọn thùng rác' })).toBeNull();
});
```

- [ ] **Step 2: Chạy, xác nhận fail** — `npm test -- RequireCan DeviceCatalogPage`. Expected: FAIL.

- [ ] **Step 3: Cài đặt.**

`frontend/src/app/session/RequireCan.tsx`:

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import type { AuthSession } from '@/modules/auth/domain/session';
import { useSession } from './SessionContext';

/** Route guard theo quyền: `can(session)` sai thì chuyển về `to`. Đặt bên trong <RequireAuth/>. */
export function RequireCan({
  can,
  to = '/dashboard',
}: {
  can: (session: AuthSession | null) => boolean;
  to?: string;
}) {
  const { session } = useSession();
  return can(session) ? <Outlet /> : <Navigate to={to} replace />;
}
```

`router.tsx`: bỏ 3 import `RequireAdmin`, `RequireOrderAccess`, `RequireTransferAccess`; thêm

```tsx
import { RequireCan } from './session/RequireCan';
import {
  canAccessOrders,
  canAccessTransfers,
  canCreateOrder,
  canCreateTransfer,
  canWriteDevices,
  isAdmin,
} from '@/modules/auth/domain/session';
```

và thay `children` của `<AppShell />`:

```tsx
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/devices', element: <DeviceCatalogPage /> },
          {
            element: <RequireCan can={canWriteDevices} to="/devices" />,
            children: [
              { path: '/devices/new', element: <AssetFormPage /> },
              { path: '/devices/:id/edit', element: <AssetFormPage /> },
            ],
          },
          {
            element: <RequireCan can={canAccessOrders} />,
            children: [
              { path: '/allocation', element: <DeviceOrderListPage /> },
              {
                element: <RequireCan can={canCreateOrder} to="/allocation" />,
                children: [{ path: '/allocation/new', element: <CreateOrderPage /> }],
              },
            ],
          },
          {
            element: <RequireCan can={isAdmin} />,
            children: [
              { path: '/users', element: <UserListPage /> },
              { path: '/users/new', element: <CreateUserPage /> },
            ],
          },
          { path: '/settings', element: <UserSettingsPage /> },
          {
            element: <RequireCan can={canAccessTransfers} />,
            children: [
              { path: '/transfers', element: <DeviceTransferListPage /> },
              {
                element: <RequireCan can={canCreateTransfer} to="/transfers" />,
                children: [{ path: '/transfers/new', element: <CreateTransferPage /> }],
              },
            ],
          },
          { path: '/audit', element: <ComingSoonPage title="Kiểm kê" /> },
        ],
```

Xoá:

```bash
git rm frontend/src/app/session/RequireAdmin.tsx frontend/src/app/session/RequireOrderAccess.tsx frontend/src/app/session/RequireTransferAccess.tsx
```

`DeviceCatalogPage.tsx`:
- import `import { canDeleteDevices, canWriteDevices } from '@/modules/auth/domain/session';`
- sau `const canWrite = …` thêm `const canDelete = canDeleteDevices(session);`
- `const canPurge = status === DEVICE_STATUS.DELETED && canDelete;`
- cell `actions`:

```tsx
      cell: (d) =>
        !canWrite ? null : (
          <div className="flex justify-end gap-1 text-ink-muted">
            {canDelete && (
              <button
                type="button"
                className={ICON_BTN}
                disabled={del.pending}
                aria-label="Xoá thiết bị"
                title="Xoá thiết bị"
                onClick={() => void del.run(d)}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              className={ICON_BTN}
              aria-label="Xem chi tiết"
              title="Xem chi tiết"
              onClick={() => navigate(`/devices/${d.id}/edit`)}
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>
        ),
```

- [ ] **Step 4: Chạy, xác nhận pass** — `npm test`, `npm run lint`, `npm run build`. Expected: xanh. Grep `RequireAdmin|RequireOrderAccess|RequireTransferAccess` trong `frontend/src` → 0.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/app frontend/src/modules/device/presentation
git commit -m "feat(fe): RequireCan chặn route theo quyền, tách quyền xoá thiết bị"
```

---

### Task 8: Frontend — bắt buộc phòng ban ở form tạo người dùng

**Files:**
- Modify: `frontend/src/modules/user/domain/userAccount.ts:60-71`
- Modify: `frontend/src/modules/user/presentation/CreateUserPage.tsx:29,91-95`
- Test: `frontend/src/modules/user/domain/userAccount.test.ts`

**Interfaces:**
- Consumes: `HEAD_ROLE`, `COLLAB_ROLE` (Task 6).
- Produces: `validateNewUser(d: NewUserDraft, roleName?: string): NewUserErrors`; `errors.departmentId = 'Vui lòng chọn phòng ban'`.

- [ ] **Step 1: Viết test fail.** Trong `userAccount.test.ts`: đổi tên test `form hợp lệ (phòng ban không bắt buộc)` thành `form hợp lệ (Nhân viên không bắt buộc phòng ban)`, gọi `validateNewUser(valid, 'Nhân viên')`; thêm:

```ts
  it.each(['Trưởng phòng', 'Cộng tác viên'])('%s thiếu phòng ban: báo lỗi', (roleName) => {
    expect(validateNewUser(valid, roleName)).toEqual({ departmentId: 'Vui lòng chọn phòng ban' });
  });

  it.each(['Trưởng phòng', 'Cộng tác viên'])('%s có phòng ban: hợp lệ', (roleName) => {
    expect(validateNewUser({ ...valid, departmentId: '1' }, roleName)).toEqual({});
  });

  it('chưa biết tên role (danh mục chưa tải xong): không chặn, backend sẽ kiểm', () => {
    expect(validateNewUser(valid)).toEqual({});
  });
```

- [ ] **Step 2: Chạy, xác nhận fail** — `npm test -- userAccount`. Expected: 2 case "thiếu phòng ban" FAIL.

- [ ] **Step 3: Cài đặt.**

`userAccount.ts`: thêm `import { COLLAB_ROLE, HEAD_ROLE } from '@/modules/auth/domain/session';`; thay `validateNewUser`:

```ts
/** Role vô nghĩa nếu thiếu phòng ban — khớp DEPARTMENT_REQUIRED_ROLES ở backend. */
const DEPARTMENT_REQUIRED_ROLES: readonly string[] = [HEAD_ROLE, COLLAB_ROLE];

/** `roleName`: tên role đang chọn (tra từ danh mục theo `d.roleId`) — quyết định phòng ban có bắt buộc không. */
export function validateNewUser(d: NewUserDraft, roleName?: string): NewUserErrors {
  const errors: NewUserErrors = {};
  if (!d.username.trim()) errors.username = REQUIRED;
  if (!d.fullName.trim()) errors.fullName = REQUIRED;
  if (!d.email.trim()) errors.email = REQUIRED;
  else if (!Email.isValid(d.email)) errors.email = 'Email không hợp lệ';
  if (d.password.length < PASSWORD_MIN_LENGTH)
    errors.password = `Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`;
  if (d.confirmPassword !== d.password) errors.confirmPassword = 'Mật khẩu xác nhận không khớp';
  if (!d.roleId) errors.roleId = REQUIRED;
  if (!d.departmentId && roleName && DEPARTMENT_REQUIRED_ROLES.includes(roleName))
    errors.departmentId = 'Vui lòng chọn phòng ban';
  return errors;
}
```

`CreateUserPage.tsx`:
- dòng 29: `const next = validateNewUser(draft, roles.find((r) => String(r.id) === draft.roleId)?.roleName);`
- `<Field label="Phòng ban" …>`: `hint="Trưởng phòng / Cộng tác viên được phân biệt theo phòng ban"` và thêm `error={errors.departmentId}`.

- [ ] **Step 4: Chạy, xác nhận pass** — `npm test`, `npm run lint`, `npm run build`. Expected: xanh.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules/user
git commit -m "feat(user): form tạo người dùng bắt buộc phòng ban cho Trưởng phòng / Cộng tác viên"
```

---

### Task 9: Frontend — trạng thái "Đang chờ duyệt" và form thiết bị bỏ ô gán người giữ

**Files:**
- Modify: `frontend/src/modules/device/domain/device.ts`, `domain/deviceDraft.ts`
- Modify: `frontend/src/modules/device/application/DeviceRepository.ts`
- Modify: `frontend/src/modules/device/infrastructure/HttpDeviceRepository.ts`
- Modify: `frontend/src/modules/device/presentation/{statusTone.ts,useDeviceLookups.ts,AssetFormPage.tsx,form/AssetGeneralInfoFields.tsx}`
- Test: `frontend/src/modules/device/domain/deviceDraft.test.ts`, `infrastructure/HttpDeviceRepository.test.ts`, `frontend/src/modules/{allocation,transfer}/presentation/print/generateBienBan.test.ts`

**Interfaces:**
- Consumes: API thiết bị của Task 5 (item không có `department`; body không nhận người giữ/trạng thái).
- Produces: `DEVICE_STATUS.PENDING_APPROVAL = 'Đang chờ duyệt'` (FE); `DeviceDraft` không còn `departmentId`, `currentUserId`, `allocated`, `allocatedOn`; `Device` không còn `department`; `DepartmentRef` bị xoá; `DeviceRepository`/`deviceService` không còn `departments()`, `users()`; `DeviceQuery` không còn `departmentId`; `useDeviceLookups()` trả `{ deviceTypes }`.

- [ ] **Step 1: Viết test fail.**

`deviceDraft.test.ts`:
- fixture `device()`: xoá dòng `department: null,`.
- test `cắt ISO datetime…`: bỏ `allocatedOn: '2026-10-01T00:00:00.000Z',` và dòng `expect(d.allocatedOn)…`.
- xoá test `tick "đã cấp phát" khi có người sở hữu dù chưa có ngày cấp phát`; thay test `thiết bị chưa cấp phát: không tick, các ô ngày rỗng` bằng:

```ts
  it('draft không mang người giữ / ngày cấp / phòng ban — các trường đó chỉ đổi qua đơn/lệnh', () => {
    const d = deviceToDraft(
      device({
        status: 'Đã cấp phát',
        currentUser: { id: 7, fullName: 'Nguyễn Văn A', username: 'anv' },
        allocatedOn: '2026-10-01T00:00:00.000Z',
      }),
    );
    for (const key of ['currentUserId', 'allocated', 'allocatedOn', 'departmentId']) {
      expect(d).not.toHaveProperty(key);
    }
    expect(d.purchaseDate).toBe('');
  });
```

`HttpDeviceRepository.test.ts`: thay 2 test `không gửi currentUserId khi chưa tick "đã cấp phát"` và `gửi currentUserId khi đã tick "đã cấp phát"` bằng:

```ts
  it('không bao giờ gửi người giữ / ngày cấp / phòng ban / trạng thái', async () => {
    await new HttpDeviceRepository().create(draft());
    const body = sentBody(fetchMock);
    for (const key of ['currentUserId', 'allocatedOn', 'departmentId', 'status']) {
      expect(body).not.toHaveProperty(key);
    }
  });
```

`allocation/presentation/print/generateBienBan.test.ts` và `transfer/presentation/print/generateBienBan.test.ts`: xoá dòng `department: null,` trong fixture `Device`.

- [ ] **Step 2: Chạy, xác nhận fail** — `npm test -- deviceDraft HttpDeviceRepository`. Expected: FAIL (draft vẫn có `currentUserId`…). (`npm run lint` lúc này cũng báo lỗi kiểu ở 2 file `generateBienBan.test.ts` — sẽ hết sau Step 3.)

- [ ] **Step 3: Cài đặt.**

`device.ts` — thay toàn bộ phần trước `export interface DeviceTypeRef`, xoá `DepartmentRef`, xoá field `department` khỏi `Device`:

```ts
/** Trạng thái thiết bị — chuỗi tiếng Việt y hệt giá trị backend lưu trong DB. */
export const DEVICE_STATUS = {
  IN_STOCK: 'Trong kho',
  ALLOCATED: 'Đã cấp phát',
  /** Đang nằm trong đơn/lệnh chờ duyệt — bị khoá, không sửa/xoá được. */
  PENDING_APPROVAL: 'Đang chờ duyệt',
  PENDING_DISPOSAL: 'Chờ thanh lý',
  DELETED: 'Đã xóa',
} as const;

export type DeviceStatus = (typeof DEVICE_STATUS)[keyof typeof DEVICE_STATUS];

/** Trạng thái hiện trong bộ lọc danh mục — soft-delete nên "Đã xóa" vẫn xem lại được. */
export const DEVICE_STATUS_OPTIONS: DeviceStatus[] = [
  DEVICE_STATUS.IN_STOCK,
  DEVICE_STATUS.ALLOCATED,
  DEVICE_STATUS.PENDING_APPROVAL,
  DEVICE_STATUS.PENDING_DISPOSAL,
  DEVICE_STATUS.DELETED,
];
```

`statusTone.ts`: thêm `[DEVICE_STATUS.PENDING_APPROVAL]: 'neutral',`.

`deviceDraft.ts`:
- `DeviceDraft`: xoá `departmentId`, `currentUserId`, `allocated`, `allocatedOn`. `emptyDeviceDraft`: xoá 4 dòng tương ứng.
- `deviceToDraft`: xoá `departmentId`, `currentUserId`, comment + `allocated`, `allocatedOn`.
- `validateDeviceDraft`: xoá dòng `if (d.allocated && d.currentUserId === null) …`.
- Thêm comment trên `DeviceDraft`: `/** Chỉ thông tin thiết bị. Người giữ / ngày cấp / trạng thái chỉ đổi qua đơn Cấp phát - Thu hồi và lệnh Điều chuyển. */`

`DeviceRepository.ts`: import chỉ còn `Device, DeviceStatus, DeviceTypeRef`; `DeviceQuery` xoá `departmentId`; interface xoá `departments()` và `users()` (cả comment); `makeDeviceService` xoá `departments`, `users`.

`HttpDeviceRepository.ts`: import type chỉ còn `Device, DeviceTypeRef`; `toBody` xoá 3 dòng `departmentId`, `currentUserId`, `allocatedOn`; xoá 2 method `departments()` và `users()` (kèm comment `/users/lookup`).

`useDeviceLookups.ts`:

```ts
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { deviceService } from '../infrastructure/container';

/** Danh mục cho form thiết bị: chỉ còn loại thiết bị (người giữ không chọn ở form nữa). */
export function useDeviceLookups() {
  const { data } = useAsyncData(() => deviceService.deviceTypes(), []);
  return { deviceTypes: data ?? [] };
}
```

`AssetGeneralInfoFields.tsx`: `AssetFieldsProps` và tham số bỏ `departments`, `users`; import type chỉ còn `DeviceTypeRef`; xoá hai `<Field>` `Đơn vị quản lý` và `Người sở hữu`.

`AssetFormPage.tsx`:
- `const { deviceTypes } = useDeviceLookups();`; bỏ prop `departments`, `users` ở `<DeviceForm>`, ở chữ ký `DeviceForm` và ở `<AssetGeneralInfoFields>`; import type chỉ còn `DeviceTypeRef`.
- xoá nguyên `<section>` có `<SectionTitle>Đã cấp phát</SectionTitle>`; import từ `@/shared/ui/inputs` chỉ còn `Input`.

- [ ] **Step 4: Chạy, xác nhận pass** — `npm test`, `npm run lint`, `npm run build`. Expected: xanh. Grep `DepartmentRef|departments\(\)|allocated\b` trong `frontend/src/modules/device` → 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/modules
git commit -m "feat(fe): trạng thái \"Đang chờ duyệt\", form thiết bị bỏ ô người giữ / phòng ban / cấp phát"
```

---

### Task 10: Seed tài khoản dev và script e2e

**Files:**
- Modify: `backend/prisma/seed.ts` (sau khối `console.log('Seed xong…')`, trước khối `devEmail`)
- Modify: `backend/scripts/e2e-users.ps1`, `e2e-devices.ps1`, `e2e-device-orders.ps1`, `e2e-device-transfers.ps1`

**Interfaces:**
- Consumes: mọi thay đổi BE của Task 1-5.
- Produces: tài khoản dev `truongphong.kt` / `Head@1234`, `ctv.kt` / `Collab@1234` (KYTHUAT).

- [ ] **Step 1: Seed.** Thêm vào `seed.ts`:

```ts
  // Tài khoản dev cho 2 vai nghiệp vụ Kỹ thuật — để thử luồng tạo/duyệt mà không phải tạo tay.
  const techAccounts = [
    {
      username: 'truongphong.kt',
      password: 'Head@1234',
      fullName: 'Trưởng phòng Kỹ thuật (dev)',
      roleName: ROLE.HEAD,
    },
    {
      username: 'ctv.kt',
      password: 'Collab@1234',
      fullName: 'Cộng tác viên Kỹ thuật (dev)',
      roleName: ROLE.COLLAB,
    },
  ];
  for (const a of techAccounts) {
    await prisma.user.upsert({
      where: { username: a.username },
      update: {},
      create: {
        username: a.username,
        email: `${a.username}@saigonbank.com.vn`,
        password: await hashPassword(a.password),
        fullName: a.fullName,
        roleId: roleIds[a.roleName],
        departmentId: departmentIds.KYTHUAT,
        status: USER_STATUS.ACTIVE,
        isVerified: true,
      },
    });
  }
  console.log(`Seed user dev Kỹ thuật: ${techAccounts.map((a) => a.username).join(', ')}`);
```

Chạy trong `backend/`: `npm run db:setup`. Expected: `Seed xong: 4 role, …` và `Seed user dev Kỹ thuật: truongphong.kt, ctv.kt`. Chạy lần hai vẫn thành công.

- [ ] **Step 2: Khối dùng chung cho script.** Trước khi sửa mỗi file `.ps1`, xác nhận 3 byte đầu là BOM: `(Get-Content <file> -Encoding Byte -TotalCount 3)` → `239 187 191`; kiểm lại sau khi sửa.

Khối **TP Kỹ thuật** (chèn vào `e2e-devices.ps1` ngay sau khi có `$adminToken`; hai script đơn/lệnh đã có sẵn khối này):

```powershell
$techUname = "e2etech$stamp"
$techPass = 'E2e@1234'
Api -Method Post -Path '/users' -Token $adminToken -Body @{
  username = $techUname; email = "$techUname@e2e.local"; fullName = 'Truong phong Ky thuat E2E'
  password = $techPass; roleId = 2; departmentId = 1
} | Out-Null
$techToken = (Api -Method Post -Path '/auth/login' -Body @{ identifier = $techUname; password = $techPass }).data.accessToken
if ($techToken) { Ok "$techUname dang nhap duoc" } else { Fail "$techUname khong dang nhap duoc"; exit 1 }
```

Khối **CTV Kỹ thuật** (chèn vào cả 3 script `e2e-devices`, `e2e-device-orders`, `e2e-device-transfers`, ngay sau khối TP):

```powershell
# Role id của 'Cộng tác viên' tra theo tên: role thêm sau nên id trên DB thật không cố định.
$collabRole = (Api -Method Get -Path '/roles' -Token $adminToken).data |
  Where-Object { $_.roleName -eq 'Cộng tác viên' } | Select-Object -First 1
if (-not $collabRole) { Fail "chưa có role 'Cộng tác viên' — chạy lại seed (npm run db:setup)"; exit 1 }

$collabUname = "e2ectv$stamp"
$collabPass = 'E2e@1234'
Api -Method Post -Path '/users' -Token $adminToken -Body @{
  username = $collabUname; email = "$collabUname@e2e.local"; fullName = 'Cong tac vien Ky thuat E2E'
  password = $collabPass; roleId = $collabRole.id; departmentId = 1
} | Out-Null
$collabToken = (Api -Method Post -Path '/auth/login' -Body @{ identifier = $collabUname; password = $collabPass }).data.accessToken
if ($collabToken) { Ok "$collabUname dang nhap duoc" } else { Fail "$collabUname khong dang nhap duoc"; exit 1 }
```

- [ ] **Step 3: `e2e-devices.ps1`.**
- Mọi `Post`/`Patch`/`Delete` tới `/devices…` đang dùng `-Token $adminToken` (bước 3, 6, 7, 10, 12, 14) → `-Token $techToken`. `Get` giữ `$adminToken`. Bước 12 sửa chữ `admin xoá mềm` → `Truong phong Ky thuat xoá mềm`.
- Thay bước 8 và xoá bước 9 bằng:

```powershell
Step "8. PATCH lờ đi status/currentUserId — chỉ đơn/lệnh mới đổi người giữ"
Api -Method Patch -Path "/devices/$deviceId" -Token $techToken -Body @{ status = 'Đã cấp phát'; currentUserId = 1 } | Out-Null
$reloaded = (Api -Method Get -Path "/devices/$deviceId" -Token $adminToken).data
if ($reloaded.status -eq 'Trong kho' -and $null -eq $reloaded.currentUser) { Ok "PATCH status/currentUserId bị lờ, thiết bị vẫn 'Trong kho'" }
else { Fail "PATCH đổi được status='$($reloaded.status)' / currentUser — lẽ ra bị lờ" }
```

- Thêm trước bước 12:

```powershell
Step "11b. Quản trị viên chỉ đọc; Cộng tác viên Kỹ thuật sửa được nhưng không xoá"
ExpectStatus -Method Patch -Path "/devices/$deviceId" -Token $adminToken -Expected 403 -Label "Quản trị viên PATCH /devices" -Body @{ deviceName = 'x' }
Api -Method Patch -Path "/devices/$deviceId" -Token $collabToken -Body @{ deviceName = "Laptop CTV sửa $stamp" } | Out-Null
Ok "Cộng tác viên Kỹ thuật PATCH /devices được"
ExpectStatus -Method Delete -Path "/devices/$deviceId" -Token $collabToken -Expected 403 -Label "Cộng tác viên Kỹ thuật DELETE /devices"
```

- [ ] **Step 4: `e2e-device-orders.ps1`.**
- `Post /devices` (bước 2, 5) `$adminToken` → `$techToken`; `Post /device-orders` (bước 3, 4, 5) `$techToken` → `$collabToken`; `Patch …/approve`, `…/reject` (bước 3, 4, 5) `$adminToken` → `$techToken`. Tiêu đề bước 1: `Dang nhap admin, tao Truong phong Ky thuat, Cong tac vien va nguoi nhan`.
- Trong bước 3, ngay sau khi tạo `$order` (trước dòng duyệt), chèn:

```powershell
$pending = (Api -Method Get -Path "/devices/$deviceId" -Token $adminToken).data
if ($pending.status -eq 'Đang chờ duyệt') { Ok "tao don xong: thiet bi 'Đang chờ duyệt'" }
else { Fail "sau khi tao don, status='$($pending.status)', mong 'Đang chờ duyệt'" }
$dbPending = Psql "SELECT ""Status"" FROM ""Device"" WHERE ""Id"" = $deviceId;"
if ($dbPending -eq 'Đang chờ duyệt') { Ok "DB xac nhan Status='Đang chờ duyệt'" } else { Fail "DB Status='$dbPending', mong 'Đang chờ duyệt'" }
ExpectStatus -Method Post -Path '/device-orders' -Token $collabToken -Expected 400 -Label "tao don thu hai cung thiet bi" -Body @{
  type = 'Cấp phát'; targetUserId = $staff.id; deviceIds = @($deviceId)
}
ExpectStatus -Method Patch -Path "/devices/$deviceId" -Token $techToken -Expected 400 -Label "PATCH thiet bi dang cho duyet" -Body @{ deviceName = 'x' }
```

- Thêm trước khối tổng kết:

```powershell
Step "7. Quan tri vien khong duyet, Truong phong Ky thuat khong tao don"
$device3 = (Api -Method Post -Path '/devices' -Token $techToken -Body @{
  deviceCode = "LT-$(Suffix6 2)"; deviceName = "Laptop E2E phan quyen $stamp"
  specDetail = 'Core i5, 16GB'; unit = 'Cai'; deviceTypeId = $laptop.id
}).data
$order3 = (Api -Method Post -Path '/device-orders' -Token $collabToken -Body @{
  type = 'Cấp phát'; targetUserId = $staff.id; deviceIds = @($device3.id)
}).data
ExpectStatus -Method Patch -Path "/device-orders/$($order3.id)/approve" -Token $adminToken -Expected 403 -Label "Quan tri vien PATCH approve"
$device4 = (Api -Method Post -Path '/devices' -Token $techToken -Body @{
  deviceCode = "LT-$(Suffix6 3)"; deviceName = "Laptop E2E TP khong tao don $stamp"
  specDetail = 'Core i5, 16GB'; unit = 'Cai'; deviceTypeId = $laptop.id
}).data
ExpectStatus -Method Post -Path '/device-orders' -Token $techToken -Expected 403 -Label "Truong phong Ky thuat POST /device-orders" -Body @{
  type = 'Cấp phát'; targetUserId = $staff.id; deviceIds = @($device4.id)
}
$adminList = (Api -Method Get -Path '/device-orders' -Token $adminToken).data
if (@($adminList | Where-Object { $_.id -eq $order3.id }).Count -eq 1) { Ok "Quan tri vien van xem duoc danh sach don" }
else { Fail "Quan tri vien khong thay don vua tao" }
```

- [ ] **Step 5: `e2e-device-transfers.ps1`.**
- Ngay sau dòng `$laptop = …` ở bước 2, thêm hàm dựng thiết bị "Đã cấp phát" bằng đơn Cấp phát (API thiết bị không còn gán người giữ):

```powershell
# Thiet bi "Đã cấp phát" chi tao duoc qua don Cap phat do CTV tao, TP duyet.
function NewAllocatedDevice ([int]$Offset, [int]$HolderId, [string]$Name) {
  $d = (Api -Method Post -Path '/devices' -Token $techToken -Body @{
    deviceCode = "LT-$(Suffix6 $Offset)"; deviceName = $Name
    specDetail = 'Core i5, 16GB'; unit = 'Cai'; deviceTypeId = $laptop.id
  }).data
  $o = (Api -Method Post -Path '/device-orders' -Token $collabToken -Body @{
    type = 'Cấp phát'; targetUserId = $HolderId; deviceIds = @($d.id)
  }).data
  Api -Method Patch -Path "/device-orders/$($o.id)/approve" -Token $techToken | Out-Null
  return (Api -Method Get -Path "/devices/$($d.id)" -Token $adminToken).data
}
```

- Bước 2: thay request `Post /devices` có `currentUserId = $staffA.id` bằng `$device = NewAllocatedDevice 0 $staffA.id "Laptop E2E dieu chuyen $stamp"`; tiêu đề bước 2: `Tao thiet bi va cap phat cho staffA qua don Cap phat`.
- Bước 4: `$device2 = NewAllocatedDevice 1 $staffA.id "Laptop E2E tu choi dieu chuyen $stamp"`. Bước 6: `$device3 = NewAllocatedDevice 2 $staffA.id "Laptop E2E admin khong duyet duoc $stamp"`.
- `Post /device-transfers` (bước 3, 4, 6) `$adminToken` → `$collabToken`. Bước 6 (`Admin PATCH approve` → 403) giữ nguyên.
- Trong bước 3, ngay sau khi tạo `$transfer` (trước dòng duyệt), chèn:

```powershell
$pending = (Api -Method Get -Path "/devices/$deviceId" -Token $adminToken).data
if ($pending.status -eq 'Đang chờ duyệt') { Ok "tao lenh xong: thiet bi 'Đang chờ duyệt'" }
else { Fail "sau khi tao lenh, status='$($pending.status)', mong 'Đang chờ duyệt'" }
```

- Trong bước 4, đổi kiểm tra sau từ chối thành:

```powershell
if ($afterReject.currentUser.id -eq $staffA.id -and $afterReject.status -eq 'Đã cấp phát') { Ok "tu choi lenh: thiet bi ve 'Đã cấp phát', van do staffA giu" }
else { Fail "tu choi lenh nhung status='$($afterReject.status)', currentUser=$($afterReject.currentUser.id)" }
```

- Thêm trước khối tổng kết:

```powershell
Step "7. Quan tri vien va Truong phong Ky thuat khong tao duoc lenh"
$device4 = NewAllocatedDevice 3 $staffA.id "Laptop E2E phan quyen dieu chuyen $stamp"
ExpectStatus -Method Post -Path '/device-transfers' -Token $adminToken -Expected 403 -Label "Quan tri vien POST /device-transfers" -Body @{
  fromUserId = $staffA.id; toUserId = $staffB.id; deviceIds = @($device4.id)
}
ExpectStatus -Method Post -Path '/device-transfers' -Token $techToken -Expected 403 -Label "Truong phong Ky thuat POST /device-transfers" -Body @{
  fromUserId = $staffA.id; toUserId = $staffB.id; deviceIds = @($device4.id)
}
```

- [ ] **Step 6: `e2e-users.ps1`.** Thêm sau bước 3:

```powershell
Step "3b. Trưởng phòng / Cộng tác viên bắt buộc có phòng ban"
$collabRole = (Api -Method Get -Path '/roles' -Token $adminToken).data |
  Where-Object { $_.roleName -eq 'Cộng tác viên' } | Select-Object -First 1
if (-not $collabRole) { Fail "chưa có role 'Cộng tác viên' — chạy lại seed (npm run db:setup)"; exit 1 }
ExpectStatus -Method Post -Path '/users' -Token $adminToken -Expected 400 -Label "tạo Trưởng phòng thiếu phòng ban" -Body @{
  username = "${uname}tp"; email = "${uname}tp@e2e.local"; fullName = 'TP thiếu phòng ban'; password = $upass; roleId = 2
}
ExpectStatus -Method Post -Path '/users' -Token $adminToken -Expected 400 -Label "tạo Cộng tác viên thiếu phòng ban" -Body @{
  username = "${uname}ctv"; email = "${uname}ctv@e2e.local"; fullName = 'CTV thiếu phòng ban'; password = $upass; roleId = $collabRole.id
}
```

- [ ] **Step 7: Chạy e2e trên backend thật.** Khởi động backend (`npm run start:dev` trong `backend/`, chạy nền; trước đó kiểm `:3000` không bị tiến trình mồ côi giữ), rồi trong `backend/`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/e2e-users.ps1
powershell -ExecutionPolicy Bypass -File scripts/e2e-devices.ps1
powershell -ExecutionPolicy Bypass -File scripts/e2e-device-orders.ps1
powershell -ExecutionPolicy Bypass -File scripts/e2e-device-transfers.ps1
```

Expected: cả bốn in dòng `… ĐỀU XANH` / `… DEU XANH`, exit code 0. Dừng backend và xác nhận `:3000` đã được giải phóng.

- [ ] **Step 8: Commit**

```bash
git add backend/prisma/seed.ts backend/scripts
git commit -m "chore: seed tài khoản dev Kỹ thuật, e2e theo ma trận quyền và giữ chỗ thiết bị"
```

---

### Task 11: Tài liệu

**Files:**
- Modify: `docs/Changes.md` (dòng "Cập nhật lần cuối", mục 3, mục 4, mục 6)
- Modify: `docs/CONTEXT.md`

- [ ] **Step 1: `docs/Changes.md`.**
- Dòng đầu: `Cập nhật lần cuối: 2026-10-01`.
- Mục 3, dòng "Tạo tài khoản": `phòng ban (không bắt buộc)` → `phòng ban (**bắt buộc** với Trưởng phòng và Cộng tác viên; thiếu → 400 "Vui lòng chọn phòng ban")`.
- Thay bảng mục 4 bằng:

```markdown
| Vai trò | Quyền |
|---|---|
| Quản trị viên | Quản lý người dùng. **Chỉ xem** thiết bị, đơn Cấp phát - Thu hồi, lệnh Điều chuyển (không thêm/sửa/xoá thiết bị, không tạo, không duyệt). |
| Trưởng phòng **Kỹ thuật** | Thêm/sửa/xoá thiết bị, dọn thùng rác thiết bị; **duyệt/từ chối** đơn Cấp phát - Thu hồi và lệnh Điều chuyển. Không tạo đơn/lệnh. |
| Cộng tác viên **Kỹ thuật** | Thêm/sửa thông tin thiết bị (không xoá, không dọn thùng rác); **tạo** đơn Cấp phát - Thu hồi và lệnh Điều chuyển; xem tất cả đơn/lệnh. Không duyệt. |
| Cộng tác viên **Kế toán** | Khởi tạo kiểm kê, đối soát dữ liệu kiểm kê (dự kiến — luồng Kiểm kê chưa làm; hiện quyền ngang Nhân viên). |
| Trưởng phòng **Kế toán** | Chưa có quyền riêng (xem lại khi làm Kiểm kê). |
| Nhân viên | Người dùng thường: xem thiết bị. |

Trưởng phòng và Cộng tác viên phân biệt Kỹ thuật / Kế toán bằng phòng ban của tài khoản.
```

- Mục 6 (thiết bị): bỏ khoá ngoại `DepartmentId → Department.Id` khỏi câu "3 khoá ngoại" (còn 2) và khỏi khối DBML của bảng `Device`; note của `Status` thành `'Trong kho | Đã cấp phát | Đang chờ duyệt | Chờ thanh lý | Đã xóa'`; thêm đoạn:

```markdown
- **Người giữ thiết bị chỉ đổi qua đơn/lệnh được duyệt** (2026-10-01): API và form thiết bị không còn
  nhận Người sở hữu / Trạng thái / Ngày cấp phát / Phòng ban; thiết bị mới luôn "Trong kho". Tạo đơn
  Cấp phát / Thu hồi hoặc lệnh Điều chuyển → thiết bị sang **"Đang chờ duyệt"** (bị khoá: không vào
  đơn/lệnh khác, không sửa, không xoá); duyệt → trạng thái đích; từ chối → trạng thái cũ. Thiết bị
  không còn gắn phòng ban — phòng ban của người giữ xem ở thông tin người dùng.
```

- [ ] **Step 2: `docs/CONTEXT.md`.** Đọc lại từng vùng rồi sửa cho đúng các sự thật sau (giữ văn phong và cấu trúc bảng của file):
  - Đầu file (~10-12) và mục lịch sử (~395): đơn Cấp phát - Thu hồi và lệnh Điều chuyển đều do **Cộng tác viên Kỹ thuật tạo, Trưởng phòng Kỹ thuật duyệt**; Quản trị viên chỉ xem; tạo đơn/lệnh giữ chỗ thiết bị (`Đang chờ duyệt`). Ghi rõ từ 2026-10-01, spec `docs/superpowers/specs/2026-09-30-role-cong-tac-vien-design.md`.
  - Cây thư mục (~93-96): thay 3 dòng `RequireAdmin.tsx` / `RequireOrderAccess.tsx` / `RequireTransferAccess.tsx` bằng `RequireCan.tsx   Guard theo quyền: <RequireCan can={helper} to="…"/> — helper sai thì chuyển hướng (bọc /users*, /allocation*, /transfers*, /devices/new, /devices/:id/edit)`.
  - Mục helper `session.ts` (~154-157): `isAdmin`, `isTechHead`, `isTechCollab` (role "Cộng tác viên" + `KYTHUAT`), `canWriteDevices` (TP hoặc CTV Kỹ thuật), `canDeleteDevices` (chỉ TP Kỹ thuật — xoá mềm + dọn thùng rác), `canAccessOrders`/`canAccessTransfers` (Admin, TP, CTV Kỹ thuật), `canCreateOrder`/`canCreateTransfer` (chỉ CTV Kỹ thuật), `canDecideOrder`/`canDecideTransfer` (chỉ TP Kỹ thuật). Bỏ câu "Điều chuyển **ngược** Cấp phát - Thu hồi".
  - Bảng route (~260-267): `/devices/new`, `/devices/:id/edit` có guard `RequireCan(canWriteDevices)` → `/devices`; form thiết bị **không còn** ô Đơn vị quản lý, Người sở hữu, mục Đã cấp phát; `/allocation/new` bọc `RequireCan(canCreateOrder)` → `/allocation`; `/transfers/new` bọc `RequireCan(canCreateTransfer)` → `/transfers`; `/users*` bọc `RequireCan(isAdmin)`; `/users/new` bắt buộc phòng ban cho TP / CTV.
  - Nơi mô tả backend auth: thay `@Roles`, `DeviceWriteGuard`, `OrderAccessGuard`, `OrderCreateGuard`, `TransferAccessGuard`, `TransferDecideGuard` bằng `@Allow(...ACTOR)` ở `backend/src/shared/auth/actors.ts` do `AuthGuard` kiểm (handler ghi đè class), kèm bảng endpoint → actor của Task 2.
  - Trạng thái thiết bị: thêm `Đang chờ duyệt` và bảng vòng đời (mục 6.2 của spec).
  - Mục seed (~456): thêm `truongphong.kt` / `Head@1234` (Trưởng phòng, KYTHUAT), `ctv.kt` / `Collab@1234` (Cộng tác viên, KYTHUAT).

- [ ] **Step 3: Kiểm.** Grep `docs/CONTEXT.md`: `RequireAdmin|RequireOrderAccess|RequireTransferAccess|DeviceWriteGuard|OrderCreateGuard|OrderAccessGuard|TransferDecideGuard|TransferAccessGuard|@Roles|Đơn vị quản lý` → 0 kết quả; `Cộng tác viên`, `Đang chờ duyệt` → có kết quả.

- [ ] **Step 4: Commit**

```bash
git add docs/CONTEXT.md docs/Changes.md
git commit -m "docs: ma trận quyền Cộng tác viên và vòng đời Đang chờ duyệt"
```

---

### Task 12: Xác nhận cuối

- [ ] **Step 1:** `backend/`: `npm test` → xanh; `npm run lint` → không lỗi, `git status` sạch sau đó (có diff format thì commit `style: eslint --fix`).
- [ ] **Step 2:** `frontend/`: `npm test`, `npm run lint`, `npm run build` → xanh cả ba.
- [ ] **Step 3:** Grep `backend/src`: `@Roles|roles\.decorator|(Write|Access|Create|Decide)Guard|ASSIGNABLE_DEVICE_STATUSES` → 0. Grep `frontend/src`: `RequireAdmin|RequireOrderAccess|RequireTransferAccess|DepartmentRef` → 0.
- [ ] **Step 4:** `npx prisma migrate status` trong `backend/` → `Database schema is up to date`.
- [ ] **Step 5:** `git log main..HEAD --oneline` → 12 commit (Task 0-11; thêm commit `style` nếu có). Báo lại người dùng; **không merge, không push** khi chưa được hỏi.
