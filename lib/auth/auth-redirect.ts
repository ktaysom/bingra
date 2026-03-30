export type PostAuthIntent = "sign_in" | "save_stats" | "account_link";

export type PendingAuthContext = {
  nextPath: string;
  gameSlug?: string;
  playerId?: string;
  linkPlayerId?: string;
  expectedLink?: boolean;
  intent?: PostAuthIntent;
};

const PENDING_AUTH_STORAGE_KEY = "bingra.pending-auth-context.v1";

export function sanitizeNextPath(input: string | null | undefined, fallback = "/"): string {
  if (!input || !input.startsWith("/")) {
    return fallback;
  }

  return input;
}

export function deriveGameSlug(nextPath: string): string | undefined {
  const match = /^\/g\/([^/?#]+)/.exec(nextPath);
  return match?.[1];
}

export function normalizePendingAuthContext(
  context: Partial<PendingAuthContext> | undefined,
  fallbackNext = "/",
): PendingAuthContext {
  const nextPath = sanitizeNextPath(context?.nextPath, fallbackNext);

  return {
    nextPath,
    gameSlug: context?.gameSlug ?? deriveGameSlug(nextPath),
    playerId: context?.playerId,
    linkPlayerId: context?.linkPlayerId,
    expectedLink: Boolean(context?.expectedLink),
    intent: context?.intent,
  };
}

export function readPendingAuthContextFromSearchParams(searchParams: URLSearchParams): PendingAuthContext {
  return normalizePendingAuthContext(
    {
      nextPath: searchParams.get("next") ?? undefined,
      gameSlug: searchParams.get("game_slug") ?? undefined,
      playerId: searchParams.get("player_id") ?? undefined,
      linkPlayerId: searchParams.get("link_player_id") ?? undefined,
      expectedLink: searchParams.get("expected_link") === "1",
      intent:
        searchParams.get("auth_intent") === "save_stats" ||
        searchParams.get("auth_intent") === "account_link" ||
        searchParams.get("auth_intent") === "sign_in"
          ? (searchParams.get("auth_intent") as PostAuthIntent)
          : undefined,
    },
    "/me",
  );
}

export function hasPendingAuthContextInSearchParams(searchParams: URLSearchParams): boolean {
  return ["next", "game_slug", "player_id", "link_player_id", "expected_link", "auth_intent"].some((key) =>
    searchParams.has(key),
  );
}

export function buildFinalizePath(params: {
  nextPath: string;
  linkPlayerId?: string;
  expectedLink?: boolean;
}): string {
  const finalizeUrl = new URL("/auth/finalize", "http://localhost");
  finalizeUrl.searchParams.set("next", sanitizeNextPath(params.nextPath, "/"));

  if (params.linkPlayerId) {
    finalizeUrl.searchParams.set("link_player_id", params.linkPlayerId);
  }

  if (params.expectedLink) {
    finalizeUrl.searchParams.set("expected_link", "1");
  }

  return `${finalizeUrl.pathname}${finalizeUrl.search}`;
}

export function buildAuthConfirmPath(context: PendingAuthContext): string {
  const normalized = normalizePendingAuthContext(context, "/");
  const confirmUrl = new URL("/auth/confirm", "http://localhost");
  confirmUrl.searchParams.set("next", normalized.nextPath);

  if (normalized.linkPlayerId) {
    confirmUrl.searchParams.set("link_player_id", normalized.linkPlayerId);
  }

  if (normalized.expectedLink) {
    confirmUrl.searchParams.set("expected_link", "1");
  }

  if (normalized.gameSlug) {
    confirmUrl.searchParams.set("game_slug", normalized.gameSlug);
  }

  if (normalized.playerId) {
    confirmUrl.searchParams.set("player_id", normalized.playerId);
  }

  if (normalized.intent) {
    confirmUrl.searchParams.set("auth_intent", normalized.intent);
  }

  return `${confirmUrl.pathname}${confirmUrl.search}`;
}

export function savePendingAuthContext(context: PendingAuthContext) {
  if (typeof window === "undefined") {
    return;
  }

  const payload = {
    ...normalizePendingAuthContext(context, "/"),
    createdAt: Date.now(),
  };

  window.localStorage.setItem(PENDING_AUTH_STORAGE_KEY, JSON.stringify(payload));
}

export function readPendingAuthContextFromStorage(): PendingAuthContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(PENDING_AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as (PendingAuthContext & { createdAt?: number }) | null;
    if (!parsed) {
      return null;
    }

    // Expire stale contexts after 6 hours.
    if (parsed.createdAt && Date.now() - parsed.createdAt > 6 * 60 * 60 * 1000) {
      window.localStorage.removeItem(PENDING_AUTH_STORAGE_KEY);
      return null;
    }

    return normalizePendingAuthContext(parsed, "/");
  } catch {
    return null;
  }
}

export function clearPendingAuthContextFromStorage() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PENDING_AUTH_STORAGE_KEY);
}
