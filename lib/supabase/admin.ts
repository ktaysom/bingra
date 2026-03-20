import { createClient } from "@supabase/supabase-js";


export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("SUPABASE ADMIN ENV CHECK", {
    hasUrl: !!url,
    hasSecretKey: !!process.env.SUPABASE_SECRET_KEY,
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!url || !secret) {
    throw new Error(
      `Missing env vars: NEXT_PUBLIC_SUPABASE_URL=${!!url}, SUPABASE_SECRET_KEY=${!!process.env.SUPABASE_SECRET_KEY}, SUPABASE_SERVICE_ROLE_KEY=${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`
    );
  }

  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}