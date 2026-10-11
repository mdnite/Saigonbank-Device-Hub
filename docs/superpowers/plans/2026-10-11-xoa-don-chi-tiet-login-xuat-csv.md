# Xoá đơn/lệnh, modal Chi tiết, chọn người theo phòng ban, lọc thiết bị, xuất CSV, AppShell + Login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm xoá mềm + thùng rác cho đơn Cấp phát - Thu hồi và lệnh Điều chuyển, modal xem chi tiết đơn/lệnh (kèm lý do từ chối), chọn người theo phòng ban + bộ lọc thiết bị ở 2 form tạo, xuất CSV danh sách tài sản, bỏ nút tĩnh ở AppShell, và 2 cải tiến UX cho Login.

**Architecture:** Backend NestJS: thêm `Đã xóa` vào hằng trạng thái của `device-orders` / `device-transfers`, endpoint `DELETE /:id` + `POST /purge` (chỉ `TECH_HEAD`), luật "người nhận phải thuộc phòng ban". Frontend theo pragmatic DDD 4 lớp sẵn có: domain (hằng, hàm thuần có test) → application port/service → `Http*Repository` → page. Component dùng chung mới: `shared/ui/DecisionInfo`, `shared/ui/DepartmentUserSelect`, `modules/device/presentation/DeviceChecklist`, `shared/lib/csv`.

**Tech Stack:** Backend NestJS 11 + Prisma 7 + Jest/supertest (fake Prisma `src/test/fake-prisma.ts`). Frontend React 18 + TS + Tailwind + Vitest + Testing Library + lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-11-xoa-don-chi-tiet-login-xuat-csv-design.md`

## Global Constraints

- **Không thêm bảng, không thêm cột, không migration.** Chỉ thêm giá trị `'Đã xóa'` vào cột `Status` (VarChar(20)) đã có.
- Trạng thái lưu nguyên văn tiếng Việt: `'Chờ duyệt'`, `'Đã duyệt'`, `'Từ chối'`, `'Đã xóa'`.
- Chỉ **Trưởng phòng Kỹ thuật** (`ACTOR.TECH_HEAD` / `isTechHead`) xoá đơn/lệnh và dọn thùng rác. Admin + Chuyên viên Kỹ thuật xem được lọc `Đã xóa`.
- Chỉ xoá được đơn/lệnh `Đã duyệt` hoặc `Từ chối`; `Chờ duyệt` → 400. Không khôi phục.
- Xác nhận xoá / dọn thùng rác bằng `window.confirm`.
- Message backend (giữ nguyên chữ): `'Không thể xoá đơn đang chờ duyệt'`, `'Đơn đã bị xoá'`, `'Không thể xoá lệnh đang chờ duyệt'`, `'Lệnh đã bị xoá'`, `'Người nhận phải thuộc một phòng ban'`. ResponseMessage: `'Đã xoá đơn'`, `'Đã xoá lệnh điều chuyển'`, `'Đã dọn thùng rác'`.
- Xuất CSV chỉ cho `canWriteDevices` (TP + Chuyên viên Kỹ thuật); file `danh-sach-tai-san-YYYY-MM-DD.csv` (ngày theo giờ máy).
- `presentation` chỉ lấy service từ `infrastructure/container.ts`; `domain`/`application` không import React/infra/presentation; `shared/` **không import `modules/`**.
- Commit message: **không** thêm dòng `Co-Authored-By` hay "Generated with Claude Code" (yêu cầu của chủ repo).
- Lệnh chạy test: backend `cd backend && npx -y pnpm@10 test -- <pattern>`; frontend (từ gốc repo) `npm test -- <đường dẫn trong frontend/>`; type-check frontend `npm run lint`.

**Lệch nhỏ so với spec (có chủ đích):**
- `DeviceChecklist` đặt ở `frontend/src/modules/device/presentation/` thay vì `shared/ui/` — nó cần kiểu `Device` của module device, mà `shared/` không được import `modules/`.
- Nút "Dọn thùng rác" ở `/allocation`, `/transfers` **ẩn** khi danh sách rỗng (giống `/devices` đang làm) thay vì disable.
- `DepartmentRef` khai báo riêng trong domain `allocation` và `transfer` (giống cách 2 module đang tự khai báo `UserRef`), không import chéo từ `audit`.

## Review Focus

1. **Dọn thùng rác với id không nằm trong thùng rác** (vd. client cũ gửi lẫn id đơn `Đã duyệt`) → chỉ row `Đã xóa` bị xoá, row khác nguyên vẹn. Test ở Task 1 + Task 2.
2. **Xoá đơn khi đơn vừa bị người khác xoá** (đọc thấy `Đã duyệt`, ghi lúc đã `Đã xóa`) → 400 `'Đơn đã bị xoá'`, không 500. Ghi có điều kiện `updateMany` ở Task 1/2; test xoá 2 lần liên tiếp.
3. **Lý do từ chối của đơn đã bị xoá** — status `Đã xóa` nhưng `rejectReason` còn → modal vẫn hiện khung lý do. Test ở Task 6.
4. **Picker phòng ban khi user không có phòng ban / bị loại trừ** — Admin (`departmentId: null`) không bao giờ xuất hiện; Người nhận lệnh không chứa người giao. Test ở Task 7.
5. **Bộ lọc thiết bị ẩn máy đã tick** → máy vẫn nằm trong `deviceIds` và vẫn được gửi khi tạo đơn; "Đã chọn N thiết bị" đếm cả máy bị ẩn. Test ở Task 8.

---

## File Structure

**Backend**
- Modify `backend/src/modules/device-orders/device-order-status.ts` — thêm `DELETED`.
- Modify `backend/src/modules/device-orders/device-orders.dto.ts` — `PurgeDeviceOrdersDto`.
- Modify `backend/src/modules/device-orders/device-orders.service.ts` — `list` ẩn `Đã xóa`, `remove`, `purge`, luật phòng ban.
- Modify `backend/src/modules/device-orders/device-orders.controller.ts` — `DELETE :id`, `POST purge`.
- Modify `backend/src/modules/device-orders/device-orders.spec.ts` — test mới.
- Tương tự 5 file trên cho `backend/src/modules/device-transfers/`.
- Modify `backend/src/test/fake-prisma.ts` — `deleteMany` (cascade item) cho `deviceOrder`, `deviceTransfer`.

**Frontend**
- Modify `frontend/src/modules/auth/domain/session.ts` (+ `.test.ts`) — `canDeleteOrder`, `canDeleteTransfer`.
- Modify `frontend/src/modules/allocation/domain/deviceOrder.ts` — `DELETED`, `UserRef.departmentId`, `DepartmentRef`.
- Modify `frontend/src/modules/allocation/application/DeviceOrderRepository.ts` — `remove`, `purge`, `departments`.
- Modify `frontend/src/modules/allocation/infrastructure/HttpDeviceOrderRepository.ts` (+ `.test.ts`).
- Modify `frontend/src/modules/allocation/presentation/orderStatusTone.ts`, `DeviceOrderListPage.tsx` (+ `.test.tsx`), `CreateOrderPage.tsx`.
- Create `frontend/src/modules/allocation/presentation/OrderDetailModal.tsx` (+ `.test.tsx`).
- Tương tự cho `frontend/src/modules/transfer/…` (`TransferDetailModal.tsx`).
- Create `frontend/src/shared/ui/DecisionInfo.tsx`.
- Create `frontend/src/shared/ui/DepartmentUserSelect.tsx` (+ `.test.tsx`).
- Create `frontend/src/modules/device/domain/filterDevices.ts` (+ `.test.ts`).
- Create `frontend/src/modules/device/presentation/DeviceChecklist.tsx`.
- Create `frontend/src/shared/lib/csv.ts` (+ `.test.ts`); modify `frontend/src/modules/audit/domain/auditCsv.ts` (+ `.test.ts`).
- Create `frontend/src/modules/device/domain/devicesCsv.ts` (+ `.test.ts`); modify `DeviceCatalogPage.tsx` (+ `.test.tsx`).
- Modify `frontend/src/shared/layout/AppShell.tsx`.
- Modify `frontend/src/modules/auth/presentation/LoginPage.tsx`; create `LoginPage.test.tsx`.

**Docs**: `docs/CONTEXT.md`, `docs/Changes.md`, `docs/erd.dbml`.

---

### Task 1: Backend — xoá mềm + dọn thùng rác đơn Cấp phát - Thu hồi

**Files:**
- Modify: `backend/src/modules/device-orders/device-order-status.ts`
- Modify: `backend/src/modules/device-orders/device-orders.dto.ts`
- Modify: `backend/src/modules/device-orders/device-orders.service.ts`
- Modify: `backend/src/modules/device-orders/device-orders.controller.ts`
- Modify: `backend/src/test/fake-prisma.ts` (khối `deviceOrder:`, ~dòng 625–713)
- Test: `backend/src/modules/device-orders/device-orders.spec.ts`

**Interfaces:**
- Produces: `ORDER_STATUS.DELETED = 'Đã xóa'`; `DELETE /device-orders/:id` → `data` = chi tiết đơn (như `GET /:id`); `POST /device-orders/purge { ids: number[] }` → `data = { count: number }`.

- [ ] **Step 1: Thêm `deleteMany` (cascade item) vào fake Prisma**

Trong `backend/src/test/fake-prisma.ts`, khối `deviceOrder: { … }`, ngay trước dòng `delete: jest.fn(forbidden),` của khối đó, thêm:

```ts
      // Chỉ /device-orders/purge dùng — DeviceOrderItem onDelete: Cascade trong schema.
      deleteMany: jest.fn(async ({ where }: { where: Where }) => {
        const toRemove = deviceOrders.filter((o) => matches(o, where));
        for (const o of toRemove) {
          deviceOrders.splice(deviceOrders.indexOf(o), 1);
          for (let i = deviceOrderItems.length - 1; i >= 0; i--) {
            if (deviceOrderItems[i].orderId === o.id) deviceOrderItems.splice(i, 1);
          }
        }
        return { count: toRemove.length };
      }),
```

- [ ] **Step 2: Viết test thất bại**

Trong `device-orders.spec.ts`, thêm helper ngay sau hàm `allocate` (trước `let admin: User;`):

```ts
  /** Tạo đơn Cấp phát qua API rồi duyệt hoặc từ chối — trả id đơn. */
  async function decidedOrder(decision: 'approve' | 'reject'): Promise<number> {
    const deviceId = await createDevice();
    const created = await http()
      .post('/device-orders')
      .set('Authorization', tokenOf(collab))
      .send({ type: 'Cấp phát', targetUserId: staff.id, deviceIds: [deviceId] })
      .expect(201);
    const id = created.body.data.id as number;
    await http()
      .patch(`/device-orders/${id}/${decision}`)
      .set('Authorization', tokenOf(techHead))
      .send(decision === 'reject' ? { reason: 'Không cần' } : undefined)
      .expect(200);
    return id;
  }
