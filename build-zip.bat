@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set GROUP_NUM=1
set ZIP_NAME=%GROUP_NUM%-App.zip
set PKG_DIR=%TEMP%\crwnst_pkg

echo กำลังสร้างแพ็กเกจส่งอาจารย์ (เฉพาะไฟล์ที่จำเป็น)...
if exist "%PKG_DIR%" rmdir /S /Q "%PKG_DIR%"
mkdir "%PKG_DIR%\database"

rem ไฟล์ระดับบนสุดที่จำเป็นต่อการรัน
for %%F in (start.bat server.js package.json package-lock.json .env.example .env README.txt ERD.png setup-db.js) do (
  if exist "%%F" copy /Y "%%F" "%PKG_DIR%\" >nul
)

rem โฟลเดอร์ฐานข้อมูล: schema + seed + db layer
copy /Y "database\db.js" "%PKG_DIR%\database\" >nul
copy /Y "database\schema.sql" "%PKG_DIR%\database\" >nul
copy /Y "database\seed.js" "%PKG_DIR%\database\" >nul

for %%D in (middleware routes services utils views public) do (
  robocopy "%%D" "%PKG_DIR%\%%D" /E /NFL /NDL /NJH /NJS >nul
)

echo กำลังบีบอัดไฟล์ %ZIP_NAME% ...
if exist "%ZIP_NAME%" del /Q "%ZIP_NAME%"
powershell -NoProfile -Command "Compress-Archive -Path '%PKG_DIR%\*' -DestinationPath '%ZIP_NAME%' -Force"
rmdir /S /Q "%PKG_DIR%"

echo.
echo สร้าง %ZIP_NAME% เรียบร้อย
echo ถ้าต้องการเปลี่ยนเลขกลุ่ม ให้แก้ค่า GROUP_NUM ในไฟล์นี้
pause
