# IDMS Backend

NestJS 11 + Prisma 7 + PostgreSQL (17 qua Docker, hoặc bản cài sẵn trên máy). Đợt hiện tại: module
`identity` (đăng nhập, quên mật khẩu). Đăng xuất xử lý thuần phía FE (JWT stateless) nên không có endpoint.

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

### 2. App

```bash
cp .env.example .env            # điền RESEND_API_KEY thật
pnpm install
npx prisma migrate dev          # áp dụng prisma/migrations (4 bảng Role, Department, User, PasswordResetToken)
npx prisma db seed              # dev-only: user admin / Admin@123
pnpm start:dev                  # http://localhost:3000
pnpm test
```

## Migration

- Schema: `prisma/schema.prisma`. Migration do Prisma Migrate sinh ra trong `prisma/migrations/` — đây là
  nơi duy nhất chứa lịch sử schema.
- Đổi schema → `npx prisma migrate dev --name <verb_noun>` → commit schema cùng thư mục migration mới.
- Không sửa migration đã merge; sai thì tạo migration mới để sửa.
- Đổi shape bảng thì cập nhật ERD 3.2.1 trong báo cáo BCTT-HKTT.

## API

Mọi response có dạng `{ success, data, error, message }`.

| Endpoint | Body | Thành công | Lỗi |
|---|---|---|---|
| `POST /auth/login` | `identifier` (username hoặc email), `password` | 200 `{ accessToken, user }` | 401 Sai tên đăng nhập hoặc mật khẩu · 403 Tài khoản đã bị khoá |
| `POST /auth/forgot-password` | `email` | 200 Đã gửi mã xác thực | 404 Email không tồn tại |
| `POST /auth/verify-otp` | `email`, `otp` (4 số) | 200 Mã xác thực hợp lệ | 400 Mã không đúng hoặc đã hết hạn |
| `POST /auth/reset-password` | `email`, `otp`, `newPassword` (≥ 6 ký tự) | 200 Đặt lại mật khẩu thành công | 400 Mã không đúng hoặc đã hết hạn |

## Quy ước

- Không bao giờ xoá cứng `User` (UC-06 xoá mềm qua `Status`); token reset chỉ đánh dấu `usedAt`.
- OTP lưu dạng SHA-256, hết hạn 5 phút, chỉ mã mới nhất có hiệu lực, tối đa 5 lần nhập sai mỗi mã.
- Resend với `onboarding@resend.dev` chỉ gửi được tới email chủ tài khoản Resend; gửi cho người khác cần verify domain.
