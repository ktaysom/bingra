import { createClient } from "@supabase/supabase-js";

type BrowserSupabaseClient = ReturnType<typeof createClient>;

declare global {
  var __bingoSupabaseBrowserClient: BrowserSupabaseClient | undefined;
}

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or publishable/anon key.");
  }

  if (typeof window === "undefined") {
    return createClient(url, key);
  }

  if (!globalThis.__bingoSupabaseBrowserClient) {
    globalThis.__bingoSupabaseBrowserClient = createClient(url, key);
  }

  return globalThis.__bingoSupabaseBrowserClient;
}
