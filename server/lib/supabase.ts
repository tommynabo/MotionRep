import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
// Server-side backend always uses the service role key, which bypasses RLS.
// Never expose this key to the frontend/browser.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const missing = [
  !supabaseUrl && 'SUPABASE_URL',
  !supabaseKey && 'SUPABASE_SERVICE_ROLE_KEY',
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
