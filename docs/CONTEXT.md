# IDSM — Context & Conventions

> Bản đồ codebase + quy ước làm việc cho **IDSM** (phần mềm quản lý thiết bị nội bộ SaigonBank).
> Phần lớn frontend vẫn được dựng từ bộ ảnh Figma **cũ** (15 PNG export, xem mục 3); module
> **auth đã được đồng bộ lại từ Figma mới** (đọc trực tiếp qua node-id — quyền đọc Figma đã
> hoạt động từ 2026-09-11, xem mục 5). Các module còn lại (dashboard/device/user) sẽ được đồng
> bộ dần khi tới lượt. Tài liệu này mô tả *trạng thái đang có*, không phải mục tiêu.
>
> Cập nhật lần cuối: 2026-09-17 (backend `identity` đã dựng, bỏ thư mục `database/` — migration
> chuyển về `backend/prisma/migrations`). Trước đó 2026-09-11: tách repo thành `frontend/` +
> `backend/`, cập nhật module Xác thực theo Figma mới — xem mục 3, 4.

> **Bố cục repo:** `frontend/` (React app, npm workspace, vẫn chạy mock — chưa nối backend) ·
> `backend/` (NestJS + Prisma, project pnpm riêng, xem `backend/README.md`; schema + migration ở
> `backend/prisma/`). **Mọi đường dẫn code trong tài liệu này đều tính từ
> `frontend/`** — ví dụ `src/app/router.tsx` = `frontend/src/app/router.tsx`. Chạy lệnh:
> `npm install` rồi `npm run dev` **từ gốc repo** (alias sang `-w frontend`).

---

## 0. Quy ước làm việc

### Nguồn sự thật
- Giao diện: Figma `OuDy5KuU8mWCWiFvdrU0jZ`. Đọc frame qua node-id được đưa, không tự bịa
  layout, không tự thêm màn.
- Dữ liệu: ERD 3.2.1 trong báo cáo BCTT-HKTT (ngoài repo); bản thực thi là
  `backend/prisma/schema.prisma`. Không tự thêm bảng/cột. Thiếu thì hỏi.

### Kiến trúc (pragmatic DDD — 4 lớp mỗi module)
`frontend/src/modules/<context>/`: `domain/` (model + rule thuần, có test) · `application/`
(port repository + service) · `infrastructure/` (repo mock + `container.ts`) · `presentation/`
(page/hook React). Dùng chung: `frontend/src/shared/{ui,layout,lib}/`.
`presentation` import service **từ `container.ts`**, không bao giờ `new` repository.
`domain`/`application` không import React, `infrastructure`, `presentation`.

### Quy tắc bắt buộc
1. Trước khi tạo component mới, tìm trong `src/shared/ui/`, `src/shared/layout/` và
   `presentation/` của module xem đã có chưa (xem mục 2). Có thì dùng lại.
2. KHÔNG hardcode dữ liệu trong component. Mọi dữ liệu đi qua repository/service:
   page → hook → service (`container.ts`) → repository. Chưa có API thì thêm method vào port
   `application/` và trả mock trong `infrastructure/InMemory<X>Repository.ts`, đánh dấu `// MOCK`.
3. Mọi nút phải có handler thật. Không để onClick rỗng, không để `href="#"`.
4. Trường có dấu `*` trong Figma là bắt buộc — validate ở `domain/` (hàm `validate<X>`) và
   chặn trước khi submit.
5. Sau mỗi task, liệt kê những chỗ còn là placeholder và lý do (bổ sung vào mục 4). Không im
   lặng bỏ qua.
6. Không chắc thì HỎI, đừng đoán.

---

## 1. Cấu trúc, framework, thư viện, state, API

### Stack

| Hạng mục | Lựa chọn |
|---|---|
| Build tool | **Vite 5** (`vite.config.ts`) |
| Framework | **React 18** (StrictMode, `createRoot`) |
| Ngôn ngữ | **TypeScript 5** (`strict`, `noUnusedLocals`, `noUnusedParameters`) |
| CSS | **Tailwind CSS 3** (`tailwind.config.js`, tokens tuỳ biến) + 1 file `src/styles/index.css` |
| Routing | **react-router-dom 6** — `createBrowserRouter` (data router) |
| Icons | **lucide-react** |
| Fonts | Google Fonts CDN trong `index.html` — **Inter** (body), **Poppins** (display) |
| Test | **Vitest 2** + jsdom + `@testing-library/react` + `@testing-library/jest-dom` |
| State mgmt | React local state + **1 Context** (`SessionContext`). Không có Redux/Zustand/RTK. |
| Data fetching | Không có. Mỗi module có **repository mock in-memory**. Không có `fetch`/axios/base URL. |

