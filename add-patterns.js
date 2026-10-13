const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-patterns-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
['SmsMatchScreen.tsx', 'lib.sms.ts'].forEach(f => {
  if (fs.existsSync(f)) fs.copyFileSync(f, path.join(bdir, f));
});
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════════════════
// ۱. lib.sms.patterns.ts — الگوها + پارسر هوشمند
// ═══════════════════════════════════════════════════════
const patternsCode = `// lib.sms.patterns.ts — الگوهای پیامک بانکی + پارسر هوشمند
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@mizan_sms_patterns_v2';

export interface SmsPattern {
  id: string;
  name: string;
  bank: string;
  enabled: boolean;
  isBuiltIn: boolean;
  depositKeywords: string[];
  withdrawKeywords: string[];
  amountRegex?: string;
  senderMatch?: string;
}

export const BUILTIN_PATTERNS: SmsPattern[] = [
  // 🇦🇫 افغانستان
  { id: 'bi_af_melli', name: '🇦🇫 بانک ملی افغانستان', bank: 'AF', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش', 'بستانکار', 'credit', 'deposit', 'received', 'credited'],
    withdrawKeywords: ['برداشت', 'کسر', 'بدهکار', 'debit', 'withdraw', 'purchase', 'خرید'] },
  { id: 'bi_af_azizi', name: '🇦🇫 بانک عزیزی', bank: 'AF', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش', 'credited', 'deposited', 'بستانکار'],
    withdrawKeywords: ['برداشت', 'کسر', 'debited', 'withdrawn', 'بدهکار'] },
  { id: 'bi_af_aib', name: '🇦🇫 آی‌بی‌آی (AIB)', bank: 'AF', enabled: true, isBuiltIn: true,
    depositKeywords: ['credit', 'deposit', 'credited', 'received', 'واریز'],
    withdrawKeywords: ['debit', 'withdraw', 'debited', 'purchase', 'برداشت', 'خرید'] },
  { id: 'bi_af_maiwand', name: '🇦🇫 میوند بانک', bank: 'AF', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش'],
    withdrawKeywords: ['برداشت', 'کسر'] },
  { id: 'bi_af_ghazanfar', name: '🇦🇫 غضنفر بانک', bank: 'AF', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش'],
    withdrawKeywords: ['برداشت', 'کسر'] },
  { id: 'bi_af_noon', name: '🇦🇫 بانک نور', bank: 'AF', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش'],
    withdrawKeywords: ['برداشت', 'کسر'] },
  // 🇮🇷 ایران
  { id: 'bi_ir_melli', name: '🇮🇷 بانک ملی ایران', bank: 'IR', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش', 'بستانکار'],
    withdrawKeywords: ['برداشت', 'کسر', 'بدهکار', 'خرید'] },
  { id: 'bi_ir_saderat', name: '🇮🇷 بانک صادرات', bank: 'IR', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش', 'بستانکار'],
    withdrawKeywords: ['برداشت', 'کسر', 'بدهکار'] },
  { id: 'bi_ir_tejarat', name: '🇮🇷 بانک تجارت', bank: 'IR', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش'],
    withdrawKeywords: ['برداشت', 'کسر'] },
  { id: 'bi_ir_mellat', name: '🇮🇷 بانک ملت', bank: 'IR', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش'],
    withdrawKeywords: ['برداشت', 'کسر'] },
  { id: 'bi_ir_parsian', name: '🇮🇷 بانک پارسیان', bank: 'IR', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش'],
    withdrawKeywords: ['برداشت', 'کسر'] },
  { id: 'bi_ir_sepah', name: '🇮🇷 بانک سپه', bank: 'IR', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش'],
    withdrawKeywords: ['برداشت', 'کسر'] },
  { id: 'bi_ir_refah', name: '🇮🇷 بانک رفاه', bank: 'IR', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش'],
    withdrawKeywords: ['برداشت', 'کسر'] },
  // 🌍 عمومی
  { id: 'bi_generic', name: '🌍 تشخیص خودکار (عمومی)', bank: 'GEN', enabled: true, isBuiltIn: true,
    depositKeywords: ['واریز', 'افزایش', 'بستانکار', 'credit', 'deposit', 'received', 'credited', 'added'],
    withdrawKeywords: ['برداشت', 'کسر', 'بدهکار', 'debit', 'withdraw', 'purchase', 'خرید', 'debited', 'paid'] },
];

export async function getPatterns(): Promise<SmsPattern[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [...BUILTIN_PATTERNS];
    const custom: SmsPattern[] = JSON.parse(raw);
    const biMap = new Map(BUILTIN_PATTERNS.map(p => [p.id, p]));
    const merged: SmsPattern[] = [];
    const seen = new Set<string>();
    // اول built-in ها (با override)
    for (const bi of BUILTIN_PATTERNS) {
      const ov = custom.find(c => c.id === bi.id);
      merged.push(ov ? { ...bi, ...ov } : bi);
      seen.add(bi.id);
    }
    // بعد custom های جدید
    for (const c of custom) {
      if (!seen.has(c.id)) merged.push(c);
    }
    return merged;
  } catch { return [...BUILTIN_PATTERNS]; }
}

export async function savePattern(p: SmsPattern): Promise<void> {
  const all = await getPatterns();
  const idx = all.findIndex(x => x.id === p.id);
  if (idx >= 0) all[idx] = p;
  else all.push(p);
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}

export async function deletePattern(id: string): Promise<void> {
  const all = await getPatterns();
  const filtered = all.filter(x => x.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(filtered));
}

export async function resetPatterns(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

// ─── ابزار: تبدیل اعداد فارسی/عربی
export function normalizeDigits(s: string): string {
  return String(s || '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

// ─── استخراج همه اعداد
export function extractAllNumbers(text: string): number[] {
  const norm = normalizeDigits(text);
  const matches = norm.match(/\\d[\\d,]*(?:\\.\\d+)?/g) || [];
  return matches
    .map(m => Number(m.replace(/,/g, '')))
    .filter(n => !isNaN(n) && n > 0 && n < 1e15);
}

// ─── استخراج مبلغ هوشمند (نه شماره حساب)
export function smartExtractAmount(text: string): number | null {
  const norm = normalizeDigits(text);
  // الگوهای رایج مبلغ
  const amountPatterns = [
    /مبلغ[\\s:]+([\\d,]+(?:\\.\\d+)?)/i,
    /([\\d,]+(?:\\.\\d+)?)\\s*(?:افغانی|درهم|ریال|تومان|روپیه|دالر|USD|AFN|IRR|PKR)/i,
    /(?:AFN|USD|IRR|PKR|افغانی|ریال|تومان|دالر)[\\s:]+([\\d,]+(?:\\.\\d+)?)/i,
    /(?:credit|debit|deposit|withdraw|واریز|برداشت)[\\s:]+([\\d,]+(?:\\.\\d+)?)/i,
  ];
  for (const re of amountPatterns) {
    const m = norm.match(re);
    if (m && m[1]) {
      const n = Number(m[1].replace(/,/g, ''));
      if (!isNaN(n) && n > 0) return n;
    }
  }
  // fallback: بزرگترین عدد
  const all = extractAllNumbers(text);
  if (all.length === 0) return null;
  // حذف اعدادی که شبیه شماره کارت/حساب هستن (13+ رقم)
  const filtered = all.filter(n => String(n).length < 13);
  if (filtered.length === 0) return Math.max(...all);
  return Math.max(...filtered);
}

// ─── تشخیص نوع هوشمند
export function smartDetectType(text: string): 'deposit' | 'withdraw' | 'unknown' {
  const t = normalizeDigits(text).toLowerCase();
  const depWords = ['واریز', 'افزایش', 'بستانکار', 'credit', 'deposit', 'received', 'credited', 'added', 'دریافت'];
  const witWords = ['برداشت', 'کسر', 'بدهکار', 'debit', 'withdraw', 'purchase', 'خرید', 'debited', 'paid', 'پرداخت'];
  for (const k of witWords) if (t.includes(k)) return 'withdraw';
  for (const k of depWords) if (t.includes(k)) return 'deposit';
  return 'unknown';
}

// ─── تست پیامک با الگو
export interface ParseResult {
  matched: boolean;
  patternId?: string;
  patternName?: string;
  amount?: number;
  type?: 'deposit' | 'withdraw';
  confidence: number;
}

export async function parseSmsWithPatterns(text: string): Promise<ParseResult> {
  const patterns = (await getPatterns()).filter(p => p.enabled);
  const norm = normalizeDigits(text);
  const lower = norm.toLowerCase();

  let best: ParseResult | null = null;
  let bestScore = 0;

  for (const pat of patterns) {
    let score = 0;

    // ۱. کلمات کلیدی
    const depFound = pat.depositKeywords.some(k => lower.includes(k.toLowerCase()) || norm.includes(k));
    const witFound = pat.withdrawKeywords.some(k => lower.includes(k.toLowerCase()) || norm.includes(k));

    if (!depFound && !witFound) continue;

    const type: 'deposit' | 'withdraw' = depFound ? 'deposit' : 'withdraw';
    score += 10;

    // ۲. regex دقیق
    let amount: number | null = null;
    if (pat.amountRegex) {
      try {
        const m = norm.match(new RegExp(pat.amountRegex));
        if (m && m[1]) {
          amount = Number(m[1].replace(/,/g, ''));
          if (!isNaN(amount)) score += 30;
        }
      } catch {}
    }

    // ۳. heuristic مبلغ
    if (!amount) {
      amount = smartExtractAmount(text);
      if (amount) score += 15;
    }

    // ۴. طول پیام
    if (norm.length > 25) score += 5;

    // ۵. نام بانک در متن
    if (pat.bank !== 'GEN') {
      const bankTokens = pat.name.split(' ').filter(w => w.length > 3);
      for (const bt of bankTokens) {
        if (norm.includes(bt)) { score += 10; break; }
      }
    }

    if (amount && score > bestScore) {
      bestScore = score;
      best = {
        matched: true,
        patternId: pat.id,
        patternName: pat.name,
        amount,
        type,
        confidence: score,
      };
    }
  }

  // fallback
  if (!best) {
    const amount = smartExtractAmount(text);
    const type = smartDetectType(text);
    if (amount && type !== 'unknown') {
      return {
        matched: true,
        patternId: 'fallback',
        patternName: '🎯 تشخیص خودکار',
        amount,
        type,
        confidence: 5,
      };
    }
    return { matched: false, confidence: 0 };
  }

  return best;
}

// ─── تست سریع الگو (برای UI)
export function testPattern(pat: SmsPattern, sampleText: string): { ok: boolean; amount?: number; type?: string; reason?: string } {
  const norm = normalizeDigits(sampleText);
  const lower = norm.toLowerCase();
  const depFound = pat.depositKeywords.some(k => lower.includes(k.toLowerCase()) || norm.includes(k));
  const witFound = pat.withdrawKeywords.some(k => lower.includes(k.toLowerCase()) || norm.includes(k));
  if (!depFound && !witFound) return { ok: false, reason: 'هیچ کلمه کلیدی پیدا نشد' };
  const amount = smartExtractAmount(sampleText);
  if (!amount) return { ok: false, reason: 'مبلغ پیدا نشد' };
  return { ok: true, amount, type: depFound ? 'deposit' : 'withdraw' };
}
`;

