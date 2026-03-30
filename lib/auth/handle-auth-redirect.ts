import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateProfileByAuthUserId } from "./profiles";
import { ensurePlayerLinkedToAuthenticatedUser } from "./link-player";
import { readAccountLinkIntentFromRequest, clearAccountLinkIntentCookie } from "./account-link-intent";
import { linkAuthUserToAccount } from "./account-auth-methods";
import { hasPendingAuthContextInSearchParams, readPendingAuthContextFromSearchParams } from "./auth-redirect";

type HandleAuthRedirectOptions = {
  context: "auth/confirm" | "auth/finalize";
  requireCodeExchange: boolean;
};

function buildAuthErrorResponse(request: NextRequest, message: string) {
  const fallbackRedirect = new URL("/me", request.url);
  fallbackRedirect.searchParams.set("auth_error", message);
  return NextResponse.redirect(fallbackRedirect);
}

export async function handleAuthRedirectRequest(request: NextRequest, options: HandleAuthRedirectOptions) {
  const requestUrl = new URL(request.url);
  const pendingContext = readPendingAuthContextFromSearchParams(requestUrl.searchParams);
  const hasPendingContext = hasPendingAuthContextInSearchParams(requestUrl.searchParams);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const otpType = requestUrl.searchParams.get("type") ?? "email";
  const redirectUrl = new URL(pendingContext.nextPath, request.url);
  const response = NextResponse.redirect(redirectUrl);
  const linkIntent = readAccountLinkIntentFromRequest(request);

  console.info(`[${options.context}] callback reached`, {
    hasPendingContext,
    nextPath: pendingContext.nextPath,
    hasLinkPlayerId: Boolean(pendingContext.linkPlayerId),
    expectedLink: Boolean(pendingContext.expectedLink),
    intent: pendingContext.intent ?? null,
    codePresent: Boolean(code),
    tokenHashPresent: Boolean(tokenHash),
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn(`[${options.context}] missing Supabase configuration; redirecting without auth finalize`);
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
          response.cookies.set(name, value, cookieOptions);
        });
      },
    },
  });

  if (options.requireCodeExchange) {
    let sessionEstablished = false;

    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        console.warn(`[${options.context}] exchangeCodeForSession failed; will try token_hash fallback if available`, {
          message: exchangeError.message,
          fallbackAvailable: Boolean(tokenHash),
        });
      } else {
        sessionEstablished = true;
        console.info(`[${options.context}] exchangeCodeForSession succeeded`);
      }
    } else {
      console.info(`[${options.context}] code missing; will try token_hash fallback if available`, {
        fallbackAvailable: Boolean(tokenHash),
      });
    }

    if (!sessionEstablished && tokenHash) {
      const { error: verifyTokenHashError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: otpType as "email" | "recovery" | "invite" | "email_change" | "magiclink" | "signup",
      });

      if (verifyTokenHashError) {
        console.error(`[${options.context}] verifyOtp(token_hash) failed`, {
          message: verifyTokenHashError.message,
          otpType,
        });
      } else {
        sessionEstablished = true;
        console.info(`[${options.context}] verifyOtp(token_hash) succeeded`, {
          otpType,
        });
      }
    }

    if (!sessionEstablished) {
      return buildAuthErrorResponse(
        request,
        "We couldn't complete sign-in from that link. Please request a fresh sign-in email or use the email code.",
      );
    }
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
        console.info(`[${options.context}] linked auth method to account`, {
          accountId: linkIntent.accountId,
        });
      } else if (pendingContext.expectedLink) {
        const fallbackRedirect = new URL("/me", request.url);
        fallbackRedirect.searchParams.set(
          "link_error",
          "Your verification completed, but linking expired. Please try adding the sign-in method again.",
        );
        const errorResponse = NextResponse.redirect(fallbackRedirect);
        clearAccountLinkIntentCookie(errorResponse);
        console.warn(`[${options.context}] expected account link intent but none was present`);
        return errorResponse;
      }

      await getOrCreateProfileByAuthUserId(user.id);

      if (pendingContext.linkPlayerId) {
        await ensurePlayerLinkedToAuthenticatedUser({
          playerId: pendingContext.linkPlayerId,
          authUserId: user.id,
          context: options.context,
        });
      } else if (pendingContext.nextPath.includes("/play")) {
        console.warn(`[${options.context}] expected link_player_id for play redirect but none was provided`, {
          userId: user.id,
          nextPath: pendingContext.nextPath,
        });
      }
    } catch (error) {
      console.error(`[${options.context}] finalize/link failed`, error);
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
  console.info(`[${options.context}] redirecting to final destination`, {
    hasPendingContext,
    finalPath: pendingContext.nextPath,
  });

  return response;
}
