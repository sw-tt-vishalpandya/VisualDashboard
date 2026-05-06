@echo off
title Visual Testing App - Stopping...
color 0C

echo ============================================
echo   Stopping Visual Testing App...
echo ============================================
echo.

:: Kill node processes (server.js)
echo Stopping backend server...
taskkill /f /fi "WINDOWTITLE eq Backend Server" >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
echo Done.

:: Kill React dev server (npm start spawns node + react-scripts)
echo Stopping React frontend...
taskkill /f /fi "WINDOWTITLE eq React Frontend" >nul 2>&1
taskkill /f /im react-scripts.exe >nul 2>&1
echo Done.

echo.
echo ============================================
echo   All processes stopped.
echo ============================================
echo.
pause