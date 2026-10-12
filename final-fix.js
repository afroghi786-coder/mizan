const fs = require('fs');

// ═══════════════════════════════════════════
// ۱. ExchangeBell.tsx
// ═══════════════════════════════════════════
console.log('═══ ExchangeBell.tsx ═══');
let s = fs.readFileSync('ExchangeBell.tsx', 'utf8');
const origS = s;

// حذف getActions قدیمی و جایگزینی با نسخه ساده
const re = /const getActions = \(nt: any\) => \{[\s\S]*?\n  \};/;
const newGetActions = `const getActions = (nt: any) => {
    const p = nt.payload || {};
    const roomId = roomIdFor(nt);
    const unreadCount = unreadByRoom[roomId] || 0;
    const actions = [];

    actions.push({
      k: 'msg',
      l: unreadCount > 0 ? '💬 پیام (' + unreadCount + ')' : '💬 پیام',
      c: '#0891b2',
      fn: () => openChatFromNotif(nt),
    });

    const t = String(nt.type || '');
    const infoTypes = ['group_invite', 'group_join'];
    if (infoTypes.indexOf(t) >= 0) return actions;

    const doneTypes = ['direct_delivered', 'hawala_delivered', 'fx_delivered'];
    const acceptedTypes = ['direct_accepted', 'hawala_taken', 'fx_taken', 'group_taken'];

    const isDone = doneTypes.indexOf(t) >= 0;
    const isAccepted = acceptedTypes.indexOf(t) >= 0;

    if (!isAccepted && !isDone) {
      actions.push({ k: 'acc', l: '✅ قبول', c: '#059669', fn: () => doAccept(nt) });
    }
    if (isAccepted && !isDone) {
      actions.push({ k: 'del', l: '📦 تحویل', c: '#7c3aed', fn: () => doDeliver(nt) });
    }
    if (!isDone) {
      actions.push({ k: 'can', l: '❌ لغو', c: '#dc2626', fn: () => doCancel(nt) });
    }

    return actions;
  };`;

if (re.test(s)) {
  s = s.replace(re, newGetActions);
  console.log('✅ getActions بازنویسی شد');
} else {
  console.log('❌ getActions پیدا نشد');
}

// onBack prop
s = s.replace(
  'export default function ExchangeBell({ showToast }: any)',
  'export default function ExchangeBell({ showToast, onBack }: any)'
);

// دکمه برگشت داخل ExchangeBell
if (!s.includes('onBack ? (')) {
  const backBtn = `      {onBack ? (
        <TouchableOpacity
          onPress={() => onBack()}
          style={{ position: 'fixed' as any, bottom: 90, right: 14, width: 60, height: 60, borderRadius: 30, backgroundColor: '#7c3aed', borderWidth: 2, borderColor: '#d4af37', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}
        >
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }}>←</Text>
        </TouchableOpacity>
      ) : null}

      {/* 🔔 دکمه شناور */}`;
  
  s = s.replace('{/* 🔔 دکمه شناور */}', backBtn);
  console.log('✅ دکمه برگشت داخل ExchangeBell');
} else {
  console.log('ℹ️ دکمه برگشت از قبل هست');
}

if (s !== origS) {
  fs.writeFileSync('ExchangeBell.tsx', s, 'utf8');
  console.log('💾 ذخیره شد');
}

// ═══════════════════════════════════════════
// ۲. ExchangeScreen.tsx
// ═══════════════════════════════════════════
console.log('');
console.log('═══ ExchangeScreen.tsx ═══');
let e = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const origE = e;

// props
if (!e.match(/export default function ExchangeScreen\(\{[^}]*onBack[^}]*\}/)) {
  e = e.replace(
    /export default function ExchangeScreen\(\{[^}]+\}/,
    'export default function ExchangeScreen({ showToast, onBack }'
  );
  console.log('✅ onBack در props');
}

// پاس دادن به ExchangeBell
if (e.includes('<ExchangeBell showToast={showToast} />')) {
  e = e.replace(
    '<ExchangeBell showToast={showToast} />',
    '<ExchangeBell showToast={showToast} onBack={onBack} />'
  );
  console.log('✅ onBack به ExchangeBell پاس شد');
} else if (e.match(/<ExchangeBell[^>]*\/>/)) {
  e = e.replace(/<ExchangeBell[^>]*\/>/, '<ExchangeBell showToast={showToast} onBack={onBack} />');
  console.log('✅ onBack پاس شد (regex)');
}

if (e !== origE) {
  fs.writeFileSync('ExchangeScreen.tsx', e, 'utf8');
  console.log('💾 ذخیره شد');
}

// ═══════════════════════════════════════════
// ۳. App.tsx
// ═══════════════════════════════════════════
console.log('');
console.log('═══ App.tsx ═══');
let a = fs.readFileSync('App.tsx', 'utf8');

if (a.includes("onBack={() => setTab('order')}")) {
  console.log('ℹ️ onBack از قبل پاس شده');
} else if (a.includes("{tab === 'exchange' && <ExchangeScreen showToast={showToast} />}")) {
  a = a.replace(
    "{tab === 'exchange' && <ExchangeScreen showToast={showToast} />}",
    "{tab === 'exchange' && <ExchangeScreen showToast={showToast} onBack={() => setTab('order')} />}"
  );
  fs.writeFileSync('App.tsx', a, 'utf8');
  console.log('✅ onBack به ExchangeScreen پاس شد');
} else {
  console.log('⚠️ render پیدا نشد — چاپ محدوده:');
  const idx = a.indexOf("tab === 'exchange'");
  if (idx > 0) console.log(a.substring(idx, idx + 120));
}

console.log('');
console.log('✅ تمام');