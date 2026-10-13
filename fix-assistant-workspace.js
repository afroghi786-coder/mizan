const fs = require('fs');
const path = require('path');

const bdir = 'backup-before-workspace-' + Date.now();
fs.mkdirSync(bdir, { recursive: true });
fs.copyFileSync('AssistantScreen.tsx', path.join(bdir, 'AssistantScreen.tsx'));
console.log('🛡 بکاپ: ' + bdir);
console.log('');

// ═══════════════════════════════════════════════════════
// ۱. AssistantScreen — Panel Workspace
// ═══════════════════════════════════════════════════════
let s = fs.readFileSync('AssistantScreen.tsx', 'utf8');
const orig = s;
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');

// ─── ۱.۱ اضافه state panel ───
if (!s.includes('panelData')) {
  s = s.replace(
    "const [awaitingAnswer, setAwaitingAnswer] = useState<string>('');",
    "const [awaitingAnswer, setAwaitingAnswer] = useState<string>('');\n  const [panelData, setPanelData] = useState<any>(null);\n  const [panelLoading, setPanelLoading] = useState(false);"
  );
  console.log('✅ panel state اضافه شد');
}

// ─── ۱.۲ جایگزینی کل بلاک context-aware (بدون navigation) ───
const oldBlockStart = `      // 🧠 اول context و دستورات وابسته رو چک کن`;
const oldBlockEnd = `      // ─── پارسر معمولی ───
      const intent = parseIntent(command);
      setLastResult(intent);`;

const startIdx = s.indexOf(oldBlockStart);
const endIdx = s.indexOf(oldBlockEnd, startIdx);

if (startIdx < 0 || endIdx < 0) {
  console.log('⚠️ بلاک context پیدا نشد');
  process.exit(1);
}

