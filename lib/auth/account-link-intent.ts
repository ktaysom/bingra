import type { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseAccountLinkIntentValue } from "./account-link-intent-payload";

const ACCOUNT_LINK_INTENT_COOKIE = "bingra-account-link-intent";

export async function setAccountLinkIntentCookie(accountId: string): Promise<void> {
  const cookieStore = await cookies();
  const payload = {
    accountId,
    createdAt: Date.now(),
  };

  cookieStore.set({
    name: ACCOUNT_LINK_INTENT_COOKIE,
    value: JSON.stringify(payload),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });

  console.info("[account-link-intent] set link intent cookie", {
    accountId,
  });
}

export function readAccountLinkIntentFromRequest(request: NextRequest): { accountId: string } | null {
  const raw = request.cookies.get(ACCOUNT_LINK_INTENT_COOKIE)?.value;
  return parseAccountLinkIntentValue(raw);
}

export function clearAccountLinkIntentCookie(response: NextResponse): void {
  response.cookies.set({
    name: ACCOUNT_LINK_INTENT_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });

  console.info("[account-link-intent] cleared link intent cookie");
}
