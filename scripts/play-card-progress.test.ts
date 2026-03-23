import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateCardCellProgress,
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
    { event_key: "DOUBLE_DRIBBLE", team_key: "A", point_value: 1, threshold: 1 },
    { event_key: "DOUBLE_DRIBBLE", team_key: "B", point_value: 1, threshold: 1 },
    { event_key: "DOUBLE_DRIBBLE", team_key: null, point_value: 1, threshold: 1 },
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
    { event_key: "EVT_A", team_key: "A", order_index: 1, point_value: 2, threshold: 1 },
    { event_key: "EVT_B", team_key: "B", order_index: 0, point_value: 3, threshold: 1 },
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
    { event_key: "AND_ONE_CONVERTED:A", team_key: "A", point_value: 1, threshold: 1 },
    { event_key: "AND_ONE_CONVERTED:B", team_key: "B", point_value: 1, threshold: 1 },
  ];

  const events: RecordedEvent[] = [
    { event_key: "AND_ONE_CONVERTED", team_key: "A" },
  ];

  const flags = calculateCompletedCellFlags(events, cells, "BLACKOUT");
  assert.deepEqual(flags, [true, false]);
});

test("team B recorded event marks only EVENT:B cell", () => {
  const cells: CardCell[] = [
    { event_key: "AND_ONE_CONVERTED:A", team_key: "A", point_value: 1, threshold: 1 },
    { event_key: "AND_ONE_CONVERTED:B", team_key: "B", point_value: 1, threshold: 1 },
  ];

  const events: RecordedEvent[] = [
    { event_key: "AND_ONE_CONVERTED", team_key: "B" },
  ];

  const flags = calculateCompletedCellFlags(events, cells, "BLACKOUT");
  assert.deepEqual(flags, [false, true]);
});

test("ANY_GOAL cell is completed by soccer goal outcome subtypes", () => {
  const cells: CardCell[] = [
    { event_key: "ANY_GOAL", team_key: null, point_value: 1, threshold: 1 },
  ];

  const assistedGoal: RecordedEvent[] = [{ event_key: "SHOT_ON_GOAL_ASSISTED_GOAL", team_key: "A" }];
  const reboundGoal: RecordedEvent[] = [{ event_key: "SHOT_ON_GOAL_GOAL_OFF_REBOUND", team_key: "A" }];
  const directGoal: RecordedEvent[] = [{ event_key: "SHOT_ON_GOAL_GOAL", team_key: "A" }];

  assert.deepEqual(calculateCompletedCellFlags(assistedGoal, cells, "BLACKOUT"), [true]);
  assert.deepEqual(calculateCompletedCellFlags(reboundGoal, cells, "BLACKOUT"), [true]);
  assert.deepEqual(calculateCompletedCellFlags(directGoal, cells, "BLACKOUT"), [true]);
});

test("ANY_GOAL team-qualified cell still requires matching team", () => {
  const cells: CardCell[] = [
    { event_key: "ANY_GOAL", team_key: "A", point_value: 1, threshold: 1 },
  ];

  const matchingTeam: RecordedEvent[] = [{ event_key: "SHOT_ON_GOAL_GOAL", team_key: "A" }];
  const nonMatchingTeam: RecordedEvent[] = [{ event_key: "SHOT_ON_GOAL_GOAL", team_key: "B" }];

  assert.deepEqual(calculateCompletedCellFlags(matchingTeam, cells, "BLACKOUT"), [true]);
  assert.deepEqual(calculateCompletedCellFlags(nonMatchingTeam, cells, "BLACKOUT"), [false]);
});

test("ANY_GOAL does not match non-goal soccer outcomes", () => {
  const cells: CardCell[] = [
    { event_key: "ANY_GOAL", team_key: null, point_value: 1, threshold: 1 },
  ];

  const notGoalEvents: RecordedEvent[] = [
    { event_key: "SHOT_ON_GOAL_SAVE", team_key: "B" },
    { event_key: "SHOT_ON_GOAL_BLOCKED", team_key: "B" },
    { event_key: "SHOT_OFF_TARGET", team_key: "A" },
  ];

  assert.deepEqual(calculateCompletedCellFlags(notGoalEvents, cells, "BLACKOUT"), [false]);
});

