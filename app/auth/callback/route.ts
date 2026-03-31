import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Legacy compatibility route; forward to /auth/confirm interstitial so GET does not consume auth artifacts.
  const requestUrl = new URL(request.url);
  const confirmUrl = new URL("/auth/confirm", request.url);
  requestUrl.searchParams.forEach((value, key) => {
    confirmUrl.searchParams.append(key, value);
  });

  return NextResponse.redirect(confirmUrl);
}