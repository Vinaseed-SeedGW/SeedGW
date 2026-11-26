$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== Tao bo 18 slide PowerPoint SeedGW (Demo 27/11/2026) ===" -ForegroundColor Green

$pyExe = $null
$pyArgs = @()
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pyExe = "python"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $pyExe = "py"
    $pyArgs = @("-3")
} else {
    throw "Khong tim thay Python trong PATH. Hay cai Python 3.10+ roi chay lai."
}

& $pyExe @pyArgs -c "import pptx, PIL" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Dang cai dat python-pptx va Pillow..." -ForegroundColor Yellow
    & $pyExe @pyArgs -m pip install --quiet python-pptx Pillow
}

& $pyExe @pyArgs "$PSScriptRoot\build_seedgw_demo_slides.py"
$outFile = Join-Path $PSScriptRoot "SeedGW_Gioi_thieu_Demo_27-11.pptx"
if (Test-Path $outFile) {
    Write-Host "Da tao xong: $outFile" -ForegroundColor Green
}
