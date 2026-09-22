# Đối chiếu "Nhật ký công việc" (PDF) với codebase thật

> **Nguồn PDF:** `C:\Users\tanmi\Downloads\IDSM project.pdf` — mục *2.1 Nhật ký công việc*, Bảng 1,
> tuần 01 → tuần 11 (03/08/2026 → 16/10/2026).
> **Đối chiếu ngày:** 21/09/2026, trên nhánh `feat/user-management` (HEAD `19bb57d`).
> **Cách kiểm chứng:** đọc trực tiếp source trong repo + `git log --all --date=short` (lịch sử commit
> là bằng chứng mạnh nhất cho "việc gì làm ngày nào"). Những gì nằm ngoài repo (biên bản phỏng vấn,
> sơ đồ trong báo cáo, mã yêu cầu F-0xx) được liệt kê riêng ở mục 6 — **không kết luận đúng/sai**.

**Ký hiệu mức độ**

| Ký hiệu | Nghĩa |
|---|---|
| ❌ | Sai sự thật — mô tả thứ không tồn tại trong code, hoặc trái ngược với thứ đang có |
| ⚠️ | Lệch một phần — có thật nhưng khác về phạm vi, tên gọi hoặc thời điểm |
| 🕐 | Nội dung đúng nhưng **ngày ghi lệch** so với commit thật |
| 🔜 | Tuần trong tương lai (tính từ 21/09) — là kế hoạch, chỉ nêu rủi ro |
| ❔ | Không kiểm chứng được trong repo |

---

## 0. Kết luận nhanh

1. **Lệch mốc thời gian khoảng 3 tuần.** Nhật ký ghi backend NestJS + module Identity đã xong từ
   25–26/08/2026. Commit **đầu tiên của cả repo là 09/09/2026**, và thư mục `backend/` chỉ xuất hiện
   ngày **17/09/2026** (`d353f03`). Toàn bộ tuần 04, 05, 06 và 07 vì thế không khớp.
2. **4 khẳng định kỹ thuật sai hẳn**, dễ bị hỏi lại khi bảo vệ: Argon2 (thật ra là **bcrypt**),
   **4 vai trò** (thật ra **3**), **admin đặt lại mật khẩu hộ thay cho email/OTP** (thật ra hệ thống
   **dùng đúng OTP email**), **đã deploy Neon/Render/Vercel** (thật ra **chưa deploy**).
3. **Một loạt tính năng được ghi là đã xong nhưng không tồn tại:** toast, component form dùng chung,
   màn quản lý phòng ban, sửa thông tin người dùng, module Device/DeviceAccessory ở backend, mã QR.
4. **Chiều ngược lại cũng thiếu:** phần lớn công việc thật (ERD 4 bảng, luồng OTP qua Resend, envelope
   response, JWT guard đọc lại DB mỗi request, nối FE↔BE, module quản lý người dùng) **không có dòng
   nào trong nhật ký**. Xem mục 4 — đây là phần đáng tiếc nhất vì đó mới là khối lượng thật.
5. **Tên hệ thống không nhất quán:** PDF viết **IDMS**, repo và toàn bộ tài liệu viết **IDSM**
   (`README.md`, `docs/CONTEXT.md` tiêu đề "IDSM — Context & Conventions"). Phải chọn 1.

---

## 1. Vấn đề hệ thống (ảnh hưởng nhiều dòng cùng lúc)

### 1.1 Mốc thời gian

Lịch sử commit thật (đủ, không cắt):

| Ngày | Commit | Nội dung |
|---|---|---|
| 09/09 | `aa80801` | commit **đầu tiên của repo** — bảng linh kiện (frontend) |
| 10/09 | `7ce9b67` | module user settings (Người dùng / Cài đặt) |
| 11/09 | `223d0bf`, `e7ece4c`, `a30d397` | `.gitignore` + `docs/CONTEXT.md`; **tách repo thành `frontend/` + `backend/`**; OTP countdown + paste |
| 17/09 | `d353f03`, `de358bf`, `ac4655d` | **module identity đầu tiên của backend**; migration Prisma đầu tiên; đổi tên migration thành `init_user_login` |
| 18/09 | `b56da11` | nối frontend ↔ backend thật cho auth |
| 19/09 | 11 commit (`b406983` → `5848f69`) | JWT guard, module `users`, màn `/users`, seed role/phòng ban, spec + plan |
| 21/09 | `51a014d`, `19bb57d` | chặn số nguyên vượt int32, sửa hook 401, cập nhật tài liệu |

