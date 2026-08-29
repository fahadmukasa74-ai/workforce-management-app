import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tptqvivjcprtaiglaslt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwdHF2aXZqY3BydGFpZ2xhc2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NzQ3MjUsImV4cCI6MjEwMzI1MDcyNX0.bmUZ_cjjWj152xggCBRDawNofmQowO7cYAYm1FY72Oo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      apikey: SUPABASE_ANON_KEY,
    },
  },
});