import test from "node:test";
import assert from "node:assert/strict";

import { buildCardCellsPayload } from "../lib/bingra/card-cells-payload";

test("buildCardCellsPayload persists provided threshold values", () => {
  const cells = buildCardCellsPayload({
    cardId: "card-123",
    acceptedEvents: [
      {
        eventKey: "TRAVEL",
        eventLabel: "Travel",
        pointValue: 20,
        threshold: 2,
        team: null,
      },
      {
        eventKey: "BLOCK:A",
        eventLabel: "Block",
        pointValue: 20,
        threshold: 3,
        team: "A",
      },
    ],
  });

  assert.equal(cells[0]?.threshold, 2);
  assert.equal(cells[1]?.threshold, 3);
});

test("buildCardCellsPayload defaults invalid or missing threshold to 1", () => {
  const cells = buildCardCellsPayload({
    cardId: "card-123",
    acceptedEvents: [
      {
        eventKey: "TRAVEL",
        eventLabel: "Travel",
        pointValue: 20,
      },
      {
        eventKey: "BLOCK:A",
        eventLabel: "Block",
        pointValue: 20,
        threshold: Number.NaN,
      },
      {
        eventKey: "STEAL:A",
        eventLabel: "Steal",
        pointValue: 20,
        threshold: -3,
      },
    ],
  });

  assert.equal(cells[0]?.threshold, 1);
  assert.equal(cells[1]?.threshold, 1);
  assert.equal(cells[2]?.threshold, 1);
});
