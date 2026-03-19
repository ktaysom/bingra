BEGIN;

-- Ensure RLS is enabled so Realtime can enforce row visibility consistently.
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scored_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_completions ENABLE ROW LEVEL SECURITY;

-- /play browser clients currently use publishable/anon key (anon role) and may also be authenticated.
-- Keep scope SELECT-only for realtime delivery.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'games'
      AND policyname = 'play_realtime_select_games'
  ) THEN
    CREATE POLICY play_realtime_select_games
      ON public.games
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'players'
      AND policyname = 'play_realtime_select_players'
  ) THEN
    CREATE POLICY play_realtime_select_players
      ON public.players
      FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.games g
          WHERE g.id = players.game_id
            AND g.status IN ('lobby', 'live', 'finished')
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'scored_events'
      AND policyname = 'play_realtime_select_scored_events'
  ) THEN
    CREATE POLICY play_realtime_select_scored_events
      ON public.scored_events
      FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.games g
          WHERE g.id = scored_events.game_id
            AND g.status IN ('lobby', 'live', 'finished')
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'game_completions'
      AND policyname = 'play_realtime_select_game_completions'
  ) THEN
    CREATE POLICY play_realtime_select_game_completions
      ON public.game_completions
      FOR SELECT
      TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.games g
          WHERE g.id = game_completions.game_id
            AND g.status IN ('lobby', 'live', 'finished')
        )
      );
  END IF;
END
$$;

COMMIT;
