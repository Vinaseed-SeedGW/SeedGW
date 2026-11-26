# Cau hinh IIS tren Windows Server 10.10.8.35 de chuyen tiep seedgw.vinaseed.com.vn vao may ao Ubuntu chay SeedGW.
# Chay MOT LAN bang PowerShell "Run as administrator":
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\cau-hinh-iis.ps1 -VmIp 10.10.8.xx
# Tep web.config phai nam cung thu muc voi script nay.
#
# Script lam:
#   1. Sao luu cau hinh IIS (appcmd add backup) va sao luu thu muc site Seedgw truoc khi doi.
#   2. Bat proxy cua ARR o cap may chu: giu nguyen Host (link anh co chu ky), khong kem cong trong
#      X-Forwarded-For, khong gom phan hoi (trang Ho tro cap nhat tuc thi), thoi gian cho 10 phut.
#   3. Cho site Seedgw dat bien HTTP_X_FORWARDED_PROTO.
#   4. Ghi web.config (thay DIA_CHI_MAY_AO bang -VmIp) vao thu muc site, thu goi /api/health.
# Muc 2 ap cho moi site dung ARR lam proxy tren may nay; script in gia tri cu de doi lai neu can.
# Hoan tac: appcmd restore backup "<ten ban sao luu script in ra>".
#
# Chu khong dau vi PowerShell 5.1 doc tep khong BOM theo bang ma ANSI.

param(
    [Parameter(Mandatory = $true)][string]$VmIp,
    [string]$SiteName = 'Seedgw',
    [string]$HostName = 'seedgw.vinaseed.com.vn'
)

$ErrorActionPreference = 'Stop'
$appcmd = Join-Path $env:windir 'System32\inetsrv\appcmd.exe'

function Stop-WithError([string]$message) {
    Write-Host "LOI: $message" -ForegroundColor Red
    exit 1
}

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Stop-WithError 'Hay mo PowerShell bang Run as administrator.'
}
if ($VmIp -notmatch '^\d{1,3}(\.\d{1,3}){3}$') { Stop-WithError "Dia chi may ao khong dung dang IPv4: $VmIp" }
if (-not (Test-Path $appcmd)) { Stop-WithError 'Khong thay appcmd.exe, IIS chua cai.' }
if (-not (Test-Path 'HKLM:\SOFTWARE\Microsoft\IIS Extensions\URL Rewrite')) { Stop-WithError 'Chua cai IIS URL Rewrite.' }
if (-not (Test-Path 'HKLM:\SOFTWARE\Microsoft\IIS Extensions\Application Request Routing')) { Stop-WithError 'Chua cai Application Request Routing (ARR).' }

$template = Join-Path $PSScriptRoot 'web.config'
if (-not (Test-Path $template)) { Stop-WithError "Khong thay web.config canh script: $template" }

Import-Module WebAdministration
$site = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
if (-not $site) { Stop-WithError "Khong thay site IIS ten $SiteName." }
$sitePath = [Environment]::ExpandEnvironmentVariables($site.PhysicalPath)

Write-Host "Site: $SiteName   Thu muc: $sitePath"
Write-Host "Chuyen tiep: https://$HostName  ->  http://$VmIp"
Write-Host ''
Write-Host 'Cau hinh proxy ARR hien tai (ghi lai de doi lai neu can):'
& $appcmd list config -section:system.webServer/proxy
Write-Host ''
Write-Host 'Kiem tra may ao tra loi cong 80:'
try {
    $probe = Invoke-WebRequest "http://$VmIp/api/health" -UseBasicParsing -TimeoutSec 10 -Headers @{ Host = $HostName }
    Write-Host "  May ao tra loi: $($probe.StatusCode) $($probe.Content)"
} catch {
    Write-Host "  CHU Y: chua goi duoc http://$VmIp/api/health ($($_.Exception.Message)). Van cau hinh duoc, kiem tra lai sau." -ForegroundColor Yellow
}
Write-Host ''
$answer = Read-Host 'Go CO de tiep tuc doi cau hinh IIS'
if ($answer -ne 'CO') { Write-Host 'Da huy, chua doi gi.'; exit 0 }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupName = "truoc-seedgw-$stamp"
& $appcmd add backup $backupName | Out-Host
if ($LASTEXITCODE -ne 0) { Stop-WithError 'Khong sao luu duoc cau hinh IIS, dung lai.' }
Write-Host "Da sao luu cau hinh IIS: $backupName"

if (Test-Path $sitePath) {
    $siteBackup = "$sitePath.bak-$stamp"
    Copy-Item -Path $sitePath -Destination $siteBackup -Recurse
    Write-Host "Da sao luu thu muc site sang: $siteBackup"
} else {
    New-Item -ItemType Directory -Path $sitePath | Out-Null
}

& $appcmd set config -section:system.webServer/proxy /enabled:"True" /preserveHostHeader:"True" `
    /reverseRewriteHostInResponseHeaders:"False" /includePortInXForwardedFor:"False" `
    /responseBufferLimit:"0" /timeout:"00:10:00" /commit:apphost | Out-Host
if ($LASTEXITCODE -ne 0) { Stop-WithError "Khong bat duoc proxy ARR. Hoan tac: appcmd restore backup $backupName" }

$allowed = & $appcmd list config $SiteName -section:system.webServer/rewrite/allowedServerVariables
if (-not ($allowed -match 'HTTP_X_FORWARDED_PROTO')) {
    & $appcmd set config $SiteName -section:system.webServer/rewrite/allowedServerVariables `
        /+"[name='HTTP_X_FORWARDED_PROTO']" /commit:apphost | Out-Host
    if ($LASTEXITCODE -ne 0) { Stop-WithError "Khong them duoc bien HTTP_X_FORWARDED_PROTO. Hoan tac: appcmd restore backup $backupName" }
}

$config = (Get-Content -Path $template -Raw -Encoding UTF8).Replace('DIA_CHI_MAY_AO', $VmIp)
[IO.File]::WriteAllText((Join-Path $sitePath 'web.config'), $config, (New-Object Text.UTF8Encoding($false)))
Write-Host "Da ghi web.config vao $sitePath"

Write-Host ''
Write-Host 'Thu goi qua IIS:'
try {
    $res = Invoke-WebRequest 'http://127.0.0.1/api/health' -UseBasicParsing -TimeoutSec 15 -Headers @{ Host = $HostName }
    Write-Host "  $($res.StatusCode) $($res.Content)" -ForegroundColor Green
} catch {
    Write-Host "  Chua thanh cong: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host '  Neu may ao chua chay SeedGW thi binh thuong; chay lai buoc thu nay sau.'
}
Write-Host ''
Write-Host "Xong. Hoan tac toan bo: $appcmd restore backup $backupName"
Write-Host 'Khi co chung chi HTTPS: gan chung chi cho binding https cua site, roi bat quy tac "SeedGW chuyen sang HTTPS" trong web.config.'
