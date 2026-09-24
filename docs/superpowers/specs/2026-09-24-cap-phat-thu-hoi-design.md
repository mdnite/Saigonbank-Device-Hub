# Spec: Cấp phát - Thu hồi thiết bị

> Chốt ngày 2026-09-24 qua brainstorming, trên branch `feat/device-management`. Dựng trên các bảng
> `Device`/`DeviceType`/`DeviceAccessory` đã có (spec `2026-09-22-device-management-design.md`).

## 1. Context

`AllocateRecoverPage` cũ đã bị xoá 2026-09-22 vì nó chỉ là bản rút gọn của form thêm thiết bị, không
có luồng thật. `/allocation` hiện là `<ComingSoonPage>`. Cấp phát bây giờ chỉ làm được gián tiếp qua
`PATCH /devices/:id` (tick "Đã cấp phát" trên form sửa thiết bị) — không có màn hình, không có lịch
sử, và **không có cách thu hồi**: `toBody()` bỏ qua field rỗng, Prisma bỏ qua `undefined`, nên
un-tick ô "Đã cấp phát" không xoá được `currentUserId` (bug đã biết, đang deferred).

`docs/CONTEXT.md` §5 điểm 4 ghi nghiệp vụ thật cần có: *"chọn thiết bị trong kho → gán nhân
viên/phòng ban → sinh biên bản → thu hồi về kho"*, và Figma cũ có 12 frame riêng cho subsystem này
(danh sách đơn, tạo đơn, Approvals Center) — tách hẳn khỏi phần quản lý thiết bị. Vòng này dựng
đúng luồng đó bằng một khái niệm **"Đơn"** (tạo → duyệt/từ chối), không đụng lại `PATCH
/devices/:id` — né hẳn con bug PATCH nói trên vì đơn được thực thi bằng service method riêng, ghi
thẳng `null` khi cần.

## 2. Quyết định đã chốt (không hỏi lại)

| # | Quyết định |
|---|---|
| 1 | Có 2 loại đơn: **Cấp phát** và **Thu hồi**, cùng vòng đời tạo → chờ duyệt → duyệt/từ chối. |
| 2 | **Tạo đơn**: chỉ `Trưởng phòng` phòng `KYTHUAT` (không gồm Admin). **Duyệt/từ chối**: chỉ `Quản trị viên` (không gồm Trưởng phòng Kỹ thuật). Hai vai trò tách biệt hẳn, không dùng chung guard. |
| 3 | Duyệt = thực thi ngay (không có bước "xác nhận bàn giao" riêng). Từ chối là trạng thái cuối — không sửa/gửi lại, phải tạo đơn mới. |
| 4 | Đơn Cấp phát: chọn 1 người nhận (`targetUserId`, từ `GET /users/lookup`) + 1 hoặc nhiều thiết bị đang **"Trong kho"**. Duyệt xong: `Device.status="Đã cấp phát"`, `currentUserId=targetUserId`, `departmentId=targetUser.departmentId`, `allocatedOn=now()`. |
| 5 | Đơn Thu hồi: chọn 1 người đang giữ (`targetUserId`) + 1 hoặc nhiều thiết bị đang **"Đã cấp phát"** và thuộc đúng người đó. Duyệt xong: `Device.status="Trong kho"`, `currentUserId=null`, `departmentId=null`, `allocatedOn=null`. |
| 6 | Thiết bị hợp lệ chỉ kiểm tra tại **lúc tạo đơn** và lại kiểm tra lần nữa **lúc duyệt** — không khoá/giữ chỗ thiết bị trong lúc đơn "Chờ duyệt". Ponytail: quy mô nhỏ, 1 Trưởng phòng Kỹ thuật; nâng cấp lên cơ chế giữ chỗ nếu sau này nhiều người tạo đơn cùng lúc. |
| 7 | **Ai xem được danh sách đơn** (`GET /device-orders`): chỉ `Quản trị viên` + `Trưởng phòng` phòng `KYTHUAT` — khác `GET /devices` (mở cho mọi role). Đây là luồng vận hành nội bộ giữa 2 vai trò đó. |
| 8 | UI 1 trang: `/allocation` là danh sách đơn chung (lọc loại/trạng thái) + nút Duyệt/Từ chối ngay trên bảng. Tạo đơn là trang riêng `/allocation/new` (không dựng Modal mới — repo chưa có component Modal). |
| 9 | Từ chối đơn nhập lý do qua `window.prompt` (nhất quán với `window.confirm` đang dùng khắp repo thay vì Modal thật). Duyệt đơn xác nhận qua `window.confirm`. |
| 10 | Biên bản xuất **file PDF thật** bằng `jspdf` (không thêm `jspdf-autotable`) — sinh hoàn toàn ở FE từ dữ liệu đã nạp, không cần endpoint mới. Chỉ bật khi đơn đã "Đã duyệt". Không letterhead/logo, không nhiều trang — đủ để in ký tay. |
| 11 | `DeviceOrder`/`DeviceOrderItem` là 2 bảng mới, migration thuần cộng thêm (không `ALTER` bảng cũ nào). FK tới `User` là **RESTRICT** như `PasswordResetToken.userId` — xem mục 6 về tương tác với `/users/purge`. |

