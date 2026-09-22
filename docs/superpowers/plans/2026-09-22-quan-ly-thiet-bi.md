# Quản lý thiết bị Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng bảng `Device` / `DeviceType` / `DeviceAccessory` thật trong PostgreSQL cùng API và màn hình đi kèm, thay cho mock in-memory hiện tại, để vòng sau (Kiểm kê) có dữ liệu thật để đối chiếu.

**Architecture:** Backend thêm module `devices` theo đúng khuôn module `users` đã có (NestJS thuần: `*.dto.ts` / `*.service.ts` / `*.controller.ts` / `*.module.ts` / `*.spec.ts`), dùng lại envelope response và `AuthGuard` sẵn có. `AuthGuard` được mở rộng một chút để mang thêm `departmentCode`, đủ cho một guard mới diễn đạt quyền "Trưởng phòng Kỹ thuật". Frontend giữ nguyên kiến trúc 4 tầng của module `device`, thay `InMemoryDeviceRepository` bằng `HttpDeviceRepository` đúng cách `HttpUserAdminRepository` đã làm ở vòng trước.

**Tech Stack:** NestJS 11.2 · Prisma 7.10 · PostgreSQL 18 (native, `D:\Postgre`) · jest + supertest · React 18 + Vite · vitest · PowerShell 5.1 cho script E2E.

**Spec:** `docs/superpowers/specs/2026-09-22-device-management-design.md` — đọc cả spec, nó là nguồn ràng buộc; plan này chỉ là cách thực thi spec đó.

## Global Constraints

- Mọi chuỗi hiển thị cho người dùng viết bằng **tiếng Việt**.
- Tên hệ thống là **IDSM**. Role PostgreSQL `idms` và database `internal_device_management` giữ nguyên tên.
- **Không bao giờ xoá cứng** row `User` hay `Device`. Xoá = đổi `Status` thành `"Đã xóa"`.
- `DEVICE_STATUS` lưu nguyên văn tiếng Việt trong DB: `"Trong kho"` · `"Đã cấp phát"` · `"Chờ thanh lý"` · `"Đã xóa"`.
- `deviceCode` khớp `/^[A-Z]{2,4}-\d{6}$/` và phải mở đầu đúng bằng `prefix` của `DeviceType` đã chọn.
- Quyền **ghi** thiết bị = `Quản trị viên` **hoặc** `Trưởng phòng` có `departmentCode === 'KYTHUAT'`. Quyền **đọc** = mọi vai trò đã đăng nhập.
- Mọi response bọc envelope `{ success, data, error, message }` — đã có sẵn, không dựng lại.
- Field Prisma camelCase + `@map` sang cột PascalCase + `@@map` tên bảng.
- Lệnh backend chạy **trong `backend/`**, dùng `npx -y pnpm@10 <script>` hoặc `npx prisma ...`. Máy không có Docker, không có pnpm toàn cục. Node v25.
- Commit conventional-commit tiếng Việt, kết thúc bằng:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **Không push** ở bất kỳ task nào. Không merge. Không đổi nhánh.

## Bản đồ file

| File | Trách nhiệm | Task |
|---|---|---|
| `backend/prisma/schema.prisma` | 3 model mới + quan hệ ngược trên `User`/`Department` | 1 |
| `backend/prisma/seed.ts` | seed 4 `DeviceType` | 1 |
| `backend/src/shared/auth/auth.guard.ts` | thêm `departmentCode` vào `AuthUser` | 2 |
| `backend/src/modules/identity/auth.service.ts` | login trả thêm `departmentCode` | 2 |
| `backend/src/shared/auth/device-write.guard.ts` | **mới** — quyền ghi thiết bị | 3 |
| `backend/src/modules/devices/device-status.ts` | hằng trạng thái + regex mã | 3 |
| `backend/src/modules/devices/devices.dto.ts` | DTO + validate | 3 |
| `backend/src/modules/devices/devices.service.ts` | toàn bộ quy tắc nghiệp vụ | 3 |
| `backend/src/modules/devices/devices.controller.ts` | route + phân quyền | 3 |
| `backend/src/modules/devices/devices.module.ts` | wiring | 3 |
| `backend/src/modules/devices/devices.spec.ts` | test qua HTTP thật | 3 |
| `backend/src/test/fake-prisma.ts` | thêm `device`, `deviceType`, `deviceAccessory` | 3 |
| `backend/src/app.module.ts` | đăng ký `DevicesModule` | 3 |
| `backend/scripts/e2e-devices.ps1` | **mới** — E2E trên PG thật | 4 |
| `frontend/src/modules/device/domain/device.ts` | model + trạng thái tiếng Việt | 5 |
| `frontend/src/modules/device/domain/deviceDraft.ts` | **mới** — thay `assetDraft.ts` | 5 |
| `frontend/src/modules/device/application/DeviceRepository.ts` | port + service | 5 |
| `frontend/src/modules/device/infrastructure/HttpDeviceRepository.ts` | **mới** | 5 |
| `frontend/src/modules/device/presentation/*` | 2 trang + form | 6 |
| `frontend/src/app/router.tsx` | route sửa + `/allocation` | 6 |
| `frontend/src/modules/auth/domain/session.ts` | `departmentCode` + `canWriteDevices` | 6 |
| `docs/CONTEXT.md`, 2 README, `docs/Changes.md` | tài liệu | 7 |

---

### Task 1: Lược đồ Prisma, migration và seed loại thiết bị

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/prisma/seed.ts`
- Create: `backend/prisma/migrations/<timestamp>_add_device/` (Prisma tự sinh)

**Interfaces:**
- Consumes: 4 model sẵn có `Role`, `Department`, `User`, `PasswordResetToken`.
- Produces: model Prisma `DeviceType { id, typeName, prefix }`, `Device { … }`, `DeviceAccessory { … }` đúng như khối schema ở Step 1; type `@prisma/client` sinh ra mang đúng tên field đó cho mọi task sau.

- [ ] **Step 1: Thêm 3 model vào cuối `backend/prisma/schema.prisma`**

```prisma
// --- DeviceType ---------------------------------------------------------
// Danh mục loại thiết bị. `prefix` là tiền tố bắt buộc của DeviceCode:
// chọn loại Laptop (prefix "LT") thì mã phải bắt đầu bằng "LT-".
model DeviceType {
  id       Int    @id @default(autoincrement()) @map("Id")
  typeName String @map("TypeName") @db.VarChar(100)
  prefix   String @unique @map("Prefix") @db.VarChar(4)

  devices Device[]

  @@map("DeviceType")
}

// --- Device -------------------------------------------------------------
// KHÔNG BAO GIỜ xoá cứng: xoá = đổi Status thành "Đã xóa" (cùng quy tắc User).
model Device {
  id           Int       @id @default(autoincrement()) @map("Id")
  deviceCode   String    @unique @map("DeviceCode") @db.VarChar(20)
  deviceName   String    @map("DeviceName") @db.VarChar(150)
  serialNumber String?   @unique @map("SerialNumber") @db.VarChar(100)
  specDetail   String    @map("SpecDetail") @db.VarChar(255)
  unit         String    @map("Unit") @db.VarChar(20)
  location     String?   @map("Location") @db.VarChar(150)
  purchaseDate DateTime? @map("PurchaseDate") @db.Date
  supplier     String?   @map("Supplier") @db.VarChar(150)

  warrantyMonths    Int?      @map("WarrantyMonths")
  warrantyCondition String?   @map("WarrantyCondition") @db.VarChar(255)
  warrantyExpiresOn DateTime? @map("WarrantyExpiresOn") @db.Date

  status      String    @map("Status") @db.VarChar(50)
  allocatedOn DateTime? @map("AllocatedOn") @db.Date

  deviceTypeId  Int  @map("DeviceTypeId")
  departmentId  Int? @map("DepartmentId")
  currentUserId Int? @map("CurrentUserId")

  createdAt DateTime @default(now()) @map("CreatedAt")
  updatedAt DateTime @updatedAt @map("UpdatedAt")

  deviceType  DeviceType  @relation(fields: [deviceTypeId], references: [id])
  department  Department? @relation(fields: [departmentId], references: [id])
  currentUser User?       @relation(fields: [currentUserId], references: [id])
  accessories DeviceAccessory[]

  @@map("Device")
}

// --- DeviceAccessory ----------------------------------------------------
// Linh kiện đi kèm một thiết bị. PATCH gửi `accessories` thì thay thế TOÀN BỘ
// danh sách, nên cascade delete ở đây là cố ý (xoá linh kiện, không xoá Device).
model DeviceAccessory {
  id            Int    @id @default(autoincrement()) @map("Id")
  deviceId      Int    @map("DeviceId")
  accessoryCode String @map("AccessoryCode") @db.VarChar(50)
  accessoryName String @map("AccessoryName") @db.VarChar(150)
  accessoryType String @map("AccessoryType") @db.VarChar(100)
  unit          String @map("Unit") @db.VarChar(20)

  device Device @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@map("DeviceAccessory")
}
```

- [ ] **Step 2: Thêm quan hệ ngược vào `User` và `Department`**

Trong model `User`, thêm một dòng cạnh các quan hệ sẵn có:

```prisma
  devices Device[]
```

Trong model `Department`, thêm tương tự:

```prisma
  devices Device[]
```

Không đổi gì khác trong hai model này.

- [ ] **Step 3: Sinh migration**

Chạy trong `backend/`:

```bash
npx prisma migrate dev --name add_device
```

Mong đợi: tạo thư mục `prisma/migrations/<timestamp>_add_device/migration.sql`, áp lên DB, in `Your database is now in sync with your schema`.

Nếu Prisma báo cần reset database: **DỪNG LẠI**, báo người dùng. DB cục bộ đang có dữ liệu thật (user `admin`, `dev` và vài dòng kiểm thử E2E); reset phải do người dùng đồng ý.

- [ ] **Step 4: Seed 4 loại thiết bị**

Trong `backend/prisma/seed.ts`, thêm khối sau **sau** khối seed `departments` và **trước** khối tạo user `admin`:

```ts
  // Loại thiết bị: `prefix` quyết định tiền tố hợp lệ của DeviceCode.
  const deviceTypes = [
    { typeName: 'Laptop', prefix: 'LT' },
    { typeName: 'Máy tính để bàn', prefix: 'PC' },
    { typeName: 'Màn hình', prefix: 'MN' },
    { typeName: 'Máy in', prefix: 'MI' },
  ];
  for (const t of deviceTypes) {
    await prisma.deviceType.upsert({
      where: { prefix: t.prefix },
      update: { typeName: t.typeName },
      create: t,
    });
  }
