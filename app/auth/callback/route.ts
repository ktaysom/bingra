import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateProfileByAuthUserId } from "../../../lib/auth/profiles";
import { ensurePlayerLinkedToAuthenticatedUser } from "../../../lib/auth/link-player";
import { readAccountLinkIntentFromRequest, clearAccountLinkIntentCookie } from "../../../lib/auth/account-link-intent";
import { linkAuthUserToAccount } from "../../../lib/auth/account-auth-methods";

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
  const code = requestUrl.searchParams.get("code");
  const nextPath = normalizeNextPath(requestUrl.searchParams.get("next"));
  const linkPlayerId = requestUrl.searchParams.get("link_player_id");
  const expectedLink = requestUrl.searchParams.get("expected_link") === "1";

  const redirectUrl = new URL(nextPath, request.url);
  const response = NextResponse.redirect(redirectUrl);
  const linkIntent = readAccountLinkIntentFromRequest(request);

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

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id) {
    try {
      if (linkIntent?.accountId) {
        await linkAuthUserToAccount({
          accountId: linkIntent.accountId,
          authUserId: user.id,
        });
        console.info("[auth/callback] linked auth method to account", {
          accountId: linkIntent.accountId,
        });
      } else if (expectedLink) {
        const fallbackRedirect = new URL("/me", request.url);
        fallbackRedirect.searchParams.set(
          "link_error",
          "Your verification completed, but linking expired. Please try adding the sign-in method again.",
        );
        const errorResponse = NextResponse.redirect(fallbackRedirect);
        clearAccountLinkIntentCookie(errorResponse);
        console.warn("[auth/callback] expected account link intent but none was present");
        return errorResponse;
      }

      // Keep compatibility provisioning in place for profile/account/link rows.
      await getOrCreateProfileByAuthUserId(user.id);

      if (linkPlayerId) {
        await ensurePlayerLinkedToAuthenticatedUser({
          playerId: linkPlayerId,
          authUserId: user.id,
          context: "auth/callback",
        });
      } else if (nextPath.includes("/play")) {
        console.warn("[auth/callback] expected link_player_id for play redirect but none was provided", {
          userId: user.id,
          nextPath,
        });
      }
    } catch (error) {
      console.error("[auth/callback] player link failed", error);
      const fallbackRedirect = new URL("/me", request.url);
      fallbackRedirect.searchParams.set(
        "link_error",
        error instanceof Error ? error.message : "Unable to link sign-in method",
      );
      const errorResponse = NextResponse.redirect(fallbackRedirect);
      clearAccountLinkIntentCookie(errorResponse);
      return errorResponse;
    }
  }

  clearAccountLinkIntentCookie(response);

  return response;
}