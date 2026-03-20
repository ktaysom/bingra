import test from "node:test";
import assert from "node:assert/strict";

import { calculateFinalScore, rankScoreEntries } from "../lib/bingra/game-scoring.ts";

test("Bingra doubles final score", () => {
  assert.equal(calculateFinalScore(10, false), 10);
  assert.equal(calculateFinalScore(10, true), 20);
});

test("rankScoreEntries ranks by final score first", () => {
  const ranked = rankScoreEntries([
    {
      player_id: "p1",
      join_order: 0,
      raw_points: 12,
      has_bingra: false,
      final_score: 12,
    },
    {
      player_id: "p2",
      join_order: 1,
      raw_points: 10,
      has_bingra: true,
      final_score: 20,
    },
  ]);

  assert.equal(ranked[0]?.player_id, "p2");
  assert.equal(ranked[1]?.player_id, "p1");
});

test("Bingra bonus can overtake higher raw points", () => {
  const ranked = rankScoreEntries([
    {
      player_id: "alpha",
      join_order: 0,
      raw_points: 9,
      has_bingra: false,
      final_score: calculateFinalScore(9, false),
    },
    {
      player_id: "bravo",
      join_order: 1,
      raw_points: 5,
      has_bingra: true,
      final_score: calculateFinalScore(5, true),
    },
  ]);

  assert.equal(ranked[0]?.player_id, "bravo");
  assert.equal(ranked[0]?.final_score, 10);
});

test("tie-breaker prefers earlier Bingra timestamp when both have Bingra", () => {
  const ranked = rankScoreEntries([
    {
      player_id: "p-later",
      join_order: 0,
      raw_points: 10,
      has_bingra: true,
      final_score: 20,
      bingra_completed_at: "2026-03-20T10:00:05.000Z",
      player_created_at: "2026-03-20T09:00:00.000Z",
    },
    {
      player_id: "p-earlier",
      join_order: 1,
      raw_points: 10,
      has_bingra: true,
      final_score: 20,
      bingra_completed_at: "2026-03-20T10:00:01.000Z",
      player_created_at: "2026-03-20T09:00:01.000Z",
    },
  ]);

  assert.equal(ranked[0]?.player_id, "p-earlier");
});

test("tie-breaker prefers earlier player created timestamp before player id", () => {
  const ranked = rankScoreEntries([
    {
      player_id: "zz-player",
      join_order: 0,
      raw_points: 7,
      has_bingra: false,
      final_score: 7,
      player_created_at: "2026-03-20T09:00:02.000Z",
    },
    {
      player_id: "aa-player",
      join_order: 1,
      raw_points: 7,
      has_bingra: false,
      final_score: 7,
      player_created_at: "2026-03-20T09:00:01.000Z",
    },
  ]);

  assert.equal(ranked[0]?.player_id, "aa-player");
});

test("tie-breaker falls back to player id for stability", () => {
  const ranked = rankScoreEntries([
    {
      player_id: "b-player",
      join_order: 0,
      raw_points: 7,
      has_bingra: false,
      final_score: 7,
      player_created_at: "2026-03-20T09:00:01.000Z",
    },
    {
      player_id: "a-player",
      join_order: 1,
      raw_points: 7,
      has_bingra: false,
      final_score: 7,
      player_created_at: "2026-03-20T09:00:01.000Z",
    },
  ]);

  assert.equal(ranked[0]?.player_id, "a-player");
});




