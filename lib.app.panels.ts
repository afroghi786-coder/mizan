// lib.app.panels.ts — پنل‌های داخل اتاق ربات
// همه داده‌ها رو میاره که ربات نمایش بده (نه ناوبری)

import { ParsedCommand } from './lib.app.parser';

export interface PanelAction {
  label: string;
  icon: string;
  action: string;
  params?: any;
  confirm?: boolean;
}

export interface Panel {
  id: string;
  type: string;
  title: string;
  icon: string;
  data: any;
  actions?: PanelAction[];
  fields?: any[];
  editable?: boolean;
}

// ═══════════════════════════════════════════
// Helper: name match
// ═══════════════════════════════════════════
async function matchName(text: string, query: string): Promise<number> {
  try {
    const { nameScore } = await import('./lib.local.nlu');
    return nameScore(text || '', query || '');
  } catch {
    if (!text || !query) return 0;
    const t = String(text).toLowerCase();
    const q = String(query).toLowerCase();
    if (t === q) return 100;
    if (t.includes(q)) return 70;
    return 0;
  }
}

// ═══════════════════════════════════════════
// 🏠 Panel: خوش‌آمد
// ═══════════════════════════════════════════
export function buildWelcomePanel(): Panel {
  return {
    id: 'welcome',
    type: 'welcome',
    title: '🤖 خوش آمدی',
    icon: '🤖',
    data: {
      message: 'هر کاری داری، بگو انجام بدم — همه چیز همین‌جا',
      hints: [
        '📦 صندوق احمد',
        '👥 مشتریان',
        '📄 فاکتور فروش',
        '📊 سود امروز',
        '📈 نرخ دالر',
        '🔍 [هر چیزی که می‌خوای]',
      ],
    },
  };
}

// ═══════════════════════════════════════════
// 📦 Panel: صندوق (کارت + تراکنش + دکمه‌ها)
// ═══════════════════════════════════════════
export async function buildBoxPanel(name: string, currency?: string): Promise<Panel | null> {
  try {
    const bx = await import('./lib.boxes');
    const boxes = await bx.getBoxes() || [];
    const bals = await bx.getAllBalances() || {};
    const cur = currency ? String(currency).toUpperCase() : '';
    
    let best: any = null;
    let bestScore = 0;
    
    // با فیلتر ارز
    for (const b of boxes) {
      if (cur && String(b.currency || '').toUpperCase() !== cur) continue;
      const s = Math.max(
        await matchName(b.name, name),
        await matchName(b.code, name),
        await matchName(b.owner_name, name)
      );
      if (s > bestScore) { bestScore = s; best = b; }
    }
    
    // بدون فیلتر ارز
    if (!best && cur) {
      for (const b of boxes) {
        const s = Math.max(
          await matchName(b.name, name),
          await matchName(b.code, name),
          await matchName(b.owner_name, name)
        );
        if (s > bestScore) { bestScore = s; best = b; }
      }
    }
    
    if (!best || bestScore < 40) return null;
    
    const bal = bals[best.id || best.local_id] || 0;
    const txs = await bx.getBoxTransactions(best.id || best.local_id) || [];
    
    return {
      id: 'box_' + (best.id || best.local_id),
      type: 'box',
      title: best.name || best.code,
      icon: '📦',
      data: {
        box: best,
        balance: bal,
        currency: best.currency || 'AFN',
        owner: best.owner_name,
        code: best.code,
        txs: txs.slice(0, 15),
        txCount: txs.length,
      },
      actions: [
        { label: 'افزودن', icon: '➕', action: 'ask_deposit', params: { boxId: best.id || best.local_id, name: best.name } },
        { label: 'کاهش', icon: '➖', action: 'ask_withdraw', params: { boxId: best.id || best.local_id, name: best.name } },
        { label: 'کارتکس کامل', icon: '📋', action: 'full_kardex', params: { boxId: best.id || best.local_id, name: best.name } },
      ],
    };
  } catch (e) { console.log('buildBoxPanel err:', e); return null; }
}

// ═══════════════════════════════════════════
// 📦 Panel: لیست صندوق‌ها
// ═══════════════════════════════════════════
export async function buildBoxListPanel(): Promise<Panel> {
  try {
    const bx = await import('./lib.boxes');
    const boxes = await bx.getBoxes() || [];
    const bals = await bx.getAllBalances() || {};
    
    const list = boxes.map((b: any) => ({
      id: b.id || b.local_id,
      name: b.name || b.code || 'صندوق',
      code: b.code,
      currency: b.currency || 'AFN',
      owner: b.owner_name,
      balance: bals[b.id || b.local_id] || 0,
    }));
    
    return {
      id: 'box_list',
      type: 'box_list',
      title: 'صندوق‌ها',
      icon: '📦',
      data: { list },
      actions: [
        { label: 'صندوق جدید', icon: '🆕', action: 'open_form', params: { form: 'box' } },
      ],
    };
  } catch (e) {
    return { id: 'err', type: 'error', title: 'خطا', icon: '❌', data: { message: String(e) } };
  }
}

