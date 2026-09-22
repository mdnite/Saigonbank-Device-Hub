# Đóng các việc còn treo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dọn hết các việc còn treo của đợt quản lý người dùng (tên hệ thống lệch, chưa E2E trên PG thật, chưa merge vào main, chưa có text sửa báo cáo) để nhánh `main` sạch và sẵn sàng nhận vòng công việc tiếp theo.

**Architecture:** Bốn task độc lập, chạy tuần tự. Task 1 sửa chuỗi hiển thị ở backend (không đụng logic, không đụng DB). Task 2 thêm một script smoke E2E chạy ngoài jest, gọi backend thật trên PostgreSQL thật để kiểm những hành vi mà fake Prisma trong unit test không mô phỏng được (`mode: insensitive`, `orderBy`, guard đọc lại DB mỗi request). Task 3 chỉ viết tài liệu. Task 4 hợp nhất nhánh và đẩy lên origin.

**Tech Stack:** NestJS 11 + Prisma 7 + PostgreSQL 18 (native, `D:\Postgre`), jest, PowerShell 5.1 cho script E2E, git.

**Spec:** Không có spec riêng — đây là vòng bounded. Nguồn yêu cầu: `docs/doi-chieu-nhat-ky-cong-viec.md` (§1.5, §7) và danh sách "Open items" trong memory `project_overview.md`. Quyết định của người dùng ngày 2026-09-22: chọn tên **IDSM**, E2E ở mức script API, merge **và** push, soạn sẵn text sửa báo cáo.

## Global Constraints

- Mọi chuỗi hiển thị cho người dùng viết bằng **tiếng Việt** (quy ước sẵn có của repo).
- Tên hệ thống thống nhất là **IDSM**. Ngoại lệ đã chốt: **không đổi** tên role PostgreSQL `idms`, database `internal_device_management`, và chuỗi `postgresql://idms:...` trong `DATABASE_URL` — đó là hạ tầng cục bộ, đổi thì phải tạo lại role + database.
- Frontend **không đổi**: key `localStorage["idsm.session"]` đã đúng, giữ nguyên để không đăng xuất phiên đang có.
- Không bao giờ xoá cứng row `User`. Script E2E dùng username có timestamp để chạy lại được, **không** được `DELETE FROM "User"`.
- Lệnh backend chạy **trong thư mục `backend/`**, dùng `npx -y pnpm@10 ...` hoặc `npx ...` (máy không có pnpm/corepack toàn cục, không có Docker).
- Commit theo conventional commit tiếng Việt, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Không push lên origin ở bất kỳ task nào ngoài Task 4.

---

### Task 1: Thống nhất tên hệ thống thành IDSM ở backend

**Files:**
- Modify: `backend/package.json:4`
- Modify: `backend/README.md:1`
- Modify: `backend/.env.example:10`
- Modify: `backend/prisma/schema.prisma:2`
- Modify: `backend/src/shared/mail/mail.service.ts:28`
- Modify: `backend/.env` (file cục bộ, **không** commit — đã nằm trong `.gitignore`)
- Test: `backend/src/modules/identity/auth.spec.ts` (chạy lại, không sửa)

**Interfaces:**
- Consumes: không có (task đầu tiên).
- Produces: không có ký hiệu mới. Chỉ đổi chuỗi hiển thị; không hàm nào đổi chữ ký.

**Bối cảnh:** `grep` ngày 2026-09-22 cho đúng 5 chỗ chứa `IDMS` trong repo (bỏ `node_modules`), và **không có test nào assert tiêu đề email**, nên đổi chuỗi này an toàn. Chỗ quan trọng nhất là `mail.service.ts:28` vì đó là tiêu đề email OTP thật gửi tới người dùng.

- [ ] **Step 1: Xem chính xác 5 chỗ cần đổi**

Chạy trong `backend/`:

```bash
grep -rn "IDMS" --include="*.ts" --include="*.json" --include="*.md" --include="*.prisma" --include=".env.example" . | grep -v node_modules
```

Kết quả mong đợi (đúng 5 dòng):

