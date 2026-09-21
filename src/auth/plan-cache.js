const PLAN_KEY = 'gastro-plan';
const KNOWN_PLANS = new Set(['free', 'pro']);

export function planLabel(plan) {
  if (plan === 'pro') return 'Pro';
  if (plan === 'free') return 'Free';
  return null;
}

export function shouldOfferUpgrade(plan) {
  return plan === 'free';
}

export function readPlan(userId) {
  if (!userId) return null;

  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return null;

    const stored = JSON.parse(raw);
    if (stored?.userId !== userId) return null;
    return KNOWN_PLANS.has(stored?.plan) ? stored.plan : null;
  } catch {
    return null;
  }
}

export function writePlan(userId, plan) {
  if (!userId || !KNOWN_PLANS.has(plan)) return;

  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify({ userId, plan }));
  } catch {
    return;
  }
}

export function clearPlan() {
  try {
    localStorage.removeItem(PLAN_KEY);
  } catch {
    return;
  }
}
