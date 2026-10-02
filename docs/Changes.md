# Thay đổi cần cập nhật vào báo cáo BCTT-HKTT

> Tổng hợp những điểm code thật (backend `identity` + `users` + `devices` + `device-orders` + `device-transfers` + `audits`, schema Prisma) đã khác
> hoặc bổ sung so với bản báo cáo hiện tại. Cập nhật lần cuối: 2026-10-02.

## 1. UC-01 — Đăng nhập
- Đăng nhập bằng **tên đăng nhập hoặc email** + mật khẩu.
- Luật mới (có trong SD/AD, chưa có trong text UC): tài khoản **"Ngừng hoạt động"** nhập đúng mật khẩu
  → **403 "Tài khoản đã bị khoá"**. Mật khẩu được kiểm **trước** khi báo khoá, để người không biết mật
  khẩu không dò được tài khoản nào đang bị khoá (sai mật khẩu vẫn trả 401 như thường).
- Tài khoản **"Đã xóa"** xử lý y hệt tài khoản không tồn tại: **401 "Sai tên đăng nhập hoặc mật khẩu"**.
- Kết quả trả về có `roleName` để giao diện hiện/ẩn chức năng theo vai trò.
- Mọi API cần đăng nhập kiểm lại tài khoản trong DB ở **mỗi request**: tài khoản bị khoá / xoá thì phiên
  đang mở hết hiệu lực ngay (401 "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại"), giao diện tự đăng xuất.

## 2. UC-02 — Quên mật khẩu
- Chỉ tài khoản **"Đang hoạt động"** nhận được mã; email không tồn tại, bị khoá hoặc đã xoá đều trả
  **404 "Email không tồn tại"** (luật mới, bổ sung vào UC-02).
- OTP **4 chữ số**, hiệu lực **5 phút**, lưu dạng **hash SHA-256**; chỉ mã **mới nhất** có hiệu lực;
  sai quá **5 lần** thì mã bị vô hiệu.
- Bước đặt lại mật khẩu luôn xác thực lại OTP ở backend.
- Đặt lại mật khẩu thành công → **`IsVerified = true`** (tài khoản được xác minh).

## 3. UC-04 / UC-05 / UC-06 — Quản lý người dùng (chỉ Quản trị viên)
| Chức năng | Luật |
|---|---|
| Xem danh sách | Tìm theo tên đăng nhập / họ tên / email; lọc theo trạng thái, vai trò, phòng ban. Mặc định ẩn tài khoản "Đã xóa". |
| Tạo tài khoản | Quản trị viên nhập tên đăng nhập, họ tên, email, vai trò, phòng ban (**bắt buộc** với Trưởng phòng và Cộng tác viên; thiếu → 400 "Vui lòng chọn phòng ban"), mật khẩu ban đầu (≥ 6 ký tự). Tài khoản mới **"Đang hoạt động"**, **`IsVerified = false`**. Trùng tên đăng nhập / email → 409. |
| Khoá / mở khoá | Đổi Status giữa "Đang hoạt động" và "Ngừng hoạt động". Có hiệu lực ngay với phiên đang mở. |
| Xoá | **Xoá mềm**: Status = "Đã xóa", không xoá bản ghi. Tên đăng nhập/email của tài khoản đã xoá vẫn bị giữ (không tạo lại được). |
| Ràng buộc | Quản trị viên không tự khoá / tự xoá tài khoản của mình. Chưa có chức năng sửa thông tin tài khoản. |

## 4. Vai trò và phòng ban
| Vai trò | Quyền |
|---|---|
| Quản trị viên | Quản lý người dùng. **Chỉ xem** thiết bị, đơn Cấp phát - Thu hồi, lệnh Điều chuyển (không thêm/sửa/xoá thiết bị, không tạo, không duyệt). |
| Trưởng phòng **Kỹ thuật** | Thêm/sửa/xoá thiết bị, dọn thùng rác thiết bị; **duyệt/từ chối** đơn Cấp phát - Thu hồi và lệnh Điều chuyển; **"Tìm thấy"** thiết bị đang "Thất lạc". Không tạo đơn/lệnh. |
| Cộng tác viên **Kỹ thuật** | Thêm/sửa thông tin thiết bị (không xoá, không dọn thùng rác); **tạo** đơn Cấp phát - Thu hồi và lệnh Điều chuyển; xem tất cả đơn/lệnh. Không duyệt. |
| Cộng tác viên **Kế toán** | **Lập lịch** kiểm kê, bắt đầu, **nhập** kết quả, sửa thành viên, **gửi duyệt**, **huỷ đợt chưa bắt đầu**, **lập bảng tổng hợp**; xem mọi đợt và bảng tổng hợp. Không duyệt. |
| Trưởng phòng **Kế toán** | **Duyệt / từ chối** kiểm kê; xem mọi đợt và bảng tổng hợp. Không lập lịch, không nhập. |
| Nhân viên | Người dùng thường: xem thiết bị. |

