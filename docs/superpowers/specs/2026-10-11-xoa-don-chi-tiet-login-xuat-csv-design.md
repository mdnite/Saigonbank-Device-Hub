# Spec: Xoá đơn/lệnh + thùng rác, modal Chi tiết, chọn người theo phòng ban, lọc thiết bị, xuất CSV tài sản, gọn AppShell, UX Login

> Chốt ngày 2026-10-11 qua brainstorming, trên `main` (đã có phòng ban & chức vụ, thùng rác kiểm kê,
> đổi tên IDMS). 5 phần + tài liệu, làm theo thứ tự ở mục 9. **Không thêm bảng, không thêm cột, không
> migration** — chỉ thêm giá trị `Đã xóa` vào cột `Status` (VarChar(20)) đã có.

## 1. Context

- `DeviceOrder` / `DeviceTransfer` có 3 trạng thái: `Chờ duyệt`, `Đã duyệt`, `Từ chối`. Không xoá được.
  `DeviceOrderItem` / `DeviceTransferItem` đã `onDelete: Cascade` theo đơn/lệnh.
- `GET /device-orders/:id`, `GET /device-transfers/:id` đã trả `createdBy`, `decidedBy`, `decidedAt`,
  `rejectReason`, `items[].device` — nhưng FE chưa hiện ở đâu (lý do từ chối nhập bằng `window.prompt`
  rồi mất dấu).
- `AppShell` có nút chuông và avatar chữ cái, cả hai không làm gì (CONTEXT §4.1).
- `LoginPage`: Enter ở ô Username submit form ngay; không có nút hiện mật khẩu.
- Form `/allocation/new`, `/transfers/new`: chọn người từ 1 dropdown toàn bộ user (`/users/lookup`, đã
  trả `departmentId`); thiết bị là list checkbox không lọc.
- `/devices`: nút "Xuất dữ liệu" (icon Upload) là nút chết.
- Mẫu có sẵn để theo: thùng rác Kiểm kê (`audits.service.ts` `remove`/`purge`), `AuditMemberPicker`
  (lọc theo phòng), `shared/ui/Modal`, `shared/lib/downloadCsv`, `toCsv` trong `audit/domain/auditCsv.ts`.

## 2. Quyết định đã chốt (không hỏi lại)

| # | Quyết định |
|---|---|
| 1 | Chỉ **Trưởng phòng Kỹ thuật** xoá đơn/lệnh và dọn thùng rác. Quản trị viên + Chuyên viên Kỹ thuật **xem** được bộ lọc `Đã xóa`, không có thao tác. |
| 2 | Chỉ xoá đơn/lệnh **`Đã duyệt`** hoặc **`Từ chối`**. `Chờ duyệt` → 400 (không đụng trạng thái thiết bị). |
| 3 | Xoá mềm = `Status` → `Đã xóa`. **Không khôi phục.** Dọn thùng rác = xoá cứng. |
| 4 | Xác nhận xoá / dọn thùng rác bằng `window.confirm` (như các màn hiện có). |
| 5 | Nút **"Chi tiết"** ở **mọi dòng** (mọi trạng thái, kể cả `Đã xóa`) của `/allocation` và `/transfers`, mở **Modal**. Mục *Lý do từ chối* hiện khi `rejectReason` khác null (nên đơn Từ chối đã xoá vẫn thấy lý do). |
| 6 | AppShell: bỏ chuông + avatar chữ cái, giữ "Chào mừng, {tên}!". |
| 7 | Login: Enter ở Username → focus Password (không submit); Enter ở Password → submit. Nút hiện mật khẩu = **icon con mắt** trong ô. |
| 8 | Chọn người **Phòng ban → Nhân viên** áp dụng cho Tạo đơn (Cấp phát + Thu hồi) và Tạo lệnh điều chuyển (Người giao + Người nhận), một component dùng chung. |
| 9 | Người **không có phòng ban** (Quản trị viên) không xuất hiện trong picker. Backend chặn **người nhận** không có phòng ban (đơn Cấp phát: `targetUser`; lệnh: `toUser`). Người đang giữ (Thu hồi) / người giao không bị kiểm. |
| 10 | Bộ lọc danh sách thiết bị trong form: ô tìm kiếm (mã/tên/serial) + Loại thiết bị + Vị trí. Lọc phía client, giữ lựa chọn khi đổi lọc. Không có "Chọn tất cả". |
| 11 | Xuất danh sách tài sản: nút "Xuất dữ liệu" ở `/devices`, chỉ **TP + Chuyên viên Kỹ thuật** (`canWriteDevices`), **CSV**, xuất đúng các dòng đang hiện (theo tìm kiếm + lọc trạng thái), đầy đủ cột, không kèm linh kiện. |

