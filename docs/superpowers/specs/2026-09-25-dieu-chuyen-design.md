# Spec: Điều chuyển thiết bị

> Chốt ngày 2026-09-25 qua brainstorming, trên branch `main` (Cấp phát - Thu hồi đã merge). Dựng
> trên các bảng `Device`/`DeviceType`/`DeviceAccessory` và tái dùng nguyên xi các quy ước của vòng
> Cấp phát - Thu hồi (spec `2026-09-24-cap-phat-thu-hoi-design.md`), chỉ đảo vai tạo/duyệt.

## 1. Context

`/transfers` hiện là `<ComingSoonPage title="Điều chuyển" />`. Không có model, endpoint, hay UI nào.
Vòng Cấp phát - Thu hồi vừa xong dựng ra khái niệm "Đơn" (tạo → chờ duyệt → duyệt/từ chối) cho việc
đưa thiết bị vào/ra khỏi kho; **Điều chuyển khác về bản chất**: chuyển thiết bị đang "Đã cấp phát"
từ người A thẳng sang người B, **không qua "Trong kho"** ở giữa.

`docs/superpowers/specs/2026-09-19-user-management-design.md` đã chốt sẵn (từ vòng user-management,
chưa dùng tới cho đến giờ): *"Trưởng phòng Kỹ thuật: duyệt lệnh điều chuyển"*. Đây là **đảo vai** so
với Cấp phát - Thu hồi: ở đó TP Kỹ thuật tạo, Admin duyệt. Brainstorming xác nhận: **Admin tạo lệnh
điều chuyển, TP Kỹ thuật duyệt**.

## 2. Quyết định đã chốt (không hỏi lại)

| # | Quyết định |
|---|---|
| 1 | Điều chuyển = chuyển thiết bị đang **"Đã cấp phát"** từ người đang giữ (`fromUserId`) sang người nhận mới (`toUserId`), **giữ nguyên status "Đã cấp phát"** suốt — không đi qua "Trong kho". |
| 2 | **Tạo lệnh**: chỉ `Quản trị viên`. **Duyệt/từ chối**: chỉ `Trưởng phòng` + `departmentCode === 'KYTHUAT'`. **Đọc**: cả hai. Đảo ngược hoàn toàn cặp vai trò của Cấp phát - Thu hồi. |
| 3 | 1 lệnh = 1 người giao (`fromUserId`) + 1 người nhận (`toUserId`) + 1 hoặc nhiều thiết bị, **tất cả thiết bị trong 1 lệnh phải đang cùng do `fromUserId` giữ**. Không trộn nhiều người giao trong 1 lệnh. |
| 4 | `fromUserId === toUserId` bị chặn ngay lúc tạo đơn — 400. |
| 5 | Tạo đơn: chọn người đang giữ (`fromUserId`) trước → hệ thống nạp đúng danh sách thiết bị người đó đang giữ → chọn thiết bị → chọn người nhận (`toUserId`). Cùng UX với bước tạo đơn Thu hồi của vòng trước. |
| 6 | Duyệt = thực thi ngay, không có bước xác nhận bàn giao riêng. Từ chối là trạng thái cuối — không sửa/gửi lại. Giống hệt quy ước Cấp phát - Thu hồi. |
| 7 | Không khoá/giữ chỗ thiết bị khi đơn "Chờ duyệt" — validate lại lúc tạo **và** lúc duyệt. Cùng lý do ponytail như vòng trước (quy mô nhỏ). |
| 8 | UI 1 trang danh sách (`/transfers`, lọc trạng thái, Duyệt/Từ chối/In biên bản ngay trên bảng) + 1 trang tạo (`/transfers/new`). Không có trang riêng cho từng bước. |
| 9 | Biên bản PDF khi đã duyệt — cùng cơ chế DejaVu Sans đã nhúng ở vòng trước, **không nhúng lại font** (xem mục 7). |
| 10 | `window.confirm`/`window.prompt` tái dùng cho duyệt/từ chối, không dựng Modal mới. |

**Rút kinh nghiệm từ vòng Cấp phát - Thu hồi (bug đã bị review cuối bắt được, giờ làm đúng ngay từ đầu, không đợi review phát hiện lại):**
- Mọi quan hệ FK **optional** tới `User` phải khai **`onDelete: Restrict` tường minh** trong schema —
  Prisma mặc định field optional là `SetNull`, chỉ field bắt buộc mới mặc định `Restrict`. Áp dụng
  cho `decidedById` (optional) của `DeviceTransfer`.