```
./package.json:4:  "description": "IDMS backend (NestJS + Prisma)",
./.env.example:10:RESEND_FROM_EMAIL="IDMS <onboarding@resend.dev>"
./README.md:1:# IDMS Backend
./prisma/schema.prisma:2:// IDMS - schema.prisma (v3: 4 bảng phục vụ luồng Đăng nhập / Đăng xuất /
./src/shared/mail/mail.service.ts:28:      subject: 'IDMS - Mã xác thực đặt lại mật khẩu',
```

Nếu số dòng khác 5, dừng lại và báo — có chỗ mới xuất hiện so với lúc lập plan.

- [ ] **Step 2: Đổi cả 5 chỗ**

```bash
sed -i 's/IDMS/IDSM/' package.json .env.example README.md prisma/schema.prisma src/shared/mail/mail.service.ts
```

Sau đó chạy lại lệnh `grep` ở Step 1 — mong đợi **0 kết quả**.

- [ ] **Step 3: Ghi chú ngoại lệ tên DB trong `backend/README.md`**

Trong `backend/README.md`, ngay dưới phần hướng dẫn cấu hình `DATABASE_URL`, thêm đúng đoạn sau:

```markdown
> **Lưu ý tên gọi:** hệ thống tên là **IDSM**. Riêng role PostgreSQL `idms` và database
> `internal_device_management` giữ nguyên tên cũ — đổi tên role/database phải tạo lại cả hai và
> chạy lại migration, không đáng so với lợi ích. Chuỗi `idms` trong `DATABASE_URL` là tên role,
> không phải tên hệ thống.
```

- [ ] **Step 4: Sửa `backend/.env` cục bộ (không commit)**

Mở `backend/.env` và đổi dòng:

```
RESEND_FROM_EMAIL="IDMS <onboarding@resend.dev>"
```

thành:

```
RESEND_FROM_EMAIL="IDSM <onboarding@resend.dev>"
```

Không đổi `DATABASE_URL`. Kiểm tra file **không** bị git theo dõi:

```bash
git check-ignore -v backend/.env
```

Mong đợi: in ra dòng khớp rule trong `.gitignore`. Nếu không in gì, dừng lại — `.env` đang bị theo dõi, phải báo người dùng trước khi tiếp tục.

- [ ] **Step 5: Chạy toàn bộ kiểm thử + build + lint**

Chạy trong `backend/`:

```bash
npx -y pnpm@10 test
npx -y pnpm@10 run build
npx -y pnpm@10 run lint
```

Mong đợi: jest **49 passed** (2 suite: `auth.spec.ts`, `users.spec.ts`), build không lỗi, eslint không lỗi.

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/README.md backend/.env.example backend/prisma/schema.prisma backend/src/shared/mail/mail.service.ts
git commit -m "chore: thống nhất tên hệ thống thành IDSM ở backend

Backend còn 5 chỗ ghi IDMS trong khi frontend và tài liệu dùng IDSM, gồm cả
tiêu đề email OTP gửi cho người dùng thật. Role PostgreSQL idms và database
internal_device_management giữ nguyên tên (ghi chú trong backend/README.md).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Script E2E luồng quản lý người dùng trên PostgreSQL thật

**Files:**
- Create: `backend/scripts/e2e-users.ps1`
- Modify: `backend/README.md` (thêm mục hướng dẫn chạy script)
- Test: chính script này là bài kiểm thử; không có file test riêng.

**Interfaces:**
- Consumes: backend đã đổi tên ở Task 1, chạy ở `http://localhost:3000`; seed hiện có trong DB (`admin`/`Admin@123`, role id 1/2/3, department id 1 KYTHUAT / 2 KETOAN).
- Produces: `backend/scripts/e2e-users.ps1`, chạy bằng `powershell -ExecutionPolicy Bypass -File scripts/e2e-users.ps1`. Tham số: `-BaseUrl` (mặc định `http://localhost:3000`), `-AdminPassword` (mặc định `Admin@123`), `-PsqlPath` (mặc định `D:\Postgre\bin\psql.exe`), `-DbPassword` (mặc định `idms_dev`). Thoát code 0 khi tất cả bước xanh, 1 khi có bước hỏng.

