import { calculateCardProgress, type CardCell as ProgressCardCell, type CompletionMode, type RecordedEvent } from "./card-progress";
import { getEventById, type TeamKey } from "./event-logic";
import { resolveBaseEventKey } from "./card-event-key";

export type ActivityFeedItemType =
  | "player_joined"
  | "event_recorded"
  | "winner_declared"
  | "game_ended"
  | "final_scores"
  | "progress_milestone"
  | "bingra_completed"
  | "momentum";

export type ActivityFeedTone = "positive" | "negative" | "neutral";
export type ActivityFeedEmphasis = "normal" | "highlight" | "major";

type ActivityFeedPresentation = {
  headline?: string;
  detail?: string;
  scoreText?: string;
  tone?: ActivityFeedTone;
  rarity?: 1 | 2 | 3 | 4 | 5;
  emphasis?: ActivityFeedEmphasis;
};

export type ActivityFeedItem =
  | {
      id: string;
      type: "player_joined";
      createdAt: string;
      playerName: string;
    } & ActivityFeedPresentation
  | {
      id: string;
      type: "event_recorded";
      createdAt: string;
      eventName: string;
      points: number;
      playerNames: string[];
    } & ActivityFeedPresentation
  | {
      id: string;
      type: "winner_declared";
      createdAt: string;
      playerName: string;
    } & ActivityFeedPresentation
  | {
      id: string;
      type: "game_ended";
      createdAt: string;
    } & ActivityFeedPresentation
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
    } & ActivityFeedPresentation
  | {
      id: string;
      type: "progress_milestone";
      createdAt: string;
      playerName: string;
      milestone: "one_away";
    } & ActivityFeedPresentation
  | {
      id: string;
      type: "bingra_completed";
      createdAt: string;
      playerName: string;
    } & ActivityFeedPresentation
  | {
      id: string;
      type: "momentum";
      createdAt: string;
      playerName: string;
      streakCount: 2 | 3;
    } & ActivityFeedPresentation;

export type ActivityFeedPlayer = {
  id: string;
  display_name: string;
  created_at: string | null;
};

export type ActivityFeedScoredEvent = {
  id: string;
  event_key: string | null;
  event_label: string | null;
  team_key: string | null;
  created_at: string | null;
};

export type ActivityFeedLeaderboardEntry = {
  name: string;
  final_score: number;
  raw_points: number;
  has_bingra: boolean;
};

type ActivityFeedPlayerProgress = {
  isComplete: boolean;
  isOneAway: boolean;
};

const POSITIVE_FLAVOR_POOL = ["Huge play.", "Things are heating up.", "Crowd is buzzing."] as const;
const NEGATIVE_FLAVOR_POOL = ["That hurts.", "Tough break.", "Momentum shifts."] as const;
const NEUTRAL_FLAVOR_POOL = ["Play continues.", "Still anyone's game.", "Steady pace."] as const;

