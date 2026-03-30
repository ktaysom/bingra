import { NextRequest } from "next/server";
import { handleAuthRedirectRequest } from "../../../lib/auth/handle-auth-redirect";

export async function GET(request: NextRequest) {
  // Legacy compatibility route; keep behavior equivalent to /auth/confirm.
  return handleAuthRedirectRequest(request, {
    context: "auth/confirm",
    requireCodeExchange: true,
  });
}