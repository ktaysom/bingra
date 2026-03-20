export type CardCell = {
  eventKey: string;
  orderIndex?: number | null;
  marked: boolean;
};

export type WinnerPattern = { type: "full_card" };

type EvaluationResult = {
  isWinner: boolean;
  pattern?: WinnerPattern;
};

export function evaluateCardWin(
  cells: CardCell[],
): EvaluationResult {
  if (cells.length === 0) {
    return { isWinner: false };
  }

  const ordered = [...cells].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  const isComplete = ordered.every((cell) => cell.marked);

  return isComplete
    ? { isWinner: true, pattern: { type: "full_card" } }
    : { isWinner: false };
}