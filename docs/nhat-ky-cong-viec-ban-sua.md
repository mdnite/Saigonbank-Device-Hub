# Nhật ký công việc — bản sửa để dán vào báo cáo

Tài liệu này là văn bản đã hoàn chỉnh, dùng để thay thế trực tiếp mục *2.1 Nhật ký công việc* (Bảng 1)
trong báo cáo thực tập, các tuần 04 đến 11. Nội dung dựa trên kết quả đối chiếu giữa báo cáo và
codebase thật thực hiện ngày 21/09/2026, chi tiết xem tại `docs/doi-chieu-nhat-ky-cong-viec.md`. Có
thể dán từng mục dưới đây thẳng vào Word mà không cần chỉnh sửa thêm.

## Mục A — Bốn chỗ phải sửa ngay

| Chỗ trong báo cáo | Đang ghi | Sửa thành |
|---|---|---|
| Dòng 26/08 — mã hoá mật khẩu | Argon2 | bcrypt (10 rounds) |
| Dòng 26/08 và 01/09 — số vai trò và phân quyền | 4 vai trò | 3 vai trò (`Quản trị viên`, `Trưởng phòng`, `Nhân viên`); hai trưởng phòng của các phòng ban khác nhau dùng chung vai trò `Trưởng phòng`, phân biệt bằng `DepartmentId` |
| Dòng 02/09 — chức năng đổi/đặt lại mật khẩu | Admin đặt lại mật khẩu hộ, thay cho email/OTP | Hệ thống dùng OTP 4 số gửi qua email (Resend); mã lưu dưới dạng hash SHA-256, hạn sử dụng 5 phút, tối đa 5 lần nhập sai, chỉ mã mới nhất còn hiệu lực; admin chỉ nhập mật khẩu ban đầu lúc tạo tài khoản |
| Dòng 28/08 — triển khai hạ tầng | Đã deploy lên Neon/Render/Vercel | Mới chốt phương án triển khai Neon + Render + Vercel, chưa thực hiện deploy |

## Mục B — Nhật ký tuần 04 → 08, bản viết lại

**Tuần 04 (24/08 – 28/08) — thiết kế và chuẩn bị**
1. Chốt đề cương IDSM, phạm vi và mốc triển khai.
2. Chốt stack: NestJS 11 + Prisma 7 + PostgreSQL (backend), React 18 + Vite 5 + Tailwind 3 (frontend).
3. Thiết kế kiến trúc: frontend DDD-lite 4 tầng cho mỗi module, backend NestJS chuẩn (`modules/` + `shared/`).
4. Chốt phương án triển khai Neon + Render + Vercel (chưa deploy).
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
4. 11/09 — tách repo thành `frontend/` + `backend/`: `frontend/` là npm workspace, `backend/` là project pnpm riêng.
5. 11/09 — viết `docs/CONTEXT.md`: bản đồ codebase, quy ước làm việc, danh sách placeholder.

**Tuần 07 (14/09 – 18/09) — dựng backend thật**
1. 17/09 — chốt ERD 4 bảng `Role` / `Department` / `User` / `PasswordResetToken`; viết `schema.prisma` map sang đúng tên cột PascalCase của ERD; migration `20260917140549_init_user_login` + seed.
2. 17/09 — module `identity`: đăng nhập bằng username hoặc email, JWT stateless (không bảng session), mật khẩu hash bcrypt.
3. 17/09 — luồng quên mật khẩu: OTP 4 số, lưu hash SHA-256, hạn 5 phút, tối đa 5 lần sai mỗi mã, chỉ mã mới nhất có hiệu lực; gửi email thật qua Resend.
4. 17/09 — chuẩn hoá response toàn hệ thống: `ResponseInterceptor` (bọc thành công) + `ApiExceptionFilter` (bắt mọi lỗi), envelope `{ success, data, error, message }`, message tiếng Việt.
5. 18/09 — nối frontend ↔ backend cho toàn bộ luồng auth: `HttpAuthRepository`, xoá repository mock, đăng xuất phía client, kiểm thử đầu-cuối với PostgreSQL thật và email thật.

**Tuần 08 (21/09 – 25/09) — quản lý người dùng và phân quyền**
1. `AuthGuard` dùng chung: xác thực JWT rồi đọc lại User + Role từ DB mỗi request, nhờ đó khoá/xoá/đổi vai trò có hiệu lực ngay mà vẫn không cần bảng session; decorator `@Roles`.
2. API quản lý người dùng (chỉ Quản trị viên): danh sách + tìm kiếm/lọc, tạo (admin nhập mật khẩu ban đầu, `IsVerified = false`), khoá/mở khoá, xoá mềm (không bao giờ xoá cứng); chặn tự khoá/tự xoá; API danh mục `/roles`, `/departments`.
3. Frontend: `/users` (danh sách + thao tác), `/users/new` (form tạo), guard `RequireAdmin`, ẩn mục "Người dùng" với vai trò khác; hồ sơ cá nhân chuyển sang `/settings`.
4. Tự động đăng xuất khi hết phiên: kiểm tra `exp` của JWT lúc mở app và tự đăng xuất khi API trả 401 trên request có token, kèm thông báo hết phiên.
5. Kiểm thử: 49 ca jest ở backend, 38 ca vitest ở frontend, kiểm thử đầu-cuối qua API trên PostgreSQL thật (khoá tài khoản → request kế tiếp 401 ngay; xoá mềm → biến khỏi danh sách nhưng dòng vẫn còn trong DB).

