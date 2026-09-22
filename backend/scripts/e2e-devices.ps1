# E2E smoke cho luồng quản lý thiết bị — chạy trên backend + PostgreSQL THẬT.
# Kiểm những hành vi mà fake Prisma trong unit test không mô phỏng được:
#   - tìm kiếm không phân biệt hoa thường (mode: insensitive)
#   - sắp xếp theo id tăng dần (orderBy)
#   - ràng buộc unique thật (deviceCode, serialNumber)
#   - nested write PATCH accessories: { deleteMany: {}, create: [...] } — thay toàn bộ danh sách
#   - xoá mềm: biến khỏi danh sách nhưng row vẫn còn trong DB
#
# Dùng mã thiết bị có timestamp nên chạy lại được nhiều lần, không cần dọn dẹp,
# không bao giờ xoá cứng row Device / DeviceAccessory.
#
# Chạy: powershell -ExecutionPolicy Bypass -File scripts/e2e-devices.ps1
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
  # cần cho tên cột PascalCase ("Status", "DeviceId") → đưa câu lệnh qua stdin thay vì tham số -c.
  $out = $Sql | & $PsqlPath -U $DbUser -h localhost -d $DbName -t -A 2>&1
  $env:PGPASSWORD = $null
  if ($LASTEXITCODE -ne 0) { throw "psql lỗi: $out" }
  return ($out | Out-String).Trim()
}

# Timestamp mili-giây để sinh nhiều mã thiết bị không trùng trong cùng lần chạy.
$stamp = Get-Date -Format 'yyyyMMddHHmmssfff'
$baseSuffix = [int]($stamp.Substring($stamp.Length - 6))
function Suffix6 ([int]$Offset) {
  $n = ($baseSuffix + $Offset) % 1000000
  return $n.ToString('D6')
}

Step "0. Backend có đang chạy không"
try {
  Invoke-RestMethod -Uri "$BaseUrl/device-types" -Method Get -ErrorAction Stop | Out-Null
  Fail "GET /device-types không có token lẽ ra phải 401"
} catch {
  if ($null -eq $_.Exception.Response) {
    Write-Host "Không kết nối được $BaseUrl — backend chưa chạy." -ForegroundColor Red
    exit 1
  }
  if ([int]$_.Exception.Response.StatusCode -eq 401) { Ok "backend sống, /device-types chặn request không token (401)" }
  else { Fail "GET /device-types không token → $([int]$_.Exception.Response.StatusCode), mong 401" }
}

Step "1. Đăng nhập admin"
$login = Api -Method Post -Path '/auth/login' -Body @{ identifier = $AdminUsername; password = $AdminPassword }
$adminToken = $login.data.accessToken
if ($adminToken) { Ok "admin đăng nhập được (vai trò=$($login.data.user.roleName))" }
else { Fail "không lấy được accessToken"; exit 1 }
if ($login.data.user.PSObject.Properties.Name -contains 'departmentCode') {
  Ok "user.departmentCode tồn tại trong envelope (giá trị=$($login.data.user.departmentCode))"
} else {
  Fail "user.departmentCode không có trong envelope"
}

Step "2. Danh mục loại thiết bị"
$types = (Api -Method Get -Path '/device-types' -Token $adminToken).data
if ($types.Count -ge 4) { Ok "có $($types.Count) loại thiết bị" } else { Fail "chỉ có $($types.Count) loại, mong >= 4" }
if (@($types | Where-Object { -not $_.prefix }).Count -eq 0) { Ok "mọi loại đều có prefix" } else { Fail "có loại thiết bị thiếu prefix" }
$laptop = $types | Where-Object { $_.prefix -eq 'LT' } | Select-Object -First 1
$pc     = $types | Where-Object { $_.prefix -eq 'PC' } | Select-Object -First 1
if ($laptop -and $pc) { Ok "tìm được loại Laptop (id=$($laptop.id)) và Máy tính để bàn (id=$($pc.id))" }
else { Fail "không tìm được loại thiết bị prefix LT/PC trong danh mục"; exit 1 }

Step "3. Tạo thiết bị Laptop"
$code = "LT-$(Suffix6 0)"
$created = (Api -Method Post -Path '/devices' -Token $adminToken -Body @{
  deviceCode   = $code
  deviceName   = "Laptop kiểm thử E2E $stamp"
  specDetail   = 'Core i5, 16GB RAM, 512GB SSD'
  unit         = 'Cái'
  deviceTypeId = $laptop.id
}).data
$deviceId = $created.id
if ($deviceId) { Ok "tạo được $code (id=$deviceId)" } else { Fail "không tạo được thiết bị"; exit 1 }
if ($created.status -eq 'Trong kho') { Ok "status mặc định = 'Trong kho'" }
else { Fail "status='$($created.status)', mong 'Trong kho'" }

