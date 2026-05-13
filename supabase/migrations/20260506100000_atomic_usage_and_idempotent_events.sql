-- ============================================================
-- Atomic primitives to close two TOCTOU race conditions:
--   1. daily_usage check-then-increment (free-plan limit bypass)
--   2. stripe_events idempotency check-then-mark (duplicate webhook processing)
-- Both functions are SECURITY DEFINER so RLS doesn't block them and only
-- service_role is granted EXECUTE — never callable from anon/authenticated
-- clients directly.
-- ============================================================

-- Atomic check-and-increment for daily_usage.
-- Locks the row for the duration of the transaction (FOR UPDATE),
-- starts a fresh 24h window if the previous expired, denies if at limit,
-- otherwise increments. Returns the new state as JSON.
create or replace function public.check_and_increment_usage(
  p_user_id uuid,
  p_feature text,
  p_limit int,
  p_now timestamptz
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_started timestamptz;
  v_expires timestamptz;
begin
  select count, window_started_at, window_expires_at
    into v_count, v_started, v_expires
  from public.daily_usage
  where user_id = p_user_id and feature = p_feature
  for update;

  -- New window if no row or expired
  if not found or p_now >= v_expires then
    v_count := 0;
    v_started := p_now;
    v_expires := p_now + interval '24 hours';
  end if;

  if v_count >= p_limit then
    return json_build_object(
      'allowed', false,
      'count', v_count,
      'window_started_at', v_started,
      'window_expires_at', v_expires
    );
  end if;

  insert into public.daily_usage
    (user_id, feature, count, window_started_at, window_expires_at, updated_at)
  values
    (p_user_id, p_feature, v_count + 1, v_started, v_expires, now())
  on conflict (user_id, feature) do update set
    count = excluded.count,
    window_started_at = excluded.window_started_at,
    window_expires_at = excluded.window_expires_at,
    updated_at = excluded.updated_at;

  return json_build_object(
    'allowed', true,
    'count', v_count + 1,
    'window_started_at', v_started,
    'window_expires_at', v_expires
  );
end;
$$;

-- Atomic register-event for Stripe webhook idempotency.
-- Returns true when the event was newly inserted (caller should process it),
-- false when it was already there (caller should skip).
-- Race-safe via UNIQUE constraint on stripe_events.id.
create or replace function public.register_stripe_event(
  p_event_id text,
  p_event_type text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted_id text;
begin
  insert into public.stripe_events (id, event_type)
  values (p_event_id, p_event_type)
  on conflict (id) do nothing
  returning id into v_inserted_id;

  return v_inserted_id is not null;
end;
$$;

-- Lock down execution: only service_role
revoke all on function public.check_and_increment_usage(uuid, text, int, timestamptz) from public, anon, authenticated;
revoke all on function public.register_stripe_event(text, text) from public, anon, authenticated;
grant execute on function public.check_and_increment_usage(uuid, text, int, timestamptz) to service_role;
grant execute on function public.register_stripe_event(text, text) to service_role;
