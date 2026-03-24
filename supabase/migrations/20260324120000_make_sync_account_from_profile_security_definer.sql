BEGIN;

CREATE OR REPLACE FUNCTION public.sync_account_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_account_id uuid;
  existing_account record;
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

  SELECT id, is_active, merged_into_account_id
  INTO existing_account
  FROM public.accounts
  WHERE id = NEW.id;

  resolved_account_id := NEW.id;

  IF existing_account.id IS NOT NULL
     AND coalesce(existing_account.is_active, true) = false
     AND existing_account.merged_into_account_id IS NOT NULL THEN
    resolved_account_id := existing_account.merged_into_account_id;
  END IF;

  INSERT INTO public.account_auth_links (account_id, auth_user_id, is_primary)
  VALUES (resolved_account_id, NEW.auth_user_id, true)
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

REVOKE ALL ON FUNCTION public.sync_account_from_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_account_from_profile() TO authenticated, service_role;

COMMIT;
