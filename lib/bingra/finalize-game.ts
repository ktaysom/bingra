import type { CompletionMode, RecordedEvent, CardCell } from "./card-progress";
import { buildGameScores, resolveWinnerPlayerId } from "./game-results";

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
  display_name: string;
  created_at: string | null;
};

type CardRow = {
  player_id: string;
  card_cells: CardCell[];
};

type CompletionRow = {
  player_id: string;
  created_at: string;
};

type ScoredEventRow = {
  event_key: string | null;
  team_key: string | null;
};

export async function finalizeGameAndSetWinner(input: FinalizeInput): Promise<FinalizeResult> {
  const completedAt = input.completedAt ?? new Date().toISOString();

  const { data: playersData, error: playersError } = await input.supabase
    .from("players")
    .select("id, display_name, created_at")
    .eq("game_id", input.gameId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  const { data: cardsData, error: cardsError } = await input.supabase
    .from("cards")
    .select("player_id, card_cells(order_index, event_key, team_key, point_value)")
    .eq("game_id", input.gameId);

  const { data: completionsData, error: completionsError } = await input.supabase
    .from("game_completions")
    .select("player_id, created_at")
    .eq("game_id", input.gameId);

  const { data: scoredEventsData, error: scoredEventsError } = await input.supabase
    .from("scored_events")
    .select("event_key, team_key")
    .eq("game_id", input.gameId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

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
  }));

  const scoreboard = buildGameScores({
    players: players.map((player) => ({
      id: player.id,
      display_name: player.display_name,
      created_at: player.created_at,
    })),
    cards: cards.map((card) => ({
      player_id: card.player_id,
      card_cells: card.card_cells ?? [],
    })),
    recordedEvents,
    completionMode: input.completionMode,
    bingraPlayerIds,
    bingraCompletedAtByPlayerId,
  });

  const winnerPlayerId = resolveWinnerPlayerId(scoreboard);

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
