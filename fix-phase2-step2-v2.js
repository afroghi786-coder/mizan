const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════
// ۰. بکاپ
// ═══════════════════════════════════════════
const bdir = 'backup-before-phase2-step2-v2-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('LiveMarketScreen.tsx', path.join(bdir, 'LiveMarketScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

// ═══════════════════════════════════════════
// ۱. مودال عمومی — فیلدهای جدید
// ═══════════════════════════════════════════
console.log('═══ مودال حواله عمومی ═══');

const hSubmitMarker = "onPress={submitHawala}";
const hSubmitIdx = s.indexOf(hSubmitMarker);
if (hSubmitIdx < 0) {
  console.log('❌ submitHawala پیدا نشد');
  process.exit(1);
}
console.log('✅ submitHawala در موقعیت ' + hSubmitIdx);

// آخرین <TouchableOpacity قبل از submitHawala
const hBtnStart = s.lastIndexOf('<TouchableOpacity', hSubmitIdx);
console.log('✅ دکمه submit عمومی در موقعیت ' + hBtnStart);

// پیدا کردن آخرین </View> قبل از دکمه (که انتهای بخش input هاست)
// در واقع ما می‌خوایم قبل از دکمه، فیلدها رو اضافه کنیم
// اما باید ببینیم آیا داخل یه parent View هستیم یا نه
// ساده‌ترین: مستقیم قبل از دکمه اضافه می‌کنیم

const hFields = `{/* ═══ اطلاعات فرستنده (جدید) ═══ */}
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

s = s.substring(0, hBtnStart) + hFields + s.substring(hBtnStart);
console.log('✅ فیلدهای جدید به مودال عمومی اضافه شد');

// ═══════════════════════════════════════════
// ۲. مودال خصوصی — فیلدهای جدید
// ═══════════════════════════════════════════
console.log('');
console.log('═══ مودال حواله خصوصی ═══');

const dSubmitMarker = "onPress={submitDirect}";
const dSubmitIdx = s.indexOf(dSubmitMarker);
if (dSubmitIdx < 0) {
  console.log('❌ submitDirect پیدا نشد');
  process.exit(1);
}
console.log('✅ submitDirect در موقعیت ' + dSubmitIdx);

const dBtnStart = s.lastIndexOf('<TouchableOpacity', dSubmitIdx);
console.log('✅ دکمه submit خصوصی در موقعیت ' + dBtnStart);

const dFields = `{/* ═══ اطلاعات فرستنده (جدید) ═══ */}
                <Text style={[s.lbl, { color: '#0891b2', marginTop: 14, fontWeight: 'bold' }]}>👤 اطلاعات فرستنده</Text>
                <TextInput value={directForm.sender_name || ''} onChangeText={v => setDirectForm({ ...directForm, sender_name: v })} placeholder="نام فرستنده" placeholderTextColor="#64748b" style={s.inp} />
                <TextInput value={directForm.sender_phone || ''} onChangeText={v => setDirectForm({ ...directForm, sender_phone: v })} placeholder="تلفن فرستنده" placeholderTextColor="#64748b" style={s.inp} keyboardType="phone-pad" />
                <TextInput value={directForm.sender_city || ''} onChangeText={v => setDirectForm({ ...directForm, sender_city: v })} placeholder="شهر فرستنده" placeholderTextColor="#64748b" style={s.inp} />
                <TextInput value={directForm.sender_address || ''} onChangeText={v => setDirectForm({ ...directForm, sender_address: v })} placeholder="آدرس فرستنده" placeholderTextColor="#64748b" style={s.inp} />

                {/* ═══ اطلاعات ذی‌نفع تکمیلی (جدید) ═══ */}
                <Text style={[s.lbl, { color: '#0891b2', marginTop: 14, fontWeight: 'bold' }]}>👤 اطلاعات ذی‌نفع تکمیلی</Text>
                <TextInput value={directForm.beneficiary_city || ''} onChangeText={v => setDirectForm({ ...directForm, beneficiary_city: v })} placeholder="شهر ذی‌نفع" placeholderTextColor="#64748b" style={s.inp} />
                <TextInput value={directForm.beneficiary_bank || ''} onChangeText={v => setDirectForm({ ...directForm, beneficiary_bank: v })} placeholder="نام بانک ذی‌نفع" placeholderTextColor="#64748b" style={s.inp} />
                <TextInput value={directForm.beneficiary_holder || ''} onChangeText={v => setDirectForm({ ...directForm, beneficiary_holder: v })} placeholder="شماره حساب ذی‌نفع" placeholderTextColor="#64748b" style={s.inp} />

                {/* ═══ مالی تکمیلی (جدید) ═══ */}
                <Text style={[s.lbl, { color: '#0891b2', marginTop: 14, fontWeight: 'bold' }]}>💰 مالی تکمیلی</Text>
                <TextInput value={directForm.to_amount || ''} onChangeText={v => setDirectForm({ ...directForm, to_amount: v })} placeholder="مبلغ دریافتی" placeholderTextColor="#64748b" style={s.inp} keyboardType="numeric" />
                <TextInput value={directForm.rate || ''} onChangeText={v => setDirectForm({ ...directForm, rate: v })} placeholder="نرخ تبدیل" placeholderTextColor="#64748b" style={s.inp} keyboardType="numeric" />
                <TextInput value={directForm.commission_percent || ''} onChangeText={v => setDirectForm({ ...directForm, commission_percent: v })} placeholder="درصد کمیسیون" placeholderTextColor="#64748b" style={s.inp} keyboardType="numeric" />

                `;

s = s.substring(0, dBtnStart) + dFields + s.substring(dBtnStart);
console.log('✅ فیلدهای جدید به مودال خصوصی اضافه شد');

// ═══════════════════════════════════════════
// ۳. ذخیره
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