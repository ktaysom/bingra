import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateProfileByAuthUserId } from "../../../lib/auth/profiles";
import { linkGuestPlayerToProfile } from "../../../lib/auth/link-player";

function normalizeNextPath(input: string | null): string {
  if (!input) {
    return "/";
  }

  if (!input.startsWith("/")) {
    return "/";
  }

  return input;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const nextPath = normalizeNextPath(requestUrl.searchParams.get("next"));
  const linkPlayerId = requestUrl.searchParams.get("link_player_id");

  const redirectUrl = new URL(nextPath, request.url);
  const response = NextResponse.redirect(redirectUrl);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id) {
    try {
      const profile = await getOrCreateProfileByAuthUserId(user.id);

      if (linkPlayerId) {
        await linkGuestPlayerToProfile({
          playerId: linkPlayerId,
          profileId: profile.id,
        });
      }
    } catch (error) {
      console.error("[auth/finalize] player link failed", error);
    }
  }

  return response;
}
