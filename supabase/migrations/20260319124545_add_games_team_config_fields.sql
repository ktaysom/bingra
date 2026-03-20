BEGIN;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS team_a_name text;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS team_b_name text;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS team_scope text;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS events_per_card integer;

UPDATE public.games
SET team_a_name = 'Team A'
WHERE team_a_name IS NULL;

UPDATE public.games
SET team_b_name = 'Team B'
WHERE team_b_name IS NULL;

UPDATE public.games
SET team_scope = 'both_teams'
WHERE team_scope IS NULL;

UPDATE public.games
SET events_per_card = 8
WHERE events_per_card IS NULL;

ALTER TABLE public.games
  ALTER COLUMN team_a_name SET NOT NULL;

ALTER TABLE public.games
  ALTER COLUMN team_b_name SET NOT NULL;

ALTER TABLE public.games
  ALTER COLUMN team_scope SET NOT NULL;

ALTER TABLE public.games
  ALTER COLUMN events_per_card SET NOT NULL;

ALTER TABLE public.games
  ALTER COLUMN team_a_name SET DEFAULT 'Team A';

ALTER TABLE public.games
  ALTER COLUMN team_b_name SET DEFAULT 'Team B';

ALTER TABLE public.games
  ALTER COLUMN team_scope SET DEFAULT 'both_teams';

ALTER TABLE public.games
  ALTER COLUMN events_per_card SET DEFAULT 8;

COMMIT;
