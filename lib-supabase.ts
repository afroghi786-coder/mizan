import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://paslxvwlbojdzflbmyoh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YR1dct7WS_i6-8nqqw5dWQ_qaxFBlQN';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});