```

Sửa dòng `console.log` tổng kết để kể thêm số loại thiết bị:

```ts
  console.log(
    `Seed xong: ${Object.keys(roleIds).length} role, ${departments.length} phòng ban, ` +
      `${deviceTypes.length} loại thiết bị, user=${admin.username}`,
  );
```

- [ ] **Step 5: Chạy seed**

```bash
npx prisma db seed
```

Mong đợi: in dòng tổng kết có `4 loại thiết bị`, không lỗi. Chạy lại lần hai cũng phải thành công (upsert, không trùng).

- [ ] **Step 6: Xác minh cấu trúc thật trong DB**

```bash
PGPASSWORD=idms_dev "/d/Postgre/bin/psql.exe" -U idms -h localhost -d internal_device_management \
  -c '\d "Device"' \
  -c 'SELECT * FROM "DeviceType" ORDER BY "Id";'
```

Mong đợi:
- `\d "Device"` liệt kê đủ các cột `DeviceCode`, `SerialNumber`, `Unit`, `Status`, `DeviceTypeId`, `DepartmentId`, `CurrentUserId`; có unique index trên `DeviceCode` và `SerialNumber`; có 3 foreign key.
- `DeviceType` trả đúng 4 dòng LT / PC / MN / MI.

- [ ] **Step 7: Chạy lại bộ test cũ để chắc không vỡ gì**

```bash
npx -y pnpm@10 test
```

Mong đợi: **49 passed** (schema mới chưa ảnh hưởng test nào).

- [ ] **Step 8: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/seed.ts backend/prisma/migrations
git commit -m "feat(db): thêm bảng Device, DeviceType, DeviceAccessory

Kiểm kê cần dữ liệu thiết bị thật; trước đó thiết bị chỉ là mock in-memory ở
frontend. DeviceType.prefix là tiền tố bắt buộc của DeviceCode. Device xoá mềm
qua Status như User, không bao giờ xoá row.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `AuthGuard` mang thêm `departmentCode`, login trả thêm `departmentCode`

**Files:**
- Modify: `backend/src/shared/auth/auth.guard.ts`
- Modify: `backend/src/modules/identity/auth.service.ts`
- Test: `backend/src/modules/identity/auth.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `ROLE` từ `backend/src/modules/identity/roles.ts`.
- Produces: `AuthUser = { id: number; roleName: string; departmentCode: string | null }` xuất từ `auth.guard.ts` — Task 3 đọc `departmentCode` từ đây. `POST /auth/login` trả thêm `data.user.departmentCode: string | null` — Task 6 đọc trường này.

**Cảnh báo:** `auth.guard.ts` là file bảo mật nhất repo và là thứ bảo đảm "khoá tài khoản có hiệu lực ngay lập tức". Chỉ thêm, không đổi hành vi cũ. 23 ca `auth.spec.ts` hiện có phải vẫn xanh.

`fake-prisma.ts` **đã hỗ trợ sẵn** `include: { department: true }` (xem hàm `withRelations`), nên task này không phải sửa fake.

- [ ] **Step 1: Viết test thất bại cho login**

Thêm vào `backend/src/modules/identity/auth.spec.ts`, trong `describe` của luồng đăng nhập:

```ts
  it('trả departmentCode của người dùng khi đăng nhập', async () => {
    const res = await http()
      .post('/auth/login')
      .send({ identifier: 'admin', password: 'Secret@123' })
      .expect(200);
    expect(res.body.data.user.departmentCode).toBe('KYTHUAT');
  });
```

- [ ] **Step 2: Chạy để xác nhận nó hỏng**

```bash
npx -y pnpm@10 test -- auth.spec.ts -t "departmentCode"
```

Mong đợi: FAIL — `Received: undefined`.

- [ ] **Step 3: Sửa `auth.service.ts`**

Trong hàm `login`, đổi câu truy vấn để nạp luôn phòng ban:

```ts
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username: id }, { email: id }] },
      include: { role: true, department: true },
    });
```

Và trong object `user` trả về, thêm một dòng ngay sau `departmentId`:

```ts
        departmentCode: user.department?.departmentCode ?? null,
```

Không đổi bất kỳ trường nào khác, không đổi thứ tự kiểm tra lỗi.

- [ ] **Step 4: Chạy lại, phải xanh**

```bash
npx -y pnpm@10 test -- auth.spec.ts
```

Mong đợi: PASS, tổng số ca của `auth.spec.ts` tăng đúng 1.

- [ ] **Step 5: Sửa `auth.guard.ts`**

Đổi interface:

```ts
export interface AuthUser {
  id: number;
  roleName: string;
  /** Department.DepartmentCode, hoặc null nếu tài khoản không thuộc phòng ban nào (vd. Quản trị viên). */
  departmentCode: string | null;
}
```

Đổi câu truy vấn trong `canActivate`:

```ts
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true, department: true },
    });
```

Đổi dòng gán `req.user`:

```ts
    req.user = {
      id: user.id,
      roleName: user.role.roleName,
      departmentCode: user.department?.departmentCode ?? null,
    };
```

Không đổi gì khác: thứ tự kiểm tra `Bearer` → verify JWT → đọc lại user từ DB → chặn `status !== ACTIVE` → kiểm `@Roles` phải giữ nguyên y hệt.

- [ ] **Step 6: Chạy toàn bộ test backend**

```bash
npx -y pnpm@10 test
```

Mong đợi: **50 passed** (49 cũ + 1 mới), 2 suite.

Lưu ý cho người review: `departmentCode` trong `req.user` chưa có route nào đọc ở task này, nên nó chỉ được phủ gián tiếp (các test cũ vẫn xanh chứng tỏ guard không vỡ). Phủ trực tiếp nằm ở Task 3, nơi `DeviceWriteGuard` dựa hẳn vào nó và có 3 ca test 403/201. Đây là chủ ý, không phải thiếu sót.

- [ ] **Step 7: Build + lint**

```bash
npx -y pnpm@10 run build && npx -y pnpm@10 run lint
```

Mong đợi: cả hai sạch.

- [ ] **Step 8: Commit**

```bash
git add backend/src/shared/auth/auth.guard.ts backend/src/modules/identity/auth.service.ts backend/src/modules/identity/auth.spec.ts
git commit -m "feat(auth): AuthUser và response đăng nhập mang thêm departmentCode

Quyền ghi thiết bị là \"Trưởng phòng Kỹ thuật\", mà @Roles chỉ so được roleName.
Guard nạp sẵn quan hệ department rồi gắn departmentCode vào req.user; login trả
thêm trường này để frontend ẩn/hiện nút ghi không cần gọi thêm API.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Module `devices` ở backend

**Files:**
- Create: `backend/src/shared/auth/device-write.guard.ts`
- Create: `backend/src/modules/devices/device-status.ts`
- Create: `backend/src/modules/devices/devices.dto.ts`
- Create: `backend/src/modules/devices/devices.service.ts`
- Create: `backend/src/modules/devices/devices.controller.ts`
- Create: `backend/src/modules/devices/devices.module.ts`
- Create: `backend/src/modules/devices/devices.spec.ts`
- Modify: `backend/src/test/fake-prisma.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `AuthGuard`, `AuthedRequest`, `AuthUser.departmentCode` (Task 2); `ROLE` từ `modules/identity/roles.ts`; `MAX_INT32` từ `modules/users/users.dto.ts`; `ResponseMessage` từ `shared/http/api-response.ts`.
- Produces: các route ở mục 4 của spec; `DEVICE_STATUS` và `DEVICE_CODE_PATTERN` xuất từ `device-status.ts` (Task 4 và Task 5 dùng lại đúng chuỗi này).

Đọc `backend/src/modules/users/users.service.ts` và `users.controller.ts` trước khi viết — module này bám đúng khuôn đó (cách ném lỗi, cách `findLiveUser` chặn id vượt int32, cách `@ResponseMessage` đặt message).

- [ ] **Step 1: `device-status.ts`**

```ts
/** Trạng thái thiết bị — lưu nguyên văn tiếng Việt trong DB, giống User.Status. */
export const DEVICE_STATUS = {
  IN_STOCK: 'Trong kho',
  ALLOCATED: 'Đã cấp phát',
  PENDING_DISPOSAL: 'Chờ thanh lý',
  DELETED: 'Đã xóa',
} as const;

/** 3 trạng thái người dùng được phép đặt qua PATCH. "Đã xóa" chỉ do DELETE đặt. */
export const ASSIGNABLE_DEVICE_STATUSES: string[] = [
  DEVICE_STATUS.IN_STOCK,
  DEVICE_STATUS.ALLOCATED,
  DEVICE_STATUS.PENDING_DISPOSAL,
];

/** Mã thiết bị: tiền tố 2-4 chữ in hoa + gạch nối + đúng 6 chữ số, vd. PC-000123. */
export const DEVICE_CODE_PATTERN = /^[A-Z]{2,4}-\d{6}$/;
export const DEVICE_CODE_MESSAGE = 'Mã thiết bị phải có dạng PC-000123';
```

- [ ] **Step 2: `devices.dto.ts`**

