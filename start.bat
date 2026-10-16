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
echo ระบบจะเปิด Cloudflare Tunnel ให้อัตโนมัติ ลิงก์สาธารณะจะแสดงในหน้าต่าง cloudflared
echo ในการรัน บทบาทลูกค้าและพนักงานห้องลองเสื้อไปพร้อมกัน
echo ============================================================
pause

echo เริ่มเซิร์ฟเวอร์ที่ http://localhost:3000 ^(ปิดหน้าต่าง crwn.st server เพื่อหยุด^)
start "crwn.st server" cmd /k node server.js

echo รอให้เซิร์ฟเวอร์พร้อม...
set /a WAIT=0
:waitserver
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul 2>nul
if not errorlevel 1 goto serverready
set /a WAIT+=1
if %WAIT% GEQ 30 goto serverslow
timeout /t 1 >nul
goto waitserver

:serverslow
echo [WARN] เซิร์ฟเวอร์ยังไม่พร้อมหลัง 30 วินาที ตรวจสอบหน้าต่าง crwn.st server
goto openbrowser

:serverready
echo เซิร์ฟเวอร์พร้อมแล้ว

:openbrowser
start "" http://localhost:3000

set "CF="
if exist "cloudflared.exe" set "CF=%CD%\cloudflared.exe"
if not defined CF where cloudflared >nul 2>nul && set "CF=cloudflared"

if not defined CF (
  echo [INFO] ไม่พบ cloudflared.exe จึงข้าม Cloudflare Tunnel
  goto done
)

echo เปิด Cloudflare Tunnel ในหน้าต่างใหม่ ลิงก์สาธารณะจะแสดงในหน้าต่าง cloudflared
start "cloudflared" cmd /k ""%CF%" tunnel --url http://localhost:3000"

:done
pause
