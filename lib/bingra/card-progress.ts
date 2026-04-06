export type CompletionMode = "BLACKOUT" | "STREAK";

import { cardCellEventMatchesRecordedEvent } from "./card-event-key";
import { resolveBaseEventKey } from "./card-event-key";
import { getEventById } from "./event-logic";
import { getEventScoreForCell } from "./game-scoring";
import { DEFAULT_SPORT_PROFILE, type SportProfileKey } from "./sport-profiles";
import {
  getRequiredCountForThresholdLevel,
  normalizeThresholdLevelForEvent,
} from "./threshold-levels";

export type RecordedEvent = {
  event_key: string | null;
  team_key?: string | null;
  created_at?: string | null;
};

export type CardCell = {
  event_key: string | null;
  team_key?: string | null;
  order_index?: number | null;
  point_value?: number | null;
  threshold: number;
};

export type CardProgress = {
  completed_cells_count: number;
  is_complete: boolean;
  is_one_away: boolean;
  score: number;
  cell_progress: CardCellProgress[];
};

export type CardCellProgress = {
  event_key: string | null;
  team_key: string | null;
  current_count: number;
  threshold: number;
  required_count: number;
  remaining_count: number;
  is_completed: boolean;
};

type IndexedCell = CardCell & { originalIndex: number };

function isMatchingEvent(cell: CardCell, event: RecordedEvent): boolean {
  return cardCellEventMatchesRecordedEvent({
    cardCell: {
      eventKey: cell.event_key,
      teamKey: cell.team_key,
    },
    recordedEvent: {
      eventKey: event.event_key,
      teamKey: event.team_key,
    },
  });
}

function toPointValue(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function calculateThresholdAdjustedPoints(basePoints: number, threshold: number): number {
  return getEventScoreForCell({
    basePoints,
    thresholdLevel: threshold,
  }).finalPoints;
}

function toThreshold(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.ceil(value)) : 1;
}

function resolveThresholdRule(
  cell: CardCell,
  profile: SportProfileKey,
): { thresholdLevel: number; requiredCount: number } {
  const fallbackLevel = toThreshold(cell.threshold);
  const baseEventKey = resolveBaseEventKey(cell.event_key);
  const event = baseEventKey ? getEventById(baseEventKey) : undefined;

  if (!event) {
    return {
      thresholdLevel: fallbackLevel,
      requiredCount: fallbackLevel,
    };
  }

  const thresholdLevel = normalizeThresholdLevelForEvent(event, fallbackLevel);
  const requiredCount = getRequiredCountForThresholdLevel(event, profile, thresholdLevel);

  return {
    thresholdLevel,
    requiredCount,
  };
}

export function normalizeCardCell(cell: Partial<CardCell>): CardCell {
  return {
    event_key: typeof cell.event_key === "string" ? cell.event_key : null,
    team_key: typeof cell.team_key === "string" ? cell.team_key : null,
    order_index: typeof cell.order_index === "number" ? cell.order_index : null,
    point_value: typeof cell.point_value === "number" ? cell.point_value : null,
    threshold: toThreshold(cell.threshold),
  };
}

export function normalizeCardCells(cells: Array<Partial<CardCell>>): CardCell[] {
  return cells.map((cell) => normalizeCardCell(cell));
}

export function filterRecordedEventsByAcceptedAt(
  recorded_events: RecordedEvent[],
  accepted_at: string | null | undefined,
): RecordedEvent[] {
  if (!accepted_at) {
    return [];
  }

  const acceptedAtMs = new Date(accepted_at).getTime();
  if (!Number.isFinite(acceptedAtMs)) {
    return [];
  }

  return recorded_events.filter((event) => {
    if (!event.created_at) {
      return false;
    }

    const recordedAtMs = new Date(event.created_at).getTime();
    if (!Number.isFinite(recordedAtMs)) {
      return false;
    }

    return recordedAtMs >= acceptedAtMs;
  });
}

function sortCellsForStreak(cells: CardCell[]): IndexedCell[] {
  return cells
    .map((cell, index) => ({ ...cell, originalIndex: index }))
    .sort((a, b) => {
      const left = typeof a.order_index === "number" ? a.order_index : Number.MAX_SAFE_INTEGER;
      const right = typeof b.order_index === "number" ? b.order_index : Number.MAX_SAFE_INTEGER;

      if (left !== right) {
        return left - right;
      }

      return a.originalIndex - b.originalIndex;
    });
}