Trưởng phòng và Cộng tác viên phân biệt Kỹ thuật / Kế toán bằng phòng ban của tài khoản.

Phòng ban: **KYTHUAT — Phòng Kỹ thuật**, **KETOAN — Phòng Kế toán**.

## 5. ERD 3.2.1 — cần vẽ lại
- Thêm bảng **PasswordResetToken** (chưa có trên ERD gốc).
- Bảng **User** thêm cột **IsVerified**, **CreatedAt**, **UpdatedAt**.
- DBML (dán vào dbdiagram.io để xuất ảnh):

```dbml
Table Role {
  Id int [pk, increment]
  RoleName varchar(100) [not null]
}

Table Department {
  Id int [pk, increment]
  DepartmentCode varchar(50) [not null, unique]
  DepartmentName varchar(150) [not null]
}

Table User {
  Id int [pk, increment]
  RoleId int [not null, ref: > Role.Id]
  DepartmentId int [ref: > Department.Id]
  Username varchar(100) [not null, unique]
  Password varchar(255) [not null, note: 'bcrypt hash']
  FullName varchar(150) [not null]
  Email varchar(150) [not null, unique]
  Status varchar(50) [not null, default: 'Đang hoạt động', note: 'Đang hoạt động | Ngừng hoạt động | Đã xóa']
  IsVerified boolean [not null, default: false]
  CreatedAt timestamp [not null, default: `now()`]
  UpdatedAt timestamp [not null]
}

Table PasswordResetToken {
  Id int [pk, increment]
  UserId int [not null, ref: > User.Id]
  TokenHash varchar(255) [not null, note: 'SHA-256 của OTP']
  ExpiresAt timestamp [not null]
  UsedAt timestamp
  CreatedAt timestamp [not null, default: `now()`]

  indexes {
    TokenHash
  }
}
```

## 6. Thiết bị — 3 bảng mới cho ERD (vòng quản lý thiết bị, 2026-09-22)
- ERD 3.2.1 cần thêm **3 bảng**: `DeviceType`, `Device`, `DeviceAccessory`. Bảng `Device` có
  **2 khoá ngoại**: `DeviceTypeId → DeviceType.Id` (bắt buộc), `CurrentUserId → User.Id`
  (không bắt buộc).
- Mã thiết bị (`DeviceCode`) theo quy tắc **`PREFIX-NNNNNN`** (2–4 chữ hoa + `-` + 6 chữ số),
  `PREFIX` phải khớp `DeviceType.Prefix` của loại thiết bị đã chọn (vd. loại "Laptop" có
  `Prefix = "LT"` thì mã phải bắt đầu bằng `LT-`).
- Thiết bị **không bao giờ xoá cứng** — xoá = đổi `Status` thành "Đã xóa", giữ nguyên bản ghi
  (cùng nguyên tắc đã áp dụng cho `User`, xem mục 3).
- Phân quyền **ghi** thiết bị: thêm/sửa — Trưởng phòng hoặc Cộng tác viên thuộc phòng Kỹ thuật
  (`Department.DepartmentCode = 'KYTHUAT'`); xoá — chỉ Trưởng phòng Kỹ thuật (xem mục 4). Đọc thì mọi
  vai trò đã đăng nhập đều xem được.
- **Người giữ thiết bị chỉ đổi qua đơn/lệnh được duyệt** (2026-10-01): API và form thiết bị không còn
  nhận Người sở hữu / Trạng thái / Ngày cấp phát / Phòng ban; thiết bị mới luôn "Trong kho". Tạo đơn
  Cấp phát / Thu hồi hoặc lệnh Điều chuyển → thiết bị sang **"Đang chờ duyệt"** (bị khoá: không vào
  đơn/lệnh khác, không sửa, không xoá); duyệt → trạng thái đích; từ chối → trạng thái cũ. Thiết bị
  không còn gắn phòng ban — phòng ban của người giữ xem ở thông tin người dùng.

DBML bổ sung (dán tiếp vào ERD ở mục 5):

