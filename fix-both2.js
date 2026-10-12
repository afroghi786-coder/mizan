const fs = require('fs');

// ═══════════════════════════════════════════
// بخش ۱: ExchangeBell — دکمه‌ها بدون شرط
// ═══════════════════════════════════════════
console.log('═══ ۱. ExchangeBell.tsx ═══');
let bell = fs.readFileSync('ExchangeBell.tsx', 'utf8');
const bellOrig = bell;

const re = /const getActions = \(nt: any\) => \{[\s\S]*?return actions;\s*\};/;

const newGetActions = `const getActions = (nt: any) => {
    const p = nt.payload || {};
    const roomId = roomIdFor(nt);
    const unreadCount = unreadByRoom[roomId] || 0;
    const actions = [];

    if (roomId) {
      actions.push({
        k: 'msg',
        l: unreadCount > 0 ? '💬 پیام (' + unreadCount + ')' : '💬 پیام',
        c: '#0891b2',
        fn: () => openChatFromNotif(nt),
      });
    }

    const infoTypes = ['group_invite', 'group_join'];
    if (infoTypes.indexOf(nt.type) >= 0) return actions;

    const doneTypes = ['direct_delivered', 'hawala_delivered', 'fx_delivered'];

    const acceptedOrDone = ['hawala_taken', 'direct_accepted', 'fx_taken'].concat(doneTypes);
    if (acceptedOrDone.indexOf(nt.type) < 0) {
      actions.push({ k: 'acc', l: '✅ قبول', c: '#059669', fn: () => doAccept(nt) });
    }

    if (acceptedOrDone.indexOf(nt.type) >= 0 && doneTypes.indexOf(nt.type) < 0) {
      actions.push({ k: 'del', l: '📦 تحویل', c: '#7c3aed', fn: () => doDeliver(nt) });
    }

    if (doneTypes.indexOf(nt.type) < 0) {
      actions.push({ k: 'can', l: '❌ لغو', c: '#dc2626', fn: () => doCancel(nt) });
    }

    return actions;
  };`;

if (re.test(bell)) {
  bell = bell.replace(re, newGetActions);
  console.log('✅ getActions بازنویسی شد');
  fs.writeFileSync('ExchangeBell.tsx', bell, 'utf8');
  console.log('💾 ExchangeBell ذخیره شد');
} else {
  console.log('❌ getActions پیدا نشد');
}

// ═══════════════════════════════════════════
// بخش ۲: ExchangeScreen — onBack prop
// ═══════════════════════════════════════════
console.log('');
console.log('═══ ۲. ExchangeScreen.tsx ═══');
let exch = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const exchOrig = exch;

// چک onBack هست یا نه
if (!exch.includes('onBack }') && !exch.includes('onBack,') && !exch.includes(', onBack')) {
  const propsRe = /export default function ExchangeScreen\(\{([^}]+)\}\)/;
  const m = exch.match(propsRe);
  if (m) {
    let params = m[1].trim();
    if (params.endsWith(',')) params = params.slice(0, -1);
    exch = exch.replace(m[0], 'export default function ExchangeScreen({' + params + ', onBack})');
    console.log('✅ onBack prop اضافه شد');
  } else {
    console.log('⚠️ الگوی props پیدا نشد');
  }
} else {
  console.log('ℹ️ onBack از قبل هست');
}

// اضافه دکمه برگشت — قبل از ExchangeBell
if (!exch.includes('exchBackBtn')) {
  const bellIdx = exch.indexOf('<ExchangeBell');
  if (bellIdx > 0) {
    const lineStart = exch.lastIndexOf('\n', bellIdx) + 1;
    const indent = exch.substring(lineStart, bellIdx);

    const backBtn =
      indent + '{/* بازگشت شناور */}\n' +
      indent + '<TouchableOpacity\n' +
      indent + '  onPress={() => onBack && onBack()}\n' +
      indent + '  style={{ position: \'fixed\', bottom: 90, right: 14, width: 60, height: 60, borderRadius: 30, backgroundColor: \'#7c3aed\', borderWidth: 2, borderColor: \'#d4af37\', justifyContent: \'center\', alignItems: \'center\', zIndex: 9999 }}\n' +
      indent + '>\n' +
      indent + '  <Text style={{ color: \'#fff\', fontSize: 28, fontWeight: \'bold\' }}>←</Text>\n' +
      indent + '</TouchableOpacity>\n\n';

    exch = exch.substring(0, lineStart) + backBtn + exch.substring(lineStart);
    console.log('✅ دکمه برگشت شناور اضافه شد');
  } else {
    console.log('⚠️ ExchangeBell پیدا نشد');
  }
} else {
  console.log('ℹ️ دکمه برگشت از قبل هست');
}

if (exch !== exchOrig) {
  fs.writeFileSync('ExchangeScreen.tsx', exch, 'utf8');
  console.log('💾 ExchangeScreen ذخیره شد');
}

// ═══════════════════════════════════════════
// بخش ۳: App.tsx — pass onBack
// ═══════════════════════════════════════════
console.log('');
console.log('═══ ۳. App.tsx ═══');
let app = fs.readFileSync('App.tsx', 'utf8');

const oldRender = "{tab === 'exchange' && <ExchangeScreen showToast={showToast} />}";
const newRender = "{tab === 'exchange' && <ExchangeScreen showToast={showToast} onBack={() => setTab('order')} />}";

if (app.includes(oldRender)) {
  app = app.replace(oldRender, newRender);
  fs.writeFileSync('App.tsx', app, 'utf8');
  console.log('✅ onBack به ExchangeScreen پاس شد');
  console.log('💾 App.tsx ذخیره شد');
} else if (app.includes('onBack={() => setTab')) {
  console.log('ℹ️ onBack از قبل هست');
} else {
  const idx = app.indexOf("tab === 'exchange'");
  if (idx > 0) {
    console.log('محدوده فعلی:');
    console.log(app.substring(idx, idx + 150));
  } else {
    console.log('⚠️ render exchange پیدا نشد');
  }
}

console.log('');
console.log('✅ تمام');