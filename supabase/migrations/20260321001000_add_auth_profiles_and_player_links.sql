BEGIN;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY profiles_select_own
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (auth.uid() = auth_user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY profiles_insert_own
      ON public.profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = auth_user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY profiles_update_own
      ON public.profiles
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = auth_user_id)
      WITH CHECK (auth.uid() = auth_user_id);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.set_profile_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_set_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_profile_updated_at();

INSERT INTO public.profiles (auth_user_id)
SELECT u.id
FROM auth.users u
LEFT JOIN public.profiles p ON p.auth_user_id = u.id
WHERE p.id IS NULL;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS profile_id uuid NULL REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_players_profile_id ON public.players (profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_game_profile_unique
  ON public.players (game_id, profile_id)
  WHERE profile_id IS NOT NULL;

COMMIT;