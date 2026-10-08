# Spec: Phòng ban & chức vụ, lọc thành viên kiểm kê, xoá/thùng rác kiểm kê, đổi tên nhãn

> Chốt ngày 2026-10-08 qua brainstorming, trên `main` (đã có Kiểm kê, Cấp phát - Thu hồi, Điều
> chuyển, role Cộng tác viên). 4 phần, làm theo đúng thứ tự ưu tiên dưới đây. Không thêm bảng, không
> thêm cột. **Đảo ngược** quyết định "không bao giờ xoá đợt / bảng tổng hợp" của
> `2026-10-02-kiem-ke-design.md`.

## 1. Context

- Role hiện có (bảng `Role`, toàn cục): `Quản trị viên`, `Trưởng phòng`, `Nhân viên`, `Cộng tác viên`.
  Phòng ban phân biệt bằng `User.DepartmentId` / `departmentCode`.
- Phòng ban seed: `KYTHUAT`, `KETOAN`. Công ty có thêm Kinh doanh và Nghiệp vụ.
- Form tạo user chọn Vai trò và Phòng ban độc lập; `Nhân viên` được phép không có phòng ban.
- Ô *Thành viên tham gia* (modal Lập lịch + tab Thành viên) là list checkbox **toàn bộ** user.
- Đợt kiểm kê và bảng tổng hợp không xoá được.
- `Device.Status`, `AuditItem.DeviceStatus`, `Role.RoleName` lưu **nguyên văn tiếng Việt** → đổi nhãn
  cần migration dữ liệu.

## 2. Quyết định đã chốt (không hỏi lại)

| # | Quyết định |
|---|---|
| 1 | Giữ bảng `Role` toàn cục, 4 role: `Quản trị viên`, `Trưởng phòng`, `Chuyên viên`, `Nhân viên`. Tổ hợp hợp lệ phòng ban × chức vụ là **hằng số code**, không thêm bảng. |
| 2 | Kỹ thuật, Kế toán: Trưởng phòng / Chuyên viên / Nhân viên. Kinh doanh, Nghiệp vụ: Trưởng phòng / Nhân viên. Không phòng ban: chỉ Quản trị viên. |
| 3 | Mọi role trừ Quản trị viên **bắt buộc** có phòng ban (kể cả Nhân viên). Quản trị viên **không** có phòng ban. |
| 4 | Form tạo user: chọn Phòng ban trước, ô Chức vụ lọc theo phòng. Có lựa chọn "— Không (Quản trị viên) —". |
| 5 | Role mới (TP/NV Kinh doanh, TP/NV Nghiệp vụ, NV Kỹ thuật, NV Kế toán) thuộc nhóm "còn lại" — ma trận quyền không đổi. |
| 6 | User cũ sai quy tắc giữ nguyên (chưa có màn sửa user). |
| 7 | Chọn thành viên: lọc theo phòng ban, chọn được người từ **nhiều** phòng, giữ lựa chọn khi đổi phòng, hiện chip "Đã chọn (n)". |
| 8 | Chỉ **Trưởng phòng Kế toán** xoá đợt, dọn thùng rác, xoá bảng tổng hợp. Chuyên viên Kế toán **xem** được đợt `Đã xóa` (lọc thùng rác, mở chi tiết) nhưng không có thao tác nào. |
| 9 | Xoá mềm đợt ở mọi trạng thái **trừ `Chờ duyệt`**; trạng thái mới `Đã xóa`. Xoá đợt đang mở nhả thiết bị; xoá đợt `Đã duyệt` không hoàn tác trạng thái thiết bị. Không có khôi phục. |
| 10 | Dọn thùng rác = xoá cứng; đợt còn nằm trong bảng tổng hợp bị bỏ qua kèm lý do. |
| 11 | Bảng tổng hợp **xoá cứng** ngay (không thùng rác, không thêm cột). |
| 12 | Đổi nhãn: `Chờ thanh lý` → `Chờ xử lý`, `Cộng tác viên` → `Chuyên viên`, `Đơn vị kiểm kê` → `Đơn vị được kiểm kê`. Chức năng giữ nguyên. Viết hoa chữ đầu câu theo nhãn hiện có. |

## 3. Phần 1 — Phòng ban và chức vụ

