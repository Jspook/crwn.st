@echo off
echo ===================================================
echo Starting crwn.st Web Application...
echo ===================================================

echo Installing dependencies...
call npm install

echo.
echo Starting the server...
start http://localhost:3000
node server.js

pause
