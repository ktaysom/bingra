BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_create_game_full(
  p_title text,
  p_sport text,
  p_mode text,
  p_host_display_name text,
  p_allow_custom_cards boolean,
  p_visibility text,
  p_completion_mode text,
  p_end_condition text,
  p_team_a_name text,
  p_team_b_name text,
  p_team_scope text,
  p_events_per_card integer,
  p_sport_profile text,
  p_catalog_version text,
  p_auth_user_id uuid,
  p_account_id uuid
)
RETURNS TABLE (
  game_slug text,
  host_player_id uuid
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_game_slug text;
  v_game_id uuid;
  v_host_player_id uuid;
  v_host_profile_id uuid;
BEGIN
  SELECT created.game_slug
  INTO v_game_slug
  FROM public.rpc_create_game(
    p_title,
    p_sport,
    p_mode::public.game_mode,
    p_host_display_name,
    p_allow_custom_cards,
    p_visibility,
    NULL::text[],
    NULL::text[],
    NULL::numeric[],
    p_auth_user_id
  ) AS created
  LIMIT 1;

  IF v_game_slug IS NULL THEN
    RAISE EXCEPTION 'rpc_create_game returned no game_slug';
  END IF;

  SELECT g.id
  INTO v_game_id
  FROM public.games g
  WHERE g.slug = v_game_slug
  FOR UPDATE;

  IF v_game_id IS NULL THEN
    RAISE EXCEPTION 'Unable to resolve game from slug %', v_game_slug;
  END IF;

  UPDATE public.games
  SET
    completion_mode = p_completion_mode,
    end_condition = p_end_condition,
    team_a_name = p_team_a_name,
    team_b_name = p_team_b_name,
    team_scope = p_team_scope,
    events_per_card = p_events_per_card,
    sport_profile = p_sport_profile,
    catalog_version = p_catalog_version,
    auth_user_id = p_auth_user_id,
    account_id = p_account_id,
    host_account_id = p_account_id,
    restricted_scoring = true
  WHERE id = v_game_id;

  SELECT p.id, p.profile_id
  INTO v_host_player_id, v_host_profile_id
  FROM public.players p
  WHERE p.game_id = v_game_id
    AND p.role = 'host'
  ORDER BY p.created_at ASC, p.id ASC
  LIMIT 1
  FOR UPDATE;

  IF v_host_player_id IS NULL THEN
    INSERT INTO public.players (
      game_id,
      display_name,
      role,
      join_token,
      profile_id
    )
    VALUES (
      v_game_id,
      p_host_display_name,
      'host',
      gen_random_uuid(),
      p_account_id
    )
    RETURNING id INTO v_host_player_id;
  ELSE
    DELETE FROM public.players
    WHERE game_id = v_game_id
      AND role = 'host'
      AND id <> v_host_player_id;

    IF p_account_id IS NOT NULL AND v_host_profile_id IS NULL THEN
      UPDATE public.players
      SET profile_id = p_account_id
      WHERE id = v_host_player_id
        AND profile_id IS NULL;
    END IF;
  END IF;

  RETURN QUERY
  SELECT v_game_slug, v_host_player_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_create_game_full(
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  text,
  uuid,
  uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_create_game_full(
  text,
  text,
  text,
  text,
  boolean,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  text,
  text,
  uuid,
  uuid
) TO service_role;

COMMIT;
