import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { CardBuilderPanel } from "./CardBuilderPanel";
import { HostScoringPanel } from "./HostScoringPanel";
import { PlayRealtimeBridge } from "./PlayRealtimeBridge";
import { EndGameControl, GameStatusActionButton, ShareGameControl } from "./PlayHostControls";
import { getPlayModeLabel, mapPlayModeToGameMode } from "../../../../lib/bingra/types";
import {
  chooseRandomEvents,
  getEventById,
  type TeamKey,
  type RiskLevel,
} from "../../../../lib/bingra/event-logic";
import {
  calculateCardProgress,
  calculateCompletedCellFlags,
  type CompletionMode,
  type RecordedEvent,
  type CardCell as ProgressCardCell,
} from "../../../../lib/bingra/card-progress";

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
  team_a_name: string;
  team_b_name: string;
  team_scope: "both_teams" | "team_a_only" | "team_b_only";
  events_per_card: number;
  completion_mode: CompletionMode;
  end_condition: "FIRST_COMPLETION" | "HOST_DECLARED";
};

type PlayerRecord = {
  id: string;
  display_name: string;
  role: "host" | "scorer" | "player";
  created_at: string | null;
};

type LeaderboardEntry = {
  id: string;
  name: string;
  points: number;
  is_complete: boolean;
  is_one_away: boolean;
  completed_cells_count: number;
  join_order: number;
};

type LiveCompletionRow = {
  id: string;
  player_id: string;
  completed_at_event_id: string;
  created_at: string;
};

type RecentScoredEvent = {
  id: string;
  event_key: string | null;
  event_label: string | null;
  team_key: string | null;
  created_at: string | null;
};

type CardRow = {
  id: string;
  player_id: string;
  card_cells: {
    order_index: number;
    event_key: string | null;
    event_label: string | null;
    team_key: string | null;
    point_value: number | null;
  }[];
};

export const metadata: Metadata = {
  title: "Play Game",
};