function hashString(input: string): number {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function pickStableVariant<T>(seed: string, variants: readonly T[]): T {
  if (variants.length === 0) {
    throw new Error("pickStableVariant requires at least one variant");
  }

  const index = hashString(seed) % variants.length;
  return variants[index];
}

function formatPointsLabel(points: number): string {
  return `+${points} pts`;
}

function joinNamesForScoreText(names: string[]): string {
  if (names.length <= 1) {
    return names[0] ?? "No one";
  }

  if (names.length === 2) {
    return `${names[0]} & ${names[1]}`;
  }

  return `${names[0]} +${names.length - 1}`;
}

function buildScoreText(input: {
  pointsAwarded: number;
  playerNames: string[];
  primaryPlayerName: string | null;
  scoresBeforeByPlayerName: Map<string, number>;
  scoresAfterByPlayerName: Map<string, number>;
}): string {
  const {
    pointsAwarded,
    playerNames,
    primaryPlayerName,
    scoresBeforeByPlayerName,
    scoresAfterByPlayerName,
  } = input;

  if (playerNames.length === 0) {
    return "No points awarded";
  }

  const recipientLabel = joinNamesForScoreText(playerNames);
  const base = `${formatPointsLabel(pointsAwarded)} to ${recipientLabel}`;

  if (!primaryPlayerName) {
    return base;
  }

  const sortedAfter = [...scoresAfterByPlayerName.entries()].sort((a, b) => {
    if (a[1] !== b[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  const sortedBefore = [...scoresBeforeByPlayerName.entries()].sort((a, b) => {
    if (a[1] !== b[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  const primaryAfter = scoresAfterByPlayerName.get(primaryPlayerName) ?? 0;
  const primaryBefore = scoresBeforeByPlayerName.get(primaryPlayerName) ?? 0;

  const maxAfter = sortedAfter[0]?.[1] ?? primaryAfter;
  const maxBefore = sortedBefore[0]?.[1] ?? primaryBefore;

  const leadersAfter = sortedAfter.filter((entry) => entry[1] === maxAfter);

  if (leadersAfter.length > 1) {
    return `${base} · Game tied`;
  }

  const afterRunnerUp = sortedAfter.find((entry) => entry[0] !== primaryPlayerName)?.[1] ?? primaryAfter;
  const beforeRunnerUp = sortedBefore.find((entry) => entry[0] !== primaryPlayerName)?.[1] ?? primaryBefore;

  const primaryIsLeadingAfter = primaryAfter > afterRunnerUp;
  const primaryIsLeadingBefore = primaryBefore > beforeRunnerUp;

  if (primaryIsLeadingAfter && !primaryIsLeadingBefore && primaryAfter > maxBefore) {
    return `${base} · ${primaryPlayerName} takes the lead`;
  }

  if (primaryIsLeadingAfter && primaryIsLeadingBefore) {
    const leadAfter = primaryAfter - afterRunnerUp;
    const leadBefore = primaryBefore - beforeRunnerUp;

    if (leadAfter > leadBefore) {
      return `${base} · Lead grows to ${leadAfter}`;
    }
  }

  if (!primaryIsLeadingAfter && !primaryIsLeadingBefore) {
    const deficitAfter = maxAfter - primaryAfter;
    const deficitBefore = maxBefore - primaryBefore;

    if (deficitAfter < deficitBefore) {
      return `${base} · Lead cut to ${deficitAfter}`;
    }
  }

  return `${base} · ${primaryPlayerName} now at ${primaryAfter}`;
}

function resolveEventTone(input: {
  pointsAwarded: number;
  eventKey: string | null;
}): ActivityFeedTone {
  const { pointsAwarded, eventKey } = input;

  if (pointsAwarded > 0) {
    return "positive";
  }

  const baseEventKey = resolveBaseEventKey(eventKey);
  const category = baseEventKey ? getEventById(baseEventKey)?.category : undefined;

  if (category === "turnover" || category === "violation") {
    return "negative";
  }

  return "neutral";
}

function getFlavorDetail(seed: string, tone: ActivityFeedTone): string {
  if (tone === "positive") {
    return pickStableVariant(seed, POSITIVE_FLAVOR_POOL);
  }

  if (tone === "negative") {
    return pickStableVariant(seed, NEGATIVE_FLAVOR_POOL);
  }

  return pickStableVariant(seed, NEUTRAL_FLAVOR_POOL);
}

export function formatRecordedEventFeedItem(input: {
  event: ActivityFeedScoredEvent;
  pointsAwarded: number;
  playerNames: string[];
  primaryPlayerName: string | null;
  resolvedEventName: string;
  scoresBeforeByPlayerName: Map<string, number>;
  scoresAfterByPlayerName: Map<string, number>;
}): Extract<ActivityFeedItem, { type: "event_recorded" }> {
  const {
    event,
    pointsAwarded,
    playerNames,
    primaryPlayerName,
    resolvedEventName,
    scoresBeforeByPlayerName,
    scoresAfterByPlayerName,
  } = input;

  const tone = resolveEventTone({
    pointsAwarded,
    eventKey: event.event_key,
  });

  const baseEventKey = resolveBaseEventKey(event.event_key);
  const rarity = baseEventKey ? getEventById(baseEventKey)?.rarity : undefined;
  const scoreText = buildScoreText({
    pointsAwarded,
    playerNames,
    primaryPlayerName,
    scoresBeforeByPlayerName,
    scoresAfterByPlayerName,
  });

  return {
    id: `event-${event.id}`,
    type: "event_recorded",
    createdAt: event.created_at as string,
    eventName: resolvedEventName,
    points: pointsAwarded,
    playerNames,
    headline: `${resolvedEventName} recorded`,
    scoreText,
    detail: getFlavorDetail(`event-${event.id}`, tone),
    tone,
    rarity,
    emphasis: rarity === 5 ? "highlight" : "normal",
  };
}

export function buildProgressMilestoneItems(input: {
  eventId: string;
  createdAt: string;
  playerNamesById: Map<string, string>;
  progressBeforeByPlayerId: Map<string, ActivityFeedPlayerProgress>;
  progressAfterByPlayerId: Map<string, ActivityFeedPlayerProgress>;
  announcedOneAwayPlayerIds: Set<string>;
}): Array<Extract<ActivityFeedItem, { type: "progress_milestone" }>> {
  const {
    eventId,
    createdAt,
    playerNamesById,
    progressBeforeByPlayerId,
    progressAfterByPlayerId,
    announcedOneAwayPlayerIds,
  } = input;

  const items: Array<Extract<ActivityFeedItem, { type: "progress_milestone" }>> = [];

  for (const [playerId, after] of progressAfterByPlayerId.entries()) {
    const before = progressBeforeByPlayerId.get(playerId) ?? { isComplete: false, isOneAway: false };

    if (!after.isOneAway) {
      announcedOneAwayPlayerIds.delete(playerId);
      continue;
    }

    if (before.isOneAway || announcedOneAwayPlayerIds.has(playerId)) {
      continue;
    }

    const playerName = playerNamesById.get(playerId);
    if (!playerName) {
      continue;
    }

    announcedOneAwayPlayerIds.add(playerId);
    items.push({
      id: `milestone-one-away-${eventId}-${playerId}`,
      type: "progress_milestone",
      createdAt,
      playerName,
      milestone: "one_away",
      headline: `🎯 ${playerName} is 1 away from Bingra`,
      detail: "One more event completes the card.",
      tone: "neutral",
      rarity: 3,
      emphasis: "highlight",
    });
  }

  return items;
}

export function buildBingraCompletedItems(input: {
  eventId: string;
  createdAt: string;
  playerNamesById: Map<string, string>;
  progressBeforeByPlayerId: Map<string, ActivityFeedPlayerProgress>;
  progressAfterByPlayerId: Map<string, ActivityFeedPlayerProgress>;
  announcedBingraPlayerIds: Set<string>;
}): Array<Extract<ActivityFeedItem, { type: "bingra_completed" }>> {
  const {
    eventId,
    createdAt,
    playerNamesById,
    progressBeforeByPlayerId,
    progressAfterByPlayerId,
    announcedBingraPlayerIds,
  } = input;

  const items: Array<Extract<ActivityFeedItem, { type: "bingra_completed" }>> = [];

  for (const [playerId, after] of progressAfterByPlayerId.entries()) {
    const before = progressBeforeByPlayerId.get(playerId) ?? { isComplete: false, isOneAway: false };

    if (!after.isComplete || before.isComplete || announcedBingraPlayerIds.has(playerId)) {
      continue;
    }

    const playerName = playerNamesById.get(playerId);
    if (!playerName) {
      continue;
    }

    announcedBingraPlayerIds.add(playerId);
    items.push({
      id: `bingra-completed-${eventId}-${playerId}`,
      type: "bingra_completed",
      createdAt,
      playerName,
      headline: `💥 ${playerName} completed Bingra`,
      detail: "Final score multiplier is live.",
      tone: "positive",
      rarity: 5,
      emphasis: "major",
    });
  }

  return items;
}

export function buildMomentumItems(input: {
  eventId: string;
  createdAt: string;
  playerName: string;
  streakCount: number;
}): Array<Extract<ActivityFeedItem, { type: "momentum" }>> {
  const { eventId, createdAt, playerName, streakCount } = input;

  if (streakCount === 2) {
    return [{
      id: `momentum-2-${eventId}-${playerName}`,
      type: "momentum",
      createdAt,
      playerName,
      streakCount: 2,
      headline: `🔥 ${playerName} is on a streak`,
      detail: "2 straight scoring events.",
      tone: "positive",
      rarity: 3,
      emphasis: "normal",
    }];
  }

  if (streakCount === 3) {
    return [{
      id: `momentum-3-${eventId}-${playerName}`,
      type: "momentum",
      createdAt,
      playerName,
      streakCount: 3,
      headline: `⚡ ${playerName} is rolling`,
      detail: "3 straight scoring events.",
      tone: "positive",
      rarity: 4,
      emphasis: "highlight",
    }];
  }

  return [];
}

export function buildPlayerJoinedItems(players: ActivityFeedPlayer[]): ActivityFeedItem[] {
  return players
    .filter((player) => Boolean(player.created_at))
    .map((player) => ({
      id: `player-${player.id}`,
      type: "player_joined",
      createdAt: player.created_at as string,
      playerName: player.display_name,
      headline: `${player.display_name} joined`,
      tone: "neutral",
      emphasis: "normal",
    }));
}

export function buildEventRecordedItems(input: {
  events: ActivityFeedScoredEvent[];
  players: ActivityFeedPlayer[];
  playerCardsByPlayerId: Map<string, ProgressCardCell[]>;
  completionMode: CompletionMode;
  teamNames: Record<TeamKey, string>;
}): ActivityFeedItem[] {
  const { events, players, playerCardsByPlayerId, completionMode, teamNames } = input;
  const eventFeedItems: ActivityFeedItem[] = [];
  const recordedEventsProgress: RecordedEvent[] = [];
  const playerNamesById = new Map(players.map((player) => [player.id, player.display_name]));
  const announcedOneAwayPlayerIds = new Set<string>();
  const announcedBingraPlayerIds = new Set<string>();

  let streakPlayerId: string | null = null;
  let streakCount = 0;

  for (const event of events) {
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
    const playerIdsAwarded: string[] = [];
    const playerDeltas = new Map<string, number>();
    const scoresBeforeByPlayerName = new Map<string, number>();
    const scoresAfterByPlayerName = new Map<string, number>();
    const progressBeforeByPlayerId = new Map<string, ActivityFeedPlayerProgress>();
    const progressAfterByPlayerId = new Map<string, ActivityFeedPlayerProgress>();
    let pointsAwarded = 0;

    for (const player of players) {
      const cardCells = playerCardsByPlayerId.get(player.id) ?? [];
      const before = calculateCardProgress(recordedEventsProgress, cardCells, completionMode);
      const after = calculateCardProgress(nextRecordedEvents, cardCells, completionMode);
      const delta = after.score - before.score;

      scoresBeforeByPlayerName.set(player.display_name, before.score);
      scoresAfterByPlayerName.set(player.display_name, after.score);
      progressBeforeByPlayerId.set(player.id, {
        isComplete: before.is_complete,
        isOneAway: before.is_one_away,
      });
      progressAfterByPlayerId.set(player.id, {
        isComplete: after.is_complete,
        isOneAway: after.is_one_away,
      });

      if (delta > 0) {
        playerNames.push(player.display_name);
        playerIdsAwarded.push(player.id);
        playerDeltas.set(player.display_name, delta);
        pointsAwarded += delta;
      }
    }

    const baseEventKey = resolveBaseEventKey(event.event_key);
    const eventBaseLabel = baseEventKey ? getEventById(baseEventKey)?.label : null;
    const teamLabel =
      event.team_key === "A"
        ? teamNames.A
        : event.team_key === "B"
          ? teamNames.B
          : null;
    const resolvedEventName = [
      teamLabel,
      eventBaseLabel ?? event.event_label ?? baseEventKey ?? "Event",
    ]
      .filter(Boolean)
      .join(": ");

    const primaryPlayerName = [...playerDeltas.entries()]
      .sort((a, b) => {
        if (a[1] !== b[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      })[0]?.[0] ?? null;

    const primaryPlayerId = [...playerIdsAwarded]
      .sort((left, right) => {
        const leftName = playerNamesById.get(left) ?? left;
        const rightName = playerNamesById.get(right) ?? right;
        const leftDelta = playerDeltas.get(leftName) ?? 0;
        const rightDelta = playerDeltas.get(rightName) ?? 0;

        if (leftDelta !== rightDelta) return rightDelta - leftDelta;
        return leftName.localeCompare(rightName);
      })[0] ?? null;

    eventFeedItems.push(
      formatRecordedEventFeedItem({
        event,
        pointsAwarded,
        playerNames,
        primaryPlayerName,
        resolvedEventName,
        scoresBeforeByPlayerName,
        scoresAfterByPlayerName,
      }),
    );

    eventFeedItems.push(
      ...buildProgressMilestoneItems({
        eventId: event.id,
        createdAt: event.created_at,
        playerNamesById,
        progressBeforeByPlayerId,
        progressAfterByPlayerId,
        announcedOneAwayPlayerIds,
      }),
    );

    eventFeedItems.push(
      ...buildBingraCompletedItems({
        eventId: event.id,
        createdAt: event.created_at,
        playerNamesById,
        progressBeforeByPlayerId,
        progressAfterByPlayerId,
        announcedBingraPlayerIds,
      }),
    );

    if (pointsAwarded > 0 && primaryPlayerId) {
      if (streakPlayerId === primaryPlayerId) {
        streakCount += 1;
      } else {
        streakPlayerId = primaryPlayerId;
        streakCount = 1;
      }

      const streakPlayerName = playerNamesById.get(primaryPlayerId);
      if (streakPlayerName && (streakCount === 2 || streakCount === 3)) {
        eventFeedItems.push(
          ...buildMomentumItems({
            eventId: event.id,
            createdAt: event.created_at,
            playerName: streakPlayerName,
            streakCount,
          }),
        );
      }
    } else {
      streakPlayerId = null;
      streakCount = 0;
    }

    recordedEventsProgress.push({
      event_key: event.event_key,
      team_key: event.team_key,
    });
  }

  return eventFeedItems;
}

export function buildGameLifecycleItems(input: {
  gameId: string;
  gameStatus: "lobby" | "live" | "finished";
  completedAt: string | null;
  winnerName: string | null;
  leaderboardEntries: ActivityFeedLeaderboardEntry[];
}): ActivityFeedItem[] {
  const { gameId, gameStatus, completedAt, winnerName, leaderboardEntries } = input;
  const gameLifecycleFeedItems: ActivityFeedItem[] = [];

  if (gameStatus === "finished" && completedAt) {
    if (winnerName) {
      gameLifecycleFeedItems.push({
        id: `winner-${gameId}`,
        type: "winner_declared",
        createdAt: completedAt,
        playerName: winnerName,
        headline: `${winnerName} declared winner`,
        tone: "positive",
        emphasis: "major",
      });
    }

    gameLifecycleFeedItems.push({
      id: `ended-${gameId}`,
      type: "game_ended",
      createdAt: completedAt,
      headline: "Game ended",
      tone: "neutral",
      emphasis: "major",
    });

    gameLifecycleFeedItems.push({
      id: `final-scores-${gameId}`,
      type: "final_scores",
      createdAt: completedAt,
      headline: "Final scores posted",
      tone: "neutral",
      emphasis: "highlight",
      standings: leaderboardEntries.map((entry) => ({
        playerName: entry.name,
        finalScore: entry.final_score,
        rawPoints: entry.raw_points,
        bingra: entry.has_bingra,
      })),
    });
  }

  return gameLifecycleFeedItems;
}

export function sortActivityFeedItems(items: ActivityFeedItem[]): ActivityFeedItem[] {
  return [...items].sort((a, b) => {
    if (a.createdAt === b.createdAt) {
      return b.id.localeCompare(a.id);
    }

    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function buildActivityFeedItems(input: {
  players: ActivityFeedPlayer[];
  events: ActivityFeedScoredEvent[];
  playerCardsByPlayerId: Map<string, ProgressCardCell[]>;
  completionMode: CompletionMode;
  teamNames: Record<TeamKey, string>;
  gameId: string;
  gameStatus: "lobby" | "live" | "finished";
  completedAt: string | null;
  winnerName: string | null;
  leaderboardEntries: ActivityFeedLeaderboardEntry[];
}): ActivityFeedItem[] {
  const playerJoinedFeedItems = buildPlayerJoinedItems(input.players);
  const eventFeedItems = buildEventRecordedItems({
    events: input.events,
    players: input.players,
    playerCardsByPlayerId: input.playerCardsByPlayerId,
    completionMode: input.completionMode,
    teamNames: input.teamNames,
  });
  const gameLifecycleFeedItems = buildGameLifecycleItems({
    gameId: input.gameId,
    gameStatus: input.gameStatus,
    completedAt: input.completedAt,
    winnerName: input.winnerName,
    leaderboardEntries: input.leaderboardEntries,
  });

  return sortActivityFeedItems([
    ...playerJoinedFeedItems,
    ...eventFeedItems,
    ...gameLifecycleFeedItems,
  ]);
}