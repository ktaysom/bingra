import test from "node:test";
import assert from "node:assert/strict";

import {
  interpretSoccerScoringInput,
  SOCCER_CAUSE_TYPES,
  SOCCER_OUTCOME_TYPES,
} from "../lib/bingra/soccer-scoring";
import { calculateCardProgress, type CardCell } from "../lib/bingra/card-progress";

test("soccer interpretation preserves legacy compatibility mode", () => {
  const result = interpretSoccerScoringInput({
    legacyEventKey: "FOUL",
    legacyTeamKey: "A",
  });

  assert.equal(result.eventKey, "FOUL");
  assert.equal(result.compatibilityTeamKey, "A");
  assert.equal(result.metadata, null);
});

test("out_of_bounds + throw_in maps to throw-in event and derived beneficiary", () => {
  const result = interpretSoccerScoringInput({
    causeType: "out_of_bounds",
    outcomeType: "throw_in",
    causingTeamKey: "A",
  });

  assert.equal(result.eventKey, "OUT_OF_BOUNDS_THROW_IN");
  assert.equal(result.compatibilityTeamKey, "B");
  assert.equal(result.metadata?.beneficiaryTeamKey, "B");
  assert.equal(result.metadata?.beneficiaryDerivation, "derived");
});

test("shot_on_goal + save maps to save event and defense beneficiary", () => {
  const result = interpretSoccerScoringInput({
    causeType: "shot_on_goal",
    outcomeType: "save",
    causingTeamKey: "A",
  });

  assert.equal(result.eventKey, "SHOT_ON_GOAL_SAVE");
  assert.equal(result.compatibilityTeamKey, "B");
});

test("out_of_bounds + corner_kick credits restart beneficiary (opposite of causing team)", () => {
  const result = interpretSoccerScoringInput({
    causeType: "out_of_bounds",
    outcomeType: "corner_kick",
    causingTeamKey: "B",
  });

  assert.equal(result.eventKey, "OUT_OF_BOUNDS_CORNER");
  assert.equal(result.compatibilityTeamKey, "A");
});

test("foul and handball credit the non-committing team under compatibility team mapping", () => {
  const foul = interpretSoccerScoringInput({
    causeType: "foul",
    causingTeamKey: "A",
  });
  const handball = interpretSoccerScoringInput({
    causeType: "handball",
    causingTeamKey: "B",
  });

  assert.equal(foul.eventKey, "FOUL");
  assert.equal(foul.compatibilityTeamKey, "B");

  assert.equal(handball.eventKey, "HANDBALL_CALL");
  assert.equal(handball.compatibilityTeamKey, "A");
});

test("live_ball_turnover credits the team that gains possession", () => {
  const result = interpretSoccerScoringInput({
    causeType: "live_ball_turnover",
    causingTeamKey: "A",
  });

  assert.equal(result.eventKey, "LIVE_BALL_TURNOVER");
  assert.equal(result.compatibilityTeamKey, "B");
});

test("shot_on_goal outcomes credit offense for goals and defense for saves/blocks", () => {
  const goal = interpretSoccerScoringInput({
    causeType: "shot_on_goal",
    outcomeType: "goal",
    causingTeamKey: "A",
  });
  const assistedGoal = interpretSoccerScoringInput({
    causeType: "shot_on_goal",
    outcomeType: "assisted_goal",
    causingTeamKey: "A",
  });
  const reboundGoal = interpretSoccerScoringInput({
    causeType: "shot_on_goal",
    outcomeType: "goal_off_rebound",
    causingTeamKey: "A",
  });
  const blocked = interpretSoccerScoringInput({
    causeType: "shot_on_goal",
    outcomeType: "blocked",
    causingTeamKey: "A",
  });
  const post = interpretSoccerScoringInput({
    causeType: "shot_on_goal",
    outcomeType: "hit_post_crossbar",
    causingTeamKey: "A",
  });

  assert.equal(goal.eventKey, "SHOT_ON_GOAL_GOAL");
  assert.equal(goal.compatibilityTeamKey, "A");
  assert.equal(assistedGoal.compatibilityTeamKey, "A");
  assert.equal(reboundGoal.compatibilityTeamKey, "A");
  assert.equal(blocked.compatibilityTeamKey, "B");
  assert.equal(post.compatibilityTeamKey, "A");
});

test("shot_off_target credits the shooting team", () => {
  const result = interpretSoccerScoringInput({
    causeType: "shot_off_target",
    causingTeamKey: "B",
  });

  assert.equal(result.eventKey, "SHOT_OFF_TARGET");
  assert.equal(result.compatibilityTeamKey, "B");
});

test("legacy disciplinary events stay explicit-team compatibility events", () => {
  const yellow = interpretSoccerScoringInput({
    legacyEventKey: "YELLOW_CARD",
    legacyTeamKey: "A",
  });
  const red = interpretSoccerScoringInput({
    legacyEventKey: "RED_CARD",
    legacyTeamKey: "B",
  });

  assert.equal(yellow.eventKey, "YELLOW_CARD");
  assert.equal(yellow.compatibilityTeamKey, "A");
  assert.equal(red.eventKey, "RED_CARD");
  assert.equal(red.compatibilityTeamKey, "B");
});

test("card progress attribution uses compatibility team for soccer beneficiary-credit flows", () => {
  const foul = interpretSoccerScoringInput({
    causeType: "foul",
    causingTeamKey: "A",
  });
  const save = interpretSoccerScoringInput({
    causeType: "shot_on_goal",
    outcomeType: "save",
    causingTeamKey: "A",
  });
  const offTarget = interpretSoccerScoringInput({
    causeType: "shot_off_target",
    causingTeamKey: "A",
  });

  const recordedEvents = [foul, save, offTarget].map((item) => ({
    event_key: item.eventKey,
    team_key: item.compatibilityTeamKey,
  }));

  const cardCells: CardCell[] = [
    { event_key: "FOUL", team_key: "B", threshold: 1, point_value: 5 },
    { event_key: "SHOT_ON_GOAL_SAVE", team_key: "B", threshold: 1, point_value: 5 },
    { event_key: "SHOT_OFF_TARGET", team_key: "A", threshold: 1, point_value: 5 },
  ];

  const progress = calculateCardProgress(recordedEvents, cardCells, "BLACKOUT");
  assert.equal(progress.completed_cells_count, 3);
  assert.equal(progress.is_complete, true);
});

test("explicit beneficiary overrides derived beneficiary", () => {
  const result = interpretSoccerScoringInput({
    causeType: "out_of_bounds",
    outcomeType: "corner_kick",
    causingTeamKey: "A",
    beneficiaryTeamKey: "A",
  });

  assert.equal(result.eventKey, "OUT_OF_BOUNDS_CORNER");
  assert.equal(result.compatibilityTeamKey, "A");
  assert.equal(result.metadata?.beneficiaryDerivation, "explicit");
});

test("soccer cause/outcome constants expose expected base values", () => {
  assert.ok(SOCCER_CAUSE_TYPES.includes("out_of_bounds"));
  assert.ok(SOCCER_CAUSE_TYPES.includes("shot_on_goal"));
  assert.ok(SOCCER_OUTCOME_TYPES.includes("throw_in"));
  assert.ok(SOCCER_OUTCOME_TYPES.includes("goal"));
});
