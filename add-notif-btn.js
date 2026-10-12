const fs = require('fs');
let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const orig = s;

// الگوی دقیق: بعد از Text تاریخ، قبل از </View> کارت
const oldBlock = `                  <Text style={{ color: '#94a3b8', fontSize: 10, textAlign: 'right', marginTop: 4 }}>
                    {n.created_at ? new Date(n.created_at).toLocaleString('fa-IR') : ''}
                  </Text>
                </View>
              );`;

const newBlock = `                  <Text style={{ color: '#94a3b8', fontSize: 10, textAlign: 'right', marginTop: 4 }}>
                    {n.created_at ? new Date(n.created_at).toLocaleString('fa-IR') : ''}
                  </Text>
                  {(p.from_email || p.fromEmail) ? (
                    <TouchableOpacity
                      onPress={() => openChatFromNotif(n)}
                      style={{ marginTop: 10, backgroundColor: '#0891b2', paddingVertical: 8, borderRadius: 8, alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'center', gap: 6 }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>💬 پیام</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );`;

if (s.includes(oldBlock)) {
  s = s.replace(oldBlock, newBlock);
  fs.writeFileSync('LiveMarketScreen.tsx', s, 'utf8');
  console.log('✅ دکمه 💬 پیام اضافه شد به هر اعلان');
  console.log('💾 ذخیره شد');
} else {
  console.log('⚠️ الگو پیدا نشد — دنبال الگوی جایگزین...');
  // جستجوی انعطاف‌پذیر
  const re = /(<Text style=\{\{\s*color:\s*'#94a3b8',\s*fontSize:\s*10,\s*textAlign:\s*'right',\s*marginTop:\s*4\s*\}\}>\s*\{n\.created_at[^}]+\}\s*<\/Text>\s*)(<\/View>\s*\)\;)/;
  if (re.test(s)) {
    s = s.replace(re, `$1<TouchableOpacity onPress={() => openChatFromNotif(n)} style={{ marginTop: 10, backgroundColor: '#0891b2', paddingVertical: 8, borderRadius: 8, alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'center', gap: 6 }} activeOpacity={0.8}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>💬 پیام</Text>
                  </TouchableOpacity>
                $2`);
    fs.writeFileSync('LiveMarketScreen.tsx', s, 'utf8');
    console.log('✅ دکمه 💬 پیام اضافه شد (regex)');
    console.log('💾 ذخیره شد');
  } else {
    console.log('❌ regex هم پیدا نشد');
  }
}