import { createBrowserClient } from "@supabase/ssr";

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>;

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
    return createBrowserClient(url, key);
  }

  if (!globalThis.__bingoSupabaseBrowserClient) {
    globalThis.__bingoSupabaseBrowserClient = createBrowserClient(url, key);
  }

  return globalThis.__bingoSupabaseBrowserClient;
}
