# Spec: Quản lý thiết bị (nền móng cho Kiểm kê)

> Chốt ngày 2026-09-22 qua brainstorming. Đây là **vòng A**. Vòng B (Kiểm kê) sẽ có spec riêng,
> dựng trên đúng các bảng mô tả ở đây.

## 1. Context

Người dùng muốn làm chức năng **Kiểm kê**. Kiểm kê là đối chiếu thiết bị thực tế với sổ sách, mà
database hiện chỉ có 4 bảng `Role` / `Department` / `User` / `PasswordResetToken` — **không có bảng
`Device` nào**. 8 máy Dell ở `/devices` là mock in-memory trong frontend, mất khi F5. Vì vậy phạm vi
được tách đôi: vòng A dựng thiết bị (spec này), vòng B dựng kiểm kê.

Hai thứ đã đọc để viết spec này:

- **Figma** `OuDy5KuU8mWCWiFvdrU0jZ` (đã đọc sống qua MCP, không phải ảnh export cũ). File đã phình
  từ 16 lên **38 group**. Liên quan vòng A: `154:649` Danh mục thiết bị · `255:1189` Thêm thiết bị ·
  `262:1366` Bảo hành/Đính kèm/Thông tin khác. Frame Kiểm kê dành cho vòng B: `337:2672`, `337:2751`,
  `337:2805`, `338:2878`, `338:3004`, `361:3191`, `363:3324`, `364:3465`, `366:3616`.
- **Lệch đã phát hiện trong code hiện tại**: `AssetDraft` thu **18 trường**, nhưng `Device` (model của
  bảng danh sách) chỉ giữ **5**. `InMemoryDeviceRepository.create()` map `specDetail`→`cpu`, bỏ hẳn
  linh kiện, bảo hành, ngày mua, nhà cung cấp, vị trí, đơn vị quản lý. Vòng A chấm dứt tình trạng này.
- **Ba cột Figma đòi mà code chưa có**: `Số serial`, `Loại thiết bị`, `Đơn vị tính`. Cả ba xuất hiện ở
  tab "Thiết bị kiểm kê" (`338:3004`) — tức là kiểm kê chính là thứ cần đúng chúng.

## 2. Quyết định đã chốt (không hỏi lại)

| # | Quyết định |
|---|---|
| 1 | Vòng A = thiết bị, vòng B = kiểm kê. Mỗi vòng một spec, một plan. |
| 2 | **3 bảng mới**: `DeviceType`, `Device`, `DeviceAccessory`. Không tách `DevicePurchase`. |
| 3 | `Device.currentUserId` → `User`, `Device.departmentId` → `Department`. Hết chuỗi tự do `"Nguyễn Văn A - IT"`. |
| 4 | "Người sở hữu" (form) và "Người quản lý" (bảng kiểm kê) là **cùng một người** — một cột `currentUserId`, một nhãn duy nhất trên mọi màn: **"Người sở hữu"**. |
| 5 | **Ghi** (tạo/sửa/xoá) = `Quản trị viên` **hoặc** `Trưởng phòng` thuộc phòng `KYTHUAT`. **Đọc** = mọi vai trò đã đăng nhập. |
| 6 | `deviceCode` do **người gõ toàn bộ**, định dạng `PREFIX-NNNNNN` (6 chữ số), unique, trùng → 409. |
| 7 | Mỗi `DeviceType` có một `prefix`. BE bắt buộc `deviceCode` mở đầu đúng bằng prefix của loại đã chọn. |
| 8 | Vòng A **có** màn sửa (`PATCH /devices/:id`, route `/devices/:id/edit`), dùng lại `AssetFormPage`. |
| 9 | Thiết bị **xoá mềm** — `Status = "Đã xóa"`, không bao giờ xoá row (đúng quy tắc đang áp cho `User`). |
| 10 | `Status` lưu **tiếng Việt** trong DB, giống `User.Status`. FE bỏ mã `IN_STOCK`/`ALLOCATED`/`PENDING_DISPOSAL`. |
| 11 | Khối "Đã cấp phát" trên form **thu gọn**: checkbox + ngày + dropdown người + dropdown phòng. **Bỏ** ô `Số biên bản`, `Đối tượng sử dụng`, `Vị trí công việc` — chúng thuộc subsystem Cấp phát, chưa làm. Đây là **cố ý lệch Figma**. |
| 12 | `specDetail` ("Cấu hình chi tiết") là **ô text tự do**, dù Figma vẽ dropdown. Không lập bảng danh mục cấu hình. |
| 13 | "Đơn vị tính" là **cột text**, không lập bảng danh mục. |

