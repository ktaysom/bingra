import type { Metadata } from "next";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { ensurePlayerLinkedToAuthenticatedUser } from "../../../../lib/auth/link-player";
import {
  resolveCanonicalAccountIdForAuthUserId,
  resolveProfileDefaultDisplayName,
} from "../../../../lib/auth/profiles";
import type { CompletionMode } from "../../../../lib/bingra/card-progress";
import { PlayPageContent } from "./PlayPageContent";

type PlayPageProps = {
  params: Promise<{
    slug: string;
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

export default async function PlayPage(props: PlayPageProps) {
  const { slug } = await props.params;
  const supabase = createSupabaseAdminClient();
  const supabaseServer = await createSupabaseServerClient();
  const cookieStore = await cookies();

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select(
      "id, slug, title, status, completed_at, winner_player_id, mode, team_a_name, team_b_name, team_scope, events_per_card, completion_mode, end_condition, sport_profile, restricted_scoring, host_account_id",
    )
    .eq("slug", slug)
    .maybeSingle<GameRecord>();

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
  } = await supabaseServer.auth.getUser();

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

  let resolvedSessionPlayerId: string | null = null;

  if (cookiePlayerId) {
    const { data: sessionPlayer, error: sessionPlayerError } = await supabase
      .from("players")
      .select("id, game_id")
      .eq("id", cookiePlayerId)
      .maybeSingle<{ id: string; game_id: string }>();

    if (!sessionPlayerError && sessionPlayer && sessionPlayer.game_id === game.id) {
      resolvedSessionPlayerId = sessionPlayer.id;
    }
  }

  if (!resolvedSessionPlayerId && isSignedInHostForRestrictedGame && user?.id && actorAccountId) {
    const { data: existingHostPlayer, error: existingHostPlayerError } = await supabase
      .from("players")
      .select("id, profile_id")
      .eq("game_id", game.id)
      .eq("role", "host")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string; profile_id: string | null }>();

    if (existingHostPlayerError) {
      console.error("[play/page] host player recovery lookup failed", {
        slug,
        userId: user.id,
        error: existingHostPlayerError,
      });
      redirect(`/g/${slug}`);
    }

    if (existingHostPlayer?.id) {
      if (!existingHostPlayer.profile_id) {
        await supabase
          .from("players")
          .update({ profile_id: actorAccountId })
          .eq("id", existingHostPlayer.id)
          .is("profile_id", null)
          .limit(1);
      }

      resolvedSessionPlayerId = existingHostPlayer.id;
    } else {
      const hostDisplayName = await resolveProfileDefaultDisplayName(user.id);
      const { data: insertedHostPlayer, error: insertedHostPlayerError } = await supabase
        .from("players")
        .insert({
          game_id: game.id,
          display_name: hostDisplayName,
          role: "host",
          join_token: randomUUID(),
          profile_id: actorAccountId,
        })
        .select("id")
        .maybeSingle<{ id: string }>();

      if (insertedHostPlayerError || !insertedHostPlayer?.id) {
        console.error("[play/page] host player recovery create failed", {
          slug,
          userId: user.id,
          error: insertedHostPlayerError,
        });
        redirect(`/g/${slug}`);
      }

      resolvedSessionPlayerId = insertedHostPlayer.id;
    }
  }

  if (!resolvedSessionPlayerId) {
    redirect(`/g/${slug}`);
  }

  cookieStore.set({
    name: "bingra-player-id",
    value: resolvedSessionPlayerId,
    path: `/g/${slug}`,
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: "lax",
  });

  if (user?.id) {
    try {
      await ensurePlayerLinkedToAuthenticatedUser({
        playerId: resolvedSessionPlayerId,
        authUserId: user.id,
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

  return (
    <PlayPageContent
      game={game}
      currentPlayerId={resolvedSessionPlayerId}
      slug={slug}
      canManageRestrictedScoring={canManageRestrictedScoring}
    />
  );
}