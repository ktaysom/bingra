import type { Metadata } from "next";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { InviteLinkCard, GameControlsCard } from "./ClientWidgets";

type HostPageProps = {
  params: {
    slug: string;
  };
};

type GameRecord = {
  id: string;
  slug: string;
  title: string | null;
  status: "lobby" | "live" | "finished";
  team_a_name: string;
  team_b_name: string;
  team_scope: "both_teams" | "team_a_only" | "team_b_only";
  events_per_card: number;
  completion_mode: "BLACKOUT" | "STREAK";
  end_condition: "FIRST_COMPLETION" | "HOST_DECLARED";
};

type PlayerRecord = {
  id: string;
  display_name: string;
  role: "host" | "scorer" | "player";
};

export const metadata: Metadata = {
  title: "Host Game",
};

export default async function HostPage(props: HostPageProps) {
  const { slug } = await props.params;
  const supabase = createSupabaseAdminClient();

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select(
      "id, slug, title, status, team_a_name, team_b_name, team_scope, events_per_card, completion_mode, end_condition",
    )
    .eq("slug", slug)
    .maybeSingle<GameRecord>();

  let players: PlayerRecord[] | null = null;
  let playersError: string | null = null;

  if (game) {
    const { data, error } = await supabase
      .from("players")
      .select("id, display_name, role")
      .eq("game_id", game.id)
      .order("role", { ascending: true })
      .order("display_name", { ascending: true })
      .returns<PlayerRecord[]>();

    players = data;
    playersError = error?.message ?? null;
  }

  let content: React.ReactNode;

  if (gameError || !game) {
    content = (
      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Game not found</h2>
        <p className="mt-2 text-neutral-600">We couldn&apos;t find a game for that slug.</p>
      </section>
    );
  } else {
    const playerCount = players?.length ?? 0;
    const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/g/${slug}`;

    const playersContent = playersError ? (
      <p className="text-sm text-red-600">Unable to load players for this game.</p>
    ) : playerCount > 0 ? (
      <ul className="divide-y divide-slate-200">
        {players!.map((player) => (
          <li key={player.id} className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-slate-900">{player.display_name}</p>
              <p className="text-xs uppercase tracking-wide text-slate-500">Joined</p>
            </div>
            {player.role === "host" ? (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                Host
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-500">Player</span>
            )}
          </li>
        ))}
      </ul>
    ) : (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
        <p className="text-sm font-medium text-slate-600">No players yet</p>
        <p className="text-xs text-slate-500">Share the invite link so players can join.</p>
      </div>
    );

    content = (
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Game</p>
            <h2 className="text-2xl font-semibold text-slate-900">{game.title}</h2>
            <div className="text-sm text-slate-500">
              <p className="font-mono text-xs uppercase">#{game.id}</p>
              <p className="text-sm text-slate-600">Status: {game.status === "lobby" ? "Waiting for players" : game.status}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Setup summary</h3>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Room</p>
                <p className="mt-1 text-sm text-slate-800">{game.title ?? "Untitled game"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Teams</p>
                <p className="mt-1 text-sm text-slate-800">{game.team_a_name} vs {game.team_b_name}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team scope</p>
                <p className="mt-1 text-sm text-slate-800">
                  {game.team_scope === "both_teams"
                    ? "Both teams"
                    : game.team_scope === "team_a_only"
                      ? `${game.team_a_name} only`
                      : `${game.team_b_name} only`}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Card completion</p>
                <p className="mt-1 text-sm text-slate-800">
                  {game.completion_mode === "STREAK" ? "Streak" : "Blackout"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">End condition</p>
                <p className="mt-1 text-sm text-slate-800">
                  {game.end_condition === "FIRST_COMPLETION" ? "First to complete" : "Host ends game"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Events per card</p>
                <p className="mt-1 text-sm text-slate-800">{game.events_per_card}</p>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Players</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{playerCount} joined</span>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              {playersContent}
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <InviteLinkCard joinUrl={joinUrl} />
          <GameControlsCard playerCount={playerCount} />
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Game preview</p>
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
              Host preview coming soon
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-6xl flex-col gap-8 px-6 py-12">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Host dashboard</p>
        <h1 className="text-4xl font-semibold text-slate-900">Manage game</h1>
        <p className="mt-2 font-mono text-sm text-slate-600">/g/{slug}</p>
      </header>
      {content}
    </main>
  );
}