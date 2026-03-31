import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateProfileByAuthUserId } from "./profiles";
import { ensurePlayerLinkedToAuthenticatedUser } from "./link-player";
import { readAccountLinkIntentFromRequest, clearAccountLinkIntentCookie } from "./account-link-intent";
import { linkAuthUserToAccount } from "./account-auth-methods";
import {
  getPendingAuthContextCookieKey,
  hasPendingAuthContextInSearchParams,
  mergePendingAuthContexts,
  readPendingAuthContextFromCookieValue,
  readPendingAuthContextFromSearchParams,
  resolveNextPathFromSearchParams,
} from "./auth-redirect";

type HandleAuthRedirectOptions = {
  context: "auth/confirm" | "auth/finalize";
  requireCodeExchange: boolean;
};

type RedirectSource =
  | "query_next"
  | "query_redirect_to"
  | "query_game_slug_reconstruction"
  | "cookie_context"
  | "default_me";

function getRedirectStatusForRequestMethod(method: string): 303 | 307 {
  // Critical: POST confirmation should always redirect as GET (303).
  // Using 307 here causes browsers to replay POST to destination routes like /create,
  // which can surface as generic "This page isn't working" failures.
  return method.toUpperCase() === "POST" ? 303 : 307;
}

function redirectWithRequestMethod(request: NextRequest, target: URL): NextResponse {
  return NextResponse.redirect(target, {
    status: getRedirectStatusForRequestMethod(request.method),
  });
}

function buildAuthErrorResponse(request: NextRequest, message: string, pendingContext: ReturnType<typeof readPendingAuthContextFromSearchParams>) {
  const fallbackRedirect = new URL("/me", request.url);
  fallbackRedirect.searchParams.set("auth_error", message);
  fallbackRedirect.searchParams.set("next", pendingContext.nextPath);
  if (pendingContext.gameSlug) {
    fallbackRedirect.searchParams.set("game_slug", pendingContext.gameSlug);
  }
  if (pendingContext.linkPlayerId) {
    fallbackRedirect.searchParams.set("link_player_id", pendingContext.linkPlayerId);
  }
  if (pendingContext.expectedLink) {
    fallbackRedirect.searchParams.set("expected_link", "1");
  }
  if (pendingContext.intent) {
    fallbackRedirect.searchParams.set("auth_intent", pendingContext.intent);
  }
  if (pendingContext.email) {
    fallbackRedirect.searchParams.set("email", pendingContext.email);
  }
  return redirectWithRequestMethod(request, fallbackRedirect);
}

function formatSupabaseAuthError(error: unknown): { message: string; code: string | null; status: number | null } {
  const asRecord = typeof error === "object" && error ? (error as Record<string, unknown>) : null;
  const message =
    (asRecord?.message && typeof asRecord.message === "string" ? asRecord.message : null) ||
    (error instanceof Error ? error.message : null) ||
    "Unknown auth error";
  const code = asRecord?.code && typeof asRecord.code === "string" ? asRecord.code : null;
  const status = asRecord?.status && typeof asRecord.status === "number" ? asRecord.status : null;

  return { message, code, status };
}

function clearPendingAuthContextCookieOnResponse(response: NextResponse) {
  response.cookies.set(getPendingAuthContextCookieKey(), "", {
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });
}

