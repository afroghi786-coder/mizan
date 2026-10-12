const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-phase1-v2-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('lib.network.ts', path.join(bdir, 'lib.network.ts'));
fs.copyFileSync('LiveMarketScreen.tsx', path.join(bdir, 'LiveMarketScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════
// lib.network.ts
// ═══════════════════════════════════════════
let n = fs.readFileSync('lib.network.ts', 'utf8');
const nOrig = n;
const nWasCRLF = n.includes('\r\n');
console.log('📏 lib.network.ts — CRLF: ' + nWasCRLF);

// normalise
n = n.replace(/\r\n/g, '\n');

// ═══════════════════════════════════════════
// ۱. sendBroadcastHawala با regex
// ═══════════════════════════════════════════
console.log('');
console.log('═══ sendBroadcastHawala ═══');

const bhRegex = /(export async function sendBroadcastHawala[\s\S]*?const \{ error \} = await _sb\.from\('net_hawalas'\)\.insert\(\{[\s\S]*?\}\);\s*\n\s*if \(error\) \{ console\.log\('sendBroadcastHawala error:', error\.message\); throw new Error\(error\.message\); \}[\s\S]*?for \(const u of toNotify\) \{[\s\S]*?await _sb\.from\('net_notifications'\)\.insert\(\{[\s\S]*?payload:\s*\{)([\s\S]*?)(\},\s*\n\s*\}\);\s*\n\s*\}\s*\n\s*\}\s*\n\s*\} catch \(e: any\) \{ console\.log\('hawala_new notify error:', e\?\.message\); \}[\s\S]*?return \{ success: true, id: h\.id \};\s*\n\})/;

