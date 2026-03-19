# BINGRA DOMAIN MODEL (v1)

This document defines the core concepts, rules, and data model for Bingra.  
All product decisions, backend logic, and UI behavior should align with this model.

---

## CORE CONCEPTS

### 1. Recorded Event
A real-world game event logged by the scorer.

- Global to the game (not tied to a player)
- Can occur multiple times
- May or may not be associated with a team

Fields:
- event_type (e.g., "3pt_made", "steal", "jump_ball")
- team_id (nullable for neutral events or single-team mode)
- occurred_at

Rules:
- This is the ONLY input created during gameplay
- Everything else is derived from recorded events

---

### 2. Card Cell
A requirement on a player’s card.

Examples:
- "3pt made by Team A"
- "Steal (any team)"
- "Jump ball"

Fields:
- event_type
- team_scope (team-specific, any team, or neutral)
- order_index (used for streak mode)

Rules:
- Defines what needs to happen, not what has happened

---

### 3. Matched Cell
A card cell that has been satisfied by a recorded event.

Rules:
- A cell is completed when:
  - A matching recorded event occurs
  - AND (in streak mode) it is the next required cell
- Once completed, it stays complete for the game

Note:
- This should be derived, not stored

---

### 4. Card Progress
The current state of a player's card.

Derived values:
- completed_cells_count
- is_complete
- next_required_cell (streak mode only)
- is_one_away

---

### 5. Live Winner
A player whose card becomes complete during gameplay.

Fields:
- player_id
- game_id
- completed_at_event_id

Rules:
- Triggered immediately when a card becomes complete
- Multiple players can share the same event (tie)
- Does NOT determine final rewards

---

### 6. Awarded Result
The final outcome used for leaderboard and career stats.

Fields:
- player_id
- is_winner (true/false)
- card_completed (true/false)
- points_awarded
- completed_at_event_id (nullable)

Rules:
- Determined only when the game ends
- Drives career stats

---

## SCORING MODEL

Score = SUM of event point values for completed card cells

- Each event type has an associated point value
- Player score is based on completed cells only
- Score is used for leaderboard ranking and winner determination (in some modes)

---

## GAME CONFIGURATION

### Completion Mode
- BLACKOUT: all cells must be completed
- STREAK: cells must be completed in order

### End Condition
- FIRST_COMPLETION: game ends automatically when first card completes
- HOST_DECLARED: host manually ends the game

### Winner Policy (only applies if HOST_DECLARED)
- FIRST_COMPLETERS_ONLY
- ALL_COMPLETERS
- HIGHEST_SCORE_COMPLETERS

### Other Config
- team_scope: one team or both teams
- card_size: number of cells
- event_catalog/template: defines possible events

---

## GAME FLOW

1. Scorer records events
2. Events are matched against all player cards
3. Card progress updates
4. If a card becomes complete:
   - Create a Live Winner
5. If end condition is FIRST_COMPLETION:
   - Game ends immediately
6. If end condition is HOST_DECLARED:
   - Game continues until host ends it
7. When game ends:
   - Awarded Results are calculated
   - Career stats are updated

---

## CAREER STATS RULES

- Only completed cards count
- No participation points
- Winners receive:
  - win credit
  - points (with multipliers)
- Non-winners:
  - game recorded
  - no points, no win
- "All completed cards count" affects both wins and points

---

## LEADERBOARD RULES

Sort order:
1. is_winner DESC
2. card_completed DESC
3. score DESC

---

## ACTIVITY FEED EVENTS

- player_joined
- recorded_event
- player_one_away
- live_winner
- game_completed

---

## ROLE-BASED ACCESS

### Player
- View card, leaderboard, activity feed

### Scorer
- Record events
- Undo/delete recent events

### Host
- All scorer permissions
- Declare game complete
- Configure game (before start)

---

## KEY PRINCIPLES

- Recorded events are the single source of truth
- Completion is separate from winning
- Winning is separate from career stats
- Most state should be derived, not stored