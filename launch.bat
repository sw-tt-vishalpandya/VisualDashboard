@echo off
title Visual Testing App
color 0A

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo ============================================
echo   Visual Testing App
echo ============================================
echo.

:: ---- AUTO-INSTALL: run install.bat if not already set up ----
:: Checks for backstop.json + node_modules as indicators of a completed install
set "NEEDS_INSTALL=0"
if not exist "%ROOT%\backstop.json" set "NEEDS_INSTALL=1"
if not exist "%ROOT%\node_modules\express" set "NEEDS_INSTALL=1"
if not exist "%ROOT%\visual-dashboard\node_modules\react" set "NEEDS_INSTALL=1"

if "%NEEDS_INSTALL%"=="1" (
    echo First time setup detected. Running installer...
    echo This will take a few minutes. Please wait.
    echo.
    call "%ROOT%\install.bat" NOPAUSE
    if %errorlevel% neq 0 (
        color 0C
        echo.
        echo [ERROR] Installation failed. Please contact support.
        pause
        exit /b 1
    )
    echo.
    echo Installation complete. Starting app...
    echo.
) else (
    echo All dependencies found. Skipping install.
    echo.
)

:: ---- CHECK EXISTING SERVICES ----
set "FRONTEND_RUNNING=0"
for /f "tokens=*" %%i in ('netstat -ano ^| findstr /r /c:":3000 .*LISTENING"') do set "FRONTEND_RUNNING=1"

set "BACKEND_RUNNING=0"
for /f "tokens=*" %%i in ('netstat -ano ^| findstr /r /c:":3001 .*LISTENING"') do set "BACKEND_RUNNING=1"

:: ---- START REACT (background via temp helper) ----
if "%FRONTEND_RUNNING%"=="1" (
    echo React frontend already running on http://localhost:3000. Skipping frontend start.
) else (
    set "REACT_BAT=%TEMP%\start_react_%RANDOM%.bat"
    echo @echo off > "%REACT_BAT%"
    echo cd /d "%ROOT%\visual-dashboard" >> "%REACT_BAT%"
    echo set BROWSER=none >> "%REACT_BAT%"
    echo npm start >> "%REACT_BAT%"
    start /b cmd /c "%REACT_BAT%"
)

:: ---- OPEN BROWSER after 15s (background) ----
if "%FRONTEND_RUNNING%"=="1" (
    echo Browser auto-open skipped because frontend was already running.
) else (
    set "BROWSER_BAT=%TEMP%\open_browser_%RANDOM%.bat"
    echo @echo off > "%BROWSER_BAT%"
    echo timeout /t 15 /nobreak ^>nul >> "%BROWSER_BAT%"
    echo start "" "http://localhost:3000" >> "%BROWSER_BAT%"
    start /b cmd /c "%BROWSER_BAT%"
)

if "%FRONTEND_RUNNING%"=="1" (
    echo React frontend is already running.
) else (
    echo React frontend starting in background...
    echo Browser will open automatically in ~15 seconds.
)
echo.
echo ============================================
echo   RUNNING - Press Ctrl+C to stop everything
echo   Backend  : http://localhost:3001
echo   Frontend : http://localhost:3000
echo ============================================
echo.

:: ---- START SERVER in foreground (keeps window alive) ----
if "%BACKEND_RUNNING%"=="1" (
    echo Backend already running on http://localhost:3001. Skipping backend start.
    echo.
    echo App is already running. Close this window when done.
    pause
    exit /b 0
) else (
    cd /d "%ROOT%"
    node server.js
)

echo.
echo Server stopped.
pause
