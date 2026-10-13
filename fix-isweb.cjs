const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-iswebfix-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('LocalBotScreen.tsx', path.join(bdir, 'LocalBotScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

let bot = fs.readFileSync('LocalBotScreen.tsx', 'utf8');
const orig = bot;
const crlf = bot.includes('\r\n');
if (crlf) bot = bot.replace(/\r\n/g, '\n');

// اضافه isWeb به import
const oldImport = "import { isSTTAvailable, startSTT, stopSTT, speakText, stopSpeak } from './lib.voice';";
const newImport = "import { isSTTAvailable, startSTT, stopSTT, speakText, stopSpeak, isWeb } from './lib.voice';";

if (bot.includes(oldImport)) {
  bot = bot.replace(oldImport, newImport);
  console.log('✅ isWeb به import اضافه شد');
} else if (bot.includes("from './lib.voice'") && !bot.includes('isWeb,')) {
  // روش دیگه
  bot = bot.replace(
    /from '\.\/lib\.voice';/,
    "from './lib.voice';"
  );
  // اضافه کن isWeb به لیست import
  bot = bot.replace(
    /import \{([^}]+)\} from '\.\/lib\.voice';/,
    (match, group) => {
      if (!group.includes('isWeb')) {
        return `import {${group.trim()}, isWeb } from './lib.voice';`;
      }
      return match;
    }
  );
  console.log('✅ isWeb (روش دوم)');
} else {
  console.log('⚠️ import voice پیدا نشد — دنبالش می‌گردم');
}

// چک نهایی
if (!bot.includes('isWeb')) {
  console.log('❌ isWeb نیست — اضافه دستی');
} else {
  console.log('✅ isWeb توی فایل هست');
}

if (crlf) bot = bot.replace(/\n/g, '\r\n');
if (bot !== orig) {
  fs.writeFileSync('LocalBotScreen.tsx', bot, 'utf8');
  console.log('💾 LocalBotScreen.tsx ذخیره شد');
}

console.log('');
console.log('✅ تمام');
console.log('حالا:');
console.log('  npx expo start --web --clear');