```

Thêm `describe` mới ở cuối (trước `});` đóng `describe('Device orders…')`):

```ts
  describe('DELETE /device-orders/:id, POST /device-orders/purge', () => {
    it('TP Kỹ thuật xoá đơn Từ chối → "Đã xóa", ẩn khỏi danh sách mặc định, hiện ở lọc "Đã xóa"', async () => {
      const id = await decidedOrder('reject');
      const res = await http()
        .delete(`/device-orders/${id}`)
        .set('Authorization', tokenOf(techHead))
        .expect(200);
      expect(res.body.data.status).toBe('Đã xóa');
      expect(res.body.data.rejectReason).toBe('Không cần');
      expect(res.body.message).toBe('Đã xoá đơn');

      const list = await http().get('/device-orders').set('Authorization', tokenOf(admin)).expect(200);
      expect(list.body.data.map((o: { id: number }) => o.id)).not.toContain(id);
      const trash = await http()
        .get('/device-orders')
        .query({ status: 'Đã xóa' })
        .set('Authorization', tokenOf(collab))
        .expect(200);
      expect(trash.body.data.map((o: { id: number }) => o.id)).toEqual([id]);
    });

    it('xoá đơn Đã duyệt: không đổi trạng thái thiết bị', async () => {
      const id = await decidedOrder('approve');
      const deviceId = prisma.deviceOrderItems.find((i) => i.orderId === id)!.deviceId;
      await http().delete(`/device-orders/${id}`).set('Authorization', tokenOf(techHead)).expect(200);
      expect(prisma.devices.find((d) => d.id === deviceId)!.status).toBe('Đã cấp phát');
    });

    it('xoá đơn Chờ duyệt: 400', async () => {
      const deviceId = await createDevice();
      const created = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(collab))
        .send({ type: 'Cấp phát', targetUserId: staff.id, deviceIds: [deviceId] })
        .expect(201);
      const res = await http()
        .delete(`/device-orders/${created.body.data.id}`)
        .set('Authorization', tokenOf(techHead))
        .expect(400);
      expect(res.body.message).toBe('Không thể xoá đơn đang chờ duyệt');
    });

    it('xoá 2 lần: lần 2 trả 400 "Đơn đã bị xoá"', async () => {
      const id = await decidedOrder('reject');
      await http().delete(`/device-orders/${id}`).set('Authorization', tokenOf(techHead)).expect(200);
      const res = await http().delete(`/device-orders/${id}`).set('Authorization', tokenOf(techHead)).expect(400);
      expect(res.body.message).toBe('Đơn đã bị xoá');
    });

    it('xoá đơn không tồn tại: 404', async () => {
      await http().delete('/device-orders/9999').set('Authorization', tokenOf(techHead)).expect(404);
    });

    it('Quản trị viên và Chuyên viên Kỹ thuật không được xoá / dọn thùng rác: 403', async () => {
      const id = await decidedOrder('reject');
      for (const actor of [admin, collab]) {
        await http().delete(`/device-orders/${id}`).set('Authorization', tokenOf(actor)).expect(403);
        await http()
          .post('/device-orders/purge')
          .set('Authorization', tokenOf(actor))
          .send({ ids: [id] })
          .expect(403);
      }
    });

    it('dọn thùng rác: chỉ xoá cứng đơn "Đã xóa" (kèm item), bỏ qua id khác', async () => {
      const trashed = await decidedOrder('reject');
      const kept = await decidedOrder('approve');
      await http().delete(`/device-orders/${trashed}`).set('Authorization', tokenOf(techHead)).expect(200);

      const res = await http()
        .post('/device-orders/purge')
        .set('Authorization', tokenOf(techHead))
        .send({ ids: [trashed, kept] })
        .expect(201);
      expect(res.body.data).toEqual({ count: 1 });
      expect(res.body.message).toBe('Đã dọn thùng rác');
      expect(prisma.deviceOrders.map((o) => o.id)).toEqual([kept]);
      expect(prisma.deviceOrderItems.some((i) => i.orderId === trashed)).toBe(false);
    });

    it('dọn thùng rác thiếu ids: 400', async () => {
      await http().post('/device-orders/purge').set('Authorization', tokenOf(techHead)).send({ ids: [] }).expect(400);
    });
  });
```

- [ ] **Step 3: Chạy test, xác nhận thất bại**

Run: `cd backend && npx -y pnpm@10 test -- device-orders`
Expected: FAIL — các test mới trả 404 (route chưa có) / `status` không phải `'Đã xóa'`.

- [ ] **Step 4: Thêm trạng thái**

`device-order-status.ts`, trong `ORDER_STATUS` thêm dòng cuối:

```ts
  /** Xoá mềm — chỉ TP Kỹ thuật, chỉ từ Đã duyệt / Từ chối. Không khôi phục; "Dọn thùng rác" xoá cứng. */
  DELETED: 'Đã xóa',
```

- [ ] **Step 5: DTO purge**

`device-orders.dto.ts`, cuối file thêm (các decorator đã được import sẵn ở đầu file):

```ts
export class PurgeDeviceOrdersDto {
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT32, { each: true })
  ids!: number[];
}
```

- [ ] **Step 6: Service**

`device-orders.service.ts`:

Sau dòng `const ORDER_ALREADY_DECIDED = 'Đơn đã được xử lý';` thêm:

```ts
const ORDER_PENDING_DELETE = 'Không thể xoá đơn đang chờ duyệt';
const ORDER_ALREADY_DELETED = 'Đơn đã bị xoá';
```

Trong `list`, đổi `where: { type: q.type, status: q.status },` thành:

```ts
      // Mặc định ẩn thùng rác; lọc "Đã xóa" mới thấy.
      where: { type: q.type, status: q.status ?? { not: ORDER_STATUS.DELETED } },
```

Thêm 2 method ngay sau `reject(...)` (trước `private async decide`):

```ts
  /** Xoá mềm: chỉ đơn Đã duyệt / Từ chối. Không đụng Device. Ghi có điều kiện để đơn vừa bị xoá
   *  bởi request khác (giữa lúc đọc và lúc ghi) trả 400 thay vì ghi đè. */
  async remove(id: number) {
    const order = await this.findOrder(id);
    if (order.status === ORDER_STATUS.PENDING) {
      throw new BadRequestException(ORDER_PENDING_DELETE);
    }
    const { count } = await this.prisma.deviceOrder.updateMany({
      where: {
        id,
        status: { in: [ORDER_STATUS.APPROVED, ORDER_STATUS.REJECTED] },
      },
      data: { status: ORDER_STATUS.DELETED },
    });
    if (count === 0) throw new BadRequestException(ORDER_ALREADY_DELETED);
    return this.getById(id);
  }

  /** Dọn thùng rác: xoá cứng đơn "Đã xóa" trong ids (item đi theo cascade); id khác bỏ qua lặng lẽ. */
  async purge(ids: number[]) {
    const { count } = await this.prisma.deviceOrder.deleteMany({
      where: { id: { in: ids }, status: ORDER_STATUS.DELETED },
    });
    return { count };
  }
```

- [ ] **Step 7: Controller**

`device-orders.controller.ts`: thêm `Delete` vào import từ `@nestjs/common`; thêm `PurgeDeviceOrdersDto` vào import từ `./device-orders.dto`. Thêm 2 handler — `purge` đặt **trước** `@Get(':id')` không bắt buộc (khác method) nhưng để cuối class cho gọn:

```ts
  @Post('purge')
  @Allow(ACTOR.TECH_HEAD)
  @ResponseMessage('Đã dọn thùng rác')
  purge(@Body() dto: PurgeDeviceOrdersDto) {
    return this.orders.purge(dto.ids);
  }

  @Delete(':id')
  @Allow(ACTOR.TECH_HEAD)
  @ResponseMessage('Đã xoá đơn')
  remove(@OrderId() id: number) {
    return this.orders.remove(id);
  }
```

- [ ] **Step 8: Chạy test, xác nhận qua**

Run: `cd backend && npx -y pnpm@10 test -- device-orders`
Expected: PASS toàn bộ suite (test cũ + 8 test mới).

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/device-orders backend/src/test/fake-prisma.ts
git commit -m "feat(device-orders-be): xoá mềm đơn Đã duyệt/Từ chối, thùng rác, dọn thùng rác (TP Kỹ thuật)"
```

---

### Task 2: Backend — xoá mềm + dọn thùng rác lệnh Điều chuyển

**Files:**
- Modify: `backend/src/modules/device-transfers/device-transfer-status.ts`
- Modify: `backend/src/modules/device-transfers/device-transfers.dto.ts`
- Modify: `backend/src/modules/device-transfers/device-transfers.service.ts`
- Modify: `backend/src/modules/device-transfers/device-transfers.controller.ts`
- Modify: `backend/src/test/fake-prisma.ts` (khối `deviceTransfer:`)
- Test: `backend/src/modules/device-transfers/device-transfers.spec.ts`

**Interfaces:**
- Consumes: không có gì từ Task 1 (module độc lập, chỉ cùng mẫu).
- Produces: `TRANSFER_STATUS.DELETED = 'Đã xóa'`; `DELETE /device-transfers/:id` → chi tiết lệnh; `POST /device-transfers/purge { ids }` → `{ count }`.

- [ ] **Step 1: Fake Prisma**

Trong khối `deviceTransfer: { … }` của `fake-prisma.ts`, ngay trước `delete: jest.fn(forbidden),` của khối đó:

```ts
      // Chỉ /device-transfers/purge dùng — DeviceTransferItem onDelete: Cascade trong schema.
      deleteMany: jest.fn(async ({ where }: { where: Where }) => {
        const toRemove = deviceTransfers.filter((t) => matches(t, where));
        for (const t of toRemove) {
          deviceTransfers.splice(deviceTransfers.indexOf(t), 1);
          for (let i = deviceTransferItems.length - 1; i >= 0; i--) {
            if (deviceTransferItems[i].transferId === t.id) deviceTransferItems.splice(i, 1);
          }
        }
        return { count: toRemove.length };
      }),
```

- [ ] **Step 2: Viết test thất bại**

Trong `device-transfers.spec.ts`, thêm helper ngay sau `createAllocatedDevice` (trước `let admin: User;`):

```ts
  /** Tạo lệnh staffA → staffB qua API rồi duyệt hoặc từ chối — trả id lệnh. */
  async function decidedTransfer(decision: 'approve' | 'reject'): Promise<number> {
    const deviceId = await createAllocatedDevice(staffA);
    const created = await http()
      .post('/device-transfers')
      .set('Authorization', tokenOf(collab))
      .send({ fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [deviceId] })
      .expect(201);
    const id = created.body.data.id as number;
    await http()
      .patch(`/device-transfers/${id}/${decision}`)
      .set('Authorization', tokenOf(techHead))
      .send(decision === 'reject' ? { reason: 'Không cần' } : undefined)
      .expect(200);
    return id;
  }
```

`describe` mới ở cuối file (trong `describe` ngoài cùng):

```ts
  describe('DELETE /device-transfers/:id, POST /device-transfers/purge', () => {
    it('TP Kỹ thuật xoá lệnh Từ chối → "Đã xóa", ẩn khỏi danh sách mặc định, hiện ở lọc "Đã xóa"', async () => {
      const id = await decidedTransfer('reject');
      const res = await http()
        .delete(`/device-transfers/${id}`)
        .set('Authorization', tokenOf(techHead))
        .expect(200);
      expect(res.body.data.status).toBe('Đã xóa');
      expect(res.body.data.rejectReason).toBe('Không cần');
      expect(res.body.message).toBe('Đã xoá lệnh điều chuyển');

      const list = await http().get('/device-transfers').set('Authorization', tokenOf(admin)).expect(200);
      expect(list.body.data.map((t: { id: number }) => t.id)).not.toContain(id);
      const trash = await http()
        .get('/device-transfers')
        .query({ status: 'Đã xóa' })
        .set('Authorization', tokenOf(collab))
        .expect(200);
      expect(trash.body.data.map((t: { id: number }) => t.id)).toEqual([id]);
    });

    it('xoá lệnh Chờ duyệt: 400', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      const created = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(collab))
        .send({ fromUserId: staffA.id, toUserId: staffB.id, deviceIds: [deviceId] })
        .expect(201);
      const res = await http()
        .delete(`/device-transfers/${created.body.data.id}`)
        .set('Authorization', tokenOf(techHead))
        .expect(400);
      expect(res.body.message).toBe('Không thể xoá lệnh đang chờ duyệt');
    });

    it('xoá 2 lần: lần 2 trả 400 "Lệnh đã bị xoá"', async () => {
      const id = await decidedTransfer('approve');
      await http().delete(`/device-transfers/${id}`).set('Authorization', tokenOf(techHead)).expect(200);
      const res = await http().delete(`/device-transfers/${id}`).set('Authorization', tokenOf(techHead)).expect(400);
      expect(res.body.message).toBe('Lệnh đã bị xoá');
    });

    it('Quản trị viên và Chuyên viên Kỹ thuật không được xoá / dọn thùng rác: 403', async () => {
      const id = await decidedTransfer('reject');
      for (const actor of [admin, collab]) {
        await http().delete(`/device-transfers/${id}`).set('Authorization', tokenOf(actor)).expect(403);
        await http()
          .post('/device-transfers/purge')
          .set('Authorization', tokenOf(actor))
          .send({ ids: [id] })
          .expect(403);
      }
    });

    it('dọn thùng rác: chỉ xoá cứng lệnh "Đã xóa" (kèm item), bỏ qua id khác', async () => {
      const trashed = await decidedTransfer('reject');
      const kept = await decidedTransfer('approve');
      await http().delete(`/device-transfers/${trashed}`).set('Authorization', tokenOf(techHead)).expect(200);

      const res = await http()
        .post('/device-transfers/purge')
        .set('Authorization', tokenOf(techHead))
        .send({ ids: [trashed, kept] })
        .expect(201);
      expect(res.body.data).toEqual({ count: 1 });
      expect(prisma.deviceTransfers.map((t) => t.id)).toEqual([kept]);
      expect(prisma.deviceTransferItems.some((i) => i.transferId === trashed)).toBe(false);
    });
  });
```

- [ ] **Step 3: Chạy test, xác nhận thất bại**

Run: `cd backend && npx -y pnpm@10 test -- device-transfers`
Expected: FAIL (404 / route chưa có).

- [ ] **Step 4: Trạng thái**

`device-transfer-status.ts`, thêm vào `TRANSFER_STATUS`:

```ts
  /** Xoá mềm — chỉ TP Kỹ thuật, chỉ từ Đã duyệt / Từ chối. Không khôi phục. */
  DELETED: 'Đã xóa',
```

- [ ] **Step 5: DTO**

`device-transfers.dto.ts`: đảm bảo import có `ArrayMinSize, IsArray, IsInt, Max, Min` (từ `class-validator`), `Type` (từ `class-transformer`), `MAX_INT32` (từ `'../users/users.dto'`) — thêm cái nào còn thiếu. Cuối file:

