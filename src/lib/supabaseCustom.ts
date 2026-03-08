import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const SUPABASE_URL = 'https://hqyuxponbobmuletqshq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxeXV4cG9uYm9ibXVsZXRxc2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MjM4MTUsImV4cCI6MjA4Njk5OTgxNX0.PR0gfHWMQnFjqnf2TiHSudmJ0k6fnlf8x16AK94jWN4';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
