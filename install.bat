@echo off
title Visual Testing App - Installation
color 0A

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo ============================================
echo   Visual Testing App - First Time Setup
echo   Run this ONCE before using launch.bat
echo ============================================
echo.

:: ---- [1/6] CHECK NODE ----
echo [1/6] Checking Node.js...
node -v
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js not found. Install from https://nodejs.org then re-run this.
    pause
    exit /b 1
)
echo       Node.js OK
echo.

:: ---- [2/6] INSTALL BACKSTOPJS + INIT ----
echo [2/6] Checking BackstopJS...
set "BS_FOUND=0"
for /f "tokens=*" %%i in ('backstop --version 2^>^&1') do (
    echo %%i | findstr /i "BackstopJS" >nul
    if not errorlevel 1 set "BS_FOUND=1"
)
if "%BS_FOUND%"=="1" (
    echo       BackstopJS already installed. Skipping install.
) else (
    echo       Installing BackstopJS globally...
    call npm install -g backstopjs
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] BackstopJS install failed. Try Run as Administrator.
        pause
        exit /b 1
    )
    echo       BackstopJS installed.
)

:: Initialize BackstopJS — creates backstop.json + backstop_data/ folders
:: Only runs if backstop.json not already present
if exist "%ROOT%\backstop.json" (
    echo       backstop.json already exists. Skipping init.
) else (
    echo       Running backstop init...
    cd /d "%ROOT%"
    call backstop init
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] backstop init failed.
        pause
        exit /b 1
    )
    echo       BackstopJS initialized ^(backstop.json + backstop_data/ created^).
)
echo.

:: ---- [3/6] SERVER DEPS ----
echo [3/6] Installing server dependencies...
cd /d "%ROOT%"
call npm install
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Server npm install failed.
    pause
    exit /b 1
)
call npm install nspell dictionary-en
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Spell check dependency install failed.
    pause
    exit /b 1
)
echo       Done.
echo.

:: ---- [4/6] FRONTEND DEPS ----
echo [4/6] Installing frontend dependencies...
cd /d "%ROOT%\visual-dashboard"
call npm install
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Frontend npm install failed.
    pause
    exit /b 1
)
echo       Done.
echo.

:: ---- [5/6] PLAYWRIGHT + TYPESCRIPT ----
echo [5/6] Installing Playwright + TypeScript...
cd /d "%ROOT%"
call npm install --save-dev @playwright/test typescript ts-node @types/node
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Playwright install failed.
    pause
    exit /b 1
)
echo       Done.
echo.

:: ---- [6/6] PLAYWRIGHT BROWSERS ----
echo [6/6] Installing Playwright browsers...
set "PW_FOUND=0"
for /d %%d in ("%USERPROFILE%\AppData\Local\ms-playwright\chromium-*") do set "PW_FOUND=1"
if "%PW_FOUND%"=="1" (
    echo       Browsers already installed. Skipping.
) else (
    echo       Downloading browsers. This may take a few minutes...
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

echo ============================================
echo   Installation Complete!
echo.
echo   You can now use launch.bat to start
echo   the app anytime.
echo ============================================
echo.
:: If called directly by user, pause so they can read the output
:: If called from launch.bat, skip pause and return control immediately
if /i "%1"=="NOPAUSE" exit /b 0
pause