Step "4. Tìm kiếm không phân biệt hoa thường (fake Prisma không kiểm được)"
$upper = $code.ToUpper()
$found = (Api -Method Get -Path "/devices?search=$upper" -Token $adminToken).data
if (@($found | Where-Object { $_.id -eq $deviceId }).Count -eq 1) { Ok "search='$upper' tìm ra '$code'" }
else { Fail "search chữ HOA không tìm ra thiết bị vừa tạo → mode:insensitive không hoạt động" }

Step "5. Danh sách sắp xếp id tăng dần (fake Prisma không kiểm được orderBy)"
$all = (Api -Method Get -Path '/devices' -Token $adminToken).data
$ids = @($all | ForEach-Object { $_.id })
$sorted = @($ids | Sort-Object)
if ("$ids" -eq "$sorted") { Ok "orderBy id asc đúng ($($ids.Count) thiết bị)" }
else { Fail "danh sách không sắp xếp tăng dần: $ids" }

Step "6. Tiền tố sai — mã PC nhưng chọn loại Laptop"
try {
  Api -Method Post -Path '/devices' -Token $adminToken -Body @{
    deviceCode   = "PC-$(Suffix6 1)"
    deviceName   = 'Thiết bị tiền tố sai'
    specDetail   = 'n/a'
    unit         = 'Cái'
    deviceTypeId = $laptop.id
  } | Out-Null
  Fail "tạo với tiền tố sai lẽ ra phải bị chặn"
} catch {
  $code2 = [int]$_.Exception.Response.StatusCode
  if ($code2 -eq 400) {
    $body = ($_.ErrorDetails.Message | ConvertFrom-Json)
    if ($body.message -match 'phải bắt đầu bằng "LT"') { Ok "tiền tố sai → 400, message đúng: $($body.message)" }
    else { Fail "tiền tố sai → 400 nhưng message='$($body.message)', mong chứa 'phải bắt đầu bằng ""LT""'" }
  } else { Fail "tiền tố sai → $code2, mong 400" }
}

Step "7. Tạo trùng mã thiết bị"
try {
  Api -Method Post -Path '/devices' -Token $adminToken -Body @{
    deviceCode   = $code
    deviceName   = 'Trùng mã'
    specDetail   = 'n/a'
    unit         = 'Cái'
    deviceTypeId = $laptop.id
  } | Out-Null
  Fail "tạo trùng mã lẽ ra phải bị chặn"
} catch {
  $code3 = [int]$_.Exception.Response.StatusCode
  if ($code3 -eq 409) {
    $body = ($_.ErrorDetails.Message | ConvertFrom-Json)
    if ($body.message -match 'Mã thiết bị đã tồn tại') { Ok "trùng mã → 409, message đúng" }
    else { Fail "trùng mã → 409 nhưng message='$($body.message)'" }
  } else { Fail "trùng mã → $code3, mong 409" }
}

Step "8. PATCH đổi status sang 'Chờ thanh lý'"
Api -Method Patch -Path "/devices/$deviceId" -Token $adminToken -Body @{ status = 'Chờ thanh lý' } | Out-Null
$reloaded = (Api -Method Get -Path "/devices/$deviceId" -Token $adminToken).data
if ($reloaded.status -eq 'Chờ thanh lý') { Ok "PATCH status → đọc lại đúng 'Chờ thanh lý'" }
else { Fail "đọc lại status='$($reloaded.status)', mong 'Chờ thanh lý'" }

Step "9. PATCH status không hợp lệ ('Đã xóa' không được đặt qua PATCH)"
try {
  Api -Method Patch -Path "/devices/$deviceId" -Token $adminToken -Body @{ status = 'Đã xóa' } | Out-Null
  Fail "PATCH status='Đã xóa' lẽ ra phải bị chặn"
} catch {
  $code4 = [int]$_.Exception.Response.StatusCode
  if ($code4 -eq 400) {
    $body = ($_.ErrorDetails.Message | ConvertFrom-Json)
    if ($body.message -match 'Trạng thái không hợp lệ') { Ok "PATCH status='Đã xóa' → 400, message đúng" }
    else { Fail "PATCH status='Đã xóa' → 400 nhưng message='$($body.message)'" }
  } else { Fail "PATCH status='Đã xóa' → $code4, mong 400" }
}

Step "10. PATCH accessories thay toàn bộ danh sách (nested write — fake Prisma không mô phỏng được)"
$accCode = "AE2$(Suffix6 2)"
$deviceAcc = (Api -Method Post -Path '/devices' -Token $adminToken -Body @{
  deviceCode   = "LT-$(Suffix6 3)"
  deviceName   = "Laptop kèm phụ kiện $stamp"
  specDetail   = 'Core i7, 16GB RAM'
  unit         = 'Cái'
  deviceTypeId = $laptop.id
  accessories  = @(
    @{ accessoryCode = "$accCode-A"; accessoryName = 'Sạc'; accessoryType = 'Phụ kiện'; unit = 'Cái' },
    @{ accessoryCode = "$accCode-B"; accessoryName = 'Túi chống sốc'; accessoryType = 'Phụ kiện'; unit = 'Cái' }
  )
}).data
$accDeviceId = $deviceAcc.id
if ($deviceAcc.accessories.Count -eq 2) { Ok "tạo thiết bị kèm 2 phụ kiện (id=$accDeviceId)" }
else { Fail "tạo thiết bị kèm phụ kiện: nhận $($deviceAcc.accessories.Count) phụ kiện, mong 2"; }

