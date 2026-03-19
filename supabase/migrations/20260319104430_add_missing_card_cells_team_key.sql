BEGIN;

ALTER TABLE public.card_cells
  ADD COLUMN IF NOT EXISTS team_key text;

COMMIT;