const bhMatch = n.match(bhRegex);
if (bhMatch) {
  console.log('✅ الگو پیدا شد');
  
  // ۱.۱ اضافه const _code بعد از const expiresAtH
  n = n.replace(
    /(export async function sendBroadcastHawala[\s\S]*?if \(!_sb \|\| !_myEmail\) throw new Error\('متصل نیست'\);\s*\n)(\s*const expiresAtH)/,
    `$1  const _code = h.code || generateHawalaCode();\n$2`
  );
  
  // ۱.۲ اضافه code به insert
  n = n.replace(
    /(export async function sendBroadcastHawala[\s\S]*?await _sb\.from\('net_hawalas'\)\.insert\(\{\s*\n\s*id: h\.id,)/,
    `$1 code: _code,`
  );
  
  // ۱.۳ اضافه code به payload
  n = n.replace(
    /(type: 'hawala_new',\s*\n\s*payload: \{ hawalaId: h\.id,)/,
    `$1 code: _code,`
  );
  
  // ۱.۴ اضافه code به return
  n = n.replace(
    /(export async function sendBroadcastHawala[\s\S]*?)return \{ success: true, id: h\.id \};\n\}/,
    `$1return { success: true, id: h.id, code: _code };\n}`
  );
  
  console.log('✅ sendBroadcastHawala آپدیت شد');
} else {
  console.log('⚠️ الگو پیدا نشد — روش خطی');
  
  // روش خطی: خط به خط
  const lines = n.split('\n');
  let inFunc = false;
  let inserted1 = false, inserted2 = false, inserted3 = false, inserted4 = false;
  
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    
    if (L.includes('export async function sendBroadcastHawala')) {
      inFunc = true;
    }
    
    if (inFunc && !inserted1 && L.includes("throw new Error('متصل نیست')")) {
      lines.splice(i + 1, 0, '  const _code = h.code || generateHawalaCode();');
      inserted1 = true;
      i++;
      continue;
    }
    
    if (inFunc && inserted1 && !inserted2 && L.includes("await _sb.from('net_hawalas').insert({")) {
      // خط بعدی `id: h.id,` رو پیدا کن
      for (let j = i + 1; j < i + 5; j++) {
        if (lines[j].includes('id: h.id,')) {
          lines[j] = lines[j].replace('id: h.id,', 'id: h.id, code: _code,');
          inserted2 = true;
          break;
        }
      }
    }
    
    if (inFunc && inserted2 && !inserted3 && L.includes("type: 'hawala_new',")) {
      for (let j = i + 1; j < i + 5; j++) {
        if (lines[j].includes('payload: { hawalaId: h.id,')) {
          lines[j] = lines[j].replace('payload: { hawalaId: h.id,', 'payload: { hawalaId: h.id, code: _code,');
          inserted3 = true;
          break;
        }
      }
    }
    
    if (inFunc && inserted3 && !inserted4 && L.includes('return { success: true, id: h.id };')) {
      lines[i] = L.replace('return { success: true, id: h.id };', 'return { success: true, id: h.id, code: _code };');
      inserted4 = true;
      inFunc = false;
    }
  }
  
  n = lines.join('\n');
  console.log('inserted1 (const _code): ' + inserted1);
  console.log('inserted2 (insert code): ' + inserted2);
  console.log('inserted3 (payload code): ' + inserted3);
  console.log('inserted4 (return code): ' + inserted4);
}

// ═══════════════════════════════════════════
// ۲. sendDirectHawala
// ═══════════════════════════════════════════
console.log('');
console.log('═══ sendDirectHawala ═══');

const lines = n.split('\n');
let inFunc = false;
let ins1 = false, ins2 = false, ins3 = false, ins4 = false;

for (let i = 0; i < lines.length; i++) {
  const L = lines[i];
  
  if (L.includes('export async function sendDirectHawala')) {
    inFunc = true;
  }
  
  if (inFunc && !ins1 && L.includes("if (!h.toEmail) throw new Error('مقصد انتخاب نشده');")) {
    lines.splice(i + 1, 0, '  const _code = h.code || generateHawalaCode();');
    ins1 = true;
    i++;
    continue;
  }
  
  if (inFunc && ins1 && !ins2 && L.includes("await _sb.from('net_direct_hawalas').insert({")) {
    for (let j = i + 1; j < i + 5; j++) {
      if (lines[j].includes('id: h.id,')) {
        lines[j] = lines[j].replace('id: h.id,', 'id: h.id, code: _code,');
        ins2 = true;
        break;
      }
    }
  }
  
  if (inFunc && ins2 && !ins3 && L.includes("await notify(h.toEmail, 'direct_hawala'")) {
    lines[i] = L.replace(
      "{ hawalaId: h.id, from_email: _myEmail",
      "{ hawalaId: h.id, code: _code, from_email: _myEmail"
    );
    ins3 = true;
  }
  
  if (inFunc && ins3 && !ins4 && L.includes('return { success: true, id: h.id };')) {
    lines[i] = L.replace('return { success: true, id: h.id };', 'return { success: true, id: h.id, code: _code };');
    ins4 = true;
    inFunc = false;
  }
}

n = lines.join('\n');
console.log('ins1 (const _code): ' + ins1);
console.log('ins2 (insert code): ' + ins2);
console.log('ins3 (payload code): ' + ins3);
console.log('ins4 (return code): ' + ins4);

// برگردون CRLF
if (nWasCRLF) n = n.replace(/\n/g, '\r\n');

if (n !== nOrig) {
  fs.writeFileSync('lib.network.ts', n, 'utf8');
  console.log('💾 lib.network.ts ذخیره شد');
}

// ═══════════════════════════════════════════
// LiveMarketScreen.tsx — texts
// ═══════════════════════════════════════════
console.log('');
console.log('═══ LiveMarketScreen.tsx ═══');

let lm = fs.readFileSync('LiveMarketScreen.tsx', 'utf8');
const lmOrig = lm;
const lmWasCRLF = lm.includes('\r\n');
lm = lm.replace(/\r\n/g, '\n');

// اضافه const _c قبل از const texts
if (!lm.includes("const _c = p.code")) {
  if (lm.includes('const texts: any = {')) {
    lm = lm.replace(
      /(\s*)const texts: any = \{/,
      '$1const _c = p.code ? ` [${p.code}]` : \'\';\n$1const texts: any = {'
    );
    console.log('✅ const _c اضافه شد');
  }
}

// آپدیت هر خط texts که مربوط به hawala است
const replacements = [
  [/hawala_taken: `✅ \$\{p\.from_name\} حواله شما را قبول کرد`/, 'hawala_taken: `✅ ${p.from_name} حواله شما را قبول کرد${_c}`'],
  [/direct_hawala: `🔒 حواله خصوصی از \$\{p\.from_name\}`/, 'direct_hawala: `🔒 حواله خصوصی از ${p.from_name}${_c}`'],
  [/direct_accepted: `✅ \$\{p\.from_name\} حواله را قبول کرد`/, 'direct_accepted: `✅ ${p.from_name} حواله را قبول کرد${_c}`'],
  [/direct_delivered: `📦 \$\{p\.from_name\} حواله را تحویل داد`/, 'direct_delivered: `📦 ${p.from_name} حواله را تحویل داد${_c}`'],
  [/hawala_new: `📤 \$\{p\.from_name\} حواله \$\{fmt\(p\.amount\)\} \$\{p\.currency\}`/, 'hawala_new: `📤 ${p.from_name} حواله ${fmt(p.amount)} ${p.currency}${_c}`'],
];

let changed = 0;
for (const [pattern, replacement] of replacements) {
  if (pattern.test(lm)) {
    lm = lm.replace(pattern, replacement);
    changed++;
  }
}
console.log('✅ ' + changed + ' خط texts آپدیت شد');

if (lmWasCRLF) lm = lm.replace(/\n/g, '\r\n');

if (lm !== lmOrig) {
  fs.writeFileSync('LiveMarketScreen.tsx', lm, 'utf8');
  console.log('💾 LiveMarketScreen.tsx ذخیره شد');
}

console.log('');
console.log('✅ تمام');
console.log('');
console.log('🛡 بازگردانی:');
console.log('   copy /Y "' + bdir + '\\lib.network.ts" lib.network.ts');
console.log('   copy /Y "' + bdir + '\\LiveMarketScreen.tsx" LiveMarketScreen.tsx');