```ts
export class PurgeDeviceTransfersDto {
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(MAX_INT32, { each: true })
  ids!: number[];
}
```

- [ ] **Step 6: Service**

`device-transfers.service.ts`: cạnh các hằng message đầu file (sau `TRANSFER_NOT_FOUND`) thêm:

```ts
const TRANSFER_PENDING_DELETE = 'Không thể xoá lệnh đang chờ duyệt';
const TRANSFER_ALREADY_DELETED = 'Lệnh đã bị xoá';
```

Trong `list`, đổi `where: { status: q.status },` thành:

```ts
      // Mặc định ẩn thùng rác; lọc "Đã xóa" mới thấy.
      where: { status: q.status ?? { not: TRANSFER_STATUS.DELETED } },
```

Sau `reject(...)`, trước `private async decide`:

```ts
  /** Xoá mềm: chỉ lệnh Đã duyệt / Từ chối. Không đụng Device. Ghi có điều kiện (xem device-orders). */
  async remove(id: number) {
    const transfer = await this.findTransfer(id);
    if (transfer.status === TRANSFER_STATUS.PENDING) {
      throw new BadRequestException(TRANSFER_PENDING_DELETE);
    }
    const { count } = await this.prisma.deviceTransfer.updateMany({
      where: {
        id,
        status: { in: [TRANSFER_STATUS.APPROVED, TRANSFER_STATUS.REJECTED] },
      },
      data: { status: TRANSFER_STATUS.DELETED },
    });
    if (count === 0) throw new BadRequestException(TRANSFER_ALREADY_DELETED);
    return this.getById(id);
  }

  /** Dọn thùng rác: xoá cứng lệnh "Đã xóa" trong ids (item đi theo cascade); id khác bỏ qua lặng lẽ. */
  async purge(ids: number[]) {
    const { count } = await this.prisma.deviceTransfer.deleteMany({
      where: { id: { in: ids }, status: TRANSFER_STATUS.DELETED },
    });
    return { count };
  }
```

- [ ] **Step 7: Controller**

`device-transfers.controller.ts`: thêm `Delete` vào import `@nestjs/common`, `PurgeDeviceTransfersDto` vào import `./device-transfers.dto`. Cuối class:

```ts
  @Post('purge')
  @Allow(ACTOR.TECH_HEAD)
  @ResponseMessage('Đã dọn thùng rác')
  purge(@Body() dto: PurgeDeviceTransfersDto) {
    return this.transfers.purge(dto.ids);
  }

  @Delete(':id')
  @Allow(ACTOR.TECH_HEAD)
  @ResponseMessage('Đã xoá lệnh điều chuyển')
  remove(@TransferId() id: number) {
    return this.transfers.remove(id);
  }
```

(Trước khi dán: `grep -n "constructor" backend/src/modules/device-transfers/device-transfers.controller.ts` — nếu field không tên `transfers`, đổi `this.transfers` cho khớp.)

- [ ] **Step 8: Chạy test**

Run: `cd backend && npx -y pnpm@10 test -- device-transfers`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/src/modules/device-transfers backend/src/test/fake-prisma.ts
git commit -m "feat(device-transfers-be): xoá mềm lệnh Đã duyệt/Từ chối, thùng rác, dọn thùng rác (TP Kỹ thuật)"
```

---

### Task 3: Backend — người nhận phải thuộc một phòng ban

**Files:**
- Modify: `backend/src/modules/device-orders/device-orders.service.ts` (`create`)
- Modify: `backend/src/modules/device-transfers/device-transfers.service.ts` (`create`)
- Test: `device-orders.spec.ts`, `device-transfers.spec.ts`

**Interfaces:**
- Produces: `POST /device-orders` (type `Cấp phát`, target không phòng ban) và `POST /device-transfers` (toUser không phòng ban) → 400 `'Người nhận phải thuộc một phòng ban'`.

- [ ] **Step 1: Test thất bại**

`device-orders.spec.ts`, trong `describe('POST /device-orders', …)` thêm:

```ts
    it('Cấp phát cho người không thuộc phòng ban (Quản trị viên): 400', async () => {
      const deviceId = await createDevice();
      const res = await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(collab))
        .send({ type: 'Cấp phát', targetUserId: admin.id, deviceIds: [deviceId] })
        .expect(400);
      expect(res.body.message).toBe('Người nhận phải thuộc một phòng ban');
      expect(prisma.devices.find((d) => d.id === deviceId)!.status).toBe('Trong kho');
    });

    it('Thu hồi từ người không thuộc phòng ban vẫn được', async () => {
      const deviceId = allocate(await createDevice(), admin);
      await http()
        .post('/device-orders')
        .set('Authorization', tokenOf(collab))
        .send({ type: 'Thu hồi', targetUserId: admin.id, deviceIds: [deviceId] })
        .expect(201);
    });
```

`device-transfers.spec.ts`, trong `describe('POST /device-transfers', …)`:

```ts
    it('người nhận không thuộc phòng ban (Quản trị viên): 400', async () => {
      const deviceId = await createAllocatedDevice(staffA);
      const res = await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(collab))
        .send({ fromUserId: staffA.id, toUserId: admin.id, deviceIds: [deviceId] })
        .expect(400);
      expect(res.body.message).toBe('Người nhận phải thuộc một phòng ban');
    });

    it('người giao không thuộc phòng ban vẫn được', async () => {
      const deviceId = await createAllocatedDevice(admin);
      await http()
        .post('/device-transfers')
        .set('Authorization', tokenOf(collab))
        .send({ fromUserId: admin.id, toUserId: staffB.id, deviceIds: [deviceId] })
        .expect(201);
    });
```

- [ ] **Step 2: Chạy, xác nhận thất bại**

Run: `cd backend && npx -y pnpm@10 test -- device-orders device-transfers`
Expected: FAIL — 2 test "400" nhận 201.

- [ ] **Step 3: Implement**

`device-orders.service.ts` — thêm hằng cạnh các message khác:

```ts
const RECIPIENT_NEEDS_DEPARTMENT = 'Người nhận phải thuộc một phòng ban';
```

Trong `create`, ngay sau `const targetUser = await this.requireUser(dto.targetUserId);`:

```ts
    // Chỉ chặn người NHẬN; Thu hồi từ tài khoản không phòng ban (máy cũ) vẫn phải làm được.
    if (dto.type === ORDER_TYPE.ALLOCATE && targetUser.departmentId === null) {
      throw new BadRequestException(RECIPIENT_NEEDS_DEPARTMENT);
    }
```

`device-transfers.service.ts` — thêm cùng hằng `RECIPIENT_NEEDS_DEPARTMENT`. Trong `create` đổi `await this.requireUser(dto.toUserId);` thành:

```ts
    const toUser = await this.requireUser(dto.toUserId);
    // Chỉ chặn người NHẬN; người giao không phòng ban (máy cũ) vẫn chuyển đi được.
    if (toUser.departmentId === null) {
      throw new BadRequestException(RECIPIENT_NEEDS_DEPARTMENT);
    }
```

- [ ] **Step 4: Chạy toàn bộ test backend**

Run: `cd backend && npx -y pnpm@10 test`
Expected: PASS mọi suite (trước đó 216 test; giờ thêm ~17).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/device-orders backend/src/modules/device-transfers
git commit -m "feat(be): người nhận đơn Cấp phát / lệnh Điều chuyển phải thuộc một phòng ban"
```

---

### Task 4: Frontend — domain, quyền, repository cho xoá / thùng rác / phòng ban

**Files:**
- Modify: `frontend/src/modules/auth/domain/session.ts`, `session.test.ts`
- Modify: `frontend/src/modules/allocation/domain/deviceOrder.ts`
- Modify: `frontend/src/modules/allocation/application/DeviceOrderRepository.ts`
- Modify: `frontend/src/modules/allocation/infrastructure/HttpDeviceOrderRepository.ts`, `.test.ts`
- Modify: `frontend/src/modules/allocation/presentation/orderStatusTone.ts`
- Modify: các file tương ứng trong `frontend/src/modules/transfer/`

**Interfaces:**
- Produces:
  - `canDeleteOrder: Can`, `canDeleteTransfer: Can` (= TP Kỹ thuật).
  - `ORDER_STATUS.DELETED`, `TRANSFER_STATUS.DELETED` = `'Đã xóa'`.
  - `UserRef` (cả 2 module) có thêm `departmentId: number | null`.
  - `DepartmentRef { id: number; departmentCode: string; departmentName: string }` export từ `allocation/domain/deviceOrder.ts` và `transfer/domain/deviceTransfer.ts`.
  - Service: `deviceOrderService.remove(id): Promise<DeviceOrderDetail>`, `.purge(ids: number[]): Promise<{ count: number }>`, `.departments(): Promise<DepartmentRef[]>`; tương tự `deviceTransferService` (trả `DeviceTransferDetail`).

- [ ] **Step 1: Test quyền thất bại**

`session.test.ts`: thêm `canDeleteOrder, canDeleteTransfer` vào import từ `./session`; thêm 2 dòng vào mảng `it.each([...])` của nhóm "Admin / TP Kỹ thuật / CTV Kỹ thuật":

```ts
  ['canDeleteOrder', canDeleteOrder, false, true, false],
  ['canDeleteTransfer', canDeleteTransfer, false, true, false],
```

- [ ] **Step 2: Test repository thất bại**

`HttpDeviceOrderRepository.test.ts`, thêm trong `describe`:

```ts
  it('remove: gọi DELETE /device-orders/:id', async () => {
    await new HttpDeviceOrderRepository().remove(5);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/device-orders/5');
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('DELETE');
  });

  it('purge: POST /device-orders/purge với ids', async () => {
    fetchMock.mockImplementation(async () => envelope({ count: 2 }));
    const res = await new HttpDeviceOrderRepository().purge([3, 4]);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/device-orders/purge');
    expect(sentBody(fetchMock)).toEqual({ ids: [3, 4] });
    expect(res).toEqual({ count: 2 });
  });

  it('departments: gọi GET /departments', async () => {
    fetchMock.mockImplementation(async () => envelope([]));
    await new HttpDeviceOrderRepository().departments();
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/departments');
  });
```

`HttpDeviceTransferRepository.test.ts`: thêm 3 test y hệt, thay `HttpDeviceOrderRepository` → `HttpDeviceTransferRepository` và `/device-orders` → `/device-transfers` (giữ nguyên `/departments`). Nếu file đó chưa có helper `sentBody`, thêm:

```ts
const sentBody = (fetchMock: ReturnType<typeof vi.fn>) =>
  JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
```

- [ ] **Step 3: Chạy, xác nhận thất bại**

Run: `npm test -- src/modules/auth/domain src/modules/allocation/infrastructure src/modules/transfer/infrastructure`
Expected: FAIL — `canDeleteOrder` không tồn tại, `remove`/`purge`/`departments` is not a function.

- [ ] **Step 4: Quyền**

`session.ts`, sau `canDecideTransfer`:

```ts
/** Xoá đơn Cấp phát - Thu hồi (Đã duyệt / Từ chối) và dọn thùng rác: chỉ Trưởng phòng Kỹ thuật. */
export const canDeleteOrder = isTechHead;

/** Xoá lệnh Điều chuyển (Đã duyệt / Từ chối) và dọn thùng rác: chỉ Trưởng phòng Kỹ thuật. */
export const canDeleteTransfer = isTechHead;
```

- [ ] **Step 5: Domain allocation**

`allocation/domain/deviceOrder.ts`:

```ts
export const ORDER_STATUS = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  DELETED: 'Đã xóa',
} as const;
```

`UserRef` thêm field cuối `departmentId: number | null;`. Sau `UserRef` thêm:

```ts
/** 1 dòng của GET /departments — cho ô chọn phòng ban trước khi chọn người. */
export interface DepartmentRef {
  id: number;
  departmentCode: string;
  departmentName: string;
}

/** Đơn còn xoá mềm được (TP Kỹ thuật): Đã duyệt hoặc Từ chối. */
export const isOrderDeletable = (status: OrderStatus) =>
  status === ORDER_STATUS.APPROVED || status === ORDER_STATUS.REJECTED;
```

- [ ] **Step 6: Domain transfer**

`transfer/domain/deviceTransfer.ts`: `TRANSFER_STATUS` thêm `DELETED: 'Đã xóa'`; `UserRef` thêm `departmentId: number | null;`; thêm:

```ts
/** 1 dòng của GET /departments — cho ô chọn phòng ban trước khi chọn người. */
export interface DepartmentRef {
  id: number;
  departmentCode: string;
  departmentName: string;
}

/** Lệnh còn xoá mềm được (TP Kỹ thuật): Đã duyệt hoặc Từ chối. */
export const isTransferDeletable = (status: TransferStatus) =>
  status === TRANSFER_STATUS.APPROVED || status === TRANSFER_STATUS.REJECTED;
```