**Vì sao cần script này:** unit test backend dùng fake Prisma (`backend/src/test/fake-prisma.ts`) — fake này **bỏ qua `mode: 'insensitive'` và `orderBy`**, và không mô phỏng được việc `AuthGuard` đọc lại User từ DB mỗi request. Ba hành vi đó chỉ chứng minh được trên PostgreSQL thật. Đây chính là mục "deferred" ghi trong `.superpowers/sdd/2026-09-19-user-management/progress.md` (Task A4).

**Envelope:** mọi response đều là `{ success, data, error, message }`. Dữ liệu thật nằm ở `.data`.

- [ ] **Step 1: Tạo thư mục và viết script**

Tạo `backend/scripts/e2e-users.ps1` với đúng nội dung sau:

```powershell
# E2E smoke cho luồng quản lý người dùng — chạy trên backend + PostgreSQL THẬT.
# Kiểm những hành vi mà fake Prisma trong unit test không mô phỏng được:
#   - tìm kiếm không phân biệt hoa thường (mode: insensitive)
#   - sắp xếp theo id tăng dần (orderBy)
#   - AuthGuard đọc lại User từ DB mỗi request → khoá tài khoản có hiệu lực NGAY
#   - xoá mềm: biến khỏi danh sách nhưng row vẫn còn trong DB
#
# Dùng username có timestamp nên chạy lại được nhiều lần, không cần dọn dẹp,
# không bao giờ xoá cứng row User.
#
# Chạy: powershell -ExecutionPolicy Bypass -File scripts/e2e-users.ps1

param(
  [string]$BaseUrl       = 'http://localhost:3000',
  [string]$AdminUsername = 'admin',
  [string]$AdminPassword = 'Admin@123',
  [string]$PsqlPath      = 'D:\Postgre\bin\psql.exe',
  [string]$DbUser        = 'idms',
  [string]$DbPassword    = 'idms_dev',
  [string]$DbName        = 'internal_device_management'
)

$ErrorActionPreference = 'Stop'
$script:Failed = 0

function Ok   ([string]$m) { Write-Host "  OK   $m" -ForegroundColor Green }
function Fail ([string]$m) { Write-Host "  FAIL $m" -ForegroundColor Red; $script:Failed++ }
function Step ([string]$m) { Write-Host ""; Write-Host "== $m" -ForegroundColor Cyan }

# Gọi API, trả về envelope đã parse. Ném lỗi nếu HTTP không thành công.
function Api {
  param([string]$Method, [string]$Path, [string]$Token, $Body)
  $headers = @{}
  if ($Token) { $headers['Authorization'] = "Bearer $Token" }
  $params = @{
    Method      = $Method
    Uri         = "$BaseUrl$Path"
    Headers     = $headers
    ContentType = 'application/json; charset=utf-8'
  }
  if ($null -ne $Body) {
    $json = $Body | ConvertTo-Json -Compress -Depth 5
    $params['Body'] = [System.Text.Encoding]::UTF8.GetBytes($json)
  }
  Invoke-RestMethod @params
}

# Gọi API và kỳ vọng một mã lỗi HTTP cụ thể.
function ExpectStatus {
  param([string]$Method, [string]$Path, [string]$Token, [int]$Expected, [string]$Label, $Body)
  try {
    Api -Method $Method -Path $Path -Token $Token -Body $Body | Out-Null
    Fail "$Label — mong $Expected nhưng request thành công"
  } catch {
    $res = $_.Exception.Response
    if ($null -eq $res) { Fail "$Label — không kết nối được: $($_.Exception.Message)"; return }
    $code = [int]$res.StatusCode
    if ($code -eq $Expected) { Ok "$Label → $code" } else { Fail "$Label — mong $Expected, nhận $code" }
  }
}

function Psql ([string]$Sql) {
  $env:PGPASSWORD = $DbPassword
  $out = & $PsqlPath -U $DbUser -h localhost -d $DbName -t -A -c $Sql 2>&1
  $env:PGPASSWORD = $null
  if ($LASTEXITCODE -ne 0) { throw "psql lỗi: $out" }
  return ($out | Out-String).Trim()
}

Step "0. Backend có đang chạy không"
try {
  Invoke-RestMethod -Uri "$BaseUrl/roles" -Method Get -ErrorAction Stop | Out-Null
  Fail "GET /roles không có token lẽ ra phải 401"
} catch {
  if ($null -eq $_.Exception.Response) {
    Write-Host "Không kết nối được $BaseUrl — hãy chạy 'npx -y pnpm@10 start:dev' trong backend/ trước." -ForegroundColor Red
    exit 1
  }
  if ([int]$_.Exception.Response.StatusCode -eq 401) { Ok "backend sống, /roles chặn request không token (401)" }
  else { Fail "GET /roles không token → $([int]$_.Exception.Response.StatusCode), mong 401" }
}

Step "1. Đăng nhập admin"
$login = Api -Method Post -Path '/auth/login' -Body @{ identifier = $AdminUsername; password = $AdminPassword }
$adminToken = $login.data.accessToken
$adminId    = $login.data.user.id
if ($adminToken) { Ok "admin đăng nhập được (id=$adminId, vai trò=$($login.data.user.roleName))" }
else { Fail "không lấy được accessToken"; exit 1 }

Step "2. Danh sách người dùng sắp xếp theo id tăng dần"
$before = (Api -Method Get -Path '/users' -Token $adminToken).data
$ids = @($before | ForEach-Object { $_.id })
$sorted = @($ids | Sort-Object)
if ("$ids" -eq "$sorted") { Ok "orderBy id asc đúng ($($ids.Count) người dùng)" }
else { Fail "danh sách không sắp xếp tăng dần: $ids" }

Step "3. Tạo người dùng mới"
$stamp    = Get-Date -Format 'yyyyMMddHHmmss'
$uname    = "e2e$stamp"
$upass    = 'E2e@1234'
$created  = (Api -Method Post -Path '/users' -Token $adminToken -Body @{
  username     = $uname
  email        = "$uname@e2e.local"
  fullName     = 'Người dùng kiểm thử E2E'
  password     = $upass
  roleId       = 3          # Nhân viên
  departmentId = 1          # KYTHUAT
}).data
$newId = $created.id
if ($newId) { Ok "tạo được $uname (id=$newId, isVerified=$($created.isVerified))" }
else { Fail "không tạo được người dùng"; exit 1 }
if ($created.isVerified -eq $false) { Ok "người dùng mới có isVerified=false theo đúng quyết định 2026-09-19" }
else { Fail "isVerified lẽ ra phải là false" }

Step "4. Tìm kiếm không phân biệt hoa thường (fake Prisma không kiểm được)"
$upper = $uname.ToUpper()
$found = (Api -Method Get -Path "/users?search=$upper" -Token $adminToken).data
if (@($found | Where-Object { $_.id -eq $newId }).Count -eq 1) { Ok "search='$upper' tìm ra '$uname'" }
else { Fail "search chữ HOA không tìm ra người dùng vừa tạo → mode:insensitive không hoạt động" }

Step "5. Lọc theo vai trò"
$staff = (Api -Method Get -Path '/users?roleId=3' -Token $adminToken).data
if (@($staff | Where-Object { $_.id -eq $newId }).Count -eq 1) { Ok "lọc roleId=3 có chứa người dùng mới" }
else { Fail "lọc roleId=3 không chứa người dùng mới" }
if (@($staff | Where-Object { $_.role.id -ne 3 }).Count -eq 0) { Ok "lọc roleId=3 không lẫn vai trò khác" }
else { Fail "lọc roleId=3 lẫn vai trò khác" }

Step "6. Người dùng mới đăng nhập và bị chặn khỏi /users"
$userToken = (Api -Method Post -Path '/auth/login' -Body @{ identifier = $uname; password = $upass }).data.accessToken
if ($userToken) { Ok "$uname đăng nhập được" } else { Fail "$uname không đăng nhập được"; exit 1 }
$roles = (Api -Method Get -Path '/roles' -Token $userToken).data
if ($roles.Count -ge 3) { Ok "người dùng thường đọc được danh mục /roles ($($roles.Count) vai trò)" }
else { Fail "/roles trả về $($roles.Count) vai trò, mong >= 3" }
ExpectStatus -Method Get -Path '/users' -Token $userToken -Expected 403 -Label "người dùng thường gọi GET /users"

Step "7. Khoá tài khoản — token cũ phải mất hiệu lực NGAY"
Api -Method Patch -Path "/users/$newId/status" -Token $adminToken -Body @{ status = 'Ngừng hoạt động' } | Out-Null
Ok "admin khoá $uname"
ExpectStatus -Method Get -Path '/roles' -Token $userToken -Expected 401 -Label "token cũ của tài khoản vừa bị khoá"
# Đăng nhập lại bằng tài khoản bị khoá: đúng mật khẩu nhưng Status khác "Đang hoạt động"
# → ForbiddenException('Tài khoản đã bị khoá') = 403, không phải 401.
ExpectStatus -Method Post -Path '/auth/login' -Token $null -Expected 403 `
  -Label "đăng nhập lại bằng tài khoản bị khoá" `
  -Body @{ identifier = $uname; password = $upass }

Step "8. Admin không được tự khoá / tự xoá mình"
try {
  Api -Method Patch -Path "/users/$adminId/status" -Token $adminToken -Body @{ status = 'Ngừng hoạt động' } | Out-Null
  Fail "admin tự khoá mình lẽ ra phải bị chặn"
} catch {
  if ([int]$_.Exception.Response.StatusCode -eq 400) { Ok "admin tự khoá mình → 400" }
  else { Fail "admin tự khoá mình → $([int]$_.Exception.Response.StatusCode), mong 400" }
}
ExpectStatus -Method Delete -Path "/users/$adminId" -Token $adminToken -Expected 400 -Label "admin tự xoá mình"

Step "9. Xoá mềm"
Api -Method Delete -Path "/users/$newId" -Token $adminToken | Out-Null
Ok "admin xoá mềm $uname"
$after = (Api -Method Get -Path '/users' -Token $adminToken).data
if (@($after | Where-Object { $_.id -eq $newId }).Count -eq 0) { Ok "người dùng đã xoá không còn trong danh sách mặc định" }
else { Fail "người dùng đã xoá vẫn hiện trong danh sách" }
ExpectStatus -Method Delete -Path "/users/$newId" -Token $adminToken -Expected 404 -Label "xoá lại người dùng đã xoá"

Step "10. Row vẫn còn trong DB (không xoá cứng)"
$status = Psql "SELECT ""Status"" FROM ""User"" WHERE ""Id"" = $newId;"
if ($status -eq 'Đã xóa') { Ok "DB: row id=$newId vẫn tồn tại, Status='Đã xóa'" }
elseif ([string]::IsNullOrWhiteSpace($status)) { Fail "DB: row id=$newId đã bị xoá cứng — vi phạm UC-06" }
else { Fail "DB: Status='$status', mong 'Đã xóa'" }

Step "11. Id ngoài phạm vi int32 trả 404 chứ không phải 500"
ExpectStatus -Method Delete -Path '/users/9999999999' -Token $adminToken -Expected 404 -Label "DELETE /users/9999999999"

Write-Host ""
if ($script:Failed -eq 0) {
  Write-Host "TẤT CẢ BƯỚC E2E ĐỀU XANH" -ForegroundColor Green
  exit 0
} else {
  Write-Host "$($script:Failed) BƯỚC HỎNG" -ForegroundColor Red
  exit 1
}
```

