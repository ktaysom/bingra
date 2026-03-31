BEGIN;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS host_account_id uuid NULL REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS restricted_scoring boolean;

ALTER TABLE public.games
  ALTER COLUMN restricted_scoring SET DEFAULT true;

UPDATE public.games
SET restricted_scoring = true
WHERE restricted_scoring IS NULL;

UPDATE public.games g
SET host_account_id = g.account_id
WHERE g.host_account_id IS NULL
  AND g.account_id IS NOT NULL;

UPDATE public.games g
SET host_account_id = aal.account_id
FROM public.account_auth_links aal
WHERE g.host_account_id IS NULL
  AND g.auth_user_id IS NOT NULL
  AND aal.auth_user_id = g.auth_user_id;

UPDATE public.games
SET restricted_scoring = false
WHERE host_account_id IS NULL;

ALTER TABLE public.games
  ALTER COLUMN restricted_scoring SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_games_host_account_id
  ON public.games(host_account_id)
  WHERE host_account_id IS NOT NULL;

COMMIT;
