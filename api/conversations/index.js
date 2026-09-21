import { ERROR_CODES, runPreflight } from '../_shared.js';
import { authenticateRequest } from '../_auth.js';
import { rateLimit, send429 } from '../_rate-limit.js';
import { createSupabaseUsageStore, getPlanFromSubscription } from '../_usage.js';
import {
  FREE_CONVERSATION_LIMIT,
  createConversationStore,
  isOverConversationLimit,
} from '../_conversations.js';

async function resolvePlan(userId) {
  const usageStore = createSupabaseUsageStore();
  if (!usageStore) return 'free';

  const subscription = await usageStore.getLatestSubscription(userId);
  return getPlanFromSubscription(subscription);
}

export default async function handler(req, res) {
  if (!runPreflight(req, res)) return;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      code: ERROR_CODES.METHOD_NOT_ALLOWED,
    });
  }

  const limit = rateLimit(req, { scope: 'conversations', max: 60, windowMs: 60_000 });
  if (!limit.allowed) {
    return send429(res, limit.retryAfterSeconds);
  }

  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return res.status(auth.status).json(auth.body);
  }

  const store = createConversationStore();
  if (!store) {
    return res.status(500).json({
      error: 'Conversation service is not configured',
      code: ERROR_CODES.API_KEY_MISSING,
    });
  }

  try {
    const conversations = await store.listForUser(auth.user.id);

    if (req.method === 'GET') {
      return res.status(200).json({ conversations });
    }

    const reusable = conversations.find((conversation) => conversation.message_count === 0);
    if (reusable) {
      return res.status(201).json({ conversation: reusable });
    }

    const plan = await resolvePlan(auth.user.id);
    if (isOverConversationLimit({ plan, count: conversations.length })) {
      return res.status(409).json({
        error: 'Saved conversation limit reached',
        code: 'ERR_CONVERSATION_LIMIT',
        limit: FREE_CONVERSATION_LIMIT,
        conversations,
      });
    }

    const conversation = await store.create(auth.user.id);
    return res.status(201).json({ conversation });
  } catch (error) {
    console.error('[Conversations Error]', { message: error?.message });
    return res.status(500).json({
      error: 'Unable to load conversations',
      code: ERROR_CODES.INTERNAL,
    });
  }
}
