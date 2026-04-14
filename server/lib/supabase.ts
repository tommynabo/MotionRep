import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
// Prefer service role key (bypasses RLS). Fall back to anon key for Production
// environments where SERVICE_ROLE_KEY may not be scoped correctly.
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_ANON_KEY;

console.log(
  '[supabase] init — url present:', !!supabaseUrl,
  '| service key present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  '| anon key present:', !!process.env.SUPABASE_ANON_KEY,
  '| using key type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon',
);

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '[supabase] CRITICAL — missing SUPABASE_URL or both SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY.',
    'All database operations will fail.',
  );
}

// Server-side client only — never exposed to the browser
export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseKey ?? 'placeholder',
  { auth: { persistSession: false } },
);
