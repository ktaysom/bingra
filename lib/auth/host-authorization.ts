import { createSupabaseAdminClient } from "../supabase/admin";
import { createSupabaseServerClient } from "../supabase/server";
import { resolveCanonicalAccountIdForAuthUserId } from "./profiles";
import { cookies } from "next/headers";

type GameAuthorityRow = {
  id: string;
  slug: string;
  status: "lobby" | "live" | "finished";
  completion_mode: "BLACKOUT" | "STREAK";
  restricted_scoring: boolean;
  host_account_id: string | null;
};

export type HostAuthorizationResult = {
  gameId: string;
  slug: string;
  status: "lobby" | "live" | "finished";
  completionMode: "BLACKOUT" | "STREAK";
  restrictedScoring: boolean;
  hostAccountId: string | null;
  actorAccountId: string | null;
};

export async function assertHostAuthorized(gameSlug: string): Promise<HostAuthorizationResult> {
  const startedAt = Date.now();
  const logTiming = (segment: string, segmentStartedAt: number, extra?: Record<string, unknown>) => {
    console.info("[auth][host-authorization][timing]", {
      gameSlug,
      segment,
      durationMs: Date.now() - segmentStartedAt,
      totalDurationMs: Date.now() - startedAt,
      ...(extra ?? {}),
    });
  };

  const supabase = createSupabaseAdminClient();
  let actorAccountId: string | null = null;

  const cookieStoreStartedAt = Date.now();
  const cookieStore = await cookies();
  logTiming("cookies-store-resolve", cookieStoreStartedAt);
  const cookiePlayerId = cookieStore.get("bingra-player-id")?.value ?? null;

  const cookieLookupStartedAt = Date.now();
  const { data: cookiePlayer, error: cookiePlayerError } = cookiePlayerId
    ? await supabase
        .from("players")
        .select("id, game_id, role, profile_id")
        .eq("id", cookiePlayerId)
        .maybeSingle<{
          id: string;
          game_id: string;
          role: "host" | "scorer" | "player";
          profile_id: string | null;
        }>()
    : { data: null, error: null };
  logTiming("cookie-player-lookup", cookieLookupStartedAt, {
    hasCookiePlayer: Boolean(cookiePlayer?.id),
    hasError: Boolean(cookiePlayerError),
    hasCookiePlayerId: Boolean(cookiePlayerId),
  });

  if (cookiePlayerError) {
    throw new Error(cookiePlayerError.message || "Unable to resolve player session");
  }

  const cookieGameLookupStartedAt = Date.now();
  const { data: cookieGame, error: cookieGameError } =
    cookiePlayer?.game_id && cookiePlayer.role === "host"
      ? await supabase
          .from("games")
          .select("id, slug, status, completion_mode, restricted_scoring, host_account_id")
          .eq("id", cookiePlayer.game_id)
          .maybeSingle<GameAuthorityRow>()
      : { data: null, error: null };
  logTiming("cookie-player-game-lookup", cookieGameLookupStartedAt, {
    hasCookieGame: Boolean(cookieGame?.id),
    hasError: Boolean(cookieGameError),
    hasCookiePlayer: Boolean(cookiePlayer?.id),
  });

  if (cookieGameError) {
    throw new Error(cookieGameError.message || "Unable to resolve player game session");
  }

  if (cookieGame && cookieGame.slug === gameSlug) {
    actorAccountId = cookiePlayer?.profile_id ?? null;
    const cookieAuthorized =
      !cookieGame.restricted_scoring ||
      (cookiePlayer?.role === "host" &&
        Boolean(actorAccountId) &&
        Boolean(cookieGame.host_account_id) &&
        actorAccountId === cookieGame.host_account_id);

    if (cookieAuthorized) {
      logTiming("authorization-finished", startedAt, {
        source: "cookie-player",
        restrictedScoring: cookieGame.restricted_scoring,
        hasActorAccountId: Boolean(actorAccountId),
      });
      return {
        gameId: cookieGame.id,
        slug: cookieGame.slug,
        status: cookieGame.status,
        completionMode: cookieGame.completion_mode,
        restrictedScoring: cookieGame.restricted_scoring,
        hostAccountId: cookieGame.host_account_id,
        actorAccountId,
      };
    }
  }

  const gameLookupStartedAt = Date.now();
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, slug, status, completion_mode, restricted_scoring, host_account_id")
    .eq("slug", gameSlug)
    .maybeSingle<GameAuthorityRow>();
  logTiming("game-lookup", gameLookupStartedAt, {
    foundGame: Boolean(game),
    hasError: Boolean(gameError),
    source: "fallback",
  });

  if (gameError) {
    throw new Error(gameError.message || "Unable to load game");
  }

  if (!game) {
    throw new Error("Game not found");
  }

  const serverClientStartedAt = Date.now();
  const supabaseServer = await createSupabaseServerClient();
  logTiming("server-client-create", serverClientStartedAt);

  const authFetchStartedAt = Date.now();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();
  logTiming("auth-getUser", authFetchStartedAt, {
    hasUser: Boolean(user?.id),
  });

  if (user?.id) {
    const accountResolveStartedAt = Date.now();
    actorAccountId = await resolveCanonicalAccountIdForAuthUserId(user.id);
    logTiming("account-resolve", accountResolveStartedAt, {
      hasActorAccountId: Boolean(actorAccountId),
    });
  }

  if (game.restricted_scoring) {
    if (!user?.id || !actorAccountId) {
      throw new Error("You must be signed in as the host to perform this action.");
    }

    if (!game.host_account_id) {
      throw new Error("Host ownership is not configured for this game.");
    }

    if (actorAccountId !== game.host_account_id) {
      throw new Error("Only the host can perform this action.");
    }
  }

  logTiming("authorization-finished", startedAt, {
    source: "auth-fallback",
    restrictedScoring: game.restricted_scoring,
    hasActorAccountId: Boolean(actorAccountId),
  });
  return {
    gameId: game.id,
    slug: game.slug,
    status: game.status,
    completionMode: game.completion_mode,
    restrictedScoring: game.restricted_scoring,
    hostAccountId: game.host_account_id,
    actorAccountId,
  };
}