```ts
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_INT32 } from '../users/users.dto';
import {
  ASSIGNABLE_DEVICE_STATUSES,
  DEVICE_CODE_MESSAGE,
  DEVICE_CODE_PATTERN,
} from './device-status';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class AccessoryDto {
  @Transform(trim) @IsString() @IsNotEmpty({ message: 'Vui lòng nhập mã linh kiện' })
  @MaxLength(50)
  accessoryCode!: string;

  @Transform(trim) @IsString() @IsNotEmpty({ message: 'Vui lòng nhập tên linh kiện' })
  @MaxLength(150)
  accessoryName!: string;

  @Transform(trim) @IsString() @MaxLength(100)
  accessoryType!: string;

  @Transform(trim) @IsString() @MaxLength(20)
  unit!: string;
}

export class ListDevicesQuery {
  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsIn([...ASSIGNABLE_DEVICE_STATUSES], { message: 'Trạng thái không hợp lệ' })
  status?: string;

  @IsOptional() @Type(() => Number)
  @IsInt({ message: 'Loại thiết bị không hợp lệ' })
  @Min(1, { message: 'Loại thiết bị không hợp lệ' })
  @Max(MAX_INT32, { message: 'Loại thiết bị không hợp lệ' })
  deviceTypeId?: number;

  @IsOptional() @Type(() => Number)
  @IsInt({ message: 'Phòng ban không hợp lệ' })
  @Min(1, { message: 'Phòng ban không hợp lệ' })
  @Max(MAX_INT32, { message: 'Phòng ban không hợp lệ' })
  departmentId?: number;
}

export class CreateDeviceDto {
  @Transform(upper) @IsString() @Matches(DEVICE_CODE_PATTERN, { message: DEVICE_CODE_MESSAGE })
  deviceCode!: string;

  @Transform(trim) @IsString() @IsNotEmpty({ message: 'Vui lòng nhập tên thiết bị' })
  @MaxLength(150)
  deviceName!: string;

  @Transform(trim) @IsString() @IsNotEmpty({ message: 'Vui lòng nhập cấu hình chi tiết' })
  @MaxLength(255)
  specDetail!: string;

  @Transform(trim) @IsString() @IsNotEmpty({ message: 'Vui lòng nhập đơn vị tính' })
  @MaxLength(20)
  unit!: string;

  @IsInt({ message: 'Vui lòng chọn loại thiết bị' })
  @Min(1, { message: 'Loại thiết bị không hợp lệ' })
  @Max(MAX_INT32, { message: 'Loại thiết bị không hợp lệ' })
  deviceTypeId!: number;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(100)
  serialNumber?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(150)
  location?: string;

  @IsOptional() @IsDateString({}, { message: 'Ngày mua không hợp lệ' })
  purchaseDate?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(150)
  supplier?: string;

  @IsOptional() @IsInt({ message: 'Thời gian bảo hành không hợp lệ' })
  @Min(0, { message: 'Thời gian bảo hành không hợp lệ' })
  @Max(MAX_INT32, { message: 'Thời gian bảo hành không hợp lệ' })
  warrantyMonths?: number;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(255)
  warrantyCondition?: string;

  @IsOptional() @IsDateString({}, { message: 'Hạn bảo hành không hợp lệ' })
  warrantyExpiresOn?: string;

  @IsOptional() @IsInt({ message: 'Phòng ban không hợp lệ' })
  @Min(1, { message: 'Phòng ban không hợp lệ' })
  @Max(MAX_INT32, { message: 'Phòng ban không hợp lệ' })
  departmentId?: number;

  @IsOptional() @IsInt({ message: 'Người sở hữu không hợp lệ' })
  @Min(1, { message: 'Người sở hữu không hợp lệ' })
  @Max(MAX_INT32, { message: 'Người sở hữu không hợp lệ' })
  currentUserId?: number;

  @IsOptional() @IsDateString({}, { message: 'Ngày cấp phát không hợp lệ' })
  allocatedOn?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AccessoryDto)
  accessories?: AccessoryDto[];
}

/** Mọi trường của Create ở dạng optional, cộng thêm status (3 giá trị). */
export class UpdateDeviceDto {
  @IsOptional() @Transform(upper) @IsString()
  @Matches(DEVICE_CODE_PATTERN, { message: DEVICE_CODE_MESSAGE })
  deviceCode?: string;

  @IsOptional() @Transform(trim) @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên thiết bị' }) @MaxLength(150)
  deviceName?: string;

  @IsOptional() @Transform(trim) @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập cấu hình chi tiết' }) @MaxLength(255)
  specDetail?: string;

  @IsOptional() @Transform(trim) @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập đơn vị tính' }) @MaxLength(20)
  unit?: string;

  @IsOptional() @IsInt({ message: 'Loại thiết bị không hợp lệ' })
  @Min(1, { message: 'Loại thiết bị không hợp lệ' })
  @Max(MAX_INT32, { message: 'Loại thiết bị không hợp lệ' })
  deviceTypeId?: number;

  @IsOptional() @IsIn([...ASSIGNABLE_DEVICE_STATUSES], { message: 'Trạng thái không hợp lệ' })
  status?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(100)
  serialNumber?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(150)
  location?: string;

  @IsOptional() @IsDateString({}, { message: 'Ngày mua không hợp lệ' })
  purchaseDate?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(150)
  supplier?: string;

  @IsOptional() @IsInt({ message: 'Thời gian bảo hành không hợp lệ' })
  @Min(0, { message: 'Thời gian bảo hành không hợp lệ' })
  @Max(MAX_INT32, { message: 'Thời gian bảo hành không hợp lệ' })
  warrantyMonths?: number;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(255)
  warrantyCondition?: string;

  @IsOptional() @IsDateString({}, { message: 'Hạn bảo hành không hợp lệ' })
  warrantyExpiresOn?: string;

  @IsOptional() @IsInt({ message: 'Phòng ban không hợp lệ' })
  @Min(1, { message: 'Phòng ban không hợp lệ' })
  @Max(MAX_INT32, { message: 'Phòng ban không hợp lệ' })
  departmentId?: number;

  @IsOptional() @IsInt({ message: 'Người sở hữu không hợp lệ' })
  @Min(1, { message: 'Người sở hữu không hợp lệ' })
  @Max(MAX_INT32, { message: 'Người sở hữu không hợp lệ' })
  currentUserId?: number;

  @IsOptional() @IsDateString({}, { message: 'Ngày cấp phát không hợp lệ' })
  allocatedOn?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AccessoryDto)
  accessories?: AccessoryDto[];
}
```

- [ ] **Step 3: `device-write.guard.ts`**

```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ROLE } from '../../modules/identity/roles';
import type { AuthedRequest } from './auth.guard';

export const TECH_DEPARTMENT_CODE = 'KYTHUAT';
const NO_PERMISSION = 'Bạn không có quyền thực hiện thao tác này';

/**
 * Quyền GHI thiết bị: Quản trị viên, hoặc Trưởng phòng thuộc phòng Kỹ thuật.
 * Phải chạy SAU AuthGuard — nó đọc req.user do AuthGuard gắn vào.
 */
@Injectable()
export class DeviceWriteGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<AuthedRequest>();
    const allowed =
      user.roleName === ROLE.ADMIN ||
      (user.roleName === ROLE.HEAD &&
        user.departmentCode === TECH_DEPARTMENT_CODE);
    if (!allowed) throw new ForbiddenException(NO_PERMISSION);
    return true;
  }
}
```

- [ ] **Step 4: `devices.service.ts`**

```ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { MAX_INT32 } from '../users/users.dto';
import { DEVICE_STATUS } from './device-status';
import type { CreateDeviceDto, UpdateDeviceDto } from './devices.dto';

export const DEVICE_NOT_FOUND = 'Thiết bị không tồn tại';

const WITH_RELATIONS = {
  deviceType: true,
  department: true,
  currentUser: true,
  accessories: true,
} as const;

function toItem(d: any) {
  return {
    id: d.id,
    deviceCode: d.deviceCode,
    deviceName: d.deviceName,
    serialNumber: d.serialNumber,
    specDetail: d.specDetail,
    unit: d.unit,
    status: d.status,
    allocatedOn: d.allocatedOn,
    location: d.location,
    purchaseDate: d.purchaseDate,
    supplier: d.supplier,
    warrantyMonths: d.warrantyMonths,
    warrantyCondition: d.warrantyCondition,
    warrantyExpiresOn: d.warrantyExpiresOn,
    deviceType: {
      id: d.deviceType.id,
      typeName: d.deviceType.typeName,
      prefix: d.deviceType.prefix,
    },
    department: d.department && {
      id: d.department.id,
      departmentCode: d.department.departmentCode,
      departmentName: d.department.departmentName,
    },
    currentUser: d.currentUser && {
      id: d.currentUser.id,
      fullName: d.currentUser.fullName,
      username: d.currentUser.username,
    },
    accessories: (d.accessories ?? []).map((a: any) => ({
      id: a.id,
      accessoryCode: a.accessoryCode,
      accessoryName: a.accessoryName,
      accessoryType: a.accessoryType,
      unit: a.unit,
    })),
  };
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  // ponytail: chưa phân trang (DataTable FE cũng chưa có) — thêm skip/take khi đủ nhiều thiết bị.
  async list(q: {
    search?: string;
    status?: string;
    deviceTypeId?: number;
    departmentId?: number;
  }) {
    const s = q.search?.trim();
    const devices = await this.prisma.device.findMany({
      where: {
        status: q.status ?? { not: DEVICE_STATUS.DELETED },
        deviceTypeId: q.deviceTypeId,
        departmentId: q.departmentId,
        ...(s
          ? {
              OR: [
                { deviceCode: { contains: s, mode: Prisma.QueryMode.insensitive } },
                { deviceName: { contains: s, mode: Prisma.QueryMode.insensitive } },
                { serialNumber: { contains: s, mode: Prisma.QueryMode.insensitive } },
              ],
            }
          : {}),
      },
      include: WITH_RELATIONS,
      orderBy: { id: 'asc' },
    });
    return devices.map(toItem);
  }

  async getById(id: number) {
    await this.findLiveDevice(id);
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: WITH_RELATIONS,
    });
    return toItem(device);
  }

  async create(dto: CreateDeviceDto) {
    const type = await this.requireDeviceType(dto.deviceTypeId);
    this.requirePrefix(dto.deviceCode, type.prefix);
    await this.requireUniqueCode(dto.deviceCode);
    await this.requireUniqueSerial(dto.serialNumber);
    await this.requireDepartment(dto.departmentId);
    await this.requireUser(dto.currentUserId);

    try {
      const device = await this.prisma.device.create({
        data: {
          ...this.scalars(dto),
          status: dto.currentUserId
            ? DEVICE_STATUS.ALLOCATED
            : DEVICE_STATUS.IN_STOCK,
          accessories: dto.accessories?.length
            ? { create: dto.accessories }
            : undefined,
        },
        include: WITH_RELATIONS,
      });
      return toItem(device);
    } catch (e) {
      throw this.asConflict(e);
    }
  }

  async update(id: number, dto: UpdateDeviceDto) {
    const current = await this.findLiveDevice(id);

    const typeId = dto.deviceTypeId ?? current.deviceTypeId;
    const type = await this.requireDeviceType(typeId);
    if (dto.deviceCode) this.requirePrefix(dto.deviceCode, type.prefix);
    else this.requirePrefix(current.deviceCode, type.prefix);

    if (dto.deviceCode && dto.deviceCode !== current.deviceCode) {
      await this.requireUniqueCode(dto.deviceCode);
    }
    if (dto.serialNumber && dto.serialNumber !== current.serialNumber) {
      await this.requireUniqueSerial(dto.serialNumber);
    }
    await this.requireDepartment(dto.departmentId);
    await this.requireUser(dto.currentUserId);

    try {
      const device = await this.prisma.device.update({
        where: { id },
        data: {
          ...this.scalars(dto),
          ...(dto.status ? { status: dto.status } : {}),
          // PATCH gửi accessories => thay thế toàn bộ danh sách.
          ...(dto.accessories
            ? { accessories: { deleteMany: {}, create: dto.accessories } }
            : {}),
        },
        include: WITH_RELATIONS,
      });
      return toItem(device);
    } catch (e) {
      throw this.asConflict(e);
    }
  }

  /** Xoá mềm: chỉ đổi Status, không bao giờ xoá row. */
  async softDelete(id: number): Promise<void> {
    await this.findLiveDevice(id);
    await this.prisma.device.update({
      where: { id },
      data: { status: DEVICE_STATUS.DELETED },
    });
  }

  deviceTypes() {
    return this.prisma.deviceType.findMany({ orderBy: { id: 'asc' } });
  }

  // --- helpers ---------------------------------------------------------

  private scalars(dto: CreateDeviceDto | UpdateDeviceDto) {
    return {
      deviceCode: dto.deviceCode,
      deviceName: dto.deviceName,
      specDetail: dto.specDetail,
      unit: dto.unit,
      deviceTypeId: dto.deviceTypeId,
      serialNumber: dto.serialNumber,
      location: dto.location,
      purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
      supplier: dto.supplier,
      warrantyMonths: dto.warrantyMonths,
      warrantyCondition: dto.warrantyCondition,
      warrantyExpiresOn: dto.warrantyExpiresOn
        ? new Date(dto.warrantyExpiresOn)
        : undefined,
      departmentId: dto.departmentId,
      currentUserId: dto.currentUserId,
      allocatedOn: dto.allocatedOn ? new Date(dto.allocatedOn) : undefined,
    };
  }

  private requirePrefix(code: string, prefix: string) {
    if (!code.startsWith(`${prefix}-`)) {
      throw new BadRequestException(
        `Mã thiết bị phải bắt đầu bằng "${prefix}" theo loại thiết bị đã chọn`,
      );
    }
  }

  private async requireDeviceType(id: number) {
    const type = await this.prisma.deviceType.findUnique({ where: { id } });
    if (!type) throw new BadRequestException('Loại thiết bị không tồn tại');
    return type;
  }

  private async requireUniqueCode(deviceCode: string) {
    if (await this.prisma.device.findUnique({ where: { deviceCode } })) {
      throw new ConflictException('Mã thiết bị đã tồn tại');
    }
  }

  private async requireUniqueSerial(serialNumber?: string) {
    if (!serialNumber) return;
    if (await this.prisma.device.findUnique({ where: { serialNumber } })) {
      throw new ConflictException('Số serial đã tồn tại');
    }
  }

  private async requireDepartment(id?: number) {
    if (id === undefined) return;
    if (!(await this.prisma.department.findUnique({ where: { id } }))) {
      throw new BadRequestException('Phòng ban không tồn tại');
    }
  }

  private async requireUser(id?: number) {
    if (id === undefined) return;
    if (!(await this.prisma.user.findUnique({ where: { id } }))) {
      throw new BadRequestException('Người dùng không tồn tại');
    }
  }

  private asConflict(e: unknown) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2002'
    ) {
      return new ConflictException('Mã thiết bị hoặc số serial đã tồn tại');
    }
    return e;
  }

  private async findLiveDevice(id: number) {
    // Id ngoài phạm vi int4: Prisma ném lỗi 500 — coi như thiết bị không tồn tại.
    if (Math.abs(id) > MAX_INT32) throw new NotFoundException(DEVICE_NOT_FOUND);
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device || device.status === DEVICE_STATUS.DELETED) {
      throw new NotFoundException(DEVICE_NOT_FOUND);
    }
    return device;
  }
}
```

- [ ] **Step 5: `devices.controller.ts`**

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../shared/auth/auth.guard';
import { DeviceWriteGuard } from '../../shared/auth/device-write.guard';
import { ResponseMessage } from '../../shared/http/api-response';
import { CreateDeviceDto, ListDevicesQuery, UpdateDeviceDto } from './devices.dto';
import { DEVICE_NOT_FOUND, DevicesService } from './devices.service';

const DeviceId = () =>
  Param(
    'id',
    new ParseIntPipe({
      exceptionFactory: () => new NotFoundException(DEVICE_NOT_FOUND),
    }),
  );

@Controller('devices')
@UseGuards(AuthGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  list(@Query() query: ListDevicesQuery) {
    return this.devices.list(query);
  }

  @Get(':id')
  get(@DeviceId() id: number) {
    return this.devices.getById(id);
  }

  @Post()
  @UseGuards(DeviceWriteGuard)
  @ResponseMessage('Đã tạo thiết bị')
  create(@Body() dto: CreateDeviceDto) {
    return this.devices.create(dto);
  }

  @Patch(':id')
  @UseGuards(DeviceWriteGuard)
  @ResponseMessage('Đã cập nhật thiết bị')
  update(@DeviceId() id: number, @Body() dto: UpdateDeviceDto) {
    return this.devices.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(DeviceWriteGuard)
  @ResponseMessage('Đã xoá thiết bị')
  remove(@DeviceId() id: number) {
    return this.devices.softDelete(id);
  }
}

/** Danh mục loại thiết bị — mọi user đã đăng nhập đều đọc được. */
@Controller('device-types')
@UseGuards(AuthGuard)
export class DeviceTypesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  list() {
    return this.devices.deviceTypes();
  }
}
```

- [ ] **Step 6: `devices.module.ts` và đăng ký vào `app.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { DeviceTypesController, DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  controllers: [DevicesController, DeviceTypesController],
  providers: [DevicesService],
})
export class DevicesModule {}
```

Trong `backend/src/app.module.ts`, thêm `DevicesModule` vào mảng `imports` (giữ nguyên các module khác) và thêm dòng import tương ứng ở đầu file.

- [ ] **Step 7: Mở rộng `fake-prisma.ts`**

Thêm vào `createFakePrisma()`, cạnh các model sẵn có. Đặt mảng dữ liệu và các phương thức, rồi thêm `devices`, `deviceTypes`, `deviceAccessories`, `device`, `deviceType`, `deviceAccessory` vào object `prisma` trả về.

```ts
  const deviceTypes = [
    { id: 1, typeName: 'Laptop', prefix: 'LT' },
    { id: 2, typeName: 'Máy tính để bàn', prefix: 'PC' },
  ];
  const devices: any[] = [];
  const deviceAccessories: any[] = [];

  const withDeviceRelations = (d: any, include?: Record<string, boolean>) =>
    include
      ? {
          ...d,
          ...(include.deviceType && {
            deviceType: deviceTypes.find((t) => t.id === d.deviceTypeId)!,
          }),
          ...(include.department && {
            department: departments.find((x) => x.id === d.departmentId) ?? null,
          }),
          ...(include.currentUser && {
            currentUser: users.find((u) => u.id === d.currentUserId) ?? null,
          }),
          ...(include.accessories && {
            accessories: deviceAccessories.filter((a) => a.deviceId === d.id),
          }),
        }
      : d;
```

và trong object `prisma`:

```ts
    devices,
    deviceTypes,
    deviceAccessories,
    deviceType: {
      findMany: jest.fn(async () => [...deviceTypes]),
      findUnique: jest.fn(async ({ where }: { where: Where }) =>
        deviceTypes.find((t) => matches(t, where)) ?? null,
      ),
    },
    device: {
      findMany: jest.fn(
        async ({ where, include }: { where: Where; include?: Record<string, boolean> }) =>
          devices
            .filter((d) => matches(d, where))
            .sort((a, b) => a.id - b.id)
            .map((d) => withDeviceRelations(d, include)),
      ),
      findUnique: jest.fn(
        async ({ where, include }: { where: Where; include?: Record<string, boolean> }) => {
          const hit = devices.find((d) => matches(d, where));
          return hit ? withDeviceRelations(hit, include) : null;
        },
      ),
      create: jest.fn(
        async ({ data, include }: { data: any; include?: Record<string, boolean> }) => {
          const { accessories, ...rest } = data;
          const row = { id: devices.length + 1, ...rest };
          devices.push(row);
          for (const a of accessories?.create ?? []) {
            deviceAccessories.push({
              id: deviceAccessories.length + 1,
              deviceId: row.id,
              ...a,
            });
          }
          return withDeviceRelations(row, include);
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
          include,
        }: { where: Where; data: any; include?: Record<string, boolean> }) => {
          const row = devices.find((d) => matches(d, where))!;
          const { accessories, ...rest } = data;
          for (const [k, v] of Object.entries(rest)) {
            if (v !== undefined) row[k] = v;
          }
          if (accessories) {
            for (let i = deviceAccessories.length - 1; i >= 0; i--) {
              if (deviceAccessories[i].deviceId === row.id) deviceAccessories.splice(i, 1);
            }
            for (const a of accessories.create ?? []) {
              deviceAccessories.push({
                id: deviceAccessories.length + 1,
                deviceId: row.id,
                ...a,
              });
            }
          }
          return withDeviceRelations(row, include);
        },
      ),
      delete: jest.fn(forbidden),
      deleteMany: jest.fn(forbidden),
    },