fs.writeFileSync('lib.sms.patterns.ts', patternsCode, 'utf8');
console.log('✅ lib.sms.patterns.ts ساخته شد');

// ═══════════════════════════════════════════════════════
// ۲. UI: پنل مدیریت الگوها در SmsMatchScreen
// ═══════════════════════════════════════════════════════
let screen = fs.readFileSync('SmsMatchScreen.tsx', 'utf8');
const screenOrig = screen;
const wasCRLF = screen.includes('\r\n');
if (wasCRLF) screen = screen.replace(/\r\n/g, '\n');

// اضافه import
if (!screen.includes("from './lib.sms.patterns'")) {
  screen = screen.replace(
    "} from './lib.sms';",
    "} from './lib.sms';\nimport { SmsPattern, getPatterns, savePattern, deletePattern, resetPatterns, testPattern, BUILTIN_PATTERNS } from './lib.sms.patterns';"
  );
  console.log('✅ import patterns اضافه شد');
}

// اضافه state
if (!screen.includes('patternsModal')) {
  screen = screen.replace(
    "const [detailTx, setDetailTx] = useState<any>(null);",
    "const [detailTx, setDetailTx] = useState<any>(null);\n  const [patternsModal, setPatternsModal] = useState(false);\n  const [patterns, setPatterns] = useState<any[]>([]);\n  const [editingPattern, setEditingPattern] = useState<any>(null);\n  const [testSms, setTestSms] = useState('');\n  const [testResult, setTestResult] = useState<any>(null);"
  );
  console.log('✅ state patterns اضافه شد');
}