→ Mọi dòng nhật ký từ **24/08 đến 11/09** mô tả code backend đều không có cơ sở trong repo.

### 1.2 Kiến trúc: "DDD-lite 4 tầng / 5 module + shared kernel"

- **Frontend** *có* kiến trúc 4 tầng, nhưng là **4 module**, không phải 5:
  `frontend/src/modules/{auth, dashboard, device, user}` + `frontend/src/shared/`.
- **Backend KHÔNG theo DDD 4 tầng.** Đó là cấu trúc NestJS thuần:
  `backend/src/modules/{identity, users}` (mỗi module gồm `*.controller.ts` / `*.service.ts` /
  `*.dto.ts` / `*.module.ts`) + `backend/src/shared/{auth, http, mail, prisma, security}`.
  Không có `domain/`, `application/`, `infrastructure/`, `presentation/` ở backend.
- Nếu báo cáo có Package Diagram vẽ backend theo 4 tầng thì **sơ đồ đó cũng sai**, không chỉ nhật ký.

### 1.3 Số vai trò: 4 hay 3?

`backend/src/modules/identity/roles.ts` — đúng **3** vai trò, và đây là quyết định đã chốt ngày 19/09:

```ts
export const ROLE = {
  ADMIN: 'Quản trị viên',
  HEAD:  'Trưởng phòng',   // TP Kế toán / TP Kỹ thuật phân biệt bằng User.DepartmentId
  STAFF: 'Nhân viên',
} as const;
```

Nhật ký nhắc "4 vai trò" ở hai chỗ (26/08 và 01/09). Nếu bản thiết kế cũ thật sự có 4 vai trò thì
phải ghi rõ **đã rút xuống 3** ở tuần tương ứng, kèm lý do (TP Kế toán và TP Kỹ thuật dùng chung
vai trò `Trưởng phòng`, phân biệt bằng phòng ban).

### 1.4 Deploy

Không có `vercel.json`, `render.yaml`, `Dockerfile`, `Procfile` hay thư mục `.github/` trong repo.
Neon / Render / Vercel hiện là **mục tiêu triển khai**, chưa thực hiện. Dòng 28/08 phải sửa.

### 1.5 Lỗi trình bày

Ô "Người tham gia" ngày **28/08** đang ghi `ahjasab` — chuỗi rác, cần thay bằng tên người thật.

---

## 2. Bảng lỗi theo từng dòng nhật ký

### Tuần 04 (24/08 – 28/08)

