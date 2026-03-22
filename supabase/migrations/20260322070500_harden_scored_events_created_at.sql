ALTER TABLE public.scored_events
  ALTER COLUMN created_at SET DEFAULT date_trunc('milliseconds', timezone('utc', now()));

UPDATE public.scored_events
SET created_at = date_trunc('milliseconds', timezone('utc', now()))
WHERE created_at IS NULL;

ALTER TABLE public.scored_events
  ALTER COLUMN created_at SET NOT NULL;