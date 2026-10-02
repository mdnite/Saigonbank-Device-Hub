# E2E smoke cho luong Kiem ke — chay tren backend + PostgreSQL THAT.
#
# Chay: powershell -ExecutionPolicy Bypass -File scripts/e2e-audits.ps1
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

Step "1. Tao TP/CTV Ky thuat, TP/CTV Ke toan va 1 nhan vien Ky thuat giu thiet bi"
$login = Api -Method Post -Path '/auth/login' -Body @{ identifier = $AdminUsername; password = $AdminPassword }
$adminToken = $login.data.accessToken
if ($adminToken) { Ok "admin dang nhap duoc" } else { Fail "khong lay duoc accessToken"; exit 1 }

# Role id cua 'Cộng tác viên' tra theo ten: role them sau nen id tren DB that khong co dinh.
$collabRole = (Api -Method Get -Path '/roles' -Token $adminToken).data |
  Where-Object { $_.roleName -eq 'Cộng tác viên' } | Select-Object -First 1
if (-not $collabRole) { Fail "chua co role 'Cộng tác viên' — chay lai seed (npm run db:setup)"; exit 1 }
$depts = (Api -Method Get -Path '/departments' -Token $adminToken).data
$techDept = ($depts | Where-Object { $_.departmentCode -eq 'KYTHUAT' }).id
$acctDept = ($depts | Where-Object { $_.departmentCode -eq 'KETOAN' }).id

function NewUser ([string]$Prefix, [int]$RoleId, [int]$DeptId, [string]$Name) {
  $uname = "$Prefix$stamp"
  $u = (Api -Method Post -Path '/users' -Token $adminToken -Body @{
    username = $uname; email = "$uname@e2e.local"; fullName = $Name
    password = 'E2e@1234'; roleId = $RoleId; departmentId = $DeptId
  }).data
  $token = (Api -Method Post -Path '/auth/login' -Body @{ identifier = $uname; password = 'E2e@1234' }).data.accessToken
  if ($token) { Ok "$uname dang nhap duoc" } else { Fail "$uname khong dang nhap duoc"; exit 1 }
  return @{ id = $u.id; token = $token }
}
$techHead   = NewUser 'e2ekktp'   2 $techDept 'Truong phong Ky thuat E2E KK'
$techCollab = NewUser 'e2ekkctv'  $collabRole.id $techDept 'CTV Ky thuat E2E KK'
$acctHead   = NewUser 'e2ekktpkt' 2 $acctDept 'Truong phong Ke toan E2E KK'
$acctCollab = NewUser 'e2ekkctvkt' $collabRole.id $acctDept 'CTV Ke toan E2E KK'
$staff      = NewUser 'e2ekknv'   3 $techDept 'Nhan vien giu thiet bi E2E KK'

Step "2. Tao 3 thiet bi da cap phat (vi tri rieng cua lan chay nay) + 1 may trong kho"
# Vi tri mang timestamp: bo loc vi tri chi trung thiet bi cua lan chay nay, khong dung du lieu dev khac.
$loc = "E2E-KK-$stamp"
$types = (Api -Method Get -Path '/device-types' -Token $adminToken).data
$laptop = $types | Where-Object { $_.prefix -eq 'LT' } | Select-Object -First 1
function NewDevice ([int]$Offset, [string]$Name, $Accessories) {
  $body = @{
    deviceCode = "LT-$(Suffix6 $Offset)"; deviceName = $Name; specDetail = 'Core i5, 16GB'
    unit = 'Cai'; deviceTypeId = $laptop.id; location = $loc
  }
  if ($Accessories) { $body['accessories'] = $Accessories }
  return (Api -Method Post -Path '/devices' -Token $techHead.token -Body $body).data
}
function Allocate ($Device) {
  $o = (Api -Method Post -Path '/device-orders' -Token $techCollab.token -Body @{
    type = 'Cấp phát'; targetUserId = $staff.id; deviceIds = @($Device.id)
  }).data
  Api -Method Patch -Path "/device-orders/$($o.id)/approve" -Token $techHead.token | Out-Null
}
$devOk     = NewDevice 0 "Laptop E2E KK du $stamp" $null
$devMiss   = NewDevice 1 "Laptop E2E KK thieu $stamp" @(@{ accessoryCode = "SAC-$stamp"; accessoryName = 'Sac 65W'; accessoryType = 'Nguon'; unit = 'Cai' })
$devBroken = NewDevice 2 "Laptop E2E KK hong $stamp" $null
$devStock  = NewDevice 3 "Laptop E2E KK trong kho $stamp" $null
foreach ($d in @($devOk, $devMiss, $devBroken)) { Allocate $d }
Ok "tao 4 thiet bi tai vi tri $loc, 3 may da cap phat cho nhan vien"

