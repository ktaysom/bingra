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

export function buildGameUrl(slug: string, baseUrl: string): string {
  return new URL(buildGamePath(slug), baseUrl).toString();
}

export function buildInviteShareText(teamA: string, teamB: string): string {
  const safeTeamA = teamA.trim() || "Team A";
  const safeTeamB = teamB.trim() || "Team B";
  return `Join my Bingra for ${safeTeamA} vs ${safeTeamB} — first Bingra wins 🏆`;
}

export function buildInviteMessage(teamA: string, teamB: string, gameUrl: string): string {
  return `${buildInviteShareText(teamA, teamB)} ${gameUrl}`;
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