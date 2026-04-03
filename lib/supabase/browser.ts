import { createBrowserClient } from "@supabase/ssr";

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>;

declare global {
  var __bingoSupabaseBrowserClient: BrowserSupabaseClient | undefined;
  var __bingoSupabaseBrowserAuthDebugBound: boolean | undefined;
}

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or publishable/anon key.");
  }

  const authConfig = {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  } as const;

  if (typeof window === "undefined") {
    return createBrowserClient(url, key, {
      auth: authConfig,
    });
  }

  if (!globalThis.__bingoSupabaseBrowserClient) {
    console.log("[auth][browser] creating Supabase browser client", {
      persistSession: authConfig.persistSession,
      autoRefreshToken: authConfig.autoRefreshToken,
      detectSessionInUrl: authConfig.detectSessionInUrl,
    });

    globalThis.__bingoSupabaseBrowserClient = createBrowserClient(url, key, {
      auth: authConfig,
    });
  }

  if (!globalThis.__bingoSupabaseBrowserAuthDebugBound) {
    globalThis.__bingoSupabaseBrowserAuthDebugBound = true;

    const supabase = globalThis.__bingoSupabaseBrowserClient;

    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        const expiresAt = data.session?.expires_at ?? null;
        console.log("[auth][browser] initial getSession", {
          hasSession: Boolean(data.session),
          expiresAt,
          expiresAtIso: expiresAt ? new Date(expiresAt * 1000).toISOString() : null,
          error: error?.message ?? null,
        });
      })
      .catch((error) => {
        console.log("[auth][browser] initial getSession failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });

    supabase.auth.onAuthStateChange((event, session) => {
      const expiresAt = session?.expires_at ?? null;
      console.log("[auth][browser] onAuthStateChange", {
        event,
        hasSession: Boolean(session),
        expiresAt,
        expiresAtIso: expiresAt ? new Date(expiresAt * 1000).toISOString() : null,
      });
    });
  }

  return globalThis.__bingoSupabaseBrowserClient;
}