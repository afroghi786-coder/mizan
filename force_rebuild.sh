#!/bin/bash
set -e

echo "═══════════════════════════════════════════"
echo "  ۱. پاک کردن کامل build قدیمی"
echo "═══════════════════════════════════════════"
rm -rf docs .expo node_modules/.cache
echo "✅ docs پاک شد"

echo ""
echo "═══════════════════════════════════════════"
echo "  ۲. بیلد fresh"
echo "═══════════════════════════════════════════"
npx expo export --platform web --output-dir docs 2>&1 | tail -10

if [ ! -f "docs/index.html" ]; then
  echo "❌ بیلد موفق نشد — docs/index.html نیست"
  exit 1
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  ۳. تنظیم مسیر GitHub Pages"
echo "═══════════════════════════════════════════"
sed -i 's|"/_expo|"/mizan/_expo|g; s|href="/favicon|href="/mizan/favicon|g' docs/index.html
touch docs/.nojekyll
echo "✅ مسیرها تنظیم شد"

echo ""
echo "═══════════════════════════════════════════"
echo "  ۴. بررسی gitignore"
echo "═══════════════════════════════════════════"
if grep -q "^docs/" .gitignore 2>/dev/null || grep -q "^docs$" .gitignore 2>/dev/null; then
  echo "⚠️ docs در gitignore هست — حذف می‌کنم"
  sed -i '/^docs\/\?$/d' .gitignore
fi
if grep -q "docs" .gitignore 2>/dev/null; then
  echo "⚠️ هنوز docs در gitignore — چک کن"
  grep docs .gitignore
fi
echo "✅ gitignore تمیز"

echo ""
echo "═══════════════════════════════════════════"
echo "  ۵. بررسی فایل جدید بیلد"
echo "═══════════════════════════════════════════"
ls -la docs/_expo/static/js/web/ | tail -3
NEW_JS=$(ls docs/_expo/static/js/web/index-*.js 2>/dev/null | head -1)
echo "📦 فایل جدید: $NEW_JS"
if [ -f "$NEW_JS" ]; then
  SIZE=$(stat -c%s "$NEW_JS")
  echo "📏 حجم: $SIZE bytes"
  if [ "$SIZE" -lt 1000000 ]; then
    echo "⚠️ حجم کم است — شاید بیلد ناقصه"
  else
    echo "✅ حجم درست"
  fi
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  ۶. کامیت و پوش"
echo "═══════════════════════════════════════════"
git add -A
git status --short | head -10
git commit -m "force rebuild with all features" || echo "ℹ️ چیزی برای کامیت نیست"
git push -f

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ تمام — صبر کن ۲ دقیقه، بعد Ctrl+Shift+R"
echo "═══════════════════════════════════════════"