### Cấu trúc thư mục

```
frontend/                    npm workspace — the React app (paths below are under frontend/src/)
src/
  main.tsx                     Entry — SessionProvider > RouterProvider
  app/                         Composition root
    router.tsx                 Toàn bộ route (khai báo tập trung ở đây)
    NotFoundPage.tsx           404
    session/
      SessionContext.tsx       useSession() — session + signIn/signOut, lưu localStorage "idsm.session"
      RequireAuth.tsx          Guard: chưa đăng nhập -> <Navigate to="/login">
  shared/                      Dùng chung toàn app
    ui/                        Design-system kit (xem mục 2)
    layout/                    Khung màn hình (AppShell, AuthLayout, Sidebar, PageHeader, ComingSoonPage, navItems)
    lib/                       Helper thuần: cn, useAsyncData, useAsyncAction
  modules/<context>/           Mỗi bounded context = 4 lớp
    domain/                    Model + rule thuần, không import React/infra. Có unit test.
    application/               Port (interface repository) + service (make<X>Service) + <X>ValidationError
    infrastructure/            InMemory<X>Repository + container.ts (điểm ghép DI, export sẵn 1 service)
    presentation/              Page React, hook, mapping riêng cho UI
  styles/index.css             @tailwind + class .field-base, .bg-select-caret
  test/setup.ts                import '@testing-library/jest-dom/vitest'
```

Alias: **`@/` -> `frontend/src/`** (khai báo ở cả `frontend/vite.config.ts` và `frontend/tsconfig.app.json`).

### Quy tắc kiến trúc (pragmatic DDD)

- `presentation` import service **từ `infrastructure/container.ts`**, không bao giờ `new` repository.
- `domain` và `application` **không** import `presentation`, `infrastructure`, hay React.
- Đổi sang backend thật = viết `Http<X>Repository implements <X>Repository` + sửa 1 dòng trong `container.ts`.
- Validation nằm ở `domain` (hàm `validate<X>`), service gọi lại và ném `<X>ValidationError`.

### Cách "gọi API" hiện tại

Không có API thật. Luồng dữ liệu:

```
Page → hook (useAsyncData / useX) → service (container.ts) → InMemoryXRepository → setTimeout(...) → dữ liệu seed cứng
```

- `useAsyncData(loader, deps)` — load 1 lần, trả `{ data, loading, error }`, chạy lại khi `deps` đổi.
- `useAsyncAction(fn)` — bọc submit async, trả `{ run, pending, error }`.
- Mọi repository mock đều `await new Promise(r => setTimeout(r, 250–400))` để giả lập độ trễ.

### State

- **Phiên đăng nhập**: `SessionContext` (React Context), đồng bộ `localStorage["idsm.session"]`.
- **State màn hình**: `useState` cục bộ trong page; form dùng hook `useXDraft` (giữ `draft` + `errors`).
- Không có global store, không có cache layer, không có URL-state ngoài vài `?email=` ở luồng auth.

### Script

Chạy **từ gốc repo** (mỗi lệnh là alias sang `-w frontend`): `npm run dev` · `npm test`
(vitest run) · `npm run build` (tsc -b && vite build) · `npm run lint` (tsc -b --noEmit).
Cài thêm package cho frontend: `npm install <pkg> -w frontend`.

---

## 2. Component dùng chung

### `src/shared/ui/` — Design system kit

