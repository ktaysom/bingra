-- Add completed game metadata to the games table.
BEGIN;

-- Ensure status exists and defaults to lobby so new games start in the waiting phase.
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'lobby';
ALTER TABLE public.games
  ALTER COLUMN status SET DEFAULT 'lobby';
UPDATE public.games
  SET status = 'lobby'
  WHERE status IS NULL;
ALTER TABLE public.games
  ALTER COLUMN status SET NOT NULL;

-- Track the player who won the game (nullable until the winner is recorded).
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS winner_player_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'games_winner_player_id_fkey'
  ) THEN
    ALTER TABLE public.games
      ADD CONSTRAINT games_winner_player_id_fkey
      FOREIGN KEY (winner_player_id)
      REFERENCES public.players (id)
      ON DELETE SET NULL;
  END IF;
END
$$;

-- Record when a game actually completes.
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

COMMIT;