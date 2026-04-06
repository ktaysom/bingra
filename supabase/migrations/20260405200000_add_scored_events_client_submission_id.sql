ALTER TABLE public.scored_events
  ADD COLUMN IF NOT EXISTS client_submission_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS scored_events_client_submission_id_unique
  ON public.scored_events (client_submission_id)
  WHERE client_submission_id IS NOT NULL;
