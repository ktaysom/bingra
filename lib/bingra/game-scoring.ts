export const BINGRA_MULTIPLIER = 2;

const THRESHOLD_SCORE_MULTIPLIER_BY_LEVEL: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 1.0,
  2: 2.2,
  3: 3.8,
  4: 5.8,
  5: 8.0,
};

export function getThresholdScoreMultiplier(threshold: number): number {
  const normalizedThreshold = Number.isFinite(threshold) ? Math.max(1, Math.ceil(threshold)) : 1;
  const clampedThreshold = Math.min(normalizedThreshold, 5) as 1 | 2 | 3 | 4 | 5;

  return THRESHOLD_SCORE_MULTIPLIER_BY_LEVEL[clampedThreshold];
}

export type EventScoreForCellInput = {
  basePoints: number;
  thresholdLevel: number;
};

export type EventScoreForCell = {
  basePoints: number;
  thresholdLevel: number;
  thresholdMultiplier: number;
  finalPoints: number;
};

function normalizeBasePoints(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function getEventScoreForCell(input: EventScoreForCellInput): EventScoreForCell {
  const basePoints = normalizeBasePoints(input.basePoints);
  const thresholdLevel = Number.isFinite(input.thresholdLevel)
    ? Math.max(1, Math.ceil(input.thresholdLevel))
    : 1;
  const thresholdMultiplier = getThresholdScoreMultiplier(thresholdLevel);
  const finalPoints = Math.round(basePoints * thresholdMultiplier);

  return {
    basePoints,
    thresholdLevel,
    thresholdMultiplier,
    finalPoints,
  };
}

export type ScoreBreakdown = {
  raw_points: number;
  has_bingra: boolean;
  final_score: number;
};

export function calculateFinalScore(rawPoints: number, hasBingra: boolean): number {
  return hasBingra ? rawPoints * BINGRA_MULTIPLIER : rawPoints;
}

export function buildScoreBreakdown(rawPoints: number, hasBingra: boolean): ScoreBreakdown {
  return {
    raw_points: rawPoints,
    has_bingra: hasBingra,
    final_score: calculateFinalScore(rawPoints, hasBingra),
  };
}

export type RankedScoreEntry = {
  player_id: string;
  join_order: number;
  raw_points: number;
  has_bingra: boolean;
  final_score: number;
  bingra_completed_at?: string | null;
  player_created_at?: string | null;
};

function compareIsoAsc(left?: string | null, right?: string | null): number {
  const leftValue = left ?? "9999-12-31T23:59:59.999Z";
  const rightValue = right ?? "9999-12-31T23:59:59.999Z";

  if (leftValue < rightValue) return -1;
  if (leftValue > rightValue) return 1;
  return 0;
}

export function rankScoreEntries<T extends RankedScoreEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    // 1) higher final score
    if (a.final_score !== b.final_score) {
      return b.final_score - a.final_score;
    }

    // 2) higher raw score
    if (a.raw_points !== b.raw_points) {
      return b.raw_points - a.raw_points;
    }

    // 3) earlier Bingra completion timestamp if both have Bingra
    if (a.has_bingra && b.has_bingra) {
      const bingraTimeCmp = compareIsoAsc(a.bingra_completed_at, b.bingra_completed_at);
      if (bingraTimeCmp !== 0) {
        return bingraTimeCmp;
      }
    }

    // 4) earlier player join/create timestamp
    const playerCreatedCmp = compareIsoAsc(a.player_created_at, b.player_created_at);
    if (playerCreatedCmp !== 0) {
      return playerCreatedCmp;
    }

    // 5) stable fallback by player id
    const idCmp = a.player_id.localeCompare(b.player_id);
    if (idCmp !== 0) {
      return idCmp;
    }

    // Last guard for total stability
    return a.join_order - b.join_order;
  });
}
