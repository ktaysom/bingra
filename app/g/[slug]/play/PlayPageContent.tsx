import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { CardBuilderPanel } from "./CardBuilderPanel";
import { EndGameCelebration } from "./EndGameCelebration";
import { HostScoringPanel } from "./HostScoringPanel";
import { EndGameControl, GameStatusActionButton, ShareGameControl } from "./PlayHostControls";
import { PlayRealtimeBridgeMount } from "./PlayRealtimeBridgeMount";
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
import { buildGameScores } from "../../../../lib/bingra/game-results";

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
  raw_points: number;
  final_score: number;
  has_bingra: boolean;
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

type ActivityFeedItem =
  | {
      id: string;
      type: "player_joined";
      createdAt: string;
      playerName: string;
    }
  | {
      id: string;
      type: "event_recorded";
      createdAt: string;
      eventName: string;
      points: number;
      playerNames: string[];
    }
  | {
      id: string;
      type: "winner_declared";
      createdAt: string;
      playerName: string;
    }
  | {
      id: string;
      type: "game_ended";
      createdAt: string;
    }
  | {
      id: string;
      type: "final_scores";
      createdAt: string;
      standings: Array<{
        playerName: string;
        finalScore: number;
        rawPoints: number;
        bingra: boolean;
      }>;
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

type PlayPageContentProps = {
  game: GameRecord;
  currentPlayerId: string;
  slug: string;
};

export async function PlayPageContent({ game, currentPlayerId, slug }: PlayPageContentProps) {
  const supabase = createSupabaseAdminClient();

  let players: PlayerRecord[] | null = null;
  let playersError: string | null = null;

  {
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

  {
    const { data, error } = await supabase
      .from("cards")
      .select("id, player_id, card_cells(order_index, event_key, event_label, team_key, point_value)")
      .eq("game_id", game.id)
      .returns<CardRow[]>();

    if (!error && data) {
      cardsForGame = data;
    }
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
  const bingraCompletedAtByPlayerId = new Map<string, string>();
  for (const completion of liveCompletions) {
    const existing = bingraCompletedAtByPlayerId.get(completion.player_id);
    if (!existing || completion.created_at < existing) {
      bingraCompletedAtByPlayerId.set(completion.player_id, completion.created_at);
    }
  }
  const bingraPlayerIds = new Set(liveCompletions.map((completion) => completion.player_id));
  const cardsByPlayerId = new Map(cardsForGame.map((card) => [card.player_id, card]));
  const playersById = new Map((players ?? []).map((player) => [player.id, player]));

  const leaderboardEntries: LeaderboardEntry[] = buildGameScores({
    players: (players ?? []).map((player) => ({
      id: player.id,
      display_name: player.display_name,
      created_at: player.created_at,
    })),
    cards: cardsForGame.map((card) => ({
      player_id: card.player_id,
      card_cells: (card.card_cells ?? []).map((cell) => ({
        event_key: cell.event_key,
        team_key: cell.team_key,
        order_index: cell.order_index,
        point_value: cell.point_value,
      })),
    })),
    recordedEvents,
    completionMode,
    bingraPlayerIds,
    bingraCompletedAtByPlayerId,
  }).map((entry) => ({
    id: entry.player_id,
    name: entry.player_name,
    raw_points: entry.raw_points,
    final_score: entry.final_score,
    has_bingra: entry.has_bingra,
    is_one_away: entry.is_one_away,
    completed_cells_count: entry.completed_cells_count,
    join_order: entry.join_order,
  }));

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

  const winnerName = game.winner_player_id
    ? playersById.get(game.winner_player_id)?.display_name ?? null
    : leaderboardEntries[0]?.name ?? null;

  const winnerEntry = game.winner_player_id
    ? leaderboardEntries.find((entry) => entry.id === game.winner_player_id) ?? leaderboardEntries[0] ?? null
    : leaderboardEntries[0] ?? null;

  const scoreboardTargetId = `play-scoreboard-${game.id}`;

  const playerCardsForScoring = new Map(
    cardsForGame.map((card) => [
      card.player_id,
      (card.card_cells ?? []).map((cell) => ({
        event_key: cell.event_key,
        team_key: cell.team_key,
        order_index: cell.order_index,
        point_value: cell.point_value,
      })),
    ]),
  );

  const eventFeedItems: ActivityFeedItem[] = [];
  const recordedEventsProgress: RecordedEvent[] = [];

  for (const event of allScoredEvents) {
    if (!event.created_at) {
      continue;
    }

    const nextRecordedEvents = [
      ...recordedEventsProgress,
      {
        event_key: event.event_key,
        team_key: event.team_key,
      },
    ];

    const playerNames: string[] = [];
    let pointsAwarded = 0;

    for (const player of players ?? []) {
      const cardCells = playerCardsForScoring.get(player.id) ?? [];
      const before = calculateCardProgress(recordedEventsProgress, cardCells, completionMode);
      const after = calculateCardProgress(nextRecordedEvents, cardCells, completionMode);
      const delta = after.score - before.score;

      if (delta > 0) {
        playerNames.push(player.display_name);
        pointsAwarded += delta;
      }
    }

    const eventBaseLabel = event.event_key ? getEventById(event.event_key)?.label : null;
    const teamLabel =
      event.team_key === "A"
        ? game.team_a_name
        : event.team_key === "B"
          ? game.team_b_name
          : null;
    const resolvedEventName = [teamLabel, eventBaseLabel ?? event.event_label ?? event.event_key ?? "Event"]
      .filter(Boolean)
      .join(": ");

    eventFeedItems.push({
      id: `event-${event.id}`,
      type: "event_recorded",
      createdAt: event.created_at,
      eventName: resolvedEventName,
      points: pointsAwarded,
      playerNames,
    });

    recordedEventsProgress.push({
      event_key: event.event_key,
      team_key: event.team_key,
    });
  }

  const playerJoinedFeedItems: ActivityFeedItem[] = (players ?? [])
    .filter((player) => Boolean(player.created_at))
    .map((player) => ({
      id: `player-${player.id}`,
      type: "player_joined",
      createdAt: player.created_at as string,
      playerName: player.display_name,
    }));

  const gameLifecycleFeedItems: ActivityFeedItem[] = [];

  if (game.status === "finished" && game.completed_at) {
    if (winnerName) {
      gameLifecycleFeedItems.push({
        id: `winner-${game.id}`,
        type: "winner_declared",
        createdAt: game.completed_at,
        playerName: winnerName,
      });
    }

    gameLifecycleFeedItems.push({
      id: `ended-${game.id}`,
      type: "game_ended",
      createdAt: game.completed_at,
    });

    gameLifecycleFeedItems.push({
      id: `final-scores-${game.id}`,
      type: "final_scores",
      createdAt: game.completed_at,
      standings: leaderboardEntries.map((entry) => ({
        playerName: entry.name,
        finalScore: entry.final_score,
        rawPoints: entry.raw_points,
        bingra: entry.has_bingra,
      })),
    });
  }

  const activityFeedItems: ActivityFeedItem[] = [
    ...playerJoinedFeedItems,
    ...eventFeedItems,
    ...gameLifecycleFeedItems,
  ].sort((a, b) => {
    if (a.createdAt === b.createdAt) {
      return b.id.localeCompare(a.id);
    }

    return b.createdAt.localeCompare(a.createdAt);
  });

  const formatActivityTimestamp = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <PlayRealtimeBridgeMount gameId={game.id} />
      <EndGameCelebration
        gameId={game.id}
        isFinished={isGameFinished}
        winner={
          winnerEntry
            ? {
                name: winnerEntry.name,
                finalScore: winnerEntry.final_score,
                rawPoints: winnerEntry.raw_points,
                hasBingra: winnerEntry.has_bingra,
              }
            : null
        }
        topEntries={leaderboardEntries.slice(0, 3).map((entry) => ({
          id: entry.id,
          name: entry.name,
          finalScore: entry.final_score,
          rawPoints: entry.raw_points,
          hasBingra: entry.has_bingra,
        }))}
        scoreboardTargetId={scoreboardTargetId}
      />

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
            {activityFeedItems.map((activity) => (
              <div
                key={activity.id}
                className="rounded-2xl bg-white/90 px-4 py-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0 space-y-1">
                    {activity.type === "player_joined" && (
                      <>
                        <p className="font-semibold text-slate-900">{activity.playerName} joined</p>
                      </>
                    )}

                    {activity.type === "event_recorded" && (
                      <>
                        <p className="font-semibold text-slate-900">
                          {activity.eventName} recorded · {activity.points} pts
                        </p>
                        <p className="text-xs text-slate-500">
                          {activity.playerNames.length > 0
                            ? `Points awarded to ${activity.playerNames.join(", ")}`
                            : "No points awarded"}
                        </p>
                      </>
                    )}

                    {activity.type === "winner_declared" && (
                      <>
                        <p className="font-semibold text-slate-900">{activity.playerName} declared winner</p>
                      </>
                    )}

                    {activity.type === "game_ended" && (
                      <>
                        <p className="font-semibold text-slate-900">Game ended</p>
                      </>
                    )}

                    {activity.type === "final_scores" && (
                      <>
                        <p className="font-semibold text-slate-900">Final scores posted</p>
                        <ol className="mt-1 space-y-0.5 text-xs text-slate-500">
                          {activity.standings.map((standing, index) => (
                            <li key={`${activity.id}-${standing.playerName}`}>
                              {index + 1}. {standing.playerName} · {standing.finalScore} final ({standing.rawPoints} raw{standing.bingra ? " · Bingra x2" : ""})
                            </li>
                          ))}
                        </ol>
                      </>
                    )}
                  </div>

                  <span className="shrink-0 text-xs text-slate-500">
                    {formatActivityTimestamp(activity.createdAt)}
                  </span>
                </div>
              </div>
            ))}

            {activityFeedItems.length === 0 && (
              <div className="rounded-2xl bg-white/90 px-4 py-3 text-sm text-slate-500 shadow-sm">
                No activity yet.
              </div>
            )}

            {liveCompletionsError && (
              <div className="rounded-2xl bg-white/90 px-4 py-3 text-xs text-amber-800 shadow-sm">
                Unable to load live completion data yet.
              </div>
            )}
          </div>
        </section>

        <section
          id={scoreboardTargetId}
          tabIndex={-1}
          className="rounded-2xl bg-white/90 p-6 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Leaderboard
              </p>
              <h2 className="text-xl font-semibold text-slate-900">Players</h2>
            </div>
            <span className="text-sm text-slate-500">{playerCount} joined</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {isLive
              ? "Points update live. Bingra badge means this player gets a 2x multiplier when the game ends."
              : "Final score = raw points ×2 with Bingra, otherwise raw points."}
          </p>
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
                  <p className="text-xs text-slate-500">
                    {isLive
                      ? `${entry.raw_points} Points`
                      : `Final ${entry.final_score} • Raw ${entry.raw_points}${entry.has_bingra ? " • Bingra x2" : ""}`}
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-500">
                  {entry.has_bingra
                    ? "Bingra (2x)"
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
                  ? game.end_condition === "FIRST_COMPLETION"
                    ? "Scoring is enabled. Game ends automatically on first Bingra, or the host can end it manually; winner is highest final score at game end."
                    : "Scoring is enabled. Bingra doubles points; host ends the game to lock final scores."
                  : winnerName
                    ? `This game has ended. Winner: ${winnerName}.`
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