| Component | File | Props chính | Ghi chú |
|---|---|---|---|
| `Button` | `ui/Button.tsx` | `variant?: 'primary'\|'soft'\|'dark'\|'outline'\|'ghost'\|'link'` (mặc định `primary`), `size?: 'sm'\|'md'` (mặc định `md`), `leadingIcon?: ReactNode`, + mọi prop `<button>`. `type` mặc định `'button'`. | `forwardRef`. `link` bỏ padding/size. |
| `Card` | `ui/Card.tsx` | `<div>` bo góc `rounded-2xl`, border, `shadow-card`. | — |
| `CardSection` | `ui/Card.tsx` | `title?`, `actions?`, `children`, `className?` | Header có title + actions ở 2 đầu, padding `p-6`. |
| `Field` | `ui/Field.tsx` | `label?`, `htmlFor?`, `required?` (hiện dấu `*` đỏ), `hint?`, `error?` (đè hint), `children` | Wrapper label + control + dòng hint/error. |
| `Input` | `ui/inputs.tsx` | mọi prop `<input>` | `forwardRef`, class `field-base`. |
| `Textarea` | `ui/inputs.tsx` | mọi prop `<textarea>`, `rows` mặc định 3 | `forwardRef`, `resize-y`. |
| `Select` | `ui/inputs.tsx` | `placeholder?`, `options?: {value,label}[]`, + `children`, + props `<select>` | Có caret SVG (`bg-select-caret`). `placeholder` render `<option value="" disabled>`. |
| `Checkbox` | `ui/inputs.tsx` | `label?`, `id`, + props `<input>` (bỏ `type`) | Bọc trong `<label>`, click cả chữ. |
| `Radio` | `ui/inputs.tsx` | `label?`, `id`, + props `<input>` (bỏ `type`) | Như Checkbox. |
| `Badge` | `ui/Badge.tsx` | `tone?: 'ok'\|'warn'\|'danger'\|'neutral'\|'info'` (mặc định `neutral`), `children`, `className?` | Pill nhỏ, màu theo `status.*` / `card.blue`. |
| `DataTable<Row>` | `ui/DataTable.tsx` | `columns: Column<Row>[]`, `rows: Row[]`, `rowKey: (row)=>string`, `empty?: ReactNode`, `className?` | `Column = { key, header, cell:(row)=>ReactNode, align?, width? }`. Cuộn ngang, `min-w-[640px]`. **Không** có sort / phân trang / chọn dòng. |
| `Tabs` | `ui/Tabs.tsx` | `items: TabItem[]`, `active: string`, `onChange: (id)=>void`, `className?` | `TabItem = { id, label:ReactNode, badge?:ReactNode }`. Tab **ngang**, gạch chân. (Module `user` KHÔNG dùng cái này — nó tự làm rail dọc.) |
| `SearchInput` | `ui/SearchInput.tsx` | mọi prop `<input>` (`type="search"`) | Có icon kính lúp, `flex-1`. |

### `src/shared/layout/`

| Component | File | Props | Vai trò |
|---|---|---|---|
| `AppShell` | `layout/AppShell.tsx` | — (đọc `useSession`) | Khung sau đăng nhập: `Sidebar` + thanh "Chào mừng, {tên}!" + chuông + avatar chữ cái. `<Outlet/>` cho page. |
| `AuthLayout` | `layout/AuthLayout.tsx` | `children` | Khung 2 cột màn hình auth: form trái + blob SVG/ảnh 3D phải. |
| `Sidebar` | `layout/Sidebar.tsx` | — | Logo "IDSM" + `PRIMARY_NAV` + `SETTINGS_NAV`, dùng `NavLink` (active = nền `surface-sunken`). |
| `PageHeader` | `layout/PageHeader.tsx` | `breadcrumb?: Crumb[]` (`Crumb = {label, to?}`), `title: ReactNode`, `actions?: ReactNode` | Breadcrumb + H2 + actions phải. Crumb cuối (không `to`) tô màu brand. |
| `ComingSoonPage` | `layout/ComingSoonPage.tsx` | `title: string` | Placeholder "đang được phát triển" (icon Construction + 2 dòng chữ). |
| `navItems` | `layout/navItems.ts` | — | `PRIMARY_NAV: NavItem[]` (6 mục) + `SETTINGS_NAV: NavItem`. `NavItem = { label, to, icon }`. |

`PRIMARY_NAV`: Tổng quan `/dashboard` · Người dùng `/users` · Tài sản `/devices` · Điều chuyển `/transfers` · Cấp phát - Thu hồi `/allocation` · Kiểm kê `/audit`.
`SETTINGS_NAV`: Cài đặt `/settings`.

### `src/shared/lib/`

