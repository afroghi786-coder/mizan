// lib.fx.cust.ts — فقط AsyncStorage، بدون Supabase
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@mizan_customers_v2';

export async function getAllCust(): Promise<any[]> {
  try {
    const r = await AsyncStorage.getItem(KEY);
    if (!r) return [];
    const p = JSON.parse(r);
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}

export async function saveCust(item: any): Promise<any> {
  const all = await getAllCust();
  const phone = String(item.phone || '').replace(/[^\d]/g, '');
  const type = item.type || 'customer';
  const prefix = type === 'buyer' ? 'B_' : 'X_';
  const code = item.code || (prefix + phone);

  const idx = all.findIndex((x: any) => x.code === code);
  const newItem = {
    ...item,
    phone,
    code,
    type,
    id: item.id || ('id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
    updated_at: new Date().toISOString(),
  };

  const newList = idx >= 0
    ? all.map((x: any, i: number) => i === idx ? newItem : x)
    : [newItem, ...all];

  await AsyncStorage.setItem(KEY, JSON.stringify(newList));
  return newItem;
}

export async function deleteCust(id: string): Promise<void> {
  const all = await getAllCust();
  const filtered = all.filter((x: any) => x.id !== id && x.code !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(filtered));
}
