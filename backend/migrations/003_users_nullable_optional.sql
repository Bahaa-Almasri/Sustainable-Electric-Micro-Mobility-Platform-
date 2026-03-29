-- If signup fails with NOT NULL on profile fields, run this once on Neon.
-- Makes optional fields nullable so registration can omit them (e.g. name until user edits profile).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'name'
  ) THEN
    EXECUTE 'ALTER TABLE public.users ALTER COLUMN name DROP NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'phone_number'
  ) THEN
    EXECUTE 'ALTER TABLE public.users ALTER COLUMN phone_number DROP NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'phone'
  ) THEN
    EXECUTE 'ALTER TABLE public.users ALTER COLUMN phone DROP NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'first_name'
  ) THEN
    EXECUTE 'ALTER TABLE public.users ALTER COLUMN first_name DROP NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_name'
  ) THEN
    EXECUTE 'ALTER TABLE public.users ALTER COLUMN last_name DROP NOT NULL';
  END IF;
END $$;
