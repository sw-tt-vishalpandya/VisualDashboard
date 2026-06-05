@echo off
rem run-with-env.bat - Simple wrapper to run update.bat with environment variables
rem Usage:
rem  - Edit config.json with your repository and token
rem  - Or run interactively: run-with-env.bat interactive

setlocal enabledelayedexpansion

:: ---------- READ FROM config.json ----------
for /f "tokens=2 delims="":, " %%a in ('findstr /r "repo" config.json') do set "GITHUB_REPO=%%a"
for /f "tokens=2 delims="":, " %%a in ('findstr /r "token" config.json') do set "GITHUB_TOKEN=%%a"
for /f "tokens=2 delims="":, " %%a in ('findstr /r "update_channel" config.json') do set "UPDATE_CHANNEL=%%a"
:: ------------------------------------------

:: If the wrapper is run with the argument "interactive", prompt the user to enter values.
if /I "%~1"=="interactive" goto interactive

echo Running updater with environment variables (non-persistent)...
echo Repository: !GITHUB_REPO!
if defined GITHUB_TOKEN (
    echo Token: (provided)
) else (
    echo Token: (none)
)
if defined UPDATE_CHANNEL (
    echo Channel: !UPDATE_CHANNEL!
)

echo.
echo Checking for update.bat at: %~dp0update.bat
if not exist "%~dp0update.bat" (
    echo ERROR: update.bat not found!
    endlocal
    exit /b 1
)

echo Running update.bat...
set GITHUB_REPO=!GITHUB_REPO!
set GITHUB_TOKEN=!GITHUB_TOKEN!
set UPDATE_CHANNEL=!UPDATE_CHANNEL!
call "%~dp0update.bat"
if %ERRORLEVEL% neq 0 (
    echo ERROR: update.bat failed with exit code %ERRORLEVEL%
)

endlocal
exit /b %ERRORLEVEL%

:interactive
echo Interactive mode - enter repository and optional token.
set /p "GITHUB_REPO=Enter repository (owner/repo): "
if "%GITHUB_REPO%"=="" (
    echo No repository entered. Exiting.
    endlocal
    exit /b 1
)
set /p "GITHUB_TOKEN=Enter token (leave blank for unauthenticated): "
set /p "UPDATE_CHANNEL=Enter update channel (default: main): "

echo.
echo Checking for update.bat at: %~dp0update.bat
if not exist "%~dp0update.bat" (
    echo ERROR: update.bat not found!
    endlocal
    exit /b 1
)

echo Launching updater...
call "%~dp0update.bat"
if %ERRORLEVEL% neq 0 (
    echo ERROR: update.bat failed with exit code %ERRORLEVEL%
)

endlocal
exit /b %ERRORLEVEL%