- [ ] **Step 7: Tone**

`orderStatusTone.ts` thêm `[ORDER_STATUS.DELETED]: 'neutral',`; `transferStatusTone.ts` thêm `[TRANSFER_STATUS.DELETED]: 'neutral',`.

- [ ] **Step 8: Port + service allocation**

`DeviceOrderRepository.ts`: import thêm `DepartmentRef` từ `../domain/deviceOrder`. Trong interface `DeviceOrderRepository` thêm:

```ts
  /** Xoá mềm (chỉ TP Kỹ thuật, đơn Đã duyệt / Từ chối). */
  remove(id: number): Promise<DeviceOrderDetail>;
  /** Xoá cứng các đơn "Đã xóa" trong ids. */
  purge(ids: number[]): Promise<{ count: number }>;
  departments(): Promise<DepartmentRef[]>;
```

Trong `makeDeviceOrderService` thêm:

```ts
    remove: (id: number) => repo.remove(id),
    purge: (ids: number[]) => repo.purge(ids),
    departments: () => repo.departments(),
```

- [ ] **Step 9: Http allocation**

`HttpDeviceOrderRepository.ts`: import `apiDelete` từ `@/shared/lib/apiClient`, `DepartmentRef` từ domain. Thêm vào class:

```ts
  remove(id: number): Promise<DeviceOrderDetail> {
    return apiDelete<DeviceOrderDetail>(`/device-orders/${id}`);
  }
  purge(ids: number[]): Promise<{ count: number }> {
    return apiPost<{ count: number }>('/device-orders/purge', { ids });
  }
  departments(): Promise<DepartmentRef[]> {
    return apiGet<DepartmentRef[]>('/departments');
  }
```

- [ ] **Step 10: Port + service + Http transfer**

`DeviceTransferRepository.ts` — import `DepartmentRef` từ `../domain/deviceTransfer`; interface thêm:

```ts
  /** Xoá mềm (chỉ TP Kỹ thuật, lệnh Đã duyệt / Từ chối). */
  remove(id: number): Promise<DeviceTransferDetail>;
  /** Xoá cứng các lệnh "Đã xóa" trong ids. */
  purge(ids: number[]): Promise<{ count: number }>;
  departments(): Promise<DepartmentRef[]>;
```

`makeDeviceTransferService` thêm:

```ts
    remove: (id: number) => repo.remove(id),
    purge: (ids: number[]) => repo.purge(ids),
    departments: () => repo.departments(),
```

`HttpDeviceTransferRepository.ts` — import `apiDelete`, `DepartmentRef`; class thêm:

```ts
  remove(id: number): Promise<DeviceTransferDetail> {
    return apiDelete<DeviceTransferDetail>(`/device-transfers/${id}`);
  }
  purge(ids: number[]): Promise<{ count: number }> {
    return apiPost<{ count: number }>('/device-transfers/purge', { ids });
  }
  departments(): Promise<DepartmentRef[]> {
    return apiGet<DepartmentRef[]>('/departments');
  }
```

- [ ] **Step 11: Sửa fixture `UserRef` ở test cũ**

Run: `npm run lint`
Mọi chỗ báo thiếu `departmentId` trong object `UserRef` của test (vd. `targetUser: { id: 5, fullName: …, username: 'a' }` trong `DeviceOrderListPage.test.tsx`, `fromUser`/`toUser` trong `DeviceTransferListPage.test.tsx`, fixture in biên bản trong `presentation/print/*.test.ts`) → thêm `departmentId: 1`. Lặp lại tới khi `npm run lint` sạch.

- [ ] **Step 12: Chạy test**

Run: `npm test -- src/modules/auth src/modules/allocation src/modules/transfer`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add frontend/src/modules/auth/domain frontend/src/modules/allocation frontend/src/modules/transfer
git commit -m "feat(fe): domain + repository cho xoá đơn/lệnh, thùng rác, danh sách phòng ban"
```

---

### Task 5: Frontend — nút Xoá, lọc "Đã xóa", "Dọn thùng rác" ở `/allocation` và `/transfers`

**Files:**
- Modify: `frontend/src/modules/allocation/presentation/DeviceOrderListPage.tsx`, `.test.tsx`
- Modify: `frontend/src/modules/transfer/presentation/DeviceTransferListPage.tsx`, `.test.tsx`

**Interfaces:**
- Consumes (Task 4): `canDeleteOrder`, `canDeleteTransfer`, `isOrderDeletable`, `isTransferDeletable`, `ORDER_STATUS.DELETED`, `TRANSFER_STATUS.DELETED`, `service.remove(id)`, `service.purge(ids)`.

- [ ] **Step 1: Test thất bại — allocation**

`DeviceOrderListPage.test.tsx`: thêm `fireEvent` vào import từ `@testing-library/react`. Đổi `renderPage` để mock theo URL và trả `fetchMock`:

```ts
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
  let purged = false;
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.endsWith('/device-orders/purge')) {
      purged = true;
      return envelope({ count: 1 });
    }
    if (init?.method === 'DELETE') return envelope({ ...order(1, 'Đã xóa') });
    if (url.includes('status=')) return envelope(purged ? [] : [order(9, 'Đã xóa')]);
    return envelope(orders);
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <SessionProvider>
      <MemoryRouter>
        <DeviceOrderListPage />
      </MemoryRouter>
    </SessionProvider>,
  );
  return fetchMock;
}
```

Thêm test:

```ts
it('TP Kỹ thuật: đơn Từ chối có nút Xoá → DELETE /device-orders/:id; đơn Chờ duyệt không có', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const fetchMock = renderPage('Trưởng phòng', 'KYTHUAT', [order(1, 'Từ chối'), order(2, 'Chờ duyệt')]);
  await waitFor(() => expect(screen.getAllByText('Nguyễn Văn A')).toHaveLength(2));
  const deleteButtons = screen.getAllByRole('button', { name: 'Xoá' });
  expect(deleteButtons).toHaveLength(1);
  fireEvent.click(deleteButtons[0]);
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(
        (c) => (c[0] as string).endsWith('/device-orders/1') && (c[1] as RequestInit)?.method === 'DELETE',
      ),
    ).toBe(true),
  );
});

it('Chuyên viên Kỹ thuật: không có nút Xoá; lọc "Đã xóa" xem được nhưng không có "Dọn thùng rác"', async () => {
  renderPage('Chuyên viên', 'KYTHUAT', [order(1, 'Từ chối')]);
  await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Xoá' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Lọc trạng thái'), { target: { value: 'Đã xóa' } });
  // "Đã xóa" có cả trong <option> lẫn Badge của dòng → chờ tới khi có hơn 1 chỗ.
  await waitFor(() => expect(screen.getAllByText('Đã xóa').length).toBeGreaterThan(1));
  expect(screen.queryByRole('button', { name: 'Dọn thùng rác' })).toBeNull();
});

it('TP Kỹ thuật lọc "Đã xóa": Dọn thùng rác gửi ids đang hiện, báo số đã xoá', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const fetchMock = renderPage('Trưởng phòng', 'KYTHUAT');
  await waitFor(() => expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Dọn thùng rác' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Lọc trạng thái'), { target: { value: 'Đã xóa' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Dọn thùng rác' }));
  await waitFor(() => expect(screen.getByText('Đã xoá 1 đơn')).toBeInTheDocument());
  const call = fetchMock.mock.calls.find((c) => (c[0] as string).endsWith('/device-orders/purge'))!;
  expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ ids: [9] });
});
```

- [ ] **Step 2: Test thất bại — transfer**

`DeviceTransferListPage.test.tsx`: áp dụng cùng thay đổi `renderPage` (URL `/device-transfers/purge`, fixture `transfer(id, status)` có sẵn trong file) và 3 test tương tự với:
- tên nút giống hệt (`'Xoá'`, `'Dọn thùng rác'`), label `'Lọc trạng thái'`;
- URL `/device-transfers/1`, `/device-transfers/purge`;
- thông báo `'Đã xoá 1 lệnh'`;
- text chờ hiển thị = `'Nhân viên A'` (người giao trong fixture `transfer`).

- [ ] **Step 3: Chạy, xác nhận thất bại**

Run: `npm test -- src/modules/allocation/presentation src/modules/transfer/presentation`
Expected: FAIL (không có nút Xoá / label `Lọc trạng thái`).

- [ ] **Step 4: Implement — `DeviceOrderListPage.tsx`**

Import: thêm `canDeleteOrder` (từ `@/modules/auth/domain/session`), `isOrderDeletable` (từ `../domain/deviceOrder`).

Trong component, sau `const canDecide = …`:

```ts
  const canDelete = canDeleteOrder(session);
  const [purgedCount, setPurgedCount] = useState<number | null>(null);
```

Sau action `print`:

```ts
  const remove = useAsyncAction(async (o: DeviceOrder) => {
    if (!window.confirm(`Xoá đơn #${o.id}?`)) return;
    await deviceOrderService.remove(o.id);
    setReloadKey((k) => k + 1);
  });

  const canPurge = canDelete && status === ORDER_STATUS.DELETED && (orders?.length ?? 0) > 0;
  const purge = useAsyncAction(async () => {
    const ids = (orders ?? []).map((o) => o.id);
    if (!window.confirm(`Xoá vĩnh viễn ${ids.length} đơn? Không thể khôi phục.`)) return;
    const { count } = await deviceOrderService.purge(ids);
    setPurgedCount(count);
    setReloadKey((k) => k + 1);
  });
```

Trong cell `actions`, sau khối nút "In biên bản":

```tsx
          {canDelete && isOrderDeletable(o.status) && (
            <Button size="sm" variant="outline" disabled={remove.pending} onClick={() => void remove.run(o)}>
              Xoá
            </Button>
          )}
```

Select trạng thái: thêm `aria-label="Lọc trạng thái"`, đổi `onChange` thành `onChange={(e) => { setStatus(e.target.value as OrderStatus | ''); setPurgedCount(null); }}`, thêm option cuối `<option value={ORDER_STATUS.DELETED}>{ORDER_STATUS.DELETED}</option>`. Sau `</Select>` thứ hai (vẫn trong div thanh lọc):

```tsx
          {canPurge && (
            <Button variant="outline" size="sm" disabled={purge.pending} onClick={() => void purge.run()}>
              Dọn thùng rác
            </Button>
          )}
```

Thay khối hiển thị lỗi thành:

```tsx
        {purgedCount !== null && <p className="mb-3 text-sm text-status-okFg">Đã xoá {purgedCount} đơn</p>}
        {(approve.error ?? reject.error ?? print.error ?? remove.error ?? purge.error ?? error) && (
          <p className="mb-3 text-sm text-status-dangerFg">
            {approve.error ?? reject.error ?? print.error ?? remove.error ?? purge.error ?? error}
          </p>
        )}
```

- [ ] **Step 5: Implement — `DeviceTransferListPage.tsx`**

Cùng thay đổi, với: `canDeleteTransfer`, `isTransferDeletable`, `TRANSFER_STATUS.DELETED`, `deviceTransferService`, biến `transfers`, `TransferStatus`, confirm `` `Xoá lệnh #${t.id}?` `` / `` `Xoá vĩnh viễn ${ids.length} lệnh? Không thể khôi phục.` ``, thông báo `Đã xoá {purgedCount} lệnh`.

- [ ] **Step 6: Chạy test**

Run: `npm test -- src/modules/allocation/presentation src/modules/transfer/presentation`
Expected: PASS (test cũ + 6 test mới).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/allocation/presentation frontend/src/modules/transfer/presentation
git commit -m "feat(fe): xoá đơn/lệnh, lọc Đã xóa, dọn thùng rác ở Cấp phát - Thu hồi và Điều chuyển"
```

---

### Task 6: Frontend — modal "Chi tiết" đơn/lệnh + `DecisionInfo`

**Files:**
- Create: `frontend/src/shared/ui/DecisionInfo.tsx`
- Create: `frontend/src/modules/allocation/presentation/OrderDetailModal.tsx`, `OrderDetailModal.test.tsx`
- Create: `frontend/src/modules/transfer/presentation/TransferDetailModal.tsx`, `TransferDetailModal.test.tsx`
- Modify: `DeviceOrderListPage.tsx`, `DeviceTransferListPage.tsx`

**Interfaces:**
- Consumes: `deviceOrderService.get(id): Promise<DeviceOrderDetail>`, `deviceTransferService.get(id)`, `ORDER_STATUS_TONE`, `TRANSFER_STATUS_TONE`, `Modal`, `DataTable`, `Badge`, `Button`, `useAsyncData`.
- Produces:
  - `DecisionInfo(props: { createdBy: { fullName: string }; createdAt: string; decidedBy: { fullName: string } | null; decidedAt: string | null; rejectReason: string | null })`.
  - `OrderDetailModal({ id: number | null; onClose: () => void })`, `TransferDetailModal({ id: number | null; onClose: () => void })`.

- [ ] **Step 1: Test thất bại**

`OrderDetailModal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { OrderDetailModal } from './OrderDetailModal';

