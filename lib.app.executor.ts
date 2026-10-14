// lib.app.executor.ts — اجراکننده واقعی دستورات
// همه کارها رو روی داده‌های اپ انجام می‌ده

import { ParsedCommand } from './lib.app.parser';
import { emit } from './lib.app.events';

// ═══════════════════════════════════════════
// Navigator — از App.tsx ثبت می‌شه
// ═══════════════════════════════════════════
let _nav: {
  setTab?: (t: string) => void;
  setSub?: (s: string) => void;
  openModal?: (name: string, data?: any) => void;
  getState?: () => any;
} = {};

export function setNavigator(n: any) {
  _nav = { ..._nav, ...n };
}

export function getNavigator() { return _nav; }

// ═══════════════════════════════════════════
// نتیجه اجرا
// ═══════════════════════════════════════════
export interface ExecResult {
  ok: boolean;
  message: string;
  panel?: any;    // داده برای نمایش
  navigate?: { tab?: string; sub?: string; modal?: string };
  needConfirm?: boolean;
  action?: any;
}

// ═══════════════════════════════════════════
// جستجوی داده‌ها
// ═══════════════════════════════════════════

// ─── پیدا کردن صندوق
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
      if (cur && String(b.currency || '').toUpperCase() !== cur) continue;
      const s = Math.max(
        nameScore(b.name || '', name),
        nameScore(b.code || '', name),
        nameScore(b.owner_name || '', name)
      );
      if (s > bestScore) { bestScore = s; best = { ...b, _balance: bals[b.id || b.local_id] || 0 }; }
    }
    
    // اگه با ارز پیدا نشد، بدون ارز
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

// ─── پیدا کردن مشتری
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
  } catch { return null; }
}

// ─── پیدا کردن فاکتور
async function findInvoice(query: string): Promise<any[]> {
  try {
    const { nameScore } = await import('./lib.local.nlu');
    const lib = await import('./lib');
    const sales = await lib.getSalesGrouped() || [];
    const q = String(query || '').trim();
    if (!q) return [];
    
    const matches: any[] = [];
    for (const inv of sales) {
      const sc = Math.max(
        nameScore(inv.invoice || '', q),
        nameScore(inv.name || '', q),
        nameScore(inv.phone || '', q)
      );
      if (sc >= 30) matches.push({ inv, score: sc });
    }
    matches.sort((a, b) => b.score - a.score);
    return matches.map(m => m.inv);
  } catch { return []; }
}