| Ngày | PDF viết | Thực tế | Bằng chứng | Đề xuất sửa |
|---|---|---|---|---|
| 24/08 | "kiến trúc DDD-lite **5 module** + shared kernel" | FE 4 module + shared; BE không phải DDD | `frontend/src/modules/` (4 thư mục) | ⚠️ Sửa thành "frontend DDD-lite 4 module + shared; backend NestJS chuẩn (modules + shared)" |
| 24/08 | stack NestJS + Prisma + PostgreSQL, React + Vite + Tailwind | Đúng | `backend/package.json`, `frontend/package.json` | ✅ giữ nguyên |
| 25/08 | "Khởi tạo dự án NestJS theo cấu trúc shared/ và modules/" | Backend chỉ có từ **17/09** | `d353f03` | 🕐 Chuyển nội dung này sang tuần 07 |
| 25/08 | "cấu hình **Docker Compose** cho PostgreSQL" | File `backend/docker-compose.yml` có thật nhưng **không dùng**: máy không cài Docker, DB thật là **PostgreSQL 18 cài trực tiếp** (`D:\Postgre`, cổng 5432) | `backend/docker-compose.yml`, `backend/.env` | ⚠️ "Chuẩn bị `docker-compose.yml` cho môi trường khác; môi trường phát triển dùng PostgreSQL 18 cài trực tiếp" |
| 26/08 | "API **CRUD** cho 3 thực thể Role, Department, User theo **DDD-lite 4 tầng**" | `/roles` và `/departments` **chỉ có GET danh mục**; `/users` có danh sách/tạo/khoá/xoá mềm, **không có sửa**; backend không phải DDD | `backend/src/modules/users/users.controller.ts` | ❌ Viết lại: "API danh mục `/roles`, `/departments` (chỉ đọc) và API quản lý người dùng: danh sách + lọc, tạo, khoá/mở khoá, xoá mềm" |
| 26/08 | "mã hóa mật khẩu **Argon2**" | **bcrypt**, 10 rounds | `backend/src/shared/security/password.ts:1`, `backend/package.json` (`bcrypt ^6.0.0`) | ❌ Đổi "Argon2" → "bcrypt (10 rounds)" |
| 26/08 | "**RolesGuard** phân quyền **4 vai trò**" | Guard tên `AuthGuard` + decorator `@Roles`, **3 vai trò**; guard còn **đọc lại User + Role từ DB mỗi request** để khoá/xoá có hiệu lực ngay | `backend/src/shared/auth/auth.guard.ts`, `roles.decorator.ts` | ❌ Đổi thành "`AuthGuard` + decorator `@Roles`, 3 vai trò; xác thực JWT rồi đọc lại User/Role từ DB mỗi request" |
| 27/08 | "dựng **10 package** theo Package Diagram" | FE thực tế: `app/`, `modules/{auth,dashboard,device,user}`, `shared/{ui,layout,lib}`, `styles/`, `test/` | `frontend/src/` | ❔ Đối chiếu lại với Package Diagram trong báo cáo; nếu sơ đồ vẫn 10 package mà code không khớp thì sửa 1 trong 2 |
| 27/08 | màn Đăng nhập + AppShell | Có thật | `LoginPage.tsx`, `AppShell.tsx` | 🕐 Ngày thật: có từ commit đầu tiên (09/09) |
| 28/08 | "**Deploy bản rỗng**: Neon, Render, Vercel" + "Demo mốc nghiệm thu" | **Chưa deploy**, không có file cấu hình nào | không có `vercel.json` / `render.yaml` / CI | ❌ Đổi thành "Chốt phương án triển khai Neon + Render + Vercel (chưa deploy)" hoặc bỏ dòng |
| 28/08 | Người tham gia: `ahjasab` | — | — | ❌ Lỗi gõ, thay bằng tên thật |

### Tuần 05 (31/08 – 04/09)

| Ngày | PDF viết | Thực tế | Bằng chứng | Đề xuất sửa |
|---|---|---|---|---|
| 31/08 | "API **cập nhật**, khóa/xóa tài khoản" | Khoá (`PATCH /users/:id/status`) + xoá mềm (`DELETE /users/:id`) **có**; **API cập nhật thông tin người dùng KHÔNG có** — cố ý bỏ ngoài phạm vi theo quyết định 19/09 | `users.controller.ts`, `docs/superpowers/specs/2026-09-19-user-management-design.md` mục 2 | ❌ Bỏ chữ "cập nhật", ghi rõ "không sửa thông tin người dùng (ngoài phạm vi đợt này)" |
| 31/08 | "API danh mục phòng ban" | Có (`GET /departments`) | `users.controller.ts` (`LookupController`) | 🕐 Ngày thật 19/09 |
| 01/09 | "RolesGuard cho từng route" | Đúng về bản chất: `@UseGuards(AuthGuard)` + `@Roles(ROLE.ADMIN)` đặt ở controller, không dùng guard toàn cục để `/auth/*` vẫn công khai | `users.controller.ts:34-36` | ⚠️ Nêu rõ "guard đặt ở controller, `/auth/*` công khai" |
| 01/09 | "kiểm thử thủ công với **4 tài khoản đại diện 4 vai trò**" | 3 vai trò; seed tạo **2 tài khoản** (`admin`, `dev`) | `backend/prisma/seed.ts` | ❌ Sửa số liệu |
| 02/09 | "xây dựng chức năng **đổi mật khẩu** và **admin đặt lại mật khẩu hộ (thay cho email/OTP)**" | **Ngược hoàn toàn.** Hệ thống dùng **OTP 4 số gửi qua email (Resend)**, lưu hash SHA-256, hạn 5 phút, tối đa 5 lần sai, chỉ mã mới nhất còn hiệu lực. **Không có** API đổi mật khẩu khi đang đăng nhập, **không có** chức năng admin đặt lại mật khẩu hộ. Admin chỉ nhập mật khẩu **ban đầu** lúc tạo tài khoản. Nút "Đổi mật khẩu" ở `/settings` chỉ điều hướng sang `/forgot-password` | `backend/src/modules/identity/password-reset.service.ts`, `shared/security/otp.ts`, `shared/mail/mail.service.ts`, `frontend/src/modules/user/presentation/tabs/SecurityTab.tsx` | ❌ Viết lại toàn bộ dòng — đây là điểm sai nặng nhất về nghiệp vụ |
| 03/09 | "exception filter dùng chung chuẩn hóa response" | Có: `ApiExceptionFilter` bắt mọi lỗi, trả `{ success:false, data:null, error, message }` tiếng Việt | `backend/src/shared/http/api-exception.filter.ts` | ✅ Đúng (🕐 ngày thật 17/09) |
| 03/09 | "interceptor **ghi log các request lỗi**" | `ResponseInterceptor` **chỉ bọc envelope cho response thành công**, không ghi log gì | `backend/src/shared/http/response.interceptor.ts` | ❌ Sửa thành "interceptor bọc response thành công vào envelope `{success,data,error,message}`, lấy message từ decorator `@ResponseMessage`" |
| 04/09 | kiểm thử tích hợp module Identity | Có thật: 49 ca jest chạy qua đúng pipeline (`app.setup.ts` dùng chung với `main.ts`) | `backend/src/modules/identity/auth.spec.ts`, `users.spec.ts` | 🕐 Ngày thật 17–21/09 |

