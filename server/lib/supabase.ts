import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
// SUPABASE_ANON_KEY is used here. RLS policies on all tables allow full read/write
// with the anon key (configured in Supabase). This runs server-side only.
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const missing = [
  !supabaseUrl && 'SUPABASE_URL',
  !supabaseKey && 'SUPABASE_ANON_KEY',
].filter(Boolean);

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(', ')}. ` +
    'Set them in Vercel project settings (Settings → Environment Variables) and redeploy.',
  );
}

export const supabase = createClient(supabaseUrl!, supabaseKey!, {
  auth: { persistSession: false },
});
