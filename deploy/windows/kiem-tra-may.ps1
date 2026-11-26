# Kiem tra may chu Windows truoc khi cai SeedGW (buoc 1, 26/11/2026).
# Script CHI DOC thong tin, khong cai dat, khong sua cau hinh, khong doc mat khau hay bien moi truong.
#
# Cach chay tren may chu (mo PowerShell bang "Run as administrator" de doc du thong tin):
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\kiem-tra-may.ps1
# Ket qua in ra man hinh va luu vao tep seedgw-kiem-tra-<ten may>-<ngay gio>.txt tren Desktop.
# Gui tep do cho nhom du an.
#
# Chu trong script khong dau vi PowerShell 5.1 doc tep khong BOM theo bang ma ANSI.

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$outFile = Join-Path ([Environment]::GetFolderPath('Desktop')) "seedgw-kiem-tra-$env:COMPUTERNAME-$stamp.txt"
$lines = New-Object System.Collections.Generic.List[string]

function Write-Line([string]$text) {
    $lines.Add($text)
    Write-Host $text
}

function Write-Section([string]$title) {
    Write-Line ''
    Write-Line ('=' * 70)
    Write-Line "== $title"
    Write-Line ('=' * 70)
}

function Write-Block($value) {
    if ($null -eq $value) { Write-Line '(khong co)'; return }
    $text = ($value | Out-String -Width 200).TrimEnd()
    if ($text -eq '') { Write-Line '(khong co)'; return }
    foreach ($row in ($text -split "`r?`n")) { Write-Line $row }
}

function Invoke-Safe([string]$title, [scriptblock]$body) {
    Write-Section $title
    try { & $body } catch { Write-Line "LOI khi doc: $($_.Exception.Message)" }
}

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)

Write-Line "SeedGW - kiem tra may chu, $(Get-Date -Format 'dd/MM/yyyy HH:mm')"
Write-Line "May: $env:COMPUTERNAME   Chay quyen quan tri: $isAdmin   PowerShell: $($PSVersionTable.PSVersion)"
if (-not $isAdmin) {
    Write-Line 'CHU Y: chua chay bang Run as administrator, mot so muc (tien trinh chiem cong, tinh nang Windows) co the thieu.'
}

Invoke-Safe '1. He dieu hanh' {
    $os = Get-CimInstance Win32_OperatingSystem
    $cs = Get-CimInstance Win32_ComputerSystem
    Write-Line "Ten: $($os.Caption)"
    Write-Line "Phien ban: $($os.Version)  Build: $($os.BuildNumber)  Kien truc: $($os.OSArchitecture)"
    $display = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction SilentlyContinue)
    if ($display) { Write-Line "Ban: $($display.EditionID)  DisplayVersion: $($display.DisplayVersion)  UBR: $($display.UBR)" }
    Write-Line "Cai dat ngay: $($os.InstallDate)   Khoi dong lan cuoi: $($os.LastBootUpTime)"
    Write-Line "Thuoc domain: $($cs.PartOfDomain)  Domain/Workgroup: $($cs.Domain)"
    Write-Line "May ao: $($cs.Model) / $($cs.Manufacturer)"
    Write-Line "Mui gio: $((Get-TimeZone).Id)   Gio hien tai: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')"
}

Invoke-Safe '2. CPU, RAM' {
    $cpus = Get-CimInstance Win32_Processor
    foreach ($cpu in $cpus) {
        Write-Line "CPU: $($cpu.Name.Trim())  Nhan: $($cpu.NumberOfCores)  Luong: $($cpu.NumberOfLogicalProcessors)"
    }
    $os = Get-CimInstance Win32_OperatingSystem
    Write-Line ('RAM tong: {0:N1} GB   RAM trong: {1:N1} GB' -f ($os.TotalVisibleMemorySize / 1MB), ($os.FreePhysicalMemory / 1MB))
    Write-Line ('Bo nho ao tong: {0:N1} GB   con trong: {1:N1} GB' -f ($os.TotalVirtualMemorySize / 1MB), ($os.FreeVirtualMemory / 1MB))
}

