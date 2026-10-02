# Spec: Kiểm kê chi tiết và Bảng tổng hợp kiểm kê

> Chốt ngày 2026-10-02 qua brainstorming, trên `main` (role Cộng tác viên đã merge local). Báo cáo
> BCTT-HKTT **không có** AD/SD cho Kiểm kê — luồng dưới đây do người dùng thiết kế trong buổi này,
> bám 5 frame Figma đã đọc. Làm trên nhánh `feat/kiem-ke`, thực thi subagent-driven.

## 1. Context

`/audit` đang là `ComingSoonPage` — placeholder cuối cùng của FE. Thiết bị đã có dữ liệu thật
(`Device`, `DeviceAccessory`, trạng thái `Trong kho` / `Đã cấp phát` / `Đang chờ duyệt` /
`Chờ thanh lý` / `Đã xóa`); `Device` **không** còn cột phòng ban — phòng ban suy ra từ người giữ.
Phòng Kế toán (`KETOAN`) chưa có quyền gì (`docs/Changes.md` §4 ghi "dự kiến").

**Figma** `OuDy5KuU8mWCWiFvdrU0jZ` — đã đọc: `337:2672` / `337:2751` (trang Kiểm kê, 3 tab, empty
state), `337:2805` (tab Tổng hợp), `338:2878` (modal Lập lịch kiểm kê), `338:3004` (chi tiết một đợt:
tab Thiết bị kiểm kê / Thành viên tham gia, Xuất khẩu, Bắt đầu kiểm kê). **Chưa đọc được** (giới hạn
MCP gói Starter): `361:3191`, `363:3324`, `364:3465`, `366:3616` — spec không dựa vào chúng.

## 2. Quyết định đã chốt (không hỏi lại)

### Quyền và phạm vi
| # | Quyết định |
|---|---|
| 1 | **CTV Kế toán** lập lịch, bắt đầu, nhập kết quả, sửa thành viên, gửi duyệt, lập bảng tổng hợp. |
| 2 | **TP Kế toán** duyệt / từ chối. Không lập lịch, không nhập. |
| 3 | Menu và API Kiểm kê **chỉ** cho TP + CTV Kế toán. Quản trị viên, Kỹ thuật, Nhân viên không thấy. |
| 4 | Vòng này: **Kiểm kê chi tiết** + **Tổng hợp**. Tab "Kiểm kê số lượng" = placeholder. |

### Lập lịch và snapshot
| # | Quyết định |
|---|---|
| 5 | **Đơn vị kiểm kê** = một phòng ban (thiết bị đang cấp cho người thuộc phòng đó) **hoặc** đơn vị giả **"Kho"** (thiết bị `Trong kho`). |
| 6 | Bộ lọc: Đơn vị bắt buộc; **Loại thiết bị** và **Vị trí** tuỳ chọn (trống = tất cả). Vị trí là dropdown các giá trị `Device.location` đang có. **Bỏ** ô "Nguồn lấy thiết bị" và "Thiết bị" của Figma (cố ý lệch). Ô "Loại" chỉ còn "Kiểm kê chi tiết". |
| 7 | Chỉ lấy thiết bị `Trong kho` + `Đã cấp phát`. |
| 8 | **Snapshot lúc lập lịch**: mã, tên, serial, loại, đơn vị tính, người sở hữu, phòng ban, trạng thái — và **toàn bộ linh kiện** (mã, tên, loại, đơn vị tính). Thiết bị/linh kiện đổi sau đó không làm đổi đợt. |
| 9 | **Không khoá** thiết bị trong lúc kiểm kê — đơn/lệnh/sửa/xoá vẫn chạy bình thường. |
| 10 | Một thiết bị không được nằm trong 2 đợt **đang mở** (mọi trạng thái trừ `Đã duyệt` / `Đã hủy`). Bộ lọc trúng máy như vậy → **400 cả đợt**, liệt kê mã máy. |
| 11 | **Mục đích**: `Định kỳ` / `Đột xuất` / `Cuối năm` (hằng số, lưu nguyên văn). |
| 12 | **Thành viên tham gia**: mọi user đang hoạt động, tuỳ chọn, sửa được tới khi gửi duyệt. Chỉ để ghi nhận / in biên bản — không cấp quyền gì. |