- [ ] **Step 2: Khởi động backend**

Mở một cửa sổ riêng, chạy trong `backend/`:

```bash
npx -y pnpm@10 start:dev
```

Chờ tới khi thấy `Nest application successfully started`.

Lưu ý đã biết (ghi trong memory `dev_environment`): nếu chạy nền, dừng tiến trình chỉ giết wrapper `npx`, tiến trình node con vẫn giữ cổng 3000 — kiểm bằng `Get-NetTCPConnection -LocalPort 3000 -State Listen` và giết `OwningProcess` nếu cần.

- [ ] **Step 3: Chạy script và xác nhận xanh**

Chạy trong `backend/`:

```bash
powershell -ExecutionPolicy Bypass -File scripts/e2e-users.ps1
```

Mong đợi: mọi dòng đều `OK`, kết thúc bằng `TẤT CẢ BƯỚC E2E ĐỀU XANH`, exit code 0.

Nếu có bước `FAIL`, **dừng lại, đừng sửa script cho vừa kết quả** — điều tra lỗi thật ở backend trước. Riêng bước 7 (`token cũ 401`) và bước 10 (`row vẫn còn`) là hai khẳng định nghiệp vụ chính; hỏng ở đó nghĩa là có lỗi thật.

- [ ] **Step 4: Thêm hướng dẫn vào `backend/README.md`**

