// اضافه ستون‌ها به Supabase از طریق REST API
const fs = require('fs');

// پیدا کردن URL و anon key از lib.network.ts
const net = fs.readFileSync('lib.network.ts', 'utf8');

const urlMatch = net.match(/['"](https:\/\/[a-z0-9]+\.supabase\.co)['"]/);
const keyMatch = net.match(/['"](eyJ[A-Za-z0-9_\-\.]+)['"]/);

if (!urlMatch) {
  console.log('❌ URL پیدا نشد');
  process.exit(1);
}
if (!keyMatch) {
  console.log('❌ anon key پیدا نشد');
  process.exit(1);
}

const URL = urlMatch[1];
const KEY = keyMatch[1];
console.log('✅ URL: ' + URL);
console.log('✅ KEY: ' + KEY.substring(0, 20) + '...');
console.log('');

// SQL برای اجرا
const sql = `
ALTER TABLE net_direct_hawalas ADD COLUMN IF NOT EXISTS sender_phone text;
ALTER TABLE net_direct_hawalas ADD COLUMN IF NOT EXISTS sender_address text;
ALTER TABLE net_direct_hawalas ADD COLUMN IF NOT EXISTS sender_city text;
ALTER TABLE net_direct_hawalas ADD COLUMN IF NOT EXISTS beneficiary_city text;
ALTER TABLE net_direct_hawalas ADD COLUMN IF NOT EXISTS beneficiary_bank text;
ALTER TABLE net_direct_hawalas ADD COLUMN IF NOT EXISTS beneficiary_holder text;
ALTER TABLE net_direct_hawalas ADD COLUMN IF NOT EXISTS to_amount numeric;
ALTER TABLE net_direct_hawalas ADD COLUMN IF NOT EXISTS rate numeric;
ALTER TABLE net_direct_hawalas ADD COLUMN IF NOT EXISTS commission_percent numeric;
ALTER TABLE net_direct_hawalas ADD COLUMN IF NOT EXISTS target_currency text;
ALTER TABLE net_hawalas ADD COLUMN IF NOT EXISTS sender_phone text;
ALTER TABLE net_hawalas ADD COLUMN IF NOT EXISTS sender_address text;
ALTER TABLE net_hawalas ADD COLUMN IF NOT EXISTS sender_city text;
ALTER TABLE net_hawalas ADD COLUMN IF NOT EXISTS beneficiary_city text;
ALTER TABLE net_hawalas ADD COLUMN IF NOT EXISTS beneficiary_bank text;
ALTER TABLE net_hawalas ADD COLUMN IF NOT EXISTS beneficiary_holder text;
ALTER TABLE net_hawalas ADD COLUMN IF NOT EXISTS to_amount numeric;
`;

(async () => {
  try {
    const res = await fetch(URL + '/rest/v1/rpc/exec_sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': KEY,
        'Authorization': 'Bearer ' + KEY,
      },
      body: JSON.stringify({ sql_text: sql }),
    });
    const text = await res.text();
    console.log('Status: ' + res.status);
    console.log('Response: ' + text);
    
    if (res.status !== 200) {
      console.log('');
      console.log('⚠️ این روش نیاز به تابع exec_sql در Supabase داره');
      console.log('   اگه کار نکرد، برو Supabase Dashboard → SQL Editor');
    }
  } catch (e) {
    console.log('❌ خطا: ' + e.message);
  }
})();