const newBlock = `      // 🧠 Context و دستورات وابسته
      const ctx = getContext();
      const lowCmd = norm(command);

      // ─── تأیید/لغو pending action ───
      if (pendingAction) {
        if (/تایید|تأیید|ok|بله|آره|انجام/.test(lowCmd)) {
          try {
            const res = await executeAction(pendingAction.action, pendingAction.params || {});
            const reply = res;
            setLastResult({ kind: 'action', action: pendingAction.action, params: pendingAction.params, confidence: 100, raw: command, reply });
            setPendingAction(null);
            await addAssistantHistory({ id: 'h_' + Date.now(), text: command, intent: { kind: 'action', action: pendingAction.action, params: {}, confidence: 100, raw: command, reply }, response: reply, timestamp: Date.now() });
            setHistory(await getAssistantHistory());
            speak(reply);
            showToast?.(reply);
            setProcessing(false);
            return;
          } catch (e: any) {
            showToast?.('❌ ' + (e?.message || ''), true);
            setProcessing(false);
            return;
          }
        }
        if (/لغو|نه|cancel|بیخیال/.test(lowCmd)) {
          setPendingAction(null);
          setLastResult({ kind: 'action', action: 'cancel', params: {}, confidence: 100, raw: command, reply: '❌ لغو شد' });
          showToast?.('❌ لغو شد');
          setProcessing(false);
          return;
        }
      }

      // ─── «۵۰۰ به آن اضافه کن» (Context) ───
      const addMatch = lowCmd.match(/(?:^|\\s)(\\d+(?:\\.\\d+)?)\\s*(?:به\\s+(?:آن|اون|همون)|اضافه|بزن|واریز)|به\\s+(?:آن|اون|همون)\\s+(\\d+(?:\\.\\d+)?)/);
      if (addMatch && ctx.lastEntity) {
        const amt = parseFloat(addMatch[1] || addMatch[2] || '0');
        if (amt > 0) {
          if (ctx.lastEntity.type === 'box') {
            const r = await addToBox(ctx.lastEntity.id, amt, 'in', 'افزایش از دستیار');
            // رفرش panel
            try {
              const { getBoxes } = await import('./lib.fx');
              const boxes = await getBoxes() || [];
              const box = boxes.find((b: any) => (b.id || b.local_id || b.code) === ctx.lastEntity!.id);
              if (box) {
                const { getAllBalances } = await import('./lib.boxes');
                const bals = await getAllBalances();
                setPanelData({
                  type: 'box',
                  title: box.name || box.code,
                  currency: box.currency || 'AFN',
                  balance: bals[box.id || box.local_id] || 0,
                  box,
                });
              }
            } catch {}
            const reply = r.msg;
            setLastResult({ kind: 'action', action: 'addToBox', params: {}, confidence: 100, raw: command, reply });
            await addAssistantHistory({ id: 'h_' + Date.now(), text: command, intent: { kind: 'action', action: 'addToBox', params: {}, confidence: 100, raw: command, reply }, response: reply, timestamp: Date.now() });
            setHistory(await getAssistantHistory());
            speak(reply);
            showToast?.(reply);
            setProcessing(false);
            return;
          }
          if (ctx.lastEntity.type === 'customer') {
            try {
              const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
              const balKey = '@mizan_manual_balances_v1';
              const raw = await AsyncStorage.getItem(balKey);
              const bals = raw ? JSON.parse(raw) : {};
              const oldBal = bals[ctx.lastEntity.id] || 0;
              bals[ctx.lastEntity.id] = oldBal + amt;
              await AsyncStorage.setItem(balKey, JSON.stringify(bals));
              setPanelData((p: any) => p && p.type === 'customer' ? { ...p, balance: oldBal + amt } : p);
              const reply = \`✅ \${amt.toLocaleString('en-US')} به مانده \${ctx.lastEntity.name} اضافه شد\`;
              setLastResult({ kind: 'action', action: 'addBalance', params: {}, confidence: 100, raw: command, reply });
              speak(reply);
              showToast?.(reply);
              setProcessing(false);
              return;
            } catch {}
          }
        }
      }

      // ─── «کم کن» ───
      const subMatch = lowCmd.match(/(\\d+(?:\\.\\d+)?)\\s*(?:از\\s+(?:آن|اون)|کم\\s+کن)/);
      if (subMatch && ctx.lastEntity?.type === 'box') {
        const amt = parseFloat(subMatch[1]);
        if (amt > 0) {
          const r = await addToBox(ctx.lastEntity.id, amt, 'out', 'کاهش از دستیار');
          try {
            const { getBoxes } = await import('./lib.fx');
            const boxes = await getBoxes() || [];
            const box = boxes.find((b: any) => (b.id || b.local_id || b.code) === ctx.lastEntity!.id);
            if (box) {
              const { getAllBalances } = await import('./lib.boxes');
              const bals = await getAllBalances();
              setPanelData({
                type: 'box',
                title: box.name || box.code,
                currency: box.currency || 'AFN',
                balance: bals[box.id || box.local_id] || 0,
                box,
              });
            }
          } catch {}
          const reply = r.msg;
          setLastResult({ kind: 'action', action: 'subFromBox', params: {}, confidence: 100, raw: command, reply });
          speak(reply);
          showToast?.(reply);
          setProcessing(false);
          return;
        }
      }

      // ─── جستجو + نمایش در Panel ───
      const isBoxQuery = /صندوق/.test(lowCmd);
      const isStatementQuery = /صورتحساب|صورت.?حساب|کاردکس/.test(lowCmd);
      const isInvoiceQuery = /فاکتور/.test(lowCmd) && !/بزن|بساز|جدید/.test(lowCmd);
      const isCustomerQuery = /مشتری/.test(lowCmd);

      if (isBoxQuery || isStatementQuery || isInvoiceQuery || isCustomerQuery) {
        setPanelLoading(true);
        
        const currencyMatch = lowCmd.match(/(دالر|دلار|یورو|افغانی|تومان|ریال|روپیه|درهم|usd|afn|eur)/);
        const curMap: any = { 'دالر': 'USD', 'دلار': 'USD', 'یورو': 'EUR', 'افغانی': 'AFN', 'تومان': 'IRT', 'ریال': 'IRR', 'روپیه': 'PKR', 'درهم': 'AED' };
        const currency = currencyMatch ? (curMap[currencyMatch[1]] || currencyMatch[1].toUpperCase()) : undefined;

        let nameQuery = lowCmd
          .replace(/صندوق|صورتحساب|صورت.?حساب|کاردکس|فاکتور|مشتری|دالر|دلار|یورو|افغانی|تومان|ریال|روپیه|درهم|را|بیار|بیاور|بگیر|بزن|بساز|برای|از|به|چقدر|چقد/g, '')
          .replace(/[^\\u0600-\\u06FF\\w\\s\\d]/g, '')
          .trim();

        if (nameQuery && nameQuery.length >= 2) {
          if (isBoxQuery) {
            const box = await resolveBox(nameQuery, currency);
            if (box) {
              try {
                const { getAllBalances } = await import('./lib.boxes');
                const bals = await getAllBalances();
                const balance = bals[box.id || box.local_id] || 0;
                setContext({ lastEntity: { type: 'box', id: box.id || box.local_id, name: box.name || box.code, meta: box }, lastSearch: nameQuery });
                setPanelData({
                  type: 'box',
                  title: box.name || box.code,
                  currency: box.currency || 'AFN',
                  balance,
                  box,
                });
                const reply = \`📦 \${box.name} — \${balance.toLocaleString('en-US')} \${box.currency || 'AFN'}\`;
                setLastResult({ kind: 'query', action: 'showBox', params: {}, confidence: 95, raw: command, reply });
                await addAssistantHistory({ id: 'h_' + Date.now(), text: command, intent: { kind: 'query', action: 'showBox', params: {}, confidence: 95, raw: command, reply }, response: reply, timestamp: Date.now() });
                setHistory(await getAssistantHistory());
                speak(reply);
                showToast?.(reply);
              } catch (e) { showToast?.('❌ خطا', true); }
            } else {
              showToast?.('❌ صندوق پیدا نشد', true);
            }
            setPanelLoading(false);
            setProcessing(false);
            return;
          }

          if (isStatementQuery) {
            const person = await resolvePerson(nameQuery);
            if (person) {
              try {
                const { getBoxTransactions, getAllBalances } = await import('./lib.boxes');
                const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                const balKey = '@mizan_manual_balances_v1';
                const raw = await AsyncStorage.getItem(balKey);
                const bals = raw ? JSON.parse(raw) : {};
                const balance = bals[person.id || person.local_id] || 0;

                setContext({ lastEntity: { type: 'customer', id: person.id || person.local_id, name: person.name, meta: person }, lastSearch: nameQuery });
                setPanelData({
                  type: 'customer',
                  title: person.name,
                  phone: person.phone,
                  balance,
                  bank: person.bank,
                  person,
                });
                const reply = \`👤 \${person.name} — مانده: \${balance.toLocaleString('en-US')}\`;
                setLastResult({ kind: 'query', action: 'showCustomer', params: {}, confidence: 95, raw: command, reply });
                await addAssistantHistory({ id: 'h_' + Date.now(), text: command, intent: { kind: 'query', action: 'showCustomer', params: {}, confidence: 95, raw: command, reply }, response: reply, timestamp: Date.now() });
                setHistory(await getAssistantHistory());
                speak(reply);
                showToast?.(reply);
              } catch (e) { showToast?.('❌ خطا', true); }
            } else {
              showToast?.('❌ طرف پیدا نشد', true);
            }
            setPanelLoading(false);
            setProcessing(false);
            return;
          }

          if (isInvoiceQuery) {
            const results = await deepSearch(nameQuery, ['invoice']);
            if (results.length > 0) {
              if (results.length === 1) {
                const inv = results[0].meta;
                setContext({ lastEntity: { type: 'invoice', id: inv.invoice, name: inv.invoice, meta: inv }, lastSearch: nameQuery });
                setPanelData({
                  type: 'invoice',
                  title: 'فاکتور ' + inv.invoice,
                  customer: inv.name,
                  total: inv.total,
                  paid: inv.paid,
                  date: inv.date,
                  items: inv.items || [],
                  invoice: inv,
                });
                const reply = \`📄 فاکتور \${inv.invoice} — \${inv.name} — \${(Number(inv.total) || 0).toLocaleString('en-US')}\`;
                setLastResult({ kind: 'query', action: 'showInvoice', params: {}, confidence: 95, raw: command, reply });
                speak(reply);
                showToast?.(reply);
              } else {
                setSearchResults(results);
                setLastResult({ kind: 'query', action: 'searchInvoice', params: {}, confidence: 80, raw: command, reply: \`📄 \${results.length} فاکتور پیدا شد\` });
                showToast?.(\`📄 \${results.length} فاکتور — یکی رو انتخاب کن\`);
              }
            } else {
              showToast?.('❌ فاکتوری پیدا نشد', true);
            }
            setPanelLoading(false);
            setProcessing(false);
            return;
          }

          if (isCustomerQuery) {
            const person = await resolvePerson(nameQuery);
            if (person) {
              try {
                const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                const raw = await AsyncStorage.getItem('@mizan_manual_balances_v1');
                const bals = raw ? JSON.parse(raw) : {};
                const balance = bals[person.id || person.local_id] || 0;

                setContext({ lastEntity: { type: 'customer', id: person.id || person.local_id, name: person.name, meta: person }, lastSearch: nameQuery });
                setPanelData({
                  type: 'customer',
                  title: person.name,
                  phone: person.phone,
                  balance,
                  bank: person.bank,
                  person,
                });
                const reply = \`👤 \${person.name} — مانده: \${balance.toLocaleString('en-US')}\`;
                setLastResult({ kind: 'query', action: 'showCustomer', params: {}, confidence: 95, raw: command, reply });
                speak(reply);
                showToast?.(reply);
              } catch {}
            } else {
              showToast?.('❌ مشتری پیدا نشد', true);
            }
            setPanelLoading(false);
            setProcessing(false);
            return;
          }
        }
        setPanelLoading(false);
      }

      // ─── پارسر معمولی ───
      const intent = parseIntent(command);
      setLastResult(intent);`;

