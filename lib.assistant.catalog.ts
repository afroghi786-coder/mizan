import { getProducts } from './lib.offline';

function norm(s: any): string {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export type CatalogProduct = {
  code: string;
  name: string;
  color: string;
  price: number;
  shelf: string;
  raw: any;
};

export type CatalogIndex = {
  products: CatalogProduct[];
  byCode: Record<string, CatalogProduct>;
  byName: Record<string, CatalogProduct[]>;
};

function firstString(...vals: any[]): string {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
  }
  return '';
}

function firstNumber(...vals: any[]): number {
  for (const v of vals) {
    const n = Number(v);
    if (!isNaN(n) && n !== 0) return n;
  }
  return 0;
}

function toProduct(p: any): CatalogProduct {
  const code = firstString(p?.code, p?.model_code, p?.modelCode, p?.product_code, p?.sku);
  const name = firstString(p?.name, p?.model_name, p?.modelName, p?.title, p?.product_name, p?.label);
  const color = firstString(p?.color, p?.rang, p?.colour);
  const price = firstNumber(p?.price, p?.price_unit, p?.priceUnit, p?.sale_price, p?.amount);
  const shelf = firstString(p?.shelf, p?.location);
  return { code, name, color, price, shelf, raw: p };
}

export async function buildCatalogIndex(): Promise<CatalogIndex> {
  const list = await getProducts();
  const products: CatalogProduct[] = (Array.isArray(list) ? list : []).map(toProduct).filter(p => p.code || p.name);
  const byCode: Record<string, CatalogProduct> = {};
  const byName: Record<string, CatalogProduct[]> = {};

  for (const p of products) {
    if (p.code) byCode[norm(p.code)] = p;
    const n = norm(p.name);
    if (n) {
      if (!byName[n]) byName[n] = [];
      byName[n].push(p);
    }
  }

  return { products, byCode, byName };
}

function allStrings(obj: any): string {
  try {
    const out: string[] = [];
    const walk = (v: any) => {
      if (v === null || v === undefined) return;
      if (typeof v === 'string' || typeof v === 'number') { out.push(String(v)); return; }
      if (Array.isArray(v)) { for (const x of v) walk(x); return; }
      if (typeof v === 'object') { for (const k of Object.keys(v)) walk(v[k]); }
    };
    walk(obj);
    return out.join(' ').toLowerCase();
  } catch { return ''; }
}

export function findProduct(index: CatalogIndex, query: string): CatalogProduct | null {
  const q = norm(query);
  if (!q) return null;

  if (index.byCode[q]) return index.byCode[q];
  if (index.byName[q] && index.byName[q].length === 1) return index.byName[q][0];

  for (const key of Object.keys(index.byCode)) {
    if (key.includes(q)) return index.byCode[key];
  }

  for (const key of Object.keys(index.byName)) {
    if (key.includes(q)) return index.byName[key][0];
  }

  for (const p of index.products) {
    if (allStrings(p.raw).includes(q)) return p;
  }

  return null;
}

export function searchProducts(index: CatalogIndex, query: string, limit = 10): CatalogProduct[] {
  const q = norm(query);
  if (!q) return index.products.slice(0, limit);
  const exact = index.products.filter(p => norm(p.code).includes(q) || norm(p.name).includes(q));
  if (exact.length) return exact.slice(0, limit);
  return index.products.filter(p => allStrings(p.raw).includes(q)).slice(0, limit);
}
