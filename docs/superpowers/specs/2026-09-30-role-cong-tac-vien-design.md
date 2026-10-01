# Spec: Role Cộng tác viên, phân lại quyền và trạng thái "Đang chờ duyệt"

> Chốt ngày 2026-09-30 qua brainstorming, **bổ sung 2026-10-01** (phần B), trên branch `main`
> (user-management, quản lý thiết bị, Cấp phát - Thu hồi, Điều chuyển đều đã merge). Phần A phân
> lại quyền; phần B khoá thiết bị khi đang nằm trong đơn/lệnh chờ duyệt và bỏ mọi đường gán người
> giữ thiết bị ngoài đơn/lệnh. Không thêm màn hình mới.

## 1. Context

Hệ thống có 3 role (`Quản trị viên`, `Trưởng phòng`, `Nhân viên`); `Trưởng phòng` phân biệt Kỹ thuật /
Kế toán bằng `User.DepartmentId`. Hiện trạng quyền:

| Việc | Đang là |
|---|---|
| Thêm/sửa/xoá mềm thiết bị | Quản trị viên, TP Kỹ thuật (`DeviceWriteGuard`) |
| Dọn thùng rác thiết bị | Quản trị viên |
| Tạo đơn Cấp phát - Thu hồi | TP Kỹ thuật |
| Duyệt đơn Cấp phát - Thu hồi | Quản trị viên |
| Tạo lệnh Điều chuyển | Quản trị viên |
| Duyệt lệnh Điều chuyển | TP Kỹ thuật |

Yêu cầu: thêm role **Cộng tác viên** (CTV). CTV Kỹ thuật nhận phần việc "làm" (thêm/sửa thiết bị, tạo
đơn, tạo lệnh); Trưởng phòng Kỹ thuật chỉ còn "duyệt" (và vẫn thêm/sửa/xoá thiết bị); Quản trị viên
rút khỏi nghiệp vụ thiết bị, chỉ quản lý người dùng và xem. CTV Kế toán sẽ khởi tạo và đối soát kiểm
kê — luồng kiểm kê chưa có nên vòng này chỉ ghi nhận.

Hệ quả phát hiện khi rà plan: form thiết bị cho đặt thẳng **Người sở hữu**, **Đơn vị quản lý**, **ngày
cấp phát**, còn API cho đặt cả **Trạng thái** — tức người được sửa thiết bị có thể gán thiết bị cho
người khác mà không qua đơn/lệnh, bỏ qua bước duyệt của TP. Phần B đóng lỗ này.

## 2. Quyết định đã chốt (không hỏi lại)

### Phần A — role và quyền

| # | Quyết định |
|---|---|
| A1 | Một role chung `Cộng tác viên`; Kỹ thuật / Kế toán phân biệt bằng `departmentCode` (`KYTHUAT` / `KETOAN`) — cùng cách `Trưởng phòng`. |
| A2 | **Thêm/sửa thiết bị**: TP Kỹ thuật **và** CTV Kỹ thuật. Quản trị viên không còn. |
| A3 | **Xoá mềm thiết bị + dọn thùng rác**: chỉ TP Kỹ thuật. CTV và Quản trị viên không. |
| A4 | **Tạo** đơn Cấp phát - Thu hồi và lệnh Điều chuyển: chỉ CTV Kỹ thuật. |
| A5 | **Duyệt/từ chối** cả hai luồng: chỉ TP Kỹ thuật. Quản trị viên không còn duyệt đơn Cấp phát - Thu hồi. |
| A6 | **Xem** danh sách/chi tiết hai luồng (kể cả in biên bản): Quản trị viên, TP Kỹ thuật, CTV Kỹ thuật. CTV thấy **tất cả** đơn/lệnh, không lọc theo người tạo. |
| A7 | Tạo user role `Trưởng phòng` hoặc `Cộng tác viên` **bắt buộc có phòng ban** — kiểm ở cả BE (400) lẫn FE. |
| A8 | Backend dùng **một cơ chế `@Allow(...actor)`** thay cho 5 guard theo miền và `@Roles`. |
| A9 | CTV Kế toán: tạo được tài khoản, vòng này quyền ngang `Nhân viên`. |

### Phần B — thiết bị chỉ đổi người giữ qua đơn/lệnh

