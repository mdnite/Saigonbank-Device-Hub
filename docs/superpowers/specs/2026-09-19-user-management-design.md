# Spec: Quản lý người dùng + xác thực JWT cho API (xử lý việc còn mở)


## 1. Context
Sau b56da11 auth chạy với BE thật, còn mở:
1. Không có API/UI quản lý người dùng — admin chỉ tạo tài khoản bằng seed.
2. FE chưa gửi `Authorization`, không xử lý token hết hạn / 401.
3. `tsc --noEmit` BE còn 2 lỗi implicit-any trong `auth.spec.ts`.
4. `DepartmentCode` unique — **để sau, không làm đợt này**.
5. Cập nhật báo cáo BCTT-HKTT → gom vào `docs/Changes.md`.

## 2. Quyết định đã chốt (không hỏi lại)
| Chủ đề | Quyết định |
|---|---|
| Phạm vi | Danh sách + tìm/lọc, tạo tài khoản, khoá/mở khoá (Status), xoá mềm. **Không** sửa thông tin user. |
| Mật khẩu ban đầu | Admin tự nhập trong form tạo. |
| Role | `Quản trị viên` (chỉ quản lý user) · `Trưởng phòng` (TP Kế toán: tạo lệnh Kiểm kê sau này; TP Kỹ thuật: duyệt điều chuyển sau này — phân biệt bằng `DepartmentId`) · `Nhân viên`. Chỉ Quản trị viên vào quản lý user. |
| Phòng ban seed | `KYTHUAT` "Phòng Kỹ thuật", `KETOAN` "Phòng Kế toán". Bỏ `IT` khỏi seed; admin `departmentId = null`. |
| IsVerified | Admin tạo → `false`; đặt lại mật khẩu qua OTP thành công → `true`. Login vẫn cho vào; danh sách hiện badge "Chưa xác minh". |
| Route FE | `/users` = danh sách quản lý, `/users/new` = form tạo; màn cá nhân chuyển sang `/settings`. |
| UI | Code thẳng bằng UI kit sẵn có (+ skill `frontend-design`), không đụng Figma. Form = trang riêng; xác nhận khoá/xoá = `window.confirm` (ponytail: đổi sang Modal khi có). |
| Guard | **JWT + đọc User/Role từ DB mỗi request** — khoá/xoá/đổi role có hiệu lực ngay, vẫn không bảng session. |
| 401 FE | Tự đăng xuất + báo "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại"; kiểm `exp` JWT khi mở app. |
| Schema | **Không đổi** → không migration. |
| Song song | 3 agent / 3 worktree, ghép vào nhánh `feat/user-management`; không merge `main`, không push nếu chưa được bảo. |

## 3. API contract (cố định — BE và FE làm song song theo đúng bảng này)
Envelope giữ nguyên `{ success, data, error, message }`.

| Endpoint | Quyền | Input | Thành công | Lỗi |
|---|---|---|---|---|
| `POST /auth/login` | công khai | như cũ | `data.user` thêm `roleName: string` | như cũ |
| `GET /users` | Admin | query `search?`, `status?`, `roleId?`, `departmentId?`. `search` khớp username/fullName/email, không phân biệt hoa thường. Không có `status` → loại "Đã xóa". | 200 `UserListItem[]` (sắp theo `id` tăng) | 400 query sai kiểu |
| `POST /users` | Admin | `{ username, email, fullName, password (≥6), roleId, departmentId? }` (trim; email chuyển thường) | 201 `UserListItem`, message "Đã tạo người dùng" | 409 "Tên đăng nhập đã tồn tại" / "Email đã tồn tại"; 400 "Vai trò không tồn tại" / "Phòng ban không tồn tại" / lỗi validate |
| `PATCH /users/:id/status` | Admin | `{ status: "Đang hoạt động" \| "Ngừng hoạt động" }` | 200 `UserListItem`, message "Đã cập nhật trạng thái" | 404 "Người dùng không tồn tại" (kể cả đã xoá); 400 "Không thể tự khoá tài khoản của mình" |
| `DELETE /users/:id` | Admin | — | 200 `data: null`, "Đã xoá người dùng" (Status = "Đã xóa", row giữ nguyên) | 404; 400 "Không thể tự xoá tài khoản của mình" |
| `GET /roles` | đã đăng nhập | — | `{ id, roleName }[]` | |
| `GET /departments` | đã đăng nhập | — | `{ id, departmentCode, departmentName }[]` | |

```ts
UserListItem = {
  id: number; username: string; fullName: string; email: string;
  status: string; isVerified: boolean; createdAt: string;
  role: { id: number; roleName: string };
  department: { id: number; departmentCode: string; departmentName: string } | null;
}  // KHÔNG BAO GIỜ có password
```
Lỗi xác thực chung: thiếu/sai/hết hạn token, hoặc user của token không tồn tại / không "Đang hoạt động" → **401 "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại"**. Sai role → **403 "Bạn không có quyền thực hiện thao tác này"**.

