BEGIN;

CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY,
  username text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_username_unique
  ON public.accounts(username);

CREATE OR REPLACE FUNCTION public.set_accounts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_set_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_set_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.set_accounts_updated_at();

CREATE TABLE IF NOT EXISTS public.account_auth_links (
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_at timestamptz NOT NULL DEFAULT now(),
  is_primary boolean NOT NULL DEFAULT true,
  PRIMARY KEY (account_id, auth_user_id)
);

CREATE INDEX IF NOT EXISTS idx_account_auth_links_account_id
  ON public.account_auth_links(account_id);

INSERT INTO public.accounts (id, username)
SELECT
  p.id,
  coalesce(p.username, 'player_' || replace(p.id::text, '-', ''))
FROM public.profiles p
ON CONFLICT (id)
DO UPDATE
SET username = EXCLUDED.username,
    updated_at = now();

INSERT INTO public.account_auth_links (account_id, auth_user_id, is_primary)
SELECT
  p.id,
  p.auth_user_id,
  true
FROM public.profiles p
ON CONFLICT (auth_user_id)
DO UPDATE
SET account_id = EXCLUDED.account_id,
    is_primary = EXCLUDED.is_primary;

CREATE OR REPLACE FUNCTION public.sync_account_from_profile()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.accounts (id, username)
  VALUES (
    NEW.id,
    coalesce(NEW.username, 'player_' || replace(NEW.id::text, '-', ''))
  )
  ON CONFLICT (id)
  DO UPDATE
  SET username = EXCLUDED.username,
      updated_at = now();

  INSERT INTO public.account_auth_links (account_id, auth_user_id, is_primary)
  VALUES (NEW.id, NEW.auth_user_id, true)
  ON CONFLICT (auth_user_id)
  DO UPDATE
  SET account_id = EXCLUDED.account_id,
      is_primary = EXCLUDED.is_primary;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_account_from_profile ON public.profiles;
CREATE TRIGGER trg_profiles_sync_account_from_profile
AFTER INSERT OR UPDATE OF id, auth_user_id, username ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_account_from_profile();

COMMIT;