## 3. Lược đồ dữ liệu (cố định)

Quy ước: field Prisma camelCase + `@map` sang cột PascalCase, `@@map` tên bảng — giống 4 bảng đang có.

```prisma
model DeviceType {
  id       Int    @id @default(autoincrement()) @map("Id")
  typeName String @map("TypeName") @db.VarChar(100)
  prefix   String @unique @map("Prefix") @db.VarChar(4)
  devices  Device[]
  @@map("DeviceType")
}

model Device {
  id            Int       @id @default(autoincrement()) @map("Id")
  deviceCode    String    @unique @map("DeviceCode") @db.VarChar(20)
  deviceName    String    @map("DeviceName") @db.VarChar(150)
  serialNumber  String?   @unique @map("SerialNumber") @db.VarChar(100)
  specDetail    String    @map("SpecDetail") @db.VarChar(255)
  unit          String    @map("Unit") @db.VarChar(20)
  location      String?   @map("Location") @db.VarChar(150)
  purchaseDate  DateTime? @map("PurchaseDate") @db.Date
  supplier      String?   @map("Supplier") @db.VarChar(150)
  warrantyMonths    Int?      @map("WarrantyMonths")
  warrantyCondition String?   @map("WarrantyCondition") @db.VarChar(255)
  warrantyExpiresOn DateTime? @map("WarrantyExpiresOn") @db.Date
  status        String    @map("Status") @db.VarChar(50)
  allocatedOn   DateTime? @map("AllocatedOn") @db.Date
  deviceTypeId  Int       @map("DeviceTypeId")
  departmentId  Int?      @map("DepartmentId")
  currentUserId Int?      @map("CurrentUserId")
  deviceType    DeviceType  @relation(fields: [deviceTypeId], references: [id])
  department    Department? @relation(fields: [departmentId], references: [id])
  currentUser   User?       @relation(fields: [currentUserId], references: [id])
  accessories   DeviceAccessory[]
  @@map("Device")
}

model DeviceAccessory {
  id            Int    @id @default(autoincrement()) @map("Id")
  deviceId      Int    @map("DeviceId")
  accessoryCode String @map("AccessoryCode") @db.VarChar(50)
  accessoryName String @map("AccessoryName") @db.VarChar(150)
  accessoryType String @map("AccessoryType") @db.VarChar(100)
  unit          String @map("Unit") @db.VarChar(20)
  device        Device @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  @@map("DeviceAccessory")
}
```

`Department` và `User` phải thêm quan hệ ngược (`devices Device[]`).

**DEVICE_STATUS** — 4 giá trị, dùng nguyên văn trong DB và trong response:
`"Trong kho"` · `"Đã cấp phát"` · `"Chờ thanh lý"` · `"Đã xóa"`.

- `POST` **không nhận** `status`. BE tự đặt: `"Đã cấp phát"` nếu request có `currentUserId`,
  ngược lại `"Trong kho"`.
- `PATCH` nhận `status` nhưng **chỉ 3 giá trị** `"Trong kho"` / `"Đã cấp phát"` / `"Chờ thanh lý"`;
  gửi `"Đã xóa"` → 400 `Trạng thái không hợp lệ`. Đây là cách một máy chuyển sang chờ thanh lý.
- `"Đã xóa"` **chỉ** do `DELETE /devices/:id` đặt.

`serialNumber` unique nhưng nullable: PostgreSQL cho phép nhiều dòng `NULL` trong cột unique, nên
nhiều thiết bị chưa ghi serial vẫn lưu được; đã ghi thì không được trùng.

**Seed** thêm: `DeviceType` gồm `Laptop`/`LT`, `Máy tính để bàn`/`PC`, `Màn hình`/`MN`, `Máy in`/`MI`.

## 4. API contract (cố định — BE và FE làm theo đúng bảng này)

Mọi response bọc trong envelope `{ success, data, error, message }` sẵn có.

| Method | Route | Quyền | Body / Query | `data` trả về |
|---|---|---|---|---|
| GET | `/devices` | đã đăng nhập | `search?`, `status?`, `deviceTypeId?`, `departmentId?` | `DeviceListItem[]`, sắp xếp `id asc`, mặc định loại bỏ `"Đã xóa"` |
| GET | `/devices/:id` | đã đăng nhập | — | `DeviceDetail` (kèm `accessories[]`) |
| POST | `/devices` | ghi | `CreateDeviceDto` | `DeviceDetail`, message `"Đã tạo thiết bị"` |
| PATCH | `/devices/:id` | ghi | `UpdateDeviceDto` (mọi trường optional) | `DeviceDetail`, message `"Đã cập nhật thiết bị"` |
| DELETE | `/devices/:id` | ghi | — | `null`, message `"Đã xoá thiết bị"` |
| GET | `/device-types` | đã đăng nhập | — | `{ id, typeName, prefix }[]` |

