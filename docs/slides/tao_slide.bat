@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ============================================================
echo   Tao bo 18 slide PowerPoint SeedGW (Demo 27/11/2026)
echo ============================================================

set "PY_CMD="
where python >nul 2>&1
if not errorlevel 1 set "PY_CMD=python"
if not defined PY_CMD (
    where py >nul 2>&1
    if not errorlevel 1 set "PY_CMD=py -3"
)
if not defined PY_CMD (
    echo [LOI] Khong tim thay Python trong PATH. Hay cai Python 3.10+ roi chay lai.
    pause
    exit /b 1
)

%PY_CMD% -c "import pptx, PIL" >nul 2>&1
if errorlevel 1 (
    echo Dang cai dat thu vien python-pptx va Pillow...
    %PY_CMD% -m pip install --quiet python-pptx Pillow
    if errorlevel 1 (
        echo [LOI] Khong cai duoc python-pptx/Pillow. Hay thu: pip install python-pptx Pillow
        pause
        exit /b 1
    )
)

%PY_CMD% "%~dp0build_seedgw_demo_slides.py"
if errorlevel 1 (
    echo [LOI] Qua trinh tao slide gap su co.
    pause
    exit /b 1
)

echo.
echo Thanh cong! Mo thu muc chua file PowerPoint...
explorer /select,"%~dp0SeedGW_Gioi_thieu_Demo_27-11.pptx"
pause