### Tuần 06 (07/09 – 11/09)

| Ngày | PDF viết | Thực tế | Bằng chứng | Đề xuất sửa |
|---|---|---|---|---|
| 07/09 | component bảng dữ liệu dùng chung | Có `DataTable<Row>` (không sort, không phân trang, không chọn dòng) | `frontend/src/shared/ui/DataTable.tsx` | ✅ nên ghi thêm giới hạn |
| 07/09 | `apiRequest` + `apiGet/apiPost/apiPatch/apiDelete` | Có, **đúng tên** | `frontend/src/shared/lib/apiClient.ts` | 🕐 Viết ngày 18/09, mở rộng 19/09 (`8a9906f`) |
| 07/09 | `useAsyncData(loader, deps)`, `useAsyncAction(fn)` | Có, **đúng chữ ký** | `frontend/src/shared/lib/` | 🕐 như trên |
| 08/09 | "component **form dùng chung**" | Không có. Form dựng bằng `Field` + `Input`/`Select` + hook `useXDraft` + hàm `validateX` ở `domain/`; **không có form library, không có form component** | `docs/CONTEXT.md` mục 2 | ❌ Sửa mô tả |
| 08/09 | "cơ chế thông báo (**toast**) khi thêm/sửa/xóa" | **Không tồn tại toast nào** trong frontend. Lỗi/thành công chỉ hiện bằng text inline | tìm "toast" trong `frontend/src` = 0 kết quả; `docs/CONTEXT.md` mục 2 ghi rõ "KHÔNG tồn tại: Toast / Notification" | ❌ Bỏ, hoặc chuyển xuống phần "chưa làm" |
| 09/09 | "**thêm/sửa/xóa** nhân sự **và phòng ban** trên frontend" | `/users` chỉ có: danh sách + lọc, thêm (`/users/new`), khoá/mở khoá, xoá mềm. **Không có sửa. Không có màn quản lý phòng ban** — phòng ban chỉ là dropdown đọc từ `GET /departments` | `frontend/src/modules/user/presentation/` | ❌ Sửa phạm vi |
| 09/09 | xác nhận khoá/xoá | Dùng `window.confirm` vì chưa có Modal | `UserListPage.tsx` | ⚠️ nên ghi rõ (là hạn chế đã biết) |
| 10/09 | "màn hình xem/cập nhật **hồ sơ cá nhân** và đổi mật khẩu" | `/settings` có thật và **đúng ngày** (`7ce9b67`, 10/09) — nhưng **vẫn chạy mock in-memory**, lưu xong F5 là mất; "đổi mật khẩu" chỉ là link sang `/forgot-password` | `InMemoryUserSettingsRepository.ts`, `SecurityTab.tsx` | ⚠️ Thêm "(dữ liệu còn mock, chưa nối backend)" |
| 11/09 | viết mục Backend Package Diagram | Ngày 11/09 thực tế làm: tách repo `frontend/` + `backend/`, viết `docs/CONTEXT.md`, đồng bộ màn auth theo Figma mới | `e7ece4c`, `223d0bf`, `a30d397` | ⚠️ Bổ sung các việc thật này |

