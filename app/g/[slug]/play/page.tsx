import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { ensurePlayerLinkedToAuthenticatedUser } from "../../../../lib/auth/link-player";
import { resolveCanonicalAccountIdForAuthUserId } from "../../../../lib/auth/profiles";
import type { CompletionMode } from "../../../../lib/bingra/card-progress";
import { PlayPageContent } from "./PlayPageContent";
import { getPublicBaseUrl } from "../../../../lib/share/share";

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

const JOIN_PROMPT_COOKIE_NAME = "bingra-join-prompt-token";

export default async function PlayPage(props: PlayPageProps) {
  const renderStartedAt = Date.now();
  const { slug } = await props.params;
  const searchParams = (await props.searchParams) ?? {};

  const supabase = createSupabaseAdminClient();
  const supabaseServer = await createSupabaseServerClient();
  const cookieStore = await cookies();

  const gamePromise = supabase
    .from("games")
    .select(
      "id, slug, title, status, completed_at, winner_player_id, mode, team_a_name, team_b_name, team_scope, events_per_card, completion_mode, end_condition, sport_profile, restricted_scoring, host_account_id",
    )
    .eq("slug", slug)
    .maybeSingle<GameRecord>();

  const authPromise = supabaseServer.auth.getUser();

  const [{ data: game, error: gameError }, authResponse] = await Promise.all([
    gamePromise,
    authPromise,
  ]);

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

  const {
    data: { user },
  } = authResponse;

  let actorAccountId: string | null = null;
  if (user?.id) {
    actorAccountId = await resolveCanonicalAccountIdForAuthUserId(user.id);
  }

  const isSignedInHostForRestrictedGame =
    game.restricted_scoring &&
    Boolean(actorAccountId) &&
    Boolean(game.host_account_id) &&
    actorAccountId === game.host_account_id;

  const cookiePlayerId = cookieStore.get("bingra-player-id")?.value ?? null;
  const joinPromptCookie = cookieStore.get(JOIN_PROMPT_COOKIE_NAME)?.value ?? null;

  const joinTokenFromQuery = typeof searchParams.jt === "string" ? searchParams.jt.trim() : "";

  const shouldPromptInvite =
    searchParams.joined === "1" &&
    Boolean(joinTokenFromQuery) &&
    Boolean(joinPromptCookie) &&
    joinPromptCookie === joinTokenFromQuery;

  let resolvedSessionPlayerId: string | null = null;
  let resolvedSessionPlayerProfileId: string | null = null;

  if (cookiePlayerId) {
    const { data: sessionPlayer, error: sessionPlayerError } = await supabase
      .from("players")
      .select("id, game_id, profile_id")
      .eq("id", cookiePlayerId)
      .maybeSingle<{ id: string; game_id: string; profile_id: string | null }>();

    if (!sessionPlayerError && sessionPlayer && sessionPlayer.game_id === game.id) {
      resolvedSessionPlayerId = sessionPlayer.id;
      resolvedSessionPlayerProfileId = sessionPlayer.profile_id;
    }
  }

  if (!resolvedSessionPlayerId && isSignedInHostForRestrictedGame && user?.id && actorAccountId) {
    redirect(`/g/${slug}/play/recover-host`);
  }

  if (!resolvedSessionPlayerId) {
    redirect(`/g/${slug}`);
  }

  const consumeJoinQueryOnMount = searchParams.joined === "1" || Boolean(joinTokenFromQuery);

  const shouldEnsureLink =
    Boolean(user?.id) &&
    Boolean(resolvedSessionPlayerId) &&
    (!resolvedSessionPlayerProfileId ||
      (Boolean(actorAccountId) && resolvedSessionPlayerProfileId !== actorAccountId));

  if (shouldEnsureLink && user?.id) {
    try {
      await ensurePlayerLinkedToAuthenticatedUser({
        playerId: resolvedSessionPlayerId,
        authUserId: user.id,
        accountId: actorAccountId ?? undefined,
        context: "play/page",
      });
    } catch (error) {
      console.error("[play/page] failed to ensure authenticated player linkage", {
        slug,
        playerId: resolvedSessionPlayerId,
        userId: user.id,
        error,
      });
    }
  }

  const canManageRestrictedScoring =
    !game.restricted_scoring ||
    (Boolean(actorAccountId) && Boolean(game.host_account_id) && actorAccountId === game.host_account_id);

  console.info("[play/page][perf] render end", {
    slug,
    durationMs: Date.now() - renderStartedAt,
    currentPlayerId: resolvedSessionPlayerId,
    canManageRestrictedScoring,
  });

  return (
    <PlayPageContent
      game={game}
      currentPlayerId={resolvedSessionPlayerId}
      slug={slug}
      joinedFromQuery={shouldPromptInvite}
      consumeJoinQueryOnMount={consumeJoinQueryOnMount}
      canManageRestrictedScoring={canManageRestrictedScoring}
    />
  );
}