import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Production backend — credentials provided exclusively via environment variables.
// Never hardcode anon keys here (GitGuardian flags them as leaks).
export const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || (import.meta.env as any).SUPABASE_URL;
export const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  (import.meta.env as any).SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Loud failure during dev/build so missing env vars are obvious.
  // eslint-disable-next-line no-console
  console.error(
    '[supabaseCustom] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in environment.'
  );
}

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
    },
  }
);