Step "3. Phan quyen"
ExpectStatus -Method Get -Path '/audits' -Token $adminToken -Expected 403 -Label "Quan tri vien GET /audits"
ExpectStatus -Method Get -Path '/audits' -Token $techHead.token -Expected 403 -Label "TP Ky thuat GET /audits"
ExpectStatus -Method Post -Path '/audits' -Token $acctHead.token -Expected 403 -Label "TP Ke toan POST /audits" -Body @{
  departmentId = $techDept; dueDate = '2026-12-31'; purpose = 'Định kỳ'; location = $loc
}

Step "4. CTV Ke toan lap lich phong Ky thuat (loc vi tri), lap trung bi chan"
$auditBody = @{ departmentId = $techDept; dueDate = '2026-12-31'; purpose = 'Định kỳ'; location = $loc; memberIds = @($staff.id) }
$audit = (Api -Method Post -Path '/audits' -Token $acctCollab.token -Body $auditBody).data
if ($audit.items.Count -eq 3 -and $audit.status -eq 'Chưa kiểm kê' -and $audit.totalLines -eq 4) {
  Ok "lap lich id=$($audit.id): 3 thiet bi + 1 linh kien"
} else { Fail "lap lich sai: items=$($audit.items.Count), status='$($audit.status)', totalLines=$($audit.totalLines)"; exit 1 }
ExpectStatus -Method Post -Path '/audits' -Token $acctCollab.token -Expected 400 -Label "lap lich trung thiet bi" -Body $auditBody

Step "5. Bat dau, nhap ket qua, gui duyet"
Api -Method Post -Path "/audits/$($audit.id)/start" -Token $acctCollab.token | Out-Null
function ItemOf ($DeviceId) { return $audit.items | Where-Object { $_.deviceId -eq $DeviceId } | Select-Object -First 1 }
function SetResult ($DeviceId, [string]$Result) {
  Api -Method Patch -Path "/audits/$($audit.id)/items/$((ItemOf $DeviceId).id)" -Token $acctCollab.token -Body @{ result = $Result } | Out-Null
}
SetResult $devOk.id 'Đủ'
SetResult $devMiss.id 'Thiếu'
SetResult $devBroken.id 'Hỏng'
$acc = (ItemOf $devMiss.id).accessories[0]
Api -Method Patch -Path "/audits/$($audit.id)/accessories/$($acc.id)" -Token $acctCollab.token -Body @{ result = 'Thiếu'; note = 'mat cung may' } | Out-Null
$sent = (Api -Method Post -Path "/audits/$($audit.id)/submit" -Token $acctCollab.token).data
if ($sent.status -eq 'Chờ duyệt') { Ok "gui duyet: 'Chờ duyệt'" } else { Fail "gui duyet: status='$($sent.status)'" }

Step "6. May Hong bi dua vao don Thu hoi (khong khoa khi kiem ke) -> duyet bi chan"
Api -Method Post -Path '/device-orders' -Token $techCollab.token -Body @{
  type = 'Thu hồi'; targetUserId = $staff.id; deviceIds = @($devBroken.id)
} | Out-Null
ExpectStatus -Method Post -Path "/audits/$($audit.id)/approve" -Token $acctHead.token -Expected 400 -Label "duyet khi may Hong da doi trang thai"
$stillPending = Psql "SELECT ""Status"" FROM ""Audit"" WHERE ""Id"" = $($audit.id);"
if ($stillPending -eq 'Chờ duyệt') { Ok "DB: dot van 'Chờ duyệt', chua ghi gi" } else { Fail "DB: dot status='$stillPending'" }

