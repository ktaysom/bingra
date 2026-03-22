import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { CardBuilderPanel } from "./CardBuilderPanel";
import { EndGameCelebration } from "./EndGameCelebration";
import { HostScoringPanel } from "./HostScoringPanel";
import { EndGameControl, GameStatusActionButton, InlineShareButton } from "./PlayHostControls";
import { PlayRealtimeBridgeMount } from "./PlayRealtimeBridgeMount";
import { LeaderboardCardPreview } from "./LeaderboardCardPreview";
import { mapPlayModeToGameMode } from "../../../../lib/bingra/types";
import {
  chooseRandomEvents,
  getEventById,
  type TeamKey,
  type RiskLevel,
} from "../../../../lib/bingra/event-logic";
import { parseCardCellEventKey } from "../../../../lib/bingra/card-event-key";
import {
  calculateCompletedCellFlags,
  filterRecordedEventsByAcceptedAt,
  type CompletionMode,
  type RecordedEvent,
  type CardCell as ProgressCardCell,
} from "../../../../lib/bingra/card-progress";
import { buildGameScores } from "../../../../lib/bingra/game-results";
import {
  buildActivityFeedItems,
  type ActivityFeedItem,
} from "../../../../lib/bingra/activity-feed";
import { AuthEntryPoint } from "../../../../components/auth/AuthEntryPoint";
import { EndGameSaveStatsPrompt } from "../../../../components/auth/EndGameSaveStatsPrompt";

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
  is_active: boolean;
  status_label?: string;
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
  accepted_at: string | null;
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
      .select("id, player_id, accepted_at, card_cells(order_index, event_key, event_label, team_key, point_value)")
      .eq("game_id", game.id)
      .returns<CardRow[]>();

    if (!error && data) {
      cardsForGame = data;
    }
  }

  const playerCount = players?.length ?? 0;
  const playMode = game.completion_mode === "STREAK" ? "streak" : "quick_play";
  const initialRiskLevel: RiskLevel = 3;
  const teamNames: Record<TeamKey, string> = { A: game.team_a_name, B: game.team_b_name };
  const hostName =
    players?.find((player) => player.role === "host")?.display_name?.trim() || "Host";
  const matchupHeadline =
    game.team_a_name?.trim() && game.team_b_name?.trim()
      ? `${game.team_a_name} vs ${game.team_b_name}`
      : game.title?.trim() || "Untitled game";
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
  let allScoredEvents: RecentScoredEvent[] = [];

  try {
    const { data, error } = await supabase
      .from("scored_events")
      .select("id, event_key, event_label, team_key, created_at")
      .eq("game_id", game.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    allScoredEvents = (data as RecentScoredEvent[] | null) ?? [];
  } catch (error) {
    console.error("Unable to load scored events", error);
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
    created_at: event.created_at,
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

  const scoringLeaderboardEntries: LeaderboardEntry[] = buildGameScores({
    players: (players ?? []).map((player) => ({
      id: player.id,
      display_name: player.display_name,
      created_at: player.created_at,
    })),
    cards: cardsForGame.map((card) => ({
      player_id: card.player_id,
      accepted_at: card.accepted_at,
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
    is_active: true,
  }));

  const scoringEntriesByPlayerId = new Map(scoringLeaderboardEntries.map((entry) => [entry.id, entry]));

  const inactiveLeaderboardEntries: LeaderboardEntry[] = (players ?? [])
    .filter((player) => !scoringEntriesByPlayerId.has(player.id))
    .map((player, joinOrder) => ({
      id: player.id,
      name: player.display_name,
      raw_points: 0,
      final_score: 0,
      has_bingra: false,
      is_one_away: false,
      completed_cells_count: 0,
      join_order: joinOrder,
      is_active: false,
      status_label: "No card accepted",
    }));

  const leaderboardEntries: LeaderboardEntry[] = [
    ...scoringLeaderboardEntries,
    ...inactiveLeaderboardEntries,
  ];

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

  const currentPlayerAcceptedAt = currentPlayerCard?.accepted_at ?? null;
  const currentPlayerEligibleRecordedEvents = filterRecordedEventsByAcceptedAt(
    recordedEvents,
    currentPlayerAcceptedAt,
  );

  const currentPlayerCompletedFlags = calculateCompletedCellFlags(
    currentPlayerEligibleRecordedEvents,
    currentPlayerProgressCells,
    completionMode,
  );

  const catalogEvents = (currentPlayerCard?.card_cells ?? []).map((cell, index) => {
    const eventKey = typeof cell.event_key === "string" ? cell.event_key : `cell-${index}`;
    const parsedEventKey = parseCardCellEventKey(eventKey);
    const catalogEvent = parsedEventKey.baseEventKey
      ? getEventById(parsedEventKey.baseEventKey)
      : undefined;
    const fallbackBasePoints =
      typeof cell.point_value === "number" ? cell.point_value : 0;
    const fallbackLabel = cell.event_label ?? parsedEventKey.baseEventKey ?? eventKey;
    const persistedTeamKey: TeamKey | null =
      cell.team_key === "A" || cell.team_key === "B"
        ? cell.team_key
        : parsedEventKey.qualifiedTeamKey;
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

  const winnerName = game.winner_player_id
    ? playersById.get(game.winner_player_id)?.display_name ?? null
    : scoringLeaderboardEntries[0]?.name ?? null;

  const winnerEntry = game.winner_player_id
    ? scoringLeaderboardEntries.find((entry) => entry.id === game.winner_player_id) ?? scoringLeaderboardEntries[0] ?? null
    : scoringLeaderboardEntries[0] ?? null;

  const scoreboardTargetId = `play-scoreboard-${game.id}`;

  const leaderboardEntryByPlayerId = new Map(leaderboardEntries.map((entry) => [entry.id, entry]));

  const playerCardPreviews = (players ?? []).map((player) => {
    const playerCard = cardsByPlayerId.get(player.id) ?? null;
    const sortedCells = [...(playerCard?.card_cells ?? [])].sort(
      (left, right) => left.order_index - right.order_index,
    );

    const progressCells: ProgressCardCell[] = sortedCells.map((cell) => ({
      event_key: cell.event_key,
      team_key: cell.team_key,
      order_index: cell.order_index,
      point_value: cell.point_value,
    }));

    const eligibleRecordedEvents = filterRecordedEventsByAcceptedAt(
      recordedEvents,
      playerCard?.accepted_at ?? null,
    );

    const completedFlags = calculateCompletedCellFlags(
      eligibleRecordedEvents,
      progressCells,
      completionMode,
    );

    const leaderboardEntry = leaderboardEntryByPlayerId.get(player.id);

    return {
      player_id: player.id,
      player_name: player.display_name,
      card_accepted_at: playerCard?.accepted_at ?? null,
      completed_cells_count: leaderboardEntry?.completed_cells_count ?? 0,
      total_cells_count: sortedCells.length,
      is_one_away: leaderboardEntry?.is_one_away ?? false,
      has_bingra: leaderboardEntry?.has_bingra ?? false,
      card_cells: sortedCells.map((cell, index) => {
        const parsedEventKey = parseCardCellEventKey(cell.event_key);
        const resolvedTeamKey: TeamKey | null =
          cell.team_key === "A" || cell.team_key === "B"
            ? cell.team_key
            : parsedEventKey.qualifiedTeamKey;

        return {
          order_index: cell.order_index,
          event_label: cell.event_label ?? parsedEventKey.baseEventKey ?? `Event ${index + 1}`,
          team_key: resolvedTeamKey,
          point_value: typeof cell.point_value === "number" ? cell.point_value : 0,
          is_completed: completedFlags[index] ?? false,
        };
      }),
    };
  });

  const playerCardsForScoring = new Map(
    cardsForGame.map((card) => [
      card.player_id,
      {
        accepted_at: card.accepted_at,
        card_cells: (card.card_cells ?? []).map((cell) => ({
          event_key: cell.event_key,
          team_key: cell.team_key,
          order_index: cell.order_index,
          point_value: cell.point_value,
        })),
      },
    ]),
  );

  const unacceptedPlayerIds = new Set(
    cardsForGame
      .filter((card) => !card.accepted_at)
      .map((card) => card.player_id),
  );

  for (const player of players ?? []) {
    if (!cardsByPlayerId.has(player.id)) {
      unacceptedPlayerIds.add(player.id);
    }
  }

  const shouldShowAcceptReminder =
    isLive &&
    currentPlayerId != null &&
    unacceptedPlayerIds.has(currentPlayerId);

  const activityFeedItems: ActivityFeedItem[] = buildActivityFeedItems({
    players: (players ?? []).map((player) => ({
      id: player.id,
      display_name: player.display_name,
      created_at: player.created_at,
      accepted_at: cardsByPlayerId.get(player.id)?.accepted_at ?? null,
    })),
    events: allScoredEvents,
    playerCardsByPlayerId: playerCardsForScoring,
    completionMode,
    teamNames,
    gameId: game.id,
    gameStatus: game.status,
    completedAt: game.completed_at,
    winnerName,
    leaderboardEntries: leaderboardEntries.map((entry) => ({
      name: entry.name,
      final_score: entry.final_score,
      raw_points: entry.raw_points,
      has_bingra: entry.has_bingra,
    })),
  });

  const formatActivityTimestamp = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));

  const getFeedItemContainerClass = (activity: ActivityFeedItem) => {
    const base = "rounded-2xl border shadow-sm";

    if (activity.emphasis === "major") {
      if (activity.tone === "positive") {
        return `${base} border-emerald-300 bg-emerald-50/80 px-5 py-4`;
      }

      return `${base} border-violet-300 bg-violet-50/80 px-5 py-4`;
    }

    if (activity.emphasis === "highlight") {
      if (activity.tone === "positive") {
        return `${base} border-blue-300 bg-blue-50/70 px-4.5 py-3.5`;
      }

      return `${base} border-slate-300 bg-slate-50/80 px-4.5 py-3.5`;
    }

    if (activity.type === "event_recorded") {
      if (activity.rarity === 5) {
        return `${base} border-fuchsia-300 bg-fuchsia-50/60 px-4 py-3`;
      }

      if (activity.rarity === 4) {
        return `${base} border-violet-300 bg-violet-50/60 px-4 py-3`;
      }

      if (activity.rarity === 3) {
        return `${base} border-blue-200 bg-blue-50/40 px-4 py-3`;
      }
    }

    return `${base} border-slate-200 bg-white/90 px-4 py-3`;
  };

  const getFeedHeadlineClass = (activity: ActivityFeedItem) => {
    if (activity.emphasis === "major") {
      return "font-semibold text-slate-950";
    }

    if (activity.emphasis === "highlight") {
      return "font-semibold text-slate-900";
    }

    return "font-semibold text-slate-900";
  };

  const getRarityBadgeClass = (rarity: 1 | 2 | 3 | 4 | 5) => {
    if (rarity === 5) {
      return "rounded-full border border-fuchsia-300 bg-fuchsia-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-700";
    }

    if (rarity === 4) {
      return "rounded-full border border-violet-300 bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700";
    }

    return "rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700";
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <PlayRealtimeBridgeMount gameId={game.id} />
      <EndGameSaveStatsPrompt
        gameId={game.id}
        slug={slug}
        playerId={currentPlayerId}
        isFinished={isGameFinished}
      />
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
        topEntries={scoringLeaderboardEntries.slice(0, 3).map((entry) => ({
          id: entry.id,
          name: entry.name,
          finalScore: entry.final_score,
          rawPoints: entry.raw_points,
          hasBingra: entry.has_bingra,
        }))}
        scoreboardTargetId={scoreboardTargetId}
      />

      <header className="rounded-2xl bg-white/90 p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{matchupHeadline}</h1>
            <p className="mt-1 text-sm text-slate-500">Hosted by {hostName}</p>
          </div>
          <div className="flex items-center gap-2 sm:pt-1">
            <AuthEntryPoint
              nextPath={`/g/${slug}/play`}
              linkPlayerId={currentPlayerId}
              subtle
            />
            <InlineShareButton slug={slug} title={game.title ?? matchupHeadline} />
          </div>
        </div>
      </header>

      <CardBuilderPanel
        mode={playMode}
        playerId={currentPlayerId}
        gameStatus={game.status}
        cardAcceptedAt={currentPlayerAcceptedAt}
        eventsPerCard={game.events_per_card}
        teamScope={game.team_scope}
        endCondition={game.end_condition}
        teamNames={teamNames}
        initialRiskLevel={initialRiskLevel}
        initialCardEvents={initialCardEvents}
        lockedCardEvents={lockedCardEvents}
      />

      {shouldShowAcceptReminder && (
        <section
          role="alert"
          className="rounded-2xl border-2 border-amber-300 bg-amber-100 p-5 text-amber-950 shadow-sm"
        >
          <p className="text-sm font-semibold uppercase tracking-wide">Action required</p>
          <h2 className="mt-1 text-xl font-bold">Accept your card to start scoring</h2>
          <p className="mt-2 text-sm">
            Events are live, but your score and progress remain at zero until you accept your card.
          </p>
        </section>
      )}

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
                className={getFeedItemContainerClass(activity)}
              >
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0 space-y-1">
                    {activity.type === "player_joined" && (
                      <>
                        <p className={getFeedHeadlineClass(activity)}>
                          {activity.headline ?? `${activity.playerName} joined`}
                        </p>
                      </>
                    )}

                    {activity.type === "event_recorded" && (
                      <>
                        <p className={getFeedHeadlineClass(activity)}>
                          {activity.headline ?? `${activity.eventName} recorded · ${activity.points} pts`}
                        </p>
                        {(activity.scoreText || activity.detail) && (
                          <p className="text-xs text-slate-500">
                            {activity.scoreText ??
                              (activity.playerNames.length > 0
                                ? `Points awarded to ${activity.playerNames.join(", ")}`
                                : "No points awarded")}
                            {activity.scoreText && activity.detail ? ` · ${activity.detail}` : !activity.scoreText ? activity.detail : ""}
                          </p>
                        )}
                      </>
                    )}

                    {activity.type === "progress_milestone" && (
                      <>
                        <p className={getFeedHeadlineClass(activity)}>
                          {activity.headline ?? `🎯 ${activity.playerName} is 1 away from Bingra`}
                        </p>
                        {activity.detail && (
                          <p className="text-xs text-slate-500">{activity.detail}</p>
                        )}
                      </>
                    )}

                    {activity.type === "bingra_completed" && (
                      <>
                        <p className={getFeedHeadlineClass(activity)}>
                          {activity.headline ?? `💥 ${activity.playerName} completed Bingra`}
                        </p>
                        {activity.detail && (
                          <p className="text-xs text-slate-500">{activity.detail}</p>
                        )}
                      </>
                    )}

                    {activity.type === "momentum" && (
                      <>
                        <p className={getFeedHeadlineClass(activity)}>
                          {activity.headline ??
                            (activity.streakCount === 3
                              ? `⚡ ${activity.playerName} is rolling`
                              : `🔥 ${activity.playerName} is on a streak`)}
                        </p>
                        {activity.detail && (
                          <p className="text-xs text-slate-500">{activity.detail}</p>
                        )}
                      </>
                    )}

                    {activity.type === "winner_declared" && (
                      <>
                        <p className={getFeedHeadlineClass(activity)}>
                          {activity.headline ?? `${activity.playerName} declared winner`}
                        </p>
                      </>
                    )}

                    {activity.type === "game_ended" && (
                      <>
                        <p className={getFeedHeadlineClass(activity)}>
                          {activity.headline ?? "Game ended"}
                        </p>
                      </>
                    )}

                    {activity.type === "final_scores" && (
                      <>
                        <p className={getFeedHeadlineClass(activity)}>
                          {activity.headline ?? "Final scores posted"}
                        </p>
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

                  <div className="shrink-0 text-right">
                    {activity.type === "event_recorded" && activity.rarity && activity.rarity >= 3 && (
                      <span className={getRarityBadgeClass(activity.rarity)}>
                        Rare {activity.rarity}
                      </span>
                    )}
                    <p className="mt-1 text-xs text-slate-500">{formatActivityTimestamp(activity.createdAt)}</p>
                  </div>
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

      <LeaderboardCardPreview
        leaderboardEntries={leaderboardEntries}
        playerCards={playerCardPreviews}
        teamNames={teamNames}
        mode={playMode === "streak" ? "streak" : "blackout"}
        isLive={isLive}
        playerCount={playerCount}
        scoreboardTargetId={scoreboardTargetId}
        playersError={playersError}
      />

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
    </main>
  );
}