- Ghi Device lúc duyệt phải dùng **`updateMany` có điều kiện lặp lại đúng where đã kiểm tra**
  (`id`, `status`, `currentUserId === fromUserId`) + kiểm `count`, không phải `update` trần — chặn 2
  lệnh duyệt gần như đồng thời cùng nhắm 1 thiết bị.
- `/devices/purge` và `/users/purge` phải loại trừ id còn bị `DeviceTransferItem`/`DeviceTransfer`
  tham chiếu, **làm ngay trong vòng này**, không để dồn qua review cuối như lần trước.
- Test cho `:id` không phải số (`/device-transfers/abc`) phải có ngay từ đầu, không chỉ test id vượt
  int32.
- Kiểm tra lại người nhận (`toUserId`) chưa bị xoá **tại thời điểm duyệt**, không chỉ lúc tạo.

## 3. Lược đồ dữ liệu

```prisma
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

model DeviceTransferItem {
  id         Int @id @default(autoincrement()) @map("Id")
  transferId Int @map("TransferId")
  deviceId   Int @map("DeviceId")

  transfer DeviceTransfer @relation(fields: [transferId], references: [id], onDelete: Cascade)
  device   Device         @relation(fields: [deviceId], references: [id])

  @@map("DeviceTransferItem")
}
```

`onDelete: Restrict` khai **tường minh trên cả 4 quan hệ tới `User`**, kể cả 3 quan hệ bắt buộc
(`fromUser`/`toUser`/`createdBy`) mà Prisma vốn đã mặc định đúng — khai rõ ràng để không ai phải suy
luận lại default của Prisma lần nữa. `User` cần 4 quan hệ ngược đặt tên riêng
(`DeviceTransferFrom`/`DeviceTransferTo`/`DeviceTransferCreatedBy`/`DeviceTransferDecidedBy`).
`Device` cần thêm `transferItems DeviceTransferItem[]`. Migration thuần cộng thêm, không `ALTER` bảng
cũ nào.

`status` dùng lại đúng 3 giá trị tiếng Việt của `DeviceOrder`: `"Chờ duyệt"` / `"Đã duyệt"` /
`"Từ chối"` (định nghĩa hằng số riêng `TRANSFER_STATUS`, trùng giá trị nhưng không import chéo
module — cùng cách `DEVICE_STATUS`/`ORDER_STATUS` đã tách nhau).

## 4. API contract

| Method | Route | Quyền | Body / Query | `data` trả về |
|---|---|---|---|---|
| GET | `/device-transfers` | Admin hoặc TP Kỹ thuật | `status?` | `DeviceTransferListItem[]`, sắp xếp `id desc` |
| GET | `/device-transfers/:id` | Admin hoặc TP Kỹ thuật | — | `DeviceTransferDetail` |
| POST | `/device-transfers` | chỉ Admin | `CreateDeviceTransferDto` | `DeviceTransferDetail`, message `"Đã tạo lệnh điều chuyển"` |
| PATCH | `/device-transfers/:id/approve` | chỉ TP Kỹ thuật | — | `DeviceTransferDetail`, message `"Đã duyệt lệnh điều chuyển"` |
| PATCH | `/device-transfers/:id/reject` | chỉ TP Kỹ thuật | `RejectDeviceTransferDto` | `DeviceTransferDetail`, message `"Đã từ chối lệnh điều chuyển"` |

```ts
CreateDeviceTransferDto = {
  fromUserId: number,
  toUserId: number,   // khác fromUserId, kiểm ở service
  note?: string,
  deviceIds: number[],  // >= 1, không trùng (ArrayUnique)
}
RejectDeviceTransferDto = { reason: string }  // bắt buộc, non-empty

DeviceTransferListItem = {
  id, status, note, rejectReason, decidedAt, createdAt,
  fromUser: { id, fullName, username },
  toUser:   { id, fullName, username },
  createdBy: { id, fullName },
  decidedBy: { id, fullName } | null,
  deviceCount: number,
}
DeviceTransferDetail = DeviceTransferListItem & {
  items: { id, device: DeviceListItem }[],
}
```

**Thông điệp lỗi:**

| Tình huống | HTTP | message |
|---|---|---|
| `deviceIds` rỗng | 400 | `Vui lòng chọn ít nhất 1 thiết bị` |
| `deviceIds` trùng | 400 | `Danh sách thiết bị bị trùng` |
| `toUserId === fromUserId` | 400 | `Người nhận phải khác người đang giữ` |
| `fromUserId`/`toUserId` không tồn tại/đã xoá | 400 | `Người dùng không tồn tại` |
| thiết bị không "Đã cấp phát" cho đúng `fromUserId` | 400 | `Thiết bị "<deviceCode>" không do người này đang giữ` |
| `reason` rỗng khi từ chối | 400 | `Vui lòng nhập lý do từ chối` |
| duyệt/từ chối đơn đã xử lý | 400 | `Đơn đã được xử lý` |
| id không tồn tại/không phải số/vượt int32 | 404 | `Đơn không tồn tại` |
| không đủ quyền | 403 | `Bạn không có quyền thực hiện thao tác này` |

