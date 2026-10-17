// lib.supabase.admin.ts — کلاینت جدا برای پنل ادمین
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from './lib.storage';

const SUPABASE_URL = 'https://paslxvwlbojdzflbmyoh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhc2x4dndsYm9qZHpmbGJteW9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MjA5MTAsImV4cCI6MjEwNTQ5NjkxMH0.gOkwEyVlRi0C11277KxswLFiMFGf4c-ctMgsGLZQuk4';

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    storageKey: 'mizan-admin-auth-v1',   // 🔑 کلید جدای session ادمین
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
