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
#
# LƯU Ý: file này phải lưu ở UTF-8 CÓ BOM — thiếu BOM thì PowerShell 5.1 đọc sai chuỗi tiếng Việt.

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
  # PowerShell 5.1 bọc lại tham số khi gọi exe native và nuốt mất dấu nháy kép mà PostgreSQL
  # cần cho tên cột PascalCase ("Status", "User") → đưa câu lệnh qua stdin thay vì tham số -c.
  $out = $Sql | & $PsqlPath -U $DbUser -h localhost -d $DbName -t -A 2>&1
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