// ═══════════════════════════════════════════
// 👤 Panel: مشتری (کارت)
// ═══════════════════════════════════════════
export async function buildCustomerPanel(name: string): Promise<Panel | null> {
  try {
    const cc = await import('./lib.fx.cust');
    const custs = await cc.getAllCust() || [];
    
    let best: any = null;
    let bestScore = 0;
    for (const c of custs) {
      const s = Math.max(
        await matchName(c.name, name),
        await matchName(c.phone, name),
        await matchName(c.code, name)
      );
      if (s > bestScore) { bestScore = s; best = c; }
    }
    if (!best || bestScore < 40) return null;
    
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const raw = await AsyncStorage.getItem('@mizan_manual_balances_v1');
    const bals = raw ? JSON.parse(raw) : {};
    const bal = bals[best.id || best.local_id] || 0;
    
    return {
      id: 'cust_' + (best.id || best.local_id),
      type: 'customer',
      title: best.name,
      icon: '👤',
      data: {
        customer: best,
        balance: bal,
        phone: best.phone,
        bank: best.bank,
        holder: best.holder_name,
        code: best.code,
      },
      actions: [
        { label: 'واریز', icon: '➕', action: 'ask_deposit_cust', params: { name: best.name } },
        { label: 'برداشت', icon: '➖', action: 'ask_withdraw_cust', params: { name: best.name } },
        { label: 'فاکتور جدید', icon: '🆕', action: 'new_invoice_for', params: { customerName: best.name, customer: best } },
        { label: 'ویرایش', icon: '✏️', action: 'edit_customer', params: { customer: best } },
      ],
    };
  } catch (e) { console.log('buildCustomerPanel err:', e); return null; }
}

// ═══════════════════════════════════════════
// 👥 Panel: لیست مشتریان
// ═══════════════════════════════════════════
export async function buildCustomerListPanel(filter?: string): Promise<Panel> {
  try {
    const cc = await import('./lib.fx.cust');
    const custs = await cc.getAllCust() || [];
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const raw = await AsyncStorage.getItem('@mizan_manual_balances_v1');
    const bals = raw ? JSON.parse(raw) : {};
    
    let list = custs.map((c: any) => ({
      id: c.id || c.local_id,
      name: c.name,
      phone: c.phone,
      balance: bals[c.id || c.local_id] || 0,
    }));
    
    if (filter) {
      const q = String(filter).toLowerCase();
      list = list.filter((x: any) => String(x.name || '').toLowerCase().includes(q));
    }
    
    list.sort((a: any, b: any) => a.name.localeCompare(b.name));
    
    return {
      id: 'cust_list',
      type: 'customer_list',
      title: 'مشتریان',
      icon: '👥',
      data: { list, filter },
      actions: [
        { label: 'مشتری جدید', icon: '🆕', action: 'open_form', params: { form: 'customer' } },
      ],
    };
  } catch (e) {
    return { id: 'err', type: 'error', title: 'خطا', icon: '❌', data: { message: String(e) } };
  }
}

// ═══════════════════════════════════════════
// 📄 Panel: لیست فاکتورها
// ═══════════════════════════════════════════
export async function buildInvoiceListPanel(filter?: string, type: 'sale' | 'purchase' = 'sale'): Promise<Panel> {
  try {
    const lib = await import('./lib');
    const fn = type === 'sale' ? lib.getSalesGrouped : lib.getPurchasesGrouped;
    const list = await fn().catch(() => []) || [];
    
    let mapped = list.map((s: any) => ({
      id: s.invoice || s.invoice_number,
      invoice: s.invoice || s.invoice_number,
      name: s.name || s.supplier_name,
      phone: s.phone,
      total: Number(s.total) || 0,
      paid: Number(s.paid) || 0,
      date: s.date,
      items: s.items?.length || 0,
    }));
    
    if (filter) {
      const q = String(filter).toLowerCase();
      mapped = mapped.filter((x: any) =>
        String(x.invoice || '').toLowerCase().includes(q) ||
        String(x.name || '').toLowerCase().includes(q) ||
        String(x.phone || '').toLowerCase().includes(q)
      );
    }
    
    return {
      id: 'inv_list',
      type: 'invoice_list',
      title: type === 'sale' ? 'فاکتورهای فروش' : 'فاکتورهای خرید',
      icon: '📄',
      data: { list: mapped, filter, invType: type },
      actions: [
        { label: 'فاکتور جدید', icon: '🆕', action: 'open_form', params: { form: 'invoice' } },
      ],
    };
  } catch (e) {
    return { id: 'err', type: 'error', title: 'خطا', icon: '❌', data: { message: String(e) } };
  }
}

