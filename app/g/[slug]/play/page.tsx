import type { Metadata } from "next";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { CardBuilderPanel } from "./CardBuilderPanel";
import { HostScoringPanel } from "./HostScoringPanel";
import { getPlayModeLabel, mapPlayModeToGameMode } from "../../../../lib/binga/types";
import { chooseRandomEvents, getEventById, type RiskLevel } from "../../../../lib/binga/event-logic";

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
  mode: "quick_play" | "streak";
};

type PlayerRecord = {
  id: string;
  display_name: string;
  role: "host" | "scorer" | "player";
};

type LeaderboardEntry = {
  id: string;
  name: string;
  points: number;
};

type RecentScoredEvent = {
  id: string;
  event_key: string;
  event_label: string | null;
  team_key: string | null;
  created_at: string | null;
};

export const metadata: Metadata = {
  title: "Play Game",
};

export default async function PlayPage(props: PlayPageProps) {
  const { slug } = await props.params;
  const supabase = createSupabaseAdminClient();

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("id, slug, title, status, mode")
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

  if (gameError || !game) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-4xl flex-col gap-6 px-6 py-12">
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Game not found</h1>
          <p className="mt-2 text-sm text-slate-500">
            We couldn&apos;t find a game with slug /g/{slug}.
          </p>
        </section>
      </main>
    );
  }

  const playerCount = players?.length ?? 0;
  const modeLabel = getPlayModeLabel(game.mode);
  const initialRiskLevel: RiskLevel = 3;
  const initialCardEvents = chooseRandomEvents(9, {
    mode: mapPlayModeToGameMode(game.mode),
    riskLevel: initialRiskLevel,
    uniqueByEventId: true,
    includeGameScopedEvents: true,
  });

  const isGameFinished = game.status === "finished";

  const activityFeed = [
    { id: "1", actor: "Host", action: "queued the matchup", timestamp: "2m ago" },
    { id: "2", actor: "Scout", action: "shared film notes", timestamp: "5m ago" },
    { id: "3", actor: "System", action: "synced game clock", timestamp: "12m ago" },
  ];

  const mockLeaderboard: LeaderboardEntry[] = [
    { id: "mock-1", name: "Jordan Alvarez", points: 52 },
    { id: "mock-2", name: "Maya Coleman", points: 47 },
    { id: "mock-3", name: "Riley Chen", points: 38 },
    { id: "mock-4", name: "Dev Patel", points: 30 },
  ];

  const leaderboardEntries: LeaderboardEntry[] =
    playersError || !players || players.length === 0
      ? mockLeaderboard
      : players.map((player, index) => ({
          id: player.id,
          name: player.display_name,
          points: Math.max(12, 48 - index * 4),
        }));

  let recentScoredEvents: RecentScoredEvent[] | null = null;
  let recentEventsError: string | null = null;

  try {
    const { data, error } = await supabase
      .from("scored_events")
      .select("id, event_key, event_label, team_key, created_at")
      .eq("game_id", game.id)
      .order("created_at", { ascending: false })
      .limit(10);

    recentScoredEvents = (data as RecentScoredEvent[] | null) ?? null;
    recentEventsError = error?.message ?? null;
  } catch (error) {
    recentEventsError = String(error);
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Player lobby
          </p>
          <h1 className="text-4xl font-semibold text-slate-900">Ready up</h1>
          <p className="font-mono text-sm text-slate-500">/g/{slug}/play</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
            {game.status === "lobby" ? "Waiting for host" : game.status}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {playerCount} players
          </span>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Game
            </p>
            <h2 className="text-3xl font-semibold text-slate-900">
              {game.title ?? "Untitled game"}
            </h2>
            <p className="font-mono text-xs uppercase text-slate-500">#{game.id}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">{modeLabel}</p>
            <p className="text-xs text-slate-500">
              Status: {game.status === "lobby" ? "Waiting for host" : game.status}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr_1fr]">
        <CardBuilderPanel
          mode={game.mode}
          initialRiskLevel={initialRiskLevel}
          initialCardEvents={initialCardEvents}
        />

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Activity feed
              </p>
              <h2 className="text-xl font-semibold text-slate-900">Latest updates</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Live
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {activityFeed.map((activity) => (
              <div
                key={activity.id}
                className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3"
              >
                <div className="flex items-center justify-between text-sm">
                  <p className="font-semibold text-slate-900">{activity.actor}</p>
                  <span className="text-xs text-slate-500">{activity.timestamp}</span>
                </div>
                <p className="text-sm text-slate-600">{activity.action}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Leaderboard
              </p>
              <h2 className="text-xl font-semibold text-slate-900">Players</h2>
            </div>
            <span className="text-sm text-slate-500">{playerCount} joined</span>
          </div>
          <div className="mt-4 space-y-3">
            {leaderboardEntries.map((entry, index) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {index + 1}. {entry.name}
                  </p>
                  <p className="text-xs text-slate-500">{entry.points} pts</p>
                </div>
                <span className="text-xs font-medium text-slate-500">Locked in</span>
              </div>
            ))}
          </div>
          {playersError && (
            <p className="mt-4 text-xs text-red-600">
              Unable to load live player data for this game.
            </p>
          )}
        </section>
      </div>

      <HostScoringPanel slug={slug} isFinished={isGameFinished} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Recent recorded events
            </p>
            <h2 className="text-xl font-semibold text-slate-900">Game writes</h2>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm text-slate-600">
          {recentScoredEvents && recentScoredEvents.length > 0 ? (
            recentScoredEvents.map((event) => {
              const catalogEvent = event.event_key
                ? getEventById(event.event_key)
                : undefined;
              const label = catalogEvent?.label ?? event.event_label ?? event.event_key;

              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2"
                >
                 <div className="space-y-0.5">
  <p className="font-medium text-slate-900">{label}</p>
  {event.team_key && (
    <p className="text-xs uppercase tracking-wide text-slate-400">
      Team {event.team_key}
    </p>
  )}
</div>
                  {event.created_at && (
                    <span className="text-[11px] text-slate-400">
                      {new Date(event.created_at).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              );
            })
          ) : recentEventsError ? (
            <p className="text-xs text-slate-400">
              Unable to load recorded events yet.
            </p>
          ) : (
            <p className="text-xs text-slate-400">No recorded events found.</p>
          )}
        </div>
      </section>
    </main>
  );
}