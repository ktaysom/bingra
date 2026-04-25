BEGIN;

CREATE INDEX IF NOT EXISTS idx_players_game_created_at_id
  ON public.players (game_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_scored_events_game_created_at_id
  ON public.scored_events (game_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_game_completions_game_created_at_id
  ON public.game_completions (game_id, created_at, id);

COMMIT;