## Mục C — Hạng mục bị bỏ sót, nên chèn vào các tuần tương ứng

- Chốt ERD 4 bảng (`Role`, `Department`, `User`, `PasswordResetToken`) và ánh xạ `schema.prisma` sang đúng tên cột PascalCase của ERD, kèm ràng buộc unique cho username, email và `DepartmentCode`. Đề xuất chèn vào tuần 07.
- Áp dụng quy tắc không bao giờ xoá cứng bản ghi `User`, chỉ đổi trường Status sang trạng thái khoá; có kiểm thử chặn việc gọi trực tiếp `prisma.user.delete`. Đề xuất chèn vào tuần 08.
- Xây dựng luồng quên mật khẩu bằng OTP vượt yêu cầu ban đầu: mã 4 số lưu dưới dạng hash SHA-256, hạn sử dụng 5 phút, tối đa 5 lần nhập sai, chỉ mã mới nhất còn hiệu lực. Đề xuất chèn vào tuần 07.
- Chuẩn hoá response toàn hệ thống bằng `ResponseInterceptor` và `ApiExceptionFilter` dùng chung, mọi API trả về đúng một khuôn dạng envelope. Đề xuất chèn vào tuần 07.
- Thiết kế `AuthGuard` đọc lại User và Role từ cơ sở dữ liệu ở mỗi request, nhờ đó việc khoá tài khoản hoặc đổi vai trò có hiệu lực ngay từ request kế tiếp mà không cần lưu trạng thái phiên đăng nhập. Đề xuất chèn vào tuần 08.
- Tự động chuyển `IsVerified` sang true ngay sau khi người dùng đặt lại mật khẩu thành công qua OTP. Đề xuất chèn vào tuần 07.
- Thêm cơ chế tự động đăng xuất khi phiên hết hạn: kiểm tra `exp` của JWT lúc mở ứng dụng, và tự đăng xuất khi API trả về 401 trên request có kèm token. Đề xuất chèn vào tuần 08.
- Xây dựng bộ kiểm thử tự động: 49 ca jest ở backend, 38 ca vitest trên 12 file ở frontend. Đề xuất chèn vào tuần 08.
- Dọn nợ kỹ thuật ngày 21/09: chặn giá trị id vượt phạm vi số nguyên int32, trả về 404 thay vì lỗi 500 từ Prisma; sửa hook xử lý lỗi 401 ở frontend. Đề xuất chèn vào tuần 08.
- Viết tài liệu kỹ thuật nội bộ: `docs/CONTEXT.md` (bản đồ codebase và quy ước làm việc) ở tuần 06; `docs/Changes.md` cùng các tài liệu đặc tả và kế hoạch trong `docs/superpowers/` ở tuần 08.
- Viết script kiểm thử đầu-cuối `backend/scripts/e2e-users.ps1`, chạy trực tiếp trên PostgreSQL thật để xác minh các hành vi mà kiểm thử jest (dùng cơ sở dữ liệu giả) không phủ tới: tìm kiếm không phân biệt hoa thường, thứ tự sắp xếp theo id, và việc khoá tài khoản làm mất hiệu lực token hiện có ngay ở request kế tiếp. Đề xuất chèn vào tuần 08.

## Mục D — Hai điểm cần thống nhất trước khi nộp

Tên hệ thống đã được chốt là **IDSM** vào ngày 22/09/2026. Mọi chỗ trong báo cáo đang ghi IDMS cần đổi
thành IDSM cho nhất quán với repo và tài liệu kỹ thuật. Ngoại lệ duy nhất, đã ghi rõ trong
`backend/README.md`, là role PostgreSQL `idms` và database `internal_device_management`: hai tên này
giữ nguyên vì đổi tên đòi hỏi tạo lại cả role lẫn database và chạy lại migration, không đáng so với lợi
ích. Chuỗi `idms` xuất hiện trong `DATABASE_URL` là tên role kỹ thuật, không phải tên hệ thống.

Package Diagram của backend trong báo cáo hiện vẽ theo kiến trúc DDD 4 tầng. Backend thật là NestJS
thuần, không chia theo 4 tầng đó: cấu trúc thực tế là `src/modules/{identity,users}` (mỗi module gồm
controller, service, DTO, module) cộng với `src/shared/{auth,http,mail,prisma,security}`. Sơ đồ trong
báo cáo cần vẽ lại theo đúng cấu trúc này.

## Mục E — Rủi ro lịch tuần 09 → 11

Kế hoạch tuần 09 đến 11 đang giả định những bảng dữ liệu chưa tồn tại. Cơ sở dữ liệu hiện chỉ có 4
bảng (`Role`, `Department`, `User`, `PasswordResetToken`); các bảng phục vụ quản lý thiết bị như
`Device`, `DeviceAccessory` và `AuditSession` chưa được tạo. Vì vậy các tuần này chưa thể triển khai
đúng như kế hoạch nếu không mở rộng schema trước. Cần chèn thêm một tuần dành riêng cho việc mở rộng
ERD và viết migration cho nhóm bảng thiết bị, trước khi bắt đầu các API và màn hình phụ thuộc vào
chúng ở tuần 09.
