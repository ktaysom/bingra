import test from "node:test";
import assert from "node:assert/strict";

import { resolveCreateGameSport } from "../lib/bingra/create-game-payload";
import {
  chooseRandomEvents,
  getEventsForMode,
  getScorerEventsForParent,
  getScorerParentOptions,
} from "../lib/bingra/event-logic";

test("create payload resolves soccer sport for soccer_youth and soccer_high_school", () => {
  assert.equal(resolveCreateGameSport("soccer_youth"), "soccer");
  assert.equal(resolveCreateGameSport("soccer_high_school"), "soccer");

  // Guard basketball mapping remains unchanged.
  assert.equal(resolveCreateGameSport("basketball_high_school"), "basketball");
});

test("soccer profile event pools load for initial play setup", () => {
  for (const profile of ["soccer_youth", "soccer_high_school"] as const) {
    const modeEvents = getEventsForMode("classic", profile);

    assert.ok(modeEvents.length > 0, `${profile} should have loadable classic-mode events`);
    assert.ok(
      modeEvents.some((event) => event.id === "ANY_GOAL"),
      `${profile} should include ANY_GOAL in card/event pool`,
    );

    const seededCard = chooseRandomEvents(8, {
      mode: "classic",
      riskLevel: 3,
      uniqueByEventId: true,
      includeGameScopedEvents: true,
      profile,
    });

    assert.ok(seededCard.length > 0, `${profile} should be able to generate initial card events`);
  }
});

test("soccer scorer structures load and keep ANY_GOAL hidden from score parent", () => {
  for (const profile of ["soccer_youth", "soccer_high_school"] as const) {
    const parentOptions = getScorerParentOptions("classic", profile);
    assert.ok(parentOptions.some((option) => option.id === "score"));
    assert.ok(parentOptions.some((option) => option.id === "change-of-possession"));
    assert.ok(parentOptions.some((option) => option.id === "misc"));

    const scoreOptions = getScorerEventsForParent("score", "classic", profile);
    assert.ok(scoreOptions.length > 0, `${profile} should have score options`);
    assert.equal(
      scoreOptions.some((option) => option.id === "ANY_GOAL"),
      false,
      `${profile} score options should not show ANY_GOAL`,
    );
  }
});