// ═══════════════════════════════════════════
// اجرای دستور
// ═══════════════════════════════════════════
export async function execute(cmd: ParsedCommand): Promise<ExecResult> {
  try {
    // ═══ Navigation ═══
    if (cmd.kind === 'navigate') {
      const nav = _nav;
      
      // سعی کن بری تب
      try { nav.setTab?.(cmd.tab || ''); } catch (e) { console.log('setTab err:', e); }
      
      // بعد زیرتب
      if (cmd.sub) {
        setTimeout(() => {
          try { nav.setSub?.(cmd.sub!); } catch (e) { console.log('setSub err:', e); }
        }, 100);
      }
      
      // اگه modal هم داشت
      if (cmd.modal) {
        setTimeout(() => {
          try { nav.openModal?.(cmd.modal!); } catch (e) { console.log('openModal err:', e); }
        }, 250);
      }
      
      // Event
      emit('page_changed', { tab: cmd.tab, sub: cmd.sub, label: cmd.reply });
      
      return {
        ok: true,
        message: cmd.reply,
        navigate: { tab: cmd.tab, sub: cmd.sub, modal: cmd.modal },
      };
    }
    
    // ═══ Form ═══
    if (cmd.kind === 'form') {
      emit('form_opened', { label: cmd.reply });
      try { _nav.setTab?.(cmd.tab || 'exchange'); } catch {}
      if (cmd.sub) setTimeout(() => { try { _nav.setSub?.(cmd.sub!); } catch {} }, 100);
      if (cmd.modal) setTimeout(() => { try { _nav.openModal?.(cmd.modal!); } catch {} }, 250);
      
      return {
        ok: true,
        message: cmd.reply,
        navigate: { tab: cmd.tab, sub: cmd.sub, modal: cmd.modal },
      };
    }
    
    // ═══ Query — سؤال ═══
    if (cmd.kind === 'query') {
      // ۱. مانده
      if (cmd.params?.person && cmd.action === 'ask') {
        const q = String(cmd.params.query || '').toLowerCase();
        
        // مانده
        if (/مانده|حساب|حساب/.test(q)) {
          const c = await findCustomer(cmd.params.person);
          if (c) {
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            const raw = await AsyncStorage.getItem('@mizan_manual_balances_v1');
            const bals = raw ? JSON.parse(raw) : {};
            const bal = bals[c.id || c.local_id] || 0;
            const label = bal > 0 ? '🟢 طلبکار' : bal < 0 ? '🔴 بدهکار' : '⚪ تسویه';
            return {
              ok: true,
              message: `👤 ${c.name}: ${Math.abs(bal).toLocaleString('en-US')} — ${label}`,
              panel: { kind: 'customer', customer: c, balance: bal },
            };
          }
        }
        
        // سود
        if (/سود|درآمد/.test(q)) {
          const lib = await import('./lib');
          const sales = await lib.getSalesGrouped() || [];
          const today = Date.now() - 24 * 60 * 60 * 1000;
          const todayS = sales.filter((s: any) => new Date(s.date || 0).getTime() >= today);
          const total = todayS.reduce((s: number, x: any) => s + (Number(x.total) || 0), 0);
          return {
            ok: true,
            message: `📊 امروز: ${todayS.length} معامله — ${total.toLocaleString('en-US')}`,
            panel: { kind: 'stats', count: todayS.length, total },
          };
        }
        
        // بدهکاران
        if (/بدهکار|طلبکار/.test(q)) {
          try {
            const cc = await import('./lib.fx.cust');
            const custs = await cc.getAllCust() || [];
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            const raw = await AsyncStorage.getItem('@mizan_manual_balances_v1');
            const bals = raw ? JSON.parse(raw) : {};
            const list: any[] = [];
            for (const c of custs) {
              const bal = bals[c.id || c.local_id] || 0;
              if (bal < 0) list.push({ name: c.name, balance: bal });
            }
            list.sort((a, b) => a.balance - b.balance);
            const msg = list.slice(0, 10).map(x => `• ${x.name}: ${Math.abs(x.balance).toLocaleString('en-US')}`).join('\n');
            return {
              ok: true,
              message: list.length ? `🔴 ${list.length} بدهکار:\n` + msg : '⚪ هیچ بدهکاری نداری',
              panel: { kind: 'debtors', list },
            };
          } catch {}
        }
        
        // همه صندوق‌ها
        if (/صندوق/.test(q)) {
          const bx = await import('./lib.boxes');
          const boxes = await bx.getBoxes() || [];
          const bals = await bx.getAllBalances() || {};
          const lines = boxes.map((b: any) => {
            const bal = bals[b.id || b.local_id] || 0;
            return `• ${b.name} (${b.currency}): ${bal.toLocaleString('en-US')}`;
          });
          return {
            ok: true,
            message: '📦 صندوق‌ها:\n' + lines.join('\n'),
            panel: { kind: 'list_boxes', list: boxes.map((b: any) => ({ kind: 'box', box: { ...b, _balance: bals[b.id || b.local_id] || 0 } })) },
          };
        }
      }
      
      // ۲. جستجوی شخص
      if (cmd.action === 'findPerson' && cmd.params?.person) {
        const person = cmd.params.person;
        
        // اول صندوق
        const box = await findBox(person, cmd.params.currency);
        if (box) {
          const bx = await import('./lib.boxes');
          const txs = await bx.getBoxTransactions(box.id || box.local_id) || [];
          return {
            ok: true,
            message: `📦 ${box.name} — ${(box._balance || 0).toLocaleString('en-US')} ${box.currency}`,
            panel: { kind: 'box', box, txs },
          };
        }
        
        // بعد مشتری
        const c = await findCustomer(person);
        if (c) {
          const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
          const raw = await AsyncStorage.getItem('@mizan_manual_balances_v1');
          const bals = raw ? JSON.parse(raw) : {};
          const bal = bals[c.id || c.local_id] || 0;
          return {
            ok: true,
            message: `👤 ${c.name}${c.phone ? ' — ' + c.phone : ''}`,
            panel: { kind: 'customer', customer: c, balance: bal },
          };
        }
        
        return { ok: false, message: `❌ ${person} پیدا نشد` };
      }
      
      return { ok: false, message: '🤔 نفهمیدم چی می‌خوای' };
    }
    
    // ═══ Action — واریز/برداشت ═══
    if (cmd.kind === 'action') {
      if (cmd.action === 'deposit' || cmd.action === 'withdraw') {
        return {
          ok: true,
          message: '⚠️ آماده: ' + cmd.reply + '\n\nتأیید می‌کنی؟',
          needConfirm: true,
          action: cmd,
        };
      }
    }
    
    // ═══ نامفهوم ═══
    return { ok: false, message: cmd.reply };
  } catch (e: any) {
    emit('error_occurred', { message: e?.message || 'خطای اجرا' });
    return { ok: false, message: '❌ خطا: ' + (e?.message || 'ناشناخته') };
  }
}

