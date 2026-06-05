@echo off
setlocal EnableDelayedExpansion
title Visual Regression Tester - Updater

:: ============================================================
::  update.bat  -  Auto-updater for Visual Regression Tester
::  Reads credentials from config.json (never committed to Git)
::  Requires: Windows 7+ (uses built-in PowerShell)
::  No Git, no GitHub account needed on end-user machines.
:: ============================================================

echo.
echo  =========================================
echo   Visual Regression Tester - Auto Updater
echo  =========================================
echo.

:: ------------------------------------------------------------
:: STEP 0 - Locate script directory (works from any working dir)
:: ------------------------------------------------------------
set "APP_DIR=%~dp0"
:: Remove trailing backslash
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"

set "CONFIG_FILE=%APP_DIR%\config.json"
set "VERSION_FILE=%APP_DIR%\version.txt"
set "TEMP_ZIP=%APP_DIR%\update_temp.zip"
set "TEMP_DIR=%APP_DIR%\update_temp_extract"
set "BACKUP_DIR=%APP_DIR%\backup"

:: ------------------------------------------------------------
:: STEP 1 - Check config.json exists
:: ------------------------------------------------------------
echo [1/7] Checking configuration...

if not exist "%CONFIG_FILE%" (
    echo.
    echo  ERROR: config.json not found at:
    echo         %CONFIG_FILE%
    echo.
    echo  Please ensure config.json is in the same folder as update.bat
    echo  Contact your administrator if you do not have this file.
    echo.
    pause
    exit /b 1
)

:: ------------------------------------------------------------
:: STEP 2 - Read values from config.json using PowerShell
:: ------------------------------------------------------------
echo [2/7] Reading configuration...

:: Read TOKEN
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command ^
    "try { $c = Get-Content '%CONFIG_FILE%' -Raw | ConvertFrom-Json; Write-Output $c.token } catch { Write-Output 'ERROR' }"`) do (
    set "TOKEN=%%A"
)

:: Read REPO  (format: username/repo-name)
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command ^
    "try { $c = Get-Content '%CONFIG_FILE%' -Raw | ConvertFrom-Json; Write-Output $c.repo } catch { Write-Output 'ERROR' }"`) do (
    set "REPO=%%A"
)

:: Read UPDATE_CHANNEL  (e.g. stable)
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command ^
    "try { $c = Get-Content '%CONFIG_FILE%' -Raw | ConvertFrom-Json; Write-Output $c.update_channel } catch { Write-Output 'ERROR' }"`) do (
    set "UPDATE_CHANNEL=%%A"
)

:: Validate required fields
if "!TOKEN!"=="ERROR" set "TOKEN="
if "!REPO!"=="ERROR"   goto :config_error
if "!REPO!"==""        goto :config_error

:: Default channel to stable if missing
if "!UPDATE_CHANNEL!"==""      set "UPDATE_CHANNEL=stable"
if "!UPDATE_CHANNEL!"=="ERROR" set "UPDATE_CHANNEL=stable"

echo        Repository  : !REPO!
echo        Channel     : !UPDATE_CHANNEL!
if "!TOKEN!"=="" (
    echo        Token       : (none - public repo access only)
) else (
    echo        Token       : (loaded)
)
echo.

:: ------------------------------------------------------------
:: STEP 3 - Get CURRENT local version
:: ------------------------------------------------------------
echo [3/7] Checking current version...

set "CURRENT_VERSION=none"
if exist "%VERSION_FILE%" (
    for /f "usebackq delims=" %%A in ("%VERSION_FILE%") do (
        set "CURRENT_VERSION=%%A"
        goto :got_local_ver
    )
)
:got_local_ver
echo        Installed version : !CURRENT_VERSION!

:: ------------------------------------------------------------
:: STEP 4 - Fetch LATEST release version from GitHub API
:: ------------------------------------------------------------
echo [4/7] Checking for latest release on GitHub...

for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command ^
    "try { " ^
    "  $headers = @{ 'User-Agent' = 'update-bat' }; " ^
    "  if ('!TOKEN!' -ne '') { $headers['Authorization'] = 'token !TOKEN!' } " ^
    "  $r = Invoke-RestMethod -Uri 'https://api.github.com/repos/!REPO!/releases/latest' -Headers $headers -ErrorAction Stop; " ^
    "  Write-Output $r.tag_name " ^
    "} catch { " ^
    "  Write-Output 'FETCH_ERROR' " ^
    "}"`) do (
    set "LATEST_VERSION=%%A"
)

