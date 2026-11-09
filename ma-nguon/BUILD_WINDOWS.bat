@echo off
chcp 65001 >nul
cd /d "%~dp0"
call npm ci
if errorlevel 1 goto error
call npm run dist:win
if errorlevel 1 goto error
 echo Da tao bo cai trong thu muc release.
pause
exit /b 0
:error
 echo Chua tao duoc bo cai. Xem loi phia tren.
pause
exit /b 1