s = s.substring(0, startIdx) + newBlock + s.substring(endIdx + oldBlockEnd.length);
console.log('✅ Panel-based commands جایگزین شد (بدون navigation)');

// ─── ۱.۳ حذف navigation از پارسر عادی ───
const navBlock = `if (intent.kind === 'navigate') {
        // Deep Navigation
        try {
          await deepNav(
            intent.params.tab,
            intent.params.sub,
            intent.action || 'goto',
            intent.params
          );
        } catch (e) { console.log('deepNav err:', e); }
        setTimeout(() => {
          onExit?.();
          setTimeout(() => {
            goTab(intent.params.tab);
            if (intent.params.sub) {
              setTimeout(() => goSub(intent.params.sub), 150);
            }
          }, 100);
        }, 600);
      } else if (intent.kind === 'query') {`;

const navBlockNew = `if (intent.kind === 'navigate') {
        // فقط پیام بده — توی صفحه بمون
        finalReply = '💡 برای دیدن: ' + intent.params.label + ' — بگو «' + intent.params.label + ' رو نشون بده»';
      } else if (intent.kind === 'query') {`;

if (s.includes(navBlock)) {
  s = s.replace(navBlock, navBlockNew);
  console.log('✅ Navigation از پارسر عادی حذف شد');
}

