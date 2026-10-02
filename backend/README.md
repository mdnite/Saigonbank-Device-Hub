# IDSM Backend

NestJS 11 + Prisma 7 + PostgreSQL (17 qua Docker, hoặc bản cài sẵn trên máy). Các module: `identity`
(đăng nhập, quên mật khẩu), `users` (quản lý người dùng), `devices` (CRUD thiết bị, xoá mềm),
`device-orders` (đơn Cấp phát / Thu hồi) và `device-transfers` (lệnh Điều chuyển) — xem mục API bên dưới.
Đăng xuất xử lý thuần phía FE (JWT stateless) nên không có endpoint.

Project pnpm độc lập — **không** nằm trong npm workspace ở gốc repo. Chạy mọi lệnh bên trong `backend/`.

## Chạy local

### 1. Database

Cần role `idms` / `idms_dev` và database `internal_device_management` (khớp `DATABASE_URL` trong `.env.example`).

- **Docker:** `docker compose up -d` (Postgres 17, port 5432).
- **Postgres cài sẵn trên máy:** chạy bằng superuser `postgres`:

  ```bash
  psql -U postgres -h localhost -c "CREATE ROLE idms LOGIN PASSWORD 'idms_dev' CREATEDB;" -c "CREATE DATABASE internal_device_management OWNER idms;"
  ```

  `CREATEDB` là bắt buộc — `prisma migrate dev` cần tạo shadow database.

> **Lưu ý tên gọi:** hệ thống tên là **IDSM**. Riêng role PostgreSQL `idms` và database
> `internal_device_management` giữ nguyên tên cũ — đổi tên role/database phải tạo lại cả hai và
> chạy lại migration, không đáng so với lợi ích. Chuỗi `idms` trong `DATABASE_URL` là tên role,
> không phải tên hệ thống.

### 2. App

```bash
cp .env.example .env            # điền RESEND_API_KEY thật (+ DEV_USER_EMAIL nếu muốn test quên mật khẩu)
pnpm install
npx prisma migrate dev          # áp dụng prisma/migrations (hoặc `pnpm db:setup` = migrate deploy + seed)
npx prisma db seed              # dev-only, xem tài khoản bên dưới
pnpm start:dev                  # http://localhost:3000 — frontend (localhost:5173) gọi vào đây
pnpm test
```

Không có `pnpm` cài global thì thay `pnpm` bằng `npx -y pnpm@10`.

- **Tài khoản seed:** `admin` / `Admin@123` (Quản trị viên), `truongphong.kt` / `Head@1234`
  (Trưởng phòng, `KYTHUAT`), `ctv.kt` / `Collab@1234` (Cộng tác viên, `KYTHUAT`), thêm `dev` / `Dev@1234`
  nếu có `DEV_USER_EMAIL`. Seed từ chối chạy khi `NODE_ENV=production`.
- **Seed:** idempotent, chạy lại không đổi mật khẩu user đã có (user `dev` chỉ được cập nhật email).
  `DEV_USER_EMAIL` nên là email chủ tài khoản Resend (xem Quy ước), đọc từ `.env` để không commit
  email cá nhân vào repo.
- **Test (`pnpm test`):** mỗi module có 1 file `*.spec.ts` dựng module thật (controller, service, validation, JWT, bcrypt,
  envelope) nhưng thay `PrismaService` bằng DB giả trong RAM và `MailService` bằng `jest.fn()` —
  không cần Postgres, không gửi mail thật. Tích hợp với Postgres + Resend thật được kiểm tay.
- **CORS:** chỉ cho phép `CORS_ORIGIN` (mặc định `http://localhost:5173`).
- **Tắt server chạy nền:** nếu `EADDRINUSE :3000`, còn tiến trình Nest cũ giữ cổng — tắt nó
  (`Get-NetTCPConnection -LocalPort 3000 -State Listen` để tìm PID trên Windows).

## Migration

- Schema: `prisma/schema.prisma`. Migration do Prisma Migrate sinh ra trong `prisma/migrations/` — đây là
  nơi duy nhất chứa lịch sử schema.
- Đổi schema → `npx prisma migrate dev --name <verb_noun>` → commit schema cùng thư mục migration mới.
- Không sửa migration đã merge; sai thì tạo migration mới để sửa.
- Đổi shape bảng thì cập nhật ERD 3.2.1 trong báo cáo BCTT-HKTT.

## API

Mọi response có dạng `{ success, data, error, message }` — FE bóc `data` và hiện `message` khi lỗi
(`frontend/src/shared/lib/apiClient.ts`). Mọi endpoint ngoài `/auth/*` cần header
`Authorization: Bearer <accessToken>`; thiếu / hết hạn / tài khoản bị khoá hoặc xoá → 401, sai quyền → 403.