// ═══════════════════════════════════════════
// 📄 Panel: کارت فاکتور (جزئیات)
// ═══════════════════════════════════════════
export async function buildInvoiceCardPanel(invoiceId: string): Promise<Panel | null> {
  try {
    const lib = await import('./lib');
    const list = await lib.getSalesGrouped().catch(() => []) || [];
    const inv = list.find((s: any) => String(s.invoice || '').includes(invoiceId));
    if (!inv) return null;
    
    return {
      id: 'inv_' + inv.invoice,
      type: 'invoice',
      title: 'فاکتور ' + inv.invoice,
      icon: '📄',
      data: {
        invoice: inv,
        items: inv.items || [],
        total: Number(inv.total) || 0,
        paid: Number(inv.paid) || 0,
        remaining: (Number(inv.total) || 0) - (Number(inv.paid) || 0),
      },
      actions: [
        { label: 'ویرایش', icon: '✏️', action: 'edit_invoice', params: { invoice: inv } },
        { label: 'چاپ', icon: '🖨️', action: 'print_invoice', params: { invoice: inv } },
      ],
    };
  } catch (e) { return null; }
}

// ═══════════════════════════════════════════
// 💸 Panel: لیست حواله‌جات
// ═══════════════════════════════════════════
export async function buildHawalaListPanel(filter?: string): Promise<Panel> {
  try {
    const fx = await import('./lib.fx');
    const list = await fx.getHawalas().catch(() => []) || [];
    
    let mapped = list.map((h: any) => ({
      id: h.local_id || h.id,
      code: h.code,
      direction: h.direction,
      sender: h.sender_name,
      beneficiary: h.beneficiary_name,
      amount: Number(h.amount) || 0,
      currency: h.currency || 'AFN',
      status: h.status || 'pending',
      date: h.date,
    }));
    
    if (filter) {
      const q = String(filter).toLowerCase();
      mapped = mapped.filter((x: any) =>
        String(x.code || '').toLowerCase().includes(q) ||
        String(x.sender || '').toLowerCase().includes(q) ||
        String(x.beneficiary || '').toLowerCase().includes(q)
      );
    }
    
    return {
      id: 'haw_list',
      type: 'hawala_list',
      title: 'حواله‌جات',
      icon: '💸',
      data: { list: mapped, filter },
      actions: [
        { label: 'حواله جدید', icon: '🆕', action: 'open_form', params: { form: 'hawala' } },
      ],
    };
  } catch (e) {
    return { id: 'err', type: 'error', title: 'خطا', icon: '❌', data: { message: String(e) } };
  }
}

// ═══════════════════════════════════════════
// 🧾 Panel: لیست چک‌ها
// ═══════════════════════════════════════════
export async function buildCheckListPanel(): Promise<Panel> {
  try {
    const fx = await import('./lib.fx');
    const list = await fx.getChecks().catch(() => []) || [];
    const mapped = list.map((c: any) => ({
      id: c.local_id || c.id,
      direction: c.direction,
      number: c.check_number,
      bank: c.bank,
      amount: Number(c.amount) || 0,
      currency: c.currency || 'AFN',
      status: c.status || 'pending',
      date: c.date,
    }));
    
    return {
      id: 'chk_list',
      type: 'check_list',
      title: 'چک‌ها',
      icon: '🧾',
      data: { list: mapped },
      actions: [
        { label: 'چک جدید', icon: '🆕', action: 'open_form', params: { form: 'check' } },
      ],
    };
  } catch (e) {
    return { id: 'err', type: 'error', title: 'خطا', icon: '❌', data: { message: String(e) } };
  }
}

// ═══════════════════════════════════════════
// 📈 Panel: لیست نرخ‌ها
// ═══════════════════════════════════════════
export async function buildRateListPanel(): Promise<Panel> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const raw = await AsyncStorage.getItem('@mizan_local_daily_rates');
    const rates = raw ? JSON.parse(raw) : [];
    
    const mapped = (rates || []).map((r: any) => ({
      currency: r.currency,
      rate: Number(r.rate) || 0,
      date: r.date,
    }));
    
    return {
      id: 'rate_list',
      type: 'rate_list',
      title: 'نرخ‌های امروز',
      icon: '📈',
      data: { list: mapped },
      actions: [
        { label: 'نرخ جدید', icon: '🆕', action: 'open_form', params: { form: 'rate' } },
      ],
    };
  } catch (e) {
    return { id: 'err', type: 'error', title: 'خطا', icon: '❌', data: { message: String(e) } };
  }
}