### Đếm, duyệt, hệ quả
| # | Quyết định |
|---|---|
| 13 | Vòng đời: `Chưa kiểm kê` →(Bắt đầu)→ `Đang kiểm kê` →(Gửi duyệt)→ `Chờ duyệt` →(Duyệt)→ `Đã duyệt`. **Từ chối** (bắt buộc lý do) đưa về `Đang kiểm kê`; lý do hiện thành **banner**, không phải trạng thái lưu. **Huỷ** (CTV, chỉ khi `Chưa kiểm kê`, không cần lý do) → `Đã hủy` — trạng thái cuối, nhả máy cho đợt khác. |
| 14 | Kết quả mỗi thiết bị **và mỗi linh kiện**: `Đủ` / `Thiếu` / `Hỏng` + ghi chú tuỳ chọn; `null` = chưa đếm. Lưu **từng dòng** ngay khi đổi. |
| 15 | Gửi duyệt chỉ khi **100%** dòng (máy + linh kiện) có kết quả. Có nút "Ghi Đủ cho dòng chưa đếm". |
| 16 | Duyệt: máy `Thiếu` → trạng thái mới **`Thất lạc`**, máy `Hỏng` → **`Chờ thanh lý`**; **giữ** người sở hữu. Máy `Đủ` không đổi. Linh kiện chỉ ghi nhận — **không** ghi vào `DeviceAccessory`. |
| 17 | **Chặn duyệt** nếu một dòng `Thiếu`/`Hỏng` có thiết bị đã khác snapshot (trạng thái hoặc người sở hữu) → 400 liệt kê mã. Dòng `Đủ` không bao giờ chặn. Gỡ kẹt: TP từ chối → CTV đổi kết quả dòng đó → gửi lại. |
| 18 | Hạn "Đến ngày" qua mà đợt còn đang mở → nhãn **"Quá hạn"** tính lúc hiển thị; không chặn gì, không cron. |
| 19 | Máy thừa (có thật nhưng ngoài danh sách) — không xử lý vòng này. |
| 20 | Nút **"Tìm thấy"** (TP Kỹ thuật, ở `/devices`): `Thất lạc` → `Đã cấp phát` nếu còn người sở hữu, ngược lại `Trong kho`. |