| # | Quyết định |
|---|---|
| B1 | "Yêu cầu" đổi người giữ thiết bị **chính là** đơn Cấp phát / Thu hồi và lệnh Điều chuyển đã có — không thêm loại yêu cầu mới. |
| B2 | Trạng thái thiết bị mới, lưu nguyên văn: **`Đang chờ duyệt`**. Đặt khi tạo đơn/lệnh, **khoá** thiết bị: không đưa được vào đơn/lệnh khác, không sửa, không xoá mềm. Duyệt → trạng thái đích; từ chối → trạng thái cũ. Đảo lại quyết định #6 "không giữ chỗ thiết bị" của spec `2026-09-24-cap-phat-thu-hoi-design.md`. |
| B3 | **Không ai** (kể cả TP Kỹ thuật) đổi thẳng Người sở hữu / Trạng thái / ngày cấp phát qua API hay form thiết bị. Thiết bị mới luôn `Trong kho`. |
| B4 | **Bỏ hẳn việc gắn thiết bị với phòng ban**: xoá cột `Device.DepartmentId`. Thiết bị chỉ biết ai đang giữ; phòng ban của người giữ xem ở luồng Người dùng. |
| B5 | `Chờ thanh lý` ngoài phạm vi (ghi nợ). Sau vòng này không còn API nào đặt được trạng thái đó. |

Ma trận quyền sau vòng này:

| Việc | Quản trị viên | TP Kỹ thuật | CTV Kỹ thuật | Còn lại |
|---|---|---|---|---|
| Quản lý người dùng | ✅ | – | – | – |
| Xem thiết bị | ✅ | ✅ | ✅ | ✅ |
| Thêm/sửa thiết bị (thông tin, không gồm người giữ/trạng thái) | – | ✅ | ✅ | – |
| Xoá mềm + dọn thùng rác thiết bị | – | ✅ | – | – |
| Xem đơn / lệnh | ✅ | ✅ | ✅ | – |
| Tạo đơn / lệnh | – | – | ✅ | – |
| Duyệt / từ chối đơn / lệnh | – | ✅ | – | – |

"Còn lại" = `Nhân viên`, TP Kế toán, CTV Kế toán, và TP/CTV không có phòng ban (chỉ còn ở dữ liệu cũ).

**Hệ quả đã chấp nhận:** chỉ TP Kỹ thuật duyệt được đơn/lệnh và xoá được thiết bị. Nếu tài khoản TP
Kỹ thuật duy nhất bị khoá, hai luồng đứng (và thiết bị trong đơn/lệnh đang chờ bị khoá) cho tới khi
Quản trị viên mở khoá hoặc tạo TP khác.

## 3. Role và dữ liệu

- `backend/src/modules/identity/roles.ts`: thêm `COLLAB: 'Cộng tác viên'` (đặt cuối để seed trên DB
  trống vẫn cho `Nhân viên` id 3) và `DEPARTMENT_REQUIRED_ROLES = [HEAD, COLLAB]`.
- Role mới **không cần migration**: `prisma/seed.ts` lặp `Object.values(ROLE)` kiểu findFirst-or-create.
- Seed thêm 2 tài khoản dev (upsert theo `username`, `isVerified: true`, `Đang hoạt động`):

  | username | Mật khẩu | Role | Phòng ban |
  |---|---|---|---|
  | `truongphong.kt` | `Head@1234` | Trưởng phòng | KYTHUAT |
  | `ctv.kt` | `Collab@1234` | Cộng tác viên | KYTHUAT |

  Email `<username>@saigonbank.com.vn`. Seed đã từ chối chạy khi `NODE_ENV=production`.
- Phần B cần **2 migration** (mục 6.4).

## 4. Backend — quyền (phần A)

### 4.1 `shared/auth/actors.ts` (mới)

```ts
export const TECH_DEPARTMENT_CODE = 'KYTHUAT';
export type Actor = (user: AuthUser) => boolean;
export const ACTOR = {
  ADMIN: (u) => u.roleName === ROLE.ADMIN,
  TECH_HEAD: (u) => u.roleName === ROLE.HEAD && u.departmentCode === TECH_DEPARTMENT_CODE,
  TECH_COLLAB: (u) => u.roleName === ROLE.COLLAB && u.departmentCode === TECH_DEPARTMENT_CODE,
} satisfies Record<string, Actor>;
export const ALLOW_KEY = 'allow';
export const Allow = (...actors: Actor[]) => SetMetadata(ALLOW_KEY, actors);
```

