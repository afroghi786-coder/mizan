import { getParties, createParty, suggestPartyCode, generateCustomerCode } from './lib.offline';

export function normPhone(v: any) {
  let s = String(v || '').replace(/[^0-9]/g, '');
  if (s.length === 10 && s[0] !== '0') s = '0' + s;
  return s;
}

function _asCodeString(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object' && typeof (v as any).code === 'string') return (v as any).code;
  return '';
}

export async function resolvePartyForInvoice(input: {
  name: string;
  phone: string;
  address?: string;
  type?: 'customer' | 'supplier';
}) {
  const phone = normPhone(input.phone);
  const name = String(input.name || '').trim();
  const parties = await getParties();

  const byActivePhone = new Map<string, any>();
  for (const p of (parties || [])) {
    const ph = normPhone((p as any).phone);
    if (ph) byActivePhone.set(ph, p);
  }

  let found: any = null;
  if (phone && byActivePhone.has(phone)) {
    found = byActivePhone.get(phone);
  } else if (!phone && name) {
    for (const p of (parties || [])) {
      if (String((p as any).name || '').trim() === name) { found = p; break; }
    }
  }

  if (found) {
    return {
      code: _asCodeString((found as any).code),
      localId: String((found as any).local_id || (found as any).id || ''),
      party: found,
      isNew: false,
    };
  }

  let codeRaw: any = await suggestPartyCode();
  let code = _asCodeString(codeRaw);
  if (!code) {
    const genRaw: any = await generateCustomerCode();
    code = _asCodeString(genRaw);
  }

  const newParty = {
    local_id: 'party_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    code,
    name: input.name || '',
    phone: input.phone || '',
    address: input.address || '',
    type: input.type || 'customer',
    phone_history: phone ? [{ phone, status: 'active', from: new Date().toISOString() }] : [],
  };

  try {
    await createParty(newParty);
  } catch (e) {
    console.log('createParty from resolvePartyForInvoice err:', e);
  }

  return { code, localId: newParty.local_id, party: newParty, isNew: true };
}