Không cần thêm filter mới cho `GET /devices` — `status`+`currentUserId` đã có sẵn từ vòng trước, đủ
để nạp "thiết bị người này đang giữ" ở bước chọn `fromUserId`.

## 5. Guard

- **Tạo** (`POST`): `@Roles(ROLE.ADMIN)` — tái dùng thẳng cơ chế `@Roles` sẵn có (Admin-only không có
  điều kiện phòng ban, không cần guard riêng, giống cách `approve`/`reject` của Cấp phát - Thu hồi
  đang dùng).
- **Duyệt/từ chối**: `TransferDecideGuard` (guard mới, ~15 dòng) — cho qua nếu
  `roleName === ROLE.HEAD && departmentCode === 'KYTHUAT'`.
- **Đọc** (`GET *`): `TransferAccessGuard` (guard mới, cùng khuôn `OrderAccessGuard` của vòng trước —
  Admin hoặc HEAD+KYTHUAT) đặt ở class level. Tạo guard riêng thay vì tái dùng `OrderAccessGuard`
  dù điều kiện giống hệt — cùng lý do `OrderAccessGuard` đã tách khỏi `DeviceWriteGuard`: khác domain
  concern, có thể lệch nhau sau này.

## 6. Tương tác với `/users/purge` và `/devices/purge`

`DeviceTransfer.fromUserId`/`toUserId`/`createdById`/`decidedById` đều RESTRICT — **4 cột**, nhiều
hơn `DeviceOrder`. `users.service.ts` `purge()` (đã sửa cho `DeviceOrder` ở vòng trước) cần mở rộng
truy vấn chặn để **cộng thêm** `DeviceTransfer` (`OR` thêm 4 điều kiện `{in: ids}` nữa) vào tập
`blocked`, cùng transaction, cùng cách lặng lẽ bỏ qua.

`devices.service.ts` `purge()` (đã sửa ở review cuối vòng trước cho `DeviceOrderItem`) cần mở rộng
tương tự cho `DeviceTransferItem.deviceId` (cũng RESTRICT).

## 7. Thiết kế Frontend

Module mới `frontend/src/modules/transfer/`, đúng khuôn DDD-lite của `allocation`:
`domain/deviceTransfer.ts` (types + `TRANSFER_STATUS`), `domain/validateTransferDraft.ts`,
`application/DeviceTransferRepository.ts`, `infrastructure/HttpDeviceTransferRepository.ts` +
`container.ts`, `presentation/useDeviceTransfers.ts` + `DeviceTransferListPage.tsx` +
`CreateTransferPage.tsx` + `transferStatusTone.ts`.

`users()` gọi thẳng `/users/lookup` (duplicate 2 dòng, cùng lý do module `allocation` đã làm — module
biên).

**Route**: `RequireTransferAccess` (Admin hoặc TP Kỹ thuật, cùng khuôn `RequireOrderAccess`) bọc
`/transfers` + `/transfers/new`. `navItems.ts` thêm cờ thứ 3 `transferAccessOnly?: boolean` (cạnh
`adminOnly`/`orderAccessOnly` đã có) cho mục "Điều chuyển"; `Sidebar.tsx` filter cộng thêm điều kiện
này.

`session.ts` thêm: `canAccessTransfers` (Admin hoặc TP Kỹ thuật, dùng `isTechHead` đã tách sẵn),
`canCreateTransfer` (chỉ Admin), `canDecideTransfer` (chỉ TP Kỹ thuật).

**Tạo đơn** (`CreateTransferPage.tsx`): B1 chọn người đang giữ (`fromUserId`, dropdown `/users/lookup`)
→ B2 nạp `GET /devices?status=Đã cấp phát&currentUserId=<fromUserId>`, chọn thiết bị (checkbox) → B3
chọn người nhận (`toUserId`, dropdown `/users/lookup`, loại trừ chính `fromUserId` khỏi danh sách
ngay trên UI — chốt chặn thật vẫn ở backend). Đổi `fromUserId` reset cả `deviceIds` lẫn `toUserId`.

## 8. Biên bản PDF — dùng lại font, không nhúng lại

