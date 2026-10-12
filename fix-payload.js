// fix-payload.js — اضافه from_email به payload اعلان‌ها
const fs = require('fs');
let s = fs.readFileSync('lib.network.ts', 'utf8');
const orig = s;
let n = 0;

// ═══════════════════════════════════════════
// ۱. claimHawala
// ═══════════════════════════════════════════
const replacements = [
  // claimHawala
  {
    old: "await notify(cur.from_email, 'hawala_taken', { taskId, from_name: _myName, amount: cur.amount, currency: cur.currency });",
    new: "await notify(cur.from_email, 'hawala_taken', { taskId, from_email: _myEmail, from_name: _myName, from_city: _myCity, amount: cur.amount, currency: cur.currency });"
  },
  // claimFXOffer
  {
    old: "await notify(cur.seller_email, 'fx_taken', { offerId, from_name: _myName, amount: cur.amount, currency: cur.currency });",
    new: "await notify(cur.seller_email, 'fx_taken', { offerId, from_email: _myEmail, from_name: _myName, from_city: _myCity, amount: cur.amount, currency: cur.currency });"
  },
  // sendDirectHawala
  {
    old: "await notify(h.toEmail, 'direct_hawala', { hawalaId: h.id, from_name: _myName, amount: h.amount, currency: h.currency });",
    new: "await notify(h.toEmail, 'direct_hawala', { hawalaId: h.id, from_email: _myEmail, from_name: _myName, from_city: _myCity, amount: h.amount, currency: h.currency });"
  },
  // acceptDirectHawala
  {
    old: "await notify(cur.from_email, 'direct_accepted', { hawalaId, from_name: _myName });",
    new: "await notify(cur.from_email, 'direct_accepted', { hawalaId, from_email: _myEmail, from_name: _myName, from_city: _myCity });"
  },
  // deliverDirectHawala
  {
    old: "await notify(cur.from_email, 'direct_delivered', { hawalaId, from_name: _myName });",
    new: "await notify(cur.from_email, 'direct_delivered', { hawalaId, from_email: _myEmail, from_name: _myName, from_city: _myCity });"
  },
  // sendFXOffer — notification به کاربران مختلف
  {
    old: "payload: { offerId: o.id, from_name: _myName, currency: o.currency, amount: o.amount, rate: o.rate },",
    new: "payload: { offerId: o.id, from_email: _myEmail, from_name: _myName, from_city: _myCity, currency: o.currency, amount: o.amount, rate: o.rate },"
  },
  // sendBroadcastHawala
  {
    old: "payload: { hawalaId: h.id, from_name: _myName, currency: h.currency, amount: h.amount, targetCity: h.targetCity },",
    new: "payload: { hawalaId: h.id, from_email: _myEmail, from_name: _myName, from_city: _myCity, currency: h.currency, amount: h.amount, targetCity: h.targetCity },"
  },
];

for (const r of replacements) {
  if (s.includes(r.old)) {
    s = s.replace(r.old, r.new);
    console.log('✅ payload به‌روز شد: ' + r.old.substring(0, 60) + '...');
    n++;
  } else {
    console.log('⚠️ پیدا نشد: ' + r.old.substring(0, 60) + '...');
  }
}

if (s !== orig) {
  fs.writeFileSync('lib.network.ts', s, 'utf8');
  console.log('\\n💾 lib.network.ts ذخیره شد — ' + n + ' تغییر');
} else {
  console.log('\\n⚠️ تغییری اعمال نشد');
}