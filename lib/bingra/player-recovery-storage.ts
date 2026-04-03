export type PlayerRecoveryStorageRecord = {
  playerId: string;
  recoveryToken: string;
  savedAt: number;
};

const PLAYER_RECOVERY_STORAGE_PREFIX = "bingra:player-recovery:";
const PLAYER_RECOVERY_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

function getPlayerRecoveryCookieName(slug: string): string {
  return `bingra-player-recovery-token-${slug}`;
}

export function getPlayerRecoveryStorageKey(slug: string): string {
  return `${PLAYER_RECOVERY_STORAGE_PREFIX}${slug}`;
}

export function readPlayerRecoveryHandoffCookie(slug: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookieName = getPlayerRecoveryCookieName(slug);
  const entry = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));

  if (!entry) {
    return null;
  }

  const rawValue = entry.slice(cookieName.length + 1);
  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

export function clearPlayerRecoveryHandoffCookie(slug: string): void {
  if (typeof document === "undefined") {
    return;
  }

  const cookieName = getPlayerRecoveryCookieName(slug);
  const secure = typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie = `${cookieName}=; Max-Age=0; Path=/g/${slug}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function savePlayerRecoveryToStorage(input: {
  slug: string;
  recoveryToken: string;
  playerId?: string | null;
}): void {
  if (typeof window === "undefined") {
    return;
  }

  const record: PlayerRecoveryStorageRecord = {
    playerId: input.playerId ?? "",
    recoveryToken: input.recoveryToken,
    savedAt: Date.now(),
  };

  window.localStorage.setItem(getPlayerRecoveryStorageKey(input.slug), JSON.stringify(record));
}

export function readPlayerRecoveryFromStorage(slug: string): PlayerRecoveryStorageRecord | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(getPlayerRecoveryStorageKey(slug));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PlayerRecoveryStorageRecord>;
    if (
      typeof parsed.recoveryToken !== "string" ||
      !parsed.recoveryToken ||
      typeof parsed.savedAt !== "number"
    ) {
      return null;
    }

    return {
      playerId: typeof parsed.playerId === "string" ? parsed.playerId : "",
      recoveryToken: parsed.recoveryToken,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

export function removePlayerRecoveryFromStorage(slug: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(getPlayerRecoveryStorageKey(slug));
}

export function removeStalePlayerRecoveryFromStorage(slug: string): void {
  const record = readPlayerRecoveryFromStorage(slug);
  if (!record) {
    removePlayerRecoveryFromStorage(slug);
    return;
  }

  if (Date.now() - record.savedAt > PLAYER_RECOVERY_MAX_AGE_MS) {
    removePlayerRecoveryFromStorage(slug);
  }
}
