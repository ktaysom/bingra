import {
  normalizeCardCells,
  type CompletionMode,
  type RecordedEvent,
  type CardCell,
} from "./card-progress";
import { buildGameScores, resolveWinnerPlayerId } from "./game-results";
import { resolveSportProfileKey } from "./sport-profiles";

type FinalizeInput = {
  supabase: {
    from: (table: string) => any;
  };
  gameId: string;
  completionMode: CompletionMode;
  completedAt?: string;
};

type FinalizeResult = {
  winnerPlayerId: string | null;
  completedAt: string;
};

type PlayerRow = {
  id: string;
  profile_id: string | null;
  display_name: string;
  created_at: string | null;
};

type CardRow = {
  player_id: string;
  accepted_at: string | null;
  card_cells: CardCell[];
};

type CompletionRow = {
  player_id: string;
  created_at: string;
};

type ScoredEventRow = {
  event_key: string | null;
  team_key: string | null;
  created_at: string | null;
};

type GameRow = {
  id: string;
  created_at: string | null;
  sport_profile: string | null;
};

type ProfileStatsRow = {
  profile_id: string;
  games_played: number;
  games_won: number;
  bingras_completed: number;
  total_points: number;
  total_raw_points: number;
  avg_score: number | null;
  avg_finish_position: number | null;
  best_finish_position: number | null;
  current_win_streak: number;
  longest_win_streak: number;
  last_played_at: string | null;
};