$newAccCode = "$accCode-C"
$patched = (Api -Method Patch -Path "/devices/$accDeviceId" -Token $adminToken -Body @{
  accessories = @(
    @{ accessoryCode = $newAccCode; accessoryName = 'Chuột không dây'; accessoryType = 'Phụ kiện'; unit = 'Cái' }
  )
}).data
if ($patched.accessories.Count -eq 1 -and $patched.accessories[0].accessoryCode -eq $newAccCode) {
  Ok "PATCH accessories → envelope trả về đúng 1 phụ kiện mới"
} else {
  Fail "PATCH accessories → envelope trả $($patched.accessories.Count) phụ kiện, mong 1 ('$newAccCode')"
}
$accCount = Psql "SELECT COUNT(*) FROM ""DeviceAccessory"" WHERE ""DeviceId"" = $accDeviceId;"
if ($accCount -eq '1') { Ok "DB: đúng 1 row DeviceAccessory cho device id=$accDeviceId" }
else { Fail "DB: có $accCount row DeviceAccessory cho device id=$accDeviceId, mong 1" }
$accCodeInDb = Psql "SELECT ""AccessoryCode"" FROM ""DeviceAccessory"" WHERE ""DeviceId"" = $accDeviceId;"
if ($accCodeInDb -eq $newAccCode) { Ok "DB: row còn lại đúng là phụ kiện mới ('$newAccCode')" }
else { Fail "DB: AccessoryCode='$accCodeInDb', mong '$newAccCode'" }

Step "11. Nhân viên không có quyền ghi thiết bị"
$staffUname = "e2edev$stamp"
$staffPass  = 'E2e@1234'
Api -Method Post -Path '/users' -Token $adminToken -Body @{
  username     = $staffUname
  email        = "$staffUname@e2e.local"
  fullName     = 'Nhân viên kiểm thử thiết bị'
  password     = $staffPass
  roleId       = 3          # Nhân viên
  departmentId = 1          # KYTHUAT
} | Out-Null
$staffToken = (Api -Method Post -Path '/auth/login' -Body @{ identifier = $staffUname; password = $staffPass }).data.accessToken
if ($staffToken) { Ok "$staffUname đăng nhập được" } else { Fail "$staffUname không đăng nhập được"; exit 1 }
ExpectStatus -Method Post -Path '/devices' -Token $staffToken -Expected 403 -Label "Nhân viên gọi POST /devices" -Body @{
  deviceCode   = "LT-$(Suffix6 4)"
  deviceName   = 'Không được phép'
  specDetail   = 'n/a'
  unit         = 'Cái'
  deviceTypeId = $laptop.id
}

Step "12. Xoá mềm thiết bị"
Api -Method Delete -Path "/devices/$deviceId" -Token $adminToken | Out-Null
Ok "admin xoá mềm thiết bị id=$deviceId"
$afterDelete = (Api -Method Get -Path '/devices' -Token $adminToken).data
if (@($afterDelete | Where-Object { $_.id -eq $deviceId }).Count -eq 0) { Ok "thiết bị đã xoá không còn trong danh sách mặc định" }
else { Fail "thiết bị đã xoá vẫn hiện trong danh sách" }

Step "13. Row vẫn còn trong DB (không xoá cứng)"
$status = Psql "SELECT ""Status"" FROM ""Device"" WHERE ""DeviceCode"" = '$code';"
if ($status -eq 'Đã xóa') { Ok "DB: row $code vẫn tồn tại, Status='Đã xóa'" }
elseif ([string]::IsNullOrWhiteSpace($status)) { Fail "DB: row $code đã bị xoá cứng" }
else { Fail "DB: Status='$status', mong 'Đã xóa'" }

Step "14. Id ngoài phạm vi int32 trả 404 chứ không phải 500"
ExpectStatus -Method Delete -Path '/devices/9999999999' -Token $adminToken -Expected 404 -Label "DELETE /devices/9999999999"

Write-Host ""
if ($script:Failed -eq 0) {
  Write-Host "TẤT CẢ BƯỚC E2E THIẾT BỊ ĐỀU XANH" -ForegroundColor Green
  exit 0
} else {
  Write-Host "$($script:Failed) BƯỚC HỎNG" -ForegroundColor Red
  exit 1
}