### Tuần 07 (14/09 – 18/09) — lệch nhiều nhất

| Ngày | PDF viết | Thực tế |
|---|---|---|
| 14/09 | "API CRUD cho thực thể **Device** (CPU, RAM, SSD, mã màn hình)" | ❌ Backend **không có** module device. `backend/src/modules/` chỉ có `identity` và `users`. Schema Prisma chỉ có **4 bảng**: `Role`, `Department`, `User`, `PasswordResetToken`. Thiết bị ở frontend là **mock in-memory 8 máy Dell** |
| 15/09 | "API CRUD **DeviceAccessory** + gán/gỡ phụ kiện" | ❌ Không tồn tại ở backend. Frontend có `ComponentsTable` (bảng linh kiện trong form) nhưng chỉ là state cục bộ |
| 16/09 | "sinh mã định danh + **mã QR**" | ❌ Không có dòng code QR nào trong repo |
| 17/09 | "API tìm kiếm, lọc thiết bị theo phòng ban và trạng thái" | ❌ Không có ở backend. Lọc thiết bị hiện lọc **phía client** trong repository mock. (Tìm kiếm/lọc **người dùng** thì có thật, nhưng là ngày 19/09) |
| 18/09 | "viết thử truy vấn SQL đối soát" | ❌ Không có file SQL nào ngoài `backend/prisma/migrations/` |
| | | **Việc thật của tuần này:** 17/09 dựng toàn bộ backend identity + ERD 4 bảng + migration + seed; 18/09 nối frontend↔backend cho auth, bỏ mock, thêm nút Đăng xuất, kiểm thử đầu-cuối với Resend thật |

### Tuần 08 (21/09 – 25/09) — tuần hiện tại

PDF ghi: hoàn thiện giao diện danh mục thiết bị, in nhãn QR hàng loạt, API cấp phát + chặn mượn chéo,
API thu hồi. 🔜 Thực tế ngày 19/09 và 21/09 đang làm **quản lý người dùng + JWT guard + dọn nợ kỹ
thuật**, và chưa có bảng `Device` trong database. Kế hoạch tuần này hiện **không khả thi** nếu chưa
mở rộng schema.

---

## 3. Bản viết lại đề xuất cho tuần 04 → 08

Nội dung dưới đây là **việc thật, có commit làm bằng chứng**. Gợi ý gom theo tuần cho khớp lịch báo cáo.

**Tuần 04 (24/08 – 28/08) — thiết kế & chuẩn bị**
1. Chốt đề cương IDSM, phạm vi và mốc triển khai.
2. Chốt stack: NestJS 11 + Prisma 7 + PostgreSQL (backend), React 18 + Vite 5 + Tailwind 3 (frontend).
3. Thiết kế kiến trúc: frontend DDD-lite 4 tầng cho mỗi module, backend NestJS chuẩn (`modules/` + `shared/`).
4. Chốt phương án triển khai Neon + Render + Vercel (**chưa deploy**).
5. Thiết lập quy ước nhánh Git, commit message, `.gitignore`, `.env.example`.

**Tuần 05 (31/08 – 04/09) — dựng giao diện từ Figma**
1. Dựng khung `AppShell` + `Sidebar` + `AuthLayout` theo Figma.
2. Dựng bộ UI kit dùng chung: `Button`, `Card`, `Field`, `Input`/`Select`/`Checkbox`/`Radio`, `Badge`, `DataTable`, `Tabs`, `SearchInput`.
3. Màn Đăng nhập, Quên mật khẩu, Nhập OTP, Đặt lại mật khẩu (đọc trực tiếp từ Figma qua node-id).
4. Màn Tổng quan (4 thẻ thống kê) và Danh mục thiết bị chạy trên repository mock.
5. Viết unit test cho tầng `domain` (`validateAssetDraft`, `credentials`, `session`).

