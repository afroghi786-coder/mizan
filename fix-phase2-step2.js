const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
// ۰. بکاپ
// ═══════════════════════════════════════════
const bdir = 'backup-before-phase2-step2-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('LiveMarketScreen.tsx', path.join(bdir, 'LiveMarketScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

// ═══════════════════════════════════════════
// ۱. پیدا کردن مودال خصوصی
// ═══════════════════════════════════════════
console.log('═══ مودال حواله خصوصی ═══');

// دنبال هدر مودال بگرد
const dHeaderPatterns = [
  '🔒 حواله خصوصی</Text>',
  '>🔒 حواله خصوصی<',
  "مودال حواله خصوصی",
];
let dHeaderIdx = -1;
let dHeaderFound = '';
for (const pat of dHeaderPatterns) {
  const idx = s.indexOf(pat);
  if (idx > 0) { dHeaderIdx = idx; dHeaderFound = pat; break; }
}

if (dHeaderIdx < 0) {
  console.log('❌ هدر مودال خصوصی پیدا نشد');
  console.log('   دنبال: 🔒 حواله خصوصی');
  process.exit(1);
}
console.log('✅ هدر پیدا شد: "' + dHeaderFound + '" (موقعیت ' + dHeaderIdx + ')');

// آخرین <Modal> قبل از هدر
const dModalStart = s.lastIndexOf('<Modal', dHeaderIdx);
if (dModalStart < 0) {
  console.log('❌ <Modal شروع پیدا نشد');
  process.exit(1);
}

// اولین </Modal> بعد از هدر
const dModalEnd = s.indexOf('</Modal>', dHeaderIdx);
if (dModalEnd < 0) {
  console.log('❌ </Modal> پایان پیدا نشد');
  process.exit(1);
}
console.log('✅ مودال خصوصی: از ' + dModalStart + ' تا ' + dModalEnd);

// دنبال submitDirect بگرد داخل این بخش
const dSection = s.substring(dModalStart, dModalEnd);
const dSubmitIdx = dSection.indexOf('submitDirect');
if (dSubmitIdx < 0) {
  console.log('❌ submitDirect پیدا نشد داخل مودال');
  process.exit(1);
}
console.log('✅ submitDirect داخل مودال پیدا شد');

// TouchableOpacity که submitDirect رو صدا می‌زنه
const dSubmitAbs = dModalStart + dSubmitIdx;
const dBtnStart = s.lastIndexOf('<TouchableOpacity', dSubmitAbs);
if (dBtnStart < dModalStart) {
  console.log('❌ دکمه submit پیدا نشد');
  process.exit(1);
}
console.log('✅ دکمه submit در موقعیت ' + dBtnStart);