### Tổng hợp, xuất, UI
| # | Quyết định |
|---|---|
| 21 | **Bảng tổng hợp**: CTV Kế toán tick nhiều đợt `Đã duyệt` + tiêu đề (+ mục đích tuỳ chọn). Không trạng thái, không duyệt. Một đợt được vào nhiều bảng (n-n). |
| 22 | Nội dung bảng tổng hợp = **ma trận đơn vị × loại thiết bị**, cột Tổng / Đủ / Thiếu / Hỏng — **chỉ đếm thiết bị**, không đếm linh kiện. Tính lúc đọc từ snapshot (bất biến sau duyệt), bằng JS ở service. |
| 23 | Xuất **PDF** (jsPDF + font DejaVu dùng chung) **và CSV** (UTF-8 có BOM) — cho cả đợt và bảng tổng hợp. |
| 24 | UI theo Figma: `/audit` 3 tab; Lập lịch là **Modal** thật (component Modal đầu tiên của dự án); `/audit/:id` chi tiết 2 tab. Nhãn "Người quản lý" của Figma đổi thành **"Người sở hữu"** (quy ước #4 vòng thiết bị). |

## 3. Dữ liệu

Quy ước như các bảng hiện có: field camelCase + `@map` PascalCase, `@@map` tên bảng, trạng thái lưu
tiếng Việt, **không bao giờ xoá** đợt / bảng tổng hợp, mọi FK tới `User` ghi rõ `onDelete: Restrict`
(kể cả FK nullable — xem bẫy SetNull ở vòng Cấp phát). Một migration thuần **thêm bảng**
(`add_audit`), không `ALTER` bảng cũ.

```prisma
model Audit {
  id           Int       @id @default(autoincrement()) @map("Id")
  status       String    @default("Chưa kiểm kê") @map("Status") @db.VarChar(20)  // + Đang kiểm kê | Chờ duyệt | Đã duyệt | Đã hủy
  departmentId Int?      @map("DepartmentId")          // null = đơn vị "Kho"
  unitName     String    @map("UnitName") @db.VarChar(150)   // snapshot tên đơn vị
  dueDate      DateTime  @map("DueDate") @db.Date
  purpose      String    @map("Purpose") @db.VarChar(20)
  deviceTypeId Int?      @map("DeviceTypeId")          // bộ lọc đã dùng
  location     String?   @map("Location") @db.VarChar(150)
  createdById  Int       @map("CreatedById")
  startedAt    DateTime? @map("StartedAt")
  submittedAt  DateTime? @map("SubmittedAt")
  decidedById  Int?      @map("DecidedById")
  decidedAt    DateTime? @map("DecidedAt")
  rejectReason String?   @map("RejectReason") @db.VarChar(255)  // lần từ chối gần nhất; xoá khi gửi lại
  createdAt    DateTime  @default(now()) @map("CreatedAt")
  // relations: department (Restrict), deviceType (Restrict), createdBy / decidedBy (Restrict),
  //            items, members, summaries
  @@map("Audit")
}

model AuditItem {
  id             Int     @id @default(autoincrement()) @map("Id")
  auditId        Int     @map("AuditId")               // Cascade (an toàn dữ liệu, đợt không bị xoá)
  deviceId       Int     @map("DeviceId")              // Restrict
  deviceCode     String  @db.VarChar(20)
  deviceName     String  @db.VarChar(150)
  serialNumber   String? @db.VarChar(100)
  deviceTypeName String  @db.VarChar(100)
  unit           String  @db.VarChar(20)
  holderUserId   Int?                                  // snapshot, KHÔNG phải FK (so sánh lúc duyệt)
  holderName     String? @db.VarChar(150)
  departmentName String? @db.VarChar(150)
  deviceStatus   String  @db.VarChar(50)               // snapshot, so sánh lúc duyệt
  result         String? @db.VarChar(10)               // Đủ | Thiếu | Hỏng
  note           String? @db.VarChar(255)
  accessories    AuditItemAccessory[]
  @@unique([auditId, deviceId])
  @@map("AuditItem")
}

model AuditItemAccessory {
  id            Int     @id @default(autoincrement()) @map("Id")
  auditItemId   Int     @map("AuditItemId")           // Cascade
  accessoryCode String  @db.VarChar(50)
  accessoryName String  @db.VarChar(150)
  accessoryType String  @db.VarChar(100)
  unit          String  @db.VarChar(20)
  result        String? @db.VarChar(10)
  note          String? @db.VarChar(255)
  @@map("AuditItemAccessory")
}

model AuditMember {
  auditId Int @map("AuditId")   // Cascade
  userId  Int @map("UserId")    // Restrict
  @@id([auditId, userId])
  @@map("AuditMember")
}

model AuditSummary {
  id          Int      @id @default(autoincrement()) @map("Id")
  title       String   @map("Title") @db.VarChar(150)
  purpose     String?  @map("Purpose") @db.VarChar(20)
  createdById Int      @map("CreatedById")            // Restrict
  createdAt   DateTime @default(now()) @map("CreatedAt")
  @@map("AuditSummary")
}

model AuditSummaryAudit {
  summaryId Int @map("SummaryId")   // Cascade
  auditId   Int @map("AuditId")     // Restrict
  @@id([summaryId, auditId])
  @@map("AuditSummaryAudit")
}
```

(Các cột snapshot cũng `@map` PascalCase như mọi cột khác; rút gọn ở trên cho dễ đọc.)

**Ngoài module mới:**
- `DEVICE_STATUS.LOST = 'Thất lạc'` (BE `device-status.ts` + FE `device/domain/device.ts`, tone badge).
  `Status` là `varchar` — không cần migration.
- `/users/purge` và `/devices/purge` phải **bỏ qua** row còn bị `Audit` / `AuditItem` / `AuditMember` /
  `AuditSummary` tham chiếu (cùng cách đã làm cho `DeviceTransfer`), nếu không hard delete sẽ vỡ FK.
- Seed dev: `truongphong.ketoan` / `Head@1234`, `ctv.ketoan` / `Collab@1234` (phòng `KETOAN`).

## 4. Backend

### 4.1 Quyền
`shared/auth/actors.ts` thêm `ACCT_DEPARTMENT_CODE = 'KETOAN'`, `ACTOR.ACCT_HEAD`
(Trưởng phòng + KETOAN), `ACTOR.ACCT_COLLAB` (Cộng tác viên + KETOAN). Dropdown phòng ban và chọn
thành viên dùng lại `GET /departments`, `GET /users/lookup` (đã mở cho mọi user đăng nhập).

### 4.2 Module `audits` — đợt kiểm kê
Controller `@Allow(ACCT_HEAD, ACCT_COLLAB)` ở class; handler ghi đè khi chặt hơn.

| Endpoint | Ai | Điều kiện → tác dụng |
|---|---|---|
| `GET /audits?status=&q=` | cả hai | Danh sách + `itemCount`, `countedCount` (máy + linh kiện). `q` tìm theo tên đơn vị / mục đích. |
| `GET /audits/:id` | cả hai | Chi tiết + items (kèm accessories) + members (id, họ tên) + createdBy / decidedBy. |
| `GET /audits/locations` | cả hai | `Device.location` distinct, khác null, thiết bị chưa `Đã xóa`, sắp xếp A→Z. |
| `POST /audits` | CTV | `{departmentId: number \| null, dueDate, purpose, deviceTypeId?, location?, memberIds?}`. Trong 1 transaction: lọc thiết bị (#5–7) → 400 nếu rỗng ("Không có thiết bị nào khớp bộ lọc") → 400 nếu trùng đợt đang mở (#10) → tạo Audit + items + accessories + members. |
| `POST /audits/:id/start` | CTV | `Chưa kiểm kê` → `Đang kiểm kê`, `startedAt`. |
| `POST /audits/:id/cancel` | CTV | `Chưa kiểm kê` → `Đã hủy`. |
| `PUT /audits/:id/members` | CTV | `{userIds}` thay toàn bộ; chỉ khi `Chưa kiểm kê` / `Đang kiểm kê`. |
| `PATCH /audits/:id/items/:itemId` | CTV | `{result?, note?}`; chỉ khi `Đang kiểm kê`; item phải thuộc đợt (404). |
| `PATCH /audits/:id/accessories/:accId` | CTV | như trên, cho linh kiện (thuộc item thuộc đợt). |
| `POST /audits/:id/mark-uncounted-ok` | CTV | Mọi item + accessory `result = null` → `Đủ`; chỉ khi `Đang kiểm kê`. |
| `POST /audits/:id/submit` | CTV | `Đang kiểm kê` → `Chờ duyệt`; 400 nếu còn dòng chưa đếm; xoá `rejectReason`, ghi `submittedAt`. |
| `POST /audits/:id/approve` | TP | §4.4. |
| `POST /audits/:id/reject` | TP | `{reason}` bắt buộc → `Đang kiểm kê`, ghi `rejectReason`, `decidedById`, `decidedAt`. Chống race bằng `updateMany where status = Chờ duyệt`. |

Mọi chuyển trạng thái dùng `updateMany({ where: { id, status: <trạng thái nguồn> } })` + kiểm `count`,
count = 0 → 400 "Đợt kiểm kê đã được xử lý hoặc không ở trạng thái phù hợp".

### 4.3 Module `audits` — bảng tổng hợp (controller thứ hai, cùng module)
| Endpoint | Ai | |
|---|---|---|
| `GET /audit-summaries` | cả hai | Danh sách + số đợt. |
| `GET /audit-summaries/:id` | cả hai | Các đợt thành phần + `matrix: [{unitName, deviceTypeName, total, ok, missing, broken}]` gộp bằng hàm thuần `buildMatrix` trên các `AuditItem` đã đọc (không `groupBy` — fake-prisma không giả lập được, và số dòng nhỏ). |
| `POST /audit-summaries` | CTV | `{title, purpose?, auditIds: number[] (≥1, không trùng)}`; mọi đợt phải tồn tại và `Đã duyệt` → nếu không 400 liệt kê id. |

### 4.4 Duyệt
0. **Ngoài transaction**, đọc các Device của dòng `Thiếu`/`Hỏng`, so với snapshot → có máy lệch thì 400 ngay (message ở bước 3), chưa ghi gì.

Rồi trong một transaction:
1. `audit.updateMany({ where: { id, status: 'Chờ duyệt' }, data: { status: 'Đã duyệt', decidedById, decidedAt } })`; count 0 → 400 "đã được xử lý".
2. Với mỗi item `Thiếu` / `Hỏng`, **sắp theo `deviceId` tăng dần** (cùng thứ tự khoá, tránh deadlock):
   `device.updateMany({ where: { id: deviceId, status: item.deviceStatus, currentUserId: item.holderUserId }, data: { status: 'Thất lạc' | 'Chờ thanh lý' } })`.
3. Gom các item có count 0 → nếu có, `throw` (rollback cả transaction) 400
   "Thiết bị X, Y đã thay đổi kể từ lúc lập lịch — từ chối đợt và sửa kết quả các dòng này".

### 4.5 Module `devices`
`POST /devices/:id/found` — `@Allow(ACTOR.TECH_HEAD)`. `updateMany where status = 'Thất lạc'` →
`Đã cấp phát` nếu `currentUserId` khác null, ngược lại `Trong kho`; count 0 → 400 "Thiết bị không ở
trạng thái Thất lạc". Không đụng các endpoint khác: máy `Thất lạc` / `Chờ thanh lý` vẫn sửa / xoá mềm
như thường; đơn / lệnh tự loại chúng vì chỉ nhận `Trong kho` / `Đã cấp phát`.

### 4.6 Lỗi
Đi qua envelope sẵn có (`ApiExceptionFilter`). 400 = vi phạm nghiệp vụ (message tiếng Việt cụ thể),
403 = sai actor, 404 = id không tồn tại / ngoài int4 (cùng cách `findLiveUser`), DTO dùng
class-validator + `@IsIn` cho purpose / result, `@Min(1) @Max(MAX_INT32)` cho id.

## 5. Frontend

### 5.1 Quyền
`modules/auth/domain/session.ts`: `ACCT_DEPARTMENT_CODE`, `isAcctHead`, `isAcctCollab`,
`canAccessAudits` (TP hoặc CTV KT), `canCreateAudit` (CTV KT), `canDecideAudit` (TP KT),
`canMarkDeviceFound` (TP Kỹ thuật). Nav "Kiểm kê" thêm cờ `auditAccessOnly`; route bọc
`RequireCan(canAccessAudits)`.

### 5.2 Module `modules/audit` (DDD-lite, mirror `allocation`)
- `domain/audit.ts` — kiểu, hằng `AUDIT_STATUS` / `AUDIT_RESULT` / `AUDIT_PURPOSE`, `WAREHOUSE_UNIT`,
  `isOverdue(audit, today)`, `validateAuditDraft`.
- `domain/auditCsv.ts` — hàm thuần: chi tiết đợt / bảng tổng hợp → chuỗi CSV (BOM, escape `"` `,` xuống dòng).
- `application/AuditRepository.ts`, `infrastructure/HttpAuditRepository.ts` (unwrap envelope), `container.ts`.
- `presentation/`:

| Route | Màn | Nội dung |
|---|---|---|
| `/audit` | `AuditHomePage` | 3 tab. **Kiểm kê chi tiết**: bảng đợt (Ngày tạo, Đơn vị, Mục đích, Đến ngày, Trạng thái + "Quá hạn", Tiến độ x/y), tìm kiếm, lọc trạng thái, empty state "Chưa có kiểm kê", nút **+ Lập lịch kiểm kê** (CTV). **Kiểm kê số lượng**: placeholder. **Tổng hợp**: bảng tổng hợp + **+ Lập bảng tổng hợp** (CTV). |
| (modal) | `ScheduleAuditModal` | Đơn vị (phòng ban + "Kho"), Đến ngày, Mục đích, Loại thiết bị, Vị trí, Thành viên (chọn nhiều). |
| (modal) | `CreateSummaryModal` | Tiêu đề, Mục đích, checkbox các đợt `Đã duyệt`. |
| `/audit/:id` | `AuditDetailPage` | Tiêu đề "Kiểm kê thiết bị tại {đơn vị} đến ngày {dd/MM/yyyy}", badge, banner từ chối. Tab **Thiết bị kiểm kê**: bảng Figma, tìm kiếm, "Nhóm theo loại thiết bị", linh kiện là dòng con, cột Kết quả (select) + Ghi chú (lưu khi blur/đổi), dòng Tổng cộng (Đủ/Thiếu/Hỏng/Chưa đếm). Tab **Thành viên tham gia**. Nút theo vai + trạng thái: Bắt đầu kiểm kê · Huỷ đợt (`window.confirm`) · Ghi Đủ cho dòng chưa đếm · Gửi duyệt (tắt khi < 100%) · Duyệt · Từ chối · Xuất PDF · Xuất CSV. |
| `/audit/summaries/:id` | `AuditSummaryPage` | Đợt thành phần + ma trận + dòng tổng, Xuất PDF / CSV. |

### 5.3 Dùng chung / chỗ khác
- `shared/ui/Modal.tsx` — bọc `<dialog>` gốc (`showModal()`, Esc, backdrop), không thêm thư viện.
- `shared/lib/downloadCsv.ts` — Blob + thẻ `<a download>`.
- `presentation/print/generateAuditReport.ts`, `generateSummaryReport.ts` — dynamic import, font từ `shared/print`.
- `/devices`: nút **Tìm thấy** trên dòng `Thất lạc` khi `canMarkDeviceFound` (`window.confirm`).
- `window.confirm` cho Duyệt, `window.prompt` cho lý do Từ chối — vẫn chưa có Toast.

## 6. Kiểm thử
- **BE jest** (`audits.spec.ts`, mở rộng `fake-prisma.ts` cho các bảng mới + `groupBy`): quyền từng
  endpoint theo 5 vai (Admin, TP/CTV Kỹ thuật, TP/CTV Kế toán); lập lịch theo phòng ban / Kho / bộ lọc;
  rỗng → 400; trùng đợt → 400; snapshot có linh kiện; chuyển trạng thái sai nguồn → 400; huỷ chỉ khi `Chưa kiểm kê` và nhả máy cho đợt mới; gửi khi chưa
  100% → 400; duyệt đổi Thất lạc / Chờ thanh lý và giữ người sở hữu; duyệt bị chặn khi máy đã đổi
  (rollback, đợt vẫn `Chờ duyệt`); dòng Đủ với máy đã đổi không chặn; từ chối → `Đang kiểm kê` + lý do;
  tổng hợp chỉ nhận đợt `Đã duyệt` và ma trận đúng; `found` chỉ cho `Thất lạc`, đúng trạng thái đích;
  purge bỏ qua row còn bị Audit tham chiếu.
- **FE vitest**: `validateAuditDraft`, `isOverdue`, `auditCsv`, `HttpAuditRepository` (unwrap), quyền
  `session.ts`, `AuditHomePage` / `AuditDetailPage` (nút theo vai + trạng thái, Gửi duyệt tắt khi < 100%).
- **E2E** `backend/scripts/e2e-audits.ps1` theo khuôn sẵn có (UTF-8 BOM, SQL qua stdin, tự tạo
  TP/CTV KT): lập lịch → bắt đầu → nhập → gửi → từ chối → gửi lại → duyệt → kiểm DB `Thất lạc` /
  `Chờ thanh lý` → tìm thấy → tổng hợp.
- Lint + build cả hai phía bằng đúng npm script (`npm run lint` FE là `tsc -b`).

## 7. Tài liệu
`docs/CONTEXT.md` (route `/audit` thật, nav, quyền), `docs/Changes.md` §4 (bảng quyền Kế toán, trạng
thái Thất lạc) + ERD DBML các bảng mới, 3 README.

## 8. Ngoài phạm vi
Kiểm kê số lượng · máy thừa · QR / quét mã · thông báo / nhắc lịch (toggle trong Cài đặt vẫn mock) ·
Toast · phân trang · ghi `DeviceAccessory` từ kết quả kiểm kê · luồng thanh lý cho `Chờ thanh lý` ·
sửa bộ lọc của đợt sau khi lập (lập nhầm → Huỷ rồi lập lại) · huỷ đợt đã bắt đầu (đã `Đang kiểm kê` thì phải
đếm xong và duyệt mới nhả máy).
