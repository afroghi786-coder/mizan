const fs = require('fs');
const net = fs.readFileSync('lib.network.ts', 'utf8');

// پیدا کردن URL و anon key
const urlMatch = net.match(/['"](https:\/\/[a-z0-9]+\.supabase\.co)['"]/);
const keyMatch = net.match(/['"](eyJ[A-Za-z0-9_\-\.]+)['"]/);

if (!urlMatch || !keyMatch) {
  console.log('❌ URL یا KEY پیدا نشد');
  process.exit(1);
}

const URL = urlMatch[1];
const KEY = keyMatch[1];
console.log('✅ URL: ' + URL);
console.log('');

(async () => {
  // تست ۱: یه insert ساده به net_direct_hawalas با ستون‌های جدید
  console.log('═══ تست ۱: insert با ستون‌های جدید ═══');
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
    sender_address: 'آدرس تست',
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
      console.log('✅ INSERT موفق — پاکش می‌کنم...');
      // پاک کردن رکورد تست
      const del = await fetch(URL + '/rest/v1/net_direct_hawalas?id=eq.' + testId, {
        method: 'DELETE',
        headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY },
      });
      console.log('🗑 حذف تست: ' + del.status);
    } else {
      console.log('❌ INSERT خطا داد — این خطا رو بفرست');
    }
  } catch (e) {
    console.log('❌ خطا: ' + e.message);
  }
  
  console.log('');
  console.log('═══ تست ۲: چک ستون‌های جدول ═══');
  try {
    const res = await fetch(URL + '/rest/v1/net_direct_hawalas?limit=1', {
      headers: { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY },
    });
    const data = await res.json();
    if (data && data[0]) {
      console.log('✅ ستون‌های موجود:');
      Object.keys(data[0]).forEach(k => console.log('   - ' + k));
    }
  } catch (e) {
    console.log('❌ خطا: ' + e.message);
  }
})();