BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

CREATE OR REPLACE FUNCTION public.normalize_username(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    regexp_replace(
      regexp_replace(
        lower(trim(coalesce(input, ''))),
        '\\s+',
        '_',
        'g'
      ),
      '[^a-z0-9_.-]',
      '',
      'g'
    ),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.set_profile_username_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  fallback_username text;
BEGIN
  fallback_username := 'player-' || left(coalesce(NEW.id, NEW.auth_user_id)::text, 4);

  NEW.username := public.normalize_username(
    coalesce(NULLIF(NEW.username, ''), fallback_username)
  );

  IF NEW.username IS NULL THEN
    NEW.username := fallback_username;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_set_username_defaults ON public.profiles;
CREATE TRIGGER trg_profiles_set_username_defaults
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_profile_username_defaults();

WITH base AS (
  SELECT
    p.id,
    coalesce(
      public.normalize_username(NULLIF(p.display_name, '')),
      public.normalize_username(NULLIF(p.username, '')),
      public.normalize_username(NULLIF(split_part(lower(coalesce(u.email, '')), '@', 1), '')),
      'player-' || left(p.id::text, 4)
    ) AS base_username
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.auth_user_id
),
ranked AS (
  SELECT
    id,
    base_username,
    row_number() OVER (PARTITION BY base_username ORDER BY id) AS duplicate_rank
  FROM base
)
UPDATE public.profiles p
SET username = CASE
  WHEN r.duplicate_rank = 1 THEN r.base_username
  ELSE left(r.base_username, 24) || '-' || left(p.id::text, 4)
END
FROM ranked r
WHERE p.id = r.id;

ALTER TABLE public.profiles
  ALTER COLUMN username SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_username_normalized_nonempty'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_normalized_nonempty
      CHECK (
        char_length(username) >= 3
        AND username = public.normalize_username(username)
      );
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique
  ON public.profiles (username);

COMMIT;