### 4.2 `AuthGuard`

Đọc `ALLOW_KEY` thay `ROLES_KEY` qua `reflector.getAllAndOverride` (`@Allow` ở handler **ghi đè**
class); có metadata mà không actor nào khớp → `ForbiddenException('Bạn không có quyền thực hiện thao
tác này')`. Không có metadata → mọi user đã đăng nhập đều qua.

### 4.3 Xoá

`device-write.guard.ts`, `order-access.guard.ts`, `order-create.guard.ts`, `transfer-access.guard.ts`,
`transfer-decide.guard.ts`, `roles.decorator.ts`.

### 4.4 Quyền từng endpoint

| Endpoint | `@Allow` |
|---|---|
| `GET /devices`, `GET /devices/:id`, `GET /device-types` | không có |
| `POST /devices`, `PATCH /devices/:id` | `TECH_HEAD, TECH_COLLAB` |
| `DELETE /devices/:id`, `POST /devices/purge` | `TECH_HEAD` |
| `DeviceOrdersController`, `DeviceTransfersController` (class) | `ADMIN, TECH_HEAD, TECH_COLLAB` |
| `POST /device-orders`, `POST /device-transfers` | `TECH_COLLAB` |
| `PATCH …/approve`, `…/reject` (cả hai) | `TECH_HEAD` |
| `UsersController` (class, gồm `/users/purge`) | `ADMIN` |
| `LookupController` (`/roles`, `/departments`, `/users/lookup`) | không có |

### 4.5 Bắt buộc phòng ban khi tạo user

`users.service.create`: role là `Trưởng phòng`/`Cộng tác viên` mà `departmentId == null` (thiếu **hoặc**
`null` tường minh — `@IsOptional` cho cả hai lọt DTO) → 400 `Vui lòng chọn phòng ban`. Không ràng
buộc chiều ngược lại. Không sửa user đã tồn tại.

## 5. Frontend — quyền (phần A)

### 5.1 `modules/auth/domain/session.ts`

Thêm `COLLAB_ROLE`, `isTechCollab`; giữ tên helper, đổi thân:

| Helper | Trả `true` khi |
|---|---|
| `canWriteDevices` | TP Kỹ thuật hoặc CTV Kỹ thuật |
| `canDeleteDevices` (mới) | TP Kỹ thuật |
| `canAccessOrders`, `canAccessTransfers` | Quản trị viên, TP Kỹ thuật, CTV Kỹ thuật |
| `canCreateOrder`, `canCreateTransfer` | CTV Kỹ thuật |
| `canDecideOrder`, `canDecideTransfer` | TP Kỹ thuật |

### 5.2 Route guard

Một component `RequireCan({ can, to = '/dashboard' })` thay `RequireAdmin`, `RequireOrderAccess`,
`RequireTransferAccess`. Bọc thêm: `/devices/new`, `/devices/:id/edit` (`canWriteDevices` → `/devices`),
`/allocation/new` (`canCreateOrder` → `/allocation`), `/transfers/new` (`canCreateTransfer` →
`/transfers`). Không dựng trang xem chi tiết chỉ-đọc; người chỉ-đọc xem thiết bị qua bảng danh sách.

### 5.3 Danh mục thiết bị

Nút thêm và 👁/sửa theo `canWriteDevices`; nút xoá và "Dọn thùng rác" theo `canDeleteDevices`.

### 5.4 Tạo người dùng

`validateNewUser(d, roleName?)`: role `Trưởng phòng`/`Cộng tác viên` mà chưa chọn phòng ban → lỗi
`Vui lòng chọn phòng ban` ở ô Phòng ban. Hint ô: "Trưởng phòng / Cộng tác viên được phân biệt theo
phòng ban".

## 6. Thiết bị chỉ đổi người giữ qua đơn/lệnh (phần B)

### 6.1 Trạng thái thiết bị

`DEVICE_STATUS` (BE và FE) thêm `PENDING_APPROVAL: 'Đang chờ duyệt'`. Có trong bộ lọc danh mục; badge
tone `neutral`. Cột `Device.Status` là `VarChar(50)` — đủ chỗ, không đổi kiểu.

