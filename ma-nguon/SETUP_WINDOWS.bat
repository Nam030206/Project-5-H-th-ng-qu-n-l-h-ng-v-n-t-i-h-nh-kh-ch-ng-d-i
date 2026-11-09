@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Can Node.js 22.12 tro len de chay tu ma nguon.
  echo Neu da co VanHanh.exe thi mo truc tiep file do, khong can Node.js.
  pause
  exit /b 1
)
call npm ci
if errorlevel 1 goto error
call npm run build
if errorlevel 1 goto error
 echo Hoan tat. Mo START_WINDOWS.bat de chay desktop.
 echo Thong tin MySQL duoc nhap tren cua so ung dung.
pause
exit /b 0
:error
 echo Cai dat chua thanh cong. Xem thong bao phia tren.
pause
exit /b 1