Thêm mục sau vào cuối `backend/README.md`:

```markdown
## Kiểm thử đầu-cuối (E2E) trên PostgreSQL thật

`npx -y pnpm@10 test` dùng Prisma giả, nên không kiểm được ba thứ: tìm kiếm không phân biệt hoa
thường, sắp xếp theo id, và việc `AuthGuard` đọc lại User từ DB mỗi request. Script dưới đây kiểm
đúng ba thứ đó trên backend + PostgreSQL thật:

```bash
# cửa sổ 1
npx -y pnpm@10 start:dev
# cửa sổ 2
powershell -ExecutionPolicy Bypass -File scripts/e2e-users.ps1
```

Script tự sinh username theo timestamp nên chạy lại được nhiều lần và không bao giờ xoá cứng row
`User`. Tham số có thể đổi: `-BaseUrl`, `-AdminPassword`, `-PsqlPath`, `-DbPassword`.
```

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/e2e-users.ps1 backend/README.md
git commit -m "test: thêm script E2E quản lý người dùng trên PostgreSQL thật

Fake Prisma trong unit test bỏ qua mode:insensitive và orderBy, và không mô
phỏng được việc AuthGuard đọc lại User từ DB mỗi request. Script kiểm đúng ba
điểm đó cùng với phân quyền 403, tự khoá/tự xoá, xoá mềm giữ nguyên row, và id
ngoài phạm vi int32 trả 404.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Soạn text sửa nhật ký công việc để dán vào báo cáo

