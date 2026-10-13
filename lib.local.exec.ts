// lib.local.exec.ts — اجرای دستورات روی داده‌های اپ
import { Command } from './lib.local.nlu';

export interface ExecResult {
  ok: boolean;
  message: string;
  panel?: any; // داده برای نمایش
}

// ─── Context حافظه
let _last: any = null;
export function setLastEntity(e: any) { _last = e; }
export function getLastEntity() { return _last; }
export function clearLastEntity() { _last = null; }

// ═══════════════════════════════════════════
// پیدا کردن صندوق
// ═══════════════════════════════════════════
async function findBox(name: string, currency?: string): Promise<any | null> {
  try {
    const { nameScore } = await import('./lib.local.nlu');
    const bx = await import('./lib.boxes');
    const boxes = await bx.getBoxes() || [];
    const bals = await bx.getAllBalances() || {};
    
    let best: any = null;
    let bestScore = 0;
    const cur = currency?.toUpperCase();
    
    for (const b of boxes) {
      // چک ارز
      if (cur && String(b.currency || '').toUpperCase() !== cur) continue;
      
      const s1 = nameScore(b.name || '', name);
      const s2 = nameScore(b.code || '', name);
      const s3 = nameScore(b.owner_name || '', name);
      const s = Math.max(s1, s2, s3);
      
      if (s > bestScore) {
        bestScore = s;
        best = { ...b, _balance: bals[b.id || b.local_id] || 0 };
      }
    }
    
    // اگه با ارز پیدا نشد، بدون ارز امتحان کن
    if (!best && cur) {
      for (const b of boxes) {
        const s = Math.max(
          nameScore(b.name || '', name),
          nameScore(b.code || '', name),
          nameScore(b.owner_name || '', name)
        );
        if (s > bestScore) { bestScore = s; best = { ...b, _balance: bals[b.id || b.local_id] || 0 }; }
      }
    }
    
    return bestScore >= 40 ? best : null;
  } catch (e) { console.log('findBox err:', e); return null; }
}

// ═══════════════════════════════════════════
// پیدا کردن مشتری
// ═══════════════════════════════════════════
async function findCustomer(name: string): Promise<any | null> {
  try {
    const { nameScore } = await import('./lib.local.nlu');
    const cc = await import('./lib.fx.cust');
    const custs = await cc.getAllCust() || [];
    
    let best: any = null;
    let bestScore = 0;
    
    for (const c of custs) {
      const s = Math.max(
        nameScore(c.name || '', name),
        nameScore(c.phone || '', name),
        nameScore(c.code || '', name)
      );
      if (s > bestScore) { bestScore = s; best = c; }
    }
    
    return bestScore >= 40 ? best : null;
  } catch (e) { return null; }
}

