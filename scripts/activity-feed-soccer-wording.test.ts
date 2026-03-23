import test from "node:test";
import assert from "node:assert/strict";

import { resolveRecordedEventDisplayName } from "../lib/bingra/activity-feed";

const TEAM_NAMES = {
  A: "Team A",
  B: "Team B",
} as const;

test("soccer compatibility wording uses beneficiary/credited semantics for restarts", () => {
  assert.equal(
    resolveRecordedEventDisplayName({
      eventKey: "OUT_OF_BOUNDS_THROW_IN",
      eventLabel: null,
      teamKey: "B",
      teamNames: TEAM_NAMES,
      sportProfile: "soccer_youth",
    }),
    "Throw-in for Team B",
  );

  assert.equal(
    resolveRecordedEventDisplayName({
      eventKey: "OUT_OF_BOUNDS_GOAL_KICK",
      eventLabel: null,
      teamKey: "A",
      teamNames: TEAM_NAMES,
      sportProfile: "soccer_youth",
    }),
    "Goal kick for Team A",
  );

  assert.equal(
    resolveRecordedEventDisplayName({
      eventKey: "OUT_OF_BOUNDS_CORNER",
      eventLabel: null,
      teamKey: "B",
      teamNames: TEAM_NAMES,
      sportProfile: "soccer_youth",
    }),
    "Corner kick for Team B",
  );
});

test("soccer compatibility wording avoids implying unknown causing team", () => {
  assert.equal(
    resolveRecordedEventDisplayName({
      eventKey: "FOUL",
      eventLabel: null,
      teamKey: "A",
      teamNames: TEAM_NAMES,
      sportProfile: "soccer_high_school",
    }),
    "Foul on Team A",
  );

  assert.equal(
    resolveRecordedEventDisplayName({
      eventKey: "HANDBALL_CALL",
      eventLabel: null,
      teamKey: "B",
      teamNames: TEAM_NAMES,
      sportProfile: "soccer_high_school",
    }),
    "Handball against Team B",
  );

  assert.equal(
    resolveRecordedEventDisplayName({
      eventKey: "LIVE_BALL_TURNOVER",
      eventLabel: null,
      teamKey: "A",
      teamNames: TEAM_NAMES,
      sportProfile: "soccer_high_school",
    }),
    "Turnover won by Team A",
  );
});

test("soccer wording is explicit for defensive shot outcomes and discipline", () => {
  assert.equal(
    resolveRecordedEventDisplayName({
      eventKey: "SHOT_ON_GOAL_SAVE",
      eventLabel: null,
      teamKey: "B",
      teamNames: TEAM_NAMES,
      sportProfile: "soccer_youth",
    }),
    "Save by Team B",
  );

  assert.equal(
    resolveRecordedEventDisplayName({
      eventKey: "SHOT_ON_GOAL_BLOCKED",
      eventLabel: null,
      teamKey: "A",
      teamNames: TEAM_NAMES,
      sportProfile: "soccer_youth",
    }),
    "Shot blocked by Team A",
  );

  assert.equal(
    resolveRecordedEventDisplayName({
      eventKey: "YELLOW_CARD",
      eventLabel: null,
      teamKey: "A",
      teamNames: TEAM_NAMES,
      sportProfile: "soccer_youth",
    }),
    "Yellow card to Team A",
  );

  assert.equal(
    resolveRecordedEventDisplayName({
      eventKey: "RED_CARD",
      eventLabel: null,
      teamKey: "B",
      teamNames: TEAM_NAMES,
      sportProfile: "soccer_youth",
    }),
    "Red card to Team B",
  );
});

test("soccer goal and shot-off-target wording matches credited team semantics", () => {
  assert.equal(
    resolveRecordedEventDisplayName({
      eventKey: "SHOT_ON_GOAL_GOAL",
      eventLabel: null,
      teamKey: "A",
      teamNames: TEAM_NAMES,
      sportProfile: "soccer_youth",
    }),
    "Goal by Team A",
  );

  assert.equal(
    resolveRecordedEventDisplayName({
      eventKey: "SHOT_OFF_TARGET",
      eventLabel: null,
      teamKey: "B",
      teamNames: TEAM_NAMES,
      sportProfile: "soccer_youth",
    }),
    "Shot off target by Team B",
  );
});

test("basketball wording remains unchanged", () => {
  assert.equal(
    resolveRecordedEventDisplayName({
      eventKey: "STEAL",
      eventLabel: null,
      teamKey: "A",
      teamNames: TEAM_NAMES,
      sportProfile: "basketball_high_school",
    }),
    "Team A: Steal",
  );
});
