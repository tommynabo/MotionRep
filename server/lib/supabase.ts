import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  // Log clearly but do NOT throw — a module-level throw crashes the entire Vercel
  // serverless function, making ALL routes (exercises, angles, etc.) return 500.
  console.error(
    '[supabase] Missing env vars:',
    !supabaseUrl ? 'SUPABASE_URL ' : '',
    !supabaseServiceKey ? 'SUPABASE_SERVICE_ROLE_KEY' : '',
    '— check Vercel Environment Variables and redeploy.',
  );
}

// Service-role client: bypasses RLS, only used server-side
export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseServiceKey ?? 'placeholder',
  { auth: { persistSession: false } },
);
