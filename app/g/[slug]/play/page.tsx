import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { ensurePlayerLinkedToAuthenticatedUser } from "../../../../lib/auth/link-player";
import { resolveCanonicalAccountIdForAuthUserId } from "../../../../lib/auth/profiles";
import type { CompletionMode } from "../../../../lib/bingra/card-progress";

const PLAY_PAGE_MODULE_LOADED_AT = Date.now();

type PlayPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    joined?: string;
    jt?: string;
  }>;
};

type GameRecord = {
  id: string;
  slug: string;
  title: string | null;
  status: "lobby" | "live" | "finished";
  created_at: string | null;
  completed_at: string | null;
  winner_player_id: string | null;
  mode: "quick_play" | "streak";
  team_a_name: string;
  team_b_name: string;
  team_scope: "both_teams" | "team_a_only" | "team_b_only";
  events_per_card: number;
  completion_mode: CompletionMode;
  end_condition: "FIRST_COMPLETION" | "HOST_DECLARED";
  sport_profile: string | null;
  restricted_scoring: boolean;
  host_account_id: string | null;
};

export const metadata: Metadata = {
  title: "Play Game",
};

export default async function PlayPage(props: PlayPageProps) {
  const requestStartedAt = Date.now();
  const { slug } = await props.params;
  const searchParams = (await props.searchParams) ?? {};
  const logTiming = (segment: string, startedAt: number, extra?: Record<string, unknown>) => {
    console.info("[play/page][timing]", {
      slug,
      segment,
      durationMs: Date.now() - startedAt,
      totalDurationMs: Date.now() - requestStartedAt,
      moduleLoadAgeMs: requestStartedAt - PLAY_PAGE_MODULE_LOADED_AT,
      ...(extra ?? {}),
    });
  };

  logTiming("request-start", requestStartedAt, {
    searchParamKeys: Object.keys(searchParams),
  });

  const supabase = createSupabaseAdminClient();
  const cookieStore = await cookies();

  const gameFetchStartedAt = Date.now();
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select(
      "id, slug, title, status, created_at, completed_at, winner_player_id, mode, team_a_name, team_b_name, team_scope, events_per_card, completion_mode, end_condition, sport_profile, restricted_scoring, host_account_id",
    )
    .eq("slug", slug)
    .maybeSingle<GameRecord>();
  logTiming("game-fetch", gameFetchStartedAt, {
    foundGame: Boolean(game),
    hasError: Boolean(gameError),
    errorCode: gameError?.code ?? null,
    errorMessage: gameError?.message ?? null,
  });

  if (gameError) {
    console.error("[play/page] game-fetch failed", {
      slug,
      clientType: "admin",
      query: {
        table: "games",
        filter: { slug },
        select:
          "id, slug, title, status, created_at, completed_at, winner_player_id, mode, team_a_name, team_b_name, team_scope, events_per_card, completion_mode, end_condition, sport_profile, restricted_scoring, host_account_id",
      },
      error: {
        code: gameError.code ?? null,
        message: gameError.message ?? null,
        details: gameError.details ?? null,
        hint: gameError.hint ?? null,
      },
    });
  }

  if (gameError || !game) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6">
        <section className="rounded-2xl bg-white/90 p-6 text-center shadow-md">
          <h1 className="text-2xl font-semibold text-slate-900">Game not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            We couldn&apos;t find a game with slug /g/{slug}.
          </p>
        </section>
      </main>
    );
  }

  let actorAccountId: string | null = null;
  const cookiePlayerId = cookieStore.get("bingra-player-id")?.value ?? null;

  console.info("[auth][play] cookie/session snapshot", {
    slug,
    hasPlayerCookie: Boolean(cookiePlayerId),
  });

  const joinTokenFromQuery = typeof searchParams.jt === "string" ? searchParams.jt.trim() : "";

  let resolvedSessionPlayerId: string | null = null;
  let resolvedSessionPlayerProfileId: string | null = null;
  let resolvedSessionPlayerSummary:
    | {
        id: string;
        display_name: string;
        role: "host" | "scorer" | "player";
        created_at: string | null;
      }
    | null = null;
  let hasAuthenticatedUser = false;
  let userId: string | null = null;

  if (cookiePlayerId) {
    const playerResolutionStartedAt = Date.now();
    const { data: sessionPlayer, error: sessionPlayerError } = await supabase
      .from("players")
      .select("id, game_id, profile_id, display_name, role, created_at")
      .eq("id", cookiePlayerId)
      .maybeSingle<{
        id: string;
        game_id: string;
        profile_id: string | null;
        display_name: string;
        role: "host" | "scorer" | "player";
        created_at: string | null;
      }>();
    logTiming("player-resolution", playerResolutionStartedAt, {
      hasSessionPlayer: Boolean(sessionPlayer?.id),
      hasSessionPlayerError: Boolean(sessionPlayerError),
    });

    if (!sessionPlayerError && sessionPlayer && sessionPlayer.game_id === game.id) {
      resolvedSessionPlayerId = sessionPlayer.id;
      resolvedSessionPlayerProfileId = sessionPlayer.profile_id;
      resolvedSessionPlayerSummary = {
        id: sessionPlayer.id,
        display_name: sessionPlayer.display_name,
        role: sessionPlayer.role,
        created_at: sessionPlayer.created_at,
      };
      if (!actorAccountId && resolvedSessionPlayerProfileId) {
        actorAccountId = resolvedSessionPlayerProfileId;
      }
    }
  }

  const cookieSessionMatchesRestrictedHost =
    Boolean(game.restricted_scoring) &&
    Boolean(resolvedSessionPlayerId) &&
    Boolean(resolvedSessionPlayerProfileId) &&
    Boolean(game.host_account_id) &&
    resolvedSessionPlayerProfileId === game.host_account_id;

  const shouldResolveServerAuth =
    !resolvedSessionPlayerId ||
    !resolvedSessionPlayerProfileId ||
    (game.restricted_scoring && !cookieSessionMatchesRestrictedHost);

  if (shouldResolveServerAuth) {
    const authClientStartedAt = Date.now();
    const supabaseServer = await createSupabaseServerClient();
    logTiming("auth-client-setup", authClientStartedAt);

    const authFetchStartedAt = Date.now();
    const authResponse = await supabaseServer.auth.getClaims();
    const claims = authResponse.data?.claims;
    const resolvedUserId =
      typeof claims?.sub === "string" && claims.sub.trim().length > 0
        ? claims.sub
        : null;

    hasAuthenticatedUser = Boolean(resolvedUserId);
    userId = resolvedUserId;

    logTiming("auth-session-fetch", authFetchStartedAt, {
      hasUser: hasAuthenticatedUser,
    });

    console.info("[auth][play] server auth snapshot", {
      slug,
      hasUser: hasAuthenticatedUser,
      userId,
    });
  } else {
    hasAuthenticatedUser = Boolean(resolvedSessionPlayerProfileId);
    logTiming("auth-session-fetch", requestStartedAt, {
      hasUser: hasAuthenticatedUser,
      skipped: true,
    });
    console.info("[auth][play] server auth snapshot", {
      slug,
      hasUser: hasAuthenticatedUser,
      userId: null,
      skipped: true,
    });
  }

  const shouldResolveActorAccountId =
    Boolean(userId) &&
    (game.restricted_scoring || !resolvedSessionPlayerId || !resolvedSessionPlayerProfileId);

  if (userId && shouldResolveActorAccountId && !actorAccountId) {
    const actorAccountResolveStartedAt = Date.now();
    actorAccountId = await resolveCanonicalAccountIdForAuthUserId(userId);
    logTiming("actor-account-resolve", actorAccountResolveStartedAt, {
      resolvedActorAccountId: Boolean(actorAccountId),
    });
  }

  const isSignedInHostForRestrictedGame =
    cookieSessionMatchesRestrictedHost ||
    (game.restricted_scoring &&
      Boolean(actorAccountId) &&
      Boolean(game.host_account_id) &&
      actorAccountId === game.host_account_id);

  if (!resolvedSessionPlayerId && isSignedInHostForRestrictedGame && userId && actorAccountId) {
    console.warn("[auth][play] signed-in host missing player session cookie; redirecting to recover-host", {
      slug,
      userId,
      actorAccountId,
    });
    redirect(`/g/${slug}/play/recover-host`);
  }

  if (!resolvedSessionPlayerId) {
    console.warn("[auth][play] no resolved player session; redirecting to join page", {
      slug,
      hasServerUser: hasAuthenticatedUser,
      hasPlayerCookie: Boolean(cookiePlayerId),
    });
    redirect(`/g/${slug}`);
  }

  const consumeJoinQueryOnMount = searchParams.joined === "1" || Boolean(joinTokenFromQuery);

  const shouldEnsureLink =
    Boolean(userId) &&
    Boolean(resolvedSessionPlayerId) &&
    (!resolvedSessionPlayerProfileId ||
      (Boolean(actorAccountId) && resolvedSessionPlayerProfileId !== actorAccountId));

  if (shouldEnsureLink && userId) {
    try {
      const playerLinkStartedAt = Date.now();
      await ensurePlayerLinkedToAuthenticatedUser({
        playerId: resolvedSessionPlayerId,
        authUserId: userId,
        accountId: actorAccountId ?? undefined,
        context: "play/page",
      });
      logTiming("player-link-ensure", playerLinkStartedAt, {
        playerId: resolvedSessionPlayerId,
      });
    } catch (error) {
      console.error("[play/page] failed to ensure authenticated player linkage", {
        slug,
        playerId: resolvedSessionPlayerId,
        userId,
        error,
      });
    }
  }

  const canManageRestrictedScoring =
    !game.restricted_scoring ||
    cookieSessionMatchesRestrictedHost ||
    (Boolean(actorAccountId) && Boolean(game.host_account_id) && actorAccountId === game.host_account_id);

  const gameCreatedAtMs = game.created_at ? new Date(game.created_at).getTime() : Number.NaN;
  const playerCreatedAtMs = resolvedSessionPlayerSummary?.created_at
    ? new Date(resolvedSessionPlayerSummary.created_at).getTime()
    : Number.NaN;
  const freshLobbyAgeThresholdMs = 30_000;
  const preferFreshLobbyFastPath =
    game.status === "lobby" &&
    resolvedSessionPlayerSummary?.role === "host" &&
    Number.isFinite(gameCreatedAtMs) &&
    Number.isFinite(playerCreatedAtMs) &&
    requestStartedAt - gameCreatedAtMs <= freshLobbyAgeThresholdMs &&
    requestStartedAt - playerCreatedAtMs <= freshLobbyAgeThresholdMs;

  const playPageContentModuleStartedAt = Date.now();
  const playPageContentModule = await import("./PlayPageContent");
  logTiming("content-module-import", playPageContentModuleStartedAt);

  logTiming("final-page-assembly", requestStartedAt, {
    hasAuthenticatedUser,
    hasResolvedPlayer: Boolean(resolvedSessionPlayerId),
    preferFreshLobbyFastPath,
  });

  const { PlayPageContent } = playPageContentModule;

  return (
    <PlayPageContent
      game={game}
      currentPlayerId={resolvedSessionPlayerId}
      slug={slug}
      hasAuthenticatedUser={hasAuthenticatedUser}
      consumeJoinQueryOnMount={consumeJoinQueryOnMount}
      canManageRestrictedScoring={canManageRestrictedScoring}
      currentPlayerSummary={resolvedSessionPlayerSummary}
      preferFreshLobbyFastPath={preferFreshLobbyFastPath}
    />
  );
}