## 3. Lược đồ dữ liệu

```prisma
model DeviceOrder {
  id           Int       @id @default(autoincrement()) @map("Id")
  type         String    @map("Type") @db.VarChar(20)          // "Cấp phát" | "Thu hồi"
  status       String    @default("Chờ duyệt") @map("Status") @db.VarChar(20) // "Chờ duyệt" | "Đã duyệt" | "Từ chối"
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

model DeviceOrderItem {
  id       Int @id @default(autoincrement()) @map("Id")
  orderId  Int @map("OrderId")
  deviceId Int @map("DeviceId")

  order  DeviceOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  device Device      @relation(fields: [deviceId], references: [id])

  @@map("DeviceOrderItem")
}
```

`User` cần 3 quan hệ ngược đặt tên riêng (`DeviceOrderTarget`/`DeviceOrderCreatedBy`/
`DeviceOrderDecidedBy`) vì 3 FK khác nhau cùng trỏ `User`. `Device` cần thêm quan hệ ngược
`orderItems DeviceOrderItem[]`. `DeviceOrderItem.orderId` cascade khi xoá `DeviceOrder` (xoá dòng
chi tiết, không phải Device) — cùng logic với `DeviceAccessory` hiện có. `DeviceOrder` **không bao
giờ bị xoá** (không có route DELETE) nên cascade này thực ra không kích hoạt trong luồng bình
thường, chỉ là an toàn cho dữ liệu.

`type`/`status` lưu tiếng Việt nguyên văn trong DB, đúng quy ước đang áp cho `Device.status` và
`User.Status`.

## 4. API contract

Mọi response bọc envelope `{ success, data, error, message }` sẵn có.

| Method | Route | Quyền | Body / Query | `data` trả về |
|---|---|---|---|---|
| GET | `/device-orders` | Admin hoặc TP Kỹ thuật | `type?`, `status?` | `DeviceOrderListItem[]`, sắp xếp `id desc` |
| GET | `/device-orders/:id` | Admin hoặc TP Kỹ thuật | — | `DeviceOrderDetail` |
| POST | `/device-orders` | chỉ TP Kỹ thuật | `CreateDeviceOrderDto` | `DeviceOrderDetail`, message `"Đã tạo đơn"` |
| PATCH | `/device-orders/:id/approve` | chỉ Admin | — | `DeviceOrderDetail`, message `"Đã duyệt đơn"` |
| PATCH | `/device-orders/:id/reject` | chỉ Admin | `RejectDeviceOrderDto` | `DeviceOrderDetail`, message `"Đã từ chối đơn"` |

