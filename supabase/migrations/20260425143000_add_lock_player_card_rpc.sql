BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_game_player_unique
  ON public.cards (game_id, player_id);

CREATE OR REPLACE FUNCTION public.lock_player_card(
  p_player_id uuid,
  p_game_slug text,
  p_target_count integer,
  p_selection_mode text,
  p_card_cells jsonb
)
RETURNS TABLE (
  card_id uuid,
  game_slug text,
  accepted_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_game_id uuid;
  v_game_slug text;
  v_card_id uuid;
  v_accepted_at timestamptz := now();
BEGIN
  IF p_player_id IS NULL THEN
    RAISE EXCEPTION 'Player id is required';
  END IF;

  IF p_game_slug IS NULL OR btrim(p_game_slug) = '' THEN
    RAISE EXCEPTION 'Game slug is required';
  END IF;

  IF p_card_cells IS NULL OR jsonb_typeof(p_card_cells) <> 'array' OR jsonb_array_length(p_card_cells) = 0 THEN
    RAISE EXCEPTION 'Card cells payload is required';
  END IF;

  SELECT p.game_id, g.slug
  INTO v_game_id, v_game_slug
  FROM public.players AS p
  JOIN public.games AS g
    ON g.id = p.game_id
  WHERE p.id = p_player_id
    AND g.slug = p_game_slug
  LIMIT 1;

  IF v_game_id IS NULL THEN
    RAISE EXCEPTION 'Player is not associated with the requested game';
  END IF;

  SELECT c.id
  INTO v_card_id
  FROM public.cards AS c
  WHERE c.game_id = v_game_id
    AND c.player_id = p_player_id
  ORDER BY c.id ASC
  LIMIT 1
  FOR UPDATE;

  IF v_card_id IS NULL THEN
    INSERT INTO public.cards (
      game_id,
      player_id,
      target_count,
      selection_mode,
      accepted_at
    )
    VALUES (
      v_game_id,
      p_player_id,
      p_target_count,
      COALESCE(NULLIF(btrim(p_selection_mode), ''), 'custom'),
      v_accepted_at
    )
    RETURNING id INTO v_card_id;
  ELSE
    UPDATE public.cards
    SET
      target_count = p_target_count,
      selection_mode = COALESCE(NULLIF(btrim(p_selection_mode), ''), 'custom'),
      accepted_at = v_accepted_at
    WHERE id = v_card_id;
  END IF;

  DELETE FROM public.card_cells
  WHERE card_id = v_card_id;

  INSERT INTO public.card_cells (
    card_id,
    event_key,
    event_label,
    team_key,
    point_value,
    threshold,
    order_index,
    is_lock
  )
  SELECT
    v_card_id,
    cell.event_key,
    cell.event_label,
    cell.team_key,
    cell.point_value,
    cell.threshold,
    cell.order_index,
    cell.is_lock
  FROM jsonb_to_recordset(p_card_cells) AS cell(
    event_key text,
    event_label text,
    team_key text,
    point_value integer,
    threshold integer,
    order_index integer,
    is_lock boolean
  );

  RETURN QUERY
  SELECT v_card_id, v_game_slug, v_accepted_at;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_player_card(uuid, text, integer, text, jsonb)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.lock_player_card(uuid, text, integer, text, jsonb)
TO service_role;

CREATE OR REPLACE FUNCTION public.debug_blocked_queries()
RETURNS TABLE (
  blocked_pid integer,
  blocking_pid integer,
  wait_event_type text,
  wait_event text,
  blocked_query text,
  blocking_query text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    blocked.pid AS blocked_pid,
    blocking.pid AS blocking_pid,
    blocked.wait_event_type::text,
    blocked.wait_event::text,
    blocked.query::text AS blocked_query,
    blocking.query::text AS blocking_query
  FROM pg_catalog.pg_locks blocked_locks
  JOIN pg_catalog.pg_stat_activity blocked
    ON blocked.pid = blocked_locks.pid
  JOIN pg_catalog.pg_locks blocking_locks
    ON blocking_locks.locktype = blocked_locks.locktype
   AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
   AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
   AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
   AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
   AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
   AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
   AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
   AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
   AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
   AND blocking_locks.pid <> blocked_locks.pid
  JOIN pg_catalog.pg_stat_activity blocking
    ON blocking.pid = blocking_locks.pid
  WHERE NOT blocked_locks.granted
    AND blocking_locks.granted;
$$;

REVOKE ALL ON FUNCTION public.debug_blocked_queries()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.debug_blocked_queries()
TO service_role;

COMMIT;
