import type { Metadata } from "next";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { JoinForm } from "./JoinForm";
import { joinGameAction } from "../../actions/join-game";
import { AuthEntryPoint } from "../../../components/auth/AuthEntryPoint";
import {
  getSportProfileLabel,
  resolveSportProfileKey,
} from "../../../lib/bingra/sport-profiles";

type JoinPageProps = {
  params: {
    slug: string;
  };
};

type GameRecord = {
  id: string;
  slug: string;
  title: string | null;
  team_a_name: string;
  team_b_name: string;
  sport_profile: string | null;
};

type HostRecord = {
  display_name: string;
};

export const metadata: Metadata = {
  title: "Join game",
};

export default async function JoinGamePage(props: JoinPageProps) {
  const { slug } = await props.params;
  const supabase = createSupabaseAdminClient();

  const { data: game, error } = await supabase
    .from("games")
    .select("id, slug, title, team_a_name, team_b_name, sport_profile")
    .eq("slug", slug)
    .maybeSingle<GameRecord>();

  const showError = error || !game;

  if (showError) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col items-center justify-center gap-6 px-4 text-center sm:px-6">
        <div className="rounded-2xl bg-white/90 p-8 shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500"></p>
          <h1 className="mt-3 text-3xl font-semibold text-neutral-900">We couldn&apos;t find that room</h1>
          <p className="mt-2 text-neutral-600">Double-check the link or ask the host to resend the invite.</p>
        </div>
      </main>
    );
  }

  const { data: host } = await supabase
    .from("players")
    .select("display_name")
    .eq("game_id", game.id)
    .eq("role", "host")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<HostRecord>();

  const teamAName = game.team_a_name?.trim() || "Team A";
  const teamBName = game.team_b_name?.trim() || "Team B";
  const hostName = host?.display_name?.trim() || "Host";
  const sportProfileLabel = getSportProfileLabel(resolveSportProfileKey(game.sport_profile));

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-6xl flex-col justify-center px-4 py-12 sm:px-6">
      <section className="mx-auto w-full max-w-3xl rounded-2xl bg-white/90 p-8 shadow-md">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <AuthEntryPoint nextPath={`/g/${slug}`} subtle />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
            {teamAName} vs {teamBName}
          </h1>
          <p className="text-sm text-slate-500">Hosted by {hostName}</p>
          <p className="text-xs text-slate-500">{sportProfileLabel}</p>
          <p className="pt-1 text-base font-medium text-slate-700">
            Predict what happens. Beat everyone watching.
          </p>
          {game.title ? <p className="text-xs text-slate-400">Game: {game.title}</p> : null}
        </div>

        <JoinForm slug={slug} action={joinGameAction} />
      </section>
    </main>
  );
}