```dbml
Table DeviceType {
  Id int [pk, increment]
  TypeName varchar(100) [not null]
  Prefix varchar(4) [not null, unique, note: 'tiền tố bắt buộc của DeviceCode']
}

Table Device {
  Id int [pk, increment]
  DeviceTypeId int [not null, ref: > DeviceType.Id]
  CurrentUserId int [ref: > User.Id]
  DeviceCode varchar(20) [not null, unique, note: 'PREFIX-NNNNNN, PREFIX khớp DeviceType.Prefix']
  DeviceName varchar(150) [not null]
  SerialNumber varchar(100) [unique]
  SpecDetail varchar(255) [not null]
  Unit varchar(20) [not null]
  Location varchar(150)
  PurchaseDate date
  Supplier varchar(150)
  WarrantyMonths int
  WarrantyCondition varchar(255)
  WarrantyExpiresOn date
  Status varchar(50) [not null, note: 'Trong kho | Đã cấp phát | Đang chờ duyệt | Thất lạc | Chờ thanh lý | Đã xóa']
  AllocatedOn date
  CreatedAt timestamp [not null, default: `now()`]
  UpdatedAt timestamp [not null]
}

Table DeviceAccessory {
  Id int [pk, increment]
  DeviceId int [not null, ref: > Device.Id]
  AccessoryCode varchar(50) [not null]
  AccessoryName varchar(150) [not null]
  AccessoryType varchar(100) [not null]
  Unit varchar(20) [not null]
}
```

## 6b. Đơn Cấp phát - Thu hồi và lệnh Điều chuyển — 4 bảng mới cho ERD (2026-09-24/25)
- ERD 3.2.1 cần thêm **4 bảng**: `DeviceOrder`, `DeviceOrderItem`, `DeviceTransfer`,
  `DeviceTransferItem`. Một đơn/lệnh gồm 1 hoặc nhiều thiết bị (bảng `*Item`).
- `DeviceOrder.Type` = "Cấp phát" | "Thu hồi"; `Status` của cả hai loại = "Chờ duyệt" | "Đã duyệt" |
  "Từ chối". Đơn/lệnh **không bao giờ bị xoá** — là hồ sơ lịch sử; không sửa, không huỷ sau khi tạo.
- Quyền: Cộng tác viên Kỹ thuật tạo, Trưởng phòng Kỹ thuật duyệt / từ chối, Quản trị viên chỉ xem
  (xem mục 4). Vòng đời thiết bị khi tạo / duyệt / từ chối: xem mục 6.
- Điều chuyển chuyển thiết bị "Đã cấp phát" thẳng từ người giao (`FromUserId`) sang người nhận
  (`ToUserId`), không qua "Trong kho".
- Đơn/lệnh "Đã duyệt" in được **biên bản bàn giao** (PDF).

```dbml
Table DeviceOrder {
  Id int [pk, increment]
  Type varchar(20) [not null, note: 'Cấp phát | Thu hồi']
  Status varchar(20) [not null, default: 'Chờ duyệt', note: 'Chờ duyệt | Đã duyệt | Từ chối']
  TargetUserId int [not null, ref: > User.Id, note: 'người nhận (Cấp phát) / người trả (Thu hồi)']
  Note varchar(255)
  CreatedById int [not null, ref: > User.Id]
  DecidedById int [ref: > User.Id]
  DecidedAt timestamp
  RejectReason varchar(255)
  CreatedAt timestamp [not null, default: `now()`]
}

Table DeviceOrderItem {
  Id int [pk, increment]
  OrderId int [not null, ref: > DeviceOrder.Id]
  DeviceId int [not null, ref: > Device.Id]
}

Table DeviceTransfer {
  Id int [pk, increment]
  Status varchar(20) [not null, default: 'Chờ duyệt', note: 'Chờ duyệt | Đã duyệt | Từ chối']
  FromUserId int [not null, ref: > User.Id]
  ToUserId int [not null, ref: > User.Id]
  Note varchar(255)
  CreatedById int [not null, ref: > User.Id]
  DecidedById int [ref: > User.Id]
  DecidedAt timestamp
  RejectReason varchar(255)
  CreatedAt timestamp [not null, default: `now()`]
}

Table DeviceTransferItem {
  Id int [pk, increment]
  TransferId int [not null, ref: > DeviceTransfer.Id]
  DeviceId int [not null, ref: > Device.Id]
}
```

## 6c. Kiểm kê — 6 bảng mới cho ERD (2026-10-02)
- ERD 3.2.1 cần thêm **6 bảng**: `Audit` (đợt kiểm kê), `AuditItem` (snapshot 1 thiết bị + kết quả),
  `AuditItemAccessory` (snapshot 1 linh kiện + kết quả), `AuditMember` (thành viên tham gia),
  `AuditSummary` (bảng tổng hợp) và `AuditSummaryAudit` (nối n-n bảng tổng hợp ↔ đợt).