export async function handleAuthRedirectRequest(request: NextRequest, options: HandleAuthRedirectOptions) {
  const requestUrl = new URL(request.url);
  const requestOrigin = requestUrl.origin;
  const rawNext = requestUrl.searchParams.get("next");
  const rawRedirectTo = requestUrl.searchParams.get("redirect_to");
  // Normalize next/redirect_to against current request origin:
  // - allow relative app paths
  // - allow same-origin absolute URLs (converted to internal path)
  // - reject cross-origin URLs
  const resolvedNextPathFromQuery = resolveNextPathFromSearchParams(requestUrl.searchParams, {
    allowedOrigin: requestOrigin,
  });
  const queryContext = readPendingAuthContextFromSearchParams(requestUrl.searchParams, {
    allowedOrigin: requestOrigin,
  });
  const cookieContext = readPendingAuthContextFromCookieValue(
    request.cookies.get(getPendingAuthContextCookieKey())?.value,
  );
  const hasQueryGameSlug = Boolean(requestUrl.searchParams.get("game_slug"));
  const hasQueryRedirectSignal = Boolean(resolvedNextPathFromQuery) || hasQueryGameSlug;

  let pendingContext = mergePendingAuthContexts(queryContext, cookieContext);
  if (!hasQueryRedirectSignal && cookieContext) {
    pendingContext = mergePendingAuthContexts(
      {
        ...queryContext,
        nextPath: cookieContext.nextPath,
        gameSlug: queryContext.gameSlug ?? cookieContext.gameSlug,
      },
      cookieContext,
    );
  }

  const redirectSource: RedirectSource = resolvedNextPathFromQuery
    ? rawNext
      ? "query_next"
      : "query_redirect_to"
    : hasQueryGameSlug
      ? "query_game_slug_reconstruction"
      : cookieContext
        ? "cookie_context"
        : "default_me";
  const resolvedRedirectPath =
    (!pendingContext.nextPath || pendingContext.nextPath === "/" || pendingContext.nextPath === "/me") &&
    pendingContext.gameSlug
      ? `/g/${pendingContext.gameSlug}/play`
      : pendingContext.nextPath;
  const hasPendingContext = hasPendingAuthContextInSearchParams(requestUrl.searchParams);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const otpType = requestUrl.searchParams.get("type") ?? "email";
  const arrivalMethod: "code" | "token_hash" | "neither" = code
    ? "code"
    : tokenHash
      ? "token_hash"
      : "neither";
  const redirectUrl = new URL(resolvedRedirectPath, request.url);
  const response = redirectWithRequestMethod(request, redirectUrl);
  const linkIntent = readAccountLinkIntentFromRequest(request);

  console.info(`[${options.context}] callback reached`, {
    arrivalMethod,
    redirectSource,
    hasPendingContext,
    nextPath: pendingContext.nextPath,
    resolvedRedirectPath,
    hasLinkPlayerId: Boolean(pendingContext.linkPlayerId),
    expectedLink: Boolean(pendingContext.expectedLink),
    intent: pendingContext.intent ?? null,
    codePresent: Boolean(code),
    tokenHashPresent: Boolean(tokenHash),
    rawNextPresent: Boolean(rawNext),
    rawRedirectToPresent: Boolean(rawRedirectTo),
    resolvedNextPathFromQuery,
    requestOrigin,
    requestMethod: request.method,
    redirectStatus: getRedirectStatusForRequestMethod(request.method),
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
    let verifiedVia: "code" | "token_hash" | null = null;

    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        console.warn(`[${options.context}] exchangeCodeForSession failed; will try token_hash fallback if available`, {
          message: exchangeError.message,
          fallbackAvailable: Boolean(tokenHash),
        });
      } else {
        sessionEstablished = true;
        verifiedVia = "code";
        console.info(`[${options.context}] exchangeCodeForSession succeeded`);
      }
    } else {
      console.info(`[${options.context}] code missing; will try token_hash fallback if available`, {
        fallbackAvailable: Boolean(tokenHash),
      });
    }

    if (!sessionEstablished && tokenHash) {
      const runVerifyOtp = async (
        type: "email" | "recovery" | "invite" | "email_change" | "magiclink" | "signup",
      ) => {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });

        return error;
      };

      const primaryVerifyError = await runVerifyOtp(
        otpType as "email" | "recovery" | "invite" | "email_change" | "magiclink" | "signup",
      );

      if (!primaryVerifyError) {
        sessionEstablished = true;
        verifiedVia = "token_hash";
        console.info(`[${options.context}] verifyOtp(token_hash) succeeded`, {
          otpType,
          tokenHashPrefix: tokenHash.slice(0, 8),
        });
      } else {
        const primaryDetails = formatSupabaseAuthError(primaryVerifyError);
        console.error(`[${options.context}] verifyOtp(token_hash) failed`, {
          otpType,
          tokenHashPrefix: tokenHash.slice(0, 8),
          message: primaryDetails.message,
          code: primaryDetails.code,
          status: primaryDetails.status,
        });

        // Narrow compatibility fallback:
        // Some Supabase projects/templates emit PKCE token hashes (prefix "pkce_") where
        // verifyOtp(type=email) can fail at runtime; retrying as magiclink may succeed.
        const shouldRetryAsMagicLink = otpType === "email" && tokenHash.startsWith("pkce_");

        if (shouldRetryAsMagicLink) {
          const magicLinkVerifyError = await runVerifyOtp("magiclink");
          if (!magicLinkVerifyError) {
            sessionEstablished = true;
            verifiedVia = "token_hash";
            console.info(`[${options.context}] verifyOtp(token_hash) succeeded via magiclink fallback`, {
              tokenHashPrefix: tokenHash.slice(0, 8),
            });
          } else {
            const fallbackDetails = formatSupabaseAuthError(magicLinkVerifyError);
            console.error(`[${options.context}] verifyOtp(token_hash) magiclink fallback failed`, {
              tokenHashPrefix: tokenHash.slice(0, 8),
              message: fallbackDetails.message,
              code: fallbackDetails.code,
              status: fallbackDetails.status,
            });
          }
        }
      }
    }

    if (!sessionEstablished) {
      console.warn(`[${options.context}] unable to establish session from callback`, {
        arrivalMethod,
      });
      const reason = tokenHash
        ? `token_hash verification failed for type=${otpType}`
        : "missing code/token_hash";
      return buildAuthErrorResponse(
        request,
        `We couldn't complete sign-in from that link (${reason}). Please request a fresh sign-in email or use the email code.`,
        pendingContext,
      );
    }

    console.info(`[${options.context}] session established from callback`, {
      arrivalMethod,
      verifiedVia,
    });
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
        const errorResponse = redirectWithRequestMethod(request, fallbackRedirect);
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
      } else if (resolvedRedirectPath.includes("/play")) {
        console.warn(`[${options.context}] expected link_player_id for play redirect but none was provided`, {
          userId: user.id,
          nextPath: resolvedRedirectPath,
        });
      }
    } catch (error) {
      console.error(`[${options.context}] finalize/link failed`, error);
      const fallbackRedirect = new URL("/me", request.url);
      fallbackRedirect.searchParams.set(
        "link_error",
        error instanceof Error ? error.message : "Unable to link sign-in method",
      );
      const errorResponse = redirectWithRequestMethod(request, fallbackRedirect);
      clearAccountLinkIntentCookie(errorResponse);
      return errorResponse;
    }
  }

  clearAccountLinkIntentCookie(response);
  clearPendingAuthContextCookieOnResponse(response);
  console.info(`[${options.context}] redirecting to final destination`, {
    arrivalMethod,
    redirectSource,
    hasPendingContext,
    finalPath: resolvedRedirectPath,
  });

  return response;
}
