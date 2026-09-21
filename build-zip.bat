@echo off
echo ===================================================
echo Packaging crwn.st for Submission...
echo ===================================================

set GROUP_NUM=00
set ZIP_NAME=%GROUP_NUM%-App.zip
set TEMP_DIR=%TEMP%\crwnst_temp_zip

echo 1. Cleaning up old temp files...
if exist "%TEMP_DIR%" rmdir /S /Q "%TEMP_DIR%"
mkdir "%TEMP_DIR%"

echo 2. Copying project files (excluding node_modules and .git)...
xcopy /E /I /H /Y /EXCLUDE:exclude.txt . "%TEMP_DIR%"

echo 3. Creating Zip Archive: %ZIP_NAME% ...
powershell Compress-Archive -Path "%TEMP_DIR%\*" -DestinationPath "%ZIP_NAME%" -Force

echo 4. Cleaning up...
rmdir /S /Q "%TEMP_DIR%"

echo.
echo ===================================================
echo Successfully created %ZIP_NAME% !
echo Please rename %GROUP_NUM% to your actual group number.
echo ===================================================
pause
