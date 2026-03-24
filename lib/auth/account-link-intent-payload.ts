const ACCOUNT_LINK_INTENT_TTL_SECONDS = 60 * 10;

type AccountLinkIntent = {
  accountId: string;
  createdAt: number;
};

export function parseAccountLinkIntentValue(raw: string | null | undefined): { accountId: string } | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AccountLinkIntent;
    if (!parsed?.accountId || typeof parsed.accountId !== "string") {
      return null;
    }

    const createdAt = Number(parsed.createdAt ?? 0);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > ACCOUNT_LINK_INTENT_TTL_SECONDS * 1000) {
      return null;
    }

    return { accountId: parsed.accountId };
  } catch {
    return null;
  }
}
