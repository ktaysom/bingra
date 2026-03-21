BEGIN;

CREATE TABLE IF NOT EXISTS public.profile_game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  finished_at timestamptz NOT NULL,
  final_score integer NOT NULL,
  raw_points integer NOT NULL,
  rank integer NOT NULL,
  total_players integer NOT NULL,
  bingra_completed boolean NOT NULL DEFAULT false,
  bingra_completed_at timestamptz NULL,
  completion_time_seconds integer NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_game_results_profile_game_unique UNIQUE (profile_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_game_results_profile_id
  ON public.profile_game_results (profile_id);

CREATE INDEX IF NOT EXISTS idx_profile_game_results_game_id
  ON public.profile_game_results (game_id);

CREATE INDEX IF NOT EXISTS idx_profile_game_results_profile_finished_at_desc
  ON public.profile_game_results (profile_id, finished_at DESC);

CREATE TABLE IF NOT EXISTS public.profile_stats (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  games_played integer NOT NULL DEFAULT 0,
  games_won integer NOT NULL DEFAULT 0,
  bingras_completed integer NOT NULL DEFAULT 0,
  total_points integer NOT NULL DEFAULT 0,
  total_raw_points integer NOT NULL DEFAULT 0,
  avg_score numeric,
  avg_finish_position numeric,
  best_finish_position integer,
  current_win_streak integer NOT NULL DEFAULT 0,
  longest_win_streak integer NOT NULL DEFAULT 0,
  last_played_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_stats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profile_game_results'
      AND policyname = 'profile_game_results_select_own'
  ) THEN
    CREATE POLICY profile_game_results_select_own
      ON public.profile_game_results
      FOR SELECT
      TO authenticated
      USING (auth.uid() = profile_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profile_stats'
      AND policyname = 'profile_stats_select_own'
  ) THEN
    CREATE POLICY profile_stats_select_own
      ON public.profile_stats
      FOR SELECT
      TO authenticated
      USING (auth.uid() = profile_id);
  END IF;
END
$$;

COMMIT;