// ═══════════════════════════════════════════
// ۲. فیلدهای جدید برای فرم خصوصی
// ═══════════════════════════════════════════
const dNewFields = `{/* ═══ اطلاعات فرستنده (جدید) ═══ */}
                  <Text style={[s.lbl, { color: '#f59e0b', marginTop: 14, fontWeight: 'bold' }]}>👤 اطلاعات فرستنده</Text>
                  <TextInput value={directForm.sender_name || ''} onChangeText={v => setDirectForm({ ...directForm, sender_name: v })} placeholder="نام فرستنده" placeholderTextColor="#64748b" style={s.inp} />
                  <TextInput value={directForm.sender_phone || ''} onChangeText={v => setDirectForm({ ...directForm, sender_phone: v })} placeholder="تلفن فرستنده" placeholderTextColor="#64748b" style={s.inp} keyboardType="phone-pad" />
                  <TextInput value={directForm.sender_city || ''} onChangeText={v => setDirectForm({ ...directForm, sender_city: v })} placeholder="شهر فرستنده" placeholderTextColor="#64748b" style={s.inp} />
                  <TextInput value={directForm.sender_address || ''} onChangeText={v => setDirectForm({ ...directForm, sender_address: v })} placeholder="آدرس فرستنده" placeholderTextColor="#64748b" style={s.inp} />

                  {/* ═══ اطلاعات ذی‌نفع تکمیلی (جدید) ═══ */}
                  <Text style={[s.lbl, { color: '#f59e0b', marginTop: 14, fontWeight: 'bold' }]}>👤 اطلاعات ذی‌نفع تکمیلی</Text>
                  <TextInput value={directForm.beneficiary_city || ''} onChangeText={v => setDirectForm({ ...directForm, beneficiary_city: v })} placeholder="شهر ذی‌نفع" placeholderTextColor="#64748b" style={s.inp} />
                  <TextInput value={directForm.beneficiary_bank || ''} onChangeText={v => setDirectForm({ ...directForm, beneficiary_bank: v })} placeholder="نام بانک ذی‌نفع" placeholderTextColor="#64748b" style={s.inp} />
                  <TextInput value={directForm.beneficiary_holder || ''} onChangeText={v => setDirectForm({ ...directForm, beneficiary_holder: v })} placeholder="شماره حساب ذی‌نفع" placeholderTextColor="#64748b" style={s.inp} />

                  {/* ═══ مالی تکمیلی (جدید) ═══ */}
                  <Text style={[s.lbl, { color: '#f59e0b', marginTop: 14, fontWeight: 'bold' }]}>💰 مالی تکمیلی</Text>
                  <TextInput value={directForm.to_amount || ''} onChangeText={v => setDirectForm({ ...directForm, to_amount: v })} placeholder="مبلغ دریافتی" placeholderTextColor="#64748b" style={s.inp} keyboardType="numeric" />
                  <TextInput value={directForm.rate || ''} onChangeText={v => setDirectForm({ ...directForm, rate: v })} placeholder="نرخ تبدیل" placeholderTextColor="#64748b" style={s.inp} keyboardType="numeric" />
                  <TextInput value={directForm.commission_percent || ''} onChangeText={v => setDirectForm({ ...directForm, commission_percent: v })} placeholder="درصد کمیسیون" placeholderTextColor="#64748b" style={s.inp} keyboardType="numeric" />

                  `;

// اضافه قبل از دکمه submit
s = s.substring(0, dBtnStart) + dNewFields + s.substring(dBtnStart);
console.log('✅ فیلدهای جدید به مودال خصوصی اضافه شد');

// ═══════════════════════════════════════════
// ۳. مودال عمومی
// ═══════════════════════════════════════════
console.log('');
console.log('═══ مودال حواله عمومی ═══');

const hHeaderPatterns = [
  '📤 حواله عمومی</Text>',
  '>📤 حواله عمومی<',
  'مودال حواله عمومی',
];
let hHeaderIdx = -1;
let hHeaderFound = '';
for (const pat of hHeaderPatterns) {
  const idx = s.indexOf(pat);
  if (idx > 0) { hHeaderIdx = idx; hHeaderFound = pat; break; }
}

if (hHeaderIdx < 0) {
  console.log('❌ هدر مودال عمومی پیدا نشد');
  console.log('   دنبال: 📤 حواله عمومی');
  process.exit(1);
}
console.log('✅ هدر پیدا شد: "' + hHeaderFound + '" (موقعیت ' + hHeaderIdx + ')');

const hModalStart = s.lastIndexOf('<Modal', hHeaderIdx);
const hModalEnd = s.indexOf('</Modal>', hHeaderIdx);
console.log('✅ مودال عمومی: از ' + hModalStart + ' تا ' + hModalEnd);

// دنبال submitHawala بگرد
const hSection = s.substring(hModalStart, hModalEnd);
const hSubmitIdx = hSection.indexOf('submitHawala');
if (hSubmitIdx < 0) {
  console.log('❌ submitHawala پیدا نشد داخل مودال');
  process.exit(1);
}
console.log('✅ submitHawala داخل مودال پیدا شد');

