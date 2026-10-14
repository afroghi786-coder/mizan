@echo off
chcp 65001 >nul
cls

echo ═══════════════════════════════════════════
echo   🚀 ساخت APK — یک فایل، تمام
echo ═══════════════════════════════════════════
echo.

cd /d "%USERPROFILE%\Desktop\mizan"

REM ═══════════════════════════════════════════
REM ۱. بررسی MainApplication.kt
REM ═══════════════════════════════════════════
echo 📌 ۱. چک کردن MainApplication.kt...
set APP_FILE=android\app\src\main\java\com\mezan786\mizan\MainApplication.kt

if not exist "%APP_FILE%" (
  echo    ❌ فایل پیدا نشد!
  pause
  exit /b 1
)

findstr /C:"SpeechPackage" "%APP_FILE%" >nul 2>&1
if %errorlevel%==0 (
  echo    ⚠️ SpeechPackage هنوز هست — حذف می‌کنم...
  node fix-apk.cjs
) else (
  echo    ✅ SpeechPackage نیست — خوبه
)

REM ═══════════════════════════════════════════
REM ۲. بررسی .gitignore
REM ═══════════════════════════════════════════
echo.
echo 📌 ۲. چک کردن .gitignore...

findstr /C:"backup-\*/" .gitignore >nul 2>&1
if not %errorlevel%==0 (
  echo    ⚠️ .gitignore ناقص — اصلاح می‌کنم...
  node fix-gitignore.cjs
) else (
  echo    ✅ .gitignore خوبه
)

REM ═══════════════════════════════════════════
REM ۳. چک فونت‌ها
REM ═══════════════════════════════════════════
echo.
echo 📌 ۳. چک فونت‌ها...
if exist "docs\assets\node_modules\@expo-google-fonts" (
  echo    ✅ فونت‌ها هستند
) else (
  echo    ⚠️ فونت‌ها نیستند — شاید بعداً مشکل شود
)

REM ═══════════════════════════════════════════
REM ۴. Git — reset + add + commit + push
REM ═══════════════════════════════════════════
echo.
echo 📌 ۴. آماده‌سازی Git...

echo    → git reset (فقط از صف، فایل‌ها پاک نمی‌شوند)
git reset --quiet

echo    → git add .
git add .

echo.
echo 📊 وضعیت نهایی:
git status --short

echo.
echo ═══════════════════════════════════════════
echo   ⚠️ اگر بالا فایلی هست که نمی‌خواهی push شود
echo   Ctrl+C بزن و به من بگو
echo ═══════════════════════════════════════════
echo.
pause

REM ═══════════════════════════════════════════
REM ۵. Commit + Push
REM ═══════════════════════════════════════════
echo.
echo 📌 ۵. Commit و Push...

git commit -m "fix: remove SpeechPackage import - fix APK build"
if %errorlevel% neq 0 (
  echo    ℹ️ چیزی برای commit نبود یا خطا داد
)

echo.
echo    → در حال push به GitHub...
git push

if %errorlevel% neq 0 (
  echo.
  echo    ❌ Push خطا داد
  echo    اگر رمز خواست، از Personal Access Token استفاده کن
  pause
  exit /b 1
)

echo.
echo ═══════════════════════════════════════════
echo   ✅✅✅ Push شد!
echo ═══════════════════════════════════════════
echo.
echo 📌 حالا:
echo    ۱. برو github.com → پروژه‌ات → تب Actions
echo    ۲. منتظر بمان — GitHub APK می‌سازد (۱۴ دقیقه)
echo    ۳. اگر ✅ سبز شد → از Releases یا Artifacts دانلود کن
echo    ۴. اگر ❌ قرمز شد → خطا را کپی کن برای من
echo.
pause