Invoke-Safe '3. O dia' {
    Write-Block (Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Select-Object DeviceID, VolumeName, FileSystem,
        @{ n = 'TongGB'; e = { [math]::Round($_.Size / 1GB, 1) } },
        @{ n = 'TrongGB'; e = { [math]::Round($_.FreeSpace / 1GB, 1) } } | Format-Table -AutoSize)
}

Invoke-Safe '4. Tinh nang Windows (IIS, Hyper-V, WSL, Containers)' {
    if (Get-Command Get-WindowsFeature -ErrorAction SilentlyContinue) {
        $names = 'Web-Server', 'Web-WebSockets', 'Web-Mgmt-Console', 'Hyper-V', 'Containers', 'Microsoft-Windows-Subsystem-Linux', 'VirtualMachinePlatform'
        Write-Block (Get-WindowsFeature -Name $names -ErrorAction SilentlyContinue | Select-Object Name, DisplayName, InstallState | Format-Table -AutoSize)
    } else {
        Write-Line 'Khong co lenh Get-WindowsFeature (khong phai Windows Server hoac thieu module ServerManager).'
    }
    $wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
    Write-Line "wsl.exe: $(if ($wsl) { $wsl.Source } else { 'khong co' })"
}

Invoke-Safe '5. IIS: site va dia chi nghe' {
    $w3 = Get-Service W3SVC -ErrorAction SilentlyContinue
    if (-not $w3) { Write-Line 'IIS chua cai (khong co dich vu W3SVC).'; return }
    Write-Line "Dich vu IIS (W3SVC): $($w3.Status)"
    if (Get-Module -ListAvailable WebAdministration) {
        Import-Module WebAdministration -ErrorAction SilentlyContinue
        Write-Block (Get-Website | Select-Object Name, State, PhysicalPath,
            @{ n = 'Bindings'; e = { ($_.Bindings.Collection | ForEach-Object { "$($_.protocol) $($_.bindingInformation)" }) -join '; ' } } |
            Format-Table -AutoSize -Wrap)
    }
    $rewrite = Test-Path 'HKLM:\SOFTWARE\Microsoft\IIS Extensions\URL Rewrite'
    $arr = Test-Path 'HKLM:\SOFTWARE\Microsoft\IIS Extensions\Application Request Routing'
    Write-Line "URL Rewrite: $rewrite   Application Request Routing (ARR): $arr"
}

Invoke-Safe '6. Cong dang nghe va tien trinh chiem (80, 443, 3000, 5432, 6379, 9000)' {
    $ports = 80, 443, 3000, 3001, 5432, 6379, 9000, 9001
    $listen = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort }
    if (-not $listen) { Write-Line 'Khong co tien trinh nao nghe cac cong tren.'; return }
    Write-Block ($listen | Sort-Object LocalPort | Select-Object LocalAddress, LocalPort, OwningProcess,
        @{ n = 'TienTrinh'; e = { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName } } |
        Format-Table -AutoSize)
    Write-Line 'Tien trinh "System" (PID 4) nghia la dich vu HTTP cua Windows (http.sys: IIS, WinRM, WAC, SQL Reporting...) dang giu cong.'
}

Invoke-Safe '7. Dia chi da dang ky voi http.sys (ai dung cong 80, 443 qua dich vu HTTP cua Windows)' {
    $state = netsh http show servicestate view=requestq 2>$null
    $urls = $state | Where-Object { $_ -match 'HTTP(S)?://' } | ForEach-Object { $_.Trim() } | Sort-Object -Unique
    if ($urls) { Write-Block $urls } else { Write-Line '(khong doc duoc hoac khong co)' }
    Write-Line ''
    Write-Line 'Chung chi gan vao cong (netsh http show sslcert, chi lay dia chi va ung dung):'
    $ssl = netsh http show sslcert 2>$null
    Write-Block ($ssl | Where-Object { $_ -match 'IP:port|Hostname:port|Application ID|Certificate Hash' } | ForEach-Object { $_.Trim() })
}

Invoke-Safe '8. Phan mem lien quan da cai' {
    $keys = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
            'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
    $pattern = 'node|postgres|redis|memurai|garnet|minio|caddy|nginx|git|\.net|dotnet|python|docker|sql server|url rewrite|application request routing|iis|antivirus|defender|kaspersky|symantec|eset|trend|veeam|backup'
    Write-Block (Get-ItemProperty $keys -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -and $_.DisplayName -match $pattern } |
        Select-Object DisplayName, DisplayVersion, Publisher | Sort-Object DisplayName -Unique | Format-Table -AutoSize)
}