```ts
DeviceListItem = {
  id, deviceCode, deviceName, serialNumber, specDetail, unit, status, allocatedOn,
  deviceType:  { id, typeName, prefix },
  department:  { id, departmentCode, departmentName } | null,
  currentUser: { id, fullName, username } | null,
}
DeviceDetail = DeviceListItem & {
  location, purchaseDate, supplier, warrantyMonths, warrantyCondition, warrantyExpiresOn,
  accessories: { id, accessoryCode, accessoryName, accessoryType, unit }[],
}
CreateDeviceDto = {
  deviceCode, deviceName, specDetail, unit, deviceTypeId,       // bắt buộc
  serialNumber?, location?, purchaseDate?, supplier?,
  warrantyMonths?, warrantyCondition?, warrantyExpiresOn?,
  departmentId?, currentUserId?, allocatedOn?,
  accessories?: { accessoryCode, accessoryName, accessoryType, unit }[],
}
// UpdateDeviceDto = mọi trường của CreateDeviceDto ở dạng optional, cộng thêm
// status? giới hạn 3 giá trị (xem mục DEVICE_STATUS). deviceCode vẫn sửa được,
// vẫn phải qua kiểm định dạng + prefix + unique như khi tạo.
```

**Thông điệp lỗi cố định** (tiếng Việt, khớp cách `users` đang báo):

| Tình huống | HTTP | message |
|---|---|---|
| `deviceCode` trùng | 409 | `Mã thiết bị đã tồn tại` |
| `serialNumber` trùng | 409 | `Số serial đã tồn tại` |
| `deviceCode` sai định dạng | 400 | `Mã thiết bị phải có dạng PC-000123` |
| prefix không khớp loại đã chọn | 400 | `Mã thiết bị phải bắt đầu bằng "<prefix>" theo loại thiết bị đã chọn` |
| `deviceTypeId` / `departmentId` / `currentUserId` không tồn tại | 400 | `Loại thiết bị không tồn tại` / `Phòng ban không tồn tại` / `Người dùng không tồn tại` |
| id không tồn tại, không phải số, vượt int32, hoặc đã xoá | 404 | `Thiết bị không tồn tại` |
| không đủ quyền ghi | 403 | `Bạn không có quyền thực hiện thao tác này` |

`PATCH` gửi `accessories` thì **thay thế toàn bộ** danh sách linh kiện của thiết bị (xoá cũ, tạo mới)
— đơn giản hơn diff từng dòng, và bảng linh kiện trên form vốn là nhập lại cả bảng.

## 5. Thay đổi ở `AuthGuard` (phần rủi ro nhất của vòng này)

`@Roles` hiện chỉ so `roleName`, không diễn đạt được "Trưởng phòng **Kỹ thuật**". Cần:

1. `AuthGuard` đổi `include: { role: true }` → `include: { role: true, department: true }` và gắn thêm
   `departmentCode: user.department?.departmentCode ?? null` vào `req.user` (`AuthUser`).
2. Thêm `DeviceWriteGuard` (~15 dòng): cho qua nếu `roleName === ROLE.ADMIN`, hoặc
   `roleName === ROLE.HEAD && departmentCode === 'KYTHUAT'`; ngược lại ném
   `ForbiddenException('Bạn không có quyền thực hiện thao tác này')`. Đặt trên 3 route ghi.
3. `POST /auth/login` trả thêm `departmentCode` trong `data.user` (hiện mới có `departmentId`), để
   FE ẩn/hiện nút ghi mà không phải gọi thêm API. Đây là **thay đổi duy nhất** ở module `identity`;
   các trường cũ giữ nguyên, chỉ thêm một trường.

`AuthGuard` là file bảo mật nhất repo và là thứ bảo đảm "khoá tài khoản có hiệu lực ngay". Thay đổi
nhỏ nhưng **bắt buộc**: 23 ca test hiện có của `auth.spec.ts` phải vẫn xanh, và thêm test khẳng định
`departmentCode` xuất hiện đúng trong `req.user` (cả trường hợp user không có phòng ban → `null`).
Không đổi bất kỳ hành vi nào khác của guard.

