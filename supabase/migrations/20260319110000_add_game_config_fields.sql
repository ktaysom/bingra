BEGIN;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS completion_mode text DEFAULT 'BLACKOUT';

ALTER TABLE public.games
  ALTER COLUMN completion_mode SET DEFAULT 'BLACKOUT';

UPDATE public.games
SET completion_mode = 'BLACKOUT'
WHERE completion_mode IS NULL;

ALTER TABLE public.games
  ALTER COLUMN completion_mode SET NOT NULL;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS end_condition text DEFAULT 'FIRST_COMPLETION';

ALTER TABLE public.games
  ALTER COLUMN end_condition SET DEFAULT 'FIRST_COMPLETION';

UPDATE public.games
SET end_condition = 'FIRST_COMPLETION'
WHERE end_condition IS NULL;

ALTER TABLE public.games
  ALTER COLUMN end_condition SET NOT NULL;

COMMIT;
