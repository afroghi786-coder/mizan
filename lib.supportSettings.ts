import { supabase } from './lib';

export type SupportSettings = {
  phone: string;
  email: string;
  whatsapp: string;
  telegram: string;
  channel: string;
  address: string;
  working_hours: string;
};

const EMPTY: SupportSettings = {
  phone: '', email: '', whatsapp: '', telegram: '', channel: '', address: '', working_hours: '',
};

export async function getSupportSettings(): Promise<SupportSettings> {
  try {
    const { data, error } = await supabase
      .from('support_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) return { ...EMPTY };
    return {
      phone: String(data.phone || ''),
      email: String(data.email || ''),
      whatsapp: String(data.whatsapp || ''),
      telegram: String(data.telegram || ''),
      channel: String(data.channel || ''),
      address: String(data.address || ''),
      working_hours: String(data.working_hours || ''),
    };
  } catch { return { ...EMPTY }; }
}

export async function saveSupportSettings(s: SupportSettings): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('support_settings').upsert({
      id: 1,
      phone: s.phone || '',
      email: s.email || '',
      whatsapp: s.whatsapp || '',
      telegram: s.telegram || '',
      channel: s.channel || '',
      address: s.address || '',
      working_hours: s.working_hours || '',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'ذخیره نشد' };
  }
}
