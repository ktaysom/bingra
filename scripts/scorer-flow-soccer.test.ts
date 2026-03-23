import test from "node:test";
import assert from "node:assert/strict";

import {
  getEventById,
  getEventsForMode,
  getScorerEventsForParent,
  getScorerParentOptions,
  getScorerSubtypeOptions,
} from "../lib/bingra/event-logic.ts";

const SOCCER_EVENT_IDS = [
  "ANY_GOAL",
  "SHOT_ON_GOAL_GOAL",
  "SHOT_ON_GOAL_ASSISTED_GOAL",
  "SHOT_ON_GOAL_GOAL_OFF_REBOUND",
  "SHOT_ON_GOAL_SAVE",
  "SHOT_ON_GOAL_BLOCKED",
  "SHOT_ON_GOAL_HIT_POST_CROSSBAR",
  "SHOT_OFF_TARGET",
  "OUT_OF_BOUNDS_THROW_IN",
  "OUT_OF_BOUNDS_CORNER",
  "OUT_OF_BOUNDS_GOAL_KICK",
  "FOUL",
  "HANDBALL_CALL",
  "LIVE_BALL_TURNOVER",
  "YELLOW_CARD",
  "RED_CARD",
] as const;

const REMOVED_SOCCER_EVENT_IDS = [
  "BALL_HANDLER_FALLS_DOWN",
  "GOALIE_PUNT_PAST_MIDFIELD",
] as const;

test("soccer profiles are accepted by event filtering", () => {
  const youth = getEventsForMode("classic", "soccer_youth");
  const highSchool = getEventsForMode("classic", "soccer_high_school");

  assert.ok(youth.length > 0);
  assert.ok(highSchool.length > 0);
  assert.ok(youth.some((event) => event.id === "SHOT_ON_GOAL_GOAL"));
  assert.ok(highSchool.some((event) => event.id === "SHOT_ON_GOAL_GOAL"));
});

test("soccer events only appear for soccer profiles", () => {
  const soccerIds = new Set(getEventsForMode("classic", "soccer_youth").map((event) => event.id));
  const basketballIds = new Set(
    getEventsForMode("classic", "basketball_high_school").map((event) => event.id),
  );

  for (const eventId of SOCCER_EVENT_IDS) {
    assert.ok(soccerIds.has(eventId), `${eventId} should be enabled for soccer`);
    assert.equal(basketballIds.has(eventId), false, `${eventId} should not be enabled for basketball`);
  }
});

test("dropped soccer events are no longer selectable in soccer event pools", () => {
  const soccerIds = new Set(getEventsForMode("classic", "soccer_youth").map((event) => event.id));

  for (const eventId of REMOVED_SOCCER_EVENT_IDS) {
    assert.equal(soccerIds.has(eventId), false, `${eventId} should be removed from soccer pools`);
  }
});

test("basketball events remain basketball-only", () => {
  const basketballIds = new Set(
    getEventsForMode("classic", "basketball_high_school").map((event) => event.id),
  );
  const soccerIds = new Set(getEventsForMode("classic", "soccer_youth").map((event) => event.id));

  for (const eventId of ["MADE_FREE_THROW", "STEAL"] as const) {
    assert.ok(basketballIds.has(eventId));
    assert.equal(soccerIds.has(eventId), false);
  }
});

test("TIMEOUT_TAKEN is available for both basketball and soccer", () => {
  const basketballIds = new Set(
    getEventsForMode("classic", "basketball_high_school").map((event) => event.id),
  );
  const soccerIds = new Set(getEventsForMode("classic", "soccer_youth").map((event) => event.id));

  assert.equal(basketballIds.has("TIMEOUT_TAKEN"), true);
  assert.equal(soccerIds.has("TIMEOUT_TAKEN"), true);
});

test("ANY_GOAL stays in soccer catalog pool but is hidden from host scorer", () => {
  const anyGoal = getEventById("ANY_GOAL");
  assert.ok(anyGoal);
  assert.equal(anyGoal?.enabled, true);
  assert.deepEqual(anyGoal?.enabledProfiles, ["soccer_youth", "soccer_high_school"]);
  assert.equal(anyGoal?.scorerEnabled, false);

  const soccerEventIds = new Set(getEventsForMode("classic", "soccer_youth").map((event) => event.id));
  assert.ok(soccerEventIds.has("ANY_GOAL"));

  const scoreOptions = getScorerEventsForParent("score", "classic", "soccer_youth");
  assert.equal(scoreOptions.some((option) => option.id === "ANY_GOAL"), false);
});

test("soccer scorer parent options resolve with sport-aware labels", () => {
  const options = getScorerParentOptions("classic", "soccer_youth");
  const labelsById = new Map(options.map((option) => [option.id, option.label]));

  assert.equal(labelsById.get("change-of-possession"), "Change of possession");
  assert.equal(labelsById.get("score"), "Score");
  assert.equal(labelsById.get("misc"), "Misc");
});

test("soccer subtype flows resolve for score and change-of-possession", () => {
  const scoreOptions = getScorerEventsForParent("score", "classic", "soccer_youth");
  const copOptions = getScorerEventsForParent("change-of-possession", "classic", "soccer_youth");

  assert.ok(
    scoreOptions.some(
      (option) => option.subtypeGroup === "soccer-shot-on-goal" && option.label === "Shot on goal",
    ),
  );
  assert.ok(
    copOptions.some(
      (option) => option.subtypeGroup === "soccer-out-of-bounds" && option.label === "Out of bounds",
    ),
  );
});

test("SHOT_OFF_TARGET is direct score event, not part of shot-on-goal subtype flow", () => {
  const scoreOptions = getScorerEventsForParent("score", "classic", "soccer_youth");
  assert.ok(scoreOptions.some((option) => option.id === "SHOT_OFF_TARGET"));

  const shotOnGoalSubtypes = getScorerSubtypeOptions(
    "soccer-shot-on-goal",
    "classic",
    "soccer_youth",
  );
  assert.equal(shotOnGoalSubtypes.some((option) => option.id === "SHOT_OFF_TARGET"), false);
});

test("basketball free-throw scorer subtype flow still works", () => {
  const scoreOptions = getScorerEventsForParent("score", "classic", "basketball_high_school");
  assert.ok(
    scoreOptions.some((option) => option.subtypeGroup === "free-throw" && option.label === "Made free throw"),
  );

  const freeThrowSubtypes = getScorerSubtypeOptions("free-throw", "classic", "basketball_high_school");
  assert.ok(freeThrowSubtypes.some((option) => option.id === "MADE_FREE_THROW"));
});

test("basketball scorer parent labels remain unchanged", () => {
  const options = getScorerParentOptions("classic", "basketball_high_school");
  const labelsById = new Map(options.map((option) => [option.id, option.label]));

  assert.equal(labelsById.get("misc"), "Time Out");
});
