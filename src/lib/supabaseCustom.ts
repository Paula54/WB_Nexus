import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Production backend (hqyuxponbobmuletqshq).
// The anon key is public by design (protected by RLS) — safe to commit.
// GitGuardian alerts on this key are false positives; mark them as such.
const PROD_SUPABASE_URL = 'https://hqyuxponbobmuletqshq.supabase.co';
const PROD_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxeXV4cG9uYm9ibXVsZXRxc2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjM4MTUsImV4cCI6MjA4Njk5OTgxNX0.PR0gfHWMQnFjqnf2TiHSudmJ0k6fnlf8x16AK94jWN4';

export const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string) || PROD_SUPABASE_URL;
export const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  PROD_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
