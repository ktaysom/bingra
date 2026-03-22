BEGIN;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS sport_profile text;

UPDATE public.games
SET sport_profile = 'basketball_high_school'
WHERE sport_profile IS NULL;

ALTER TABLE public.games
  ALTER COLUMN sport_profile SET DEFAULT 'basketball_high_school';

ALTER TABLE public.games
  ALTER COLUMN sport_profile SET NOT NULL;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS catalog_version text;

COMMIT;