- Đợt và bảng tổng hợp **không bao giờ bị xoá**. Mọi FK tới `User` là `Restrict`.
  `AuditItem.HolderUserId` **cố ý không phải khoá ngoại** — chỉ là bản chụp để so với `Device` lúc duyệt.
- `Audit.DepartmentId` null = đơn vị giả "Kho" (thiết bị "Trong kho"); `UnitName` là snapshot tên đơn vị.
- Trạng thái `Audit.Status`: "Chưa kiểm kê" | "Đang kiểm kê" | "Chờ duyệt" | "Đã duyệt" | "Đã hủy";
  `Result` (máy và linh kiện): "Đủ" | "Thiếu" | "Hỏng", null = chưa đếm.
- `Device.Status` có thêm giá trị **"Thất lạc"** (cột `varchar`, không đổi schema).

```dbml
Table Audit {
  Id int [pk, increment]
  Status varchar(20) [not null, default: 'Chưa kiểm kê', note: 'Chưa kiểm kê | Đang kiểm kê | Chờ duyệt | Đã duyệt | Đã hủy']
  DepartmentId int [ref: > Department.Id, note: 'null = đơn vị "Kho"']
  UnitName varchar(150) [not null, note: 'snapshot tên đơn vị']
  DueDate date [not null]
  Purpose varchar(20) [not null, note: 'Định kỳ | Đột xuất | Cuối năm']
  DeviceTypeId int [ref: > DeviceType.Id, note: 'bộ lọc đã dùng']
  Location varchar(150) [note: 'bộ lọc đã dùng']
  CreatedById int [not null, ref: > User.Id]
  StartedAt timestamp
  SubmittedAt timestamp
  DecidedById int [ref: > User.Id]
  DecidedAt timestamp
  RejectReason varchar(255) [note: 'lần từ chối gần nhất; xoá khi gửi lại']
  CreatedAt timestamp [not null, default: `now()`]
}

Table AuditItem {
  Id int [pk, increment]
  AuditId int [not null, ref: > Audit.Id]
  DeviceId int [not null, ref: > Device.Id]
  DeviceCode varchar(20) [not null]
  DeviceName varchar(150) [not null]
  SerialNumber varchar(100)
  DeviceTypeName varchar(100) [not null]
  Unit varchar(20) [not null]
  HolderUserId int [note: 'snapshot, KHÔNG phải FK']
  HolderName varchar(150)
  DepartmentName varchar(150)
  DeviceStatus varchar(50) [not null, note: 'snapshot, so sánh lúc duyệt']
  Result varchar(10) [note: 'Đủ | Thiếu | Hỏng; null = chưa đếm']
  Note varchar(255)

  indexes {
    (AuditId, DeviceId) [unique]
    DeviceId
  }
}

Table AuditItemAccessory {
  Id int [pk, increment]
  AuditItemId int [not null, ref: > AuditItem.Id]
  AccessoryCode varchar(50) [not null]
  AccessoryName varchar(150) [not null]
  AccessoryType varchar(100) [not null]
  Unit varchar(20) [not null]
  Result varchar(10) [note: 'Đủ | Thiếu | Hỏng; null = chưa đếm']
  Note varchar(255)
}

Table AuditMember {
  AuditId int [not null, ref: > Audit.Id]
  UserId int [not null, ref: > User.Id]

  indexes {
    (AuditId, UserId) [pk]
  }
}

Table AuditSummary {
  Id int [pk, increment]
  Title varchar(150) [not null]
  Purpose varchar(20)
  CreatedById int [not null, ref: > User.Id]
  CreatedAt timestamp [not null, default: `now()`]
}

Table AuditSummaryAudit {
  SummaryId int [not null, ref: > AuditSummary.Id]
  AuditId int [not null, ref: > Audit.Id]

  indexes {
    (SummaryId, AuditId) [pk]
  }
}
```

## 6d. UC Kiểm kê (2026-10-02)
Báo cáo không có AD/SD cho Kiểm kê — luồng dưới đây do người dùng chốt (spec
`docs/superpowers/specs/2026-10-02-kiem-ke-design.md`, 24 quyết định). Vòng này làm **Kiểm kê chi
tiết** + **Bảng tổng hợp**; Kiểm kê số lượng chưa làm.
- **Quyền:** menu và API Kiểm kê **chỉ** cho Trưởng phòng + Cộng tác viên Kế toán (Quản trị viên,
  Kỹ thuật, Nhân viên không thấy). CTV Kế toán lập lịch, bắt đầu, huỷ, nhập kết quả, sửa thành
  viên, gửi duyệt, lập bảng tổng hợp; TP Kế toán duyệt / từ chối.