### 6.2 Vòng đời thiết bị trong đơn/lệnh

| Bước | Cấp phát | Thu hồi | Điều chuyển |
|---|---|---|---|
| Tạo — điều kiện | `Trong kho` | `Đã cấp phát`, người nhận đơn đang giữ | `Đã cấp phát`, người giao đang giữ |
| Tạo — ghi | → `Đang chờ duyệt` | → `Đang chờ duyệt` | → `Đang chờ duyệt` |
| Duyệt — điều kiện | `Đang chờ duyệt` | `Đang chờ duyệt`, người nhận đơn đang giữ | `Đang chờ duyệt`, người giao đang giữ |
| Duyệt — ghi | `Đã cấp phát`, người giữ = người nhận, ngày cấp = hôm nay | `Trong kho`, bỏ người giữ, bỏ ngày cấp | `Đã cấp phát`, người giữ = người nhận, ngày cấp = hôm nay |
| Từ chối — ghi | → `Trong kho` | → `Đã cấp phát` | → `Đã cấp phát` |

- **Tạo**: kiểm điều kiện như hiện nay; thiết bị đang `Đang chờ duyệt` → 400 `Thiết bị "<mã>" đang chờ
  duyệt ở đơn/lệnh khác`. Rồi trong **một transaction**: ghi từng thiết bị bằng `updateMany` có điều
  kiện (where lặp lại điều kiện tạo), `count = 0` → 400 với thông báo không hợp lệ hiện có (`không còn
  trong kho` / `không do người này đang giữ`); sau đó tạo đơn/lệnh. Chặn hai đơn/lệnh tạo gần như đồng
  thời cùng nhắm một thiết bị.
- **Duyệt**: như hiện nay (ghi thiết bị có điều kiện, rồi `decide` có điều kiện), chỉ đổi điều kiện
  sang bảng trên; `count = 0` → 400 `Thiết bị "<mã>" không còn ở trạng thái chờ duyệt`. Không ghi
  `departmentId` nữa (B4).
- **Từ chối**: trong một transaction: `decide` có điều kiện, rồi `updateMany` các thiết bị của đơn/lệnh
  **chỉ những thiết bị còn `Đang chờ duyệt`** về trạng thái cũ. Không đụng người giữ.

### 6.3 API thiết bị

- `CreateDeviceDto` bỏ `currentUserId`, `departmentId`, `allocatedOn`; thiết bị mới luôn `Trong kho`.
- `UpdateDeviceDto` bỏ `currentUserId`, `departmentId`, `allocatedOn`, `status`. Xoá
  `ASSIGNABLE_DEVICE_STATUSES`.
- `ValidationPipe` dùng `whitelist: true` (không `forbidNonWhitelisted`) nên gửi kèm các field trên bị
  **lờ đi**, không lỗi.
- `PATCH /devices/:id` và `DELETE /devices/:id` trên thiết bị `Đang chờ duyệt` → 400 `Thiết bị đang chờ
  duyệt, không thể sửa hoặc xoá`.
- `GET /devices` bỏ bộ lọc `departmentId`; item thiết bị bỏ field `department`.

### 6.4 Schema và dữ liệu cũ

- Migration 1 (`device_pending_approval`, chỉ SQL dữ liệu): thiết bị đang nằm trong đơn/lệnh `Chờ duyệt`
  **và** vẫn đúng điều kiện tạo của đơn/lệnh đó → `Đang chờ duyệt`. Nhờ vậy duyệt/từ chối đơn/lệnh cũ
  chạy đúng luồng mới.
- Migration 2 (`drop_device_department`): xoá cột `Device.DepartmentId` (kèm FK) và quan hệ ngược
  `Department.devices` trong schema.
- **Giới hạn đã biết (dữ liệu cũ)**: thiết bị từng nằm cùng lúc trong nhiều đơn/lệnh chờ duyệt (được
  phép trước vòng này) chỉ được giữ chỗ cho một; TP nên từ chối bớt đơn/lệnh trùng trước khi duyệt.

### 6.5 Frontend

- Form thiết bị bỏ ô **Đơn vị quản lý**, ô **Người sở hữu**, mục **Đã cấp phát** (checkbox + ngày).
  `DeviceDraft` bỏ `departmentId`, `currentUserId`, `allocated`, `allocatedOn`; `toBody` không gửi các
  field đó.
