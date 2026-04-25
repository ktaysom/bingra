BEGIN;

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
    UPDATE public.cards AS c
    SET
      target_count = p_target_count,
      selection_mode = COALESCE(NULLIF(btrim(p_selection_mode), ''), 'custom'),
      accepted_at = v_accepted_at
    WHERE c.id = v_card_id;
  END IF;

  DELETE FROM public.card_cells AS cc
  WHERE cc.card_id = v_card_id;

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

COMMIT;