Thêm 1 query filter cho endpoint đã có: `GET /devices?...&currentUserId=` (hiện chỉ có
`search`/`status`/`deviceTypeId`/`departmentId`) — dùng để nạp "thiết bị người này đang giữ" ở bước
chọn thiết bị cho đơn Thu hồi.

```ts
CreateDeviceOrderDto = {
  type: "Cấp phát" | "Thu hồi",
  targetUserId: number,
  note?: string,
  deviceIds: number[],  // >= 1
}
RejectDeviceOrderDto = {
  reason: string,  // bắt buộc, non-empty
}

DeviceOrderListItem = {
  id, type, status, note, rejectReason, decidedAt, createdAt,
  targetUser: { id, fullName, username },
  createdBy:  { id, fullName },
  decidedBy:  { id, fullName } | null,
  deviceCount: number,
}
DeviceOrderDetail = DeviceOrderListItem & {
  items: { id, device: DeviceListItem }[],   // DeviceListItem = shape đã có ở devices module
}
```

**Thông điệp lỗi cố định** (tiếng Việt, khớp cách `devices`/`users` đang báo):

| Tình huống | HTTP | message |
|---|---|---|
| `deviceIds` rỗng | 400 | `Vui lòng chọn ít nhất 1 thiết bị` |
| `targetUserId` không tồn tại / đã xoá | 400 | `Người dùng không tồn tại` |
| Cấp phát: thiết bị không ở trạng thái "Trong kho" | 400 | `Thiết bị "<deviceCode>" không còn trong kho` |
| Thu hồi: thiết bị không "Đã cấp phát" cho đúng người này | 400 | `Thiết bị "<deviceCode>" không do người này đang giữ` |
| `reason` rỗng khi từ chối | 400 | `Vui lòng nhập lý do từ chối` |
| Duyệt/từ chối đơn đã xử lý rồi | 400 | `Đơn đã được xử lý` |
| id đơn không tồn tại / không phải số / vượt int32 | 404 | `Đơn không tồn tại` |
| không đủ quyền | 403 | `Bạn không có quyền thực hiện thao tác này` |

## 5. Guard mới

Hai guard riêng biệt, cùng khuôn `DeviceWriteGuard` (đọc role+department từ `req.user`, ném
`ForbiddenException` nếu không khớp):

- `OrderCreateGuard`: cho qua nếu `roleName === ROLE.HEAD && departmentCode === 'KYTHUAT'`. **Không**
  cho Admin — khác hẳn `DeviceWriteGuard` vốn cho cả hai.
- `OrderDecideGuard`: cho qua nếu `roleName === ROLE.ADMIN`. Đặt trên cả `approve` và `reject`.
- `GET /device-orders*` không cần guard riêng biệt "ghi" nhưng vẫn cần chặn role khác Admin/TP Kỹ
  thuật — thêm 1 guard đọc `OrderReadGuard` (cho qua nếu Admin hoặc HEAD+KYTHUAT) đặt ở controller
  level, tương tự cách `DevicesController` đặt `AuthGuard` ở class rồi guard ghi ở từng route — chỗ
  này ngược lại: guard đọc ở class, không cần guard riêng cho `POST`/`PATCH` vì `OrderCreateGuard`/
  `OrderDecideGuard` đã chặt hơn `OrderReadGuard` rồi (tập con).

## 6. Tương tác với `/users/purge` (điểm rủi ro)

`DeviceOrder.targetUserId`/`createdById`/`decidedById` đều FK **RESTRICT** tới `User` — giữ nguyên
lịch sử đơn, không cho mất dấu ai tạo/duyệt/nhận. Khác với `PasswordResetToken.userId` (cũng
RESTRICT nhưng `purge()` chủ động xoá các dòng đó trước khi xoá user), `DeviceOrder` **không bị xoá
theo** — đơn là hồ sơ lịch sử, xoá nó cùng lúc xoá user gốc là sai.