// ═══════════════════════════════════════════
// 📊 Panel: سود و آمار
// ═══════════════════════════════════════════
export async function buildStatsPanel(range: 'today' | 'week' | 'month' = 'today'): Promise<Panel> {
  try {
    const lib = await import('./lib');
    const sales = await lib.getSalesGrouped().catch(() => []) || [];
    const purchases = await lib.getPurchasesGrouped().catch(() => []) || [];
    
    const now = Date.now();
    const ms = range === 'today' ? 24 * 3600 * 1000 : range === 'week' ? 7 * 24 * 3600 * 1000 : 30 * 24 * 3600 * 1000;
    const since = now - ms;
    
    const f = (x: any) => new Date(x.date || x.created_at || 0).getTime() >= since;
    const s = sales.filter(f);
    const p = purchases.filter(f);
    
    const totalSales = s.reduce((sum: number, x: any) => sum + (Number(x.total) || 0), 0);
    const totalPurch = p.reduce((sum: number, x: any) => sum + (Number(x.total) || 0), 0);
    
    return {
      id: 'stats_' + range,
      type: 'stats',
      title: 'آمار ' + (range === 'today' ? 'امروز' : range === 'week' ? 'هفته' : 'ماه'),
      icon: '📊',
      data: {
        range,
        salesCount: s.length,
        purchasesCount: p.length,
        totalSales,
        totalPurchases: totalPurch,
        profit: totalSales - totalPurch,
        rangeLabel: range === 'today' ? 'امروز' : range === 'week' ? 'این هفته' : 'این ماه',
      },
    };
  } catch (e) {
    return { id: 'err', type: 'error', title: 'خطا', icon: '❌', data: { message: String(e) } };
  }
}

// ═══════════════════════════════════════════
// ❓ Panel: راهنما
// ═══════════════════════════════════════════
export function buildHelpPanel(): Panel {
  return {
    id: 'help',
    type: 'help',
    title: 'راهنما',
    icon: '❓',
    data: {
      sections: [
        {
          title: '📦 صندوق‌ها',
          items: ['«صندوق‌ها» — لیست', '«صندوق احمد» — کارت', '«صندوق دالر فروغی»', '«کارتکس احمد»'],
        },
        {
          title: '👥 مشتریان',
          items: ['«مشتریان» — لیست', '«مشتری احمد» — کارت', '«مانده احمد»'],
        },
        {
          title: '📄 فاکتورها',
          items: ['«فاکتور فروش» — لیست', '«فاکتور جدید» — فرم', '«فاکتور ۱۲۳۴» — جزئیات'],
        },
        {
          title: '💰 عملیات',
          items: ['«۵۰۰ به احمد اضافه کن»', '«۱۰۰ از فروغی کم کن»'],
        },
        {
          title: '📊 گزارش',
          items: ['«سود امروز»', '«خلاصه امروز»', '«کی بدهکاره؟»'],
        },
      ],
    },
  };
}

// ═══════════════════════════════════════════
// 🔍 Panel: نتایج جستجو
// ═══════════════════════════════════════════
export async function buildSearchPanel(query: string): Promise<Panel> {
  try {
    const results: any[] = [];
    
    // صندوق‌ها
    try {
      const bx = await import('./lib.boxes');
      const boxes = await bx.getBoxes() || [];
      const bals = await bx.getAllBalances() || {};
      for (const b of boxes) {
        const s = await matchName(b.name, query);
        if (s >= 40) results.push({
          type: 'box',
          id: b.id || b.local_id,
          name: b.name,
          subtitle: b.currency + ' — ' + (bals[b.id || b.local_id] || 0).toLocaleString('en-US'),
          score: s,
        });
      }
    } catch {}
    
    // مشتریان
    try {
      const cc = await import('./lib.fx.cust');
      const custs = await cc.getAllCust() || [];
      for (const c of custs) {
        const s = await matchName(c.name, query);
        if (s >= 40) results.push({
          type: 'customer',
          id: c.id || c.local_id,
          name: c.name,
          subtitle: c.phone || '',
          score: s,
        });
      }
    } catch {}
    
    results.sort((a, b) => b.score - a.score);
    
    return {
      id: 'search_' + query,
      type: 'search',
      title: 'نتایج جستجو',
      icon: '🔍',
      data: { query, results: results.slice(0, 15) },
    };
  } catch (e) {
    return { id: 'err', type: 'error', title: 'خطا', icon: '❌', data: { message: String(e) } };
  }
}