Vòng trước nhúng DejaVu Sans (~1MB base64) trực tiếp trong
`frontend/src/modules/allocation/presentation/print/DejaVuSansBase64.ts`. Nhúng lại y hệt cho module
`transfer` sẽ nhân đôi ~1MB vô ích trong repo. **Dọn trước khi thêm tính năng mới**: di chuyển
`DejaVuSansBase64.ts` sang `frontend/src/shared/print/DejaVuSansBase64.ts` (dùng chung), sửa import
trong `allocation/presentation/print/generateBienBan.ts` theo đường dẫn mới — đây là thay đổi cơ học,
không đổi hành vi, cần chạy lại `generateBienBan.test.ts` của `allocation` để xác nhận không vỡ.

`transfer/presentation/print/generateBienBan.ts` (file mới, module `transfer`): cùng cấu trúc
`buildBienBanContent`/`downloadBienBan` như `allocation`, import font từ `shared/print/`, code-split
qua dynamic `import()` giống hệt cách vòng trước đã áp dụng. Tiêu đề "BIÊN BẢN ĐIỀU CHUYỂN THIẾT BỊ";
nội dung: số lệnh, ngày duyệt, người tạo (Admin), người duyệt (TP Kỹ thuật), **người giao**
(`fromUser`) + **người nhận** (`toUser`), danh sách thiết bị, 2 dòng ký tên.

## 9. Verification

- BE: `device-transfers.spec.ts` theo khuôn `device-orders.spec.ts`. Bắt buộc có ca: tạo lệnh thành
  công · thiếu `deviceIds` 400 · `deviceIds` trùng 400 · `fromUserId === toUserId` 400 · thiết bị
  không do `fromUserId` giữ 400 · `fromUserId`/`toUserId` không tồn tại 400 · duyệt ghi đúng
  `currentUserId`/`departmentId`/`allocatedOn`, **status không đổi** ("Đã cấp phát" suốt) · duyệt lại
  đơn đã xử lý 400 · duyệt khi thiết bị đổi trạng thái sau khi tạo đơn (race tuần tự) 400 · **duyệt
  đồng thời 2 lệnh cùng nhắm 1 thiết bị** (dùng kỹ thuật mock `$transaction` interleaving y hệt vòng
  trước, không đợi review cuối phát hiện) · từ chối thiếu `reason` 400 · từ chối ghi đúng, không đổi
  Device · duyệt khi `toUserId` đã bị xoá mềm sau khi tạo đơn 400 · Admin gọi approve/reject 403 ·
  TP Kỹ thuật gọi POST tạo lệnh 403 · TP Kế toán (không phải KYTHUAT) gọi approve 403 · Nhân viên gọi
  GET danh sách 403 · id không phải số (`/device-transfers/abc`) 404 · id vượt int32 404.
- BE: `users.spec.ts` thêm ca `purge()` bỏ qua user còn bị `DeviceTransfer` tham chiếu (4 cột).
- BE: `devices.spec.ts` thêm ca `purge()` bỏ qua thiết bị còn bị `DeviceTransferItem` tham chiếu.
- BE: `backend/scripts/e2e-device-transfers.ps1` theo khuôn `e2e-device-orders.ps1` — tạo lệnh, duyệt,
  xác nhận Device đổi đúng chủ mà **status không đổi**; tạo lệnh, từ chối, xác nhận Device không đổi;
  Nhân viên gọi GET → 403.
- FE: vitest cho `validateTransferDraft`, `HttpDeviceTransferRepository`, `buildBienBanContent` (module
  `transfer`), `session.ts` (3 hàm mới), `DeviceTransferListPage` (hiện/ẩn nút theo role). Cộng thêm:
  `allocation`'s `generateBienBan.test.ts` vẫn xanh sau khi di chuyển font sang `shared/print/`.
- Người dùng tự đi tay trên UI thật: tạo lệnh điều chuyển, duyệt, xác nhận thiết bị đổi đúng chủ, thử
  từ chối, in thử biên bản.

## 10. Cố ý KHÔNG làm trong vòng này

Điều chuyển hàng loạt nhiều người giao trong 1 lệnh (mục 2.3 — luôn 1 người giao) · sửa/gửi lại đơn
bị từ chối (mục 2.6) · khoá/giữ chỗ thiết bị khi đơn đang chờ duyệt (mục 2.7) · trang xem lịch sử
điều chuyển của riêng 1 thiết bị · phân trang danh sách lệnh · ràng buộc phòng ban (điều chuyển chéo
phòng ban vẫn được phép, TP Kỹ thuật duyệt mang tính giám sát kỹ thuật toàn công ty, không phải chỉ
phòng mình).