**Tuần 06 (07/09 – 11/09) — hoàn thiện frontend, tách repo**
1. 09/09 — bảng linh kiện trong form thêm tài sản (`ComponentsTable`), form cấp phát/thu hồi.
2. 10/09 — màn Hồ sơ cá nhân 3 tab (`/settings`), còn chạy dữ liệu mock.
3. 11/09 — đếm ngược OTP theo `Date.now()`, dán nguyên mã OTP, validate "sống" ở màn đặt lại mật khẩu.
4. 11/09 — **tách repo thành `frontend/` + `backend/`**: `frontend/` là npm workspace, `backend/` là project pnpm riêng.
5. 11/09 — viết `docs/CONTEXT.md`: bản đồ codebase, quy ước làm việc, danh sách placeholder.

**Tuần 07 (14/09 – 18/09) — dựng backend thật**
1. 17/09 — chốt ERD 4 bảng `Role` / `Department` / `User` / `PasswordResetToken`; viết `schema.prisma` map sang đúng tên cột PascalCase của ERD; migration `20260917140549_init_user_login` + seed.
2. 17/09 — module `identity`: đăng nhập bằng username **hoặc** email, JWT stateless (không bảng session), mật khẩu hash **bcrypt**.
3. 17/09 — luồng quên mật khẩu: OTP **4 số**, lưu **hash SHA-256**, hạn **5 phút**, tối đa **5 lần sai** mỗi mã, chỉ mã mới nhất có hiệu lực; gửi email thật qua **Resend**.
4. 17/09 — chuẩn hoá response toàn hệ thống: `ResponseInterceptor` (bọc thành công) + `ApiExceptionFilter` (bắt mọi lỗi), envelope `{ success, data, error, message }`, message tiếng Việt.
5. 18/09 — nối frontend ↔ backend cho toàn bộ luồng auth: `HttpAuthRepository`, xoá repository mock, đăng xuất phía client, kiểm thử đầu-cuối với PostgreSQL thật và email thật.

**Tuần 08 (21/09 – 25/09) — quản lý người dùng & phân quyền** *(việc thật của 19/09 và 21/09)*
1. `AuthGuard` dùng chung: xác thực JWT rồi **đọc lại User + Role từ DB mỗi request** → khoá/xoá/đổi vai trò có hiệu lực ngay mà vẫn không cần bảng session; decorator `@Roles`.
2. API quản lý người dùng (chỉ Quản trị viên): danh sách + tìm kiếm/lọc, tạo (admin nhập mật khẩu ban đầu, `IsVerified = false`), khoá/mở khoá, **xoá mềm** (không bao giờ xoá cứng); chặn tự khoá/tự xoá; API danh mục `/roles`, `/departments`.
3. Frontend: `/users` (danh sách + thao tác), `/users/new` (form tạo), guard `RequireAdmin`, ẩn mục "Người dùng" với vai trò khác; hồ sơ cá nhân chuyển sang `/settings`.
4. Tự đăng xuất khi hết phiên: kiểm `exp` của JWT lúc mở app và tự đăng xuất khi API trả 401 trên request có token, kèm thông báo hết phiên.
5. Kiểm thử: 49 ca jest ở backend, 38 ca vitest ở frontend, **kiểm thử đầu-cuối qua API trên PostgreSQL thật** (khoá tài khoản → request kế tiếp 401 ngay; xoá mềm → biến khỏi danh sách nhưng dòng vẫn còn trong DB).

---

## 4. Việc thật đã làm nhưng nhật ký **không nhắc tới**

Đây là phần nên bổ sung — khối lượng lớn nhất của dự án đang bị bỏ trống trong báo cáo:

