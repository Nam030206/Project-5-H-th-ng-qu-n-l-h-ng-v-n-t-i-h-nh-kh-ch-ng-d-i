@echo off
setlocal
chcp 65001 >nul
echo VAN HANH - KIEM TRA KET NOI OPENSTREETMAP
echo Khong doc cau hinh MySQL, tai khoan hoac mat khau.
echo.
if not exist "%SystemRoot%\System32\curl.exe" (
  echo CURL_SYSTEM=NOT_FOUND
  pause
  exit /b 1
)
set "P5_MAP_PROBE_FILE=%TEMP%\VanHanh-map-check-%RANDOM%-%RANDOM%.png"
"%SystemRoot%\System32\curl.exe" --disable --silent --show-error --globoff --proto "=https" --connect-timeout 8 --max-time 15 --user-agent "VanHanhProject5/1.3.5" --output "%P5_MAP_PROBE_FILE%" --write-out "OSM_HTTP=%%{http_code}; TLS=%%{ssl_verify_result}; BYTES=%%{size_download}\n" "https://tile.openstreetmap.org/8/203/112.png" 2>nul
set "P5_MAP_EXIT=%ERRORLEVEL%"
echo CURL_EXIT=%P5_MAP_EXIT%
if exist "%P5_MAP_PROBE_FILE%" del /q "%P5_MAP_PROBE_FILE%"
echo.
echo HTTP=200 va CURL_EXIT=0: Windows tai duoc anh OpenStreetMap.
echo CURL_EXIT=6: loi DNS; 7: khong ket noi duoc; 28: qua thoi gian; 60: loi chung chi.
echo Hay chup lai ket qua nay neu ban do trong app van loi.
echo.
pause