Invoke-Safe '9. Lenh co san trong PATH' {
    foreach ($cmd in 'node', 'npm', 'pnpm', 'git', 'psql', 'pg_dump', 'dotnet', 'winget', 'choco', 'docker', 'caddy', 'nginx', 'redis-server', 'memurai', 'minio') {
        $found = Get-Command $cmd -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $found) { Write-Line ("{0,-14} khong co" -f $cmd); continue }
        $version = ''
        if ($cmd -in 'node', 'npm', 'pnpm', 'git', 'psql', 'dotnet') {
            try { $version = (& $cmd --version 2>$null | Select-Object -First 1) } catch { $version = '' }
        }
        Write-Line ("{0,-14} {1}  {2}" -f $cmd, $found.Source, $version)
    }
    if (Get-Command dotnet -ErrorAction SilentlyContinue) {
        Write-Line 'Cac ban .NET runtime:'
        Write-Block (dotnet --list-runtimes 2>$null)
    }
}

Invoke-Safe '10. Dich vu Windows lien quan' {
    $pattern = 'postgres|redis|memurai|garnet|minio|caddy|nginx|W3SVC|WAS|WinRM|MSSQL|ReportServer|sshd|WindowsAdminCenter|ServerManagementGateway|docker|vmms|wslservice'
    Write-Block (Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -match $pattern -or $_.DisplayName -match $pattern } |
        Select-Object Name, DisplayName, Status, StartType | Sort-Object Name | Format-Table -AutoSize)
}

Invoke-Safe '11. Mang va ra Internet' {
    Write-Block (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -ne '127.0.0.1' } | Select-Object InterfaceAlias, IPAddress, PrefixLength | Format-Table -AutoSize)
    Write-Line "DNS: $((Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | ForEach-Object { $_.ServerAddresses } | Sort-Object -Unique) -join ', ')"
    Write-Line 'Proxy cua WinHTTP:'
    Write-Block (netsh winhttp show proxy 2>$null)
    $targets = 'github.com', 'registry.npmjs.org', 'nodejs.org', 'maps.vietmap.vn', 'acme-v02.api.letsencrypt.org', 'exp.host', 'fcm.googleapis.com'
    foreach ($target in $targets) {
        $ok = $false
        try {
            $client = New-Object System.Net.Sockets.TcpClient
            $task = $client.ConnectAsync($target, 443)
            $ok = $task.Wait(5000) -and $client.Connected
            $client.Close()
        } catch { $ok = $false }
        Write-Line ("{0,-32} cong 443: {1}" -f $target, $(if ($ok) { 'DUOC' } else { 'KHONG' }))
    }
}

Invoke-Safe '12. Tuong lua (Windows Firewall)' {
    Write-Block (Get-NetFirewallProfile -ErrorAction SilentlyContinue | Select-Object Name, Enabled, DefaultInboundAction, DefaultOutboundAction | Format-Table -AutoSize)
    Write-Line 'Quy tac cho phep vao cong 80, 443:'
    $rules = Get-NetFirewallPortFilter -Protocol TCP -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in '80', '443' } |
        Get-NetFirewallRule -ErrorAction SilentlyContinue | Where-Object { $_.Enabled -eq 'True' -and $_.Direction -eq 'Inbound' }
    Write-Block ($rules | Select-Object DisplayName, Action, Profile | Format-Table -AutoSize)
}

Invoke-Safe '13. Chinh sach chay script, dong bo gio' {
    Write-Block (Get-ExecutionPolicy -List | Format-Table -AutoSize)
    Write-Block (w32tm /query /status 2>$null | Select-Object -First 8)
}

Write-Section 'Xong'
$lines | Set-Content -Path $outFile -Encoding UTF8
Write-Host ''
Write-Host "Da luu ket qua vao: $outFile" -ForegroundColor Green
Write-Host 'Gui tep nay cho nhom du an. Script khong thay doi gi tren may.'