```

Cập nhật comment đầu file để nói rằng fake giờ phủ cả `device` / `deviceType`.

- [ ] **Step 8: Viết `devices.spec.ts` — chạy trước khi có implementation là không được, nên viết ngay sau, rồi chạy**

Dựng harness giống `users.spec.ts` (copy phần `beforeAll` / `beforeEach` / `addUser` / `tokenOf` từ đó, đổi tên describe). Thêm một helper tạo thiết bị và **đủ 12 ca bắt buộc** dưới đây:

```ts
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
      .post('/devices').set('Authorization', tokenOf(admin))
      .send(newDevice()).expect(201);
    expect(res.body.data.deviceCode).toBe('LT-000001');
    expect(res.body.data.status).toBe('Trong kho');
    expect(res.body.message).toBe('Đã tạo thiết bị');
  });

  it('đặt trạng thái "Đã cấp phát" khi có người sở hữu', async () => {
    const res = await http()
      .post('/devices').set('Authorization', tokenOf(admin))
      .send(newDevice({ currentUserId: staff.id })).expect(201);
    expect(res.body.data.status).toBe('Đã cấp phát');
  });

  it('chặn mã thiết bị trùng', async () => {
    await http().post('/devices').set('Authorization', tokenOf(admin))
      .send(newDevice()).expect(201);
    const res = await http().post('/devices').set('Authorization', tokenOf(admin))
      .send(newDevice()).expect(409);
    expect(res.body.message).toBe('Mã thiết bị đã tồn tại');
  });

  it('chặn số serial trùng', async () => {
    await http().post('/devices').set('Authorization', tokenOf(admin))
      .send(newDevice({ serialNumber: 'SN-1' })).expect(201);
    const res = await http().post('/devices').set('Authorization', tokenOf(admin))
      .send(newDevice({ deviceCode: 'LT-000002', serialNumber: 'SN-1' })).expect(409);
    expect(res.body.message).toBe('Số serial đã tồn tại');
  });

  it('chặn mã sai định dạng', async () => {
    const res = await http().post('/devices').set('Authorization', tokenOf(admin))
      .send(newDevice({ deviceCode: 'LT-1' })).expect(400);
    expect(res.body.message).toContain('Mã thiết bị phải có dạng PC-000123');
  });

  it('chặn mã có tiền tố không khớp loại thiết bị', async () => {
    const res = await http().post('/devices').set('Authorization', tokenOf(admin))
      .send(newDevice({ deviceCode: 'PC-000001', deviceTypeId: 1 })).expect(400);
    expect(res.body.message).toBe(
      'Mã thiết bị phải bắt đầu bằng "LT" theo loại thiết bị đã chọn',
    );
  });

  it('chặn loại thiết bị không tồn tại', async () => {
    const res = await http().post('/devices').set('Authorization', tokenOf(admin))
      .send(newDevice({ deviceTypeId: 99 })).expect(400);
    expect(res.body.message).toBe('Loại thiết bị không tồn tại');
  });

  it('xoá mềm: không xoá row, thiết bị biến khỏi danh sách', async () => {
    const created = await http().post('/devices').set('Authorization', tokenOf(admin))
      .send(newDevice()).expect(201);
    const id = created.body.data.id;
    await http().delete(`/devices/${id}`).set('Authorization', tokenOf(admin)).expect(200);
    expect(prisma.device.delete).not.toHaveBeenCalled();
    expect(prisma.devices.find((d) => d.id === id)!.status).toBe('Đã xóa');
    const list = await http().get('/devices').set('Authorization', tokenOf(admin)).expect(200);
    expect(list.body.data.some((d: { id: number }) => d.id === id)).toBe(false);
  });

  it('thao tác trên thiết bị đã xoá trả 404', async () => {
    const created = await http().post('/devices').set('Authorization', tokenOf(admin))
      .send(newDevice()).expect(201);
    const id = created.body.data.id;
    await http().delete(`/devices/${id}`).set('Authorization', tokenOf(admin)).expect(200);
    const res = await http().delete(`/devices/${id}`)
      .set('Authorization', tokenOf(admin)).expect(404);
    expect(res.body.message).toBe('Thiết bị không tồn tại');
  });

  it('id vượt phạm vi int32 trả 404 chứ không phải 500', async () => {
    await http().get('/devices/9999999999')
      .set('Authorization', tokenOf(admin)).expect(404);
  });

  it('Nhân viên không được tạo thiết bị', async () => {
    const res = await http().post('/devices').set('Authorization', tokenOf(staff))
      .send(newDevice()).expect(403);
    expect(res.body.message).toBe('Bạn không có quyền thực hiện thao tác này');
  });

  it('Trưởng phòng Kế toán không được tạo, Trưởng phòng Kỹ thuật thì được', async () => {
    const ketoan = addUser('tpketoan', 2);
    ketoan.departmentId = 2;
    await http().post('/devices').set('Authorization', tokenOf(ketoan))
      .send(newDevice()).expect(403);

    const kythuat = addUser('tpkythuat', 2); // addUser đặt departmentId = 1 (KYTHUAT)
    await http().post('/devices').set('Authorization', tokenOf(kythuat))
      .send(newDevice({ deviceCode: 'LT-000009' })).expect(201);
  });

  it('Nhân viên vẫn đọc được danh sách và danh mục loại thiết bị', async () => {
    await http().get('/devices').set('Authorization', tokenOf(staff)).expect(200);
    const types = await http().get('/device-types')
      .set('Authorization', tokenOf(staff)).expect(200);
    expect(types.body.data.length).toBeGreaterThanOrEqual(2);
  });
```

- [ ] **Step 9: Chạy test của module mới**

```bash
npx -y pnpm@10 test -- devices.spec.ts
```

Mong đợi: **13 passed**. Nếu có ca hỏng, sửa implementation — **không** sửa test cho vừa kết quả, trừ khi test sai rõ ràng so với spec.

- [ ] **Step 10: Chạy toàn bộ + build + lint**

```bash
npx -y pnpm@10 test && npx -y pnpm@10 run build && npx -y pnpm@10 run lint
```

Mong đợi: **63 passed** (50 sau Task 2 + 13 mới), 3 suite; build và lint sạch.

- [ ] **Step 11: Commit**

```bash
git add backend/src/modules/devices backend/src/shared/auth/device-write.guard.ts backend/src/test/fake-prisma.ts backend/src/app.module.ts
git commit -m "feat(devices): API quản lý thiết bị

Danh sách + lọc, tạo, sửa, xoá mềm và danh mục loại thiết bị. Quyền ghi giới hạn
cho Quản trị viên và Trưởng phòng Kỹ thuật qua DeviceWriteGuard. Mã thiết bị phải
đúng dạng PC-000123 và khớp tiền tố của loại đã chọn.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Script E2E thiết bị trên PostgreSQL thật

**Files:**
- Create: `backend/scripts/e2e-devices.ps1`
- Modify: `backend/README.md`

**Interfaces:**
- Consumes: các route Task 3; seed `DeviceType` Task 1; tài khoản `admin` / `Admin@123`.
- Produces: script chạy bằng `powershell -ExecutionPolicy Bypass -File scripts/e2e-devices.ps1`, exit 0 khi mọi bước xanh.

Đọc `backend/scripts/e2e-users.ps1` trước và **dùng lại nguyên các hàm trợ giúp** `Ok` / `Fail` / `Step` / `Api` / `ExpectStatus` / `Psql` của nó. Bốn điều đã học được từ script đó, bắt buộc giữ:

1. File phải lưu **UTF-8 CÓ BOM**, nếu không PowerShell 5.1 đọc sai chuỗi tiếng Việt.
2. SQL đưa vào psql **qua stdin**, không qua tham số `-c` — PS 5.1 nuốt mất dấu nháy kép của tên cột PascalCase.
3. Mã thiết bị mang **timestamp** để chạy lại nhiều lần không trùng.
4. **Không bao giờ** xoá cứng row.

- [ ] **Step 1: Viết script**

Bám khuôn `e2e-users.ps1`, các bước phải có:

| Bước | Kiểm điều gì | Mong đợi |
|---|---|---|
| 0 | backend sống | `GET /device-types` không token → 401 |
| 1 | đăng nhập admin | có `accessToken`, `data.user.departmentCode` tồn tại (kể cả `null`) |
| 2 | `GET /device-types` | ≥ 4 loại, mỗi loại có `prefix` |
| 3 | tạo thiết bị `LT-<6 số cuối của timestamp>` | 201, `status = "Trong kho"` |
| 4 | tìm kiếm bằng **chữ HOA** mã vừa tạo | tìm ra — chứng minh `mode: insensitive` chạy thật |
| 5 | danh sách sắp xếp `id` tăng dần | đúng thứ tự |
| 6 | tạo với tiền tố sai (`PC-…` + `deviceTypeId` của Laptop) | 400, message chứa `phải bắt đầu bằng "LT"` |
| 7 | tạo trùng mã | 409 `Mã thiết bị đã tồn tại` |
| 8 | `PATCH` đổi `status` sang `"Chờ thanh lý"` | 200, đọc lại thấy đúng |
| 9 | `PATCH` gửi `status: "Đã xóa"` | 400 `Trạng thái không hợp lệ` |
| 10 | tạo user `Nhân viên` tạm rồi đăng nhập, gọi `POST /devices` | 403 |
| 11 | `DELETE` thiết bị | 200, biến khỏi `GET /devices` |
| 12 | psql kiểm row | vẫn tồn tại, `Status = 'Đã xóa'` |
| 13 | `DELETE /devices/9999999999` | 404 |

Kết thúc: in `TẤT CẢ BƯỚC E2E THIẾT BỊ ĐỀU XANH` và `exit 0`, hoặc đếm số bước hỏng và `exit 1`.

Câu psql cho bước 12 (lưu ý đưa qua stdin):

```powershell
$status = Psql "SELECT ""Status"" FROM ""Device"" WHERE ""DeviceCode"" = '$code';"
if ($status -eq 'Đã xóa') { Ok "DB: row $code vẫn tồn tại, Status='Đã xóa'" }
elseif ([string]::IsNullOrWhiteSpace($status)) { Fail "DB: row $code đã bị xoá cứng" }
else { Fail "DB: Status='$status', mong 'Đã xóa'" }
```

- [ ] **Step 2: Khởi động backend**

Cửa sổ riêng, trong `backend/`:

```bash
npx -y pnpm@10 start:dev
```

Chờ `Nest application successfully started`.

- [ ] **Step 3: Chạy script**

```bash
powershell -ExecutionPolicy Bypass -File scripts/e2e-devices.ps1
```

Mong đợi: mọi bước `OK`, exit 0. Có bước `FAIL` → điều tra lỗi thật ở backend, **không** sửa script cho vừa kết quả.

- [ ] **Step 4: Chạy lại script người dùng để chắc `AuthGuard` không vỡ**