| Helper | File | Chữ ký |
|---|---|---|
| `cn` | `lib/cn.ts` | `cn(...classes) => string` (lọc falsy, join space). |
| `useAsyncData` | `lib/useAsyncData.ts` | `useAsyncData<T>(loader: () => Promise<T>, deps?: unknown[]) => { data: T\|null, loading, error }`. |
| `useAsyncAction` | `lib/useAsyncAction.ts` | `useAsyncAction<Args>(action: (...a: Args) => Promise<void>) => { run, pending, error }`. |
| `useCountdown` | `lib/useCountdown.ts` | `useCountdown(initialSeconds: number) => { remaining, restart(next?) }`. Đếm ngược mỗi giây. Hiện chỉ dùng ở OTP resend, nhưng đặt ở `shared/lib` vì đủ chung để tái dùng. |

### Component cục bộ (KHÔNG shared — cân nhắc nâng lên khi tái dùng)

| Component | File | Ghi chú |
|---|---|---|
| `LineField` | `modules/auth/presentation/LoginPage.tsx` | Input gạch chân, chỉ dùng ở màn login. |
| `AuthHeading` | `modules/auth/presentation/AuthHeading.tsx` | Icon + tiêu đề UPPERCASE cho các màn auth phụ. |
| `AssetGeneralInfoFields` | `modules/device/presentation/form/` | Nhóm 8 trường "Thông tin chung" của thiết bị. Dùng ở `AssetFormPage` **và** `AllocateRecoverPage`. |
| `ComponentsTable` | `modules/device/presentation/form/` | Bảng linh kiện thêm/sửa/xoá dòng. Dùng ở 2 màn như trên. |
| `PrefToggle` | `modules/user/presentation/PrefToggle.tsx` | Checkbox + dòng mô tả. Dùng trong tab Thông báo & Bảo mật. |
| `SettingsRail` (inline) | `modules/user/presentation/UserSettingsPage.tsx` | Rail điều hướng **dọc** có icon — hiện viết thẳng trong page, chưa tách. |

### KHÔNG tồn tại (nếu Figma mới cần, phải dựng mới)

- **Modal / Dialog / Drawer / Popover** — không có gì cả.
- **Toast / Notification** — chỉ có text lỗi inline.
- **Dropdown menu** (menu 3 chấm, menu avatar) — nút có sẵn nhưng không có menu.
- **Spinner / Skeleton component** — chỉ có `<div className="animate-pulse">` rời rạc.
- **Pagination**, **Tabs dọc** (dùng chung), **DatePicker** (đang xài `<input type="date">`), **FileUpload**, **Avatar** (đang render chữ cái), **Tooltip**, **Breadcrumb** tách rời (đang gói trong `PageHeader`), **EmptyState** dùng chung, **Toggle/Switch** (đang xài `Checkbox`).
- **Form library** — không có; tự quản lý bằng `useState` + hook `useXDraft` + hàm `validateX`.
- **Error boundary**, **theme/dark mode**, **i18n** (chuỗi Việt hardcode trong JSX).
- **Hằng số route tập trung** — đường dẫn là string literal rải rác.

---

## 3. Màn hình đã dựng

Route khai báo trong `src/app/router.tsx`.

### Nhóm Auth — khung `AuthLayout` (không cần đăng nhập)

