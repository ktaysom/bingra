BEGIN;

CREATE OR REPLACE FUNCTION public.unlink_account_auth_method(
  p_account_id uuid,
  p_auth_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  link_count integer := 0;
  deleted_count integer := 0;
BEGIN
  IF p_account_id IS NULL OR p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'account_id and auth_user_id are required';
  END IF;

  PERFORM 1
  FROM public.accounts
  WHERE id = p_account_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account % not found', p_account_id;
  END IF;

  SELECT count(*)::integer
  INTO link_count
  FROM public.account_auth_links
  WHERE account_id = p_account_id;

  IF link_count <= 1 THEN
    RAISE EXCEPTION 'You must keep at least one sign-in method on your account.';
  END IF;

  DELETE FROM public.account_auth_links
  WHERE account_id = p_account_id
    AND auth_user_id = p_auth_user_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'removed', deleted_count > 0,
    'deleted_count', deleted_count,
    'remaining_links', GREATEST(link_count - deleted_count, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.unlink_account_auth_method(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unlink_account_auth_method(uuid, uuid) TO service_role;

COMMIT;