**Files:**
- Create: `docs/nhat-ky-cong-viec-ban-sua.md`
- Modify: `docs/doi-chieu-nhat-ky-cong-viec.md` (thêm liên kết ở §7)

**Interfaces:**
- Consumes: kết luận trong `docs/doi-chieu-nhat-ky-cong-viec.md` §1–§4 và bản viết lại đề xuất ở §3.
- Produces: `docs/nhat-ky-cong-viec-ban-sua.md` — văn bản tiếng Việt hoàn chỉnh, dán thẳng được vào Word, không còn ký hiệu ❌/⚠️/🕐 hay giọng văn đối chiếu.

**Khác biệt so với `doi-chieu-nhat-ky-cong-viec.md`:** file cũ là *bản phân tích* (chỉ ra cái sai). File mới là *bản thay thế* (văn bản đã viết xong để dán). Không lặp lại phần phân tích.

- [ ] **Step 1: Viết `docs/nhat-ky-cong-viec-ban-sua.md`**

Cấu trúc bắt buộc, theo đúng thứ tự:

1. **Phần mở đầu** — 3–4 dòng: file này chứa gì, dán vào đâu, đối chiếu ngày nào, nguồn là `docs/doi-chieu-nhat-ky-cong-viec.md`.
2. **Mục A — Bốn chỗ phải sửa ngay.** Bảng 3 cột: *Chỗ trong báo cáo* · *Đang ghi* · *Sửa thành*. Đúng 4 dòng, lấy từ §0 mục 2 của file đối chiếu: Argon2 → bcrypt (10 rounds); 4 vai trò → 3 vai trò (`Quản trị viên`, `Trưởng phòng`, `Nhân viên`, phân biệt trưởng phòng bằng `DepartmentId`); "admin đặt lại mật khẩu hộ thay cho email/OTP" → OTP 4 số gửi qua email Resend, hash SHA-256, hạn 5 phút, tối đa 5 lần sai, chỉ mã mới nhất hợp lệ, admin chỉ nhập mật khẩu **ban đầu** lúc tạo tài khoản; "đã deploy Neon/Render/Vercel" → mới chốt phương án, chưa deploy.
3. **Mục B — Nhật ký tuần 04 → 08, bản viết lại.** Chép nguyên văn 5 khối tuần ở §3 của `doi-chieu-nhat-ky-cong-viec.md`, giữ nguyên số liệu (49 ca jest, 38 ca vitest, migration `20260917140549_init_user_login`). Bỏ mọi ký hiệu đánh giá.
4. **Mục C — Hạng mục bị bỏ sót, nên chèn vào các tuần tương ứng.** Chuyển bảng §4 thành gạch đầu dòng, mỗi dòng một câu mô tả việc đã làm (giọng báo cáo), kèm tuần đề xuất chèn vào.
5. **Mục D — Hai điểm cần thống nhất trước khi nộp.** (i) Tên hệ thống: repo đã thống nhất **IDSM** ngày 2026-09-22 (xem `backend/README.md` về ngoại lệ tên role PostgreSQL `idms`) — báo cáo phải đổi mọi chỗ ghi IDMS thành IDSM. (ii) Package Diagram của backend: sơ đồ vẽ 4 tầng DDD, nhưng backend thật là NestJS thuần (`src/modules/{identity,users}` + `src/shared/{auth,http,mail,prisma,security}`) — sửa sơ đồ cho khớp code.
6. **Mục E — Rủi ro lịch tuần 09 → 11.** Tóm §5 của file đối chiếu thành một đoạn văn: database mới có 4 bảng, chưa có `Device`/`DeviceAccessory`/`AuditSession`, nên cần chèn thêm một tuần mở rộng ERD + migration trước khi làm được các tuần này.

