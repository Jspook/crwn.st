@echo off
chcp 65001 >nul
title crwn.st
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] ไม่พบ Node.js กรุณาติดตั้ง Node.js เวอร์ชัน 22 ขึ้นไปจาก https://nodejs.org
  pause
  exit /b 1
)

if not exist ".env" (
  copy /Y ".env.example" ".env" >nul
  echo [ERROR] สร้างไฟล์ .env จาก .env.example แล้ว กรุณาตั้งค่า DB_* และ COOKIE_SECRET ในไฟล์ .env แล้วรันใหม่อีกครั้ง
  pause
  exit /b 1
)

netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo [ERROR] พอร์ต 3000 ถูกใช้งานอยู่แล้ว ^(มีโปรแกรมอื่นหรือเซิร์ฟเวอร์อีกตัวเปิดอยู่^)
  echo ปิดโปรแกรมนั้นก่อน แล้วดับเบิลคลิก start.bat อีกครั้ง
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo กำลังติดตั้ง dependencies ^(ครั้งแรกอาจใช้เวลาสักครู่^)...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install ไม่สำเร็จ
    pause
    exit /b 1
  )
)

echo ============================================================
echo หมายเหตุ: ระบบมีหลายบทบาทที่ทำงานร่วมกัน หากใช้ localhost แล้วสลับบทบาทไปมา cookie จะชนกัน
echo จึงแนะนำให้ใช้ Cloudflare Tunnel ตามข้อ 10 ใน README.txt
echo ในการรัน บทบาทลูกค้าและพนักงานห้องลองเสื้อไปพร้อมกัน
echo ============================================================
pause

echo เริ่มเซิร์ฟเวอร์ที่ http://localhost:3000 ^(กด Ctrl+C เพื่อหยุด^)
start "" cmd /c "timeout /t 3 >nul && start http://localhost:3000"
node server.js
pause
