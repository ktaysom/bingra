import { NextRequest, NextResponse } from "next/server";
import { handleAuthRedirectRequest } from "../../../lib/auth/handle-auth-redirect";
import {
  getPendingAuthContextCookieKey,
  resolveNextPathFromSearchParams,
} from "../../../lib/auth/auth-redirect";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const hasAuthPayload = Boolean(code || tokenHash);
  const hasLinkPlayerId = requestUrl.searchParams.has("link_player_id");
  const expectedLink = requestUrl.searchParams.get("expected_link") === "1";

  // Fast-path optimization:
  // If auth was already verified in-app (e.g. verifyOtp(email/phone)) and there is no
  // linking work to finalize, skip server finalize orchestration and redirect directly.
  if (!hasAuthPayload && !hasLinkPlayerId && !expectedLink) {
    const nextPath =
      resolveNextPathFromSearchParams(requestUrl.searchParams, {
        allowedOrigin: requestUrl.origin,
      }) ?? "/me";
    const directTarget = new URL(nextPath, request.url);
    const response = NextResponse.redirect(directTarget, { status: 307 });
    response.cookies.set(getPendingAuthContextCookieKey(), "", {
      maxAge: 0,
      path: "/",
      sameSite: "lax",
    });
    return response;
  }

  return handleAuthRedirectRequest(request, {
    context: "auth/finalize",
    requireCodeExchange: false,
  });
}