| Route | File | Dữ liệu | Trạng thái |
|---|---|---|---|
| `/login` | `modules/auth/presentation/LoginPage.tsx` | `authService.login` → **mock**: nhận mọi username/password không rỗng, trả session `displayName = username \|\| 'Han'`. | Hoạt động. Redirect về `state.from` hoặc `/dashboard`. Đã đối chiếu Figma mới (node `2:25`) — khớp 100%, không sửa gì. |
| `/forgot-password` | `ForgotPasswordPage.tsx` | `authService.requestPasswordReset` → **mock**: sinh mã 4 số, **`console.info`** ra mã. | Hoạt động. Sang `/verify-otp?email=...`. Đã đối chiếu Figma mới (node `125:116`) — khớp 100%, không sửa gì. |
| `/verify-otp` | `OtpPage.tsx` | `authService.verifyResetCode` → so mã với `Map` in-memory. | Hoạt động, đã cập nhật theo Figma mới (node `132:201`) 2026-09-11: ô nhập tự nhảy focus **+ dán cả mã 1 lần** (`onPaste`) **+ đếm ngược 60s** (`shared/lib/useCountdown.ts`) — hết hạn thì dòng đếm đổi thành link "Gửi lại mã" (gọi lại `authService.requestPasswordReset`, mã cũ bị ghi đè nên tự hết hiệu lực). Sang `/reset-password?email=...`. |
| `/reset-password` | `ResetPasswordPage.tsx` | `authService.resetPassword` → **mock chỉ xoá mã, KHÔNG lưu mật khẩu mới**. | Hoạt động, đã cập nhật theo Figma mới (node `134:19`) 2026-09-11: validate khớp 2 ô mật khẩu **"sống"** khi gõ (tái dùng `validatePasswordReset` ở domain) — nút "Lưu mật khẩu" **disable + hiện lỗi đỏ ngay** khi chưa khớp, không phải chỉ báo lỗi sau khi bấm như trước. Xong → `/login`. |

### Nhóm App — khung `AppShell`, bọc `RequireAuth` (cần đăng nhập)

| Route | File | Dữ liệu | Trạng thái |
|---|---|---|---|
| `/` | → `<Navigate to="/dashboard">` | — | Redirect. |
| `/dashboard` | `modules/dashboard/presentation/DashboardPage.tsx` | `dashboardService.getStats` → **hardcode** 4 số: 128 / 86 / 34 / 8 + hint cứng. | Chỉ hiển thị. Có skeleton. Không refresh/lọc/drill-down. |
| `/devices` | `modules/device/presentation/DeviceCatalogPage.tsx` | `deviceService.list(query)` → **seed 8 máy Dell** trong `InMemoryDeviceRepository`. | Bảng + tìm kiếm + lọc trạng thái **hoạt động** (lọc client trong repo). Xem mục 4 cho các nút chết. |
| `/devices/new` | `modules/device/presentation/AssetFormPage.tsx` | Tạo mới qua `deviceService.create` → thêm vào mảng in-memory. | Form 6 section, validate **hoạt động**, lưu xong → `/devices`. Chỉ tạo mới, không sửa. |
| `/allocation` | `modules/device/presentation/AllocateRecoverPage.tsx` | Như trên (`deviceService.create`). | "Cấp phát - Thu hồi" nhưng thực chất = form tạo tài sản rút gọn (Thông tin chung + Linh kiện). Chưa có luồng cấp phát/thu hồi thật. |
| `/users` | `modules/user/presentation/UserSettingsPage.tsx` | `userSettingsService.get/save` → **seed 1 hồ sơ** (Hàn Nguyễn, SGB-IT-0142). | Rail dọc + 3 tab, 1 cặp nút Hủy/Lưu, gating theo `dirty`. Lưu chỉ vào in-memory (mất khi F5). Tab 2/3 tự thiết kế. |
| `/transfers` | `<ComingSoonPage title="Điều chuyển" />` | — | Placeholder. |
| `/audit` | `<ComingSoonPage title="Kiểm kê" />` | — | Placeholder. |
| `/settings` | `<ComingSoonPage title="Cài đặt" />` | — | Placeholder. |
| `*` | `app/NotFoundPage.tsx` | — | 404. |

Nguồn thiết kế — **2 nguồn khác nhau tuỳ module**:
- **auth** (4 màn ở trên): đọc trực tiếp từ Figma sống qua `get_design_context`, node-id
  `2:25` (Login), `125:116` (Quên MK), `132:201` (OTP), `134:19` (Đặt MK mới) — quyền đọc
  Figma đã hoạt động từ 2026-09-11 (trước đó tài khoản chỉ có View seat, bị chặn).
- **dashboard/device/user** (chưa đồng bộ lại): vẫn dựa trên bản Figma cũ export ra **15 PNG**
  800×512 (`Group 1..16`, thiếu 6). Map: 1=Login(cũ), 3=Quên MK(cũ), 4=OTP(cũ), 5=Đổi MK(cũ),
  2=Dashboard, 7/8/9=User settings, 10=Danh mục thiết bị, 11=DS đơn cấp phát, 12=Tạo đơn cấp
  phát, 13=Approvals Center, 14+15=Thêm tài sản, 16=Cấp phát-Thu hồi.