## 4. Thiết kế Backend (Agent A — nhánh `wt/be-users`)
- `src/modules/identity/roles.ts`: `ROLE = { ADMIN: 'Quản trị viên', HEAD: 'Trưởng phòng', STAFF: 'Nhân viên' } as const` (cùng kiểu `user-status.ts`).
- **Auth dùng chung** `src/shared/auth/`: chuyển `JwtModule.registerAsync` từ `identity.module.ts` sang `auth.module.ts` (`@Global`, export `JwtModule`). `auth.guard.ts`: đọc `Bearer`, `jwt.verifyAsync`, `prisma.user.findUnique({ where: { id }, include: { role: true } })`, không ACTIVE → 401; metadata `@Roles(...)` (`roles.decorator.ts`) không khớp `role.roleName` → 403; gắn `req.user`. Dùng `@UseGuards(AuthGuard)` ở controller (không global — `/auth/*` vẫn công khai).
- **Login**: `include: { role: true }`, trả thêm `roleName`. Payload JWT giữ `{ userId, roleId }`.
- **Module `src/modules/users/`**: `users.module.ts`, `users.controller.ts` (cả `/users`, `/roles`, `/departments`), `users.service.ts`, `users.dto.ts` (class-validator, message tiếng Việt, `@Type(() => Number)` cho id/query). Tái dùng `hashPassword`, `USER_STATUS`, `@ResponseMessage`. Kiểm trùng username/email trước khi tạo (409) — bắt thêm Prisma `P2002` phòng race. Không có code path `user.delete*`. Self-check (`req.user.id === id`) → 400.
  - ponytail comment: không phân trang; user "Đã xóa" vẫn giữ username/email unique → không tạo lại được cùng email.
- **IsVerified**: `password-reset.service.ts` `resetPassword` update thêm `isVerified: true`.
- **Seed** `prisma/seed.ts`: 3 role (findFirst-or-create), 2 phòng ban upsert, admin role Quản trị viên / `departmentId: null`; `dev` role Nhân viên, phòng Kỹ thuật.
- **tsc**: sửa 2 lỗi implicit-any `auth.spec.ts`.
- **Test (TDD)**: tách `createFakePrisma` → `src/test/fake-prisma.ts` (thêm `findMany`, `create`, role/department, `include`) dùng chung. `users.spec.ts` phủ: 401 không token / token user bị khoá / đã xoá; 403 Nhân viên; list ẩn Đã xóa, lọc status/search; tạo OK (isVerified false, không lộ password, password hash); 409 trùng username / email; 400 role không tồn tại; khoá → mở; tự khoá/tự xoá 400; xoá mềm (row còn, login sau đó 401); `/roles` `/departments` với Nhân viên OK. `auth.spec.ts` thêm: login trả `roleName`; reset password → `isVerified = true`.
- Done khi: `pnpm test`, `pnpm build`, `pnpm lint`, `npx tsc --noEmit` sạch.

## 5. Thiết kế Frontend (Agent B — nhánh `wt/fe-users`)
- **`shared/lib/apiClient.ts`**: `apiRequest<T>(method, path, body?)` + `apiGet/apiPost/apiPatch/apiDelete` mỏng (giữ chữ ký `apiPost` hiện có). `configureApiSession({ getToken, onUnauthorized })` gọi từ `SessionProvider`. Có token → header `Authorization: Bearer`. **401 trên request có token** → `onUnauthorized()` rồi vẫn ném lỗi (login sai mật khẩu không có token nên không bị ảnh hưởng). GET query dựng bằng `URLSearchParams`, bỏ giá trị rỗng.
- **Session** (`app/session/SessionContext.tsx`, `modules/auth/domain/session.ts`): `AuthSession` thêm `roleName`. `readStored` decode `exp` (atob payload, không thêm thư viện); hết hạn / thiếu `roleName` / hỏng → bỏ + xoá storage. `signOut(reason?: 'expired')`; lưu `notice` trong context, `LoginPage` hiện rồi xoá sau khi đăng nhập. `HttpAuthRepository` map `user.roleName`.
- **Phân quyền**: `isAdmin(session)` (so `roleName === 'Quản trị viên'`, hằng số trong `modules/auth/domain/session.ts`). `Sidebar` lọc nav "Người dùng"; route `/users*` bọc `RequireAdmin` (không admin → `<Navigate to="/dashboard">`).
- **Router**: `/settings` → `UserSettingsPage` (breadcrumb Trang chủ / Cài đặt); `/users` → `UserListPage`; `/users/new` → `CreateUserPage`.
- **Module `user`** (thêm vào module sẵn có, đúng 4 lớp):
  - `domain/userAccount.ts`: `UserAccount` (= `UserListItem`), `NewUserDraft`, `validateNewUser` (username, họ tên bắt buộc; email hợp lệ qua `Email.isValid` từ `modules/auth/domain/credentials.ts`; mật khẩu ≥ `PASSWORD_MIN_LENGTH` + nhập lại khớp; role bắt buộc) + test.
  - `application/UserAdminRepository.ts`: port + `makeUserAdminService` + `UserAdminValidationError` (theo mẫu `DeviceRepository.ts`).
  - `infrastructure/HttpUserAdminRepository.ts` + đăng ký trong `container.ts` + test (fetch giả như `HttpAuthRepository.test.ts`).
  - `presentation/UserListPage.tsx`: `PageHeader` + "Thêm người dùng"; `SearchInput` + 3 `Select` (trạng thái gồm cả "Đã xóa", vai trò, phòng ban); `DataTable` cột Tên đăng nhập · Họ tên · Email · Vai trò · Phòng ban · Trạng thái (`Badge` + "Chưa xác minh") · thao tác Khoá/Mở khoá + Xoá (`window.confirm`, ẩn ở dòng của chính mình và dòng đã xoá); lỗi thao tác hiện inline; reload list sau thao tác.
  - `presentation/CreateUserPage.tsx`: theo mẫu `AssetFormPage` (`Field`, `Input`, `Select`, hook draft + validate), dropdown role/phòng ban từ API; lỗi BE (409) ở dòng lỗi chung; xong → `/users`.
