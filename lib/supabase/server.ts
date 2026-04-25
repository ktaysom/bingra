import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const SERVER_CLIENT_MODULE_LOADED_AT = Date.now();

type CookieSnapshot = {
  name: string;
  value: string;
};

function applyCookieUpdates(
  existing: CookieSnapshot[],
  updates: Array<{
    name: string;
    value: string;
    options?: {
      maxAge?: number;
    };
  }>,
): CookieSnapshot[] {
  const cookieMap = new Map(existing.map((cookie) => [cookie.name, cookie]));

  for (const update of updates) {
    if (typeof update.options?.maxAge === "number" && update.options.maxAge <= 0) {
      cookieMap.delete(update.name);
      continue;
    }

    cookieMap.set(update.name, {
      name: update.name,
      value: update.value,
    });
  }

  return [...cookieMap.values()];
}

export const createSupabaseServerClient = cache(async function createSupabaseServerClient() {
  const startedAt = Date.now();
  const cookieStore = await cookies();
  const cookiesResolvedAt = Date.now();
  let cookieSnapshot = cookieStore.getAll().map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
  }));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or publishable/anon key.");
  }

  const client = createServerClient(url, key, {
    cookies: {
      getAll() {
        console.info("[auth][server] createSupabaseServerClient.getAll", {
          cookieCount: cookieSnapshot.length,
          hasSupabaseCookie: cookieSnapshot.some((cookie) => cookie.name.includes("sb-")),
        });
        return cookieSnapshot;
      },
      setAll(cookiesToSet) {
        try {
          if (cookiesToSet.length > 0) {
            console.info("[auth][server] createSupabaseServerClient.setAll", {
              cookieCount: cookiesToSet.length,
              cookieNames: cookiesToSet.map((cookie) => cookie.name),
            });
          }
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
          cookieSnapshot = applyCookieUpdates(cookieSnapshot, cookiesToSet);
        } catch (error) {
          console.warn("[auth][server] createSupabaseServerClient.setAll failed", {
            error: error instanceof Error ? error.message : String(error),
          });
          // Safe in server components/actions where mutation may not always be allowed.
        }
      },
    },
  });

  console.info("[auth][server][timing]", {
    segment: "createSupabaseServerClient",
    durationMs: Date.now() - startedAt,
    cookiesResolveMs: cookiesResolvedAt - startedAt,
    moduleLoadAgeMs: startedAt - SERVER_CLIENT_MODULE_LOADED_AT,
    cookieCount: cookieSnapshot.length,
    hasSupabaseCookie: cookieSnapshot.some((cookie) => cookie.name.includes("sb-")),
  });

  return client;
});
