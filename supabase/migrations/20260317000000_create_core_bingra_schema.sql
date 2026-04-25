BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  sport text,
  mode text NOT NULL DEFAULT 'quick_play',
  allow_custom_cards boolean NOT NULL DEFAULT true,
  visibility text NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'player',
  join_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_players_game_id
  ON public.players (game_id);

CREATE TABLE IF NOT EXISTS public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  target_count integer,
  selection_mode text,
  current_progress_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cards_game_id
  ON public.cards (game_id);

CREATE INDEX IF NOT EXISTS idx_cards_player_id
  ON public.cards (player_id);

CREATE TABLE IF NOT EXISTS public.card_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  event_label text,
  point_value integer,
  order_index integer NOT NULL DEFAULT 0,
  marked_at timestamptz,
  is_lock boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_card_cells_card_id
  ON public.card_cells (card_id);

CREATE TABLE IF NOT EXISTS public.scored_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  event_key text,
  event_label text,
  team_key text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scored_events_game_id
  ON public.scored_events (game_id);

CREATE OR REPLACE FUNCTION public.rpc_create_game(
  p_title text,
  p_sport text,
  p_mode text,
  p_host_display_name text,
  p_allow_custom_cards boolean,
  p_visibility text,
  p_event_keys text[],
  p_event_labels text[],
  p_point_values integer[],
  p_auth_user_id uuid
)
RETURNS TABLE (
  game_slug text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_game_id uuid;
  v_game_slug text;
BEGIN
  v_game_slug := lower(regexp_replace(coalesce(nullif(btrim(p_title), ''), 'game-on'), '[^a-z0-9]+', '-', 'g'));
  v_game_slug := trim(both '-' from v_game_slug);

  IF v_game_slug = '' THEN
    v_game_slug := 'game-on';
  END IF;

  v_game_slug := v_game_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  INSERT INTO public.games (
    slug,
    title,
    sport,
    mode,
    allow_custom_cards,
    visibility
  )
  VALUES (
    v_game_slug,
    coalesce(nullif(btrim(p_title), ''), 'Game On'),
    p_sport,
    coalesce(nullif(btrim(p_mode), ''), 'quick_play'),
    coalesce(p_allow_custom_cards, true),
    coalesce(nullif(btrim(p_visibility), ''), 'private')
  )
  RETURNING id INTO v_game_id;

  INSERT INTO public.players (
    game_id,
    display_name,
    role,
    join_token
  )
  VALUES (
    v_game_id,
    coalesce(nullif(btrim(p_host_display_name), ''), 'Host'),
    'host',
    gen_random_uuid()
  );

  RETURN QUERY
  SELECT v_game_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_create_game(
  text,
  text,
  text,
  text,
  boolean,
  text,
  text[],
  text[],
  integer[],
  uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rpc_create_game(
  text,
  text,
  text,
  text,
  boolean,
  text,
  text[],
  text[],
  integer[],
  uuid
) TO service_role;

COMMIT;
