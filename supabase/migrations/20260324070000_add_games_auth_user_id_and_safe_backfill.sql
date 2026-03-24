BEGIN;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_games_auth_user_id ON public.games(auth_user_id);

WITH host_candidates AS (
  SELECT
    p.game_id,
   min(p.profile_id::text)::uuid AS profile_id,
    count(*) FILTER (WHERE p.profile_id IS NOT NULL) AS linked_host_count
  FROM public.players p
  WHERE p.role = 'host'
  GROUP BY p.game_id
)
UPDATE public.games g
SET auth_user_id = hc.profile_id
FROM host_candidates hc
WHERE g.id = hc.game_id
  AND g.auth_user_id IS NULL
  AND hc.linked_host_count = 1;

COMMIT;
