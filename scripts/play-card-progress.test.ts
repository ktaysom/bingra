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
import { getEventScoreForCell } from "../lib/bingra/game-scoring.ts";
import { buildGameScores } from "../lib/bingra/game-results.ts";
import {
  assertUniqueCardCellEventKeys,
  buildCardCellEventKey,
  parseCardCellEventKey,
} from "../lib/bingra/card-event-key.ts";
import { getEventById } from "../lib/bingra/event-logic.ts";
import { buildEventRecordedItems } from "../lib/bingra/activity-feed";

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

test("threshold scoring applies event max-threshold normalization before multipliers", () => {
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
  // BLOCK and TIMEOUT_TAKEN are capped below 5 for the default basketball profile,
  // so their persisted threshold levels normalize before multiplier scoring.
  assert.equal(progress.score, 38 + 38 + 58);
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

test("college/pro basketball base points are rebalanced for threshold-required-count model", () => {
  const expectedCollege: Record<string, number> = {
    MADE_FREE_THROW: 6,
    THREE_POINTER_MADE: 7,
    AND_ONE_CONVERTED: 15,
    DUNK: 14,
    TECHNICAL_FREE_THROW_MADE: 18,
    BONUS_FREE_THROW_MADE: 8,
    STEAL: 8,
    BLOCK: 10,
    CHARGE_TAKEN: 14,
    CARRY: 16,
    TRAVEL: 8,
    DOUBLE_DRIBBLE: 18,
    ILLEGAL_SCREEN: 12,
    OUT_OF_BOUNDS: 7,
    JUMP_BALL_CALL: 7,
    GOALTENDING: 18,
    THREE_SECOND_CALL: 18,
    FIVE_SECOND_CALL: 20,
    OVER_AND_BACK: 16,
    TIMEOUT_TAKEN: 5,
    EIGHT_SECOND_VIOLATION: 18,
    SHOT_CLOCK_VIOLATION: 14,
  };

  const expectedPro: Record<string, number> = {
    MADE_FREE_THROW: 6,
    THREE_POINTER_MADE: 7,
    AND_ONE_CONVERTED: 14,
    DUNK: 8,
    TECHNICAL_FREE_THROW_MADE: 16,
    BONUS_FREE_THROW_MADE: 7,
    STEAL: 7,
    BLOCK: 9,
    CHARGE_TAKEN: 16,
    CARRY: 14,
    TRAVEL: 10,
    DOUBLE_DRIBBLE: 18,
    ILLEGAL_SCREEN: 12,
    OUT_OF_BOUNDS: 7,
    JUMP_BALL_CALL: 7,
    GOALTENDING: 18,
    THREE_SECOND_CALL: 16,
    FIVE_SECOND_CALL: 22,
    OVER_AND_BACK: 16,
    TIMEOUT_TAKEN: 4,
    EIGHT_SECOND_VIOLATION: 14,
    SHOT_CLOCK_VIOLATION: 12,
  };

  for (const [eventId, points] of Object.entries(expectedCollege)) {
    const event = getEventById(eventId);
    assert.ok(event, `${eventId} should exist`);
    assert.equal(event?.scoringByProfile.basketball_college, points, `${eventId} college points`);
  }

  for (const [eventId, points] of Object.entries(expectedPro)) {
    const event = getEventById(eventId);
    assert.ok(event, `${eventId} should exist`);
    assert.equal(event?.scoringByProfile.basketball_pro, points, `${eventId} pro points`);
  }
});

test("card and leaderboard use identical threshold-adjusted points for made 3PT threshold card cells", () => {
  const acceptedAt = "2026-04-01T10:00:00.000Z";
  const cells: CardCell[] = [
    { event_key: "THREE_POINTER_MADE", team_key: "A", point_value: 7, threshold: 2 },
  ];

  const events: RecordedEvent[] = Array.from({ length: 8 }, (_, index) => ({
    event_key: "THREE_POINTER_MADE",
    team_key: "A",
    created_at: `2026-04-01T10:00:${String(index).padStart(2, "0")}.000Z`,
  }));

  const cellProgress = calculateCardCellProgress(events, cells, "BLACKOUT", "basketball_college");
  assert.equal(cellProgress[0]?.required_count, 8);
  assert.equal(cellProgress[0]?.is_completed, true);

  const cardProgress = calculateCardProgress(events, cells, "BLACKOUT", "basketball_college");
  const eventScore = getEventScoreForCell({
    basePoints: 7,
    thresholdLevel: cellProgress[0]?.threshold ?? 1,
  });

  const leaderboard = buildGameScores({
    players: [{ id: "p1", display_name: "Kyle", created_at: acceptedAt }],
    cards: [{ player_id: "p1", accepted_at: acceptedAt, card_cells: cells }],
    recordedEvents: events,
    completionMode: "BLACKOUT",
    sportProfile: "basketball_college",
    bingraPlayerIds: new Set<string>(),
    bingraCompletedAtByPlayerId: new Map<string, string>(),
  });

  const leaderboardPoints = leaderboard[0]?.raw_points ?? 0;
  const cardPoints = cardProgress.score;

  assert.equal(eventScore.thresholdMultiplier, 2.2);
  assert.equal(eventScore.finalPoints, 15);
  assert.equal(cardPoints, eventScore.finalPoints);
  assert.equal(leaderboardPoints, eventScore.finalPoints);
  assert.equal(cardPoints, leaderboardPoints);
});

test("activity feed shows threshold progress context before completion when progress advances", () => {
  const items = buildEventRecordedItems({
    events: [
      {
        id: "evt-1",
        event_key: "THREE_POINTER_MADE",
        event_label: "Three-pointer made",
        team_key: "A",
        created_at: "2026-04-01T10:00:00.000Z",
      },
    ],
    players: [
      {
        id: "p1",
        display_name: "Ava",
        created_at: "2026-04-01T09:00:00.000Z",
        accepted_at: "2026-04-01T09:30:00.000Z",
      },
    ],
    playerCardsByPlayerId: new Map([
      [
        "p1",
        {
          accepted_at: "2026-04-01T09:30:00.000Z",
          card_cells: [
            { event_key: "THREE_POINTER_MADE", team_key: "A", point_value: 7, threshold: 2 },
          ],
        },
      ],
    ]),
    completionMode: "BLACKOUT",
    teamNames: { A: "Team A", B: "Team B" },
    sportProfile: "basketball_college",
  });

  const recorded = items.find((item) => item.type === "event_recorded");
  assert.ok(recorded);
  assert.equal(recorded?.scoreText, "1 player moved closer on 1 card");
});

test("activity feed threshold-progress context respects team scoping", () => {
  const items = buildEventRecordedItems({
    events: [
      {
        id: "evt-miss",
        event_key: "STEAL",
        event_label: "Steal",
        team_key: "B",
        created_at: "2026-04-01T10:00:00.000Z",
      },
      {
        id: "evt-hit",
        event_key: "STEAL",
        event_label: "Steal",
        team_key: "A",
        created_at: "2026-04-01T10:00:01.000Z",
      },
    ],
    players: [
      {
        id: "p1",
        display_name: "Ava",
        created_at: "2026-04-01T09:00:00.000Z",
        accepted_at: "2026-04-01T09:30:00.000Z",
      },
    ],
    playerCardsByPlayerId: new Map([
      [
        "p1",
        {
          accepted_at: "2026-04-01T09:30:00.000Z",
          card_cells: [
            { event_key: "STEAL", team_key: "A", point_value: 8, threshold: 2 },
          ],
        },
      ],
    ]),
    completionMode: "BLACKOUT",
    teamNames: { A: "Team A", B: "Team B" },
    sportProfile: "basketball_college",
  });

  const recorded = items.filter((item) => item.type === "event_recorded");
  assert.equal(recorded[0]?.scoreText, "No points awarded");
  assert.equal(recorded[1]?.scoreText, "1 player moved closer on 1 card");
});

test("activity feed keeps stronger scoring message on threshold completion", () => {
  const items = buildEventRecordedItems({
    events: [
      {
        id: "evt-1",
        event_key: "TIMEOUT_TAKEN",
        event_label: "Timeout taken",
        team_key: "A",
        created_at: "2026-04-01T10:00:00.000Z",
      },
      {
        id: "evt-2",
        event_key: "TIMEOUT_TAKEN",
        event_label: "Timeout taken",
        team_key: "A",
        created_at: "2026-04-01T10:00:01.000Z",
      },
    ],
    players: [
      {
        id: "p1",
        display_name: "Ava",
        created_at: "2026-04-01T09:00:00.000Z",
        accepted_at: "2026-04-01T09:30:00.000Z",
      },
    ],
    playerCardsByPlayerId: new Map([
      [
        "p1",
        {
          accepted_at: "2026-04-01T09:30:00.000Z",
          card_cells: [
            { event_key: "TIMEOUT_TAKEN", team_key: "A", point_value: 5, threshold: 2 },
          ],
        },
      ],
    ]),
    completionMode: "BLACKOUT",
    teamNames: { A: "Team A", B: "Team B" },
  });

  const recorded = items.filter((item) => item.type === "event_recorded");
  assert.equal(recorded[0]?.scoreText, "1 player moved closer on 1 card");
  assert.ok((recorded[1]?.scoreText ?? "").startsWith("+"));
});