// بارگذاری الگوها در load
if (!screen.includes('setPatterns(await getPatterns())')) {
  screen = screen.replace(
    "const list = await getTransactions();\n    setTxs(list);\n    setLoading(false);",
    "const list = await getTransactions();\n    setTxs(list);\n    setPatterns(await getPatterns());\n    setLoading(false);"
  );
  console.log('✅ بارگذاری الگوها اضافه شد');
}

// اضافه دکمه الگوها در actionsRow
if (!screen.includes('📋 الگوها')) {
  screen = screen.replace(
    '<Text style={s.btnTxt}>⚙️ تنظیمات</Text>',
    '<Text style={s.btnTxt}>⚙️ تنظیمات</Text>'
  );
  // اضافه دکمه سوم
  screen = screen.replace(
    `          <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b' }]} onPress={() => setSettingsModal(true)}>
              <Text style={s.btnTxt}>⚙️ تنظیمات</Text>
            </TouchableOpacity>`,
    `          <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed' }]} onPress={() => setPatternsModal(true)}>
              <Text style={s.btnTxt}>📋 الگوها</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: '#64748b' }]} onPress={() => setSettingsModal(true)}>
              <Text style={s.btnTxt}>⚙️ تنظیمات</Text>
            </TouchableOpacity>`
  );
  console.log('✅ دکمه الگوها اضافه شد');
}