export default async function PlayPage(props: PlayPageProps) {
  const { slug } = await props.params;
  const supabase = createSupabaseAdminClient();
  const cookieStore = await cookies();
  const currentPlayerId = cookieStore.get("bingra-player-id")?.value ?? null;

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select(
      "id, slug, title, status, mode, team_a_name, team_b_name, team_scope, events_per_card, completion_mode, end_condition",
    )
    .eq("slug", slug)
    .maybeSingle<GameRecord>();

  let players: PlayerRecord[] | null = null;
  let playersError: string | null = null;

  if (game) {
    const { data, error } = await supabase
      .from("players")
      .select("id, display_name, role, created_at")
      .eq("game_id", game.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .returns<PlayerRecord[]>();

    players = data;
    playersError = error?.message ?? null;
  }

  let cardsForGame: CardRow[] = [];

  if (game) {
    const { data, error } = await supabase
      .from("cards")
      .select("id, player_id, card_cells(order_index, event_key, event_label, team_key, point_value)")
      .eq("game_id", game.id)
      .returns<CardRow[]>();

    if (!error && data) {
      cardsForGame = data;
    }
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

  const playerCount = players?.length ?? 0;
  const playMode = game.completion_mode === "STREAK" ? "streak" : "quick_play";
  const modeLabel = getPlayModeLabel(playMode);
  const initialRiskLevel: RiskLevel = 3;
  const teamNames: Record<TeamKey, string> = { A: game.team_a_name, B: game.team_b_name };
  const initialCardEvents = chooseRandomEvents(game.events_per_card, {
    mode: mapPlayModeToGameMode(playMode),
    riskLevel: initialRiskLevel,
    uniqueByEventId: true,
    includeGameScopedEvents: game.team_scope === "both_teams",
  }).map((event, index) => {
    const teamKey: TeamKey | null =
      event.teamScope === "team"
        ? game.team_scope === "team_a_only"
          ? "A"
          : game.team_scope === "team_b_only"
            ? "B"
            : index % 2 === 0
              ? "A"
              : "B"
        : null;

    return {
      ...event,
      label: teamKey ? `${teamNames[teamKey]}: ${event.label}` : event.label,
      shortLabel: teamKey ? `${teamNames[teamKey]}: ${event.shortLabel}` : event.shortLabel,
      cardTeamKey: teamKey,
    };
  });

  const isLobby = game.status === "lobby";
  const isLive = game.status === "live";
  const isGameFinished = game.status === "finished";
  const lifecycleLabel = isLobby ? "Waiting for host" : isLive ? "Live" : "Ended";

  const activityFeed = [
    { id: "1", actor: "Host", action: "queued the matchup", timestamp: "2m ago" },
    { id: "2", actor: "Scout", action: "shared film notes", timestamp: "5m ago" },
    { id: "3", actor: "System", action: "synced game clock", timestamp: "12m ago" },
  ];

  let allScoredEvents: RecentScoredEvent[] = [];
  let recentEventsError: string | null = null;

  try {
    const { data, error } = await supabase
      .from("scored_events")
      .select("id, event_key, event_label, team_key, created_at")
      .eq("game_id", game.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    allScoredEvents = (data as RecentScoredEvent[] | null) ?? [];
    recentEventsError = error?.message ?? null;
  } catch (error) {
    recentEventsError = String(error);
  }

  let liveCompletions: LiveCompletionRow[] = [];
  let liveCompletionsError: string | null = null;

  try {
    const { data, error } = await supabase
      .from("game_completions")
      .select("id, player_id, completed_at_event_id, created_at")
      .eq("game_id", game.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    liveCompletions = (data as LiveCompletionRow[] | null) ?? [];
    liveCompletionsError = error?.message ?? null;
  } catch (error) {
    liveCompletionsError = String(error);
  }

  const completionMode = game.completion_mode;
  const recordedEvents: RecordedEvent[] = allScoredEvents.map((event) => ({
    event_key: event.event_key,
    team_key: event.team_key,
  }));
  const cardsByPlayerId = new Map(cardsForGame.map((card) => [card.player_id, card]));
  const playersById = new Map((players ?? []).map((player) => [player.id, player]));

  const leaderboardEntries: LeaderboardEntry[] = (players ?? [])
    .map((player, index) => {
      const card = cardsByPlayerId.get(player.id);
      const progressCells: ProgressCardCell[] = (card?.card_cells ?? []).map((cell) => ({
        event_key: cell.event_key,
        team_key: cell.team_key,
        order_index: cell.order_index,
        point_value: cell.point_value,
      }));
      const progress = calculateCardProgress(recordedEvents, progressCells, completionMode);

      return {
        id: player.id,
        name: player.display_name,
        points: progress.score,
        is_complete: progress.is_complete,
        is_one_away: progress.is_one_away,
        completed_cells_count: progress.completed_cells_count,
        join_order: index,
      };
    })
    .sort((a, b) => {
      if (a.is_complete !== b.is_complete) {
        return a.is_complete ? -1 : 1;
      }

      if (a.points !== b.points) {
        return b.points - a.points;
      }

      return a.join_order - b.join_order;
    });

  const currentPlayerCard = currentPlayerId
    ? cardsByPlayerId.get(currentPlayerId) ?? null
    : null;

  const currentPlayerProgressCells: ProgressCardCell[] = (currentPlayerCard?.card_cells ?? []).map(
    (cell) => ({
      event_key: cell.event_key,
      team_key: cell.team_key,
      order_index: cell.order_index,
      point_value: cell.point_value,
    }),
  );

  const currentPlayerCompletedFlags = calculateCompletedCellFlags(
    recordedEvents,
    currentPlayerProgressCells,
    completionMode,
  );

  const catalogEvents = (currentPlayerCard?.card_cells ?? []).map((cell, index) => {
    const eventKey = typeof cell.event_key === "string" ? cell.event_key : `cell-${index}`;
    const catalogEvent = eventKey ? getEventById(eventKey) : undefined;
    const fallbackBasePoints =
      typeof cell.point_value === "number" ? cell.point_value : 0;
    const fallbackLabel = cell.event_label ?? eventKey;
    const persistedTeamKey: TeamKey | null =
      cell.team_key === "A" || cell.team_key === "B" ? cell.team_key : null;
    const event: typeof catalogEvent extends undefined ? never : typeof catalogEvent =
      catalogEvent ?? {
        id: eventKey,
        label: fallbackLabel,
        shortLabel: fallbackLabel,
        description: "",
        category: "scoring",
        rarity: 3,
        basePoints: fallbackBasePoints,
        enabled: true,
        allowedModes: [mapPlayModeToGameMode(game.mode)],
        teamScope: "none",
        teamRole: "none",
      };

    const resolvedLabel =
      persistedTeamKey && event.teamScope === "team"
        ? `${teamNames[persistedTeamKey]}: ${event.label}`
        : event.label;

    const resolvedShortLabel =
      persistedTeamKey && event.teamScope === "team"
        ? `${teamNames[persistedTeamKey]}: ${event.shortLabel}`
        : event.shortLabel;

    return {
      ...event,
      label: resolvedLabel,
      shortLabel: resolvedShortLabel,
      cardTeamKey: persistedTeamKey,
      marked: currentPlayerCompletedFlags[index] ?? false,
    };
  });

  const lockedCardEvents = catalogEvents.length > 0 ? catalogEvents : initialCardEvents;
  const recentScoredEvents = allScoredEvents.slice(-10).reverse();

  const scoredEventOrder = new Map(allScoredEvents.map((event, index) => [event.id, index]));

  const firstCompletionEventId = liveCompletions.reduce<string | null>((winner, completion) => {
    if (!winner) {
      return completion.completed_at_event_id;
    }

    const currentOrder = scoredEventOrder.get(completion.completed_at_event_id) ?? Number.MAX_SAFE_INTEGER;
    const winningOrder = scoredEventOrder.get(winner) ?? Number.MAX_SAFE_INTEGER;

    return currentOrder < winningOrder ? completion.completed_at_event_id : winner;
  }, null);

  const tiedFirstCompleters = firstCompletionEventId
    ? liveCompletions.filter((completion) => completion.completed_at_event_id === firstCompletionEventId)
    : [];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <PlayRealtimeBridge gameId={game.id} />

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
            {lifecycleLabel}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {playerCount} players
          </span>
        </div>
      </header>

      <ShareGameControl slug={slug} title={game.title ?? "Untitled game"} />

      <section className="rounded-2xl bg-white/90 p-6 shadow-sm">
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
          <div className="rounded-2xl bg-white/90 px-4 py-3 text-sm text-slate-600 shadow-sm">
            <p className="font-semibold text-slate-900">{modeLabel}</p>
            <p className="text-xs text-slate-500">
              Status: {lifecycleLabel}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr_1fr]">
        <CardBuilderPanel
          mode={playMode}
          playerId={currentPlayerId}
          eventsPerCard={game.events_per_card}
          teamScope={game.team_scope}
          endCondition={game.end_condition}
          teamNames={teamNames}
          initialRiskLevel={initialRiskLevel}
          initialCardEvents={initialCardEvents}
          lockedCardEvents={lockedCardEvents}
        />

        <section className="rounded-2xl bg-white/90 p-6 shadow-sm">
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
            {tiedFirstCompleters.length > 0 && (
              <div className="rounded-2xl bg-white/90 px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Live first completers
                </p>
                <p className="mt-1 text-sm text-emerald-900">
                  {tiedFirstCompleters
                    .map((entry) => playersById.get(entry.player_id)?.display_name ?? "Unknown player")
                    .join(", ")}
                </p>
              </div>
            )}

            {!tiedFirstCompleters.length && liveCompletions.length > 0 && (
              <div className="rounded-2xl bg-white/90 px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Live completions
                </p>
                <p className="mt-1 text-sm text-emerald-900">
                  {liveCompletions
                    .map((entry) => playersById.get(entry.player_id)?.display_name ?? "Unknown player")
                    .join(", ")}
                </p>
              </div>
            )}

            {liveCompletionsError && (
              <div className="rounded-2xl bg-white/90 px-4 py-3 text-xs text-amber-800 shadow-sm">
                Unable to load live completion data yet.
              </div>
            )}

            {activityFeed.map((activity) => (
              <div
                key={activity.id}
                className="rounded-2xl bg-white/90 px-4 py-3 shadow-sm"
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

        <section className="rounded-2xl bg-white/90 p-6 shadow-sm">
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
                className="flex items-center justify-between rounded-2xl bg-white/90 px-4 py-3 shadow-sm"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {index + 1}. {entry.name}
                  </p>
                  <p className="text-xs text-slate-500">{entry.points} pts</p>
                </div>
                <span className="text-xs font-medium text-slate-500">
                  {entry.is_complete
                    ? "Complete"
                    : entry.is_one_away
                      ? "One away"
                      : `${entry.completed_cells_count} done`}
                </span>
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

      <section className="rounded-2xl bg-white/90 p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Game lifecycle
            </p>
            <h2 className="text-xl font-semibold text-slate-900">
              {isLobby ? "Lobby" : isLive ? "Live" : "Ended"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {isLobby
                ? "Start the game to unlock event recording."
                : isLive
                  ? "Scoring is enabled. End the game when play is complete."
                  : "This game has ended. Scoring is disabled."}
            </p>
          </div>

          {isLobby && <GameStatusActionButton slug={slug} intent="start">Start game</GameStatusActionButton>}
          {isLive && <EndGameControl slug={slug} />}
        </div>
      </section>

      {isLive ? (
        <HostScoringPanel
          slug={slug}
          isFinished={isGameFinished}
          teamScope={game.team_scope}
          teamNames={teamNames}
        />
      ) : isLobby ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm sm:p-6">
          <p className="font-semibold">Record event is locked</p>
          <p className="mt-1 text-xs text-amber-800">
            Click <span className="font-semibold">Start game</span> above to enable scoring controls.
          </p>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 shadow-sm sm:p-6">
          <p className="font-semibold text-slate-900">Game ended</p>
          <p className="mt-1 text-xs text-slate-600">
            Scoring is disabled because this game is complete.
          </p>
        </section>
      )}

      <section className="rounded-2xl bg-white/90 p-6 shadow-sm">
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
                  className="flex items-center justify-between rounded-2xl bg-white/90 px-4 py-2 shadow-sm"
                >
                 <div className="space-y-0.5">
  <p className="font-medium text-slate-900">{label}</p>
  {event.team_key && (
    <p className="text-xs uppercase tracking-wide text-slate-400">
      {event.team_key === "A" ? game.team_a_name : event.team_key === "B" ? game.team_b_name : `Team ${event.team_key}`}
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