`users.service.ts` `purge()` cần sửa: trước khi xoá, loại khỏi danh sách xoá bất kỳ id nào còn xuất
hiện trong `DeviceOrder` (ở cả 3 cột). Vẫn wrap trong `$transaction` như hiện tại (xoá
`PasswordResetToken` trước), chỉ thêm 1 bước lọc. Trả về `count` là số **thực sự** xoá được — không
báo lỗi cho những id bị chặn, chỉ đơn giản là không đếm chúng (đối xứng với cách purge hiện tại lặng
lẽ bỏ qua id không đủ điều kiện `status="Đã xóa"`).

## 7. Thiết kế Frontend

Module mới `frontend/src/modules/allocation/`, đúng khuôn DDD-lite của `device`:

- `domain/deviceOrder.ts` — types `DeviceOrder`, `OrderType`, `OrderStatus`.
- `domain/validateOrderDraft.ts` — hàm thuần: đã chọn `type`, đã chọn `targetUserId`, `deviceIds.length >= 1`.
- `application/DeviceOrderRepository.ts` (interface) + `infrastructure/HttpDeviceOrderRepository.ts`.
- `infrastructure/container.ts` — wiring, giống `device/infrastructure/container.ts`.
- `presentation/useDeviceOrders.ts` — hook nạp danh sách (giống `useDevices.ts`).
- `presentation/DeviceOrderListPage.tsx` — route `/allocation`. Bảng: Loại · Người liên quan · Số
  thiết bị · Trạng thái · Ngày tạo · Người tạo. Lọc theo `type`/`status`. Nút **Tạo đơn** (chỉ hiện
  nếu `canCreateOrder`). Trên dòng "Chờ duyệt": nút **Duyệt**/**Từ chối** (chỉ hiện nếu
  `canDecideOrder`). Trên dòng "Đã duyệt": nút **In biên bản**.
- `presentation/CreateOrderPage.tsx` — route `/allocation/new`. B1 chọn loại (radio Cấp phát/Thu
  hồi) → B2 chọn người (`GET /users/lookup`) → B3 chọn thiết bị: Cấp phát nạp
  `GET /devices?status=Trong kho`, Thu hồi nạp `GET /devices?status=Đã cấp phát&currentUserId=<id>`
  (filter mới ở mục 4). Checkbox multi-select.
- `presentation/print/generateBienBan.ts` — hàm thuần `buildBienBanContent(order)` dựng nội dung
  (tách riêng để test được) + hàm gọi `jsPDF` render và `doc.save()`.

**Route guard**: `RequireOrderAccess` (Admin hoặc TP Kỹ thuật) — cùng khuôn `RequireAdmin`, bọc
`/allocation` và `/allocation/new`; role khác → `<Navigate to="/dashboard"/>`.

**`session.ts` thêm 3 hàm thuần** (không tái dùng `canWriteDevices` vì tập role khác nhau):
```ts
canAccessOrders = (session) => isAdmin(session) || isTechHead(session);
canCreateOrder  = (session) => isTechHead(session);   // KHÔNG gồm Admin
canDecideOrder  = (session) => isAdmin(session);       // KHÔNG gồm TP Kỹ thuật
```
(`isTechHead` = `roleName === HEAD_ROLE && departmentCode === TECH_DEPARTMENT_CODE`, tách ra từ biểu
thức đang lặp trong `canWriteDevices`.)

**Từ chối**: `window.prompt('Lý do từ chối')` → gọi `reject(id, reason)`; huỷ nếu prompt trả `null`
hoặc chuỗi rỗng. **Duyệt**: `window.confirm('Duyệt đơn này?')` trước khi gọi `approve(id)`.

## 8. Biên bản PDF

- Thư viện: `jspdf` (thêm dependency FE mới, đầu tiên trong repo dùng để xuất file). Không thêm
  `jspdf-autotable`.
- Sinh hoàn toàn ở FE từ `DeviceOrderDetail` đã nạp — không cần endpoint riêng.
- Nội dung: tiêu đề theo loại ("BIÊN BẢN CẤP PHÁT THIẾT BỊ" / "BIÊN BẢN THU HỒI THIẾT BỊ") + số đơn +
  ngày duyệt; người lập (createdBy) / người duyệt (decidedBy) / người nhận-người giữ (targetUser) +
  phòng ban; bảng thiết bị (mã, tên, cấu hình) vẽ bằng `doc.text()` theo toạ độ, không dùng plugin
  bảng; 2 dòng chữ ký để trống cuối trang.
- Tên file: `bien-ban-{cap-phat|thu-hoi}-{orderId}.pdf`.
- Chỉ bật nút khi `status === "Đã duyệt"`.

## 9. Verification

- BE: `device-orders.spec.ts` theo khuôn `devices.spec.ts`, dùng lại/mở rộng `fake-prisma.ts` (thêm
  stub `deviceOrder`/`deviceOrderItem`). Bắt buộc có ca: tạo đơn Cấp phát thành công · tạo đơn Thu
  hồi thành công · tạo đơn thiếu `deviceIds` 400 · thiết bị không "Trong kho" khi tạo đơn Cấp phát
  400 · thiết bị không thuộc đúng người khi tạo đơn Thu hồi 400 · `targetUserId` không tồn tại 400 ·
  duyệt đơn Cấp phát ghi đúng `status/currentUserId/departmentId/allocatedOn` trên Device · duyệt
  đơn Thu hồi xoá đúng cả 3 field (`currentUserId`/`departmentId`/`allocatedOn` về `null`) · duyệt
  lại đơn đã xử lý → 400 · từ chối thiếu `reason` → 400 · từ chối ghi đúng `rejectReason` + không
  đổi Device · Admin gọi POST tạo đơn → 403 · TP Kỹ thuật gọi approve/reject → 403 · TP phòng
  `KETOAN` gọi POST → 403 · Nhân viên gọi GET danh sách → 403.
- BE: `users.spec.ts` thêm ca `purge()` bỏ qua user còn bị tham chiếu trong `DeviceOrder`.
- BE: `backend/scripts/e2e-device-orders.ps1` theo đúng khuôn `e2e-devices.ps1` (mã có timestamp,
  UTF-8 BOM, SQL qua stdin) — chạy thật trên PG: tạo đơn Cấp phát → duyệt → Device đổi đúng; tạo đơn
  Thu hồi → duyệt → 3 field về `null`; tạo đơn → từ chối → Device không đổi.
- FE: vitest cho `validateOrderDraft`, `HttpDeviceOrderRepository`, `buildBienBanContent` (hàm dựng
  nội dung, không test output nhị phân của `jsPDF`), `session.ts` (3 hàm mới), và
  `DeviceOrderListPage` (hiện/ẩn nút theo role — trang "order" đầu tiên có test cấp trang).
- Người dùng tự đi tay trên UI thật (không agent nào có trình duyệt): tạo đơn Cấp phát, duyệt, tạo
  đơn Thu hồi, duyệt, thử từ chối, in thử biên bản PDF xem đọc được không.

## 10. Cố ý KHÔNG làm trong vòng này

Approvals Center là trang riêng (gộp vào `/allocation` — mục 2.8) · thông báo (Notification) khi đơn
được duyệt/từ chối — bảng `Notification` chưa tồn tại, ngoài phạm vi · khoá/giữ chỗ thiết bị khi đơn
đang chờ duyệt (mục 2.6) · sửa và gửi lại đơn bị từ chối (mục 2.3) · đơn thu hồi tự do nhiều người
(mục 2.5 — luôn gắn 1 người) · letterhead/logo/nhiều trang cho biên bản PDF · phân trang danh sách
đơn · sửa lại con bug "PATCH không xoá được field optional" trên `/devices/:id` (đơn không đụng tới
route đó nên không cần sửa cùng lúc, vẫn để deferred như cũ).