Bảng màu/spacing trong `tailwind.config.js` vẫn là **ước lượng bằng mắt**, kể cả sau khi auth
đọc được Figma sống — vì các node đọc được dùng hex/rgba trực tiếp trên từng lớp, không phải
Figma variable đặt tên, nên không có gì để đồng bộ tự động. Khi cần màu chính xác, phải tự so
bằng mắt với screenshot mà `get_design_context` trả về.

---

## 4. Mọi chỗ còn là placeholder / chưa tương tác được

### 4.1 Nút không có handler (bấm không làm gì)

| Nơi | Phần tử | File |
|---|---|---|
| AppShell (thanh trên cùng, mọi màn app) | Nút **chuông thông báo** (`aria-label="Thông báo"`) | `shared/layout/AppShell.tsx:21` |
| AppShell | **Avatar** (span chữ cái) — không phải nút, không có menu/đăng xuất | `shared/layout/AppShell.tsx:27` |
| Danh mục thiết bị — header | Nút **"Xuất dữ liệu"** (icon Upload) | `modules/device/presentation/DeviceCatalogPage.tsx:64` |
| Danh mục thiết bị — mỗi dòng | Nút **⋮ (MoreVertical)** "Thêm thao tác" | `DeviceCatalogPage.tsx:41` |
| Danh mục thiết bị — mỗi dòng | Nút **👁 (Eye)** "Xem chi tiết" — không có route chi tiết | `DeviceCatalogPage.tsx:44` |
| Thêm tài sản — section "Tệp đính kèm" | Nút **"Thêm tài liệu"** — không có `<input type=file>` | `modules/device/presentation/AssetFormPage.tsx:174` |
| Thêm tài sản — section "Thông tin khác" | Nút **"Thêm thông tin tùy chỉnh"** | `AssetFormPage.tsx:182` |

### 4.2 Không có / thiếu tương tác

| Vấn đề | Chi tiết |
|---|---|
| **Không có nút Đăng xuất ở đâu cả** | `SessionContext.signOut` tồn tại nhưng **không component nào gọi**. Không thể logout qua UI. |
| **Không có màn chi tiết thiết bị** | Nút Eye ở bảng không dẫn đi đâu; không có route `/devices/:id`. |
| **Không có chế độ sửa** | `AssetFormPage` chỉ tạo mới. Không có `/devices/:id/edit`. |
| **`AllocateRecoverPage` không có luồng thật** | Không có bước chọn thiết bị → chọn nhân viên → sinh biên bản → thu hồi. Chỉ là form tạo tài sản rút gọn. |
| **`href="#"`** | Không tìm thấy `href="#"` nào (các link đều dùng `<Link to=...>` thật). |
| **Đếm ngược OTP là hằng số client-side** | `RESEND_SECONDS = 60` hardcode trong `OtpPage.tsx`, không đồng bộ với thời gian sống thật của mã ở backend (vì chưa có backend). Khi có API thật, thời hạn nên do server trả về. |
| **Dashboard** | Không refresh, không lọc theo kỳ, thẻ không bấm được. |
| **Bảng (`DataTable`)** | Không sort, không phân trang, không chọn dòng. Dữ liệu nhiều sẽ chỉ tràn/cuộn. |

### 4.3 Dữ liệu cứng trong code (không phải API)

| Dữ liệu | Vị trí |
|---|---|
| 4 số liệu dashboard (128/86/34/8) + hint | `modules/dashboard/infrastructure/InMemoryDashboardRepository.ts` |
| 8 thiết bị Dell Latitude seed (cùng cấu hình, chủ yếu "Nguyễn Văn A - IT") | `modules/device/infrastructure/InMemoryDeviceRepository.ts` |
| Option select form thiết bị: `UNITS`, `SUPPLIERS`, `SPECS`, `OWNERS` | `modules/device/presentation/form/AssetGeneralInfoFields.tsx:11–14` |
| Hồ sơ người dùng seed (Hàn Nguyễn, Khối CNTT, SGB-IT-0142, SĐT...) | `modules/user/infrastructure/InMemoryUserSettingsRepository.ts` |
| `DEPARTMENTS`, `TITLES` (dropdown tab Thông tin chung) | `modules/user/domain/userSettings.ts` |
| "Đổi lần cuối hơn 90 ngày trước" (text cứng) | `modules/user/presentation/tabs/SecurityTab.tsx` |
| Mặc định bật/tắt thông báo (`notify*`) | `modules/user/domain/userSettings.ts` → `emptyUserSettings()` |
| Màu avatar login `bg-[#4E8C86]` (hardcode ngoài token) | `modules/auth/presentation/LoginPage.tsx:55` |
| Đường dẫn ảnh 3D `/illustrations/person-3d.png` (file **chưa có** → `onError` ẩn đi) | `shared/layout/AuthLayout.tsx` |
| Path SVG "blob" auth (vẽ tay, xấp xỉ) | `shared/layout/AuthLayout.tsx:28` |
| Toàn bộ chuỗi tiếng Việt trong JSX (không i18n) | mọi page |

