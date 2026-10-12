const fs = require('fs');

// خوندن از lib-supabase.ts
const sb = fs.readFileSync('lib-supabase.ts', 'utf8');
const urlMatch = sb.match(/['"](https:\/\/[a-z0-9]+\.supabase\.co)['"]/);
const keyMatch = sb.match(/['"](eyJ[A-Za-z0-9_\-\.]{50,})['"]/);

if (!urlMatch || !keyMatch) {
  console.log('❌ URL یا KEY پیدا نشد در lib-supabase.ts');
  console.log('URL match: ' + urlMatch);
  console.log('KEY match: ' + (keyMatch ? keyMatch[0].substring(0, 30) : 'null'));
  process.exit(1);
}

const URL = urlMatch[1];
const KEY = keyMatch[1];
console.log('✅ URL: ' + URL);
console.log('');

(async () => {
  // تست ۱: چک ستون‌های جدول
  console.log('═══ تست ۱: چک ستون‌های net_direct_hawalas ═══');
  try {
    const res = await fetch(URL + '/rest/v1/net_direct_hawalas?limit=1', {
      headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY },
    });
    const data = await res.json();
    if (data && data[0]) {
      console.log('✅ ستون‌های موجود:');
      Object.keys(data[0]).sort().forEach(k => console.log('   - ' + k));
    } else {
      console.log('⚠️ جدول خالیه یا خطا. Status: ' + res.status);
      console.log('Response: ' + JSON.stringify(data).substring(0, 300));
    }
  } catch (e) {
    console.log('❌ خطا: ' + e.message);
  }
  
  console.log('');
  console.log('═══ تست ۲: insert آزمایشی ═══');
  const testId = 'TEST-' + Date.now();
  const testData = {
    id: testId,
    code: 'P2P-TEST',
    from_email: 'test@test.com',
    from_name: 'تست',
    from_city: 'KBL',
    sender_name: 'تست',
    sender_phone: '0700000000',
    sender_city: 'KBL',
    sender_address: 'آدرس',
    to_email: 'test2@test.com',
    currency: 'USD',
    target_currency: 'AFN',
    amount: 100,
    to_amount: 7000,
    rate: 70,
    beneficiary_name: 'ذی‌نفع',
    beneficiary_phone: '0700000000',
    beneficiary_city: 'HRT',
    beneficiary_bank: 'بانک',
    beneficiary_holder: '1234',
    commission: 5,
    commission_percent: 1,
    note: 'تست',
    status: 'pending',
  };
  
  try {
    const res = await fetch(URL + '/rest/v1/net_direct_hawalas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': KEY,
        'Authorization': 'Bearer ' + KEY,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(testData),
    });
    const text = await res.text();
    console.log('Status: ' + res.status);
    console.log('Response: ' + (text || '(empty)'));
    
    if (res.status === 201 || res.status === 200 || res.status === 204) {
      console.log('✅ INSERT موفق');
      // پاک کردن
      const del = await fetch(URL + '/rest/v1/net_direct_hawalas?id=eq.' + testId, {
        method: 'DELETE',
        headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY },
      });
      console.log('🗑 حذف تست: ' + del.status);
    } else {
      console.log('❌ INSERT خطا — این متن مهم‌ه');
    }
  } catch (e) {
    console.log('❌ خطای network: ' + e.message);
  }
})();