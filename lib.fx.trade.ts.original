// lib.fx.trade.ts — ذخیره‌ی معامله + auto-sync به مشتریان/خریداران
import AsyncStorage from '@react-native-async-storage/async-storage';

const TRADE_KEY = '@mizan_trades_v2';
const CUST_KEY  = '@mizan_customers_v2';

// ═══════════════════════════════════════════
//  معاملات
// ═══════════════════════════════════════════
export async function getAllTrades(): Promise<any[]> {
  try {
    const r = await AsyncStorage.getItem(TRADE_KEY);
    if (!r) return [];
    const p = JSON.parse(r);
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}

async function saveCustRaw(item: any): Promise<void> {
  const r = await AsyncStorage.getItem(CUST_KEY);
  const all = r ? JSON.parse(r) : [];
  const arr = Array.isArray(all) ? all : [];
  const idx = arr.findIndex((x: any) => x.code === item.code);
  if (idx >= 0) {
    arr[idx] = { ...arr[idx], ...item, updated_at: new Date().toISOString() };
  } else {
    arr.unshift({ ...item, created_at: new Date().toISOString() });
  }
  await AsyncStorage.setItem(CUST_KEY, JSON.stringify(arr));
}

async function getCustRaw(): Promise<any[]> {
  try {
    const r = await AsyncStorage.getItem(CUST_KEY);
    if (!r) return [];
    const p = JSON.parse(r);
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}

// ═══════════════════════════════════════════
//  ذخیره‌ی هوشمند معامله
//  - اگر خریدار جدید بود → در تب خریداران ثبت
//  - اگر مشتری جدید بود → در تب مشتریان ثبت
//  - هر دو snapshot کامل در معامله
// ═══════════════════════════════════════════
export async function saveTrade(item: any): Promise<any> {
  const all = await getAllTrades();
  const id = item.id || ('tr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
  const invoice_number = item.invoice_number || ('FX-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(all.length + 1).padStart(3, '0'));

  // ═══ چک و ثبت خریدار ═══
  const buyerPhone = String(item.buyer_phone || '').replace(/[^\d]/g, '');
  const buyerCode = item.buyer_code || (buyerPhone ? 'B_' + buyerPhone : '');
  if (buyerCode) {
    const existing = await getCustRaw();
    const found = existing.find((x: any) => x.code === buyerCode);
    if (!found && buyerPhone.length >= 10) {
      await saveCustRaw({
        code: buyerCode,
        name: item.buyer_name || '',
        phone: buyerPhone,
        bank: item.buyer_bank || '',
        account_number: item.buyer_account || '',
        holder_name: item.buyer_holder || '',
        address: item.buyer_address || '',
        note: item.buyer_note || '',
        type: 'buyer',
      });
    }
  }

  // ═══ چک و ثبت مشتری ═══
  const custPhone = String(item.customer_phone || '').replace(/[^\d]/g, '');
  const custCode = item.customer_code || (custPhone ? 'X_' + custPhone : '');
  if (custCode) {
    const existing = await getCustRaw();
    const found = existing.find((x: any) => x.code === custCode);
    if (!found && custPhone.length >= 10) {
      await saveCustRaw({
        code: custCode,
        name: item.customer_name || '',
        phone: custPhone,
        bank: item.customer_bank || '',
        account_number: item.customer_account || '',
        holder_name: item.customer_holder || '',
        address: item.customer_address || '',
        note: item.customer_note || '',
        type: 'customer',
      });
    }
  }

  // ═══ snapshot کامل در معامله ═══
  const newItem = {
    ...item,
    id,
    invoice_number,
    buyer_code: buyerCode,
    customer_code: custCode,
    // snapshot خریدار
    buyer_snapshot: {
      code: buyerCode,
      name: item.buyer_name || '',
      phone: buyerPhone,
      bank: item.buyer_bank || '',
      account_number: item.buyer_account || '',
      holder_name: item.buyer_holder || '',
      address: item.buyer_address || '',
      note: item.buyer_note || '',
    },
    // snapshot مشتری
    customer_snapshot: {
      code: custCode,
      name: item.customer_name || '',
      phone: custPhone,
      bank: item.customer_bank || '',
      account_number: item.customer_account || '',
      holder_name: item.customer_holder || '',
      address: item.customer_address || '',
      note: item.customer_note || '',
    },
    created_at: item.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const idx = all.findIndex((x: any) => x.id === id);
  const newList = idx >= 0
    ? all.map((x: any, i: number) => i === idx ? newItem : x)
    : [newItem, ...all];

  await AsyncStorage.setItem(TRADE_KEY, JSON.stringify(newList));
  return newItem;
}

export async function deleteTrade(id: string): Promise<void> {
  const all = await getAllTrades();
  await AsyncStorage.setItem(TRADE_KEY, JSON.stringify(all.filter((x: any) => x.id !== id)));
}