if "!LATEST_VERSION!"=="FETCH_ERROR" (
    echo.
    echo  ERROR: Could not reach GitHub API.
    echo         Possible causes:
    echo           - No internet connection
    echo           - Invalid token in config.json
    echo           - Incorrect repo name in config.json
    echo           - No releases have been published yet
    echo.
    echo  Your app is still working. Please try again later.
    echo.
    pause
    exit /b 1
)

echo        Latest release    : !LATEST_VERSION!
echo.

:: ------------------------------------------------------------
:: STEP 5 - Compare versions and decide whether to update
:: ------------------------------------------------------------
echo [5/7] Comparing versions...

if "!CURRENT_VERSION!"=="!LATEST_VERSION!" (
    echo.
    echo  You already have the latest version ^(!LATEST_VERSION!^).
    echo  No update needed.
    echo.
    echo  Starting the app...
    echo.
    call "%APP_DIR%\launch.bat"
    exit /b 0
)

echo        Update available: !CURRENT_VERSION! --^> !LATEST_VERSION!
echo.
set /p "CONFIRM= Do you want to update now? (Y/N): "
if /i "!CONFIRM!" NEQ "Y" (
    echo.
    echo  Update cancelled. Starting existing version...
    echo.
    call "%APP_DIR%\launch.bat"
    exit /b 0
)

:: ------------------------------------------------------------
:: STEP 6 - Stop running app before updating
:: ------------------------------------------------------------
echo.
echo [6/7] Stopping the application before update...

if exist "%APP_DIR%\stop.bat" (
    call "%APP_DIR%\stop.bat"
    timeout /t 3 /nobreak >nul
) else (
    echo        stop.bat not found - skipping stop step.
)

:: ------------------------------------------------------------
:: STEP 6b - Backup current installation
:: ------------------------------------------------------------
echo        Creating backup of current version...

if exist "%BACKUP_DIR%" (
    rd /s /q "%BACKUP_DIR%" 2>nul
)
mkdir "%BACKUP_DIR%"

:: Copy everything except backup folder itself and temp files
robocopy "%APP_DIR%" "%BACKUP_DIR%" /E /XD "%BACKUP_DIR%" "%TEMP_DIR%" /XF "update_temp.zip" /NFL /NDL /NJH /NJS >nul 2>&1

echo        Backup saved to: %BACKUP_DIR%

:: ------------------------------------------------------------
:: STEP 7 - Download and extract the release ZIP
:: ------------------------------------------------------------
echo.
echo [7/7] Downloading update !LATEST_VERSION!...

