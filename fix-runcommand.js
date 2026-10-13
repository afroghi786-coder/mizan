const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-fixrun-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('AssistantScreen.tsx', path.join(bdir, 'AssistantScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let s = fs.readFileSync('AssistantScreen.tsx', 'utf8');
const orig = s;
const wasCRLF = s.includes('\r\n');
if (wasCRLF) s = s.replace(/\r\n/g, '\n');

// پیدا کردن تابع runCommand
const runStart = s.indexOf('const runCommand = async');
if (runStart < 0) {
  console.log('❌ runCommand پیدا نشد');
  process.exit(1);
}
console.log('✅ runCommand در ' + runStart);

// پیدا کردن انتهای runCommand
// شروع از runStart و شمارش {}
let braceCount = 0;
let foundFirst = false;
let endPos = -1;
for (let i = runStart; i < s.length; i++) {
  if (s[i] === '{') { braceCount++; foundFirst = true; }
  else if (s[i] === '}') {
    braceCount--;
    if (foundFirst && braceCount === 0) {
      // چک کن بعدش ; باشه
      const after = s.substring(i, i + 5);
      if (after.includes(';')) {
        endPos = i + 1;
        // اگه ; نیست، اضافه کن
        if (s[i + 1] !== ';') {
          // چک کن i+1 چیه
          if (s.substring(i, i + 2) !== '};') {
            endPos = i;
          } else {
            endPos = i + 1;
          }
        } else {
          endPos = i + 1;
        }
        break;
      }
    }
  }
}

if (endPos < 0) {
  console.log('❌ انتهای runCommand پیدا نشد');
  process.exit(1);
}

console.log('✅ انتهای runCommand در ' + endPos);

// استخراج تابع قدیمی
const oldFunc = s.substring(runStart, endPos + 1);

// تابع جدید
const newFunc = `const runCommand = async (cmd?: string) => {
    const command = (cmd || text).trim();
    if (!command) return;
    setProcessing(true);
    setText('');

    try {
      const intent = parseIntent(command);
      setLastResult(intent);

      let finalReply = intent.reply;

      if (intent.kind === 'navigate') {
        setTimeout(() => {
          onExit?.();
          setTimeout(() => {
            goTab(intent.params.tab);
            if (intent.params.sub) {
              setTimeout(() => goSub(intent.params.sub), 150);
            }
          }, 100);
        }, 600);
      } else if (intent.kind === 'query') {
        try {
          const answer = await executeQuery(intent.action, intent.params || {});
          finalReply = answer;
        } catch (e: any) {
          finalReply = '❌ خطا: ' + (e?.message || '');
        }
      } else if (intent.kind === 'action') {
        setPendingAction(intent);
        finalReply = '⚠️ آماده: ' + intent.reply + '\\n\\nبگو «تأیید» یا «لغو»';
      } else if (intent.kind === 'create') {
        setTimeout(() => {
          onExit?.();
          setTimeout(() => {
            if (intent.action === 'newInvoice') goTab('sales');
            else if (intent.action === 'newHawala') {
              goTab('exchange');
              setTimeout(() => goSub('hawalas'), 150);
            } else if (intent.action === 'newCustomer') {
              goTab('exchange');
              setTimeout(() => goSub('customers'), 150);
            }
          }, 100);
        }, 600);
        finalReply = '📝 ' + intent.reply;
      } else {
        // چک تأیید/لغو
        const lowT = command.toLowerCase().trim();
        if ((lowT.includes('تایید') || lowT.includes('تأیید') || lowT === 'ok' || lowT.includes('بله') || lowT.includes('آره')) && pendingAction) {
          try {
            const res = await executeAction(pendingAction.action, pendingAction.params || {});
            finalReply = res;
            setPendingAction(null);
          } catch (e: any) {
            finalReply = '❌ ' + (e?.message || '');
          }
        } else if ((lowT.includes('لغو') || lowT === 'نه' || lowT === 'cancel') && pendingAction) {
          finalReply = '❌ لغو شد';
          setPendingAction(null);
        }
      }

      try { await recordCommand(command, intent.kind); } catch {}
      try { setLearnedCmds(await getLearnedCommands()); } catch {}

      await addAssistantHistory({
        id: 'h_' + Date.now(),
        text: command,
        intent,
        response: finalReply,
        timestamp: Date.now(),
      });
      setHistory(await getAssistantHistory());
      speak(finalReply);
      showToast?.('🤖 ' + finalReply);
    } catch (e: any) {
      showToast?.('❌ ' + (e?.message || 'خطا'), true);
    }
    setProcessing(false);
  };`;

// جایگزینی
s = s.substring(0, runStart) + newFunc + s.substring(endPos + 1);

if (wasCRLF) s = s.replace(/\n/g, '\r\n');
if (s !== orig) {
  fs.writeFileSync('AssistantScreen.tsx', s, 'utf8');
  console.log('💾 AssistantScreen.tsx ذخیره شد');
}

console.log('');
console.log('═══ چک نهایی ═══');
const fin = fs.readFileSync('AssistantScreen.tsx', 'utf8');
console.log('executeQuery استفاده: ' + (fin.includes('await executeQuery') ? '✅' : '❌'));
console.log('executeAction استفاده: ' + (fin.includes('await executeAction') ? '✅' : '❌'));
console.log('recordCommand: ' + (fin.includes('recordCommand') ? '✅' : '❌'));
console.log('pendingAction: ' + (fin.includes('pendingAction') ? '✅' : '❌'));

console.log('');
console.log('✅ تمام');
console.log('حالا:');
console.log('  npx expo start --web --clear');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\AssistantScreen.tsx" AssistantScreen.tsx');