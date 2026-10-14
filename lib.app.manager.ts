// lib.app.manager.ts — مدیر پنل‌ها
// تصمیم می‌گیره با هر دستور، کدوم پنل باز بشه

import { ParsedCommand } from './lib.app.parser';
import {
  Panel, buildWelcomePanel, buildBoxPanel, buildBoxListPanel,
  buildCustomerPanel, buildCustomerListPanel, buildInvoiceListPanel,
  buildInvoiceCardPanel, buildHawalaListPanel, buildCheckListPanel,
  buildRateListPanel, buildStatsPanel, buildHelpPanel, buildSearchPanel,
} from './lib.app.panels';

// ═══════════════════════════════════════════
// اجرای دستور → برگرداندن پنل
// ═══════════════════════════════════════════
export interface ManagerResult {
  ok: boolean;
  panel?: Panel;
  message: string;
  needConfirm?: boolean;
  pendingAction?: any;
}

export async function handleCommand(cmd: ParsedCommand, rawText: string): Promise<ManagerResult> {
  const t = (rawText || '').toLowerCase().trim();
  const { person, currency, amount } = cmd.params || {};

  try {
    // ═══ راهنما
    if (cmd.action === 'help' || /راهنما|کمک|چیکار/.test(t)) {
      return { ok: true, panel: buildHelpPanel(), message: 'راهنما رو ببین' };
    }

    // ═══ خلاصه / سود
    if (/خلاصه|گزارش/.test(t) || cmd.action === 'today_profit') {
      return { ok: true, panel: await buildStatsPanel('today'), message: 'آمار امروز' };
    }
    if (/سود/.test(t)) {
      const range = /هفته/.test(t) ? 'week' : /ماه/.test(t) ? 'month' : 'today';
      return { ok: true, panel: await buildStatsPanel(range as any), message: 'آمار سود' };
    }

    // ═══ نرخ‌ها
    if (/نرخ|قیمت ارز/.test(t)) {
      return { ok: true, panel: await buildRateListPanel(), message: 'نرخ‌های امروز' };
    }

    // ═══ چک‌ها
    if (/چک/.test(t)) {
      return { ok: true, panel: await buildCheckListPanel(), message: 'چک‌ها' };
    }

    // ═══ حواله‌جات
    if (/حواله/.test(t)) {
      if (person) {
        return { ok: true, panel: await buildHawalaListPanel(person), message: 'حواله‌های ' + person };
      }
      return { ok: true, panel: await buildHawalaListPanel(), message: 'حواله‌جات' };
    }

    // ═══ فاکتور
    if (/فاکتور|فاکتر|فروش|خرید/.test(t)) {
      if (/خرید/.test(t)) {
        return { ok: true, panel: await buildInvoiceListPanel(person, 'purchase'), message: 'فاکتورهای خرید' };
      }
      const invNum = t.match(/(\\d{3,})/);
      if (invNum) {
        const card = await buildInvoiceCardPanel(invNum[1]);
        if (card) return { ok: true, panel: card, message: 'فاکتور ' + invNum[1] };
      }
      if (person) {
        return { ok: true, panel: await buildInvoiceListPanel(person, 'sale'), message: 'فاکتورهای ' + person };
      }
      return { ok: true, panel: await buildInvoiceListPanel(undefined, 'sale'), message: 'فاکتورهای فروش' };
    }

    // ═══ مشتری
    if (/مشتری|طرف.?حساب|اشخاص/.test(t)) {
      if (/بدهکار/.test(t)) {
        return { ok: true, panel: await buildCustomerListPanel(), message: 'مشتریان' };
      }
      if (person) {
        const card = await buildCustomerPanel(person);
        if (card) return { ok: true, panel: card, message: card.title };
        return { ok: true, panel: await buildCustomerListPanel(person), message: 'مشتری‌های ' + person };
      }
      return { ok: true, panel: await buildCustomerListPanel(), message: 'مشتریان' };
    }

    // ═══ صندوق
    if (/صندوق|کارتکس|کاردکس|کارت.?کس|حساب/.test(t)) {
      if (person) {
        const card = await buildBoxPanel(person, currency);
        if (card) return { ok: true, panel: card, message: card.title };
        return { ok: true, panel: await buildBoxListPanel(), message: 'صندوق پیدا نشد، همه رو ببین' };
      }
      return { ok: true, panel: await buildBoxListPanel(), message: 'صندوق‌ها' };
    }

    // ═══ واریز/برداشت
    if ((/اضافه|واریز|افزایش/.test(t) || /کم|برداشت|کسر/.test(t)) && amount && person) {
      const isDeposit = /اضافه|واریز|افزایش/.test(t);
      return {
        ok: true,
        message: '⚠️ ' + (isDeposit ? 'واریز' : 'برداشت') + ' ' + amount.toLocaleString('en-US') + ' ' + (currency || 'AFN') + ' ' + (isDeposit ? 'به' : 'از') + ' ' + person + ' — تأیید؟',
        needConfirm: true,
        pendingAction: {
          type: isDeposit ? 'deposit' : 'withdraw',
          person,
          amount,
          currency: currency || 'AFN',
        },
      };
    }

    // ═══ فقط اسم → جستجو
    if (person && person.length >= 2) {
      const boxCard = await buildBoxPanel(person, currency);
      if (boxCard) return { ok: true, panel: boxCard, message: boxCard.title };

      const custCard = await buildCustomerPanel(person);
      if (custCard) return { ok: true, panel: custCard, message: custCard.title };

      const searchPanel = await buildSearchPanel(person);
      if (searchPanel.data.results?.length > 0) {
        return { ok: true, panel: searchPanel, message: searchPanel.data.results.length + ' نتیجه' };
      }

      return { ok: false, message: '❌ چیزی به اسم «' + person + '» پیدا نشد' };
    }


    // ═══ خرید ═══
    if (/خرید/.test(t) && /فاکتور|جدید|بزن|بساز|ثبت/.test(t)) {
      const w = await import('./lib.app.wizard');
      const state = w.startWizard('purchase');
      if (state) return { ok: true, panel: undefined, message: '📝 فاکتور خرید — شروع' };
    }

    // ═══ انبار ═══
    if (/انبار|موجودی|کالا|جنس/.test(t)) {
      return { ok: true, message: '📦 انبار — به‌زودی', panel: buildWelcomePanel() };
    }

    // ═══ هزینه ═══
    if (/هزینه|خرج/.test(t)) {
      return { ok: true, message: '🧾 هزینه — به‌زودی', panel: buildWelcomePanel() };
    }

    // ═══ کارمند ═══
    if (/کارمند|کارگر|پرسنل/.test(t)) {
      return { ok: true, message: '💼 کارمند — به‌زودی', panel: buildWelcomePanel() };
    }

    // ═══ سود / گزارش ═══
    if (/سود|گزارش|آمار/.test(t)) {
      const range = /هفته/.test(t) ? 'week' : /ماه/.test(t) ? 'month' : 'today';
      return { ok: true, panel: await buildStatsPanel(range as any), message: 'آمار ' + range };
    }

    // ═══ فرم‌های جدید — برگردوندن به wizard ═══
    if (/فاکتور\s*فروش/.test(t) && /جدید|بزن|بساز|ثبت/.test(t)) {
      return { ok: true, panel: undefined, message: '📝 فاکتور فروش — شروع', _wizard: 'invoice' };
    }
    if (/فاکتور\s*خرید/.test(t) && /جدید|بزن|بساز|ثبت/.test(t)) {
      return { ok: true, panel: undefined, message: '📝 فاکتور خرید — شروع', _wizard: 'purchase' };
    }
    if (/صندوق/.test(t) && /جدید|بزن|بساز|ثبت/.test(t)) {
      return { ok: true, panel: undefined, message: '📝 صندوق جدید — شروع', _wizard: 'box' };
    }
    if (/مشتری/.test(t) && /جدید|بزن|بساز|ثبت|اضافه/.test(t)) {
      return { ok: true, panel: undefined, message: '📝 مشتری جدید — شروع', _wizard: 'customer' };
    }
    if (/حواله/.test(t) && /جدید|بزن|بساز|ثبت/.test(t)) {
      return { ok: true, panel: undefined, message: '📝 حواله جدید — شروع', _wizard: 'hawala' };
    }
    if (/نرخ/.test(t) && /جدید|بزن|بساز|ثبت|اضافه/.test(t)) {
      return { ok: true, panel: undefined, message: '📝 نرخ جدید — شروع', _wizard: 'rate' };
    }
    if (/چک/.test(t) && /جدید|بزن|بساز|ثبت/.test(t)) {
      return { ok: true, panel: undefined, message: '📝 چک جدید — شروع', _wizard: 'check' };
    }
    // ═══ ناشناخته
    return {
      ok: true,
      panel: buildWelcomePanel(),
      message: '🤔 نفهمیدم. ببین چی می‌تونم بکنم:',
    };
  } catch (e: any) {
    console.log('handleCommand err:', e);
    return { ok: false, message: '❌ خطا: ' + (e?.message || 'ناشناخته') };
  }
}

