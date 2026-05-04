import {
  callGroq,
  ERROR_CODES,
  GROQ_MODEL,
  groqToGeminiResponse,
  runPreflight,
} from './_shared.js';
import { authenticateRequest } from './_auth.js';
import { checkAndIncrementUsage } from './_usage.js';

const CHAT_MAX_OUTPUT_TOKENS = 3072;
const CHAT_MESSAGE_MAX_LENGTH = 500;
const CHAT_HISTORY_MAX_ENTRIES = 10;
const CHAT_HISTORY_ENTRY_MAX_LENGTH = 4000;
const CHAT_SYSTEM_INSTRUCTION = [
  'És o GastroAI, um chef português apaixonado por gastronomia. Falas sempre em português de Portugal, com naturalidade — frases curtas, tom caloroso e confiante, nada de jargão de call center.',
  '',
  'Trata o utilizador por "tu" por defeito; se ele usar "você", segue-lhe o registo. Presta atenção ao que ele te diz sobre si (género, nível de experiência, alergias, tempo disponível, equipamento que tem) e mantém essa informação ao longo da conversa, sem precisar que ele a repita.',
  '',
  'Calibra o detalhe da resposta ao pedido:',
  '- Cumprimento ou conversa solta → responde em 1 ou 2 frases, em prosa, sem listas nem cabeçalhos.',
  '- Pedido ambíguo (ex: "ensina-me um ovo à francesa" pode ser omelete ou escalfado; "quero uma sobremesa" depende de quantas pessoas e quanto tempo há) → faz UMA pergunta curta de esclarecimento antes de avançar com a receita.',
  '- Receita pedida em concreto → estrutura clara: ingredientes com quantidades, passos numerados, uma dica de chef no fim. Não dês duas receitas quando chega uma; oferece a alternativa só se o utilizador quiser.',
  '',
  'Emojis com parcimónia (no máximo um por mensagem, e só quando soa natural). Não listes todas as áreas em que podes ajudar como se fosses um menu — soa a robô.',
  '',
  'Só ajudas em temas de cozinha, gastronomia, ingredientes, técnicas, segurança alimentar, harmonizações e planeamento de refeições. Se o pedido fugir do tema, redirecciona com leveza (ex: "Aí já não chego — mas se for fome, conta comigo. O que te apetece?") em vez de uma recusa formal.',
].join('\n');

function normalizeChatRequestBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > CHAT_MESSAGE_MAX_LENGTH) {
    return null;
  }

  const rawHistory = body.history ?? [];
  if (!Array.isArray(rawHistory) || rawHistory.length > CHAT_HISTORY_MAX_ENTRIES) {
    return null;
  }

  const history = [];
  for (const entry of rawHistory) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return null;
    }

    const role = entry.role;
    const text = typeof entry.text === 'string' ? entry.text.trim() : '';
    if (!['user', 'model'].includes(role) || !text || text.length > CHAT_HISTORY_ENTRY_MAX_LENGTH) {
      return null;
    }

    history.push({ role, text });
  }

  return { message, history };
}

function buildChatGroqPayload({ message, history }) {
  const messages = [
    { role: 'system', content: CHAT_SYSTEM_INSTRUCTION },
    ...history.map((entry) => ({
      role: entry.role === 'model' ? 'assistant' : 'user',
      content: entry.text,
    })),
    { role: 'user', content: message },
  ];

  return {
    model: GROQ_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: CHAT_MAX_OUTPUT_TOKENS,
  };
}

export default async function handler(req, res) {
  if (!runPreflight(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      code: ERROR_CODES.METHOD_NOT_ALLOWED,
    });
  }

  try {
    const auth = await authenticateRequest(req);
    if (!auth.ok) {
      return res.status(auth.status).json(auth.body);
    }

    const API_KEY = process.env.GROQ_API_KEY;

    if (!API_KEY) {
      console.error('[Config Error] GROQ_API_KEY not found in environment');
      return res.status(500).json({
        error: 'Service temporarily unavailable',
        code: ERROR_CODES.API_KEY_MISSING,
      });
    }

    const normalizedRequest = normalizeChatRequestBody(req.body);
    if (!normalizedRequest) {
      return res.status(400).json({
        error: 'Invalid chat request payload',
        code: ERROR_CODES.INVALID_INPUT,
      });
    }

    const usageGate = await checkAndIncrementUsage({
      user: auth.user,
      feature: 'chat',
    });
    if (!usageGate.allowed) {
      return res.status(usageGate.status).json(usageGate.body);
    }

    const response = await callGroq({
      apiKey: API_KEY,
      body: buildChatGroqPayload(normalizedRequest),
    });

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        // ignore body parse failure
      }
      console.error('Groq API Error (chat):', response.status, errorBody);
      return res.status(response.status).json({
        error: 'An error occurred processing your request',
        code: ERROR_CODES.GROQ_API,
      });
    }

    const data = await response.json();
    return res.status(200).json(groqToGeminiResponse(data));
  } catch (error) {
    console.error('[Chat Error]', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    return res.status(500).json({
      error: 'An error occurred processing your request',
      code: ERROR_CODES.INTERNAL,
    });
  }
}
