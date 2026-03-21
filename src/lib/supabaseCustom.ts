import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Produção exclusiva — hqyuxponbobmuletqshq
const supabaseUrl = 'https://hqyuxponbobmuletqshq.supabase.co';
const supabaseAnonKey = 'sb_publishable_f0fIJHvqAbByIr9Cd15S1w_Dbl6WmMt';

export const supabase = createClient<Database>(
  supabaseUrl, 
  supabaseAnonKey, 
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);