### 4.4 Auth mock — hành vi giả

| Điểm | Thực tế |
|---|---|
| Đăng nhập | **Nhận mọi** username/password không rỗng. Không có tài khoản thật. |
| `displayName` | = đúng chuỗi username người dùng gõ (hoặc `'Han'`). |
| Mã reset mật khẩu | In ra **console trình duyệt**, không gửi email. |
| Đổi mật khẩu | `InMemoryAuthRepository.resetPassword(email)` **bỏ qua mật khẩu mới hoàn toàn** — chỉ xoá mã. Lần sau vẫn đăng nhập được với mọi mật khẩu. |
| `AuthRepository.resetPassword` | Interface khai báo `(email, newPassword)`, service truyền 2 tham số, **impl chỉ nhận `email`**. Mật khẩu bị rơi. |

### 4.5 Form / validate

| Form | Validate? | Ghi chú |
|---|---|---|
| Login | Ở **service** (`validateCredentials`): username không rỗng, mật khẩu ≥ 6. Không có lỗi inline theo từng ô — chỉ 1 dòng lỗi chung. | |
| Quên mật khẩu | `Email.of()` ném lỗi ở service nếu email sai định dạng → hiện ở `Field error`. | Không chặn trước khi submit. |
| OTP | Nút disabled tới khi đủ 4 số; service kiểm regex `^\d{4}$` + so mã. | |
| Đổi mật khẩu | `validatePasswordReset` (domain, tái dùng trực tiếp ở `presentation` để validate "sống"): khớp + độ dài ≥ 6. Checkbox "Hiện mật khẩu" hoạt động. **Nút "Lưu mật khẩu" disable tới khi 2 ô khớp** (2026-09-11, trước đó chỉ báo lỗi sau khi bấm). | Không kiểm độ mạnh mật khẩu (chỉ độ dài). |
| Thêm tài sản / Cấp phát-Thu hồi | `validateAssetDraft` (domain): 6 trường bắt buộc + khi `allocated` thì thêm 2 trường. Lỗi hiện theo từng `Field`. **Hoạt động.** | "Hạn bảo hành" không tự tính từ số tháng/năm. |
| User — Thông tin chung | `validateUserSettings`: 5 trường bắt buộc + định dạng email. Lỗi theo `Field`. Submit sai → nhảy về tab 1. **Hoạt động.** | |
| User — Thông báo / Bảo mật | Không có trường bắt buộc. | Bộ field là **phỏng đoán** (Figma cũ Group 8/9 chỉ lặp lại mock của tab 1), đánh dấu `ponytail:` trong file. |

### 4.6 Tab / Modal / Điều hướng nội bộ

| Điểm | Trạng thái |
|---|---|
| Chuyển tab ở `/users` | **Hoạt động** (`useState<TabId>`), title H2 đổi theo tab. |
| `shared/ui/Tabs` (tab ngang dùng chung) | Component có sẵn, **hiện chưa màn nào dùng**. |
| Modal | **Không có** — chưa màn nào cần, chưa có component. |
| "Đổi mật khẩu" trong tab Bảo mật | Điều hướng sang `/reset-password` (luồng này không lưu mật khẩu — xem 4.4). |
| `ComingSoonPage` (`/transfers`, `/audit`, `/settings`) | Chỉ chữ, không tương tác. |

### 4.7 TODO / dấu vết trong code