test("non-team-scoped event behavior remains unchanged", () => {
  const cells: CardCell[] = [
    { event_key: "JUMP_BALL_CALL", team_key: null, point_value: 2, threshold: 1 },
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

test("threshold=1 keeps legacy boolean completion behavior", () => {
  const cells: CardCell[] = [
    { event_key: "STEAL", team_key: "A", point_value: 2, threshold: 1 },
  ];
  const events: RecordedEvent[] = [
    { event_key: "STEAL", team_key: "A" },
  ];

  const cellProgress = calculateCardCellProgress(events, cells, "BLACKOUT");
  const progress = calculateCardProgress(events, cells, "BLACKOUT");

  assert.equal(cellProgress[0]?.current_count, 1);
  assert.equal(cellProgress[0]?.threshold, 1);
  assert.equal(cellProgress[0]?.remaining_count, 0);
  assert.equal(cellProgress[0]?.is_completed, true);
  assert.equal(progress.is_complete, true);
});

test("threshold=2 requires two matching events", () => {
  const cells: CardCell[] = [
    { event_key: "TIMEOUT_TAKEN", team_key: "A", point_value: 5, threshold: 2 },
  ];
  const oneEvent: RecordedEvent[] = [{ event_key: "TIMEOUT_TAKEN", team_key: "A" }];
  const twoEvents: RecordedEvent[] = [
    { event_key: "TIMEOUT_TAKEN", team_key: "A" },
    { event_key: "TIMEOUT_TAKEN", team_key: "A" },
  ];

  const before = calculateCardProgress(oneEvent, cells, "BLACKOUT");
  const after = calculateCardProgress(twoEvents, cells, "BLACKOUT");

  assert.equal(before.is_complete, false);
  assert.equal(before.cell_progress[0]?.current_count, 1);
  assert.equal(before.cell_progress[0]?.remaining_count, 1);
  assert.equal(after.is_complete, true);
  assert.equal(after.cell_progress[0]?.current_count, 2);
  assert.equal(after.cell_progress[0]?.remaining_count, 0);
});

test("removal/rollback: dropping a matching event can revert completion", () => {
  const cells: CardCell[] = [
    { event_key: "BONUS_FREE_THROW_MADE", team_key: "A", point_value: 3, threshold: 2 },
  ];
  const beforeRemoval: RecordedEvent[] = [
    { event_key: "BONUS_FREE_THROW_MADE", team_key: "A" },
    { event_key: "BONUS_FREE_THROW_MADE", team_key: "A" },
  ];
  const afterRemoval: RecordedEvent[] = [
    { event_key: "BONUS_FREE_THROW_MADE", team_key: "A" },
  ];

  const complete = calculateCardProgress(beforeRemoval, cells, "BLACKOUT");
  const rolledBack = calculateCardProgress(afterRemoval, cells, "BLACKOUT");

  assert.equal(complete.is_complete, true);
  assert.equal(rolledBack.is_complete, false);
  assert.equal(rolledBack.cell_progress[0]?.remaining_count, 1);
});

test("team-scoped threshold counting keeps team matching strict", () => {
  const cells: CardCell[] = [
    { event_key: "STEAL", team_key: "A", point_value: 2, threshold: 2 },
  ];
  const events: RecordedEvent[] = [
    { event_key: "STEAL", team_key: "A" },
    { event_key: "STEAL", team_key: "B" },
    { event_key: "STEAL", team_key: "A" },
  ];

  const progress = calculateCardProgress(events, cells, "BLACKOUT");

  assert.equal(progress.cell_progress[0]?.current_count, 2);
  assert.equal(progress.cell_progress[0]?.is_completed, true);
});

test("teamless threshold counting keeps wildcard team behavior", () => {
  const cells: CardCell[] = [
    { event_key: "JUMP_BALL_CALL", team_key: null, point_value: 2, threshold: 2 },
  ];
  const events: RecordedEvent[] = [
    { event_key: "JUMP_BALL_CALL", team_key: "A" },
    { event_key: "JUMP_BALL_CALL", team_key: "B" },
  ];

  const progress = calculateCardProgress(events, cells, "BLACKOUT");

  assert.equal(progress.cell_progress[0]?.current_count, 2);
  assert.equal(progress.cell_progress[0]?.is_completed, true);
});

test("threshold=1 keeps legacy points", () => {
  const cells: CardCell[] = [
    { event_key: "STEAL", team_key: "A", point_value: 10, threshold: 1 },
  ];
  const events: RecordedEvent[] = [
    { event_key: "STEAL", team_key: "A" },
  ];

  const progress = calculateCardProgress(events, cells, "BLACKOUT");
  assert.equal(progress.score, 10);
});

test("threshold=2 increases points using escalation multiplier", () => {
  const cells: CardCell[] = [
    { event_key: "STEAL", team_key: "A", point_value: 10, threshold: 2 },
  ];
  const events: RecordedEvent[] = [
    { event_key: "STEAL", team_key: "A" },
    { event_key: "STEAL", team_key: "A" },
  ];

  const progress = calculateCardProgress(events, cells, "BLACKOUT");
  assert.equal(progress.score, 22);
});

test("threshold 3/4/5 use expected escalation multipliers", () => {
  const cells: CardCell[] = [
    { event_key: "STEAL", team_key: "A", point_value: 10, threshold: 3 },
    { event_key: "BLOCK", team_key: "A", point_value: 10, threshold: 4 },
    { event_key: "TIMEOUT_TAKEN", team_key: "A", point_value: 10, threshold: 5 },
  ];
  const events: RecordedEvent[] = [
    { event_key: "STEAL", team_key: "A" },
    { event_key: "STEAL", team_key: "A" },
    { event_key: "STEAL", team_key: "A" },
    { event_key: "BLOCK", team_key: "A" },
    { event_key: "BLOCK", team_key: "A" },
    { event_key: "BLOCK", team_key: "A" },
    { event_key: "BLOCK", team_key: "A" },
    { event_key: "TIMEOUT_TAKEN", team_key: "A" },
    { event_key: "TIMEOUT_TAKEN", team_key: "A" },
    { event_key: "TIMEOUT_TAKEN", team_key: "A" },
    { event_key: "TIMEOUT_TAKEN", team_key: "A" },
    { event_key: "TIMEOUT_TAKEN", team_key: "A" },
  ];

  const progress = calculateCardProgress(events, cells, "BLACKOUT");
  assert.equal(progress.score, 38 + 58 + 80);
});

test("thresholds above 5 are deterministic (clamped to 5)", () => {
  const cells: CardCell[] = [
    { event_key: "STEAL", team_key: "A", point_value: 10, threshold: 8 },
  ];
  const events: RecordedEvent[] = [
    { event_key: "STEAL", team_key: "A" },
    { event_key: "STEAL", team_key: "A" },
    { event_key: "STEAL", team_key: "A" },
    { event_key: "STEAL", team_key: "A" },
    { event_key: "STEAL", team_key: "A" },
    { event_key: "STEAL", team_key: "A" },
    { event_key: "STEAL", team_key: "A" },
    { event_key: "STEAL", team_key: "A" },
  ];

  const progress = calculateCardProgress(events, cells, "BLACKOUT");
  assert.equal(progress.score, 80);
});
