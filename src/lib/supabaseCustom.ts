import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Vitor: Lógica centralizada. Se mudar no .env, muda em todo o lado.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Erro Crítico: Variáveis de ambiente não encontradas. Verifica o teu .env");
}

export const supabase = createClient<Database>(
  supabaseUrl || '', 
  supabaseAnonKey || '', 
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);