## 3. Phần 1 — Xoá đơn/lệnh và thùng rác

### Backend (`device-orders` và `device-transfers`, làm y hệt nhau)
- `device-order-status.ts` / `device-transfer-status.ts`: thêm `DELETED: 'Đã xóa'`.
- `list`: không truyền `status` → `where.status = { not: 'Đã xóa' }`; truyền `?status=Đã xóa` → trả thùng
  rác. DTO list chấp nhận giá trị mới. Class-level `@Allow(ADMIN, TECH_HEAD, TECH_SPECIALIST)` giữ nguyên
  nên cả 3 xem được thùng rác.
- `DELETE /device-orders/:id` — `@Allow(ACTOR.TECH_HEAD)`:
  - không tồn tại → 404 (như `get`);
  - `Chờ duyệt` → 400 "Không thể xoá đơn đang chờ duyệt"; `Đã xóa` → 400 "Đơn đã bị xoá";
  - `Đã duyệt` / `Từ chối` → update `status = 'Đã xóa'`. Không đụng `Device`.
- `POST /device-orders/purge { ids: number[] }` — `@Allow(ACTOR.TECH_HEAD)`: `deleteMany` với
  `id in ids AND status = 'Đã xóa'` (id không ở thùng rác bị bỏ qua lặng lẽ). Trả `{ count }`. Không có
  `skipped` vì không bảng nào tham chiếu tới đơn/lệnh ngoài item (cascade). Route `purge` khai báo
  **trước** `:id`.
- Lệnh điều chuyển: message thay "đơn" bằng "lệnh" ("Không thể xoá lệnh đang chờ duyệt", "Lệnh đã bị xoá").
- Hệ quả: sau khi dọn thùng rác, thiết bị/người dùng trước đây bị `purge` của họ giữ lại vì đơn/lệnh tham
  chiếu sẽ xoá được — đúng ý.

### Frontend
- Domain: `ORDER_STATUS.DELETED`, `TRANSFER_STATUS.DELETED`; tone `neutral` trong `orderStatusTone.ts` /
  `transferStatusTone.ts`.
- `auth/domain/session.ts`: `canDeleteOrder`, `canDeleteTransfer` (= TP Kỹ thuật, tức `isTechHead`), có test.
- Port + service + `Http*Repository`: `remove(id)` → `apiDelete`, `purge(ids)` → `apiPost('/…/purge', { ids })`
  trả `{ count }`.
- `DeviceOrderListPage` / `DeviceTransferListPage`:
  - lọc Trạng thái thêm option `Đã xóa`;
  - cột Hoạt động: nút **Xoá** khi `canDelete && status ∈ {Đã duyệt, Từ chối}` → `window.confirm("Xoá đơn #id?")`
    → `remove` → reload;
  - lọc `Đã xóa` + `canDelete` → nút **"Dọn thùng rác"** ở thanh lọc: `window.confirm("Xoá vĩnh viễn N đơn? Không
    thể khôi phục.")` → `purge(ids đang hiện)` → hiện "Đã xoá N đơn" → reload. Danh sách rỗng thì disable.

### Test
- Backend `*.spec.ts`: list mặc định ẩn `Đã xóa`; xoá `Chờ duyệt` → 400; xoá `Từ chối` → `Đã xóa`; purge chỉ
  xoá row `Đã xóa`; quyền `TECH_HEAD`.
- FE: `Http*Repository` test cho `remove`/`purge`; page test: nút Xoá chỉ TP thấy, nút Dọn thùng rác chỉ ở lọc
  `Đã xóa`.

## 4. Phần 2 — Modal Chi tiết đơn/lệnh (chỉ FE)