```bash
powershell -ExecutionPolicy Bypass -File scripts/e2e-users.ps1
```

Mong đợi: vẫn **11/11 xanh**. Đây là bằng chứng quan trọng nhất rằng thay đổi ở Task 2 không phá luồng khoá tài khoản.

- [ ] **Step 5: Ghi vào `backend/README.md`**

Trong mục "Kiểm thử đầu-cuối (E2E) trên PostgreSQL thật" đã có, thêm dòng nhắc chạy thêm script thiết bị, cạnh lệnh chạy script người dùng. Giữ nguyên phần nội dung cũ.

- [ ] **Step 6: Commit**

```bash
git add backend/scripts/e2e-devices.ps1 backend/README.md
git commit -m "test: script E2E thiết bị trên PostgreSQL thật

Kiểm tiền tố mã, tìm kiếm không phân biệt hoa thường, phân quyền ghi, và xoá mềm
giữ nguyên row — những thứ fake Prisma trong unit test không mô phỏng được.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Frontend — tầng domain, application, infrastructure

**Files:**
- Modify: `frontend/src/modules/device/domain/device.ts`
- Create: `frontend/src/modules/device/domain/deviceDraft.ts`
- Create: `frontend/src/modules/device/domain/deviceDraft.test.ts`
- Delete: `frontend/src/modules/device/domain/assetDraft.ts`, `assetDraft.test.ts`
- Modify: `frontend/src/modules/device/application/DeviceRepository.ts`
- Create: `frontend/src/modules/device/infrastructure/HttpDeviceRepository.ts`
- Create: `frontend/src/modules/device/infrastructure/HttpDeviceRepository.test.ts`
- Modify: `frontend/src/modules/device/infrastructure/container.ts`
- Delete: `frontend/src/modules/device/infrastructure/InMemoryDeviceRepository.ts`, `InMemoryDeviceRepository.test.ts`

**Interfaces:**
- Consumes: `apiGet`/`apiPost`/`apiPatch`/`apiDelete` từ `@/shared/lib/apiClient`; các route Task 3.
- Produces: `DeviceDraft`, `emptyDeviceDraft()`, `validateDeviceDraft(d): DeviceDraftErrors`, `Device`, `DEVICE_STATUS`, `deviceService` (`list` / `get` / `create` / `update` / `remove` / `lookups`) — Task 6 dùng đúng các tên này.

Đọc `frontend/src/modules/user/infrastructure/HttpUserAdminRepository.ts` trước; file mới bám đúng khuôn đó (bóc `.data`, đọc lỗi từ `.message`).

- [ ] **Step 1: Viết test thất bại cho `validateDeviceDraft`**

`frontend/src/modules/device/domain/deviceDraft.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { emptyDeviceDraft, validateDeviceDraft } from './deviceDraft';

describe('validateDeviceDraft', () => {
  it('báo đủ trường bắt buộc trên draft rỗng', () => {
    const errors = validateDeviceDraft(emptyDeviceDraft());
    expect(Object.keys(errors).sort()).toEqual(
      ['deviceCode', 'deviceName', 'deviceTypeId', 'specDetail', 'unit'].sort(),
    );
  });

  it('bắt mã sai định dạng', () => {
    const d = { ...emptyDeviceDraft(), deviceCode: 'LT-1' };
    expect(validateDeviceDraft(d).deviceCode).toBe('Mã thiết bị phải có dạng PC-000123');
  });

  it('chấp nhận mã đúng định dạng', () => {
    const d = {
      ...emptyDeviceDraft(),
      deviceCode: 'PC-000123',
      deviceName: 'Máy bàn HP',
      specDetail: 'i5 · 8GB',
      unit: 'Cái',
      deviceTypeId: 2,
    };
    expect(validateDeviceDraft(d)).toEqual({});
  });
});
```

- [ ] **Step 2: Chạy để xác nhận hỏng**

```bash
npm test -- deviceDraft
```

Mong đợi: FAIL — không tìm thấy module `./deviceDraft`.

- [ ] **Step 3: Viết `deviceDraft.ts`**

```ts
export interface DeviceAccessoryDraft {
  accessoryCode: string;
  accessoryName: string;
  accessoryType: string;
  unit: string;
}

export interface DeviceDraft {
  deviceCode: string;
  deviceName: string;
  serialNumber: string;
  specDetail: string;
  unit: string;
  deviceTypeId: number | null;
  location: string;
  purchaseDate: string;
  supplier: string;
  warrantyMonths: string;
  warrantyCondition: string;
  warrantyExpiresOn: string;
  departmentId: number | null;
  currentUserId: number | null;
  allocated: boolean;
  allocatedOn: string;
  accessories: DeviceAccessoryDraft[];
}

export function emptyDeviceDraft(): DeviceDraft {
  return {
    deviceCode: '',
    deviceName: '',
    serialNumber: '',
    specDetail: '',
    unit: 'Cái',
    deviceTypeId: null,
    location: '',
    purchaseDate: '',
    supplier: '',
    warrantyMonths: '',
    warrantyCondition: '',
    warrantyExpiresOn: '',
    departmentId: null,
    currentUserId: null,
    allocated: false,
    allocatedOn: '',
    accessories: [],
  };
}

export type DeviceDraftErrors = Partial<Record<keyof DeviceDraft, string>>;

const REQUIRED = 'Bắt buộc';
/** Giữ khớp 1:1 với DEVICE_CODE_PATTERN ở backend/src/modules/devices/device-status.ts. */
export const DEVICE_CODE_PATTERN = /^[A-Z]{2,4}-\d{6}$/;
export const DEVICE_CODE_MESSAGE = 'Mã thiết bị phải có dạng PC-000123';

export function validateDeviceDraft(d: DeviceDraft): DeviceDraftErrors {
  const errors: DeviceDraftErrors = {};
  if (!d.deviceCode.trim()) errors.deviceCode = REQUIRED;
  else if (!DEVICE_CODE_PATTERN.test(d.deviceCode.trim())) {
    errors.deviceCode = DEVICE_CODE_MESSAGE;
  }
  if (!d.deviceName.trim()) errors.deviceName = REQUIRED;
  if (!d.specDetail.trim()) errors.specDetail = REQUIRED;
  if (!d.unit.trim()) errors.unit = REQUIRED;
  if (d.deviceTypeId === null) errors.deviceTypeId = REQUIRED;
  if (d.allocated && d.currentUserId === null) errors.currentUserId = REQUIRED;
  return errors;
}

export function hasErrors(errors: DeviceDraftErrors): boolean {
  return Object.keys(errors).length > 0;
}
```

- [ ] **Step 4: Chạy lại, phải xanh**

```bash
npm test -- deviceDraft
```

Mong đợi: 3 passed.

- [ ] **Step 5: Viết lại `domain/device.ts`**

```ts
/** Trạng thái thiết bị — chuỗi tiếng Việt y hệt giá trị backend lưu trong DB. */
export const DEVICE_STATUS = {
  IN_STOCK: 'Trong kho',
  ALLOCATED: 'Đã cấp phát',
  PENDING_DISPOSAL: 'Chờ thanh lý',
  DELETED: 'Đã xóa',
} as const;

export type DeviceStatus = (typeof DEVICE_STATUS)[keyof typeof DEVICE_STATUS];

/** 3 trạng thái hiện trong bộ lọc — "Đã xóa" không bao giờ hiện cho người dùng. */
export const DEVICE_STATUS_OPTIONS: DeviceStatus[] = [
  DEVICE_STATUS.IN_STOCK,
  DEVICE_STATUS.ALLOCATED,
  DEVICE_STATUS.PENDING_DISPOSAL,
];

export interface DeviceTypeRef { id: number; typeName: string; prefix: string }
export interface DepartmentRef { id: number; departmentCode: string; departmentName: string }
export interface UserRef { id: number; fullName: string; username: string }

export interface Device {
  id: number;
  deviceCode: string;
  deviceName: string;
  serialNumber: string | null;
  specDetail: string;
  unit: string;
  status: DeviceStatus;
  allocatedOn: string | null;
  location: string | null;
  purchaseDate: string | null;
  supplier: string | null;
  warrantyMonths: number | null;
  warrantyCondition: string | null;
  warrantyExpiresOn: string | null;
  deviceType: DeviceTypeRef;
  department: DepartmentRef | null;
  currentUser: UserRef | null;
  accessories: {
    id: number;
    accessoryCode: string;
    accessoryName: string;
    accessoryType: string;
    unit: string;
  }[];
}
```

Xoá `frontend/src/modules/device/presentation/statusTone.ts` nếu nó ánh xạ từ mã cũ, hoặc sửa nó nhận `DeviceStatus` mới — kiểm bằng cách mở file và xem nó đang khoá theo giá trị nào.

- [ ] **Step 6: Viết lại `application/DeviceRepository.ts`**

```ts
import { hasErrors, validateDeviceDraft, type DeviceDraft } from '../domain/deviceDraft';
import type { Device, DeviceStatus, DeviceTypeRef } from '../domain/device';

export interface DeviceQuery {
  search?: string;
  status?: DeviceStatus;
  deviceTypeId?: number;
  departmentId?: number;
}

export interface DeviceRepository {
  list(query?: DeviceQuery): Promise<Device[]>;
  getById(id: number): Promise<Device>;
  create(draft: DeviceDraft): Promise<Device>;
  update(id: number, draft: DeviceDraft): Promise<Device>;
  remove(id: number): Promise<void>;
  deviceTypes(): Promise<DeviceTypeRef[]>;
}

export class DeviceValidationError extends Error {
  constructor(public readonly fields: Record<string, string>) {
    super('Biểu mẫu chưa hợp lệ');
    this.name = 'DeviceValidationError';
  }
}

function assertValid(draft: DeviceDraft) {
  const errors = validateDeviceDraft(draft);
  if (hasErrors(errors)) throw new DeviceValidationError(errors as Record<string, string>);
}

export function makeDeviceService(repo: DeviceRepository) {
  return {
    list: (query?: DeviceQuery) => repo.list(query),
    get: (id: number) => repo.getById(id),
    create: (draft: DeviceDraft) => {
      assertValid(draft);
      return repo.create(draft);
    },
    update: (id: number, draft: DeviceDraft) => {
      assertValid(draft);
      return repo.update(id, draft);
    },
    remove: (id: number) => repo.remove(id),
    deviceTypes: () => repo.deviceTypes(),
  };
}

