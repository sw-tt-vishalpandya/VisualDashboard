@echo off
title Visual Testing App
color 0A

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo ============================================
echo   Visual Testing App - Starting Up...
echo ============================================
echo ROOT: %ROOT%
echo.

:: ---- [1/7] CHECK NODE ----
echo [1/7] Checking Node.js...
node -v
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)
echo       Node.js OK
echo.

:: ---- [2/7] CHECK BACKSTOPJS ----
echo [2/7] Checking BackstopJS...
set "BS_FOUND=0"
for /f "tokens=*" %%i in ('backstop --version 2^>^&1') do (
    echo %%i | findstr /i "BackstopJS" >nul
    if not errorlevel 1 set "BS_FOUND=1"
)
if "%BS_FOUND%"=="1" (
    echo       BackstopJS already installed. Skipping.
) else (
    echo       Not found. Installing BackstopJS globally...
    call npm install -g backstopjs
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] BackstopJS install failed. Try Run as Administrator.
        pause
        exit /b 1
    )
    echo       BackstopJS installed.
)
echo.

:: ---- [3/7] SERVER DEPS ----
echo [3/7] Checking server dependencies...
cd /d "%ROOT%"
if exist "node_modules\express" (
    echo       Already installed. Skipping.
) else (
    echo       Running npm install for server...
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Server npm install failed.
        pause
        exit /b 1
    )
    echo       Done.
)
echo.

:: ---- [4/7] FRONTEND DEPS ----
echo [4/7] Checking frontend dependencies...
if exist "%ROOT%\visual-dashboard\node_modules\react" (
    echo       Already installed. Skipping.
) else (
    echo       Running npm install for frontend...
    cd /d "%ROOT%\visual-dashboard"
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Frontend npm install failed.
        pause
        exit /b 1
    )
    echo       Done.
    cd /d "%ROOT%"
)
echo.

:: ---- [5/7] PLAYWRIGHT + TS ----
echo [5/7] Checking Playwright + TypeScript...
if exist "%ROOT%\node_modules\@playwright\test" (
    echo       Already installed. Skipping.
) else (
    echo       Installing...
    cd /d "%ROOT%"
    call npm install --save-dev @playwright/test typescript ts-node @types/node
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Playwright install failed.
        pause
        exit /b 1
    )
    echo       Done.
)
echo.

:: ---- [6/7] PLAYWRIGHT BROWSERS ----
echo [6/7] Checking Playwright browsers...
set "PW_FOUND=0"
for /d %%d in ("%USERPROFILE%\AppData\Local\ms-playwright\chromium-*") do set "PW_FOUND=1"
if "%PW_FOUND%"=="1" (
    echo       Already installed. Skipping.
) else (
    echo       Installing browsers. This may take a few minutes...
    cd /d "%ROOT%"
    call npx playwright install
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Playwright browser install failed.
        pause
        exit /b 1
    )
    echo       Done.
)
echo.

:: ---- [7/7] START SERVER + FRONTEND ----
echo [7/7] Starting server and frontend...
echo.
cd /d "%ROOT%"

:: Write a helper bat to start React — avoids quote nesting issues entirely
set "REACT_BAT=%TEMP%\start_react_%RANDOM%.bat"
echo @echo off > "%REACT_BAT%"
echo cd /d "%ROOT%\visual-dashboard" >> "%REACT_BAT%"
echo npm start >> "%REACT_BAT%"

:: Start React in background using the helper bat
start /b cmd /c "%REACT_BAT%"

:: Open browser after 15s using another helper
set "BROWSER_BAT=%TEMP%\open_browser_%RANDOM%.bat"
echo @echo off > "%BROWSER_BAT%"
echo timeout /t 15 /nobreak ^>nul >> "%BROWSER_BAT%"
echo start "" "http://localhost:3000" >> "%BROWSER_BAT%"
start /b cmd /c "%BROWSER_BAT%"

echo React frontend starting in background...
echo Browser will open automatically in ~15 seconds.
echo.
echo ============================================
echo   RUNNING — Press Ctrl+C to stop everything
echo   Backend  : http://localhost:3001
echo   Frontend : http://localhost:3000
echo ============================================
echo.

:: Run server in foreground — keeps this window alive
node server.js

echo.
echo Server stopped.
pause