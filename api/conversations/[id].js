import { ERROR_CODES, GROQ_MODEL, callGroq, runPreflight } from '../_shared.js';
import { authenticateRequest } from '../_auth.js';
import { rateLimit, send429 } from '../_rate-limit.js';
import { createConversationStore, isConversationId, sanitizeTitle } from '../_conversations.js';

const ALLOWED_METHODS = ['GET', 'DELETE', 'PATCH'];
const TITLE_EXCERPT_MAX_LENGTH = 1200;
const TITLE_MAX_TOKENS = 512;
const TITLE_SYSTEM_INSTRUCTION = [
  'Dás um nome a uma conversa de cozinha, para aparecer numa lista estreita.',
  'Resume o assunto em três a cinco palavras. Não copies a pergunta.',
  'Português de Portugal, sem aspas, sem pontuação final, sem markdown, sem prefixos.',
  'Responde apenas com o nome.',
  '',
  'Exemplos:',
  'Pergunta: "ola boa tarde, queria uma receita de mousse de limao" -> Mousse de limão',
  'Pergunta: "o que posso fazer para o jantar de natal para 8 pessoas?" -> Menu de Natal para oito',
  'Pergunta: "que vinho combina com bacalhau à brás" -> Vinho para bacalhau à brás',
].join('\n');

function buildTitleExcerpt(messages) {
  return messages
    .slice(0, 2)
    .map((message) => {
      const who = message.role === 'model' ? 'Assistente' : 'Utilizador';
      return `${who}: ${message.content}`;
    })
    .join('\n')
    .slice(0, TITLE_EXCERPT_MAX_LENGTH);
}

async function generateTitle(messages) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await callGroq({
      apiKey,
      body: {
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: TITLE_SYSTEM_INSTRUCTION },
          { role: 'user', content: buildTitleExcerpt(messages) },
        ],
        max_tokens: TITLE_MAX_TOKENS,
        temperature: 0.3,
        reasoning_effort: 'low',
      },
    });

    if (!response.ok) {
      console.error('[Title Generation Error]', { status: response.status });
      return null;
    }

    const data = await response.json();
    const choice = data?.choices?.[0];
    const title = sanitizeTitle(choice?.message?.content);

    if (!title) {
      console.error('[Title Generation Empty]', {
        finishReason: choice?.finish_reason,
        completionTokens: data?.usage?.completion_tokens,
      });
    }

    return title;
  } catch (error) {
    console.error('[Title Generation Error]', { message: error?.message });
    return null;
  }
}

export default async function handler(req, res) {
  if (!runPreflight(req, res)) return;

  if (!ALLOWED_METHODS.includes(req.method)) {
    return res.status(405).json({
      error: 'Method not allowed',
      code: ERROR_CODES.METHOD_NOT_ALLOWED,
    });
  }

  const limit = rateLimit(req, { scope: 'conversation-detail', max: 60, windowMs: 60_000 });
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

    if (req.method === 'GET') {
      const messages = await store.listMessages(conversationId);
      return res.status(200).json({ conversation, messages });
    }

    if (req.method === 'DELETE') {
      await store.remove({ conversationId, userId: auth.user.id });
      return res.status(204).end();
    }

    if (conversation.title) {
      return res.status(200).json({ title: conversation.title });
    }

    const messages = await store.listMessages(conversationId);
    const firstQuestion = messages.find((message) => message.role === 'user');
    const title = (await generateTitle(messages)) || sanitizeTitle(firstQuestion?.content);

    if (!title) {
      return res.status(200).json({ title: null });
    }

    await store.setTitle({ conversationId, title });
    return res.status(200).json({ title });
  } catch (error) {
    console.error('[Conversation Detail Error]', { message: error?.message });
    return res.status(500).json({
      error: 'Unable to load the conversation',
      code: ERROR_CODES.INTERNAL,
    });
  }
}