| Endpoint | Body | Thành công | Lỗi |
|---|---|---|---|
| `POST /auth/login` | `identifier` (username hoặc email), `password` | 200 `{ accessToken, user }` | 401 Sai tên đăng nhập hoặc mật khẩu · 403 Tài khoản đã bị khoá |
| `POST /auth/forgot-password` | `email` | 200 Đã gửi mã xác thực | 404 Email không tồn tại |
| `POST /auth/verify-otp` | `email`, `otp` (4 số) | 200 Mã xác thực hợp lệ | 400 Mã không đúng hoặc đã hết hạn |
| `POST /auth/reset-password` | `email`, `otp`, `newPassword` (≥ 6 ký tự) | 200 Đặt lại mật khẩu thành công | 400 Mã không đúng hoặc đã hết hạn |

### Thiết bị (`/devices`, `/device-types`)

Phân quyền dùng `@Allow(...ACTOR)` (`backend/src/shared/auth/actors.ts`), kiểm trong `AuthGuard`
(`@Allow` ở handler ghi đè `@Allow` ở class; không có `@Allow` = mọi user đã đăng nhập). Actor:
`ADMIN` (Quản trị viên), `TECH_HEAD` (Trưởng phòng + phòng `KYTHUAT`), `TECH_COLLAB` (Cộng tác viên +
`KYTHUAT`). Với thiết bị: đọc = mọi role đã đăng nhập; `POST`/`PATCH` = `TECH_HEAD`, `TECH_COLLAB`;
`DELETE` và `POST /devices/purge` = chỉ `TECH_HEAD`. Quản trị viên chỉ xem. Đơn cấp phát / thu hồi và
lệnh điều chuyển: đọc = `ADMIN`, `TECH_HEAD`, `TECH_COLLAB`; tạo = `TECH_COLLAB`; duyệt / từ chối =
`TECH_HEAD`. `/users` = `ADMIN`.

| Endpoint | Ghi chú |
|---|---|
| `GET /devices` | Danh sách; lọc `search`/`status`/`deviceTypeId` phía server. Mặc định ẩn thiết bị "Đã xóa". Chưa phân trang. |
| `GET /devices/:id` | Chi tiết 1 thiết bị. |
| `POST /devices` | Tạo mới — `TECH_HEAD`/`TECH_COLLAB`. Luôn ở trạng thái "Trong kho"; bỏ qua `currentUserId`/`departmentId`/`allocatedOn`/`status` trong body. `deviceCode` phải khớp `/^[A-Z]{2,4}-\d{6}$/` **và** bắt đầu bằng `prefix` của `DeviceType` đã chọn. |
| `PATCH /devices/:id` | Sửa — `TECH_HEAD`/`TECH_COLLAB`; bỏ qua `currentUserId`/`departmentId`/`allocatedOn`/`status` (người giữ chỉ đổi qua đơn Cấp phát / Thu hồi hoặc lệnh Điều chuyển đã duyệt). Thiết bị "Đang chờ duyệt" → 400 "Thiết bị đang chờ duyệt, không thể sửa hoặc xoá". Gửi `accessories` sẽ thay thế toàn bộ danh sách linh kiện cũ (`deleteMany` + `create`). |
| `DELETE /devices/:id` | Xoá **mềm** — chỉ `TECH_HEAD` (cũng 400 nếu "Đang chờ duyệt"). Chỉ đổi `Status` thành "Đã xóa", không bao giờ xoá row. |
| `POST /devices/purge` | Body `ids` — xoá **cứng** các thiết bị "Đã xóa" trong danh sách, bỏ qua thiết bị còn được đơn/lệnh tham chiếu. Chỉ `TECH_HEAD`. |
| `GET /device-types` | Danh mục loại thiết bị, chỉ đọc — seed 4 dòng (Laptop `LT`, Máy tính để bàn `PC`, Màn hình `MN`, Máy in `MI`). Chưa có màn quản lý (CRUD), chỉ có qua seed. |

### Người dùng (`/users`) — chỉ `ADMIN`

| Endpoint | Ghi chú |
|---|---|
| `GET /users` | Lọc `search`/`status`/`roleId`/`departmentId`. Mặc định ẩn "Đã xóa". Chưa phân trang. |
| `POST /users` | `username`, `email`, `fullName`, `password` (≥ 6), `roleId`, `departmentId` (bắt buộc với Trưởng phòng / Cộng tác viên). Trùng username/email → 409. |
| `PATCH /users/:id/status` | `status` = "Đang hoạt động" \| "Ngừng hoạt động". Không tự khoá chính mình. |
| `DELETE /users/:id` | Xoá **mềm** (Status = "Đã xóa"). |
| `POST /users/purge` | Body `ids` — xoá cứng user "Đã xóa" (kèm `PasswordResetToken`), bỏ qua user còn được đơn/lệnh tham chiếu. |
| `GET /roles`, `GET /departments`, `GET /users/lookup` | Mọi user đã đăng nhập. `/users/lookup` chỉ trả `{ id, fullName, username }` của user chưa xoá — dùng cho dropdown chọn người. |

