#!/bin/bash
set +e
cd ~/mizan

echo "═══════════════════════════════════════════"
echo "  🎯 ارزهای کامل + همه چیز سالم"
echo "═══════════════════════════════════════════"

cp ExchangeScreen.tsx ExchangeScreen.tsx.bak_clean_$(date +%s)
cp BoxesScreen.tsx BoxesScreen.tsx.bak_clean_$(date +%s)
echo "✅ Backup"

python3 << 'PYEOF'
import re

# ═══════════════════════════════════════════════
# ExchangeScreen.tsx
# ═══════════════════════════════════════════════
c = open('ExchangeScreen.tsx').read()
orig = c

# ۱. MAIN_CURS = Object.keys(CUR)
before = c.count('const MAIN_CURS')
c = re.sub(r'const MAIN_CURS = \[[^\]]*\]', 'const MAIN_CURS = Object.keys(CUR)', c)
c = re.sub(r'const MAIN_CURS = Object\.keys\(CUR\)', 'const MAIN_CURS = Object.keys(CUR)', c)
print(f"✅ MAIN_CURS")

# ۲. حواله + چک: مطمئن شو از MAIN_CURS استفاده می‌کنن
# هرجا hawForm.currency یا ckForm.currency هست → MAIN_CURS.map
for form in ['hawForm', 'ckForm']:
    # پیدا کردن بلوک chips
    anchor = f'{form}.currency === c &&'
    idx = c.find(anchor)
    if idx < 0:
        print(f"⚠️ {form} chips پیدا نشد")
        continue
    # پیدا کردن map source قبلش
    map_idx = c.rfind('.map(c => (', 0, idx)
    if map_idx < 0:
        print(f"⚠️ {form} map پیدا نشد")
        continue
    # پیدا کردن شروع { قبل از map
    brace_idx = c.rfind('{', 0, map_idx)
    # حالا جایگزین کن
    old_source = c[brace_idx:map_idx]
    if 'MAIN_CURS' not in old_source and 'Object.keys(CUR)' not in old_source:
        c = c[:brace_idx] + '{MAIN_CURS' + c[map_idx:]
        print(f"✅ {form} → MAIN_CURS")
    else:
        print(f"ℹ️ {form} از قبل درست")

# ۳. اطمینان از پرچم در chips حواله
haw_start = c.find('<Modal visible={hawModal}')
haw_end = c.find('</Modal>', haw_start)
if haw_start > 0 and haw_end > haw_start:
    sec = c[haw_start:haw_end]
    # فقط داخل TouchableOpacity مربوط به hawForm.currency
    # الگو: >{c}</Text>  →  >{CUR[c].flag} {c}</Text>
    sec = re.sub(r'(hawForm\.currency === c[^}]*\}[^>]*>[^<]*<Text[^>]*>)\{c\}(</Text>)',
                 r'\1{CUR[c].flag} {c}\2', sec)
    c = c[:haw_start] + sec + c[haw_end:]
    print("✅ hawala flags")

# ۴. چک
ck_start = c.find('<Modal visible={ckModal}')
ck_end = c.find('</Modal>', ck_start)
if ck_start > 0 and ck_end > ck_start:
    sec = c[ck_start:ck_end]
    sec = re.sub(r'(ckForm\.currency === c[^}]*\}[^>]*>[^<]*<Text[^>]*>)\{c\}(</Text>)',
                 r'\1{CUR[c].flag} {c}\2', sec)
    c = c[:ck_start] + sec + c[ck_end:]
    print("✅ check flags")

# ۵. حذف مودال‌های شکسته CK_CUR_MODAL و HAW_CUR_MODAL (اگه هستن)
for marker in ['CK_CUR_MODAL', 'HAW_CUR_MODAL']:
    idx = c.find(f'{{/* {marker} */}}')
    if idx > 0:
        # پیدا کردن Modal شروع
        modal_start = c.find('<Modal', idx)
        if modal_start > 0:
            # پیدا کردن بسته شدن متناظر
            depth = 0
            i = modal_start
            while i < len(c):
                if c[i:i+6] == '<Modal': depth += 1
                elif c[i:i+8] == '</Modal>':
                    depth -= 1
                    if depth == 0:
                        i += 8
                        break
                i += 1
            c = c[:idx] + c[i:]
            print(f"✅ حذف {marker}")

# ۶. پاک کردن state ها و مودال‌های بی‌استفاده
for name in ['showHawCur', 'showCkCur', 'hawCurSearch', 'ckCurSearch']:
    c = re.sub(rf"\s*const \[{name}[^\n]*\n", "\n", c)
print("✅ state های بی‌استفاده پاک شدن")

if c != orig:
    open('ExchangeScreen.tsx', 'w').write(c)
    print("\n✅ ExchangeScreen ذخیره شد")
else:
    print("\n⚠️ تغییری در ExchangeScreen نبود")

# ═══════════════════════════════════════════════
# BoxesScreen.tsx — z-index برای مودال‌ها
# ═══════════════════════════════════════════════
c2 = open('BoxesScreen.tsx').read()
orig2 = c2

# z-index قوی به mBg و mBox
c2 = re.sub(
    r'mBg:\s*\{[^}]*\}',
    "mBg: { flex: 1, backgroundColor: 'rgba(15,36,56,0.92)', justifyContent: 'center', padding: 14, zIndex: 999999, elevation: 999999, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }",
    c2)
c2 = re.sub(
    r'mBox:\s*\{[^}]*\}',
    "mBox: { backgroundColor: '#0f2438', borderRadius: 14, maxHeight: '92%', overflow: 'hidden', zIndex: 1000000, elevation: 1000000 }",
    c2)
print("✅ BoxesScreen z-index")

if c2 != orig2:
    open('BoxesScreen.tsx', 'w').write(c2)
    print("✅ BoxesScreen ذخیره شد")

PYEOF

# پاک کردن build و fresh build
echo ""
echo "▶ بیلد..."
rm -rf docs .expo node_modules/.cache
npx expo export --platform web --output-dir docs 2>&1 | tail -6

if [ ! -f "docs/index.html" ]; then
  echo "❌ بیلد نشد"
  exit 1
fi
echo "✅ بیلد موفق"

# پوش
sed -i 's|"/_expo|"/mizan/_expo|g; s|href="/favicon|href="/mizan/favicon|g' docs/index.html
touch docs/.nojekyll
git add -A
git add -f docs/
git commit -m "clean: all currencies everywhere, fixed box modals" 2>&1 | tail -2
git push -f 2>&1 | tail -3

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ تمام"
echo "  ⏱️ ۳ دقیقه صبر کن"
echo "  🌐 Incognito → Ctrl+Shift+R"
echo "═══════════════════════════════════════════"