## 6. Thiết kế Frontend

Module `device` giữ nguyên 4 tầng. Thay `InMemoryDeviceRepository` bằng `HttpDeviceRepository` theo
đúng khuôn `HttpUserAdminRepository` đã làm ở vòng trước.

| Route | Nội dung |
|---|---|
| `/devices` | Gọi `GET /devices`. Cột đúng Figma `154:649`: Mã thiết bị · Tên thiết bị · Cấu hình chi tiết · Người sở hữu · Trạng thái · Hoạt động. Ô tìm kiếm + lọc `Trạng thái (Tất cả)`. Nút **👁** (đang chết) → `/devices/:id/edit`. Nút **⋮** → xoá mềm, xác nhận bằng `window.confirm`. Nút **Thêm thiết bị** → `/devices/new`. |
| `/devices/new` | `AssetFormPage`. Dropdown thật: Đơn vị quản lý ← `GET /departments`, Người sở hữu ← `GET /users`, Loại thiết bị ← `GET /device-types`. Bảng linh kiện lần đầu được lưu thật. |
| `/devices/:id/edit` | Cùng `AssetFormPage`, đổ sẵn từ `GET /devices/:id`. |

- `domain/deviceDraft.ts`: `validateDeviceDraft` thay `validateAssetDraft`. Bắt buộc: `deviceCode`
  (đúng regex `/^[A-Z]{2,4}-\d{6}$/`), `deviceName`, `specDetail`, `unit`, `deviceTypeId`. Dùng chung
  cho cả trang tạo và trang sửa — đúng quy ước "một hàm validate ở `domain/`".
- Ô **Số serial**, **Loại thiết bị**, **Đơn vị tính** là mới trên form.
- Ghi: chỉ hiện nút Thêm/Sửa/Xoá khi session có quyền ghi (`roleName === 'Quản trị viên'`, hoặc
  `'Trưởng phòng'` + phòng `KYTHUAT`). BE vẫn là chốt chặn thật; ẩn nút chỉ là trải nghiệm.
  → `AuthSession` cần thêm `departmentCode`, lấy từ response `/auth/login`.
- **Không** làm trang chi tiết `/devices/:id`.

## 7. Verification

- BE: `devices.spec.ts` theo khuôn `users.spec.ts`, dùng lại `fake-prisma.ts` (mở rộng nếu cần).
  Bắt buộc có ca: tạo thành công · trùng mã 409 · trùng serial 409 · sai định dạng mã 400 ·
  prefix không khớp loại 400 · loại không tồn tại 400 · xoá mềm không xoá row (chặn
  `prisma.device.delete`) · thao tác trên thiết bị đã xoá 404 · id vượt int32 404 ·
  `Nhân viên` gọi POST → 403 · `Trưởng phòng` phòng `KETOAN` gọi POST → 403 ·
  `Trưởng phòng` phòng `KYTHUAT` gọi POST → 201.
- BE: `auth.spec.ts` giữ nguyên 23 ca xanh + ca mới cho `departmentCode` trong `req.user`.
- FE: vitest cho `validateDeviceDraft` (gồm ca regex mã) + `HttpDeviceRepository` + 2 trang.
- `backend/scripts/e2e-users.ps1` phải vẫn xanh 11/11 — đây là bằng chứng `AuthGuard` không đổi
  hành vi cũ, quan trọng hơn mọi unit test của vòng này.
- Thêm `backend/scripts/e2e-devices.ps1` theo đúng khuôn script hiện có (mã thiết bị mang timestamp
  để chạy lại được, không xoá cứng, UTF-8 có BOM, SQL đưa qua stdin). Phải kiểm được trên PG thật:
  tìm kiếm không phân biệt hoa thường, prefix sai → 400, `Trưởng phòng` phòng `KETOAN` → 403,
  xoá mềm xong row vẫn còn với `Status = 'Đã xóa'`.
- `npx prisma migrate dev` + `npx prisma db seed` chạy được trên PG18 cục bộ.

## 8. Cố ý KHÔNG làm trong vòng A

Trang chi tiết thiết bị · phân trang · Modal/Toast (vẫn `window.confirm`) · "Xuất khẩu" · tệp đính
kèm · "Thông tin khác" tuỳ chỉnh · sinh mã tự động · bảng danh mục Đơn vị tính · bảng danh mục cấu
hình · toàn bộ **Điều chuyển** và **Cấp phát - Thu hồi** (Figma có 12 frame cho chúng) · và **Kiểm kê**,
là vòng B.
