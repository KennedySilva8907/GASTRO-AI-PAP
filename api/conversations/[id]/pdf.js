import { ERROR_CODES, runPreflight } from '../../_shared.js';
import { authenticateRequest } from '../../_auth.js';
import { rateLimit, send429 } from '../../_rate-limit.js';
import { createConversationStore, isConversationId } from '../../_conversations.js';
import { renderConversationPdf, slugify } from '../../_pdf.js';

function buildFileName(conversation) {
  const day = new Date().toISOString().slice(0, 10);
  return `gastroai-${slugify(conversation.title)}-${day}.pdf`;
}

function displayName(user) {
  const local = typeof user.email === 'string' ? user.email.split('@')[0] : '';
  if (!local) return 'Utilizador';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export default async function handler(req, res) {
  if (!runPreflight(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      code: ERROR_CODES.METHOD_NOT_ALLOWED,
    });
  }

  const limit = rateLimit(req, { scope: 'conversation-pdf', max: 12, windowMs: 60_000 });
  if (!limit.allowed) {
    return send429(res, limit.retryAfterSeconds);
  }

  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return res.status(auth.status).json(auth.body);
  }

  const conversationId = req.query?.id;
  if (!isConversationId(conversationId)) {
    return res.status(404).json({
      error: 'Conversation not found',
      code: ERROR_CODES.NOT_FOUND,
    });
  }

  const store = createConversationStore();
  if (!store) {
    return res.status(500).json({
      error: 'Conversation service is not configured',
      code: ERROR_CODES.API_KEY_MISSING,
    });
  }

  try {
    const conversation = await store.getOwned({ conversationId, userId: auth.user.id });
    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found',
        code: ERROR_CODES.NOT_FOUND,
      });
    }

    const messages = await store.listMessages(conversationId);
    if (messages.length === 0) {
      return res.status(400).json({
        error: 'Nothing to export',
        code: ERROR_CODES.INVALID_INPUT,
      });
    }

    const pdf = await renderConversationPdf({
      conversation,
      messages,
      userName: displayName(auth.user),
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${buildFileName(conversation)}"`);
    res.setHeader('Content-Length', pdf.length);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).end(pdf);
  } catch (error) {
    console.error('[Conversation PDF Error]', { message: error?.message });
    return res.status(500).json({
      error: 'Unable to build the PDF',
      code: ERROR_CODES.INTERNAL,
    });
  }
}