:: Get the asset download URL (first .zip asset in the release)
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command ^
    "try { " ^
    "  $headers = @{ 'User-Agent' = 'update-bat' }; " ^
    "  if ('!TOKEN!' -ne '') { $headers['Authorization'] = 'token !TOKEN!' } " ^
    "  $r = Invoke-RestMethod -Uri 'https://api.github.com/repos/!REPO!/releases/latest' -Headers $headers -ErrorAction Stop; " ^
    "  $asset = $r.assets | Where-Object { $_.name -like '*.zip' } | Select-Object -First 1; " ^
    "  if ($asset) { Write-Output $asset.url } else { Write-Output 'NO_ASSET' } " ^
    "} catch { " ^
    "  Write-Output 'FETCH_ERROR' " ^
    "}"`) do (
    set "ASSET_URL=%%A"
)

if "!ASSET_URL!"=="NO_ASSET" (
    echo.
    echo  ERROR: No ZIP asset found in the latest release ^(!LATEST_VERSION!^).
    echo         Please contact your administrator.
    echo.
    pause
    exit /b 1
)

if "!ASSET_URL!"=="FETCH_ERROR" (
    echo.
    echo  ERROR: Failed to retrieve asset URL.
    echo.
    pause
    exit /b 1
)

:: Download the ZIP asset (GitHub requires Accept header for binary assets)
echo        Downloading from GitHub...

powershell -NoProfile -Command ^
    "try { " ^
    "  $headers = @{ Accept = 'application/octet-stream'; 'User-Agent' = 'update-bat' }; " ^
    "  if ('!TOKEN!' -ne '') { $headers['Authorization'] = 'token !TOKEN!' } " ^
    "  Invoke-WebRequest -Uri '!ASSET_URL!' -Headers $headers -OutFile '!TEMP_ZIP!' -ErrorAction Stop; " ^
    "  Write-Output 'OK' " ^
    "} catch { " ^
    "  Write-Output 'DOWNLOAD_ERROR' " ^
    "}" > "%TEMP_DIR%_dlresult.txt" 2>&1

set /p DL_RESULT=<"%TEMP_DIR%_dlresult.txt"
del "%TEMP_DIR%_dlresult.txt" 2>nul

if not exist "!TEMP_ZIP!" (
    echo.
    echo  ERROR: Download failed.
    echo         Restoring backup...
    call :restore_backup
    pause
    exit /b 1
)

echo        Download complete. Extracting...

:: Extract ZIP to temp folder
if exist "%TEMP_DIR%" rd /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%"

powershell -NoProfile -Command ^
    "try {" ^
    "  Expand-Archive -Path '!TEMP_ZIP!' -DestinationPath '!TEMP_DIR!' -Force -ErrorAction Stop;" ^
    "  Write-Output 'OK'" ^
    "} catch {" ^
    "  Write-Output 'EXTRACT_ERROR'" ^
    "}" > "%TEMP_DIR%_exresult.txt" 2>&1

set /p EX_RESULT=<"%TEMP_DIR%_exresult.txt"
del "%TEMP_DIR%_exresult.txt" 2>nul

if "!EX_RESULT!" NEQ "OK" (
    echo.
    echo  ERROR: Extraction failed.
    echo         Restoring backup...
    call :restore_backup
    pause
    exit /b 1
)

:: Detect if ZIP contains a single root subfolder (common with GitHub zips)
for /f "usebackq delims=" %%A in (`powershell -NoProfile -Command ^
    "$items = Get-ChildItem -Path '!TEMP_DIR!' -Force;" ^
    "if ($items.Count -eq 1 -and $items[0].PSIsContainer) { Write-Output $items[0].FullName } else { Write-Output '!TEMP_DIR!' }"`) do (
    set "EXTRACT_SRC=%%A"
)

:: Copy extracted files over app directory
:: Preserve config.json and backup folder
echo        Installing update...

robocopy "!EXTRACT_SRC!" "%APP_DIR%" /E ^
    /XF "config.json" ^
    /XD "%BACKUP_DIR%" "%TEMP_DIR%" ^
    /NFL /NDL /NJH /NJS >nul 2>&1

:: Save new version number
echo !LATEST_VERSION!> "%VERSION_FILE%"

:: Cleanup temp files
del "!TEMP_ZIP!" 2>nul
rd /s /q "!TEMP_DIR!" 2>nul

echo.
echo  =========================================
echo   Update complete!  Version: !LATEST_VERSION!
echo  =========================================
echo.
echo  What changed in this version:
echo  Check release notes at:
echo  https://github.com/!REPO!/releases/tag/!LATEST_VERSION!
echo.
echo  Starting the updated application...
echo.
timeout /t 3 /nobreak >nul

call "%APP_DIR%\launch.bat"
exit /b 0


:: ============================================================
:: SUB-ROUTINE: Restore backup on failure
:: ============================================================
:restore_backup
echo.
echo  Restoring previous version from backup...
if exist "%BACKUP_DIR%" (
    robocopy "%BACKUP_DIR%" "%APP_DIR%" /E /XD "%BACKUP_DIR%" "%TEMP_DIR%" /NFL /NDL /NJH /NJS >nul 2>&1
    echo  Restore complete. Your previous version is intact.
) else (
    echo  No backup found. Please contact your administrator.
)
exit /b 0


:: ============================================================
:: LABEL: config_error
:: ============================================================
:config_error
echo.
echo  ERROR: config.json is missing required fields or is malformed.
echo.
echo  Expected format:
echo  {
echo    "token": "ghp_xxxxxxxxxxxxxxxxxxxx",
echo    "repo": "your-username/your-repo-name",
echo    "update_channel": "stable"
echo  }
echo.
echo  Contact your administrator for a valid config.json file.
echo.
pause
exit /b 1