// ─── ۱.۴ حذف navigation از create ───
const createBlock = `if (intent.kind === 'create') {
        try {
          await deepNav(
            intent.params.tab || 'exchange',
            intent.params.sub,
            intent.action || 'newInvoice',
            intent.params
          );
        } catch (e) { console.log('deepNav create err:', e); }
        setTimeout(() => {
          onExit?.();
          setTimeout(() => {
            goTab(intent.params.tab || 'exchange');
            if (intent.params.sub) {
              setTimeout(() => goSub(intent.params.sub), 150);
            }
          }, 100);
        }, 600);
        finalReply = '📝 ' + intent.reply;
      }`;

const createBlockNew = `if (intent.kind === 'create') {
        finalReply = '📝 ' + intent.reply + ' — به‌زودی';
      }`;

if (s.includes(createBlock)) {
  s = s.replace(createBlock, createBlockNew);
  console.log('✅ Create navigation حذف شد');
}

// ─── ۱.۵ اضافه Panel UI ───
const panelMarker = `        {/* 🔍 نتایج جستجو */}`;
const panelUI = `        {/* 📊 Panel — نمایش داده */}
        {panelData && (
          <View style={[s.card, { borderColor: '#059669', marginTop: 12 }]}>
            <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={s.cardTitle}>{
                panelData.type === 'box' ? '📦 صندوق' :
                panelData.type === 'customer' ? '👤 مشتری' :
                panelData.type === 'invoice' ? '📄 فاکتور' : '📋'
              }</Text>
              <TouchableOpacity onPress={() => { setPanelData(null); clearContext(); }}>
                <Text style={{ color: '#dc2626', fontSize: 22, fontWeight: 'bold' }}>×</Text>
              </TouchableOpacity>
            </View>

            {panelData.type === 'box' && (
              <View>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>{panelData.title}</Text>
                <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'right' }}>ارز: {panelData.currency}</Text>
                <View style={{ backgroundColor: '#1a2332', padding: 14, borderRadius: 10, marginTop: 10, alignItems: 'center' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>موجودی فعلی</Text>
                  <Text style={{ color: '#10b981', fontSize: 28, fontWeight: 'bold', marginTop: 4 }}>
                    {Math.abs(Number(panelData.balance) || 0).toLocaleString('en-US')}
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{panelData.currency}</Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 12 }}>
                  <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={() => { setText('۵۰۰ به آن اضافه کن'); }}>
                    <Text style={s.btnTxt}>➕ افزودن</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btn, { backgroundColor: '#dc2626' }]} onPress={() => { setText('۱۰۰ از آن کم کن'); }}>
                    <Text style={s.btnTxt}>➖ کاهش</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {panelData.type === 'customer' && (
              <View>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>{panelData.title}</Text>
                {panelData.phone ? <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'right' }}>📞 {panelData.phone}</Text> : null}
                {panelData.bank ? <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'right', marginTop: 2 }}>🏦 {panelData.bank}</Text> : null}
                <View style={{ backgroundColor: '#1a2332', padding: 14, borderRadius: 10, marginTop: 10, alignItems: 'center' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>مانده</Text>
                  <Text style={{
                    color: panelData.balance > 0 ? '#10b981' : panelData.balance < 0 ? '#ef4444' : '#94a3b8',
                    fontSize: 28, fontWeight: 'bold', marginTop: 4,
                  }}>
                    {Math.abs(Number(panelData.balance) || 0).toLocaleString('en-US')}
                  </Text>
                  <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                    {panelData.balance > 0 ? '🟢 طلبکار' : panelData.balance < 0 ? '🔴 بدهکار' : '⚪ تسویه'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row-reverse', gap: 6, marginTop: 12 }}>
                  <TouchableOpacity style={[s.btn, { backgroundColor: '#059669' }]} onPress={() => { setText('۵۰۰ به آن اضافه کن'); }}>
                    <Text style={s.btnTxt}>➕ واریز</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btn, { backgroundColor: '#7c3aed' }]} onPress={() => { setText('فاکتور جدید برای ' + panelData.title); }}>
                    <Text style={s.btnTxt}>📄 فاکتور</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.btn, { backgroundColor: '#dc2626' }]} onPress={() => { setText('۱۰۰ از آن کم کن'); }}>
                    <Text style={s.btnTxt}>➖</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {panelData.type === 'invoice' && (
              <View>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 6 }}>{panelData.title}</Text>
                <Text style={{ color: '#cbd5e1', fontSize: 13, textAlign: 'right' }}>👤 {panelData.customer}</Text>
                <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'right', marginTop: 2 }}>
                  📅 {panelData.date ? new Date(panelData.date).toLocaleDateString('fa-IR') : ''}
                </Text>
                <View style={{ backgroundColor: '#1a2332', padding: 14, borderRadius: 10, marginTop: 10, alignItems: 'center' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>مبلغ کل</Text>
                  <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>
                    {(Number(panelData.total) || 0).toLocaleString('en-US')}
                  </Text>
                  <Text style={{ color: panelData.paid >= panelData.total ? '#10b981' : '#f59e0b', fontSize: 12, marginTop: 4 }}>
                    پرداخت‌شده: {(Number(panelData.paid) || 0).toLocaleString('en-US')}
                  </Text>
                </View>
                {panelData.items && panelData.items.length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ color: '#cbd5e1', fontSize: 12, fontWeight: 'bold', textAlign: 'right', marginBottom: 4 }}>اقلام:</Text>
                    {panelData.items.slice(0, 5).map((it: any, idx: number) => (
                      <View key={idx} style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', backgroundColor: '#1a2332', padding: 8, borderRadius: 6, marginTop: 4 }}>
                        <Text style={{ color: '#cbd5e1', fontSize: 12 }}>{it.model_name || '—'}</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12 }}>{it.quantity} × {it.price_unit}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {panelLoading && (
          <View style={{ alignItems: 'center', padding: 14 }}>
            <ActivityIndicator color="#7c3aed" size="large" />
            <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>در حال جستجو...</Text>
          </View>
        )}

        {/* 🔍 نتایج جستجو */}`;