Yêu cầu văn phong: câu khẳng định, giọng báo cáo, không dùng "chúng ta", không emoji, không ký hiệu ❌/⚠️/🕐/🔜/❔.

- [ ] **Step 2: Nối hai tài liệu với nhau**

Trong `docs/doi-chieu-nhat-ky-cong-viec.md`, sửa mục 7 điểm 3 từ:

```markdown
3. Viết lại nhật ký tuần 04 → 08 theo mục 3.
```

thành:

```markdown
3. Viết lại nhật ký tuần 04 → 08 — bản đã soạn sẵn, dán thẳng được vào báo cáo:
   [`nhat-ky-cong-viec-ban-sua.md`](./nhat-ky-cong-viec-ban-sua.md).
```

- [ ] **Step 3: Tự đọc lại**

Đọc lại `docs/nhat-ky-cong-viec-ban-sua.md` và kiểm 4 điểm:
- Không còn chỗ nào ghi "TBD", "TODO", hay bỏ trống.
- Mọi số liệu khớp với repo hôm nay: 3 vai trò, 4 bảng, 49 ca jest, 38 ca vitest, 12 file test frontend.
- Không mâu thuẫn với `docs/Changes.md` (đặc biệt: `Department.DepartmentCode` **giữ unique**).
- Dán được vào Word mà không cần sửa: không còn ký hiệu đánh giá, không còn giọng đối chiếu.

Sửa ngay tại chỗ nếu có vấn đề.

- [ ] **Step 4: Commit**

