@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules\electron (
  echo Chay SETUP_WINDOWS.bat truoc hoac mo VanHanh.exe.
  pause
  exit /b 1
)
if not exist dist\public\index.html (
  echo Chua build giao dien. Hay chay SETUP_WINDOWS.bat.
  pause
  exit /b 1
)
call npm start
if errorlevel 1 pause
