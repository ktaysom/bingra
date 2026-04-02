const DEFAULT_LOCAL_ORIGIN = "http://localhost:3000";

function sanitizeOrigin(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const normalized = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    return new URL(normalized).origin;
  } catch {
    return null;
  }
}

export function getPublicBaseUrl(): string {
  return (
    sanitizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    sanitizeOrigin(process.env.VERCEL_URL) ??
    DEFAULT_LOCAL_ORIGIN
  );
}

export function isLocalOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function resolveShareBaseUrl(currentOrigin?: string | null): string | null {
  const configuredPublic = sanitizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  const safeCurrent = sanitizeOrigin(currentOrigin);

  if (safeCurrent && !isLocalOrigin(safeCurrent)) {
    return safeCurrent;
  }

  if (configuredPublic) {
    return configuredPublic;
  }

  return null;
}

export function buildPreferredShareUrl(slug: string, currentOrigin?: string | null): string | null {
  const baseUrl = resolveShareBaseUrl(currentOrigin);
  if (!baseUrl) {
    return null;
  }

  return buildGameUrl(slug, baseUrl);
}

export function buildGamePath(slug: string): string {
  return `/g/${encodeURIComponent(slug)}`;
}

export function buildResultsPath(slug: string): string {
  return `${buildGamePath(slug)}/results`;
}

export function buildGameUrl(slug: string, baseUrl: string): string {
  return new URL(buildGamePath(slug), baseUrl).toString();
}

export function buildResultsUrl(slug: string, baseUrl: string): string {
  return new URL(buildResultsPath(slug), baseUrl).toString();
}

type ShareGameArgs = {
  slug: string;
  teamA: string;
  teamB: string;
};

type ShareWinnerArgs = {
  name: string | null;
};

type SharePayload = {
  text: string;
  message: string;
  url: string;
  isLocalOnly: boolean;
};

function resolveShareUrl(slug: string, currentOrigin: string | null | undefined, kind: "invite" | "results") {
  const preferredBase = resolveShareBaseUrl(currentOrigin);
  const fallbackBase = sanitizeOrigin(currentOrigin) ?? getPublicBaseUrl();
  const baseUrl = preferredBase ?? fallbackBase;
  const url = kind === "results" ? buildResultsUrl(slug, baseUrl) : buildGameUrl(slug, baseUrl);

  return {
    url,
    isLocalOnly: !preferredBase,
  };
}

export function shareInvite(game: ShareGameArgs, currentOrigin?: string | null): SharePayload {
  const teamA = game.teamA.trim() || "Team A";
  const teamB = game.teamB.trim() || "Team B";
  const { url, isLocalOnly } = resolveShareUrl(game.slug, currentOrigin, "invite");
  const text = `Join my Bingra for ${teamA} vs ${teamB} \u{1F3C0}`;

  return {
    text,
    message: `${text}\n\nPlay along here:\n${url}`,
    url,
    isLocalOnly,
  };
}

export function shareResults(
  game: ShareGameArgs,
  winner: ShareWinnerArgs | null,
  currentOrigin?: string | null,
): SharePayload {
  const teamA = game.teamA.trim() || "Team A";
  const teamB = game.teamB.trim() || "Team B";
  const winnerName = winner?.name?.trim() || null;
  const { url, isLocalOnly } = resolveShareUrl(game.slug, currentOrigin, "results");
  const text = `${winnerName ?? "Someone"} won Bingra \u{1F3C6}\n${teamA} vs ${teamB}\n\nSee the results:`;

  return {
    text,
    message: `${text}\n${url}`,
    url,
    isLocalOnly,
  };
}

export function buildInviteShareText(teamA: string, teamB: string): string {
  const safeTeamA = teamA.trim() || "Team A";
  const safeTeamB = teamB.trim() || "Team B";
  return `Join my Bingra for ${safeTeamA} vs ${safeTeamB} \u{1F3C0}`;
}

export function buildInviteMessage(teamA: string, teamB: string, gameUrl: string): string {
  return `${buildInviteShareText(teamA, teamB)}\n\nPlay along here:\n${gameUrl}`;
}

export function buildPlatformShareUrls(shareText: string, shareUrl: string) {
  const fullMessage = `${shareText} ${shareUrl}`.trim();
  const encodedMessage = encodeURIComponent(fullMessage);
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedShareText = encodeURIComponent(shareText);

  return {
    sms: `sms:?&body=${encodedMessage}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    x: `https://twitter.com/intent/tweet?text=${encodedShareText}&url=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedMessage}`,
  };
}

type ResultsShareTextArgs = {
  teamA: string;
  teamB: string;
  winnerName: string | null;
  winnerFinalScore: number | null;
  gameUrl: string;
};

export function buildResultsShareText({
  teamA,
  teamB,
  winnerName,
  winnerFinalScore,
  gameUrl,
}: ResultsShareTextArgs): string {
  const matchup = `${teamA.trim() || "Team A"} vs ${teamB.trim() || "Team B"}`;
  const winnerSegment = winnerName
    ? `🏆 ${winnerName}${typeof winnerFinalScore === "number" ? ` won with ${winnerFinalScore} pts` : " won"}`
    : "🏁 Final scores are in";

  return `${winnerSegment} in my Bingra for ${matchup}. Think you can beat this? ${gameUrl}`;
}

type ResultsCardUrlArgs = {
  slug: string;
  baseUrl: string;
  teamA: string;
  teamB: string;
  winnerName: string | null;
  winnerFinalScore: number | null;
};

export function buildResultsCardUrl({
  slug,
  baseUrl,
  teamA,
  teamB,
  winnerName,
  winnerFinalScore,
}: ResultsCardUrlArgs): string {
  const routeUrl = new URL(`/g/${encodeURIComponent(slug)}/results-card`, baseUrl);
  const params = routeUrl.searchParams;
  params.set("teamA", teamA.trim() || "Team A");
  params.set("teamB", teamB.trim() || "Team B");

  if (winnerName?.trim()) {
    params.set("winner", winnerName.trim());
  }

  if (typeof winnerFinalScore === "number") {
    params.set("score", String(winnerFinalScore));
  }

  return routeUrl.toString();
}