afterEach(() => {
  vi.unstubAllGlobals();
});

const detail = (over: Record<string, unknown> = {}) => ({
  id: 12,
  type: 'Cấp phát',
  status: 'Từ chối',
  note: null,
  rejectReason: 'Không đủ ngân sách',
  decidedAt: '2026-10-02T03:00:00.000Z',
  createdAt: '2026-10-01T03:00:00.000Z',
  targetUser: { id: 5, fullName: 'Nguyễn Văn A', username: 'a', departmentId: 1 },
  createdBy: { id: 2, fullName: 'Chuyên viên KT' },
  decidedBy: { id: 3, fullName: 'Trưởng phòng KT' },
  deviceCount: 1,
  items: [
    {
      id: 1,
      device: {
        id: 7,
        deviceCode: 'LT-000007',
        deviceName: 'Dell Latitude',
        serialNumber: 'SN7',
        deviceType: { id: 1, typeName: 'Laptop', prefix: 'LT' },
      },
    },
  ],
  ...over,
});

const stub = (data: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data, error: null, message: 'OK' }), { status: 200 }),
    ),
  );

it('hiện người tạo, người duyệt, thiết bị và lý do từ chối', async () => {
  stub(detail());
  render(<OrderDetailModal id={12} onClose={() => {}} />);
  expect(await screen.findByText('LT-000007')).toBeInTheDocument();
  expect(screen.getByText('Chuyên viên KT')).toBeInTheDocument();
  expect(screen.getByText('Trưởng phòng KT')).toBeInTheDocument();
  expect(screen.getByText('Lý do từ chối')).toBeInTheDocument();
  expect(screen.getByText('Không đủ ngân sách')).toBeInTheDocument();
});

it('đơn đã xoá nhưng có lý do từ chối: vẫn hiện lý do', async () => {
  stub(detail({ status: 'Đã xóa' }));
  render(<OrderDetailModal id={12} onClose={() => {}} />);
  expect(await screen.findByText('Không đủ ngân sách')).toBeInTheDocument();
});