// ═══════════════════════════════════════════
// اجرای action تأیید‌شده
// ═══════════════════════════════════════════
export async function executeApproved(action: any): Promise<ManagerResult> {
  try {
    if (action.type === 'deposit' || action.type === 'withdraw') {
      const bx = await import('./lib.boxes');
      const boxes = await bx.getBoxes() || [];

      let box: any = null;
      let bestScore = 0;
      const { nameScore } = await import('./lib.local.nlu');
      const cur = action.currency?.toUpperCase();

      for (const b of boxes) {
        if (cur && String(b.currency || '').toUpperCase() !== cur) continue;
        const s = Math.max(
          nameScore(b.name || '', action.person),
          nameScore(b.code || '', action.person),
          nameScore(b.owner_name || '', action.person)
        );
        if (s > bestScore) { bestScore = s; box = b; }
      }

      if (!box || bestScore < 40) {
        return { ok: false, message: '❌ صندوق ' + action.person + ' پیدا نشد' };
      }

      await bx.addBoxTransaction({
        box_id: box.id || box.local_id,
        box_code: box.code,
        type: action.type === 'deposit' ? 'deposit' : 'withdraw',
        amount: action.amount,
        currency: box.currency || 'AFN',
        description: (action.type === 'deposit' ? 'واریز' : 'برداشت') + ' از دستیار',
        date: new Date().toISOString(),
      });

      const updatedPanel = await buildBoxPanel(box.name, box.currency);

      return {
        ok: true,
        panel: updatedPanel || undefined,
        message: '✅ ' + (action.type === 'deposit' ? 'واریز' : 'برداشت') + ' ' + action.amount.toLocaleString('en-US') + ' ' + box.currency + ' ' + (action.type === 'deposit' ? 'به' : 'از') + ' ' + box.name,
      };
    }

    return { ok: false, message: '❌ نوع action پشتیبانی نمی‌شه' };
  } catch (e: any) {
    return { ok: false, message: '❌ خطا: ' + (e?.message || '') };
  }
}
