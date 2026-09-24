# E2E smoke cho luong don Cap phat - Thu hoi thiet bi — chay tren backend + PostgreSQL THAT.
#
# Chay: powershell -ExecutionPolicy Bypass -File scripts/e2e-device-orders.ps1
#
# LUU Y: file nay phai luu o UTF-8 CO BOM — thieu BOM thi PowerShell 5.1 doc sai chuoi tieng Viet
# trong cac Body gui len API ('Cấp phát', 'Thu hồi') va cau lenh SQL ('Đã cấp phát').

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

# Goi API, tra ve envelope da parse. Nem loi neu HTTP khong thanh cong.
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

# Goi API va ky vong mot ma loi HTTP cu the.
function ExpectStatus {
  param([string]$Method, [string]$Path, [string]$Token, [int]$Expected, [string]$Label, $Body)
  try {
    Api -Method $Method -Path $Path -Token $Token -Body $Body | Out-Null
    Fail "$Label — mong $Expected nhung request thanh cong"
  } catch {
    $res = $_.Exception.Response
    if ($null -eq $res) { Fail "$Label — khong ket noi duoc: $($_.Exception.Message)"; return }
    $code = [int]$res.StatusCode
    if ($code -eq $Expected) { Ok "$Label → $code" } else { Fail "$Label — mong $Expected, nhan $code" }
  }
}

function Psql ([string]$Sql) {
  $env:PGPASSWORD = $DbPassword
  # PowerShell 5.1 boc lai tham so khi goi exe native va nuot mat dau nhay kep ma PostgreSQL
  # can cho ten cot PascalCase ("Status", "DeviceId") → dua cau lenh qua stdin thay vi tham so -c.
  $out = $Sql | & $PsqlPath -U $DbUser -h localhost -d $DbName -t -A 2>&1
  $env:PGPASSWORD = $null
  if ($LASTEXITCODE -ne 0) { throw "psql loi: $out" }
  return ($out | Out-String).Trim()
}

# Timestamp mili-giay de sinh nhieu ma thiet bi khong trung trong cung lan chay.
$stamp = Get-Date -Format 'yyyyMMddHHmmssfff'
$baseSuffix = [int]($stamp.Substring($stamp.Length - 6))
function Suffix6 ([int]$Offset) {
  $n = ($baseSuffix + $Offset) % 1000000
  return $n.ToString('D6')
}

Step "0. Backend co dang chay khong"
try {
  Invoke-RestMethod -Uri "$BaseUrl/device-types" -Method Get -ErrorAction Stop | Out-Null
  Fail "GET /device-types khong co token le ra phai 401"
} catch {
  if ($null -eq $_.Exception.Response) {
    Write-Host "Khong ket noi duoc $BaseUrl — backend chua chay." -ForegroundColor Red
    exit 1
  }
  if ([int]$_.Exception.Response.StatusCode -eq 401) { Ok "backend song, /device-types chan request khong token (401)" }
  else { Fail "GET /device-types khong token → $([int]$_.Exception.Response.StatusCode), mong 401" }
}

Step "1. Dang nhap admin, tao Truong phong Ky thuat va nguoi nhan"
$login = Api -Method Post -Path '/auth/login' -Body @{ identifier = $AdminUsername; password = $AdminPassword }
$adminToken = $login.data.accessToken
if ($adminToken) { Ok "admin dang nhap duoc" } else { Fail "khong lay duoc accessToken"; exit 1 }

$techUname = "e2etech$stamp"
$techPass = 'E2e@1234'
Api -Method Post -Path '/users' -Token $adminToken -Body @{
  username = $techUname; email = "$techUname@e2e.local"; fullName = 'Truong phong Ky thuat E2E'
  password = $techPass; roleId = 2; departmentId = 1
} | Out-Null
$techToken = (Api -Method Post -Path '/auth/login' -Body @{ identifier = $techUname; password = $techPass }).data.accessToken
if ($techToken) { Ok "$techUname dang nhap duoc" } else { Fail "$techUname khong dang nhap duoc"; exit 1 }

$staffUname = "e2estaff$stamp"
$staffPass = 'E2e@1234'
$staff = (Api -Method Post -Path '/users' -Token $adminToken -Body @{
  username = $staffUname; email = "$staffUname@e2e.local"; fullName = 'Nhan vien nhan thiet bi E2E'
  password = $staffPass; roleId = 3; departmentId = 1
}).data
if ($staff.id) { Ok "$staffUname tao duoc (id=$($staff.id))" } else { Fail "khong tao duoc $staffUname"; exit 1 }

