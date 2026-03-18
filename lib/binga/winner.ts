export type CardCell = {
  eventKey: string;
  orderIndex?: number | null;
  marked: boolean;
};

export type WinnerPattern =
  | { type: "row"; index: number }
  | { type: "column"; index: number }
  | { type: "diagonal"; direction: "main" | "anti" };

export type EvaluateCardOptions = {
  width?: number;
};

type EvaluationResult = {
  isWinner: boolean;
  pattern?: WinnerPattern;
};

export function evaluateCardWin(
  cells: CardCell[],
  options?: EvaluateCardOptions,
): EvaluationResult {
  if (cells.length === 0) {
    return { isWinner: false };
  }

  const width = options?.width ?? 5;
  if (width <= 0) {
    throw new Error("Card width must be greater than zero");
  }

  const ordered = [...cells].sort((a, b) => {
    const left = a.orderIndex ?? 0;
    const right = b.orderIndex ?? 0;
    return left - right;
  });

  const rows = Math.ceil(ordered.length / width);
  const grid: CardCell[][] = [];

  for (let row = 0; row < rows; row += 1) {
    grid[row] = ordered.slice(row * width, row * width + width);
  }

  for (let row = 0; row < grid.length; row += 1) {
    const current = grid[row];
    if (current.length !== width) {
      continue;
    }

    const rowComplete = current.every((cell) => cell.marked);
    if (rowComplete) {
      return { isWinner: true, pattern: { type: "row", index: row } };
    }
  }

  for (let column = 0; column < width; column += 1) {
    let columnComplete = true;

    for (let row = 0; row < grid.length; row += 1) {
      if (grid[row].length <= column) {
        columnComplete = false;
        break;
      }

      if (!grid[row][column].marked) {
        columnComplete = false;
        break;
      }
    }

    if (columnComplete) {
      return { isWinner: true, pattern: { type: "column", index: column } };
    }
  }

  if (rows === width) {
    let mainDiag = true;
    let antiDiag = true;

    for (let idx = 0; idx < width; idx += 1) {
      const mainCell = grid[idx][idx];
      const antiCell = grid[idx][width - idx - 1];

      if (!mainCell?.marked) {
        mainDiag = false;
      }

      if (!antiCell?.marked) {
        antiDiag = false;
      }
    }

    if (mainDiag) {
      return { isWinner: true, pattern: { type: "diagonal", direction: "main" } };
    }

    if (antiDiag) {
      return { isWinner: true, pattern: { type: "diagonal", direction: "anti" } };
    }
  }

  return { isWinner: false };
}