// اضافه Modal مدیریت الگوها قبل از آخرین </View>
const patternsModal = `
      {/* Patterns Modal */}
      <Modal visible={patternsModal} transparent animationType="slide" onRequestClose={() => setPatternsModal(false)}>
        <View style={s.mBg}>
          <View style={s.mBox}>
            <View style={s.mHead}>
              <Text style={s.mTitle}>📋 الگوهای پیامک</Text>
              <TouchableOpacity onPress={() => setPatternsModal(false)}><Text style={s.x}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 12 }}>
              <Text style={s.mLbl}>✅ الگوهای فعال (روی هر کدام بزنید تا غیرفعال شود):</Text>
              {patterns.map((p: any) => (
                <TouchableOpacity
                  key={p.id}
                  style={[s.candBox, { borderColor: p.enabled ? '#059669' : '#475569', opacity: p.enabled ? 1 : 0.5 }]}
                  onPress={async () => {
                    const updated = { ...p, enabled: !p.enabled };
                    await savePattern(updated);
                    setPatterns(await getPatterns());
                  }}
                >
                  <Text style={s.candName}>{p.name}</Text>
                  <Text style={s.candInv}>
                    {p.enabled ? '🟢 فعال' : '⚪ غیرفعال'} — {p.bank === 'GEN' ? '🌍 عمومی' : p.bank}
                  </Text>
                  <View style={{ flexDirection: 'row-reverse', marginTop: 6, gap: 6 }}>
                    <TouchableOpacity
                      style={{ backgroundColor: '#0891b2', padding: 6, borderRadius: 6 }}
                      onPress={() => { setEditingPattern({ ...p }); setTestSms(''); setTestResult(null); }}
                    >
                      <Text style={{ color: '#fff', fontSize: 11 }}>✏️ ویرایش</Text>
                    </TouchableOpacity>
                    {!p.isBuiltIn && (
                      <TouchableOpacity
                        style={{ backgroundColor: '#dc2626', padding: 6, borderRadius: 6 }}
                        onPress={async () => {
                          await deletePattern(p.id);
                          setPatterns(await getPatterns());
                          showToast?.('🗑 حذف شد');
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 11 }}>🗑 حذف</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[s.btn, { backgroundColor: '#059669', marginTop: 12 }]}
                onPress={() => {
                  setEditingPattern({
                    id: 'custom_' + Date.now(),
                    name: '🏦 الگوی جدید من',
                    bank: 'CUSTOM',
                    enabled: true,
                    isBuiltIn: false,
                    depositKeywords: ['واریز', 'افزایش', 'بستانکار'],
                    withdrawKeywords: ['برداشت', 'کسر', 'بدهکار'],
                  });
                  setTestSms('');
                  setTestResult(null);
                }}
              >
                <Text style={s.btnTxt}>➕ افزودن الگوی جدید</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.btn, { backgroundColor: '#dc2626', marginTop: 8 }]}
                onPress={async () => {
                  await resetPatterns();
                  setPatterns(await getPatterns());
                  showToast?.('🔄 به پیش‌فرض برگشت');
                }}
              >
                <Text style={s.btnTxt}>🔄 بازگشت به پیش‌فرض</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Pattern Modal */}
      <Modal visible={!!editingPattern} transparent animationType="slide" onRequestClose={() => setEditingPattern(null)}>
        <View style={s.mBg}>
          <View style={s.mBox}>
            <View style={s.mHead}>
              <Text style={s.mTitle}>✏️ ویرایش الگو</Text>
              <TouchableOpacity onPress={() => setEditingPattern(null)}><Text style={s.x}>×</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 12 }}>
              <Text style={s.mLbl}>📝 نام الگو</Text>
              <TextInput
                style={s.inp}
                value={editingPattern?.name || ''}
                onChangeText={(v) => setEditingPattern({ ...editingPattern, name: v })}
                placeholder="مثلاً: بانک ملی افغانستان"
                placeholderTextColor="#64748b"
              />

              <Text style={s.mLbl}>💰 کلمات واریز (با کاما جدا کنید)</Text>
              <TextInput
                style={s.inp}
                value={(editingPattern?.depositKeywords || []).join('، ')}
                onChangeText={(v) => setEditingPattern({ ...editingPattern, depositKeywords: v.split(/[،,]/).map(x => x.trim()).filter(Boolean) })}
                placeholder="واریز، افزایش، بستانکار"
                placeholderTextColor="#64748b"
              />

              <Text style={s.mLbl}>💸 کلمات برداشت (با کاما جدا کنید)</Text>
              <TextInput
                style={s.inp}
                value={(editingPattern?.withdrawKeywords || []).join('، ')}
                onChangeText={(v) => setEditingPattern({ ...editingPattern, withdrawKeywords: v.split(/[،,]/).map(x => x.trim()).filter(Boolean) })}
                placeholder="برداشت، کسر، بدهکار"
                placeholderTextColor="#64748b"
              />

              <Text style={s.mLbl}>🧪 تست الگو — یک پیامک نمونه پیست کنید:</Text>
              <TextInput
                style={[s.inp, { minHeight: 70, textAlignVertical: 'top' }]}
                value={testSms}
                onChangeText={setTestSms}
                placeholder="مبلغ ۵۰۰۰ افغانی از حساب شما برداشت شد"
                placeholderTextColor="#64748b"
                multiline
              />

              <TouchableOpacity
                style={[s.btn, { backgroundColor: '#0891b2', marginTop: 8 }]}
                onPress={() => {
                  if (!editingPattern || !testSms) return;
                  const r = testPattern(editingPattern, testSms);
                  setTestResult(r);
                }}
              >
                <Text style={s.btnTxt}>🔍 تست</Text>
              </TouchableOpacity>

              {testResult && (
                <View style={[s.candBox, { borderColor: testResult.ok ? '#059669' : '#dc2626', marginTop: 8 }]}>
                  <Text style={s.candName}>{testResult.ok ? '✅ موفق' : '❌ خطا'}</Text>
                  {testResult.ok ? (
                    <>
                      <Text style={s.candAmt}>💰 مبلغ: {testResult.amount}</Text>
                      <Text style={s.candInv}>📊 نوع: {testResult.type === 'deposit' ? 'واریز' : 'برداشت'}</Text>
                    </>
                  ) : (
                    <Text style={s.candInv}>⚠️ {testResult.reason}</Text>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={[s.btn, { backgroundColor: '#059669', marginTop: 14 }]}
                onPress={async () => {
                  await savePattern(editingPattern);
                  setPatterns(await getPatterns());
                  setEditingPattern(null);
                  showToast?.('✅ ذخیره شد');
                }}
              >
                <Text style={s.btnTxt}>💾 ذخیره</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.btn, { backgroundColor: '#64748b', marginTop: 8 }]}
                onPress={() => setEditingPattern(null)}
              >
                <Text style={s.btnTxt}>❌ لغو</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
`;

// اضافه قبل از آخرین </View>
const lastViewIdx = screen.lastIndexOf('</View>');
const beforeLastView = screen.lastIndexOf('</View>', lastViewIdx - 1);
if (beforeLastView > 0) {
  screen = screen.substring(0, beforeLastView) + patternsModal + '\n    ' + screen.substring(beforeLastView);
  console.log('✅ Modal الگوها اضافه شد');
}

if (wasCRLF) screen = screen.replace(/\n/g, '\r\n');
if (screen !== screenOrig) {
  fs.writeFileSync('SmsMatchScreen.tsx', screen, 'utf8');
  console.log('💾 SmsMatchScreen.tsx ذخیره شد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی:');
console.log('   copy /Y "' + bdir + '\\SmsMatchScreen.tsx" SmsMatchScreen.tsx');
console.log('   copy /Y "' + bdir + '\\lib.sms.ts" lib.sms.ts');
console.log('   del lib.sms.patterns.ts');