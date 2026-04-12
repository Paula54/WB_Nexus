import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Production backend — always use production Supabase (hqyuxponbobmuletqshq)
// Do NOT use VITE_SUPABASE_* env vars — they point to the Lovable Cloud project which is empty
const supabaseUrl = 'https://hqyuxponbobmuletqshq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxeXV4cG9uYm9ibXVsZXRxc2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjM4MTUsImV4cCI6MjA4Njk5OTgxNX0.PR0gfHWMQnFjqnf2TiHSudmJ0k6fnlf8x16AK94jWN4';

export const supabase = createClient<Database>(
  supabaseUrl, 
  supabaseAnonKey, 
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    }
  }
);