### Dữ liệu
- `prisma/seed.ts`: thêm `{ KINHDOANH, 'Phòng Kinh doanh' }`, `{ NGHIEPVU, 'Phòng Nghiệp vụ' }` (findFirst-or-create
  như cũ — DB thật chạy lại `db:setup`).
- Migration: `UPDATE "Role" SET "RoleName" = 'Chuyên viên' WHERE "RoleName" = 'Cộng tác viên'`. Id giữ nguyên.
- Seed: tài khoản `ctv.kt`, `ctv.ketoan` giữ username, đổi `fullName` thành "Chuyên viên … (dev)".

### Backend
- `identity/roles.ts`: `ROLE.COLLAB` → `ROLE.SPECIALIST = 'Chuyên viên'`. Bỏ `DEPARTMENT_REQUIRED_ROLES`, thay bằng:
  ```ts
  export const ROLES_BY_DEPARTMENT: Record<string, readonly string[]> = {
    KYTHUAT: [ROLE.HEAD, ROLE.SPECIALIST, ROLE.STAFF],
    KETOAN: [ROLE.HEAD, ROLE.SPECIALIST, ROLE.STAFF],
    KINHDOANH: [ROLE.HEAD, ROLE.STAFF],
    NGHIEPVU: [ROLE.HEAD, ROLE.STAFF],
  };
  // Không phòng ban → chỉ ROLE.ADMIN.
  ```
- `POST /users`: 400 nếu tổ hợp không hợp lệ (thiếu phòng ban với role ≠ Admin, Admin có phòng ban,
  Chuyên viên ở KD/NV). Thông báo lỗi tiếng Việt rõ ràng.
- `shared/auth/actors.ts` và mọi chỗ dùng `COLLAB`: đổi tên actor sang Chuyên viên. Quyền không đổi.
- Script `scripts/e2e-*.ps1`: tra role theo tên `'Chuyên viên'`.

### Frontend
- `auth/domain/session.ts`: `COLLAB_ROLE` → `SPECIALIST_ROLE = 'Chuyên viên'`; `isTechCollab` → `isTechSpecialist`,
  `isAcctCollab` → `isAcctSpecialist`; sửa comment "Cộng tác viên" → "Chuyên viên". Thêm `canDeleteAudits = isAcctHead`.
- `user/domain`: bản sao `ROLES_BY_DEPARTMENT` (theo `departmentCode`); `validateNewUser` chặn tổ hợp sai trước submit.
- `CreateUserPage`: ô **Phòng ban** đứng trước, có option "— Không (Quản trị viên) —". Ô **Chức vụ** disabled tới khi
  chọn phòng ban, chỉ hiện chức vụ hợp lệ; đổi phòng ban làm chức vụ hiện tại không hợp lệ → xoá trắng chức vụ.
  Cả hai ô bắt buộc (*).
- Test: cập nhật mọi chuỗi `'Cộng tác viên'` trong test FE/BE.

## 4. Phần 2 — Thành viên tham gia lọc theo phòng ban

- Backend: `GET /users/lookup` thêm `departmentId` vào `select`. Không endpoint mới.
- Frontend: component mới `audit/presentation/AuditMemberPicker.tsx`, dùng ở `ScheduleAuditModal` (thay list
  checkbox) và `AuditMembersTab` (chế độ Sửa thành viên). Props: `selected`, `onChange`, `staleMembers?`.
  1. Ô **Phòng ban** (từ `/departments`), mặc định trống → hiện gợi ý "Chọn phòng ban để xem nhân viên".
  2. Chọn phòng → list checkbox user **đang hoạt động** của phòng đó.
  3. Đổi phòng giữ nguyên lựa chọn. Dưới list: "Đã chọn (n)" + chip `Họ tên – Phòng ban`, × để bỏ.
  4. Thành viên cũ đã ngừng hoạt động: chip nhãn "ngừng hoạt động", vẫn bỏ chọn được.
  5. User không có phòng ban không chọn được ở đây.
- Trường vẫn **tuỳ chọn** (không *). Chưa có frame Figma → dựng bằng `Select`, `Checkbox`, badge/chip sẵn có.
- Test: lọc theo phòng, giữ lựa chọn khi đổi phòng, bỏ chọn qua chip.

## 5. Phần 3 — Xoá đợt, thùng rác, xoá bảng tổng hợp