async function persistProfileCareerStats(params: {
  supabase: { from: (table: string) => any };
  gameId: string;
  gameCreatedAt: string | null;
  completedAt: string;
  players: PlayerRow[];
  scoreboard: Array<{
    player_id: string;
    final_score: number;
    raw_points: number;
    has_bingra: boolean;
    bingra_completed_at?: string | null;
  }>;
}) {
  const scoreboardByPlayerId = new Map(params.scoreboard.map((entry, index) => [entry.player_id, {
    ...entry,
    rank: index + 1,
  }]));

  const totalPlayers = params.scoreboard.length;

  for (const player of params.players) {
    if (!player.profile_id) {
      continue;
    }

    const scoreEntry = scoreboardByPlayerId.get(player.id);
    if (!scoreEntry) {
      continue;
    }

    const completionTimeSeconds =
      scoreEntry.has_bingra && scoreEntry.bingra_completed_at && params.gameCreatedAt
        ? Math.max(
            0,
            Math.floor(
              (new Date(scoreEntry.bingra_completed_at).getTime() - new Date(params.gameCreatedAt).getTime()) / 1000,
            ),
          )
        : null;

    const { error: resultInsertError } = await params.supabase
      .from("profile_game_results")
      .insert({
        profile_id: player.profile_id,
        game_id: params.gameId,
        finished_at: params.completedAt,
        final_score: scoreEntry.final_score,
        raw_points: scoreEntry.raw_points,
        rank: scoreEntry.rank,
        total_players: totalPlayers,
        bingra_completed: scoreEntry.has_bingra,
        bingra_completed_at: scoreEntry.has_bingra ? scoreEntry.bingra_completed_at ?? null : null,
        completion_time_seconds: completionTimeSeconds,
      });

    if (resultInsertError) {
      if ((resultInsertError as { code?: string }).code === "23505") {
        continue;
      }

      throw resultInsertError;
    }

    const { data: existingStats, error: existingStatsError } = await params.supabase
      .from("profile_stats")
      .select(
        "profile_id, games_played, games_won, bingras_completed, total_points, total_raw_points, avg_score, avg_finish_position, best_finish_position, current_win_streak, longest_win_streak, last_played_at",
      )
      .eq("profile_id", player.profile_id)
      .maybeSingle();

    if (existingStatsError) {
      throw existingStatsError;
    }

    const previous = (existingStats as ProfileStatsRow | null) ?? {
      profile_id: player.profile_id,
      games_played: 0,
      games_won: 0,
      bingras_completed: 0,
      total_points: 0,
      total_raw_points: 0,
      avg_score: null,
      avg_finish_position: null,
      best_finish_position: null,
      current_win_streak: 0,
      longest_win_streak: 0,
      last_played_at: null,
    };

    const didWin = scoreEntry.rank === 1;
    const nextGamesPlayed = previous.games_played + 1;
    const nextGamesWon = previous.games_won + (didWin ? 1 : 0);
    const nextBingrasCompleted = previous.bingras_completed + (scoreEntry.has_bingra ? 1 : 0);
    const nextTotalPoints = previous.total_points + scoreEntry.final_score;
    const nextTotalRawPoints = previous.total_raw_points + scoreEntry.raw_points;
    const nextAvgScore = nextGamesPlayed > 0 ? nextTotalPoints / nextGamesPlayed : null;

    const priorFinishPositionTotal = (previous.avg_finish_position ?? 0) * previous.games_played;
    const nextAvgFinishPosition = nextGamesPlayed > 0
      ? (priorFinishPositionTotal + scoreEntry.rank) / nextGamesPlayed
      : null;

    const nextBestFinishPosition = previous.best_finish_position == null
      ? scoreEntry.rank
      : Math.min(previous.best_finish_position, scoreEntry.rank);

    const nextCurrentWinStreak = didWin ? previous.current_win_streak + 1 : 0;
    const nextLongestWinStreak = Math.max(previous.longest_win_streak, nextCurrentWinStreak);

    const { error: statsUpsertError } = await params.supabase
      .from("profile_stats")
      .upsert(
        {
          profile_id: player.profile_id,
          games_played: nextGamesPlayed,
          games_won: nextGamesWon,
          bingras_completed: nextBingrasCompleted,
          total_points: nextTotalPoints,
          total_raw_points: nextTotalRawPoints,
          avg_score: nextAvgScore,
          avg_finish_position: nextAvgFinishPosition,
          best_finish_position: nextBestFinishPosition,
          current_win_streak: nextCurrentWinStreak,
          longest_win_streak: nextLongestWinStreak,
          last_played_at: params.completedAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" },
      );

    if (statsUpsertError) {
      throw statsUpsertError;
    }
  }
}

export async function finalizeGameAndSetWinner(input: FinalizeInput): Promise<FinalizeResult> {
  const completedAt = input.completedAt ?? new Date().toISOString();

  const { data: gameData, error: gameError } = await input.supabase
    .from("games")
    .select("id, created_at, sport_profile")
    .eq("id", input.gameId)
    .maybeSingle();

  const { data: playersData, error: playersError } = await input.supabase
    .from("players")
    .select("id, profile_id, display_name, created_at")
    .eq("game_id", input.gameId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const { data: cardsData, error: cardsError } = await input.supabase
    .from("cards")
    .select("player_id, accepted_at, card_cells(order_index, event_key, team_key, point_value, threshold)")
    .eq("game_id", input.gameId);

  const { data: completionsData, error: completionsError } = await input.supabase
    .from("game_completions")
    .select("player_id, created_at")
    .eq("game_id", input.gameId);

  const { data: scoredEventsData, error: scoredEventsError } = await input.supabase
    .from("scored_events")
    .select("event_key, team_key, created_at")
    .eq("game_id", input.gameId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (gameError) throw gameError;
  if (playersError) throw playersError;
  if (cardsError) throw cardsError;
  if (completionsError) throw completionsError;
  if (scoredEventsError) throw scoredEventsError;

  const players = (playersData as PlayerRow[] | null) ?? [];
  const cards = (cardsData as CardRow[] | null) ?? [];
  const completions = (completionsData as CompletionRow[] | null) ?? [];
  const scoredEvents = (scoredEventsData as ScoredEventRow[] | null) ?? [];

  const bingraPlayerIds = new Set<string>(completions.map((row) => row.player_id));
  const bingraCompletedAtByPlayerId = new Map<string, string>();

  for (const completion of completions) {
    const existing = bingraCompletedAtByPlayerId.get(completion.player_id);
    if (!existing || completion.created_at < existing) {
      bingraCompletedAtByPlayerId.set(completion.player_id, completion.created_at);
    }
  }

  const recordedEvents: RecordedEvent[] = scoredEvents.map((event) => ({
    event_key: event.event_key,
    team_key: event.team_key,
    created_at: event.created_at,
  }));

  const scoreboard = buildGameScores({
    players: players.map((player) => ({
      id: player.id,
      display_name: player.display_name,
      created_at: player.created_at,
    })),
    cards: cards.map((card) => ({
      player_id: card.player_id,
      accepted_at: card.accepted_at,
      card_cells: normalizeCardCells((card.card_cells ?? []) as Array<Partial<CardCell>>),
    })),
    recordedEvents,
    completionMode: input.completionMode,
    sportProfile: resolveSportProfileKey((gameData as GameRow | null)?.sport_profile ?? null),
    bingraPlayerIds,
    bingraCompletedAtByPlayerId,
  });

  const winnerPlayerId = resolveWinnerPlayerId(scoreboard);

  await persistProfileCareerStats({
    supabase: input.supabase,
    gameId: input.gameId,
    gameCreatedAt: (gameData as GameRow | null)?.created_at ?? null,
    completedAt,
    players,
    scoreboard,
  });

  const { error: updateError } = await input.supabase
    .from("games")
    .update({
      status: "finished",
      completed_at: completedAt,
      winner_player_id: winnerPlayerId,
    })
    .eq("id", input.gameId)
    .neq("status", "finished");

  if (updateError) {
    throw updateError;
  }

  return {
    winnerPlayerId,
    completedAt,
  };
}
