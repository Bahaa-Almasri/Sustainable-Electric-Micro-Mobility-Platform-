-- If an older DB has column `phone` but not `phone_number`, rename once on Neon.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'phone'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'phone_number'
  ) THEN
    EXECUTE 'ALTER TABLE public.users RENAME COLUMN phone TO phone_number';
  END IF;
END $$;