| Hạng mục | Vì sao đáng ghi |
|---|---|
| ERD 4 bảng + `schema.prisma` map đúng tên cột PascalCase của ERD | Quyết định thiết kế dữ liệu, có ràng buộc unique username/email/DepartmentCode |
| Quy ước **không bao giờ xoá cứng** `User` (chỉ đổi Status) | Quy tắc nghiệp vụ UC-06, có test chặn `prisma.user.delete` |
| Luồng OTP: hash SHA-256, hạn 5 phút, giới hạn 5 lần sai, chỉ mã mới nhất hợp lệ | Phần bảo mật đáng kể, vượt yêu cầu ban đầu |
| Envelope response thống nhất + filter/interceptor dùng chung | Ảnh hưởng mọi API; frontend bóc `.data` và đọc `.message` |
| `AuthGuard` đọc lại User/Role từ DB mỗi request | Điểm kỹ thuật hay nhất: khoá tài khoản có hiệu lực **ngay** mà vẫn stateless |
| `IsVerified` tự bật `true` sau khi đặt lại mật khẩu qua OTP thành công | Quy tắc nghiệp vụ UC-02/UC-04 |
| Tự đăng xuất khi 401 / token hết hạn | Trải nghiệm + an toàn phiên |
| Bộ test 49 (backend) + 38 (frontend) | Bằng chứng chất lượng |
| Dọn nợ kỹ thuật 21/09: chặn id vượt phạm vi int32 (trả 404 thay vì lỗi 500), bọc hook 401 | Cho thấy quy trình review + sửa lỗi |
| `docs/CONTEXT.md`, `docs/Changes.md`, spec + plan trong `docs/superpowers/` | Tài liệu kỹ thuật tự viết |

---

## 5. Tuần 09 → 11 (kế hoạch) — rủi ro cần nêu trước

Các tuần này đang giả định những thứ **chưa tồn tại**:

- **Chưa có bảng nào cho thiết bị.** Database mới có 4 bảng. `Device`, `DeviceAccessory`,
  `AuditSession`, `DeviceSnapshot`, `AccessorySnapshot`, `AuditDetail`, `Notification` đều **chưa có**
  → cần ít nhất một đợt mở rộng schema + migration trước khi làm được tuần 09.
- **Chưa có module Notification**, chưa có cơ chế polling nào ở frontend.
- **Chưa có Modal/Toast** — các luồng duyệt/từ chối sẽ cần; hiện đang dùng `window.confirm`.
- **Chưa deploy HTTPS** — màn quét QR bằng camera (`html5-qrcode`) bắt buộc chạy trên HTTPS.
- Frontend `/transfers` và `/audit` hiện là trang "đang phát triển"; `AllocateRecoverPage` thực chất
  chỉ là form thêm tài sản rút gọn, **chưa có luồng cấp phát/thu hồi thật**.

Đề xuất: hoặc dời lịch các tuần 09–11, hoặc chèn thêm một tuần "mở rộng ERD + migration cho thiết bị".

---

## 6. Không kiểm chứng được trong repo (không kết luận đúng/sai)

- Tuần 01–03 (onboarding, ACH/IBFT, phỏng vấn, khảo sát) — hoàn toàn ngoài repo.
- "15 yêu cầu chức năng", "25 use case", mã `F-001` → `F-015`, độ ưu tiên MUST/SHOULD/COULD.
- Package Diagram, Activity/Sequence Diagram, sơ đồ phân cấp chức năng trong báo cáo.
- Tên người tham gia và các buổi trao đổi với mentor/phòng ban.

---

## 7. Việc cần làm tiếp

1. Thống nhất tên hệ thống: **IDSM** hay **IDMS** — sửa đồng loạt trong báo cáo (repo đang dùng IDSM).
2. Sửa 4 điểm sai nặng: Argon2 → bcrypt; 4 vai trò → 3; "admin đặt lại mật khẩu hộ thay cho OTP" → OTP qua email; "đã deploy" → chưa deploy.
3. Viết lại nhật ký tuần 04 → 08 — bản đã soạn sẵn, dán thẳng được vào báo cáo:
   [`nhat-ky-cong-viec-ban-sua.md`](./nhat-ky-cong-viec-ban-sua.md).
4. Bổ sung các hạng mục ở mục 4 vào báo cáo (trải vào các tuần tương ứng).
5. Rà lại Package Diagram / sơ đồ kiến trúc backend cho khớp cấu trúc NestJS thật.
6. Cân nhắc dời lịch tuần 09–11 theo mục 5.
7. Đối chiếu tiếp với `docs/Changes.md` — file đó đã liệt kê các sửa đổi cần đưa vào UC-01/02/04/05/06 và ERD 3.2.1.