it('không có lý do từ chối: không có khung lý do, người duyệt "Chưa duyệt"', async () => {
  stub(detail({ status: 'Chờ duyệt', rejectReason: null, decidedBy: null, decidedAt: null }));
  render(<OrderDetailModal id={12} onClose={() => {}} />);
  expect(await screen.findByText('LT-000007')).toBeInTheDocument();
  expect(screen.queryByText('Lý do từ chối')).toBeNull();
  expect(screen.getByText('Chưa duyệt')).toBeInTheDocument();
});
```

`TransferDetailModal.test.tsx`: giống hệt, đổi import sang `TransferDetailModal`, fixture bỏ `type`/`targetUser`, thêm `fromUser: { id: 5, fullName: 'Nguyễn Văn A', username: 'a', departmentId: 1 }`, `toUser: { id: 6, fullName: 'Trần Thị B', username: 'b', departmentId: 2 }`; thêm assert `expect(screen.getByText('Trần Thị B')).toBeInTheDocument();` ở test đầu.

- [ ] **Step 2: Chạy, xác nhận thất bại**

Run: `npm test -- src/modules/allocation/presentation/OrderDetailModal src/modules/transfer/presentation/TransferDetailModal`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: `DecisionInfo`**

`frontend/src/shared/ui/DecisionInfo.tsx`:

```tsx
/** Khối Người tạo / Người duyệt / Lý do từ chối — dùng chung cho chi tiết đơn và lệnh. */
export function DecisionInfo({
  createdBy,
  createdAt,
  decidedBy,
  decidedAt,
  rejectReason,
}: {
  createdBy: { fullName: string };
  createdAt: string;
  decidedBy: { fullName: string } | null;
  decidedAt: string | null;
  rejectReason: string | null;
}) {
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink-muted">Người tạo</dt>
          <dd className="font-medium text-ink">{createdBy.fullName}</dd>
          <dd className="text-ink-muted">{createdAt.slice(0, 10)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Người duyệt</dt>
          {decidedBy ? (
            <>
              <dd className="font-medium text-ink">{decidedBy.fullName}</dd>
              <dd className="text-ink-muted">{decidedAt?.slice(0, 10)}</dd>
            </>
          ) : (
            <dd className="text-ink-muted">Chưa duyệt</dd>
          )}
        </div>
      </dl>
      {rejectReason && (
        <div className="rounded-lg bg-status-dangerBg p-3 text-sm">
          <p className="font-semibold text-status-dangerFg">Lý do từ chối</p>
          <p className="mt-1 text-ink">{rejectReason}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: `OrderDetailModal`**

`frontend/src/modules/allocation/presentation/OrderDetailModal.tsx`:

```tsx
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { DecisionInfo } from '@/shared/ui/DecisionInfo';
import { Modal } from '@/shared/ui/Modal';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { ORDER_STATUS, type DeviceOrderDetail } from '../domain/deviceOrder';
import { deviceOrderService } from '../infrastructure/container';
import { ORDER_STATUS_TONE } from './orderStatusTone';

type Item = DeviceOrderDetail['items'][number];

const ITEM_COLUMNS: Array<Column<Item>> = [
  { key: 'code', header: 'Mã', cell: (i) => i.device.deviceCode },
  { key: 'name', header: 'Tên', cell: (i) => i.device.deviceName },
  { key: 'type', header: 'Loại', cell: (i) => i.device.deviceType.typeName },
  { key: 'serial', header: 'Serial', cell: (i) => i.device.serialNumber ?? '—' },
];

/** Xem chi tiết 1 đơn: thông tin chung, người tạo/duyệt, lý do từ chối, danh sách thiết bị. */
export function OrderDetailModal({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data, loading, error } = useAsyncData<DeviceOrderDetail | null>(
    () => (id === null ? Promise.resolve(null) : deviceOrderService.get(id)),
    [id],
  );
  const print = useAsyncAction(async (d: DeviceOrderDetail) => {
    const { downloadBienBan } = await import('./print/generateBienBan');
    downloadBienBan(d);
  });

  return (
    <Modal
      open={id !== null}
      title={`Chi tiết đơn #${id ?? ''}`}
      onClose={onClose}
      footer={
        <>
          {data?.status === ORDER_STATUS.APPROVED && (
            <Button variant="outline" disabled={print.pending} onClick={() => void print.run(data)}>
              In biên bản
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </>
      }
    >
      {loading ? (
        <p className="text-sm text-ink-muted">Đang tải…</p>
      ) : error || !data ? (
        <p className="text-sm text-status-dangerFg">{error ?? 'Không tải được đơn'}</p>
      ) : (
        <div className="space-y-5">
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Loại</dt>
              <dd className="font-medium text-ink">{data.type}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Trạng thái</dt>
              <dd>
                <Badge tone={ORDER_STATUS_TONE[data.status]}>{data.status}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">Người liên quan</dt>
              <dd className="font-medium text-ink">{data.targetUser.fullName}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Ghi chú</dt>
              <dd className="text-ink">{data.note || '—'}</dd>
            </div>
          </dl>
          <DecisionInfo
            createdBy={data.createdBy}
            createdAt={data.createdAt}
            decidedBy={data.decidedBy}
            decidedAt={data.decidedAt}
            rejectReason={data.rejectReason}
          />
          <DataTable columns={ITEM_COLUMNS} rows={data.items} rowKey={(i) => String(i.id)} />
          {print.error && <p className="text-sm text-status-dangerFg">{print.error}</p>}
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 5: `TransferDetailModal`**

`frontend/src/modules/transfer/presentation/TransferDetailModal.tsx`:

```tsx
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { DataTable, type Column } from '@/shared/ui/DataTable';
import { DecisionInfo } from '@/shared/ui/DecisionInfo';
import { Modal } from '@/shared/ui/Modal';
import { useAsyncAction } from '@/shared/lib/useAsyncAction';
import { useAsyncData } from '@/shared/lib/useAsyncData';
import { TRANSFER_STATUS, type DeviceTransferDetail } from '../domain/deviceTransfer';
import { deviceTransferService } from '../infrastructure/container';
import { TRANSFER_STATUS_TONE } from './transferStatusTone';

type Item = DeviceTransferDetail['items'][number];

const ITEM_COLUMNS: Array<Column<Item>> = [
  { key: 'code', header: 'Mã', cell: (i) => i.device.deviceCode },
  { key: 'name', header: 'Tên', cell: (i) => i.device.deviceName },
  { key: 'type', header: 'Loại', cell: (i) => i.device.deviceType.typeName },
  { key: 'serial', header: 'Serial', cell: (i) => i.device.serialNumber ?? '—' },
];

/** Xem chi tiết 1 lệnh điều chuyển: người giao → nhận, người tạo/duyệt, lý do từ chối, thiết bị. */
export function TransferDetailModal({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data, loading, error } = useAsyncData<DeviceTransferDetail | null>(
    () => (id === null ? Promise.resolve(null) : deviceTransferService.get(id)),
    [id],
  );
  const print = useAsyncAction(async (d: DeviceTransferDetail) => {
    const { downloadBienBan } = await import('./print/generateBienBan');
    downloadBienBan(d);
  });

  return (
    <Modal
      open={id !== null}
      title={`Chi tiết lệnh điều chuyển #${id ?? ''}`}
      onClose={onClose}
      footer={
        <>
          {data?.status === TRANSFER_STATUS.APPROVED && (
            <Button variant="outline" disabled={print.pending} onClick={() => void print.run(data)}>
              In biên bản
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </>
      }
    >
      {loading ? (
        <p className="text-sm text-ink-muted">Đang tải…</p>
      ) : error || !data ? (
        <p className="text-sm text-status-dangerFg">{error ?? 'Không tải được lệnh'}</p>
      ) : (
        <div className="space-y-5">
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Người giao</dt>
              <dd className="font-medium text-ink">{data.fromUser.fullName}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Người nhận</dt>
              <dd className="font-medium text-ink">{data.toUser.fullName}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Trạng thái</dt>
              <dd>
                <Badge tone={TRANSFER_STATUS_TONE[data.status]}>{data.status}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-ink-muted">Ghi chú</dt>
              <dd className="text-ink">{data.note || '—'}</dd>
            </div>
          </dl>
          <DecisionInfo
            createdBy={data.createdBy}
            createdAt={data.createdAt}
            decidedBy={data.decidedBy}
            decidedAt={data.decidedAt}
            rejectReason={data.rejectReason}
          />
          <DataTable columns={ITEM_COLUMNS} rows={data.items} rowKey={(i) => String(i.id)} />
          {print.error && <p className="text-sm text-status-dangerFg">{print.error}</p>}
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 6: Gắn nút "Chi tiết" vào 2 trang danh sách**

`DeviceOrderListPage.tsx`: import `OrderDetailModal` từ `./OrderDetailModal`; thêm state `const [detailId, setDetailId] = useState<number | null>(null);`; trong cell `actions`, làm nút **đầu tiên** trong `<div className="flex justify-end gap-2">`:

```tsx
          <Button size="sm" variant="outline" onClick={() => setDetailId(o.id)}>
            Chi tiết
          </Button>
```

Trước `</>` cuối cùng của JSX trả về:

```tsx
      <OrderDetailModal id={detailId} onClose={() => setDetailId(null)} />
```

`DeviceTransferListPage.tsx`: tương tự với `TransferDetailModal`, `setDetailId(t.id)`.

Thêm 1 test vào `DeviceOrderListPage.test.tsx`:

```ts
it('Quản trị viên: mọi dòng có nút "Chi tiết", bấm thì mở modal', async () => {
  renderPage('Quản trị viên', null, [order(1, 'Chờ duyệt'), order(2, 'Từ chối')]);
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Chi tiết' })).toHaveLength(2));
  fireEvent.click(screen.getAllByRole('button', { name: 'Chi tiết' })[0]);
  expect(await screen.findByText('Chi tiết đơn #1')).toBeInTheDocument();
});
```

(Mock fetch trong `renderPage` trả `order(...)` cho `GET /device-orders/1` — thiếu `items` sẽ làm `DataTable` lỗi; vì vậy trong `renderPage`, trước nhánh `return envelope(orders)`, thêm: `if (/\/device-orders\/\d+$/.test(url)) return envelope({ ...order(1), items: [] });`.) Thêm test tương tự vào `DeviceTransferListPage.test.tsx` (`'Chi tiết lệnh điều chuyển #1'`, regex `/\/device-transfers\/\d+$/`).

- [ ] **Step 7: Chạy test**

Run: `npm test -- src/modules/allocation src/modules/transfer`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/shared/ui/DecisionInfo.tsx frontend/src/modules/allocation/presentation frontend/src/modules/transfer/presentation
git commit -m "feat(fe): modal Chi tiết đơn/lệnh (người tạo, người duyệt, lý do từ chối, thiết bị)"
```

---

### Task 7: Frontend — `DepartmentUserSelect`

**Files:**
- Create: `frontend/src/shared/ui/DepartmentUserSelect.tsx`
- Test: `frontend/src/shared/ui/DepartmentUserSelect.test.tsx`

**Interfaces:**
- Produces:

```ts
export interface DepartmentOption { id: number; departmentName: string }
export interface UserOption { id: number; fullName: string; username: string; departmentId: number | null }
export function DepartmentUserSelect(props: {
  label: string;
  departments: DepartmentOption[];
  users: UserOption[];
  value: number | null;
  onChange: (userId: number | null) => void;
  excludeUserId?: number | null;
}): JSX.Element;
```
Accessible names: ô phòng ban `"Phòng ban (<label>)"`, ô người `"<label>"`.

- [ ] **Step 1: Test thất bại**

`DepartmentUserSelect.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DepartmentUserSelect } from './DepartmentUserSelect';

const departments = [
  { id: 1, departmentName: 'Phòng Kỹ thuật' },
  { id: 2, departmentName: 'Phòng Kế toán' },
];
const users = [
  { id: 7, fullName: 'Nguyễn Văn A', username: 'a', departmentId: 1 },
  { id: 8, fullName: 'Trần Thị B', username: 'b', departmentId: 2 },
  { id: 9, fullName: 'Lê Văn C', username: 'c', departmentId: 1 },
  { id: 1, fullName: 'Quản trị', username: 'admin', departmentId: null },
];

const options = (name: string) =>
  Array.from((screen.getByLabelText(name) as HTMLSelectElement).options).map((o) => o.text);

it('chưa chọn phòng: ô người bị khoá', () => {
  render(<DepartmentUserSelect label="Người nhận" departments={departments} users={users} value={null} onChange={() => {}} />);
  expect(screen.getByLabelText('Người nhận')).toBeDisabled();
});

it('chọn phòng: chỉ hiện người của phòng đó, không bao giờ có người không phòng ban', () => {
  render(<DepartmentUserSelect label="Người nhận" departments={departments} users={users} value={null} onChange={() => {}} />);
  fireEvent.change(screen.getByLabelText('Phòng ban (Người nhận)'), { target: { value: '1' } });
  expect(options('Người nhận')).toEqual(['— Chọn người —', 'Nguyễn Văn A (a)', 'Lê Văn C (c)']);
});

it('chọn người gọi onChange(id); đổi phòng gọi onChange(null)', () => {
  const onChange = vi.fn();
  render(<DepartmentUserSelect label="Người nhận" departments={departments} users={users} value={null} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('Phòng ban (Người nhận)'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Người nhận'), { target: { value: '9' } });
  expect(onChange).toHaveBeenLastCalledWith(9);
  fireEvent.change(screen.getByLabelText('Phòng ban (Người nhận)'), { target: { value: '2' } });
  expect(onChange).toHaveBeenLastCalledWith(null);
});

it('excludeUserId bị loại khỏi danh sách', () => {
  render(
    <DepartmentUserSelect label="Người nhận" departments={departments} users={users} value={null} onChange={() => {}} excludeUserId={7} />,
  );
  fireEvent.change(screen.getByLabelText('Phòng ban (Người nhận)'), { target: { value: '1' } });
  expect(options('Người nhận')).toEqual(['— Chọn người —', 'Lê Văn C (c)']);
});

it('có value sẵn: phòng ban tự suy ra từ người đó', () => {
  render(<DepartmentUserSelect label="Người nhận" departments={departments} users={users} value={8} onChange={() => {}} />);
  expect(screen.getByLabelText('Phòng ban (Người nhận)')).toHaveValue('2');
  expect(screen.getByLabelText('Người nhận')).toHaveValue('8');
});
```

- [ ] **Step 2: Chạy, xác nhận thất bại**

Run: `npm test -- src/shared/ui/DepartmentUserSelect`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Implement**

`frontend/src/shared/ui/DepartmentUserSelect.tsx`:

```tsx
import { useState } from 'react';
import { Select } from './inputs';

export interface DepartmentOption {
  id: number;
  departmentName: string;
}

export interface UserOption {
  id: number;
  fullName: string;
  username: string;
  departmentId: number | null;
}

/**
 * Chọn 1 người theo 2 bước: Phòng ban → Nhân viên. Người không có phòng ban (Quản trị viên) không
 * bao giờ hiện. Component thuần — dữ liệu nhận qua props, không tự gọi API.
 */
export function DepartmentUserSelect({
  label,
  departments,
  users,
  value,
  onChange,
  excludeUserId = null,
}: {
  label: string;
  departments: DepartmentOption[];
  users: UserOption[];
  value: number | null;
  onChange: (userId: number | null) => void;
  excludeUserId?: number | null;
}) {
  const [pickedDepartment, setPickedDepartment] = useState('');
  const selectedUser = users.find((u) => u.id === value);
  // Có value sẵn mà chưa chọn phòng (mở form với dữ liệu có sẵn) → suy ra phòng từ người đó.
  const departmentId =
    pickedDepartment || (selectedUser?.departmentId != null ? String(selectedUser.departmentId) : '');
  const listed = departmentId
    ? users.filter((u) => u.departmentId === Number(departmentId) && u.id !== excludeUserId)
    : [];

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          aria-label={`Phòng ban (${label})`}
          value={departmentId}
          onChange={(e) => {
            setPickedDepartment(e.target.value);
            onChange(null);
          }}
        >
          <option value="">— Chọn phòng ban —</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.departmentName}
            </option>
          ))}
        </Select>
        <Select
          aria-label={label}
          disabled={!departmentId}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— Chọn người —</option>
          {listed.map((u) => (
            <option key={u.id} value={u.id}>
              {`${u.fullName} (${u.username})`}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Chạy test**

Run: `npm test -- src/shared/ui/DepartmentUserSelect`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/ui/DepartmentUserSelect.tsx frontend/src/shared/ui/DepartmentUserSelect.test.tsx
git commit -m "feat(fe): DepartmentUserSelect — chọn phòng ban rồi chọn người"
```

---

### Task 8: Frontend — `filterDevices` + `DeviceChecklist`

**Files:**
- Create: `frontend/src/modules/device/domain/filterDevices.ts`, `filterDevices.test.ts`
- Create: `frontend/src/modules/device/presentation/DeviceChecklist.tsx`, `DeviceChecklist.test.tsx`

**Interfaces:**
- Produces:

```ts
export interface DeviceFilter { search: string; typeId: number | null; location: string }
export const EMPTY_DEVICE_FILTER: DeviceFilter;
export function filterDevices(devices: Device[], f: DeviceFilter): Device[];
export function deviceLocations(devices: Device[]): string[]; // distinct, sort theo vi
export function DeviceChecklist(props: {
  devices: Device[];
  deviceTypes: DeviceTypeRef[];
  selectedIds: number[];
  onToggle: (id: number, checked: boolean) => void;
}): JSX.Element;
```

- [ ] **Step 1: Test domain thất bại**

`filterDevices.test.ts`:

```ts
import { expect, it } from 'vitest';
import type { Device } from './device';
import { deviceLocations, EMPTY_DEVICE_FILTER, filterDevices } from './filterDevices';

const d = (id: number, over: Partial<Device>): Device =>
  ({
    id,
    deviceCode: `LT-00000${id}`,
    deviceName: 'Máy',
    serialNumber: null,
    location: null,
    deviceType: { id: 1, typeName: 'Laptop', prefix: 'LT' },
    ...over,
  }) as Device;

const devices = [
  d(1, { deviceName: 'Dell Latitude', serialNumber: 'ABC123', location: 'Tầng 2' }),
  d(2, { deviceCode: 'PC-000002', deviceName: 'HP ProDesk', deviceType: { id: 2, typeName: 'PC', prefix: 'PC' }, location: 'Tầng 3' }),
  d(3, { deviceName: 'Lenovo', location: null }),
];

it('bộ lọc rỗng: trả nguyên danh sách', () => {
  expect(filterDevices(devices, EMPTY_DEVICE_FILTER)).toEqual(devices);
});

it('tìm theo mã / tên / serial, không phân biệt hoa thường, bỏ khoảng trắng 2 đầu', () => {
  const ids = (search: string) => filterDevices(devices, { ...EMPTY_DEVICE_FILTER, search }).map((x) => x.id);
  expect(ids('pc-0000')).toEqual([2]);
  expect(ids('  dell ')).toEqual([1]);
  expect(ids('abc')).toEqual([1]);
});

it('lọc loại + vị trí kết hợp', () => {
  expect(filterDevices(devices, { search: '', typeId: 1, location: 'Tầng 2' }).map((x) => x.id)).toEqual([1]);
  expect(filterDevices(devices, { search: '', typeId: 2, location: 'Tầng 2' })).toEqual([]);
});

it('deviceLocations: distinct, bỏ null, sắp xếp', () => {
  expect(deviceLocations([...devices, d(4, { location: 'Tầng 2' })])).toEqual(['Tầng 2', 'Tầng 3']);
});
```

- [ ] **Step 2: Test component thất bại**

`DeviceChecklist.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { Device } from '../domain/device';
import { DeviceChecklist } from './DeviceChecklist';

const types = [
  { id: 1, typeName: 'Laptop', prefix: 'LT' },
  { id: 2, typeName: 'PC', prefix: 'PC' },
];
const devices = [
  { id: 1, deviceCode: 'LT-000001', deviceName: 'Dell', serialNumber: null, location: 'Tầng 2', deviceType: types[0] },
  { id: 2, deviceCode: 'PC-000002', deviceName: 'HP', serialNumber: null, location: 'Tầng 3', deviceType: types[1] },
] as Device[];

it('lọc ẩn máy đã tick nhưng vẫn đếm nó trong "Đã chọn"', () => {
  const onToggle = vi.fn();
  render(<DeviceChecklist devices={devices} deviceTypes={types} selectedIds={[1]} onToggle={onToggle} />);
  expect(screen.getByText('Đã chọn 1 thiết bị')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Lọc loại thiết bị'), { target: { value: '2' } });
  expect(screen.queryByLabelText('LT-000001 — Dell')).toBeNull();
  expect(screen.getByText('Đã chọn 1 thiết bị')).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('PC-000002 — HP'));
  expect(onToggle).toHaveBeenCalledWith(2, true);
});

it('lọc ra rỗng: báo không khớp', () => {
  render(<DeviceChecklist devices={devices} deviceTypes={types} selectedIds={[]} onToggle={() => {}} />);
  fireEvent.change(screen.getByLabelText('Tìm thiết bị'), { target: { value: 'zzz' } });
  expect(screen.getByText('Không có thiết bị khớp bộ lọc')).toBeInTheDocument();
});
```

- [ ] **Step 3: Chạy, xác nhận thất bại**

Run: `npm test -- src/modules/device/domain/filterDevices src/modules/device/presentation/DeviceChecklist`
Expected: FAIL — module không tồn tại.

- [ ] **Step 4: Implement domain**

`frontend/src/modules/device/domain/filterDevices.ts`:

```ts
import type { Device } from './device';

export interface DeviceFilter {
  search: string;
  typeId: number | null;
  location: string;
}

export const EMPTY_DEVICE_FILTER: DeviceFilter = { search: '', typeId: null, location: '' };

/** Lọc phía client cho danh sách thiết bị trong form đơn/lệnh (danh sách đã tải sẵn, nhỏ). */
export function filterDevices(devices: Device[], f: DeviceFilter): Device[] {
  const q = f.search.trim().toLowerCase();
  return devices.filter(
    (d) =>
      (!q || [d.deviceCode, d.deviceName, d.serialNumber ?? ''].some((s) => s.toLowerCase().includes(q))) &&
      (f.typeId === null || d.deviceType.id === f.typeId) &&
      (!f.location || d.location === f.location),
  );
}

/** Các vị trí đang có trong danh sách (bỏ máy không có vị trí). */
export function deviceLocations(devices: Device[]): string[] {
  return [...new Set(devices.flatMap((d) => (d.location ? [d.location] : [])))].sort((a, b) =>
    a.localeCompare(b, 'vi'),
  );
}
```

- [ ] **Step 5: Implement component**

`frontend/src/modules/device/presentation/DeviceChecklist.tsx`:

```tsx
import { useState } from 'react';
import { Checkbox, Select } from '@/shared/ui/inputs';
import { SearchInput } from '@/shared/ui/SearchInput';
import type { Device, DeviceTypeRef } from '../domain/device';
import { deviceLocations, EMPTY_DEVICE_FILTER, filterDevices } from '../domain/filterDevices';

/** Danh sách tick thiết bị có ô tìm + lọc loại + lọc vị trí. Lọc không bỏ tick máy bị ẩn. */
export function DeviceChecklist({
  devices,
  deviceTypes,
  selectedIds,
  onToggle,
}: {
  devices: Device[];
  deviceTypes: DeviceTypeRef[];
  selectedIds: number[];
  onToggle: (id: number, checked: boolean) => void;
}) {
  const [filter, setFilter] = useState(EMPTY_DEVICE_FILTER);
  const shown = filterDevices(devices, filter);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchInput
          aria-label="Tìm thiết bị"
          placeholder="Tìm theo mã, tên hoặc serial"
          value={filter.search}
          onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
        />
        <Select
          aria-label="Lọc loại thiết bị"
          className="sm:w-48"
          value={filter.typeId ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, typeId: e.target.value ? Number(e.target.value) : null }))}
        >
          <option value="">Loại (Tất cả)</option>
          {deviceTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.typeName}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Lọc vị trí"
          className="sm:w-48"
          value={filter.location}
          onChange={(e) => setFilter((f) => ({ ...f, location: e.target.value }))}
        >
          <option value="">Vị trí (Tất cả)</option>
          {deviceLocations(devices).map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
      </div>
      <p className="text-sm text-ink-muted">Đã chọn {selectedIds.length} thiết bị</p>
      {shown.length === 0 ? (
        <p className="text-sm text-ink-muted">Không có thiết bị khớp bộ lọc</p>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {shown.map((d) => (
            <div key={d.id}>
              <Checkbox
                id={`device-${d.id}`}
                label={`${d.deviceCode} — ${d.deviceName}`}
                checked={selectedIds.includes(d.id)}
                onChange={(e) => onToggle(d.id, e.target.checked)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Chạy test**

Run: `npm test -- src/modules/device`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/device/domain/filterDevices.ts frontend/src/modules/device/domain/filterDevices.test.ts frontend/src/modules/device/presentation/DeviceChecklist.tsx frontend/src/modules/device/presentation/DeviceChecklist.test.tsx
git commit -m "feat(fe): DeviceChecklist — tìm kiếm, lọc loại và vị trí cho danh sách thiết bị trong form"
```

---

### Task 9: Frontend — áp `DepartmentUserSelect` + `DeviceChecklist` vào form Tạo đơn / Tạo lệnh

**Files:**
- Modify: `frontend/src/modules/allocation/presentation/CreateOrderPage.tsx`
- Modify: `frontend/src/modules/transfer/presentation/CreateTransferPage.tsx`
- Test: `frontend/src/modules/allocation/presentation/CreateOrderPage.test.tsx` (mới)

**Interfaces:**
- Consumes: Task 4 `deviceOrderService.departments()`, `deviceTransferService.departments()`, `UserRef.departmentId`; Task 7 `DepartmentUserSelect`; Task 8 `DeviceChecklist`; `deviceService.deviceTypes()` (có sẵn).

- [ ] **Step 1: Test thất bại**

`CreateOrderPage.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { CreateOrderPage } from './CreateOrderPage';

afterEach(() => {
  vi.unstubAllGlobals();
});

const envelope = (data: unknown) =>
  Promise.resolve(new Response(JSON.stringify({ success: true, data, error: null, message: 'OK' }), { status: 200 }));

it('chọn phòng ban → người → tick thiết bị đã lọc → gửi đúng body', async () => {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('/departments')) return envelope([{ id: 1, departmentCode: 'KYTHUAT', departmentName: 'Phòng Kỹ thuật' }]);
    if (url.endsWith('/users/lookup'))
      return envelope([
        { id: 7, fullName: 'Nguyễn Văn A', username: 'a', departmentId: 1 },
        { id: 1, fullName: 'Quản trị', username: 'admin', departmentId: null },
      ]);
    if (url.endsWith('/device-types')) return envelope([{ id: 1, typeName: 'Laptop', prefix: 'LT' }]);
    if (url.includes('/devices'))
      return envelope([
        { id: 3, deviceCode: 'LT-000003', deviceName: 'Dell', serialNumber: null, location: null, deviceType: { id: 1, typeName: 'Laptop', prefix: 'LT' } },
      ]);
    return envelope({ id: 1 });
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <MemoryRouter>
      <CreateOrderPage />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByLabelText('Cấp phát'));
  await waitFor(() => expect(screen.getByRole('option', { name: 'Phòng Kỹ thuật' })).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Phòng ban (Người nhận)'), { target: { value: '1' } });
  await screen.findByRole('option', { name: 'Nguyễn Văn A (a)' });
  expect(screen.queryByRole('option', { name: 'Quản trị (admin)' })).toBeNull();
  fireEvent.change(screen.getByLabelText('Người nhận'), { target: { value: '7' } });
  fireEvent.click(await screen.findByLabelText('LT-000003 — Dell'));
  fireEvent.click(screen.getByRole('button', { name: 'Tạo đơn' }));

  await waitFor(() => {
    const call = fetchMock.mock.calls.find(
      (c) => (c[0] as string).endsWith('/device-orders') && (c[1] as RequestInit)?.method === 'POST',
    );
    expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({
      type: 'Cấp phát',
      targetUserId: 7,
      deviceIds: [3],
    });
  });
});
```

- [ ] **Step 2: Chạy, xác nhận thất bại**

Run: `npm test -- src/modules/allocation/presentation/CreateOrderPage`
Expected: FAIL — không có label `Phòng ban (Người nhận)`.

- [ ] **Step 3: Sửa `CreateOrderPage.tsx`**

Import: bỏ `Field`, `Checkbox`, `Select` khỏi import (chỉ giữ `Radio`, `Textarea` từ `@/shared/ui/inputs`); thêm:

```ts
import { DepartmentUserSelect } from '@/shared/ui/DepartmentUserSelect';
import { DeviceChecklist } from '@/modules/device/presentation/DeviceChecklist';
```

Sau `const { data: users } = …`:

```ts
  const { data: departments } = useAsyncData(() => deviceOrderService.departments(), []);
  const { data: deviceTypes } = useAsyncData(() => deviceService.deviceTypes(), []);
```

Thay toàn bộ `<Field …>…</Field>` trong section "Người liên quan" bằng:

```tsx
            <DepartmentUserSelect
              label={draft.type === ORDER_TYPE.RECOVER ? 'Người đang giữ' : 'Người nhận'}
              departments={departments ?? []}
              users={users ?? []}
              value={draft.targetUserId}
              onChange={(targetUserId) => setDraft((d) => ({ ...d, targetUserId, deviceIds: [] }))}
            />
```

Trong section "Thiết bị", thay nhánh cuối (`<div className="space-y-2">…</div>`) bằng:

```tsx
              <DeviceChecklist
                devices={eligibleDevices ?? []}
                deviceTypes={deviceTypes ?? []}
                selectedIds={draft.deviceIds}
                onToggle={toggleDevice}
              />
```

- [ ] **Step 4: Sửa `CreateTransferPage.tsx`**

Import: bỏ `Field`, `Checkbox`, `Select` (giữ `Textarea`); thêm `DepartmentUserSelect`, `DeviceChecklist` như trên. Thêm:

```ts
  const { data: departments } = useAsyncData(() => deviceTransferService.departments(), []);
  const { data: deviceTypes } = useAsyncData(() => deviceService.deviceTypes(), []);
```

Section "Người đang giữ": thay `<Field label="Người giao">…</Field>` bằng:

```tsx
            <DepartmentUserSelect
              label="Người giao"
              departments={departments ?? []}
              users={users ?? []}
              value={draft.fromUserId}
              onChange={(fromUserId) => setDraft((d) => ({ ...d, fromUserId, deviceIds: [], toUserId: null }))}
            />
```

Section "Thiết bị": thay `<div className="space-y-2">…</div>` bằng `DeviceChecklist` (giống Step 3).

Section "Người nhận": thay `<Field label="Người nhận">…</Field>` bằng:

```tsx
            <DepartmentUserSelect
              label="Người nhận"
              departments={departments ?? []}
              users={users ?? []}
              value={draft.toUserId}
              excludeUserId={draft.fromUserId}
              onChange={(toUserId) => setDraft((d) => ({ ...d, toUserId }))}
            />
```

- [ ] **Step 5: Chạy test + type-check**

Run: `npm test -- src/modules/allocation src/modules/transfer` rồi `npm run lint`
Expected: PASS, lint sạch.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/modules/allocation/presentation frontend/src/modules/transfer/presentation
git commit -m "feat(fe): form Tạo đơn / Tạo lệnh chọn người theo phòng ban, lọc danh sách thiết bị"
```

---

### Task 10: Frontend — xuất CSV danh sách tài sản

**Files:**
- Create: `frontend/src/shared/lib/csv.ts`, `csv.test.ts`
- Modify: `frontend/src/modules/audit/domain/auditCsv.ts`, `auditCsv.test.ts`
- Create: `frontend/src/modules/device/domain/devicesCsv.ts`, `devicesCsv.test.ts`
- Modify: `frontend/src/modules/device/presentation/DeviceCatalogPage.tsx`, `DeviceCatalogPage.test.tsx`

**Interfaces:**
- Produces: `toCsv(rows: CsvCell[][]): string` và `type CsvCell = string | number | null | undefined` từ `@/shared/lib/csv`; `devicesCsv(devices: Device[]): string`.

- [ ] **Step 1: Chuyển `toCsv` sang `shared/lib/csv.ts`**

Tạo `frontend/src/shared/lib/csv.ts`:

```ts
export type CsvCell = string | number | null | undefined;

const cell = (v: CsvCell) => {
  let s = v == null ? '' : String(v);
  // Chống CSV injection: ô văn bản bắt đầu bằng = + - @ tab CR bị Excel hiểu là công thức. Số giữ nguyên.
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV mở thẳng bằng Excel: BOM UTF-8 (không có thì Excel đọc sai tiếng Việt) + CRLF. */
export const toCsv = (rows: CsvCell[][]) => '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
```

Trong `auditCsv.ts`: xoá `type Cell`, hàm `cell` và `export const toCsv …` (dòng 3–13); thêm `import { toCsv } from '@/shared/lib/csv';` ở đầu.

Chuyển `describe('toCsv', …)` từ `auditCsv.test.ts` sang file mới `frontend/src/shared/lib/csv.test.ts` (giữ nguyên nội dung test, đổi import thành `import { describe, expect, it } from 'vitest'; import { toCsv } from './csv';`), và bỏ `toCsv` khỏi import trong `auditCsv.test.ts`.

Run: `npm test -- src/shared/lib/csv src/modules/audit/domain/auditCsv`
Expected: PASS (hành vi không đổi).

- [ ] **Step 2: Test `devicesCsv` thất bại**

`frontend/src/modules/device/domain/devicesCsv.test.ts`:

```ts
import { expect, it } from 'vitest';
import type { Device } from './device';
import { devicesCsv } from './devicesCsv';

const device = {
  id: 1,
  deviceCode: 'LT-000001',
  deviceName: 'Dell, Latitude',
  serialNumber: null,
  specDetail: 'i5',
  unit: 'Cái',
  status: 'Đã cấp phát',
  allocatedOn: '2026-09-01T00:00:00.000Z',
  location: 'Tầng 2',
  purchaseDate: '2026-01-15',
  supplier: 'FPT',
  warrantyMonths: 24,
  warrantyCondition: null,
  warrantyExpiresOn: '2028-01-15',
  deviceType: { id: 1, typeName: 'Laptop', prefix: 'LT' },
  currentUser: { id: 5, fullName: 'Nguyễn Văn A', username: 'a' },
  accessories: [],
} as Device;

it('header + 1 dòng, ngày cắt 10 ký tự, null thành ô trống, có dấu phẩy thì bọc nháy', () => {
  const lines = devicesCsv([device]).replace('﻿', '').split('\r\n');
  expect(lines[0]).toBe(
    'Mã thiết bị,Tên thiết bị,Loại thiết bị,Số serial,Cấu hình,Đơn vị tính,Trạng thái,Người sở hữu,Ngày cấp phát,Vị trí,Ngày mua,Nhà cung cấp,Hạn bảo hành',
  );
  expect(lines[1]).toBe(
    'LT-000001,"Dell, Latitude",Laptop,,i5,Cái,Đã cấp phát,Nguyễn Văn A,2026-09-01,Tầng 2,2026-01-15,FPT,2028-01-15',
  );
});

it('máy không có người sở hữu: ô trống', () => {
  const lines = devicesCsv([{ ...device, currentUser: null, allocatedOn: null }]).split('\r\n');
  expect(lines[1]).toContain(',Đã cấp phát,,,Tầng 2,');
});
```

Run: `npm test -- src/modules/device/domain/devicesCsv`
Expected: FAIL — module không tồn tại.

- [ ] **Step 3: Implement `devicesCsv`**

`frontend/src/modules/device/domain/devicesCsv.ts`:

```ts
import { toCsv } from '@/shared/lib/csv';
import type { Device } from './device';

const day = (s: string | null) => s?.slice(0, 10) ?? null;

/** Danh sách tài sản xuất CSV — đúng các dòng đang hiện trên /devices, không kèm linh kiện. */
export function devicesCsv(devices: Device[]): string {
  const header = [
    'Mã thiết bị',
    'Tên thiết bị',
    'Loại thiết bị',
    'Số serial',
    'Cấu hình',
    'Đơn vị tính',
    'Trạng thái',
    'Người sở hữu',
    'Ngày cấp phát',
    'Vị trí',
    'Ngày mua',
    'Nhà cung cấp',
    'Hạn bảo hành',
  ];
  return toCsv([
    header,
    ...devices.map((d) => [
      d.deviceCode,
      d.deviceName,
      d.deviceType.typeName,
      d.serialNumber,
      d.specDetail,
      d.unit,
      d.status,
      d.currentUser?.fullName,
      day(d.allocatedOn),
      d.location,
      day(d.purchaseDate),
      d.supplier,
      day(d.warrantyExpiresOn),
    ]),
  ]);
}
```

Run: `npm test -- src/modules/device/domain/devicesCsv`
Expected: PASS.

- [ ] **Step 4: Test nút xuất thất bại**

Trong `DeviceCatalogPage.test.tsx`, ngay sau các import thêm:

```ts
vi.mock('@/shared/lib/downloadCsv', () => ({ downloadCsv: vi.fn() }));
import { downloadCsv } from '@/shared/lib/downloadCsv';
```

Thêm test:

```ts
it.each(['Trưởng phòng', 'Chuyên viên'])('%s Kỹ thuật: "Xuất dữ liệu" tải CSV các dòng đang hiện', async (roleName) => {
  vi.mocked(downloadCsv).mockClear();
  renderPage(roleName, 'KYTHUAT');
  await waitFor(() => expect(screen.getByText('LT-000001')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Xuất dữ liệu' }));
  expect(downloadCsv).toHaveBeenCalledTimes(1);
  const [filename, content] = vi.mocked(downloadCsv).mock.calls[0];
  expect(filename).toMatch(/^danh-sach-tai-san-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(content).toContain('LT-000001');
});

it('Quản trị viên / Nhân viên: không thấy "Xuất dữ liệu"', async () => {
  renderPage('Quản trị viên');
  await waitFor(() => expect(screen.getByText('LT-000001')).toBeInTheDocument());
  expect(screen.queryByRole('button', { name: 'Xuất dữ liệu' })).toBeNull();
});
```

Run: `npm test -- src/modules/device/presentation/DeviceCatalogPage`
Expected: FAIL — Admin vẫn thấy nút; bấm không gọi `downloadCsv`.

- [ ] **Step 5: Implement nút**

`DeviceCatalogPage.tsx`: import `downloadCsv` từ `@/shared/lib/downloadCsv`, `devicesCsv` từ `../domain/devicesCsv`. Trong component (trước `const columns`):

```ts
  const exportCsv = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    downloadCsv(`danh-sach-tai-san-${stamp}.csv`, devicesCsv(devices ?? []));
  };
```

Thay nút cũ trong `actions` của `PageHeader`:

```tsx
            {canWrite && (
              <Button
                variant="outline"
                size="sm"
                leadingIcon={<Upload className="h-4 w-4" />}
                disabled={(devices?.length ?? 0) === 0}
                onClick={exportCsv}
              >
                Xuất dữ liệu
              </Button>
            )}
```

- [ ] **Step 6: Chạy test**

Run: `npm test -- src/modules/device src/modules/audit src/shared/lib`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/shared/lib/csv.ts frontend/src/shared/lib/csv.test.ts frontend/src/modules/audit/domain frontend/src/modules/device
git commit -m "feat(device-fe): xuất CSV danh sách tài sản (TP + Chuyên viên Kỹ thuật), chuyển toCsv sang shared/lib"
```

---

### Task 11: Frontend — gọn AppShell + UX Login

**Files:**
- Modify: `frontend/src/shared/layout/AppShell.tsx`
- Modify: `frontend/src/modules/auth/presentation/LoginPage.tsx`
- Test: `frontend/src/modules/auth/presentation/LoginPage.test.tsx` (mới)

**Interfaces:**
- Produces: `LineField` (cục bộ trong `LoginPage.tsx`) thành `forwardRef<HTMLInputElement, …>` với prop thêm `onKeyDown?`, `trailing?: ReactNode`.

- [ ] **Step 1: Test Login thất bại**

`LoginPage.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '@/app/session/SessionContext';
import { LoginPage } from './LoginPage';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderPage() {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  render(
    <SessionProvider>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </SessionProvider>,
  );
  return fetchMock;
}

it('Enter ở ô Username: chuyển focus sang Password, không gửi đăng nhập', () => {
  const fetchMock = renderPage();
  const username = screen.getByLabelText('Username');
  fireEvent.change(username, { target: { value: 'admin' } });
  fireEvent.keyDown(username, { key: 'Enter' });
  expect(screen.getByLabelText('Password')).toHaveFocus();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('icon con mắt bật / tắt hiện mật khẩu', () => {
  renderPage();
  const password = screen.getByLabelText('Password');
  expect(password).toHaveAttribute('type', 'password');
  fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
  expect(password).toHaveAttribute('type', 'text');
  fireEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
  expect(password).toHaveAttribute('type', 'password');
});
```

Run: `npm test -- src/modules/auth/presentation/LoginPage`
Expected: FAIL — focus không đổi / không có nút "Hiện mật khẩu".

- [ ] **Step 2: Implement Login**

`LoginPage.tsx`:

Import: đổi `import { useState } from 'react';` thành `import { forwardRef, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';`; đổi `import { User } from 'lucide-react';` thành `import { Eye, EyeOff, User } from 'lucide-react';`.

Thay toàn bộ `LineField` bằng:

```tsx
/** Underline-style field, specific to the login screen. */
const LineField = forwardRef<
  HTMLInputElement,
  {
    label: string;
    type?: string;
    value: string;
    onChange: (v: string) => void;
    onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
    trailing?: ReactNode;
  }
>(function LineField({ label, type = 'text', value, onChange, onKeyDown, trailing }, ref) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className="mt-2 flex items-center border-b border-ink/30 focus-within:border-brand">
        <input
          ref={ref}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          className="w-full border-0 bg-transparent pb-1.5 text-sm outline-none"
        />
        {trailing}
      </span>
    </label>
  );
});
```

Trong `LoginPage`, sau `const [password, setPassword] = useState('');`:

```ts
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
```

Thay 2 dòng `<LineField … />` bằng:

```tsx
        <LineField
          label="Username"
          value={username}
          onChange={setUsername}
          onKeyDown={(e) => {
            // Enter ở ô Username: sang ô Password thay vì gửi form ngay.
            if (e.key === 'Enter') {
              e.preventDefault();
              passwordRef.current?.focus();
            }
          }}
        />
        <LineField
          ref={passwordRef}
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={setPassword}
          trailing={
            <button
              type="button"
              tabIndex={-1}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              onClick={() => setShowPassword((v) => !v)}
              className="pb-1.5 pl-2 text-ink-muted hover:text-ink"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
```

Lưu ý: nút con mắt nằm trong `<label>` nên `getByLabelText('Password')` vẫn trỏ tới `<input>` (label chỉ gán cho control dạng labelable đầu tiên — input đứng trước button). Nếu test báo trỏ nhầm, chuyển `<label>` thành `<div>` và gắn `aria-label={label}` thẳng lên `<input>`.

Run: `npm test -- src/modules/auth/presentation/LoginPage`
Expected: PASS.

- [ ] **Step 3: AppShell**

`AppShell.tsx`: xoá dòng `import { Bell } from 'lucide-react';` và thay khối `<header>…</header>` bằng:

```tsx
        <header className="px-8 pb-4 pt-6">
          <h1 className="font-display text-2xl font-bold text-ink">
            Chào mừng, <span className="text-brand">{name}!</span>
          </h1>
        </header>
```

- [ ] **Step 4: Toàn bộ test + type-check**

Run: `npm test` rồi `npm run lint`
Expected: PASS toàn bộ, lint sạch.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/layout/AppShell.tsx frontend/src/modules/auth/presentation
git commit -m "feat(fe): bỏ chuông + avatar tĩnh ở AppShell; Login: Enter sang ô mật khẩu, nút hiện mật khẩu"
```

---

### Task 12: Tài liệu

**Files:**
- Modify: `docs/CONTEXT.md`, `docs/Changes.md`, `docs/erd.dbml`

- [ ] **Step 1: `docs/erd.dbml`**

Trong `Table DeviceOrder` và `Table DeviceTransfer`, đổi note cột `Status` từ `'Chờ duyệt | Đã duyệt | Từ chối'` thành `'Chờ duyệt | Đã duyệt | Từ chối | Đã xóa'`.

- [ ] **Step 2: `docs/Changes.md`**

Đổi dòng "Cập nhật lần cuối" thành ngày triển khai. Thêm trước `## 7. Còn treo`:

```markdown
## 6f. Xoá đơn/lệnh, chi tiết đơn/lệnh, người nhận có phòng ban (2026-10-11)
Spec `docs/superpowers/specs/2026-10-11-xoa-don-chi-tiet-login-xuat-csv-design.md`.
- **Xoá đơn Cấp phát - Thu hồi / lệnh Điều chuyển (xoá mềm):** chỉ Trưởng phòng Kỹ thuật; chỉ đơn/lệnh
  **Đã duyệt** hoặc **Từ chối** → trạng thái mới **"Đã xóa"** (Chờ duyệt → 400). Không đổi trạng thái thiết bị,
  không khôi phục. Danh sách mặc định ẩn "Đã xóa".
- **Thùng rác:** lọc "Đã xóa" — Quản trị viên, Trưởng phòng, Chuyên viên Kỹ thuật đều xem; chỉ Trưởng phòng
  có **Dọn thùng rác** (xoá cứng, kèm danh sách thiết bị của đơn/lệnh).
- **Chi tiết đơn/lệnh:** xem được người tạo, người duyệt, ngày duyệt, danh sách thiết bị và **lý do từ chối**.
- **Người nhận phải thuộc một phòng ban:** đơn Cấp phát và lệnh Điều chuyển không nhận người không có phòng
  ban (Quản trị viên) → 400 "Người nhận phải thuộc một phòng ban". Thu hồi / người giao không bị kiểm.
- **Xuất danh sách tài sản (CSV):** Trưởng phòng + Chuyên viên Kỹ thuật, theo bộ lọc đang áp.
```

- [ ] **Step 3: `docs/CONTEXT.md`**

Cập nhật đúng các chỗ sau (đọc từng mục rồi sửa văn bản tương ứng):
- Đầu file: thêm đoạn `> Cập nhật 2026-10-11 (spec …2026-10-11-xoa-don-chi-tiet-login-xuat-csv-design.md): …` tóm tắt 6 thay đổi.
- §1 "Quyền phía FE": thêm `canDeleteOrder` / `canDeleteTransfer` (chỉ TP Kỹ thuật).
- §1 bảng `@Allow`: thêm dòng `DELETE /device-orders/:id`, `POST /device-orders/purge`, `DELETE /device-transfers/:id`, `POST /device-transfers/purge` | `TECH_HEAD`.
- §1: trạng thái đơn/lệnh thêm `Đã xóa`; luật người nhận có phòng ban.
- §2 `shared/ui`: thêm `DecisionInfo`, `DepartmentUserSelect`; §2 `shared/lib`: thêm `csv` (`toCsv`); bảng "Component cục bộ": thêm `DeviceChecklist`, `OrderDetailModal`, `TransferDetailModal`; dòng `AppShell` bỏ "chuông + avatar chữ cái".
- §3: `/allocation`, `/transfers` (Chi tiết, Xoá, lọc Đã xóa, Dọn thùng rác), `/allocation/new`, `/transfers/new` (phòng ban → người, bộ lọc thiết bị), `/devices` (Xuất dữ liệu CSV), `/login` (Enter → Password, nút hiện mật khẩu).
- §4.1: xoá 3 dòng chuông, avatar, "Xuất dữ liệu" (giữ "Thêm tài liệu", "Thêm thông tin tùy chỉnh").
- §4.2 dòng "Đơn cấp phát / lệnh điều chuyển": đổi "Không có màn chi tiết" thành "Chi tiết xem qua modal".
- §4.6 dòng Modal: thêm modal Chi tiết đơn/lệnh.
- §5.9: số test mới (lấy từ output `npm test` và `pnpm test`).

- [ ] **Step 4: Kiểm tra cuối**

Run: `npm test`, `npm run lint`, `cd backend && npx -y pnpm@10 test`
Expected: tất cả PASS. Ghi số test vào §5.9 nếu chưa.

- [ ] **Step 5: Commit**

```bash
git add docs/CONTEXT.md docs/Changes.md docs/erd.dbml
git commit -m "docs: cập nhật CONTEXT/Changes/ERD cho xoá đơn/lệnh, chi tiết, phòng ban, xuất CSV, Login"
```
