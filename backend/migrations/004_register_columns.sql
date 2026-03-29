-- Optional columns if public.users is still minimal (use 001 for password_hash).
-- App signup uses: user_id, email, password_hash, name, phone_number, status.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- App and API expect the primary key column to be named user_id (uuid).
-- If your table uses `id` instead, run once (after backing up):
--   ALTER TABLE public.users RENAME COLUMN id TO user_id;
