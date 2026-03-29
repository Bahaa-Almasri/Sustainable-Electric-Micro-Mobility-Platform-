-- Optional wallet tables for Neon (after core ER tables exist).
-- user_id references public.users(user_id), not Supabase auth.

create extension if not exists "pgcrypto";

create table if not exists public.ride_packages (
  package_id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  ride_credits integer,
  price numeric,
  currency text default 'USD',
  is_active boolean default true
);

create table if not exists public.user_package_purchases (
  purchase_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (user_id) on delete cascade,
  package_id uuid not null references public.ride_packages (package_id) on delete restrict,
  rides_remaining integer,
  payment_id uuid,
  created_at timestamptz default now()
);

create table if not exists public.payment_methods (
  method_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (user_id) on delete cascade,
  provider text,
  last_four text,
  brand text,
  is_default boolean default false,
  created_at timestamptz default now()
);

insert into public.ride_packages (title, description, ride_credits, price, currency, is_active)
select * from (
  values
    ('City 5-pack'::text, 'Five unlocks'::text, 5::integer, 12.99::numeric, 'USD'::text, true::boolean),
    ('Commuter 20'::text, 'Twenty rides'::text, 20::integer, 39.99::numeric, 'USD'::text, true::boolean)
) as v(title, description, ride_credits, price, currency, is_active)
where not exists (select 1 from public.ride_packages);