export type DeviceService = ReturnType<typeof makeDeviceService>;
```

- [ ] **Step 7: Viết `HttpDeviceRepository.ts`**

```ts
import { apiDelete, apiGet, apiPatch, apiPost } from '@/shared/lib/apiClient';
import type { Device, DeviceTypeRef } from '../domain/device';
import type { DeviceDraft } from '../domain/deviceDraft';
import type { DeviceQuery, DeviceRepository } from '../application/DeviceRepository';

/** Draft (dạng form, chuỗi rỗng = chưa nhập) → body API (bỏ hẳn trường rỗng). */
function toBody(d: DeviceDraft) {
  const text = (v: string) => (v.trim() ? v.trim() : undefined);
  return {
    deviceCode: d.deviceCode.trim().toUpperCase(),
    deviceName: d.deviceName.trim(),
    specDetail: d.specDetail.trim(),
    unit: d.unit.trim(),
    deviceTypeId: d.deviceTypeId ?? undefined,
    serialNumber: text(d.serialNumber),
    location: text(d.location),
    purchaseDate: text(d.purchaseDate),
    supplier: text(d.supplier),
    warrantyMonths: d.warrantyMonths.trim() ? Number(d.warrantyMonths) : undefined,
    warrantyCondition: text(d.warrantyCondition),
    warrantyExpiresOn: text(d.warrantyExpiresOn),
    departmentId: d.departmentId ?? undefined,
    currentUserId: d.allocated ? (d.currentUserId ?? undefined) : undefined,
    allocatedOn: d.allocated ? text(d.allocatedOn) : undefined,
    accessories: d.accessories,
  };
}

export class HttpDeviceRepository implements DeviceRepository {
  list(query: DeviceQuery = {}): Promise<Device[]> {
    return apiGet<Device[]>('/devices', query as Record<string, unknown>);
  }
  getById(id: number): Promise<Device> {
    return apiGet<Device>(`/devices/${id}`);
  }
  create(draft: DeviceDraft): Promise<Device> {
    return apiPost<Device>('/devices', toBody(draft));
  }
  update(id: number, draft: DeviceDraft): Promise<Device> {
    return apiPatch<Device>(`/devices/${id}`, toBody(draft));
  }
  async remove(id: number): Promise<void> {
    await apiDelete(`/devices/${id}`);
  }
  deviceTypes(): Promise<DeviceTypeRef[]> {
    return apiGet<DeviceTypeRef[]>('/device-types');
  }
}
```

**Trước khi viết**, mở `frontend/src/shared/lib/apiClient.ts` và khớp đúng chữ ký thật của `apiGet`/`apiPost`/`apiPatch`/`apiDelete` (thứ tự tham số, cách truyền query). Nếu khác với trên, sửa theo file thật — `apiClient.ts` là nguồn đúng.

- [ ] **Step 8: Viết test cho `HttpDeviceRepository`**

`HttpDeviceRepository.test.ts` — bám đúng khuôn `frontend/src/modules/user/infrastructure/HttpUserAdminRepository.test.ts` (dùng `vi.stubGlobal('fetch', ...)` với `mockImplementation` trả `Response` **mới mỗi lần gọi**; dùng lại `Response` cũ sẽ lỗi "body already read").

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyDeviceDraft, type DeviceDraft } from '../domain/deviceDraft';
import { HttpDeviceRepository } from './HttpDeviceRepository';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, error: null, message: 'OK' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

/** Body JSON mà fetch đã nhận ở lần gọi gần nhất. */
const sentBody = (fetchMock: ReturnType<typeof vi.fn>) =>
  JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);

describe('HttpDeviceRepository', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  const draft = (over: Partial<DeviceDraft> = {}): DeviceDraft => ({
    ...emptyDeviceDraft(),
    deviceCode: 'lt-000001',
    deviceName: 'Dell Latitude 5420',
    specDetail: 'i5 · 16GB',
    unit: 'Cái',
    deviceTypeId: 1,
    ...over,
  });

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation(async () => envelope({ id: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
  });

  it('gửi mã thiết bị dạng chữ hoa', async () => {
    await new HttpDeviceRepository().create(draft());
    expect(sentBody(fetchMock).deviceCode).toBe('LT-000001');
  });

  it('bỏ các trường rỗng khỏi body', async () => {
    await new HttpDeviceRepository().create(draft({ serialNumber: '   ' }));
    expect(sentBody(fetchMock)).not.toHaveProperty('serialNumber');
  });

  it('không gửi currentUserId khi chưa tick "đã cấp phát"', async () => {
    await new HttpDeviceRepository().create(
      draft({ allocated: false, currentUserId: 7, allocatedOn: '2026-09-22' }),
    );
    const body = sentBody(fetchMock);
    expect(body).not.toHaveProperty('currentUserId');
    expect(body).not.toHaveProperty('allocatedOn');
  });

  it('gửi currentUserId khi đã tick "đã cấp phát"', async () => {
    await new HttpDeviceRepository().create(draft({ allocated: true, currentUserId: 7 }));
    expect(sentBody(fetchMock).currentUserId).toBe(7);
  });
});
```

Lưu ý: `toBody` dùng `undefined` cho trường rỗng, và `JSON.stringify` **bỏ hẳn** key có giá trị `undefined` — đó là lý do hai ca trên khẳng định bằng `not.toHaveProperty` chứ không phải `toBeUndefined`.

- [ ] **Step 9: Đổi `container.ts`**

```ts
import { makeDeviceService } from '../application/DeviceRepository';
import { HttpDeviceRepository } from './HttpDeviceRepository';

export const deviceService = makeDeviceService(new HttpDeviceRepository());
```

- [ ] **Step 10: Xoá file mock và file draft cũ**

```bash
git rm frontend/src/modules/device/infrastructure/InMemoryDeviceRepository.ts \
       frontend/src/modules/device/infrastructure/InMemoryDeviceRepository.test.ts \
       frontend/src/modules/device/domain/assetDraft.ts \
       frontend/src/modules/device/domain/assetDraft.test.ts
```

Lúc này `tsc` sẽ báo lỗi ở `presentation/` — đó là đúng dự kiến, Task 6 sửa. **Không** commit khi đang vỡ: làm Step 11 trước.

- [ ] **Step 11: Chạy test của tầng vừa viết**

```bash
npm test -- deviceDraft HttpDeviceRepository
```

Mong đợi: tất cả xanh. (`npm run build` sẽ còn hỏng vì `presentation/` chưa sửa — bình thường ở bước này.)

- [ ] **Step 12: Commit**

```bash
git add frontend/src/modules/device/domain frontend/src/modules/device/application frontend/src/modules/device/infrastructure
git commit -m "feat(device): tầng domain và HTTP repository cho thiết bị

Thay mock in-memory bằng HttpDeviceRepository gọi API thật. validateDeviceDraft
kiểm định dạng mã PC-000123 ngay ở domain, dùng chung cho trang tạo và trang sửa.
Trạng thái đổi sang chuỗi tiếng Việt khớp giá trị backend lưu.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Frontend — màn hình, router và phiên đăng nhập

**Files:**
- Modify: `frontend/src/modules/device/presentation/DeviceCatalogPage.tsx`
- Modify: `frontend/src/modules/device/presentation/AssetFormPage.tsx`
- Modify: `frontend/src/modules/device/presentation/form/AssetGeneralInfoFields.tsx`
- Modify: `frontend/src/modules/device/presentation/form/ComponentsTable.tsx`
- Modify: `frontend/src/modules/device/presentation/form/useAssetDraft.ts` → đổi tên thành `useDeviceDraft.ts`
- Modify: `frontend/src/modules/device/presentation/useDevices.ts`
- Delete: `frontend/src/modules/device/presentation/AllocateRecoverPage.tsx`
- Modify: `frontend/src/modules/auth/domain/session.ts`
- Modify: `frontend/src/modules/auth/infrastructure/HttpAuthRepository.ts` (ánh xạ `departmentCode`)
- Modify: `frontend/src/app/router.tsx`
- Test: `frontend/src/modules/auth/domain/session.test.ts` và test trang

**Interfaces:**
- Consumes: `deviceService` (Task 5), `departmentCode` trong response login (Task 2).
- Produces: route `/devices`, `/devices/new`, `/devices/:id/edit`; `canWriteDevices(session)` xuất từ `session.ts`.

- [ ] **Step 1: Thêm quyền ghi vào `session.ts`**

```ts
export const ADMIN_ROLE = 'Quản trị viên';
export const HEAD_ROLE = 'Trưởng phòng';
export const TECH_DEPARTMENT_CODE = 'KYTHUAT';
```

Thêm `departmentCode: string | null;` vào interface `AuthSession`, và hàm:

```ts
/** Ghi thiết bị: Quản trị viên, hoặc Trưởng phòng Kỹ thuật. Backend mới là chốt chặn thật. */
export const canWriteDevices = (session: AuthSession | null): boolean =>
  session?.roleName === ADMIN_ROLE ||
  (session?.roleName === HEAD_ROLE && session?.departmentCode === TECH_DEPARTMENT_CODE);
