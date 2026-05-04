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
    count: 0,
    window_started_at: '2026-05-04T00:00:00.000Z',
    window_expires_at: '2026-05-05T00:00:00.000Z',
  };

  it('denies a free user who has reached the chat limit within the active window', async () => {
    const store = {
      ensureProfile: vi.fn(),
      getLatestSubscription: vi.fn().mockResolvedValue(null),
      getUsageWindow: vi.fn().mockResolvedValue({
        ...windowActive,
        count: PLAN_LIMITS.free.chat,
      }),
      setUsageWindow: vi.fn(),
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
    expect(store.setUsageWindow).not.toHaveBeenCalled();
    expect(store.insertUsageEvent).not.toHaveBeenCalled();
  });

  it('increments usage for a pro user within the challenge limit', async () => {
    const store = {
      ensureProfile: vi.fn(),
      getLatestSubscription: vi.fn().mockResolvedValue({
        status: 'active',
        current_period_end: '2026-05-10T00:00:00.000Z',
      }),
      getUsageWindow: vi.fn().mockResolvedValue({
        ...windowActive,
        count: 4,
      }),
      setUsageWindow: vi.fn().mockResolvedValue(undefined),
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
    expect(result.usage.remaining).toBe(PLAN_LIMITS.pro.challenge_recipe - 5);
    expect(store.setUsageWindow).toHaveBeenCalledWith({
      userId: 'user-1',
      feature: 'challenge_recipe',
      count: 5,
      windowStartedAt: windowActive.window_started_at,
      windowExpiresAt: windowActive.window_expires_at,
    });
    expect(store.insertUsageEvent).toHaveBeenCalledWith({
      userId: 'user-1',
      feature: 'challenge_recipe',
      plan: 'pro',
    });
  });

  it('resets usage and starts a new window when the previous window has expired', async () => {
    const store = {
      ensureProfile: vi.fn(),
      getLatestSubscription: vi.fn().mockResolvedValue(null),
      getUsageWindow: vi.fn().mockResolvedValue({
        count: PLAN_LIMITS.free.chat,
        window_started_at: '2026-05-03T00:00:00.000Z',
        window_expires_at: '2026-05-04T00:00:00.000Z', // expired — now is 12:00
      }),
      setUsageWindow: vi.fn().mockResolvedValue(undefined),
      insertUsageEvent: vi.fn().mockResolvedValue(undefined),
    };

    const result = await checkAndIncrementUsage({
      store,
      user: { id: 'user-1', email: 'chef@example.com' },
      feature: 'chat',
      now,
    });

    expect(result.allowed).toBe(true);
    expect(result.usage.used).toBe(1);
    expect(store.setUsageWindow).toHaveBeenCalledWith({
      userId: 'user-1',
      feature: 'chat',
      count: 1,
      windowStartedAt: now.toISOString(),
      windowExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    });
  });

  it('starts a fresh window when no prior usage exists', async () => {
    const store = {
      ensureProfile: vi.fn(),
      getLatestSubscription: vi.fn().mockResolvedValue(null),
      getUsageWindow: vi.fn().mockResolvedValue(null),
      setUsageWindow: vi.fn().mockResolvedValue(undefined),
      insertUsageEvent: vi.fn().mockResolvedValue(undefined),
    };

    const result = await checkAndIncrementUsage({
      store,
      user: { id: 'user-1', email: 'chef@example.com' },
      feature: 'chat',
      now,
    });

    expect(result.allowed).toBe(true);
    expect(result.usage.used).toBe(1);
    expect(store.setUsageWindow).toHaveBeenCalledWith({
      userId: 'user-1',
      feature: 'chat',
      count: 1,
      windowStartedAt: now.toISOString(),
      windowExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    });
  });
});
