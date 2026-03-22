import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateCompletedCellFlags,
  calculateCardProgress,
  filterRecordedEventsByAcceptedAt,
  type CardCell,
  type RecordedEvent,
} from "../lib/bingra/card-progress.ts";
import {
  assertUniqueCardCellEventKeys,
  buildCardCellEventKey,
  parseCardCellEventKey,
} from "../lib/bingra/card-event-key.ts";

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

test("qualified card event keys keep same base event distinct by team", () => {
  const cells: CardCell[] = [
    { event_key: "AND_ONE_CONVERTED:A", team_key: "A", point_value: 1 },
    { event_key: "AND_ONE_CONVERTED:B", team_key: "B", point_value: 1 },
  ];

  const events: RecordedEvent[] = [
    { event_key: "AND_ONE_CONVERTED", team_key: "A" },
  ];

  const flags = calculateCompletedCellFlags(events, cells, "BLACKOUT");
  assert.deepEqual(flags, [true, false]);
});

test("team B recorded event marks only EVENT:B cell", () => {
  const cells: CardCell[] = [
    { event_key: "AND_ONE_CONVERTED:A", team_key: "A", point_value: 1 },
    { event_key: "AND_ONE_CONVERTED:B", team_key: "B", point_value: 1 },
  ];

  const events: RecordedEvent[] = [
    { event_key: "AND_ONE_CONVERTED", team_key: "B" },
  ];

  const flags = calculateCompletedCellFlags(events, cells, "BLACKOUT");
  assert.deepEqual(flags, [false, true]);
});

test("non-team-scoped event behavior remains unchanged", () => {
  const cells: CardCell[] = [
    { event_key: "JUMP_BALL_CALL", team_key: null, point_value: 2 },
  ];

  const events: RecordedEvent[] = [
    { event_key: "JUMP_BALL_CALL", team_key: null },
  ];

  const flags = calculateCompletedCellFlags(events, cells, "BLACKOUT");
  const progress = calculateCardProgress(events, cells, "BLACKOUT");

  assert.deepEqual(flags, [true]);
  assert.equal(progress.completed_cells_count, 1);
  assert.equal(progress.score, 2);
});

test("qualified key parse supports persisted reload of accepted card cells", () => {
  const persistedEventKey = buildCardCellEventKey("AND_ONE_CONVERTED", "A");
  const parsed = parseCardCellEventKey(persistedEventKey);

  assert.equal(parsed.baseEventKey, "AND_ONE_CONVERTED");
  assert.equal(parsed.qualifiedTeamKey, "A");
});

test("duplicate card event key guard throws when two cells collapse to same key", () => {
  const keys = [
    buildCardCellEventKey("AND_ONE_CONVERTED", "A"),
    buildCardCellEventKey("AND_ONE_CONVERTED", "B"),
  ];

  assert.doesNotThrow(() => assertUniqueCardCellEventKeys(keys));

  assert.throws(
    () =>
      assertUniqueCardCellEventKeys([
        "AND_ONE_CONVERTED",
        "AND_ONE_CONVERTED",
      ]),
    /Duplicate card cell event keys are not allowed/,
  );
});

test("accepted_at gating includes only events at/after accepted_at", () => {
  const acceptedAt = "2026-03-22T11:00:00.123Z";
  const events: RecordedEvent[] = [
    { event_key: "A", created_at: "2026-03-22T11:00:00.122Z" },
    { event_key: "B", created_at: "2026-03-22T11:00:00.123Z" },
    { event_key: "C", created_at: "2026-03-22T11:00:00.124Z" },
  ];

  const eligible = filterRecordedEventsByAcceptedAt(events, acceptedAt);
  assert.deepEqual(eligible.map((event) => event.event_key), ["B", "C"]);
});

test("accepted_at gating safely handles invalid timestamps", () => {
  const acceptedAt = "not-a-time";
  const events: RecordedEvent[] = [
    { event_key: "A", created_at: "2026-03-22T11:00:00.123Z" },
  ];

  const eligible = filterRecordedEventsByAcceptedAt(events, acceptedAt);
  assert.deepEqual(eligible, []);
});
