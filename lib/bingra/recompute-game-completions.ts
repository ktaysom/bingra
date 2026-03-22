import {
  calculateCardProgress,
  filterRecordedEventsByAcceptedAt,
  type CardCell,
  type CompletionMode,
  type RecordedEvent,
} from "./card-progress";

type RecomputeInput = {
  supabase: {
    from: (table: string) => any;
  };
  gameId: string;
  completionMode: CompletionMode;
};

type CardRow = {
  player_id: string;
  accepted_at: string | null;
  card_cells: CardCell[];
};

type ScoredEventRow = {
  id: string;
  event_key: string | null;
  team_key: string | null;
  created_at: string | null;
};

export async function recomputeGameCompletions(input: RecomputeInput): Promise<void> {
  const { data: cardsData, error: cardsError } = await input.supabase
    .from("cards")
    .select("player_id, accepted_at, card_cells(order_index, event_key, team_key, point_value)")
    .eq("game_id", input.gameId);

  const { data: scoredEventsData, error: scoredEventsError } = await input.supabase
    .from("scored_events")
    .select("id, event_key, team_key, created_at")
    .eq("game_id", input.gameId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (cardsError) throw cardsError;
  if (scoredEventsError) throw scoredEventsError;

  const cards = (cardsData as CardRow[] | null) ?? [];
  const scoredEvents = (scoredEventsData as ScoredEventRow[] | null) ?? [];

  const rowsToInsert: Array<{
    game_id: string;
    player_id: string;
    completed_at_event_id: string;
    created_at?: string;
  }> = [];

  for (const card of cards) {
    if (!card.player_id) continue;

    let completionEventId: string | null = null;
    let completionCreatedAt: string | null = null;

    for (let idx = 0; idx < scoredEvents.length; idx += 1) {
      const beforeEvents: RecordedEvent[] = scoredEvents.slice(0, idx).map((event) => ({
        event_key: event.event_key,
        team_key: event.team_key,
        created_at: event.created_at,
      }));
      const afterEvents: RecordedEvent[] = scoredEvents.slice(0, idx + 1).map((event) => ({
        event_key: event.event_key,
        team_key: event.team_key,
        created_at: event.created_at,
      }));

      const beforeProgress = calculateCardProgress(
        filterRecordedEventsByAcceptedAt(beforeEvents, card.accepted_at),
        card.card_cells ?? [],
        input.completionMode,
      );
      const afterProgress = calculateCardProgress(
        filterRecordedEventsByAcceptedAt(afterEvents, card.accepted_at),
        card.card_cells ?? [],
        input.completionMode,
      );

      if (!beforeProgress.is_complete && afterProgress.is_complete) {
        completionEventId = scoredEvents[idx]?.id ?? null;
        completionCreatedAt = scoredEvents[idx]?.created_at ?? null;
        break;
      }
    }

    if (completionEventId) {
      rowsToInsert.push({
        game_id: input.gameId,
        player_id: card.player_id,
        completed_at_event_id: completionEventId,
        ...(completionCreatedAt ? { created_at: completionCreatedAt } : {}),
      });
    }
  }

  const { error: deleteError } = await input.supabase
    .from("game_completions")
    .delete()
    .eq("game_id", input.gameId);

  if (deleteError) throw deleteError;

  if (!rowsToInsert.length) {
    return;
  }

  const { error: insertError } = await input.supabase
    .from("game_completions")
    .insert(rowsToInsert);

  if (insertError && insertError.code !== "23505") {
    throw insertError;
  }
}
