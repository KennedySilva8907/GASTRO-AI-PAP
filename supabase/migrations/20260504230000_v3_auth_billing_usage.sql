create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null default 'incomplete',
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature text not null check (feature in ('chat', 'challenge_recipe')),
  plan text not null check (plan in ('free', 'pro')),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature text not null check (feature in ('chat', 'challenge_recipe')),
  count integer not null default 0 check (count >= 0),
  window_started_at timestamptz not null,
  window_expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique (user_id, feature)
);

create table if not exists public.stripe_events (
  id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_events enable row level security;
alter table public.daily_usage enable row level security;
alter table public.stripe_events enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "daily_usage_select_own"
  on public.daily_usage for select
  using (auth.uid() = user_id);

create policy "usage_events_select_own"
  on public.usage_events for select
  using (auth.uid() = user_id);

create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_customer_idx on public.subscriptions(stripe_customer_id);
create index if not exists daily_usage_lookup_idx on public.daily_usage(user_id, feature);
create index if not exists usage_events_user_created_idx on public.usage_events(user_id, created_at desc);
