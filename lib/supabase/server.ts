import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or publishable/anon key.");
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        const allCookies = cookieStore.getAll();
        console.info("[auth][server] createSupabaseServerClient.getAll", {
          cookieCount: allCookies.length,
          hasSupabaseCookie: allCookies.some((cookie) => cookie.name.includes("sb-")),
        });
        return allCookies;
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
        } catch (error) {
          console.warn("[auth][server] createSupabaseServerClient.setAll failed", {
            error: error instanceof Error ? error.message : String(error),
          });
          // Safe in server components/actions where mutation may not always be allowed.
        }
      },
    },
  });
}