Step "7. TP Ke toan tu choi, CTV sua dong do thanh Du, gui lai, duyet"
Api -Method Post -Path "/audits/$($audit.id)/reject" -Token $acctHead.token -Body @{ reason = 'May hong dang thu hoi, ghi lai' } | Out-Null
$back = (Api -Method Get -Path "/audits/$($audit.id)" -Token $acctCollab.token).data
if ($back.status -eq 'Đang kiểm kê' -and $back.rejectReason) { Ok "tu choi: ve 'Đang kiểm kê' kem ly do" } else { Fail "tu choi: status='$($back.status)'" }
Api -Method Patch -Path "/audits/$($audit.id)/items/$((ItemOf $devBroken.id).id)" -Token $acctCollab.token -Body @{ result = 'Đủ'; note = 'dang thu hoi' } | Out-Null
Api -Method Post -Path "/audits/$($audit.id)/submit" -Token $acctCollab.token | Out-Null
$approved = (Api -Method Post -Path "/audits/$($audit.id)/approve" -Token $acctHead.token).data
if ($approved.status -eq 'Đã duyệt') { Ok "duyet: 'Đã duyệt'" } else { Fail "duyet: status='$($approved.status)'" }

$missRow = Psql "SELECT ""Status"" || '|' || ""CurrentUserId"" FROM ""Device"" WHERE ""Id"" = $($devMiss.id);"
if ($missRow -eq "Thất lạc|$($staff.id)") { Ok "DB: may Thieu -> 'Thất lạc', van giu nguoi so huu" } else { Fail "DB may Thieu: '$missRow'" }
$okRow = Psql "SELECT ""Status"" FROM ""Device"" WHERE ""Id"" = $($devOk.id);"
if ($okRow -eq 'Đã cấp phát') { Ok "DB: may Du khong doi" } else { Fail "DB may Du: '$okRow'" }

Step "8. TP Ky thuat bam Tim thay"
ExpectStatus -Method Post -Path "/devices/$($devMiss.id)/found" -Token $techCollab.token -Expected 403 -Label "CTV Ky thuat POST found"
$found = (Api -Method Post -Path "/devices/$($devMiss.id)/found" -Token $techHead.token).data
if ($found.status -eq 'Đã cấp phát') { Ok "tim thay: ve 'Đã cấp phát'" } else { Fail "tim thay: status='$($found.status)'" }

Step "9. Bang tong hop"
$summary = (Api -Method Post -Path '/audit-summaries' -Token $acctCollab.token -Body @{
  title = "Tong hop E2E $stamp"; auditIds = @($audit.id)
}).data
$row = $summary.matrix | Select-Object -First 1
if ($row.total -eq 3 -and $row.ok -eq 2 -and $row.missing -eq 1 -and $row.broken -eq 0) { Ok "ma tran: Tong 3, Du 2, Thieu 1, Hong 0" }
else { Fail "ma tran sai: $($summary.matrix | ConvertTo-Json -Compress)" }

Step "10. Dot Kho: lap, huy, lap lai duoc"
$stockBody = @{ departmentId = $null; dueDate = '2026-12-31'; purpose = 'Đột xuất'; location = $loc }
$stockAudit = (Api -Method Post -Path '/audits' -Token $acctCollab.token -Body $stockBody).data
if ($stockAudit.unitName -eq 'Kho' -and $stockAudit.items.Count -eq 1) { Ok "dot Kho id=$($stockAudit.id): 1 may" } else { Fail "dot Kho sai" }
$cancelled = (Api -Method Post -Path "/audits/$($stockAudit.id)/cancel" -Token $acctCollab.token).data
if ($cancelled.status -eq 'Đã hủy') { Ok "huy dot: 'Đã hủy'" } else { Fail "huy dot: status='$($cancelled.status)'" }
$again = (Api -Method Post -Path '/audits' -Token $acctCollab.token -Body $stockBody).data
if ($again.id) { Ok "lap lai dot Kho sau khi huy: id=$($again.id)" } else { Fail "khong lap lai duoc dot Kho" }

Write-Host ""
if ($script:Failed -eq 0) {
  Write-Host "TAT CA BUOC E2E KIEM KE DEU XANH" -ForegroundColor Green
  exit 0
} else {
  Write-Host "$($script:Failed) BUOC HONG" -ForegroundColor Red
  exit 1
}
