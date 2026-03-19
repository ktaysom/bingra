BEGIN;

CREATE TABLE IF NOT EXISTS public.game_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  completed_at_event_id uuid NOT NULL REFERENCES public.scored_events(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'game_completions_game_id_player_id_key'
  ) THEN
    ALTER TABLE public.game_completions
      ADD CONSTRAINT game_completions_game_id_player_id_key UNIQUE (game_id, player_id);
  END IF;
END
$$;

COMMIT;
