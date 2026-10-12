# -*- coding: utf-8 -*-
import io

s = io.open('App.tsx', 'r', encoding='utf-8').read()
orig = s

# ═══════════════════════════════════════════
# ۱. wrap تب‌ها — مخفی در صرافی + بازار
# ═══════════════════════════════════════════
start_marker = "      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.tabsBar,"
start_idx = s.find(start_marker)

if start_idx < 0:
    print("X start not found")
    exit(1)

# پیدا کردن انتهای ScrollView که بعدش View key="tab- هست
end_marker = "</ScrollView>\n      <View key={`tab-"
end_idx = s.find(end_marker, start_idx)

if end_idx < 0:
    # شاید CRLF باشه
    end_marker = "</ScrollView>\r\n      <View key={`tab-"
    end_idx = s.find(end_marker, start_idx)
    if end_idx < 0:
        print("X end not found")
        exit(1)
    end_of_block = end_idx + len("</ScrollView>")
else:
    end_of_block = end_idx + len("</ScrollView>")

block = s[start_idx:end_of_block]
wrapped = "{tab !== 'exchange' && tab !== 'publicMarket' && (\n" + block + "\n      )}"

s = s[:start_idx] + wrapped + s[end_of_block:]
print("OK tabs wrapped")

# ═══════════════════════════════════════════
# ۲. پاس onBack به PublicMarketScreen
# ═══════════════════════════════════════════
old_pm = "{tab === 'publicMarket' && <PublicMarketScreen showToast={showToast} />}"
new_pm = "{tab === 'publicMarket' && <PublicMarketScreen showToast={showToast} onBack={() => setTab('order')} />}"

if old_pm in s:
    s = s.replace(old_pm, new_pm)
    print("OK onBack به PublicMarketScreen پاس شد")
else:
    print("-- PublicMarketScreen قبلا پاس شده یا پیدا نشد")

# ═══════════════════════════════════════════
# ۳. اضافه ExchangeBell (دکمه برگشت + زنگ) در MainApp
# ═══════════════════════════════════════════
if "<ExchangeBell" not in s:
    # پیدا کردن render PublicMarketScreen
    idx = s.find("{tab === 'publicMarket' && <PublicMarketScreen")
    if idx < 0:
        idx = s.find("{tab === 'expenses'")
    
    if idx > 0:
        line_start = s.rfind('\n', 0, idx) + 1
        indent = s[line_start:idx]
        insert = indent + "{tab === 'exchange' && <ExchangeBell showToast={showToast} onBack={() => setTab('order')} />}\n"
        s = s[:line_start] + insert + s[line_start:]
        print("OK ExchangeBell اضافه شد")
    else:
        print("X محل اضافه پیدا نشد")
else:
    print("-- ExchangeBell از قبل هست")

# ═══════════════════════════════════════════
# ذخیره
# ═══════════════════════════════════════════
io.open('App.tsx', 'w', encoding='utf-8').write(s)
print("SAVED")