- Form chỉ còn nạp danh mục loại thiết bị; `DeviceRepository` bỏ `departments()` và `users()`;
  `DeviceQuery` bỏ `departmentId`; type `Device` bỏ `department`, xoá `DepartmentRef`.
- Danh mục vẫn hiện cột Người sở hữu. Trang tạo đơn/lệnh không đổi (đã chỉ liệt kê thiết bị `Trong
  kho` / `Đã cấp phát` của người liên quan, nên tự loại thiết bị `Đang chờ duyệt`).

## 7. Kiểm thử

**Backend (jest):**
- `actors.spec.ts`: ma trận 3 actor × role/phòng ban, gồm CTV Kế toán, TP/CTV không phòng ban.
- Spec 4 module theo bảng 4.4 và mục 4.5: Admin ghi thiết bị → 403; CTV xoá → 403; Admin duyệt → 403;
  TP tạo đơn/lệnh → 403; CTV tạo → 201; TP duyệt → 200; `@Allow` handler thu hẹp class; tạo TP/CTV thiếu
  phòng ban (kể cả `null`) → 400.
- Vòng đời 6.2: tạo → `Đang chờ duyệt`; đơn/lệnh thứ hai cùng thiết bị → 400; race lúc tạo (chèn tạo
  đơn khác vào giữa kiểm tra và ghi) → 400, không ghi đè; từ chối trả đúng trạng thái cho cả 3 ô; dữ
  liệu cũ chưa giữ chỗ → duyệt 400.
- API thiết bị 6.3: field người giữ/trạng thái bị lờ; sửa/xoá thiết bị đang chờ → 400.
- Dữ liệu nền "Đã cấp phát" trong unit test dựng thẳng trong fake Prisma.

**Frontend (vitest):** `session.test.ts`, `RequireCan.test.tsx`, `DeviceCatalogPage.test.tsx`, hai
trang danh sách đơn/lệnh, `userAccount.test.ts`, `deviceDraft.test.ts`, `HttpDeviceRepository.test.ts`.

**E2E (`backend/scripts/e2e-*.ps1`):** đổi actor theo ma trận mới (script tự tạo tài khoản TP/CTV qua
API, tra id role `Cộng tác viên` theo tên); thiết bị "Đã cấp phát" dựng bằng đơn Cấp phát do CTV tạo,
TP duyệt; kiểm `Đang chờ duyệt` trên DB thật; `e2e-users.ps1` thêm case thiếu phòng ban.

**Lệnh xác nhận:** BE `npm test` + `npm run lint`; FE `npm test` + `npm run lint` (`tsc -b --noEmit`) +
`npm run build`.

## 8. Tài liệu

- `docs/CONTEXT.md`: ma trận quyền, `@Allow`/`ACTOR`, `RequireCan`, vòng đời trạng thái thiết bị, form
  thiết bị đã bỏ các ô gán người giữ, tài khoản seed.
- `docs/Changes.md`: role mới, phân lại quyền, bắt buộc phòng ban, trạng thái `Đang chờ duyệt`, ERD
  bỏ `Device.DepartmentId`.

## 9. Ngoài phạm vi

- Toàn bộ luồng kiểm kê. **Ghi nhận cho vòng đó:** thêm `ACTOR.ACCT_COLLAB` (`Cộng tác viên` +
  `KETOAN`) cho "khởi tạo kiểm kê" và "đối soát dữ liệu kiểm kê"; xem lại vai TP Kế toán (spec
  2026-09-19 từng ghi TP Kế toán tạo lệnh kiểm kê) — cần hỏi lại lúc đó.
- Luồng thanh lý (`Chờ thanh lý`).
- Sửa thông tin / đổi role / đổi phòng ban của user đã có.
- Lọc đơn/lệnh theo người tạo. Trang xem chi tiết thiết bị chỉ-đọc.
- Nợ cũ còn lại: user bị khoá (không phải đã xoá) vẫn được chọn làm người nhận đơn/lệnh. (Nợ "PATCH
  không xoá được field optional / không trả thiết bị về kho từ UI" **hết hiệu lực**: việc đó giờ là đơn
  Thu hồi.)