Step "2. Tao thiet bi Trong kho"
$types = (Api -Method Get -Path '/device-types' -Token $adminToken).data
$laptop = $types | Where-Object { $_.prefix -eq 'LT' } | Select-Object -First 1
$device = (Api -Method Post -Path '/devices' -Token $adminToken -Body @{
  deviceCode = "LT-$(Suffix6 0)"; deviceName = "Laptop E2E don $stamp"
  specDetail = 'Core i5, 16GB'; unit = 'Cai'; deviceTypeId = $laptop.id
}).data
$deviceId = $device.id
if ($deviceId -and $device.status -eq 'Trong kho') { Ok "tao thiet bi id=$deviceId, status='Trong kho'" }
else { Fail "tao thiet bi that bai hoac sai status"; exit 1 }

Step "3. Tao va duyet don Cap phat"
$order = (Api -Method Post -Path '/device-orders' -Token $techToken -Body @{
  type = 'Cấp phát'; targetUserId = $staff.id; deviceIds = @($deviceId)
}).data
if ($order.id -and $order.status -eq 'Chờ duyệt') { Ok "tao don Cap phat id=$($order.id)" }
else { Fail "tao don Cap phat that bai"; exit 1 }

Api -Method Patch -Path "/device-orders/$($order.id)/approve" -Token $adminToken | Out-Null
$afterAllocate = (Api -Method Get -Path "/devices/$deviceId" -Token $adminToken).data
if ($afterAllocate.status -eq 'Đã cấp phát' -and $afterAllocate.currentUser.id -eq $staff.id) {
  Ok "duyet xong: Device status='Đã cấp phát', currentUser=$($afterAllocate.currentUser.id)"
} else {
  Fail "duyet don Cap phat khong ghi dung Device: status='$($afterAllocate.status)'"
}
$dbStatus = Psql "SELECT ""Status"" FROM ""Device"" WHERE ""Id"" = $deviceId;"
if ($dbStatus -eq 'Đã cấp phát') { Ok "DB xac nhan Status='Đã cấp phát'" } else { Fail "DB Status='$dbStatus', mong 'Đã cấp phát'" }

Step "4. Tao va duyet don Thu hoi"
$recoverOrder = (Api -Method Post -Path '/device-orders' -Token $techToken -Body @{
  type = 'Thu hồi'; targetUserId = $staff.id; deviceIds = @($deviceId)
}).data
if ($recoverOrder.id) { Ok "tao don Thu hoi id=$($recoverOrder.id)" } else { Fail "tao don Thu hoi that bai"; exit 1 }

Api -Method Patch -Path "/device-orders/$($recoverOrder.id)/approve" -Token $adminToken | Out-Null
$afterRecover = (Api -Method Get -Path "/devices/$deviceId" -Token $adminToken).data
if ($afterRecover.status -eq 'Trong kho' -and $null -eq $afterRecover.currentUser -and $null -eq $afterRecover.department) {
  Ok "duyet xong: Device ve 'Trong kho', currentUser/department = null"
} else {
  Fail "duyet don Thu hoi khong xoa dung Device: status='$($afterRecover.status)'"
}

Step "5. Tao don roi tu choi"
$device2 = (Api -Method Post -Path '/devices' -Token $adminToken -Body @{
  deviceCode = "LT-$(Suffix6 1)"; deviceName = "Laptop E2E tu choi $stamp"
  specDetail = 'Core i5, 16GB'; unit = 'Cai'; deviceTypeId = $laptop.id
}).data
$rejectOrder = (Api -Method Post -Path '/device-orders' -Token $techToken -Body @{
  type = 'Cấp phát'; targetUserId = $staff.id; deviceIds = @($device2.id)
}).data
Api -Method Patch -Path "/device-orders/$($rejectOrder.id)/reject" -Token $adminToken -Body @{ reason = 'E2E tu choi' } | Out-Null
$afterReject = (Api -Method Get -Path "/devices/$($device2.id)" -Token $adminToken).data
if ($afterReject.status -eq 'Trong kho') { Ok "tu choi don: Device van 'Trong kho'" }
else { Fail "tu choi don nhung Device status='$($afterReject.status)', mong 'Trong kho'" }

Step "6. Nhan vien khong xem duoc danh sach don"
$staffToken = (Api -Method Post -Path '/auth/login' -Body @{ identifier = $staffUname; password = $staffPass }).data.accessToken
ExpectStatus -Method Get -Path '/device-orders' -Token $staffToken -Expected 403 -Label "Nhan vien GET /device-orders"

Write-Host ""
if ($script:Failed -eq 0) {
  Write-Host "TAT CA BUOC E2E DON CAP PHAT - THU HOI DEU XANH" -ForegroundColor Green
  exit 0
} else {
  Write-Host "$($script:Failed) BUOC HONG" -ForegroundColor Red
  exit 1
}
