# E2E smoke cho luong Dieu chuyen thiet bi — chay tren backend + PostgreSQL THAT.
#
# Chay: powershell -ExecutionPolicy Bypass -File scripts/e2e-device-transfers.ps1
#
# LUU Y: file nay phai luu o UTF-8 CO BOM — thieu BOM thi PowerShell 5.1 doc sai chuoi tieng Viet
# trong cac Body gui len API ('Chờ duyệt') va cau lenh SQL ('Đã cấp phát').

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

Step "1. Dang nhap admin, tao Truong phong Ky thuat va 2 nguoi dung"
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

$staffAUname = "e2estaffa$stamp"
$staffAPass = 'E2e@1234'
$staffA = (Api -Method Post -Path '/users' -Token $adminToken -Body @{
  username = $staffAUname; email = "$staffAUname@e2e.local"; fullName = 'Nhan vien A giu thiet bi E2E'
  password = $staffAPass; roleId = 3; departmentId = 1
}).data
if ($staffA.id) { Ok "$staffAUname tao duoc (id=$($staffA.id))" } else { Fail "khong tao duoc $staffAUname"; exit 1 }

$staffBUname = "e2estaffb$stamp"
$staffBPass = 'E2e@1234'
$staffB = (Api -Method Post -Path '/users' -Token $adminToken -Body @{
  username = $staffBUname; email = "$staffBUname@e2e.local"; fullName = 'Nhan vien B nhan thiet bi E2E'
  password = $staffBPass; roleId = 3; departmentId = 2
}).data
if ($staffB.id) { Ok "$staffBUname tao duoc (id=$($staffB.id))" } else { Fail "khong tao duoc $staffBUname"; exit 1 }

Step "2. Tao thiet bi va cap phat truc tiep cho staffA (qua PATCH, khong qua don Cap phat)"
$types = (Api -Method Get -Path '/device-types' -Token $adminToken).data
$laptop = $types | Where-Object { $_.prefix -eq 'LT' } | Select-Object -First 1
$device = (Api -Method Post -Path '/devices' -Token $adminToken -Body @{
  deviceCode = "LT-$(Suffix6 0)"; deviceName = "Laptop E2E dieu chuyen $stamp"
  specDetail = 'Core i5, 16GB'; unit = 'Cai'; deviceTypeId = $laptop.id
  currentUserId = $staffA.id
}).data
$deviceId = $device.id
if ($deviceId -and $device.status -eq 'Đã cấp phát' -and $device.currentUser.id -eq $staffA.id) {
  Ok "tao thiet bi id=$deviceId, da cap phat cho staffA"
} else { Fail "tao/cap phat thiet bi that bai"; exit 1 }

Step "3. Tao va duyet lenh dieu chuyen staffA -> staffB"
$transfer = (Api -Method Post -Path '/device-transfers' -Token $adminToken -Body @{
  fromUserId = $staffA.id; toUserId = $staffB.id; deviceIds = @($deviceId)
}).data
if ($transfer.id -and $transfer.status -eq 'Chờ duyệt') { Ok "tao lenh dieu chuyen id=$($transfer.id)" }
else { Fail "tao lenh dieu chuyen that bai"; exit 1 }

Api -Method Patch -Path "/device-transfers/$($transfer.id)/approve" -Token $techToken | Out-Null
$afterTransfer = (Api -Method Get -Path "/devices/$deviceId" -Token $adminToken).data
if ($afterTransfer.status -eq 'Đã cấp phát' -and $afterTransfer.currentUser.id -eq $staffB.id) {
  Ok "duyet xong: currentUser chuyen sang staffB, status van la 'Đã cấp phát'"
} else {
  Fail "duyet lenh khong chuyen dung chu hoac doi status sai: status='$($afterTransfer.status)', currentUser=$($afterTransfer.currentUser.id)"
}
$dbCurrentUserId = Psql "SELECT ""CurrentUserId"" FROM ""Device"" WHERE ""Id"" = $deviceId;"
if ($dbCurrentUserId -eq "$($staffB.id)") { Ok "DB xac nhan CurrentUserId=$($staffB.id)" }
else { Fail "DB CurrentUserId='$dbCurrentUserId', mong $($staffB.id)" }

Step "4. Tao lenh roi tu choi"
$device2 = (Api -Method Post -Path '/devices' -Token $adminToken -Body @{
  deviceCode = "LT-$(Suffix6 1)"; deviceName = "Laptop E2E tu choi dieu chuyen $stamp"
  specDetail = 'Core i5, 16GB'; unit = 'Cai'; deviceTypeId = $laptop.id
  currentUserId = $staffA.id
}).data
$rejectTransfer = (Api -Method Post -Path '/device-transfers' -Token $adminToken -Body @{
  fromUserId = $staffA.id; toUserId = $staffB.id; deviceIds = @($device2.id)
}).data
Api -Method Patch -Path "/device-transfers/$($rejectTransfer.id)/reject" -Token $techToken -Body @{ reason = 'E2E tu choi dieu chuyen' } | Out-Null
$afterReject = (Api -Method Get -Path "/devices/$($device2.id)" -Token $adminToken).data
if ($afterReject.currentUser.id -eq $staffA.id) { Ok "tu choi lenh: thiet bi van do staffA giu" }
else { Fail "tu choi lenh nhung currentUser da doi: $($afterReject.currentUser.id)" }

Step "5. Nhan vien khong xem duoc danh sach lenh"
$staffAToken = (Api -Method Post -Path '/auth/login' -Body @{ identifier = $staffAUname; password = $staffAPass }).data.accessToken
ExpectStatus -Method Get -Path '/device-transfers' -Token $staffAToken -Expected 403 -Label "Nhan vien GET /device-transfers"

Step "6. Admin khong duoc duyet lenh (chi Truong phong Ky thuat)"
$device3 = (Api -Method Post -Path '/devices' -Token $adminToken -Body @{
  deviceCode = "LT-$(Suffix6 2)"; deviceName = "Laptop E2E admin khong duyet duoc $stamp"
  specDetail = 'Core i5, 16GB'; unit = 'Cai'; deviceTypeId = $laptop.id
  currentUserId = $staffA.id
}).data
$transfer3 = (Api -Method Post -Path '/device-transfers' -Token $adminToken -Body @{
  fromUserId = $staffA.id; toUserId = $staffB.id; deviceIds = @($device3.id)
}).data
ExpectStatus -Method Patch -Path "/device-transfers/$($transfer3.id)/approve" -Token $adminToken -Expected 403 -Label "Admin PATCH approve"

Write-Host ""
if ($script:Failed -eq 0) {
  Write-Host "TAT CA BUOC E2E DIEU CHUYEN THIET BI DEU XANH" -ForegroundColor Green
  exit 0
} else {
  Write-Host "$($script:Failed) BUOC HONG" -ForegroundColor Red
  exit 1
}