- **Đơn vị kiểm kê** = một phòng ban (thiết bị đang cấp cho người thuộc phòng đó) hoặc đơn vị "Kho"
  (thiết bị "Trong kho"). Bộ lọc tuỳ chọn: loại thiết bị, vị trí. Chỉ lấy thiết bị "Trong kho" +
  "Đã cấp phát". Mục đích: Định kỳ | Đột xuất | Cuối năm. Thành viên tham gia chỉ để ghi nhận /
  in biên bản, không cấp quyền.
- **Snapshot lúc lập lịch:** thông tin thiết bị (mã, tên, serial, loại, đơn vị tính, người sở hữu,
  phòng ban, trạng thái) **kèm toàn bộ linh kiện**; thiết bị đổi sau đó không làm đổi đợt. Thiết bị
  **không bị khoá** trong lúc kiểm kê.
- **Chặn trùng đợt:** một thiết bị không nằm trong 2 đợt đang mở (mọi trạng thái trừ "Đã duyệt" /
  "Đã hủy"); bộ lọc trúng máy như vậy → 400 cả đợt, liệt kê mã máy. Bộ lọc không có thiết bị → 400.
- **Vòng đời 5 trạng thái:** Chưa kiểm kê → (Bắt đầu) → Đang kiểm kê → (Gửi duyệt) → Chờ duyệt →
  (Duyệt) → Đã duyệt. Từ chối (bắt buộc lý do) đưa về Đang kiểm kê, lý do hiện thành banner. Huỷ chỉ
  khi "Chưa kiểm kê" → "Đã hủy" (cuối, nhả máy cho đợt khác). Hạn "Đến ngày" qua mà đợt còn mở →
  nhãn "Quá hạn" tính lúc hiển thị, không chặn gì.
- **Đếm:** mỗi thiết bị **và mỗi linh kiện** có kết quả Đủ / Thiếu / Hỏng + ghi chú, lưu từng dòng. Gửi
  duyệt chỉ khi 100% dòng đã đếm; có nút "Ghi Đủ cho dòng chưa đếm".
- **Duyệt:** máy "Thiếu" → **"Thất lạc"**, máy "Hỏng" → **"Chờ thanh lý"**, giữ người sở hữu; máy
  "Đủ" không đổi; linh kiện chỉ ghi nhận, không ghi ngược vào `DeviceAccessory`.
- **Chặn duyệt khi máy đã đổi:** dòng "Thiếu"/"Hỏng" mà thiết bị đã khác snapshot (trạng thái hoặc
  người sở hữu) → 400 liệt kê mã, rollback cả đợt; dòng "Đủ" không bao giờ chặn. Gỡ kẹt: TP từ chối →
  CTV đổi kết quả dòng đó → gửi lại.
- **Tìm thấy:** Trưởng phòng Kỹ thuật bấm "Tìm thấy" trên máy "Thất lạc" → "Đã cấp phát" nếu còn người
  sở hữu, ngược lại "Trong kho". Máy "Thất lạc" / "Chờ thanh lý" không vào được đơn/lệnh mới.
- **Bảng tổng hợp:** CTV Kế toán chọn nhiều đợt "Đã duyệt" + tiêu đề; không trạng thái, không duyệt;
  một đợt vào được nhiều bảng. Nội dung = ma trận đơn vị × loại thiết bị (Tổng / Đủ / Thiếu / Hỏng,
  chỉ đếm thiết bị), tính lúc đọc từ snapshot.
- **Xuất:** PDF và CSV (UTF-8 có BOM) cho cả đợt và bảng tổng hợp.
- **Dọn thùng rác** người dùng / thiết bị bỏ qua row còn được đợt kiểm kê tham chiếu.
- **Ngoài phạm vi:** Kiểm kê số lượng, máy thừa, QR, nhắc lịch, phân trang, sửa bộ lọc sau khi lập,
  huỷ đợt đã bắt đầu, luồng thanh lý.

## 7. Còn treo
- `Department.DepartmentCode`: **chốt giữ unique** (2026-09-21). Schema `backend/prisma/schema.prisma`
  và DB thật đã có ràng buộc này từ migration `20260917140549_init_user_login`, khớp icon khoá trên
  ERD — không đổi, không cần migration mới.
