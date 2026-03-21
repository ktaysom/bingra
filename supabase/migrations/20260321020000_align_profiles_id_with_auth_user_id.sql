BEGIN;

-- Phase 2 auth identity alignment:
-- Canonical Bingra identity is profiles.id, and it must match auth.users.id.
-- Keep auth_user_id during transition, but enforce equality so either key resolves to same identity.

ALTER TABLE public.players
  DROP CONSTRAINT IF EXISTS players_profile_id_fkey;

UPDATE public.players AS pl
SET profile_id = p.auth_user_id
FROM public.profiles AS p
WHERE pl.profile_id = p.id
  AND p.id <> p.auth_user_id;

-- Defensive: if any player row still references a missing profile id,
-- null it before we restore the FK.
UPDATE public.players AS pl
SET profile_id = NULL
WHERE pl.profile_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = pl.profile_id
  );

UPDATE public.profiles
SET id = auth_user_id
WHERE id <> auth_user_id;

ALTER TABLE public.profiles
  ALTER COLUMN id DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_id_matches_auth_user_id'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_matches_auth_user_id
      CHECK (id = auth_user_id);
  END IF;
END
$$;

ALTER TABLE public.players
  ADD CONSTRAINT players_profile_id_fkey
  FOREIGN KEY (profile_id)
  REFERENCES public.profiles (id)
  ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.players AS pl
    WHERE pl.profile_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.id = pl.profile_id
      )
  ) THEN
    RAISE EXCEPTION 'players.profile_id contains unresolved references after profile alignment';
  END IF;
END
$$;

COMMIT;