### Backend
- `AUDIT_STATUS.DELETED = 'Đã xóa'`. Không nằm trong `OPEN_AUDIT_STATUSES` → xoá đợt đang mở tự nhả thiết bị.
- `DELETE /audits/:id` (TP Kế toán): `updateMany` có điều kiện `status IN (Chưa kiểm kê, Đang kiểm kê, Đã duyệt, Đã hủy)`
  → `Đã xóa`; count 0 → 404 nếu không tồn tại, ngược lại 400 `AUDIT_WRONG_STATE`. Không đụng trạng thái thiết bị.
- `GET /audits`: mặc định loại `Đã xóa`; trả `Đã xóa` khi lọc `status=Đã xóa` — cho mọi người có quyền Kiểm kê
  (TP và Chuyên viên Kế toán). `GET /audits/:id` của đợt `Đã xóa` cũng xem được, mọi thao tác ghi trả 400.
- `POST /audits/purge { ids }` (TP Kế toán): xoá cứng đợt `Đã xóa`; bỏ qua đợt có dòng trong `AuditSummaryAudit`.
  Trả `{ purged: number, skipped: [{ id, reason }] }`, reason vd. `"Đợt #12 đang nằm trong bảng tổng hợp #3"`.
  `AuditItem` / `AuditItemAccessory` / `AuditMember` đi theo cascade sẵn có.
- `DELETE /audit-summaries/:id` (TP Kế toán): xoá cứng; `AuditSummaryAudit` cascade; 404 nếu không tồn tại.
- Mọi endpoint mới khai `@Allow(acctHead)`.

### Frontend
- Tab Đợt kiểm kê: nút **Xoá** từng dòng (ẩn với `Chờ duyệt` / `Đã xóa`), hộp xác nhận. Bộ lọc trạng thái có
  "Đã xóa" (TP và Chuyên viên Kế toán đều thấy). Chỉ TP Kế toán có ô tick chọn + **Dọn thùng rác**, hiện danh
  sách bị bỏ qua kèm lý do; Chuyên viên chỉ xem.
- Trang chi tiết đợt: nút **Xoá** (cùng điều kiện); đợt `Đã xóa` chỉ xem, ẩn mọi thao tác.
- Tab Bảng tổng hợp + trang xem bảng tổng hợp: nút **Xoá**, xác nhận "Không thể hoàn tác".
- Port/service/repository HTTP của module audit thêm `delete`, `purge`, `deleteSummary`.

### Test
- BE: xoá từng trạng thái (Chờ duyệt → 400), nhả thiết bị khi xoá đợt mở, purge bỏ qua đợt trong bảng tổng hợp,
  xoá bảng tổng hợp rồi purge được, Chuyên viên/khác gọi xoá/dọn → 403, Chuyên viên lọc được `Đã xóa` và xem chi tiết.
- FE: TP Kế toán thấy Xoá / Dọn thùng rác; Chuyên viên Kế toán thấy bộ lọc `Đã xóa` nhưng không thấy nút Xoá / Dọn.

## 6. Phần 4 — Đổi nhãn

- `Chờ thanh lý` → `Chờ xử lý`: migration `UPDATE "Device"` và `UPDATE "AuditItem"."DeviceStatus"`; BE
  `DEVICE_STATUS.PENDING_DISPOSAL` → `PENDING_PROCESSING`; FE `device.ts`, mock dashboard, câu xác nhận duyệt
  trong `AuditDetailPage`, test.
- `Cộng tác viên` → `Chuyên viên`: xem Phần 1.
- `Đơn vị kiểm kê` → `Đơn vị được kiểm kê`: label `ScheduleAuditModal`, cột `AuditListTab`, dòng PDF
  `generateAuditReport`, lỗi `validateAuditDraft` ("Vui lòng chọn đơn vị được kiểm kê"), comment `audit.ts`, test.
  Tên field `unit` / `unitName` và cột DB giữ nguyên.

## 7. Tài liệu
- `docs/CONTEXT.md`: cập nhật ma trận quyền, phòng ban, thùng rác kiểm kê.
- `docs/erd.dbml`: không thêm cột; cập nhật note giá trị `Status` (`Đã xóa` cho Audit, `Chờ xử lý` cho Device) và role.
- Cuối mỗi phần liệt kê placeholder còn lại (quy ước CLAUDE.md).

## 8. Ngoài phạm vi
- Màn sửa user / sửa phòng ban của user cũ.
- Khôi phục từ thùng rác.
- Quyền riêng cho các role mới.
- Thêm phòng ban qua giao diện.
