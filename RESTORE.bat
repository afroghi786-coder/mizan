@echo off
echo 🔄 برگشت به حالت قبل...
cd /d "%~dp0"

REM برگشت فایل‌های TS
xcopy /Y "backup-FULL-2026-10-16T08-39-04\src\*.ts" . >nul 2>&1
xcopy /Y "backup-FULL-2026-10-16T08-39-04\src\*.tsx" . >nul 2>&1
xcopy /Y "backup-FULL-2026-10-16T08-39-04\src\*.json" . >nul 2>&1

REM برگشت gradle
if exist "backup-FULL-2026-10-16T08-39-04\src\android__build.gradle" copy /Y "backup-FULL-2026-10-16T08-39-04\src\android__build.gradle" android\build.gradle >nul
if exist "backup-FULL-2026-10-16T08-39-04\src\android__app__build.gradle" copy /Y "backup-FULL-2026-10-16T08-39-04\src\android__app__build.gradle" android\app\build.gradle >nul
if exist "backup-FULL-2026-10-16T08-39-04\src\gradle.properties" copy /Y "backup-FULL-2026-10-16T08-39-04\src\gradle.properties" android\gradle.properties >nul

REM برگشت Manifest
if exist "backup-FULL-2026-10-16T08-39-04\src\AndroidManifest.xml" copy /Y "backup-FULL-2026-10-16T08-39-04\src\AndroidManifest.xml" android\app\src\main\AndroidManifest.xml >nul

REM برگشت Java/Kotlin
xcopy /Y /E "backup-FULL-2026-10-16T08-39-04\android-java\*" android\app\src\main\java\com\mezan786\mizan\ >nul 2>&1

echo.
echo ✅ برگشت کامل شد!
echo حالا: npx expo start --clear
pause