```bash
git add docs/nhat-ky-cong-viec-ban-sua.md docs/doi-chieu-nhat-ky-cong-viec.md
git commit -m "docs: soạn bản sửa nhật ký công việc để dán vào báo cáo

Tài liệu đối chiếu chỉ ra chỗ sai; file này là văn bản thay thế đã viết xong:
4 điểm phải sửa ngay, nhật ký tuần 04-08 viết lại theo commit thật, hạng mục
bị bỏ sót, và rủi ro lịch tuần 09-11.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Merge `feat/user-management` vào `main` và push

**Files:** không sửa file nào. Chỉ thao tác git.

**Interfaces:**
- Consumes: ba commit của Task 1–3 đã nằm trên `feat/user-management`.
- Produces: `main` chứa toàn bộ công việc từ `b56da11` tới nay, `origin/main` khớp `main`.

**Bối cảnh:** `main` đang ở `b56da11`; `feat/user-management` đang ở `296af95` (đã push). Người dùng đã đồng ý merge **và** push ngày 2026-09-22.

- [ ] **Step 1: Kiểm tra trạng thái trước khi merge**

```bash
git status --short
git log --oneline -3
```

Mong đợi: cây làm việc sạch, HEAD là commit của Task 3.

- [ ] **Step 2: Chạy lại toàn bộ kiểm thử lần cuối trên nhánh tính năng**

```bash
cd backend && npx -y pnpm@10 test && npx -y pnpm@10 run build && npx -y pnpm@10 run lint && cd ..
npm test && npm run build
```

Mong đợi: backend jest **49 passed**, build/lint sạch; frontend vitest **38 passed** (12 file), vite build sạch.

Nếu bất kỳ lệnh nào hỏng: **dừng**, không merge.

- [ ] **Step 3: Merge vào main**

```bash
git checkout main
git merge --no-ff feat/user-management -m "merge: quản lý người dùng, JWT guard và dọn việc còn treo

Gộp toàn bộ đợt 2026-09-19 (module users backend, màn /users + /users/new
frontend, AuthGuard đọc lại DB mỗi request) cùng đợt dọn dẹp 2026-09-21/22
(chặn id ngoài int32, thống nhất tên IDSM, script E2E, tài liệu báo cáo).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

Mong đợi: merge không xung đột (`main` không có commit nào sau `b56da11`, nên đây là merge thẳng).

- [ ] **Step 4: Xác nhận main đúng**

```bash
git log --oneline -3
git diff --stat feat/user-management main
```

Mong đợi: `git diff` **không in gì** — nội dung `main` khớp hệt nhánh tính năng.

- [ ] **Step 5: Chạy lại kiểm thử trên main**

```bash
cd backend && npx -y pnpm@10 test && cd ..
npm test
```

Mong đợi: 49 + 38 passed.

- [ ] **Step 6: Push**

```bash
git push origin main
git push origin feat/user-management
```

Mong đợi: cả hai nhánh khớp origin. Xác nhận:

```bash
git status -sb
```

- [ ] **Step 7: Cập nhật memory**

Sửa `C:\Users\tanmi\.claude\projects\D--AI-Saigonbank-Device-Hub\memory\project_overview.md`:
- Ghi `main` đã chứa toàn bộ công việc và đã push; nêu commit merge.
- Bỏ khỏi "Open items": mục merge, mục E2E thủ công, mục DB chưa seed lại (DB đã đúng — đã xác minh 2026-09-22: 3 role, KYTHUAT + KETOAN, admin + dev).
- Thêm: tên hệ thống chốt là **IDSM**, ngoại lệ role PostgreSQL `idms` + database `internal_device_management` giữ nguyên tên.
- Thêm: `backend/scripts/e2e-users.ps1` là bài E2E chạy lại được; `docs/nhat-ky-cong-viec-ban-sua.md` là text sửa báo cáo đang chờ người dùng dán vào Word.
- Giữ trong "Open items": phần thiết bị chưa có bảng nào trong DB (chặn tuần 09–11), chưa có Modal/Toast, `/users` chưa phân trang và chưa có màn sửa, token trong localStorage.

Cập nhật một dòng tương ứng trong `MEMORY.md` nếu phần mô tả đã lệch.

---

## Việc cố ý KHÔNG làm trong plan này

- **Sửa thông tin người dùng, phân trang, Modal/Toast** — đã chốt ngoài phạm vi ngày 2026-09-19, chưa có yêu cầu mới.
- **Mở rộng ERD cho thiết bị** (`Device`, `DeviceAccessory`, `AuditSession`, ...) — đây là một vòng công việc riêng, cần brainstorm và spec riêng.
- **Đổi tên role PostgreSQL `idms` và database `internal_device_management`** — phải tạo lại role + database + chạy lại migration, không đáng.
- **Deploy Neon / Render / Vercel** — chưa được yêu cầu.
- **Nối `/settings` vào backend thật** — vẫn là mock có chủ đích, chưa có API hồ sơ cá nhân.
