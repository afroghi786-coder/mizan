const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-phase2-step1-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('LiveMarketScreen.tsx', path.join(bdir, 'LiveMarketScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const sOrig = s;
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

// ═══════════════════════════════════════════
// ۱. directForm — initial state
// ═══════════════════════════════════════════
const dfOld = `const [directForm, setDirectForm] = useState<any>({ toEmail: '', toName: '', currency: 'USD', targetCurrency: 'AFN', rateMode: 'same', rate: '', amount: '', beneficiaryName: '', beneficiaryPhone: '', commission: '', note: '' });`;

const dfNew = `const [directForm, setDirectForm] = useState<any>({
    // 👤 صراف مقصد
    toEmail: '', toName: '',
    // 👤 فرستنده
    sender_name: '', sender_phone: '', sender_address: '', sender_city: '',
    // 👤 ذی‌نفع
    beneficiaryName: '', beneficiaryPhone: '',
    beneficiary_city: '', beneficiary_bank: '', beneficiary_holder: '',
    // 💰 مالی
    currency: 'USD', targetCurrency: 'AFN', rateMode: 'same', rate: '',
    amount: '', to_amount: '',
    commission: '', commission_percent: '',
    // 📝 یادداشت
    note: '',
  });`;

if (s.includes(dfOld)) {
  s = s.replace(dfOld, dfNew);
  console.log('✅ directForm initial state آپدیت شد');
} else {
  console.log('⚠️ directForm initial پیدا نشد');
}

// ═══════════════════════════════════════════
// ۲. hawalaForm — initial state
// ═══════════════════════════════════════════
const hfOld = `const [hawalaForm, setHawalaForm] = useState<any>({ targetCity: 'HRT', currency: 'USD', amount: '', beneficiaryName: '', beneficiaryPhone: '', maxFee: '2', expires: '15', note: '' });`;

const hfNew = `const [hawalaForm, setHawalaForm] = useState<any>({
    // 🎯 مقصد
    targetCity: 'HRT',
    // 👤 فرستنده
    sender_name: '', sender_phone: '', sender_address: '', sender_city: '',
    // 👤 ذی‌نفع
    beneficiaryName: '', beneficiaryPhone: '',
    beneficiary_city: '', beneficiary_bank: '', beneficiary_holder: '',
    // 💰 مالی
    currency: 'USD', amount: '', to_amount: '',
    maxFee: '2', expires: '15',
    // 📝 یادداشت
    note: '',
  });`;

if (s.includes(hfOld)) {
  s = s.replace(hfOld, hfNew);
  console.log('✅ hawalaForm initial state آپدیت شد');
} else {
  console.log('⚠️ hawalaForm initial پیدا نشد');
}

// ═══════════════════════════════════════════
// ۳. directForm — reset (بعد از ارسال)
// ═══════════════════════════════════════════
const dfResetOld = `setDirectForm({ toEmail: '', toName: '', currency: 'USD', amount: '', beneficiaryName: '', beneficiaryPhone: '', commission: '', note: '' });`;

const dfResetNew = `setDirectForm({
        toEmail: '', toName: '',
        sender_name: '', sender_phone: '', sender_address: '', sender_city: '',
        beneficiaryName: '', beneficiaryPhone: '',
        beneficiary_city: '', beneficiary_bank: '', beneficiary_holder: '',
        currency: 'USD', targetCurrency: 'AFN', rateMode: 'same', rate: '',
        amount: '', to_amount: '',
        commission: '', commission_percent: '',
        note: '',
      });`;

if (s.includes(dfResetOld)) {
  s = s.replace(dfResetOld, dfResetNew);
  console.log('✅ directForm reset آپدیت شد');
} else {
  console.log('⚠️ directForm reset پیدا نشد');
}

// ═══════════════════════════════════════════
// ۴. hawalaForm — reset (بعد از ارسال)
// ═══════════════════════════════════════════
const hfResetOld = `setHawalaForm({ targetCity: 'HRT', currency: 'USD', amount: '', beneficiaryName: '', beneficiaryPhone: '', maxFee: '2', expires: '15', note: '' });`;

const hfResetNew = `setHawalaForm({
        targetCity: 'HRT',
        sender_name: '', sender_phone: '', sender_address: '', sender_city: '',
        beneficiaryName: '', beneficiaryPhone: '',
        beneficiary_city: '', beneficiary_bank: '', beneficiary_holder: '',
        currency: 'USD', amount: '', to_amount: '',
        maxFee: '2', expires: '15',
        note: '',
      });`;

if (s.includes(hfResetOld)) {
  s = s.replace(hfResetOld, hfResetNew);
  console.log('✅ hawalaForm reset آپدیت شد');
} else {
  console.log('⚠️ hawalaForm reset پیدا نشد');
}

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
console.log('✅ قدم ۲.۱ تمام');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');