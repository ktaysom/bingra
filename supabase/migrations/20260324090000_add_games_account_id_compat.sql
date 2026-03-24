BEGIN;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS account_id uuid NULL REFERENCES public.accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_games_account_id ON public.games(account_id);

UPDATE public.games g
SET account_id = aal.account_id
FROM public.account_auth_links aal
WHERE g.account_id IS NULL
  AND g.auth_user_id IS NOT NULL
  AND aal.auth_user_id = g.auth_user_id;

COMMIT;
