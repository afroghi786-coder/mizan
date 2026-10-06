// lib.fx.trade.ts — فقط AsyncStorage، بدون Supabase
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@mizan_trades_v2';

export async function getAllTrades(): Promise<any[]> {
  try {
    const r = await AsyncStorage.getItem(KEY);
    if (!r) return [];
    const p = JSON.parse(r);
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}

export async function saveTrade(item: any): Promise<any> {
  const all = await getAllTrades();
  const id = item.id || ('tr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
  const invoice_number = item.invoice_number || ('FX-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + String(all.length + 1).padStart(3, '0'));

  const newItem = {
    ...item,
    id,
    invoice_number,
    created_at: item.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const idx = all.findIndex((x: any) => x.id === id);
  const newList = idx >= 0
    ? all.map((x: any, i: number) => i === idx ? newItem : x)
    : [newItem, ...all];

  await AsyncStorage.setItem(KEY, JSON.stringify(newList));
  return newItem;
}

export async function deleteTrade(id: string): Promise<void> {
  const all = await getAllTrades();
  await AsyncStorage.setItem(KEY, JSON.stringify(all.filter((x: any) => x.id !== id)));
}
