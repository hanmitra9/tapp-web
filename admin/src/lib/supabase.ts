import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in admin/.env');

// Admin uses the same anon key as the app. Authority comes from profiles.role = 'admin' enforced in RLS/RPCs,
// never from this client — the service_role key must never be shipped here.
export const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
