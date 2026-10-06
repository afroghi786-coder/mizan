// lib.box-auto.ts — اتصال خودکار معامله به صندوق
import { getBoxes, saveBox, addBoxTransaction } from './lib.boxes';

/**
 * وقتی معامله ثبت می‌شود، صندوق‌های خریدار (طرف حساب) را به‌روز می‌کند.
 *
 * منطق:
 *   خریدار معامله «from_currency» را می‌ده و «to_currency» را می‌گیرد.
 *   → صندوق from_currency خریدار: -from_qty
 *   → صندوق to_currency خریدار: +to_qty
 *
 * اگر صندوقی برای خریدار وجود نداشت، خودکار ساخته می‌شود.
 */
export async function applyTradeToBoxes(trade: any, tradeCode: string): Promise<void> {
  try {
    if (!trade) return;
    const from = String(trade.from_currency || '').trim();
    const to = String(trade.to_currency || '').trim();
    const fromQty = Number(trade.from_qty) || 0;
    const toQty = Number(trade.to_qty) || 0;
    if (!from || !to || from === to) return;

    // ═══ خریدار (partner) ═══
    const buyerCode = trade.buyer_code || trade.partner_code || '';
    const buyerName = trade.buyer_name || trade.partner_name || '';
    if (buyerCode) {
      // صندوق from_currency خریدار: کاهش
      if (fromQty > 0) {
        await ensureBoxAndTx({
          ownerCode: buyerCode, ownerName: buyerName, currency: from,
          inAmt: 0, outAmt: fromQty,
          type: 'trade_out',
          related: to,
          description: 'معامله ' + tradeCode + ' — پرداخت ' + from,
          date: trade.date || '',
        });
      }
      // صندوق to_currency خریدار: افزایش
      if (toQty > 0) {
        await ensureBoxAndTx({
          ownerCode: buyerCode, ownerName: buyerName, currency: to,
          inAmt: toQty, outAmt: 0,
          type: 'trade_in',
          related: from,
          description: 'معامله ' + tradeCode + ' — دریافت ' + to,
          date: trade.date || '',
        });
      }
    }

    // ═══ مشتری (customer) — اگر صندوق داشته باشد، معکوس ═══
    const custCode = trade.customer_code || '';
    const custName = trade.customer_name || '';
    if (custCode && custCode !== buyerCode) {
      // مشتری مخالف خریدار عمل می‌کند
      if (fromQty > 0) {
        await ensureBoxAndTx({
          ownerCode: custCode, ownerName: custName, currency: from,
          inAmt: fromQty, outAmt: 0,
          type: 'trade_in',
          related: to,
          description: 'معامله ' + tradeCode + ' — دریافت ' + from,
          date: trade.date || '',
        });
      }
      if (toQty > 0) {
        await ensureBoxAndTx({
          ownerCode: custCode, ownerName: custName, currency: to,
          inAmt: 0, outAmt: toQty,
          type: 'trade_out',
          related: from,
          description: 'معامله ' + tradeCode + ' — پرداخت ' + to,
          date: trade.date || '',
        });
      }
    }
  } catch (e) {
    console.log('applyTradeToBoxes error:', e);
  }
}

async function ensureBoxAndTx(p: {
  ownerCode: string; ownerName: string; currency: string;
  inAmt: number; outAmt: number; type: string;
  related: string; description: string; date: string;
}) {
  const boxes = await getBoxes();
  let box = boxes.find((b: any) => b.owner_code === p.ownerCode && b.currency === p.currency);
  if (!box) {
    // ساخت صندوق خودکار
    box = await saveBox({
      name: 'صندوق ' + (p.currency) + ' — ' + (p.ownerName || p.ownerCode),
      currency: p.currency,
      owner_code: p.ownerCode,
      owner_name: p.ownerName,
      opening: 0,
      auto: true,
    });
  }
  const boxId = box.id || box.local_id;
  await addBoxTransaction({
    box_id: boxId, box_code: box.code, type: p.type,
    in: p.inAmt, out: p.outAmt, currency: p.currency,
    related_box_code: p.related,
    description: p.description, date: p.date,
  });
}