export function calculateCompletedCellFlags(
  recorded_events: RecordedEvent[],
  card_cells: CardCell[],
  completion_mode: CompletionMode,
  sportProfile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): boolean[] {
  return calculateCardCellProgress(recorded_events, card_cells, completion_mode, sportProfile).map(
    (cellProgress) => cellProgress.is_completed,
  );
}

export function calculateCardCellProgress(
  recorded_events: RecordedEvent[],
  card_cells: CardCell[],
  completion_mode: CompletionMode,
  sportProfile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): CardCellProgress[] {
  const progress: CardCellProgress[] = card_cells.map((cell) => {
    const thresholdRule = resolveThresholdRule(cell, sportProfile);

    return {
      event_key: cell.event_key,
      team_key: typeof cell.team_key === "string" ? cell.team_key : null,
      current_count: 0,
      threshold: thresholdRule.thresholdLevel,
      required_count: thresholdRule.requiredCount,
      remaining_count: thresholdRule.requiredCount,
      is_completed: false,
    };
  });

  if (completion_mode === "BLACKOUT") {
    for (let cellIndex = 0; cellIndex < card_cells.length; cellIndex += 1) {
      const cell = card_cells[cellIndex];
      let currentCount = 0;

      for (const event of recorded_events) {
        if (isMatchingEvent(cell, event)) {
          currentCount += 1;
        }
      }

      const requiredCount = progress[cellIndex]?.required_count ?? 1;
      const remainingCount = Math.max(requiredCount - currentCount, 0);

      progress[cellIndex] = {
        ...(progress[cellIndex] as CardCellProgress),
        current_count: currentCount,
        remaining_count: remainingCount,
        is_completed: currentCount >= requiredCount,
      };
    }

    return progress;
  }

  const orderedCells = sortCellsForStreak(card_cells);
  let lastMatchedEventIndex = -1;

  for (const cell of orderedCells) {
    const thresholdRule = resolveThresholdRule(cell, sportProfile);
    const requiredCount = thresholdRule.requiredCount;
    let currentCount = 0;

    for (
      let eventIndex = lastMatchedEventIndex + 1;
      eventIndex < recorded_events.length;
      eventIndex += 1
    ) {
      if (isMatchingEvent(cell, recorded_events[eventIndex])) {
        currentCount += 1;
        lastMatchedEventIndex = eventIndex;

        if (currentCount >= requiredCount) {
          break;
        }
      }
    }

    const remainingCount = Math.max(requiredCount - currentCount, 0);

    progress[cell.originalIndex] = {
      ...(progress[cell.originalIndex] as CardCellProgress),
      current_count: currentCount,
      remaining_count: remainingCount,
      is_completed: currentCount >= requiredCount,
    };

    if (currentCount < requiredCount) {
      break;
    }
  }

  return progress;
}

/**
 * Calculates card progress from all recorded events for a game.
 *
 * Important: recorded_events should be provided in chronological order.
 */
export function calculateCardProgress(
  recorded_events: RecordedEvent[],
  card_cells: CardCell[],
  completion_mode: CompletionMode,
  sportProfile: SportProfileKey = DEFAULT_SPORT_PROFILE,
): CardProgress {
  const totalCells = card_cells.length;

  if (totalCells === 0) {
    return {
      completed_cells_count: 0,
      is_complete: false,
      is_one_away: false,
      score: 0,
      cell_progress: [],
    };
  }

  const cellProgress = calculateCardCellProgress(
    recorded_events,
    card_cells,
    completion_mode,
    sportProfile,
  );

  let completedCount = 0;
  let score = 0;
  let remainingTotalCount = 0;

  for (let index = 0; index < cellProgress.length; index += 1) {
    const cell = card_cells[index];
    const progress = cellProgress[index];

    if (!progress) {
      continue;
    }

    remainingTotalCount += progress.remaining_count;

    if (!progress.is_completed) {
      continue;
    }

    completedCount += 1;
    score += calculateThresholdAdjustedPoints(
      toPointValue(cell?.point_value),
      progress.threshold,
    );
  }

  return {
    completed_cells_count: completedCount,
    is_complete: completedCount === totalCells,
    is_one_away: remainingTotalCount === 1,
    score,
    cell_progress: cellProgress,
  };
}