const hSubmitAbs = hModalStart + hSubmitIdx;
const hBtnStart = s.lastIndexOf('<TouchableOpacity', hSubmitAbs);
if (hBtnStart < hModalStart) {
  console.log('❌ دکمه submit عمومی پیدا نشد');
  process.exit(1);
}
console.log('✅ دکمه submit عمومی در موقعیت ' + hBtnStart);

// ═══════════════════════════════════════════
// ۴. فیلدهای جدید برای فرم عمومی
// ═══════════════════════════════════════════
const hNewFields = `{/* ═══ اطلاعات فرستنده (جدید) ═══ */}
                  <Text style={[s.lbl, { color: '#f59e0b', marginTop: 14, fontWeight: 'bold' }]}>👤 اطلاعات فرستنده</Text>
                  <TextInput value={hawalaForm.sender_name || ''} onChangeText={v => setHawalaForm({ ...hawalaForm, sender_name: v })} placeholder="نام فرستنده" placeholderTextColor="#64748b" style={s.inp} />
                  <TextInput value={hawalaForm.sender_phone || ''} onChangeText={v => setHawalaForm({ ...hawalaForm, sender_phone: v })} placeholder="تلفن فرستنده" placeholderTextColor="#64748b" style={s.inp} keyboardType="phone-pad" />
                  <TextInput value={hawalaForm.sender_city || ''} onChangeText={v => setHawalaForm({ ...hawalaForm, sender_city: v })} placeholder="شهر فرستنده" placeholderTextColor="#64748b" style={s.inp} />
                  <TextInput value={hawalaForm.sender_address || ''} onChangeText={v => setHawalaForm({ ...hawalaForm, sender_address: v })} placeholder="آدرس فرستنده" placeholderTextColor="#64748b" style={s.inp} />

                  {/* ═══ اطلاعات ذی‌نفع تکمیلی (جدید) ═══ */}
                  <Text style={[s.lbl, { color: '#f59e0b', marginTop: 14, fontWeight: 'bold' }]}>👤 اطلاعات ذی‌نفع تکمیلی</Text>
                  <TextInput value={hawalaForm.beneficiary_city || ''} onChangeText={v => setHawalaForm({ ...hawalaForm, beneficiary_city: v })} placeholder="شهر ذی‌نفع" placeholderTextColor="#64748b" style={s.inp} />
                  <TextInput value={hawalaForm.beneficiary_bank || ''} onChangeText={v => setHawalaForm({ ...hawalaForm, beneficiary_bank: v })} placeholder="نام بانک ذی‌نفع" placeholderTextColor="#64748b" style={s.inp} />
                  <TextInput value={hawalaForm.beneficiary_holder || ''} onChangeText={v => setHawalaForm({ ...hawalaForm, beneficiary_holder: v })} placeholder="شماره حساب ذی‌نفع" placeholderTextColor="#64748b" style={s.inp} />

                  {/* ═══ مالی تکمیلی (جدید) ═══ */}
                  <Text style={[s.lbl, { color: '#f59e0b', marginTop: 14, fontWeight: 'bold' }]}>💰 مالی تکمیلی</Text>
                  <TextInput value={hawalaForm.to_amount || ''} onChangeText={v => setHawalaForm({ ...hawalaForm, to_amount: v })} placeholder="مبلغ دریافتی" placeholderTextColor="#64748b" style={s.inp} keyboardType="numeric" />

                  `;

s = s.substring(0, hBtnStart) + hNewFields + s.substring(hBtnStart);
console.log('✅ فیلدهای جدید به مودال عمومی اضافه شد');

// ═══════════════════════════════════════════
// ۵. ذخیره
// ═══════════════════════════════════════════
if (wasCRLF) s = s.replace(/\n/g, '\r\n');

if (s !== sOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', s, 'utf8');
  console.log('');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
} else {
  console.log('');
  console.log('ℹ️ تغییری نکرد');
}

console.log('');
console.log('✅ قدم ۲.۲ تمام');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');