import { buildGameScores } from "./game-results";
import { normalizeCardCells, type CardCell, type CompletionMode, type RecordedEvent } from "./card-progress";

type SupabaseLike = {
  from: (table: string) => any;
};

type FinishedGameRow = {
  id: string;
  created_at: string | null;
  completed_at: string | null;
  completion_mode: CompletionMode;
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

type ProfileGameResultRow = {
  profile_id: string;
  game_id: string;
  finished_at: string;
  final_score: number;
  raw_points: number;
  rank: number;
  total_players: number;
  bingra_completed: boolean;
  bingra_completed_at: string | null;
  completion_time_seconds: number | null;
};

type ProfileStatsAggregate = {
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
  updated_at: string;
};

function buildStatsFromResults(results: ProfileGameResultRow[]): ProfileStatsAggregate[] {
  const byProfile = new Map<string, ProfileGameResultRow[]>();

  for (const row of results) {
    const list = byProfile.get(row.profile_id) ?? [];
    list.push(row);
    byProfile.set(row.profile_id, list);
  }

  const aggregates: ProfileStatsAggregate[] = [];

  for (const [profileId, profileRows] of byProfile.entries()) {
    const ordered = [...profileRows].sort((a, b) => {
      if (a.finished_at === b.finished_at) {
        return a.game_id.localeCompare(b.game_id);
      }

      return a.finished_at.localeCompare(b.finished_at);
    });

    const gamesPlayed = ordered.length;
    const gamesWon = ordered.filter((row) => row.rank === 1).length;
    const bingrasCompleted = ordered.filter((row) => row.bingra_completed).length;
    const totalPoints = ordered.reduce((sum, row) => sum + row.final_score, 0);
    const totalRawPoints = ordered.reduce((sum, row) => sum + row.raw_points, 0);
    const finishTotal = ordered.reduce((sum, row) => sum + row.rank, 0);
    const bestFinishPosition = ordered.reduce<number | null>((best, row) => {
      if (best == null) return row.rank;
      return Math.min(best, row.rank);
    }, null);

    let currentStreakRolling = 0;
    let longestStreak = 0;

    for (const row of ordered) {
      if (row.rank === 1) {
        currentStreakRolling += 1;
        longestStreak = Math.max(longestStreak, currentStreakRolling);
      } else {
        currentStreakRolling = 0;
      }
    }

    const currentWinStreak = (() => {
      let streak = 0;
      for (let index = ordered.length - 1; index >= 0; index -= 1) {
        if (ordered[index]?.rank === 1) {
          streak += 1;
        } else {
          break;
        }
      }
      return streak;
    })();

    aggregates.push({
      profile_id: profileId,
      games_played: gamesPlayed,
      games_won: gamesWon,
      bingras_completed: bingrasCompleted,
      total_points: totalPoints,
      total_raw_points: totalRawPoints,
      avg_score: gamesPlayed > 0 ? totalPoints / gamesPlayed : null,
      avg_finish_position: gamesPlayed > 0 ? finishTotal / gamesPlayed : null,
      best_finish_position: bestFinishPosition,
      current_win_streak: currentWinStreak,
      longest_win_streak: longestStreak,
      last_played_at: ordered[ordered.length - 1]?.finished_at ?? null,
      updated_at: new Date().toISOString(),
    });
  }

  return aggregates;
}

async function buildProfileResultRowsForGame(params: {
  supabase: SupabaseLike;
  game: FinishedGameRow;
  profileFilter: Set<string> | null;
}): Promise<ProfileGameResultRow[]> {
  const { supabase, game, profileFilter } = params;

  const { data: playersData, error: playersError } = await supabase
    .from("players")
    .select("id, profile_id, display_name, created_at")
    .eq("game_id", game.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (playersError) throw playersError;

  const { data: cardsData, error: cardsError } = await supabase
    .from("cards")
    .select("player_id, accepted_at, card_cells(order_index, event_key, team_key, point_value, threshold)")
    .eq("game_id", game.id);

  if (cardsError) throw cardsError;

  const { data: completionsData, error: completionsError } = await supabase
    .from("game_completions")
    .select("player_id, created_at")
    .eq("game_id", game.id);

  if (completionsError) throw completionsError;

  const { data: scoredEventsData, error: scoredEventsError } = await supabase
    .from("scored_events")
    .select("event_key, team_key, created_at")
    .eq("game_id", game.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

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
    completionMode: game.completion_mode,
    bingraPlayerIds,
    bingraCompletedAtByPlayerId,
  });

  const scoreByPlayerId = new Map(
    scoreboard.map((entry, index) => [entry.player_id, { ...entry, rank: index + 1 }]),
  );
  const totalPlayers = scoreboard.length;
  const finishedAt = game.completed_at ?? new Date().toISOString();

  const rows: ProfileGameResultRow[] = [];

  for (const player of players) {
    if (!player.profile_id) continue;
    if (profileFilter && !profileFilter.has(player.profile_id)) continue;

    const scoreEntry = scoreByPlayerId.get(player.id);
    if (!scoreEntry) continue;

    const completionTimeSeconds =
      scoreEntry.has_bingra && scoreEntry.bingra_completed_at && game.created_at
        ? Math.max(
            0,
            Math.floor(
              (new Date(scoreEntry.bingra_completed_at).getTime() - new Date(game.created_at).getTime()) / 1000,
            ),
          )
        : null;

    rows.push({
      profile_id: player.profile_id,
      game_id: game.id,
      finished_at: finishedAt,
      final_score: scoreEntry.final_score,
      raw_points: scoreEntry.raw_points,
      rank: scoreEntry.rank,
      total_players: totalPlayers,
      bingra_completed: scoreEntry.has_bingra,
      bingra_completed_at: scoreEntry.has_bingra ? scoreEntry.bingra_completed_at ?? null : null,
      completion_time_seconds: completionTimeSeconds,
    });
  }

  return rows;
}

export async function rebuildCareerStatsFromCanonicalHistory(params: {
  supabase: SupabaseLike;
  profileIds?: string[];
}): Promise<{
  rebuiltProfileCount: number;
  rebuiltGameResultCount: number;
}> {
  const profileFilter = params.profileIds?.length ? new Set(params.profileIds) : null;

  if (profileFilter) {
    const profileIds = Array.from(profileFilter);

    await params.supabase
      .from("profile_game_results")
      .delete()
      .in("profile_id", profileIds);

    await params.supabase
      .from("profile_stats")
      .delete()
      .in("profile_id", profileIds);
  } else {
    await params.supabase
      .from("profile_game_results")
      .delete()
      .neq("profile_id", "00000000-0000-0000-0000-000000000000");

    await params.supabase
      .from("profile_stats")
      .delete()
      .neq("profile_id", "00000000-0000-0000-0000-000000000000");
  }

  const { data: finishedGamesData, error: finishedGamesError } = await params.supabase
    .from("games")
    .select("id, created_at, completed_at, completion_mode")
    .eq("status", "finished")
    .order("completed_at", { ascending: true })
    .order("id", { ascending: true });

  if (finishedGamesError) throw finishedGamesError;

  const finishedGames = (finishedGamesData as FinishedGameRow[] | null) ?? [];
  const allResultRows: ProfileGameResultRow[] = [];

  for (const game of finishedGames) {
    const rows = await buildProfileResultRowsForGame({
      supabase: params.supabase,
      game,
      profileFilter,
    });

    if (rows.length) {
      allResultRows.push(...rows);
    }
  }

  if (allResultRows.length) {
    const { error: upsertResultsError } = await params.supabase
      .from("profile_game_results")
      .upsert(allResultRows, { onConflict: "profile_id,game_id" });

    if (upsertResultsError) throw upsertResultsError;
  }

  const statsRows = buildStatsFromResults(allResultRows);

  if (statsRows.length) {
    const { error: upsertStatsError } = await params.supabase
      .from("profile_stats")
      .upsert(statsRows, { onConflict: "profile_id" });

    if (upsertStatsError) throw upsertStatsError;
  }

  return {
    rebuiltProfileCount: new Set(statsRows.map((row) => row.profile_id)).size,
    rebuiltGameResultCount: allResultRows.length,
  };
}
