# Scoring System

## Base Concept

Players earn points when they win a game.

Points are based on:
1. Card difficulty (event values)
2. Game size (number of players)
3. First-to-claim bonus
4. "Call Your Shot" bonus

---

## 1. Card Score

Sum of point values of events in winning run.

Example:

3 pointer = 2 pts  
charge = 3 pts  
block = 2 pts  

Total = 7 pts

---

## 2. Player Count Multiplier

Encourages larger games.

Example:

multiplier = log2(player_count + 1)

---

## 3. First-to-Claim Bonus

If first valid claim:

+X% multiplier (e.g., 1.25x)

---

## 4. Call Your Shot

Player selects one "lock" event before game.

Rules:
- must be included in winning path
- if used → bonus multiplier (e.g., 1.5x)
- if not → cannot win

---

## Final Score

score =
(card_points)
× player_count_multiplier
× first_claim_multiplier
× lock_multiplier

---

## Career Points

Accumulated over time.

Used for:
- rankings
- progression
- retention