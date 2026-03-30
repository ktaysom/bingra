export type PostAuthIntent = "sign_in" | "save_stats" | "account_link";

export type PendingAuthContext = {
  nextPath: string;
  gameSlug?: string;
  playerId?: string;
  linkPlayerId?: string;
  expectedLink?: boolean;
  intent?: PostAuthIntent;
  email?: string;
};

const PENDING_AUTH_STORAGE_KEY = "bingra.pending-auth-context.v1";
const PENDING_AUTH_COOKIE_KEY = "bingra-pending-auth-context";
const PENDING_AUTH_MAX_AGE_SECONDS = 6 * 60 * 60;

export function sanitizeNextPath(input: string | null | undefined, fallback = "/"): string {
  if (!input || !input.startsWith("/")) {
    return fallback;
  }

  return input;
}

function extractInternalPathFromMaybeAbsoluteUrl(input: string | null | undefined): string | null {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function parsePathToSearchParams(path: string | null | undefined): URLSearchParams | null {
  if (!path) {
    return null;
  }

  try {
    const parsed = new URL(path, "http://localhost");
    if (
      parsed.pathname === "/auth/confirm" ||
      parsed.pathname === "/auth/callback" ||
      parsed.pathname === "/auth/finalize"
    ) {
      return parsed.searchParams;
    }

    return null;
  } catch {
    return null;
  }
}

function readParamWithNestedFallback(
  searchParams: URLSearchParams,
  nestedParams: URLSearchParams | null,
  key: string,
): string | null {
  return searchParams.get(key) ?? nestedParams?.get(key) ?? null;
}

export function resolveNextPathFromSearchParams(searchParams: URLSearchParams): string | undefined {
  const rawNext = searchParams.get("next");
  const rawRedirectTo = searchParams.get("redirect_to");

  const candidate = rawNext ?? rawRedirectTo;
  const extracted = extractInternalPathFromMaybeAbsoluteUrl(candidate);

  const nestedParams = parsePathToSearchParams(extracted);
  if (nestedParams) {
    return resolveNextPathFromSearchParams(nestedParams);
  }

  return extracted ?? undefined;
}

export function deriveGameSlug(nextPath: string): string | undefined {
  const match = /^\/g\/([^/?#]+)/.exec(nextPath);
  return match?.[1];
}

export function normalizePendingAuthContext(
  context: Partial<PendingAuthContext> | undefined,
  fallbackNext = "/",
): PendingAuthContext {
  let nextPath = sanitizeNextPath(context?.nextPath, fallbackNext);

  if ((nextPath === "/" || nextPath === "/me") && context?.gameSlug) {
    nextPath = sanitizeNextPath(`/g/${context.gameSlug}/play`, fallbackNext);
  }

  return {
    nextPath,
    gameSlug: context?.gameSlug ?? deriveGameSlug(nextPath),
    playerId: context?.playerId,
    linkPlayerId: context?.linkPlayerId,
    expectedLink: Boolean(context?.expectedLink),
    intent: context?.intent,
    email: context?.email?.trim() || undefined,
  };
}

export function readPendingAuthContextFromSearchParams(searchParams: URLSearchParams): PendingAuthContext {
  const resolvedNextPath = resolveNextPathFromSearchParams(searchParams);
  const nestedParams = parsePathToSearchParams(
    extractInternalPathFromMaybeAbsoluteUrl(searchParams.get("next") ?? searchParams.get("redirect_to")),
  );

  const intentValue =
    readParamWithNestedFallback(searchParams, nestedParams, "auth_intent") ?? undefined;

  return normalizePendingAuthContext(
    {
      nextPath: resolvedNextPath,
      gameSlug: readParamWithNestedFallback(searchParams, nestedParams, "game_slug") ?? undefined,
      playerId: readParamWithNestedFallback(searchParams, nestedParams, "player_id") ?? undefined,
      linkPlayerId: readParamWithNestedFallback(searchParams, nestedParams, "link_player_id") ?? undefined,
      expectedLink: readParamWithNestedFallback(searchParams, nestedParams, "expected_link") === "1",
      email: readParamWithNestedFallback(searchParams, nestedParams, "email") ?? undefined,
      intent:
        intentValue === "save_stats" ||
        intentValue === "account_link" ||
        intentValue === "sign_in"
          ? (intentValue as PostAuthIntent)
          : undefined,
    },
    "/me",
  );
}

export function hasPendingAuthContextInSearchParams(searchParams: URLSearchParams): boolean {
  return ["next", "redirect_to", "game_slug", "player_id", "link_player_id", "expected_link", "auth_intent", "email"].some((key) =>
    searchParams.has(key),
  );
}

function buildCookiePayload(context: PendingAuthContext) {
  return {
    ...normalizePendingAuthContext(context, "/me"),
    createdAt: Date.now(),
  };
}

function readPendingAuthContextFromRawJson(raw: string): PendingAuthContext | null {
  try {
    const parsed = JSON.parse(raw) as (PendingAuthContext & { createdAt?: number }) | null;
    if (!parsed) {
      return null;
    }

    if (parsed.createdAt && Date.now() - parsed.createdAt > PENDING_AUTH_MAX_AGE_SECONDS * 1000) {
      return null;
    }

    return normalizePendingAuthContext(parsed, "/me");
  } catch {
    return null;
  }
}

export function readPendingAuthContextFromCookieValue(cookieValue: string | null | undefined): PendingAuthContext | null {
  if (!cookieValue) {
    return null;
  }

  const decoded = decodeURIComponent(cookieValue);
  return readPendingAuthContextFromRawJson(decoded);
}

function readPendingAuthCookieValueFromDocument(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${PENDING_AUTH_COOKIE_KEY}=`));

  return entry ? entry.slice(PENDING_AUTH_COOKIE_KEY.length + 1) : null;
}

export function mergePendingAuthContexts(
  primary: PendingAuthContext | null | undefined,
  fallback: PendingAuthContext | null | undefined,
): PendingAuthContext {
  if (!primary && fallback) {
    return normalizePendingAuthContext(fallback, "/me");
  }

  if (!fallback && primary) {
    return normalizePendingAuthContext(primary, "/me");
  }

  return normalizePendingAuthContext(
    {
      ...(fallback ?? {}),
      ...(primary ?? {}),
    },
    "/me",
  );
}

export function clearPendingAuthContextCookie() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${PENDING_AUTH_COOKIE_KEY}=; Max-Age=0; Path=/; SameSite=Lax`;
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
  // Keep `type=email` in the callback query so custom token_hash-based email templates
  // can route directly to a first-class /auth/confirm verification path.
  confirmUrl.searchParams.set("type", "email");
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

  if (normalized.email) {
    confirmUrl.searchParams.set("email", normalized.email);
  }

  return `${confirmUrl.pathname}${confirmUrl.search}`;
}

export function savePendingAuthContext(context: PendingAuthContext) {
  if (typeof window === "undefined") {
    return;
  }

  const payload = buildCookiePayload(context);

  const serialized = JSON.stringify(payload);
  window.localStorage.setItem(PENDING_AUTH_STORAGE_KEY, serialized);
  window.sessionStorage.setItem(PENDING_AUTH_STORAGE_KEY, serialized);
  document.cookie = `${PENDING_AUTH_COOKIE_KEY}=${encodeURIComponent(serialized)}; Max-Age=${PENDING_AUTH_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

export function readPendingAuthContextFromStorage(): PendingAuthContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw =
    window.localStorage.getItem(PENDING_AUTH_STORAGE_KEY) ||
    window.sessionStorage.getItem(PENDING_AUTH_STORAGE_KEY) ||
    readPendingAuthCookieValueFromDocument();
  if (!raw) {
    return null;
  }

  const parsed = readPendingAuthContextFromRawJson(raw);
  if (!parsed) {
    window.localStorage.removeItem(PENDING_AUTH_STORAGE_KEY);
    window.sessionStorage.removeItem(PENDING_AUTH_STORAGE_KEY);
    clearPendingAuthContextCookie();
  }

  return parsed;
}

export function clearPendingAuthContextFromStorage() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PENDING_AUTH_STORAGE_KEY);
  window.sessionStorage.removeItem(PENDING_AUTH_STORAGE_KEY);
  clearPendingAuthContextCookie();
}

export function getPendingAuthContextCookieKey(): string {
  return PENDING_AUTH_COOKIE_KEY;
}