if (s.includes(panelMarker) && !s.includes('panelData.type === \'box\'')) {
  s = s.replace(panelMarker, panelUI);
  console.log('✅ Panel UI اضافه شد');
} else {
  console.log('ℹ️ Panel UI از قبل هست یا marker نیست');
}

// ─── ۱.۶ import clearContext ───
if (s.includes('clearContext') && !s.includes('clearContext,') && !s.includes('clearContext }')) {
  s = s.replace(
    /import \{ deepSearch, resolveBox, resolvePerson, addToBox, setContext, getContext,/,
    'import { deepSearch, resolveBox, resolvePerson, addToBox, setContext, getContext, clearContext,'
  );
  console.log('✅ clearContext به import اضافه شد');
}

if (crlf) s = s.replace(/\n/g, '\r\n');
if (s !== orig) {
  fs.writeFileSync('AssistantScreen.tsx', s, 'utf8');
  console.log('💾 AssistantScreen.tsx ذخیره شد');
}

console.log('');
console.log('═══ چک نهایی ═══');
const fin = fs.readFileSync('AssistantScreen.tsx', 'utf8');
console.log('panelData: ' + (fin.includes('panelData') ? '✅' : '❌'));
console.log('Panel UI: ' + (fin.includes("panelData.type === 'box'") ? '✅' : '❌'));
console.log('clearContext: ' + (fin.includes('clearContext') ? '✅' : '❌'));

console.log('');
console.log('✅ تمام');
console.log('');
console.log('حالا:');
console.log('  npx expo start --web --clear');
console.log('');
console.log('🛡 بازگردانی: copy /Y "' + bdir + '\\AssistantScreen.tsx" AssistantScreen.tsx');