- Không có comment `TODO`/`FIXME` nào trong `src/`.
- Có các comment `ponytail:` đánh dấu chỗ cố tình làm tối giản: mock repo ở `auth`/`dashboard`/`user`, 2 tab tự thiết kế của `user`, và `shared/lib/useCountdown.ts` (đếm bằng `setTimeout` theo tick, có thể trôi vài trăm ms — chấp nhận được cho cooldown UI).
- `*.tsbuildinfo` đã được `.gitignore` loại trừ và gỡ khỏi repo (2026-09-11).

---

## 5. Những điểm KHÔNG chắc

1. **`/users` = "hồ sơ cá nhân" hay "quản lý danh sách người dùng"?**
   Nhãn sidebar là "Người dùng" (gợi ý danh sách nhân viên / CRUD), nhưng Figma cũ Group 7–9
   lại là *cài đặt tài khoản cá nhân* với breadcrumb "Người dùng / Cài đặt", và frame highlight
   mục "User". Bản Figma mới nhiều khả năng tách 2 thứ này. Hiện `/users` đang trỏ vào màn
   *cài đặt cá nhân*; `/settings` vẫn là placeholder. Cần bản mới xác nhận route nào là gì.

2. **Nội dung thật của tab "Thông báo" và "Bảo mật & Quyền riêng tư"** — Figma cũ không mô tả
   (Group 8, 9 chỉ dùng lại ảnh của Group 7). Các field hiện tại là suy đoán hợp lý, gần như
   chắc chắn sẽ phải thay theo Figma mới.

3. **Giá trị palette / spacing / radius / shadow** trong `tailwind.config.js` là ước lượng
   bằng mắt, chưa lấy từ Figma variable. Cập nhật 2026-09-11: quyền đọc Figma qua
   `get_design_context` **đã hoạt động** (trước đó bị chặn do tài khoản chỉ có seat View) —
   nhưng các node đọc được (auth) dùng hex/rgba trực tiếp trên layer, không phải variable đặt
   tên, nên vẫn không có gì để đồng bộ tự động; vẫn phải so bằng mắt với screenshot trả về.
   Các module chưa đọc lại từ Figma sống (dashboard/device/user) vẫn có thể lệch màu/khoảng
   cách đáng kể so với bản Figma mới.

4. **Luồng "Cấp phát - Thu hồi" đúng ra phải làm gì** — hiện `AllocateRecoverPage` gần như
   trùng form thêm tài sản. Nghiệp vụ thật (chọn thiết bị trong kho → gán nhân viên/phòng ban
   → sinh biên bản → thu hồi về kho) chưa được mô hình hoá. Figma cũ Group 16 quá sơ sài.

5. **Chrome điều hướng** — memory ghi chú Figma cũ không nhất quán: vài frame có sidebar
   tiếng Anh, vài frame có thanh bar xanh trên đầu. Bản đang code chọn "sidebar tiếng Việt,
   không có top bar". Chưa biết Figma mới theo hướng nào.

6. **Nguồn số liệu Dashboard** — 4 thẻ lấy từ đâu khi có backend? Tính gộp từ danh sách thiết
   bị, hay endpoint thống kê riêng? Nhãn/ngưỡng ("Chờ thanh lý", hint "+12 trong tháng") có
   phải chốt không?

7. **Đổi mật khẩu có chủ đích bỏ qua mật khẩu mới không?** — ngoài lý do "đang là mock",
   cả `AuthRepository` (port) lẫn impl đều không nhận/không dùng mật khẩu mới. Khi lên thật
   thì port cần đổi chữ ký.

8. **Đăng nhập có cần validate/hiển thị lỗi theo từng ô không?** — hiện chỉ 1 dòng lỗi chung,
   không có yêu cầu định dạng username, không "nhớ đăng nhập", không khoá sau N lần sai.

9. **Độ phủ test** — chỉ có unit test cho `domain` (3 file) + 1 test repository. **Không** test
   nào cho component/tương tác. Không rõ hành vi UI có được kỳ vọng kiểm thử không.

10. **Các module chưa dựng**: Điều chuyển, Kiểm kê, Danh sách/Tạo đơn cấp phát (Figma cũ
    Group 11–12), Approvals Center (Group 13). Chưa rõ thứ tự ưu tiên và mức độ thay đổi ở
    bản Figma mới.