// ═══════════════════════════════════════════
// اجرای Action تأیید‌شده
// ═══════════════════════════════════════════
export async function executeConfirmed(cmd: ParsedCommand): Promise<ExecResult> {
  try {
    if (cmd.action === 'deposit' || cmd.action === 'withdraw') {
      const person = cmd.params.person;
      const amount = Number(cmd.params.amount) || 0;
      const currency = cmd.params.currency || 'AFN';
      
      if (amount <= 0) return { ok: false, message: '❌ مبلغ معتبر نیست' };
      
      // اول صندوق
      const box = await findBox(person, currency);
      if (box) {
        const bx = await import('./lib.boxes');
        await bx.addBoxTransaction({
          box_id: box.id || box.local_id,
          box_code: box.code,
          type: cmd.action === 'deposit' ? 'deposit' : 'withdraw',
          amount,
          currency: box.currency || 'AFN',
          description: (cmd.action === 'deposit' ? 'واریز' : 'برداشت') + ' از دستیار',
          date: new Date().toISOString(),
        });
        
        emit(cmd.action === 'deposit' ? 'box_deposit' : 'box_withdraw', {
          box_name: box.name,
          amount,
          currency: box.currency,
        });
        
        // رفرش
        const bals = await bx.getAllBalances() || {};
        const newBal = bals[box.id || box.local_id] || 0;
        const txs = await bx.getBoxTransactions(box.id || box.local_id) || [];
        
        return {
          ok: true,
          message: `✅ ${cmd.action === 'deposit' ? 'واریز' : 'برداشت'} ${amount.toLocaleString('en-US')} ${box.currency}\n💰 موجودی: ${newBal.toLocaleString('en-US')}`,
          panel: { kind: 'box', box: { ...box, _balance: newBal }, txs },
        };
      }
      
      return { ok: false, message: `❌ صندوق ${person} پیدا نشد` };
    }
    
    return { ok: false, message: '❌ این action پشتیبانی نمی‌شه' };
  } catch (e: any) {
    return { ok: false, message: '❌ ' + (e?.message || 'خطا') };
  }
}

// ═══════════════════════════════════════════
// خلاصه روز — از رویدادها
// ═══════════════════════════════════════════
export async function getTodaySummary(): Promise<ExecResult> {
  try {
    const { getTodaySummary: getSummary } = await import('./lib.app.events');
    const summary = await getSummary();
    return { ok: true, message: summary };
  } catch (e: any) {
    return { ok: false, message: '❌ ' + (e?.message || '') };
  }
}
