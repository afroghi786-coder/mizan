@echo off
chcp 65001 >nul
cd /d "%USERPROFILE%\Desktop\mizan"

echo ==========================================
echo   BUILD + PUSH (Automatic)
echo ==========================================
echo.

echo [1/5] Pak kardan dist ghadimi...
if exist dist rmdir /s /q dist

echo [2/5] Build android (3 daghighe sabr kon)...
echo.
call npx expo export --platform android > build-log.txt 2>&1

if errorlevel 1 (
  echo.
  echo ❌ BUILD FAILED
  echo.
  echo Log ra baz kon:
  type build-log.txt
  pause
  exit /b 1
)

echo.
echo ✅ Build movafagh
echo.

echo [3/5] Git add...
git add . > git-log.txt 2>&1

echo [4/5] Git commit...
git commit -m "remove voice temporarily for APK build" >> git-log.txt 2>&1

echo [5/5] Git push...
git push >> git-log.txt 2>&1

echo.
echo ==========================================
echo   TAMAM SHOD
echo ==========================================
echo.
echo Log ha:
echo   build-log.txt
echo   git-log.txt
echo.
echo Hala:
echo   1. Borو github.com/afroghi786-coder/mizan/actions
echo   2. Montazer APK bash (14 daghighe)
echo.
pause