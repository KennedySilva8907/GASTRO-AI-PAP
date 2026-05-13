import { describe, expect, it, vi } from 'vitest';
import {
  PLAN_LIMITS,
  checkAndIncrementUsage,
  getPlanFromSubscription,
} from '../../../api/_usage.js';

describe('getPlanFromSubscription', () => {
  it('returns pro for an active subscription inside the billing period', () => {
    expect(
      getPlanFromSubscription(
        {
          status: 'active',
          current_period_end: '2026-05-10T00:00:00.000Z',
        },
        new Date('2026-05-04T00:00:00.000Z')
      )
    ).toBe('pro');
  });

  it('falls back to free when there is no active subscription', () => {
    expect(getPlanFromSubscription(null)).toBe('free');
    expect(getPlanFromSubscription({ status: 'canceled' })).toBe('free');
  });
});

describe('checkAndIncrementUsage', () => {
  const now = new Date('2026-05-04T12:00:00.000Z');
  const windowActive = {
    window_started_at: '2026-05-04T00:00:00.000Z',
    window_expires_at: '2026-05-05T00:00:00.000Z',
  };

  it('denies a free user who has reached the chat limit within the active window', async () => {
    const store = {
      ensureProfile: vi.fn(),
      getLatestSubscription: vi.fn().mockResolvedValue(null),
      atomicCheckAndIncrement: vi.fn().mockResolvedValue({
        allowed: false,
        count: PLAN_LIMITS.free.chat,
        ...windowActive,
      }),
      insertUsageEvent: vi.fn(),
    };

    const result = await checkAndIncrementUsage({
      store,
      user: { id: 'user-1', email: 'chef@example.com' },
      feature: 'chat',
      now,
    });

    expect(result.allowed).toBe(false);
    expect(result.status).toBe(429);
    expect(result.body.code).toBe('ERR_RATE_LIMIT_001');
    expect(result.usage.used).toBe(PLAN_LIMITS.free.chat);
    expect(store.insertUsageEvent).not.toHaveBeenCalled();
    expect(store.atomicCheckAndIncrement).toHaveBeenCalledWith({
      userId: 'user-1',
      feature: 'chat',
      limit: PLAN_LIMITS.free.chat,
      now,
    });
  });

  it('increments usage for a pro user within the challenge limit', async () => {
    const store = {
      ensureProfile: vi.fn(),
      getLatestSubscription: vi.fn().mockResolvedValue({
        status: 'active',
        current_period_end: '2026-05-10T00:00:00.000Z',
      }),
      atomicCheckAndIncrement: vi.fn().mockResolvedValue({
        allowed: true,
        count: 5,
        ...windowActive,
      }),
      insertUsageEvent: vi.fn().mockResolvedValue(undefined),
    };

    const result = await checkAndIncrementUsage({
      store,
      user: { id: 'user-1', email: 'chef@example.com' },
      feature: 'challenge_recipe',
      now,
    });

    expect(result.allowed).toBe(true);
    expect(result.plan).toBe('pro');
    expect(result.usage.used).toBe(5);
    expect(result.usage.remaining).toBe(PLAN_LIMITS.pro.challenge_recipe - 5);
    expect(store.atomicCheckAndIncrement).toHaveBeenCalledWith({
      userId: 'user-1',
      feature: 'challenge_recipe',
      limit: PLAN_LIMITS.pro.challenge_recipe,
      now,
    });
    expect(store.insertUsageEvent).toHaveBeenCalledWith({
      userId: 'user-1',
      feature: 'challenge_recipe',
      plan: 'pro',
    });
  });

  it('passes the current limit to the atomic RPC for free users', async () => {
    const store = {
      ensureProfile: vi.fn(),
      getLatestSubscription: vi.fn().mockResolvedValue(null),
      atomicCheckAndIncrement: vi.fn().mockResolvedValue({
        allowed: true,
        count: 1,
        ...windowActive,
      }),
      insertUsageEvent: vi.fn().mockResolvedValue(undefined),
    };

    await checkAndIncrementUsage({
      store,
      user: { id: 'user-1', email: 'chef@example.com' },
      feature: 'chat',
      now,
    });

    expect(store.atomicCheckAndIncrement).toHaveBeenCalledWith({
      userId: 'user-1',
      feature: 'chat',
      limit: PLAN_LIMITS.free.chat,
      now,
    });
  });

  it('still allows the request even if usage_event log fails', async () => {
    // The atomic RPC has already committed the count — failing to log
    // the analytics event must not throw or break the user-facing flow.
    const store = {
      ensureProfile: vi.fn(),
      getLatestSubscription: vi.fn().mockResolvedValue(null),
      atomicCheckAndIncrement: vi.fn().mockResolvedValue({
        allowed: true,
        count: 3,
        ...windowActive,
      }),
      insertUsageEvent: vi.fn().mockRejectedValue(new Error('log failed')),
    };

    const result = await checkAndIncrementUsage({
      store,
      user: { id: 'user-1', email: 'chef@example.com' },
      feature: 'chat',
      now,
    });

    expect(result.allowed).toBe(true);
    expect(result.usage.used).toBe(3);
  });
});
