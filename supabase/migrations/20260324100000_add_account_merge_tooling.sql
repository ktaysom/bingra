BEGIN;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS merged_into_account_id uuid NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_merged_into_account_id
  ON public.accounts(merged_into_account_id);

CREATE TABLE IF NOT EXISTS public.account_merges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  target_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  merged_at timestamptz NOT NULL DEFAULT now(),
  merged_by_auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT account_merges_source_target_different CHECK (source_account_id <> target_account_id)
);

CREATE INDEX IF NOT EXISTS idx_account_merges_source_account_id
  ON public.account_merges(source_account_id);

CREATE INDEX IF NOT EXISTS idx_account_merges_target_account_id
  ON public.account_merges(target_account_id);

CREATE OR REPLACE FUNCTION public.sync_account_from_profile()
RETURNS trigger
LANGUAGE plpgsql
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

CREATE OR REPLACE FUNCTION public.admin_account_merge_plan(
  p_source_account_id uuid,
  p_target_account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  source_exists boolean;
  target_exists boolean;
  source_players integer := 0;
  target_players integer := 0;
  duplicate_player_pairs integer := 0;
  duplicate_games integer := 0;
  players_to_reassign integer := 0;
  source_games_owned integer := 0;
  source_auth_links integer := 0;
  source_profile_game_results integer := 0;
  source_profile_stats integer := 0;
  duplicate_game_ids jsonb := '[]'::jsonb;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.accounts WHERE id = p_source_account_id) INTO source_exists;
  SELECT EXISTS(SELECT 1 FROM public.accounts WHERE id = p_target_account_id) INTO target_exists;

  IF NOT source_exists THEN
    RAISE EXCEPTION 'Source account % not found', p_source_account_id;
  END IF;

  IF NOT target_exists THEN
    RAISE EXCEPTION 'Target account % not found', p_target_account_id;
  END IF;

  SELECT count(*)::integer
  INTO source_players
  FROM public.players
  WHERE profile_id = p_source_account_id;

  SELECT count(*)::integer
  INTO target_players
  FROM public.players
  WHERE profile_id = p_target_account_id;

  WITH duplicate_pairs AS (
    SELECT s.id AS source_player_id, t.id AS target_player_id, s.game_id
    FROM public.players s
    JOIN public.players t
      ON t.game_id = s.game_id
    WHERE s.profile_id = p_source_account_id
      AND t.profile_id = p_target_account_id
  )
  SELECT count(*)::integer, count(DISTINCT game_id)::integer
  INTO duplicate_player_pairs, duplicate_games
  FROM duplicate_pairs;

  SELECT count(*)::integer
  INTO players_to_reassign
  FROM public.players s
  WHERE s.profile_id = p_source_account_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.players t
      WHERE t.game_id = s.game_id
        AND t.profile_id = p_target_account_id
    );

  SELECT count(*)::integer
  INTO source_games_owned
  FROM public.games
  WHERE account_id = p_source_account_id;

  SELECT count(*)::integer
  INTO source_auth_links
  FROM public.account_auth_links
  WHERE account_id = p_source_account_id;

  SELECT count(*)::integer
  INTO source_profile_game_results
  FROM public.profile_game_results
  WHERE profile_id = p_source_account_id;

  SELECT count(*)::integer
  INTO source_profile_stats
  FROM public.profile_stats
  WHERE profile_id = p_source_account_id;

  SELECT coalesce(jsonb_agg(game_id), '[]'::jsonb)
  INTO duplicate_game_ids
  FROM (
    SELECT DISTINCT s.game_id
    FROM public.players s
    JOIN public.players t
      ON t.game_id = s.game_id
    WHERE s.profile_id = p_source_account_id
      AND t.profile_id = p_target_account_id
    ORDER BY s.game_id
    LIMIT 200
  ) dup;

  RETURN jsonb_build_object(
    'source_account_id', p_source_account_id,
    'target_account_id', p_target_account_id,
    'source_players', source_players,
    'target_players', target_players,
    'duplicate_player_pairs', duplicate_player_pairs,
    'duplicate_games', duplicate_games,
    'players_to_reassign', players_to_reassign,
    'source_games_owned', source_games_owned,
    'source_auth_links', source_auth_links,
    'source_profile_game_results', source_profile_game_results,
    'source_profile_stats_rows', source_profile_stats,
    'duplicate_game_ids_sample', duplicate_game_ids
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_merge_accounts(
  p_source_account_id uuid,
  p_target_account_id uuid,
  p_dry_run boolean DEFAULT true,
  p_merged_by_auth_user_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  source_account record;
  target_account record;
  merge_plan jsonb;
  merge_id uuid;
  updated_winner_rows integer := 0;
  deleted_duplicate_players integer := 0;
  reassigned_players integer := 0;
  moved_games integer := 0;
  moved_auth_links integer := 0;
  deleted_source_results integer := 0;
  deleted_source_stats integer := 0;
  deleted_target_stats integer := 0;
BEGIN
  IF p_source_account_id IS NULL OR p_target_account_id IS NULL THEN
    RAISE EXCEPTION 'Source and target account IDs are required';
  END IF;

  IF p_source_account_id = p_target_account_id THEN
    RAISE EXCEPTION 'Cannot merge account % into itself', p_source_account_id;
  END IF;

  SELECT * INTO source_account
  FROM public.accounts
  WHERE id = p_source_account_id
  FOR UPDATE;

  IF source_account.id IS NULL THEN
    RAISE EXCEPTION 'Source account % not found', p_source_account_id;
  END IF;

  SELECT * INTO target_account
  FROM public.accounts
  WHERE id = p_target_account_id
  FOR UPDATE;

  IF target_account.id IS NULL THEN
    RAISE EXCEPTION 'Target account % not found', p_target_account_id;
  END IF;

  IF coalesce(source_account.is_active, true) = false
     AND source_account.merged_into_account_id = p_target_account_id THEN
    RETURN jsonb_build_object(
      'ok', true,
      'dry_run', p_dry_run,
      'already_merged', true,
      'source_account_id', p_source_account_id,
      'target_account_id', p_target_account_id
    );
  END IF;

  IF coalesce(source_account.is_active, true) = false THEN
    RAISE EXCEPTION 'Source account % is already inactive/merged', p_source_account_id;
  END IF;

  IF coalesce(target_account.is_active, true) = false THEN
    RAISE EXCEPTION 'Target account % is inactive and cannot receive a merge', p_target_account_id;
  END IF;

  merge_plan := public.admin_account_merge_plan(p_source_account_id, p_target_account_id);

  IF coalesce(p_dry_run, true) THEN
    RETURN jsonb_build_object(
      'ok', true,
      'dry_run', true,
      'merge_plan', merge_plan,
      'requires_career_rebuild', true
    );
  END IF;

  -- Preserve winner pointers for duplicate same-game players before deleting source rows.
  WITH duplicate_players AS (
    SELECT s.id AS source_player_id, t.id AS target_player_id
    FROM public.players s
    JOIN public.players t
      ON t.game_id = s.game_id
    WHERE s.profile_id = p_source_account_id
      AND t.profile_id = p_target_account_id
  )
  UPDATE public.games g
  SET winner_player_id = d.target_player_id
  FROM duplicate_players d
  WHERE g.winner_player_id = d.source_player_id;

  GET DIAGNOSTICS updated_winner_rows = ROW_COUNT;

  -- Conflict strategy: prefer target player rows; remove source duplicates in overlapping games.
  WITH duplicate_players AS (
    SELECT s.id AS source_player_id
    FROM public.players s
    JOIN public.players t
      ON t.game_id = s.game_id
    WHERE s.profile_id = p_source_account_id
      AND t.profile_id = p_target_account_id
  )
  DELETE FROM public.players p
  USING duplicate_players d
  WHERE p.id = d.source_player_id;

  GET DIAGNOSTICS deleted_duplicate_players = ROW_COUNT;

  UPDATE public.players
  SET profile_id = p_target_account_id
  WHERE profile_id = p_source_account_id;

  GET DIAGNOSTICS reassigned_players = ROW_COUNT;

  UPDATE public.games
  SET account_id = p_target_account_id
  WHERE account_id = p_source_account_id;

  GET DIAGNOSTICS moved_games = ROW_COUNT;

  UPDATE public.account_auth_links
  SET account_id = p_target_account_id,
      is_primary = false
  WHERE account_id = p_source_account_id;

  GET DIAGNOSTICS moved_auth_links = ROW_COUNT;

  DELETE FROM public.profile_game_results
  WHERE profile_id = p_source_account_id;

  GET DIAGNOSTICS deleted_source_results = ROW_COUNT;

  DELETE FROM public.profile_stats
  WHERE profile_id = p_source_account_id;

  GET DIAGNOSTICS deleted_source_stats = ROW_COUNT;

  -- Force target stats to be rebuilt from canonical history after merge.
  DELETE FROM public.profile_stats
  WHERE profile_id = p_target_account_id;

  GET DIAGNOSTICS deleted_target_stats = ROW_COUNT;

  UPDATE public.accounts
  SET is_active = false,
      merged_into_account_id = p_target_account_id,
      merged_at = now(),
      updated_at = now()
  WHERE id = p_source_account_id;

  UPDATE public.accounts
  SET updated_at = now()
  WHERE id = p_target_account_id;

  INSERT INTO public.account_merges (
    source_account_id,
    target_account_id,
    merged_by_auth_user_id,
    metadata
  )
  VALUES (
    p_source_account_id,
    p_target_account_id,
    p_merged_by_auth_user_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('merge_plan', merge_plan)
  )
  RETURNING id INTO merge_id;

  RETURN jsonb_build_object(
    'ok', true,
    'dry_run', false,
    'merge_id', merge_id,
    'merge_plan', merge_plan,
    'updated_winner_rows', updated_winner_rows,
    'deleted_duplicate_players', deleted_duplicate_players,
    'reassigned_players', reassigned_players,
    'moved_games', moved_games,
    'moved_auth_links', moved_auth_links,
    'deleted_source_profile_game_results', deleted_source_results,
    'deleted_source_profile_stats', deleted_source_stats,
    'deleted_target_profile_stats', deleted_target_stats,
    'requires_career_rebuild', true,
    'rebuild_profile_ids', jsonb_build_array(p_source_account_id, p_target_account_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_account_merge_plan(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_account_merge_plan(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.admin_merge_accounts(uuid, uuid, boolean, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_merge_accounts(uuid, uuid, boolean, uuid, jsonb) TO service_role;

COMMIT;
