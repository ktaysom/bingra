import test from "node:test";
import assert from "node:assert/strict";

import {
  getScopedTeamForGameTeamScope,
  resolveSoccerShotBackFromAction,
  resolveSoccerShotFlowStart,
} from "../lib/bingra/host-scoring-soccer-flow.ts";

test("soccer shot flow starts with team selection for both-team games", () => {
  const result = resolveSoccerShotFlowStart("both_teams");

  assert.deepEqual(result, {
    stage: "soccer-team",
    selectedTeamKey: null,
  });
});

test("soccer shot flow skips team selection for scoped-team games", () => {
  assert.deepEqual(resolveSoccerShotFlowStart("team_a_only"), {
    stage: "soccer-action",
    selectedTeamKey: "A",
  });

  assert.deepEqual(resolveSoccerShotFlowStart("team_b_only"), {
    stage: "soccer-action",
    selectedTeamKey: "B",
  });
});

test("backing out of soccer shot outcomes clears remembered shot team", () => {
  assert.deepEqual(resolveSoccerShotBackFromAction("both_teams"), {
    stage: "soccer-team",
    selectedTeamKey: null,
  });

  assert.deepEqual(resolveSoccerShotBackFromAction("team_a_only"), {
    stage: "soccer-parent",
    selectedTeamKey: null,
  });
});

test("scoped-team resolution matches host scorer expectations", () => {
  assert.equal(getScopedTeamForGameTeamScope("both_teams"), null);
  assert.equal(getScopedTeamForGameTeamScope("team_a_only"), "A");
  assert.equal(getScopedTeamForGameTeamScope("team_b_only"), "B");
});
