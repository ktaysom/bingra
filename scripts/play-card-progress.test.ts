import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateCompletedCellFlags,
  calculateCardProgress,
  type CardCell,
  type RecordedEvent,
} from "../lib/binga/card-progress.ts";

test("team-key matching: match, mismatch, and neutral wildcard", () => {
  const cells: CardCell[] = [
    { event_key: "DOUBLE_DRIBBLE", team_key: "A", point_value: 1 },
    { event_key: "DOUBLE_DRIBBLE", team_key: "B", point_value: 1 },
    { event_key: "DOUBLE_DRIBBLE", team_key: null, point_value: 1 },
  ];

  const events: RecordedEvent[] = [
    { event_key: "DOUBLE_DRIBBLE", team_key: "A" },
  ];

  const flags = calculateCompletedCellFlags(events, cells, "BLACKOUT");

  assert.deepEqual(flags, [true, false, true]);
});

test("streak uses persisted order_index (reordered cells) for progression", () => {
  const cells: CardCell[] = [
    // Inserted in A then B order, but persisted as B first then A.
    { event_key: "EVT_A", team_key: "A", order_index: 1, point_value: 2 },
    { event_key: "EVT_B", team_key: "B", order_index: 0, point_value: 3 },
  ];

  const events: RecordedEvent[] = [
    { event_key: "EVT_B", team_key: "B" },
    { event_key: "EVT_A", team_key: "A" },
  ];

  const flags = calculateCompletedCellFlags(events, cells, "STREAK");
  const progress = calculateCardProgress(events, cells, "STREAK");

  // Both become complete because streak evaluates B(order 0) then A(order 1).
  assert.deepEqual(flags, [true, true]);
  assert.equal(progress.is_complete, true);
  assert.equal(progress.completed_cells_count, 2);
  assert.equal(progress.score, 5);
});
