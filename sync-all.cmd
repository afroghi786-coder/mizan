@echo off
cd /d "%USERPROFILE%\Desktop\mizan"

echo === ۱. دیپلوی امن لینک اصلی وب ===
call npm run deploy:secure
if errorlevel 1 (
    echo ❌ خطا در npm run deploy:secure
    pause
    exit /b 1
)

echo.
echo === ۲. ثبت و ارسال تغییرات به گیت‌هاب (برای بیلد APK / نسخه گوشی) ===
git add .
git commit -m "feat: new feature + secure build"
git push
if errorlevel 1 (
    echo ⚠️ توجه: اگر تغییری برای commit نبود یا خطای شبکه بود، وضعیت git را بررسی کن.
)

echo.
echo ✅ دیپلوی وب و ارسال به گیت‌هاب انجام شد.
echo برای چک سریع محلی می‌توانی اجرا کنی: npx expo start --clear
pause