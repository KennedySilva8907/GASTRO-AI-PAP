// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';

const store = new Map();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  },
});

const { readPlan, writePlan, clearPlan, planLabel, shouldOfferUpgrade } =
  await import('../../../src/auth/plan-cache.js');

describe('shouldOfferUpgrade', () => {
  it('never offers the upgrade to someone who already pays', () => {
    expect(shouldOfferUpgrade('pro')).toBe(false);
  });

  it('offers it to a free account', () => {
    expect(shouldOfferUpgrade('free')).toBe(true);
  });

  it('stays quiet while the plan is still unknown', () => {
    expect(shouldOfferUpgrade(null)).toBe(false);
    expect(shouldOfferUpgrade(undefined)).toBe(false);
  });
});

describe('planLabel', () => {
  it('names the two plans', () => {
    expect(planLabel('pro')).toBe('Pro');
    expect(planLabel('free')).toBe('Free');
  });

  it('says nothing when the plan is unknown', () => {
    expect(planLabel(null)).toBeNull();
  });
});

describe('remembering the plan between pages', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('gives back what was written for that account', () => {
    writePlan('user-1', 'pro');

    expect(readPlan('user-1')).toBe('pro');
  });

  it('does not hand one account the plan of another', () => {
    writePlan('user-1', 'pro');

    expect(readPlan('user-2')).toBeNull();
  });

  it('returns nothing when there is no user', () => {
    writePlan('user-1', 'pro');

    expect(readPlan(null)).toBeNull();
    expect(readPlan(undefined)).toBeNull();
  });

  it('refuses to remember a plan it does not recognise', () => {
    writePlan('user-1', 'enterprise');

    expect(readPlan('user-1')).toBeNull();
  });

  it('forgets everything on sign out', () => {
    writePlan('user-1', 'pro');
    clearPlan();

    expect(readPlan('user-1')).toBeNull();
  });

  it('survives a browser that refuses storage', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('bloqueado');
        },
        setItem: () => {
          throw new Error('bloqueado');
        },
        removeItem: () => {
          throw new Error('bloqueado');
        },
      },
    });

    expect(() => writePlan('user-1', 'pro')).not.toThrow();
    expect(readPlan('user-1')).toBeNull();
    expect(() => clearPlan()).not.toThrow();

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
      },
    });
  });
});