### Đơn Cấp phát / Thu hồi (`/device-orders`) và lệnh Điều chuyển (`/device-transfers`)

Đọc = `ADMIN`, `TECH_HEAD`, `TECH_COLLAB`; tạo = `TECH_COLLAB`; duyệt / từ chối = `TECH_HEAD`.
Trạng thái đơn/lệnh: "Chờ duyệt" → "Đã duyệt" \| "Từ chối" (không sửa, không huỷ, không xoá).

| Endpoint | Ghi chú |
|---|---|
| `GET /device-orders` | Lọc `type` ("Cấp phát" \| "Thu hồi"), `status`. |
| `GET /device-transfers` | Lọc `status`. |
| `GET /device-orders/:id`, `GET /device-transfers/:id` | Chi tiết kèm danh sách thiết bị (FE dùng để in biên bản). |
| `POST /device-orders` | `type`, `targetUserId`, `deviceIds` (≥ 1), `note?`. Cấp phát: thiết bị phải "Trong kho"; Thu hồi: "Đã cấp phát" và đang do `targetUserId` giữ. |
| `POST /device-transfers` | `fromUserId`, `toUserId` (khác nhau), `deviceIds` (≥ 1), `note?`. Thiết bị phải "Đã cấp phát" và đang do `fromUserId` giữ. |
| `PATCH …/:id/approve` | Ghi trạng thái đích cho thiết bị (Cấp phát / Điều chuyển → "Đã cấp phát" cho người nhận; Thu hồi → "Trong kho"). |
| `PATCH …/:id/reject` | Body `reason`. Trả thiết bị về trạng thái trước khi tạo. |

Tạo đơn/lệnh **giữ chỗ** thiết bị: chuyển sang "Đang chờ duyệt" trong cùng transaction (ghi có điều
kiện, chặn 2 đơn tranh cùng thiết bị); thiết bị đang chờ duyệt không vào đơn/lệnh khác, không sửa,
không xoá. Duyệt / từ chối dùng `updateMany` có điều kiện "Chờ duyệt" → bấm 2 lần đồng thời chỉ 1
lần thắng, lần kia 400 "Đơn đã được xử lý".

## Quy ước

- Đăng xuất: không có endpoint, không có bảng Session/RefreshToken — FE xoá token khỏi
  `localStorage["idsm.session"]`. Thêm `/auth/logout` (vd. cho audit/blacklist) phải hỏi trước vì
  phá quyết định JWT stateless.
- Không bao giờ xoá cứng `User` (UC-06 xoá mềm qua `Status`); token reset chỉ đánh dấu `usedAt`.
- OTP lưu dạng SHA-256, hết hạn 5 phút, chỉ mã mới nhất có hiệu lực, tối đa 5 lần nhập sai mỗi mã.
- Resend với `onboarding@resend.dev` chỉ gửi được tới email chủ tài khoản Resend; gửi cho người khác cần verify domain.

## Kiểm thử đầu-cuối (E2E) trên PostgreSQL thật

`npx -y pnpm@10 test` dùng Prisma giả, nên không kiểm được ba thứ: tìm kiếm không phân biệt hoa
thường, sắp xếp theo id, và việc `AuthGuard` đọc lại User từ DB mỗi request. Script dưới đây kiểm
đúng ba thứ đó trên backend + PostgreSQL thật:

```bash
# cửa sổ 1
npx -y pnpm@10 start:dev
# cửa sổ 2
powershell -ExecutionPolicy Bypass -File scripts/e2e-users.ps1
powershell -ExecutionPolicy Bypass -File scripts/e2e-devices.ps1
powershell -ExecutionPolicy Bypass -File scripts/e2e-device-orders.ps1
powershell -ExecutionPolicy Bypass -File scripts/e2e-device-transfers.ps1
```

Script tự sinh username theo timestamp nên chạy lại được nhiều lần và không bao giờ xoá cứng row
`User`. Tham số có thể đổi: `-BaseUrl`, `-AdminPassword`, `-PsqlPath`, `-DbPassword`.

`e2e-devices.ps1` kiểm thêm phần thiết bị trên cùng backend + PostgreSQL thật: tiền tố mã theo
loại thiết bị, trùng mã, phân quyền theo `@Allow` (Cộng tác viên / Trưởng phòng Kỹ thuật ghi được, Quản trị viên chỉ xem), thiết bị "Đang chờ duyệt", xoá mềm, và nested write
`PATCH` accessories (`deleteMany` + `create`) — thứ fake Prisma không mô phỏng được.

`e2e-device-orders.ps1` và `e2e-device-transfers.ps1` tự tạo Trưởng phòng + Cộng tác viên Kỹ thuật
qua API, rồi chạy trọn vòng tạo (giữ chỗ "Đang chờ duyệt") → duyệt / từ chối → kiểm trạng thái thiết
bị trên DB thật, kèm các ca sai quyền.