- Trang danh sách giữ `detailId: number | null`; nút **"Chi tiết"** ở mọi dòng đặt `detailId`.
- `allocation/presentation/OrderDetailModal.tsx` và `transfer/presentation/TransferDetailModal.tsx` (props
  `id: number | null`, `onClose`), mỗi cái `useAsyncData(() => service.get(id))`; đang tải → "Đang tải…",
  lỗi → dòng đỏ trong modal.
- Nội dung (dùng `shared/ui/Modal`, tiêu đề "Chi tiết đơn #id" / "Chi tiết lệnh điều chuyển #id"):
  1. **Thông tin chung** (lưới 2 cột) — đơn: Loại · Trạng thái (Badge) · Người liên quan · Ghi chú; lệnh:
     Người giao → Người nhận · Trạng thái · Ghi chú. Ghi chú trống → "—".
  2. **Người tạo / Người duyệt** — tách ra `shared/ui/DecisionInfo.tsx` (props `createdBy`, `createdAt`,
     `decidedBy`, `decidedAt`, `rejectReason`): Người tạo + ngày tạo; Người duyệt + ngày duyệt, chưa có →
     "Chưa duyệt"; khung nền đỏ nhạt **Lý do từ chối** khi `rejectReason` khác null.
  3. **Thiết bị** — `DataTable`: Mã · Tên · Loại · Serial.
- Footer: "Đóng"; đơn/lệnh `Đã duyệt` có thêm "In biên bản" dùng lại `downloadBienBan` với dữ liệu đã tải.
- Ngày hiển thị `YYYY-MM-DD` như cột Ngày tạo hiện có.
- Test: mỗi modal 1 test — có `rejectReason` thì thấy khung lý do; không có thì không thấy.

## 5. Phần 3 — AppShell và Login

### AppShell
- Xoá nút `Bell` (và import) + span avatar. Header chỉ còn `<h1>Chào mừng, …</h1>`.

### LoginPage
- `LineField` → `forwardRef`, thêm prop tuỳ chọn `onKeyDown`, `trailing?: ReactNode` (vẫn cục bộ trong file).
- Username: `onKeyDown` — `Enter` → `preventDefault()` + `passwordRef.current?.focus()`.
- Password: `type={show ? 'text' : 'password'}`; `trailing` = `<button type="button" tabIndex={-1}
  aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>` với icon `EyeOff`/`Eye` (lucide).
- Test mới `LoginPage.test.tsx`: Enter ở Username → focus ở Password, `authService.login` không bị gọi; bấm
  icon → `type` đổi `password` ↔ `text`.

## 6. Phần 4 — Chọn người theo phòng ban + lọc thiết bị

### Dữ liệu
- `UserRef` của `allocation` và `transfer` thêm `departmentId: number | null` (BE đã trả).
- Port `DeviceOrderRepository` / `DeviceTransferRepository` thêm `departments(): Promise<DepartmentRef[]>`
  → `GET /departments`. `/users/lookup` **không** thêm `active` (giữ khả năng thu hồi/điều chuyển máy ở
  tài khoản đã khoá).
- Loại thiết bị: `deviceService.deviceTypes()` có sẵn.

### `shared/ui/DepartmentUserSelect.tsx`
- Props: `label`, `departments`, `users`, `value: number | null`, `onChange(id | null)`, `excludeUserId?`.
- 2 `Select`: **Phòng ban** → **Nhân viên** (disable khi chưa chọn phòng; chỉ người của phòng đó, trừ
  `excludeUserId`). User `departmentId = null` không bao giờ hiện. Đổi phòng → `onChange(null)`. Có `value`
  sẵn → phòng ban suy ra từ user đó.
- Không gọi API (component thuần, nhận data qua props).

### `shared/ui/DeviceChecklist.tsx`
- Props: `devices`, `deviceTypes`, `selectedIds`, `onToggle(id, checked)`.
- Thanh lọc: `SearchInput` (mã/tên/serial, không phân biệt hoa thường) + Select Loại thiết bị + Select Vị trí
  (gom distinct `location` khác null của `devices`). Dưới là list `Checkbox` "MÃ — Tên"; dòng "Đã chọn N
  thiết bị" luôn hiện. Lọc không bỏ tick của máy bị ẩn. Lọc ra rỗng → "Không có thiết bị khớp bộ lọc".
- Hàm thuần `filterDevices(devices, { search, typeId, location })` ở `device/domain/filterDevices.ts`, có test.

