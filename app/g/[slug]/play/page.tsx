import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
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
  winner_player_id: string | null;
  mode: "quick_play" | "streak";
  team_a_name: string;
  team_b_name: string;
  team_scope: "both_teams" | "team_a_only" | "team_b_only";
  events_per_card: number;
  completion_mode: CompletionMode;
  end_condition: "FIRST_COMPLETION" | "HOST_DECLARED";
};

export const metadata: Metadata = {
  title: "Play Game",
};

export default async function PlayPage(props: PlayPageProps) {
  const { slug } = await props.params;
  const supabase = createSupabaseAdminClient();
  const cookieStore = await cookies();

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select(
      "id, slug, title, status, winner_player_id, mode, team_a_name, team_b_name, team_scope, events_per_card, completion_mode, end_condition",
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

  const cookiePlayerId = cookieStore.get("bingra-player-id")?.value ?? null;

  if (!cookiePlayerId) {
    redirect(`/g/${slug}`);
  }

  const { data: sessionPlayer, error: sessionPlayerError } = await supabase
    .from("players")
    .select("id, game_id")
    .eq("id", cookiePlayerId)
    .maybeSingle<{ id: string; game_id: string }>();

  if (sessionPlayerError || !sessionPlayer || sessionPlayer.game_id !== game.id) {
    redirect(`/g/${slug}`);
  }

  return <PlayPageContent game={game} currentPlayerId={sessionPlayer.id} slug={slug} />;
}