import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
// Prefer service role key (bypasses RLS). Fall back to anon key if not set.
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY). ' +
    'Set them in Vercel project settings (Settings → Environment Variables) and redeploy.',
  );
}

export const supabase = createClient(supabaseUrl!, supabaseKey!, {
  auth: { persistSession: false },
});