```

Thêm test vào `session.test.ts`:

```ts
const base = { userId: '1', displayName: 'A', email: 'a@b.c', token: 't' };
it('cho phép Quản trị viên ghi thiết bị', () => {
  expect(canWriteDevices({ ...base, roleName: 'Quản trị viên', departmentCode: null })).toBe(true);
});
it('cho phép Trưởng phòng Kỹ thuật ghi thiết bị', () => {
  expect(canWriteDevices({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KYTHUAT' })).toBe(true);
});
it('chặn Trưởng phòng Kế toán', () => {
  expect(canWriteDevices({ ...base, roleName: 'Trưởng phòng', departmentCode: 'KETOAN' })).toBe(false);
});
it('chặn Nhân viên', () => {
  expect(canWriteDevices({ ...base, roleName: 'Nhân viên', departmentCode: 'KYTHUAT' })).toBe(false);
});
```

Trong `HttpAuthRepository.ts`, thêm `departmentCode: res.user.departmentCode ?? null` vào chỗ dựng `AuthSession`.

- [ ] **Step 2: Chạy test session**

```bash
npm test -- session
```

Mong đợi: các ca cũ + 4 ca mới đều xanh.

- [ ] **Step 3: Đổi tên và sửa hook draft**

```bash
git mv frontend/src/modules/device/presentation/form/useAssetDraft.ts \
       frontend/src/modules/device/presentation/form/useDeviceDraft.ts
```

Trong file: đổi `useAssetDraft` → `useDeviceDraft`, `AssetDraft` → `DeviceDraft`, `emptyAssetDraft` → `emptyDeviceDraft`, `validateAssetDraft` → `validateDeviceDraft`. Thêm tham số khởi tạo để trang sửa đổ được dữ liệu sẵn:

```ts
export function useDeviceDraft(initial?: DeviceDraft) {
  const [draft, setDraft] = useState<DeviceDraft>(initial ?? emptyDeviceDraft());
  // phần còn lại giữ nguyên logic cũ (patch, errors, validate)
}
```

- [ ] **Step 4: Sửa các trường trên form**

Trong `AssetGeneralInfoFields.tsx`:
- **Bỏ** các ô: `Số biên bản`, `Đối tượng sử dụng` (radio), `Vị trí công việc`.
- **Thêm** 3 ô: `Số serial` (text, không bắt buộc), `Loại thiết bị` (select, bắt buộc, nạp từ `deviceService.deviceTypes()`), `Đơn vị tính` (text, bắt buộc, mặc định `"Cái"`).
- Đổi `Đơn vị quản lý` và `Người sở hữu` từ select hằng số sang select nạp từ `GET /departments` và `GET /users` (dùng lại hook `useUserLookups` sẵn có ở `frontend/src/modules/user/presentation/useUserLookups.ts` nếu chữ ký phù hợp; nếu không, viết hook tương tự trong module device).
- Bỏ hằng số `UNITS`, `SUPPLIERS`, `SPECS`, `OWNERS` đang hardcode trong file.

Trong `ComponentsTable.tsx`: đổi kiểu dòng từ `DeviceComponent` sang `DeviceAccessoryDraft` (`accessoryCode` / `accessoryName` / `accessoryType` / `unit`). Giữ nguyên giao diện bảng.

- [ ] **Step 5: `AssetFormPage.tsx` phục vụ cả tạo và sửa**

Đọc `id` từ `useParams()`. Không có `id` → chế độ tạo (`deviceService.create`); có `id` → nạp `deviceService.get(Number(id))`, map `Device` → `DeviceDraft`, và lưu bằng `deviceService.update(Number(id), draft)`. Tiêu đề và breadcrumb đổi theo chế độ (`Thêm thiết bị` / `Sửa thiết bị`). Lưu xong điều hướng về `/devices`.

- [ ] **Step 6: `DeviceCatalogPage.tsx`**

- Bỏ mọi tham chiếu tới mã trạng thái cũ (`IN_STOCK`…), dùng `DEVICE_STATUS` mới.
- Bộ lọc trạng thái liệt kê `DEVICE_STATUS_OPTIONS` cộng lựa chọn "Tất cả".
- Nút **👁** (hiện không có handler) → `navigate(`/devices/${d.id}/edit`)`.
- Nút **⋮** → xoá mềm: `window.confirm(`Xoá thiết bị ${d.deviceCode}?`)` rồi `deviceService.remove(d.id)` và nạp lại danh sách — bám đúng cách `UserListPage.tsx` đang làm.
- Nút **Thêm thiết bị** và 2 nút thao tác trên mỗi dòng chỉ hiện khi `canWriteDevices(session)`.

- [ ] **Step 7: Router và xoá màn cấp phát giả**

Trong `frontend/src/app/router.tsx`:

```tsx
  { path: '/devices', element: <DeviceCatalogPage /> },
  { path: '/devices/new', element: <AssetFormPage /> },
  { path: '/devices/:id/edit', element: <AssetFormPage /> },
  { path: '/allocation', element: <ComingSoonPage title="Cấp phát - Thu hồi" /> },
```

```bash
git rm frontend/src/modules/device/presentation/AllocateRecoverPage.tsx
```

Lý do xoá: màn này chỉ là bản sao rút gọn của form thêm tài sản, lưu xong ra danh mục thiết bị chứ không cấp phát gì — `docs/CONTEXT.md` đã ghi nhận. Luồng cấp phát thật là một vòng riêng, Figma đã có 4 frame cho nó.

- [ ] **Step 8: Chạy toàn bộ kiểm thử frontend**

Chạy từ **gốc repo** (script root alias sang `-w frontend`):

```bash
npm test
npm run build
```

`npm run build` chạy `tsc` rồi `vite build`, nên nó là bài kiểm kiểu dữ liệu luôn — không cần gọi `tsc` riêng.

Mong đợi: vitest xanh (số ca tăng so với 38 cũ), build sạch. Nếu build báo còn tham chiếu tới `AssetDraft`, `emptyAssetDraft`, `useAssetDraft` hay `InMemoryDeviceRepository`, tìm và sửa nốt — thường là `AllocateRecoverPage.tsx` (đã xoá ở Step 7) hoặc `statusTone.ts`.

- [ ] **Step 9: Thử tay trên trình duyệt**

Chạy backend (`npx -y pnpm@10 start:dev` trong `backend/`) và `npm run dev` ở gốc. Đăng nhập `admin` / `Admin@123`, rồi kiểm:
- `/devices` hiện danh sách từ API thật (ban đầu rỗng hoặc chỉ có thiết bị do script E2E tạo).
- Thêm một thiết bị, gõ mã sai định dạng → thấy lỗi ngay ở ô; gõ đúng → lưu được.
- Bấm 👁 → vào trang sửa, sửa tên rồi lưu → danh sách cập nhật.
- Bấm ⋮ → xác nhận → thiết bị biến khỏi danh sách.

- [ ] **Step 10: Commit**

```bash
git add frontend/src
git commit -m "feat(device): màn danh mục và form thiết bị nối backend thật

/devices, /devices/new và /devices/:id/edit gọi API thật; nút xem chi tiết và nút
thao tác trên mỗi dòng nay có handler. Nút ghi chỉ hiện với Quản trị viên và
Trưởng phòng Kỹ thuật. /allocation chuyển thành trang đang phát triển vì màn cũ
chỉ là bản sao của form thêm tài sản, không cấp phát gì.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Cập nhật tài liệu

**Files:**
- Modify: `docs/CONTEXT.md`
- Modify: `frontend/README.md`
- Modify: `backend/README.md`
- Modify: `docs/Changes.md`

**Interfaces:**
- Consumes: kết quả Task 1–6.
- Produces: không có ký hiệu code nào.

- [ ] **Step 1: `docs/CONTEXT.md`**

- Mục 3 (bảng route): `/devices` và `/devices/new` đổi cột "Dữ liệu" sang API thật; thêm dòng `/devices/:id/edit`; `/allocation` đổi thành `ComingSoonPage`.
- Mục 4.1: bỏ 3 dòng nút chết đã có handler (👁 Xem chi tiết, ⋮ Thêm thao tác) — giữ lại những nút vẫn chết (Xuất dữ liệu, Thêm tài liệu, Thêm thông tin tùy chỉnh).
- Mục 4.2: bỏ dòng "Không có chế độ sửa" và dòng "`AllocateRecoverPage` không có luồng thật"; thêm dòng ghi thiết bị chưa có phân trang và chưa có trang chi tiết riêng.
- Mục 4.3: bỏ dòng "8 thiết bị Dell Latitude seed" và dòng option hardcode `UNITS`/`SUPPLIERS`/`SPECS`/`OWNERS`.
- Cập nhật dòng "Cập nhật lần cuối" ở đầu file.

- [ ] **Step 2: `frontend/README.md`**

Sửa mô tả module `device` (giờ nối backend thật, có tạo/sửa/xoá mềm) và bỏ `Cấp phát - Thu hồi` khỏi danh sách màn đã dựng, thêm vào danh sách "đang phát triển" cạnh Điều chuyển và Kiểm kê.

- [ ] **Step 3: `backend/README.md`**

Thêm module `devices` vào phần liệt kê module, kèm bảng route và ghi chú quyền ghi là Quản trị viên hoặc Trưởng phòng Kỹ thuật.

- [ ] **Step 4: `docs/Changes.md`**

Thêm một mục ghi các sửa đổi cần đưa vào báo cáo BCTT-HKTT:
- ERD 3.2.1 phải thêm **3 bảng** `DeviceType`, `Device`, `DeviceAccessory` và 3 khoá ngoại từ `Device`.
- Quy tắc mã thiết bị `PREFIX-NNNNNN` gắn với `DeviceType.Prefix`.
- Quy tắc thiết bị không bao giờ xoá cứng (cùng nguyên tắc với `User`).
- Phân quyền ghi thiết bị: Quản trị viên hoặc Trưởng phòng Kỹ thuật.

- [ ] **Step 5: Kiểm lại toàn bộ trước khi commit**

```bash
cd backend && npx -y pnpm@10 test && npx -y pnpm@10 run build && npx -y pnpm@10 run lint && cd ..
npm test && npm run build
```

Mong đợi: BE 63 passed, FE xanh, build sạch cả hai.

- [ ] **Step 6: Commit**

```bash
git add docs frontend/README.md backend/README.md
git commit -m "docs: cập nhật tài liệu sau vòng quản lý thiết bị

CONTEXT.md bỏ các mục placeholder nay đã có thật (nút xem chi tiết, chế độ sửa,
seed 8 máy Dell). Changes.md ghi 3 bảng mới cần thêm vào ERD trong báo cáo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Việc cố ý KHÔNG làm trong plan này

- Trang chi tiết thiết bị `/devices/:id` — nút 👁 dẫn thẳng sang trang sửa.
- Phân trang danh sách thiết bị; Modal/Toast (vẫn `window.confirm`).
- Nút "Xuất khẩu" / "Xuất dữ liệu"; tệp đính kèm; "Thông tin khác" tuỳ chỉnh.
- Sinh mã thiết bị tự động; bảng danh mục Đơn vị tính; bảng danh mục cấu hình.
- Màn quản lý `DeviceType` (chỉ seed, chưa có CRUD).
- Toàn bộ **Điều chuyển** và **Cấp phát - Thu hồi** (Figma có 12 frame — vòng riêng).
- **Kiểm kê** — vòng B, có spec riêng, dựng trên đúng 3 bảng plan này tạo ra.