- **Test**: apiClient (header, 401 có token gọi handler, 401 không token không gọi, query string), `readStored` hết hạn, `validateNewUser`, `HttpUserAdminRepository`, `Sidebar.test.tsx` (ẩn/hiện nav theo role). Dùng `MemoryRouter`.
- Done khi: `npm test`, `npm run build`, `npm run lint` sạch.

## 6. Docs (Agent C — nhánh `wt/docs-changes`)
`docs/Changes.md` (tiếng Việt) — nội dung cần chép vào báo cáo BCTT-HKTT:
- UC-01: 403 "Tài khoản đã bị khoá" (kiểm mật khẩu trước); "Đã xóa" trả 401 như sai mật khẩu; response login có `roleName`.
- UC-02: từ chối tài khoản không "Đang hoạt động" (404 "Email không tồn tại"); OTP 4 số / 5 phút / tối đa 5 lần sai / chỉ mã mới nhất; đặt lại thành công → `IsVerified = true`.
- UC-04/05/06 theo mục 3: tạo (admin nhập mật khẩu, IsVerified=false), khoá/mở khoá, xoá mềm, không tự khoá/xoá; khoá có hiệu lực ngay.
- Danh sách role + ý nghĩa; phòng ban Kỹ thuật / Kế toán.
- ERD 3.2.1: bảng `PasswordResetToken` + `User.IsVerified/CreatedAt/UpdatedAt`, kèm **DBML** khớp `backend/prisma/schema.prisma`.
- Còn treo: DepartmentCode unique chưa xác nhận.

## 7. Tích hợp (main thread)
1. `feat/user-management` từ `main`; merge `wt/be-users` → `wt/fe-users` → `wt/docs-changes`.
2. Cập nhật `docs/CONTEXT.md` (§1 apiClient/Authorization, §2 helper, §3 route, §4 placeholder mới/bỏ mục đã xong, §5 điểm 1 đã giải quyết, §6 401/exp), `backend/README.md` (bảng API), `frontend/README.md`, `README.md` (tài khoản dev), memory.
3. Chạy toàn bộ verification + `superpowers:requesting-code-review`.
4. DB local: seed không xoá phòng `IT` cũ → đề xuất `npx prisma migrate reset` (xoá dữ liệu dev, `dev` về `Dev@1234`) — **hỏi trước khi chạy**.
5. Không merge `main`, không push cho tới khi người dùng bảo.

## 8. Verification
- BE: `pnpm test`, `pnpm build`, `pnpm lint`, `npx tsc --noEmit` sạch. FE: `npm test`, `npm run build`, `npm run lint` sạch.
- E2E tay (BE :3000 + FE :5173, PG18 thật):
  1. admin login → thấy "Người dùng"; tạo user Trưởng phòng / Kế toán → có trong list, badge "Chưa xác minh".
  2. Tạo trùng username/email → báo 409.
  3. Login user mới (tab ẩn danh) → không thấy "Người dùng", `/users` về `/dashboard`; `/settings` là màn cá nhân.
  4. Admin khoá user → request tiếp của user trả 401 → về `/login` kèm thông báo hết phiên; login lại → "Tài khoản đã bị khoá".
  5. Xoá mềm → biến khỏi list, lọc "Đã xóa" thấy lại; row còn trong DB (psql).
  6. Token hết hạn trong localStorage → F5 → về `/login` kèm thông báo.
  7. `dev` quên mật khẩu → OTP → đặt lại → `IsVerified = true` (psql).