### Áp vào form
- `/allocation/new`: ô "Người nhận" / "Người đang giữ" → `DepartmentUserSelect`; Thiết bị → `DeviceChecklist`.
- `/transfers/new`: "Người giao", "Người nhận" (`excludeUserId = fromUserId`) → `DepartmentUserSelect`;
  Thiết bị → `DeviceChecklist`.
- Giữ hành vi: đổi loại đơn / đổi người → xoá danh sách đã tick.

### Backend
- `POST /device-orders` loại `Cấp phát`: `targetUser.departmentId == null` → 400 "Người nhận phải thuộc một
  phòng ban". `Thu hồi` không kiểm.
- `POST /device-transfers`: `toUser.departmentId == null` → 400 cùng message. `fromUser` không kiểm.
- Test spec cho 2 luật trên.

### Test FE
- `DepartmentUserSelect.test.tsx`: chưa chọn phòng → ô Nhân viên disable; chọn phòng → chỉ người của phòng;
  đổi phòng → `onChange(null)`; user không phòng ban không hiện.
- `filterDevices.test.ts`.

## 7. Phần 5 — Xuất CSV danh sách tài sản

- Chuyển `toCsv` (BOM UTF-8, CRLF, chống CSV injection) từ `audit/domain/auditCsv.ts` sang
  `shared/lib/csv.ts`; `auditCsv.ts` import lại, hành vi không đổi (test audit cũ vẫn xanh).
- `device/domain/devicesCsv.ts`: `devicesCsv(devices: Device[]): string`, cột: Mã thiết bị · Tên thiết bị ·
  Loại thiết bị · Số serial · Cấu hình · Đơn vị tính · Trạng thái · Người sở hữu · Ngày cấp phát · Vị trí ·
  Ngày mua · Nhà cung cấp · Hạn bảo hành. Giá trị null → ô trống. Có test.
- `DeviceCatalogPage`: nút `leadingIcon={<Upload/>}` + chữ "Xuất dữ liệu", chỉ hiện khi `canWrite`
  (`canWriteDevices`), disable khi `devices` rỗng; bấm → `downloadCsv('danh-sach-tai-san-YYYY-MM-DD.csv',
  devicesCsv(devices))`. Không gọi thêm API.

## 8. Tài liệu
- `docs/CONTEXT.md`: §1 (trạng thái đơn/lệnh, bảng `@Allow` thêm `DELETE …/:id`, `POST …/purge`), §2
  (`DecisionInfo`, `DepartmentUserSelect`, `DeviceChecklist`, `shared/lib/csv`), §3 (`/allocation`,
  `/transfers`, form tạo, `/devices`, `/login`), §4.1 (gỡ chuông, avatar, "Xuất dữ liệu"), §4.2 (đơn/lệnh đã
  có xem chi tiết), §4.6, §5.9 (số test).
- `docs/Changes.md`: mục mới — xoá đơn/lệnh + thùng rác, trạng thái `Đã xóa`, luật người nhận có phòng ban.
- `docs/erd.dbml`: note `Status` của `DeviceOrder` / `DeviceTransfer` thêm `Đã xóa`.

## 9. Thứ tự triển khai (mỗi bước 1 commit, test xanh)
1. Backend: xoá + purge đơn/lệnh, luật người nhận có phòng ban.
2. FE: xoá + thùng rác ở `/allocation`, `/transfers`.
3. FE: modal Chi tiết + `DecisionInfo`.
4. FE: `DepartmentUserSelect` + `DeviceChecklist` + áp vào 2 form.
5. FE: `shared/lib/csv` + xuất CSV tài sản.
6. FE: AppShell + Login.
7. Tài liệu.

## 10. Ngoài phạm vi
- Khôi phục đơn/lệnh từ thùng rác; xoá đơn `Chờ duyệt`.
- Đổi `window.prompt` lý do từ chối / `window.confirm` sang Modal.
- Sửa / huỷ đơn đã tạo; phân trang; route chi tiết riêng `/allocation/:id`.
- Hệ thống thông báo thật (chuông), menu avatar.
- Xuất Excel `.xlsx` / PDF danh sách tài sản; xuất kèm linh kiện.
- "Chọn tất cả" thiết bị; lọc thiết bị phía server.
