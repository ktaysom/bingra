import {
  calculateCardProgress,
  type CardCell,
  type CompletionMode,
  type RecordedEvent,
} from "./card-progress";
import { buildScoreBreakdown, rankScoreEntries } from "./game-scoring";

export type ScorePlayer = {
  id: string;
  display_name: string;
  created_at?: string | null;
};

export type ScoreCard = {
  player_id: string;
  card_cells: CardCell[];
};

export type GameScoreEntry = {
  player_id: string;
  player_name: string;
  join_order: number;
  raw_points: number;
  final_score: number;
  has_bingra: boolean;
  completed_cells_count: number;
  is_one_away: boolean;
};

type BuildGameScoresInput = {
  players: ScorePlayer[];
  cards: ScoreCard[];
  recordedEvents: RecordedEvent[];
  completionMode: CompletionMode;
  bingraPlayerIds: Set<string>;
  bingraCompletedAtByPlayerId?: Map<string, string>;
};

export function buildGameScores(input: BuildGameScoresInput): GameScoreEntry[] {
  const cardsByPlayerId = new Map(input.cards.map((card) => [card.player_id, card]));

  const entries = input.players.map((player, joinOrder) => {
    const cardCells = cardsByPlayerId.get(player.id)?.card_cells ?? [];
    const progress = calculateCardProgress(input.recordedEvents, cardCells, input.completionMode);
    const hasBingra = input.bingraPlayerIds.has(player.id);
    const scoreBreakdown = buildScoreBreakdown(progress.score, hasBingra);

    return {
      player_id: player.id,
      player_name: player.display_name,
      join_order: joinOrder,
      raw_points: scoreBreakdown.raw_points,
      final_score: scoreBreakdown.final_score,
      has_bingra: scoreBreakdown.has_bingra,
      bingra_completed_at: hasBingra
        ? input.bingraCompletedAtByPlayerId?.get(player.id) ?? null
        : null,
      player_created_at: player.created_at ?? null,
      completed_cells_count: progress.completed_cells_count,
      is_one_away: progress.is_one_away,
    };
  });

  return rankScoreEntries(entries);
}

export function resolveWinnerPlayerId(entries: GameScoreEntry[]): string | null {
  return entries[0]?.player_id ?? null;
}
