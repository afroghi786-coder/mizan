const fs = require('fs');
let s = fs.readFileSync('ExchangeScreen.tsx', 'utf8');
const orig = s;

// پیدا کردن اولین useState در ExchangeScreen
const idx = s.indexOf('export default function ExchangeScreen');
if (idx < 0) {
  console.log('❌ ExchangeScreen پیدا نشد');
  process.exit(1);
}

// پیدا کردن اولین useState بعد از تعریف تابع
const afterFn = s.substring(idx);
const useMatch = afterFn.match(/const \[[^\]]+\] = useState[^;]+;/);
if (!useMatch) {
  console.log('❌ useState پیدا نشد');
  process.exit(1);
}

const matchPos = idx + useMatch.index;
const matchEnd = matchPos + useMatch[0].length;

// state های جدید
const newStates = `
  // 🔔 notification state
  const [exchBellModal, setExchBellModal] = useState(false);
  const [exchNotifList, setExchNotifList] = useState<any[]>([]);
  const [exchUnread, setExchUnread] = useState(0);
  const [exchChatModal, setExchChatModal] = useState(false);
  const [exchChatRoom, setExchChatRoom] = useState<any>(null);
  const [exchChatPeer, setExchChatPeer] = useState<any>(null);
  const [exchChatMsgs, setExchChatMsgs] = useState<any[]>([]);
  const [exchChatInput, setExchChatInput] = useState('');
  const [exchChatSending, setExchChatSending] = useState(false);`;

// اضافه بعد از اولین useState
s = s.substring(0, matchEnd) + newStates + s.substring(matchEnd);

fs.writeFileSync('ExchangeScreen.tsx', s, 'utf8');
console.log('✅ state ها اضافه شد');
console.log('💾 ذخیره شد');