// ═══════════════════════════════════════════
// اجرای دستور
// ═══════════════════════════════════════════
export async function execute(cmd: Command): Promise<ExecResult> {
  try {
    // ═══ راهنما
    if (cmd.intent === 'help') {
      return {
        ok: true,
        message: '🧠 من می‌تونم:\n• «صندوق احمد» — باز کنم\n• «صندوق دالر فروغی»\n• «۵۰۰ به احمد اضافه کن»\n• «۱۰۰ از فروغی کم کن»\n• «مانده رضا»\n• «سود امروز»\n• «مشتری کریمی»\n• «همه صندوق‌ها»',
      };
    }
    
    // ═══ لیست صندوق‌ها
    if (cmd.intent === 'list_boxes') {
      const bx = await import('./lib.boxes');
      const boxes = await bx.getBoxes() || [];
      const bals = await bx.getAllBalances() || {};
      if (!boxes.length) return { ok: true, message: '📦 صندوقی نیست' };
      
      const list = boxes.map((b: any) => {
        const bal = bals[b.id || b.local_id] || 0;
        return { kind: 'box', box: { ...b, _balance: bal } };
      });
      const msg = boxes.map((b: any) => {
        const bal = bals[b.id || b.local_id] || 0;
        return `• ${b.name} (${b.currency}): ${bal.toLocaleString('en-US')}`;
      }).join('\n');
      return { ok: true, message: '📦 صندوق‌ها:\n' + msg, panel: { kind: 'list_boxes', list } };
    }
    
    // ═══ لیست مشتری‌ها
    if (cmd.intent === 'list_customers') {
      const cc = await import('./lib.fx.cust');
      const custs = await cc.getAllCust() || [];
      if (!custs.length) return { ok: true, message: '👥 مشتری نیست' };
      const list = custs.slice(0, 50).map((c: any) => ({ kind: 'customer', customer: c }));
      const msg = custs.slice(0, 20).map((c: any) => '• ' + c.name + (c.phone ? ' — ' + c.phone : '')).join('\n');
      return { ok: true, message: `👥 ${custs.length} مشتری:\n` + msg, panel: { kind: 'list_customers', list } };
    }
    
    // ═══ باز کردن صندوق
    if (cmd.intent === 'open_box') {
      const box = await findBox(cmd.params.name, cmd.params.currency);
      if (!box) return { ok: false, message: `❌ صندوق «${cmd.params.name}» پیدا نشد` };
      
      const bx = await import('./lib.boxes');
      const txs = await bx.getBoxTransactions(box.id || box.local_id) || [];
      
      setLastEntity({ type: 'box', id: box.id || box.local_id, name: box.name, meta: box });
      
      return {
        ok: true,
        message: `📦 ${box.name} — ${(box._balance || 0).toLocaleString('en-US')} ${box.currency}`,
        panel: { kind: 'box', box, txs },
      };
    }
    
    // ═══ مانده مشتری
    if (cmd.intent === 'balance') {
      // اول صندوق؟
      const box = await findBox(cmd.params.name);
      if (box) {
        setLastEntity({ type: 'box', id: box.id || box.local_id, name: box.name, meta: box });
        const bx = await import('./lib.boxes');
        const txs = await bx.getBoxTransactions(box.id || box.local_id) || [];
        return {
          ok: true,
          message: `📦 ${box.name}: ${(box._balance || 0).toLocaleString('en-US')} ${box.currency}`,
          panel: { kind: 'box', box, txs },
        };
      }
      
      // بعد مشتری
      const cust = await findCustomer(cmd.params.name);
      if (!cust) return { ok: false, message: `❌ «${cmd.params.name}» پیدا نشد` };
      
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const raw = await AsyncStorage.getItem('@mizan_manual_balances_v1');
      const bals = raw ? JSON.parse(raw) : {};
      const bal = bals[cust.id || cust.local_id] || 0;
      const label = bal > 0 ? '🟢 طلبکار' : bal < 0 ? '🔴 بدهکار' : '⚪ تسویه';
      
      setLastEntity({ type: 'customer', id: cust.id || cust.local_id, name: cust.name, meta: cust });
      
      return {
        ok: true,
        message: `👤 ${cust.name}: ${Math.abs(bal).toLocaleString('en-US')} — ${label}`,
        panel: { kind: 'customer', customer: cust, balance: bal },
      };
    }
    
    // ═══ واریز/برداشت صندوق
    if (cmd.intent === 'deposit' || cmd.intent === 'withdraw') {
      const box = await findBox(cmd.params.name, cmd.params.currency);
      if (!box) return { ok: false, message: `❌ صندوق «${cmd.params.name}» پیدا نشد` };
      
      const amt = Number(cmd.params.amount) || 0;
      if (amt <= 0) return { ok: false, message: '❌ مبلغ معتبر نیست' };
      
      const bx = await import('./lib.boxes');
      await bx.addBoxTransaction({
        box_id: box.id || box.local_id,
        box_code: box.code,
        type: cmd.intent === 'deposit' ? 'deposit' : 'withdraw',
        amount: amt,
        currency: box.currency || 'AFN',
        description: (cmd.intent === 'deposit' ? 'واریز' : 'برداشت') + ' از دستیار',
        date: new Date().toISOString(),
      });
      
      // refresh
      const bals = await bx.getAllBalances() || {};
      const newBal = bals[box.id || box.local_id] || 0;
      const txs = await bx.getBoxTransactions(box.id || box.local_id) || [];
      
      setLastEntity({ type: 'box', id: box.id || box.local_id, name: box.name, meta: { ...box, _balance: newBal } });
      
      return {
        ok: true,
        message: `✅ ${cmd.intent === 'deposit' ? 'واریز' : 'برداشت'} ${amt.toLocaleString('en-US')} ${box.currency}\n💰 موجودی: ${newBal.toLocaleString('en-US')}`,
        panel: { kind: 'box', box: { ...box, _balance: newBal }, txs },
      };
    }
    
    // ═══ سود امروز
    if (cmd.intent === 'today_profit') {
      try {
        const lib = await import('./lib');
        const sales = await lib.getSalesGrouped() || [];
        const purchases = await lib.getPurchasesGrouped() || [];
        
        const range = cmd.params.range || 'today';
        let since = Date.now() - 24 * 3600 * 1000;
        if (range === 'week') since = Date.now() - 7 * 24 * 3600 * 1000;
        else if (range === 'month') since = Date.now() - 30 * 24 * 3600 * 1000;
        else if (range === 'yesterday') {
          const now = new Date();
          since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
        }
        
        const filterFn = (x: any) => new Date(x.date || x.created_at || 0).getTime() >= since;
        const salesInRange = sales.filter(filterFn);
        const purchasesInRange = purchases.filter(filterFn);
        
        const totalSales = salesInRange.reduce((s: number, x: any) => s + (Number(x.total) || 0), 0);
        const totalPurch = purchasesInRange.reduce((s: number, x: any) => s + (Number(x.total) || 0), 0);
        const profit = totalSales - totalPurch;
        
        const rangeLabel = { today: 'امروز', yesterday: 'دیروز', week: 'این هفته', month: 'این ماه' }[range] || 'امروز';
        
        return {
          ok: true,
          message: `📊 ${rangeLabel}:\n• فروش: ${salesInRange.length} (${totalSales.toLocaleString('en-US')})\n• خرید: ${purchasesInRange.length} (${totalPurch.toLocaleString('en-US')})\n• سود: ${profit.toLocaleString('en-US')}`,
          panel: { kind: 'stats', sales: salesInRange.length, purchases: purchasesInRange.length, totalSales, totalPurchases: totalPurch, profit, rangeLabel },
        };
      } catch (e: any) {
        return { ok: false, message: '❌ خطا: ' + (e?.message || '') };
      }
    }
    
    // ═══ فاکتور
    if (cmd.intent === 'open_invoice') {
      try {
        const lib = await import('./lib');
        const sales = await lib.getSalesGrouped() || [];
        
        let found: any = null;
        if (cmd.params.invoiceId) {
          found = sales.find((s: any) => String(s.invoice || '').includes(cmd.params.invoiceId));
        } else if (cmd.params.name) {
          const { nameScore } = await import('./lib.local.nlu');
          let bestScore = 0;
          for (const s of sales) {
            const sc = nameScore(s.name || '', cmd.params.name);
            if (sc > bestScore) { bestScore = sc; found = s; }
          }
          if (bestScore < 40) found = null;
        }
        
        if (!found) return { ok: false, message: '❌ فاکتور پیدا نشد' };
        
        return {
          ok: true,
          message: `📄 فاکتور ${found.invoice} — ${found.name}`,
          panel: { kind: 'invoice', invoice: found },
        };
      } catch { return { ok: false, message: '❌ خطا' }; }
    }
    
    // ═══ مشتری
    if (cmd.intent === 'open_customer') {
      const cust = await findCustomer(cmd.params.name);
      if (!cust) return { ok: false, message: `❌ «${cmd.params.name}» پیدا نشد` };
      
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const raw = await AsyncStorage.getItem('@mizan_manual_balances_v1');
      const bals = raw ? JSON.parse(raw) : {};
      const bal = bals[cust.id || cust.local_id] || 0;
      
      setLastEntity({ type: 'customer', id: cust.id || cust.local_id, name: cust.name, meta: cust });
      
      return {
        ok: true,
        message: `👤 ${cust.name}${cust.phone ? ' — ' + cust.phone : ''}\n💰 مانده: ${Math.abs(bal).toLocaleString('en-US')}`,
        panel: { kind: 'customer', customer: cust, balance: bal },
      };
    }
    
    return { ok: false, message: '🤔 نفهمیدم. بگو «راهنما»' };
  } catch (e: any) {
    return { ok: false, message: '❌ ' + (e?.message || 'خطا') };
  }
}
