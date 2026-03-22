export type CompletionMode = "BLACKOUT" | "STREAK";

import { cardCellEventMatchesRecordedEvent } from "./card-event-key";

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
};

export type CardProgress = {
  completed_cells_count: number;
  is_complete: boolean;
  is_one_away: boolean;
  score: number;
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
): boolean[] {
  const completed = new Array<boolean>(card_cells.length).fill(false);

  if (completion_mode === "BLACKOUT") {
    for (let cellIndex = 0; cellIndex < card_cells.length; cellIndex += 1) {
      const cell = card_cells[cellIndex];
      completed[cellIndex] = recorded_events.some((event) => isMatchingEvent(cell, event));
    }

    return completed;
  }

  const orderedCells = sortCellsForStreak(card_cells);
  let lastMatchedEventIndex = -1;

  for (const cell of orderedCells) {
    let matchedEventIndex = -1;

    for (
      let eventIndex = lastMatchedEventIndex + 1;
      eventIndex < recorded_events.length;
      eventIndex += 1
    ) {
      if (isMatchingEvent(cell, recorded_events[eventIndex])) {
        matchedEventIndex = eventIndex;
        break;
      }
    }

    if (matchedEventIndex === -1) {
      break;
    }

    completed[cell.originalIndex] = true;
    lastMatchedEventIndex = matchedEventIndex;
  }

  return completed;
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
): CardProgress {
  const totalCells = card_cells.length;

  if (totalCells === 0) {
    return {
      completed_cells_count: 0,
      is_complete: false,
      is_one_away: false,
      score: 0,
    };
  }

  const completed = calculateCompletedCellFlags(recorded_events, card_cells, completion_mode);

  let completedCount = 0;
  let score = 0;

  for (let index = 0; index < card_cells.length; index += 1) {
    if (!completed[index]) {
      continue;
    }

    completedCount += 1;
    score += toPointValue(card_cells[index].point_value);
  }

  const remaining = totalCells - completedCount;

  return {
    completed_cells_count: completedCount,
    is_complete: completedCount === totalCells,
    is_one_away: remaining === 1,
    score,
  };
}
