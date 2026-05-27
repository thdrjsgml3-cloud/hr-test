import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export function createClient() {
  return createSupabaseClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function createAdminClient() {
  return createSupabaseClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}
