# -*- coding: utf-8 -*-
import io
s = io.open('App.tsx', 'r', encoding='utf-8').read()
orig = s

# ۱. حذف import ExchangeBell
s = s.replace("import ExchangeBell from './ExchangeBell';\n", "")
s = s.replace("import ExchangeBell from './ExchangeBell';", "")

# ۲. حذف render ExchangeBell
s = s.replace("{tab === 'exchange' && <ExchangeBell showToast={showToast} onBack={() => setTab('order')} />}\n", "")
s = s.replace("      {tab === 'exchange' && <ExchangeBell showToast={showToast} onBack={() => setTab('order')} />}", "")

# ۳. اضافه دکمه برگشت مستقیم در SafeAreaView (فقط برای صرافی)
# پیدا کردن آخرین </SafeAreaView>
last_idx = s.rfind("</SafeAreaView>")
if last_idx > 0:
    line_start = s.rfind('\n', 0, last_idx) + 1
    indent = s[line_start:last_idx]
    
    back_btn = (
        "      {tab === 'exchange' && (\n"
        "        <TouchableOpacity\n"
        "          onPress={() => setTab('order')}\n"
        "          style={{ position: 'absolute', bottom: 90, right: 14, width: 60, height: 60, borderRadius: 30, backgroundColor: '#7c3aed', borderWidth: 2, borderColor: '#d4af37', justifyContent: 'center', alignItems: 'center', zIndex: 9999, elevation: 10 }}\n"
        "        >\n"
        "          <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold', lineHeight: 30 }}>←</Text>\n"
        "        </TouchableOpacity>\n"
        "      )}\n"
    )
    s = s[:line_start] + back_btn + s[line_start:]

io.open('App.tsx', 'w', encoding='utf-8').write(s)
print("SAVED")