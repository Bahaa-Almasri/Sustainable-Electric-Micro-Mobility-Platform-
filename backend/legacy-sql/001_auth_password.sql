-- Run once on Neon if public.users has no password column yet.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash TEXT;
