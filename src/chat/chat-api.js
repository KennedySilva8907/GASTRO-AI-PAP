import { UserFacingError } from '../shared/errors.js';

export const MAX_MESSAGE_LENGTH = 500;
export const DEFAULT_TYPING_SPEED = 10;
export const MAX_TYPING_TIME = 30000;

const BLOCKED_RESPONSE_MESSAGE =
  'Não consegui responder a esse pedido com segurança. Tente reformular a pergunta.';
const EMPTY_RESPONSE_MESSAGE = 'A resposta da IA veio vazia. Tente novamente.';

const API_ERROR_MESSAGES = {
  ERR_RATE_LIMIT_001:
    'Chegaste ao limite de mensagens de hoje do plano free. A contagem renova dentro de 24 horas, ou podes passar a pro.',
  ERR_RATE_LIMIT_002: 'Estás a enviar muito depressa. Espera uns segundos e tenta outra vez.',
  ERR_NOTFOUND_001: 'Essa conversa já não existe. Começa uma nova.',
  ERR_AUTH_001: 'A tua sessão expirou. Inicia sessão outra vez.',
  ERR_CONFIG_001: 'O serviço está indisponível neste momento. Tenta daqui a pouco.',
  ERR_GROQ_001: 'O assistente não respondeu desta vez. Tenta outra vez.',
  ERR_INPUT_001: 'Não consegui perceber esse pedido. Tenta reformular.',
  ERR_PAYLOAD_001: 'Essa mensagem é demasiado longa.',
};

export function messageForApiError({ code, status }) {
  if (code && API_ERROR_MESSAGES[code]) return API_ERROR_MESSAGES[code];
  if (status === 429) return API_ERROR_MESSAGES.ERR_RATE_LIMIT_001;
  if (status === 404) return API_ERROR_MESSAGES.ERR_NOTFOUND_001;
  if (status === 401) return API_ERROR_MESSAGES.ERR_AUTH_001;
  return 'Desculpe, ocorreu um erro ao processar a sua mensagem. Por favor, tente novamente.';
}

const BLOCKED_FINISH_REASONS = new Set([
  'SAFETY',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
  'RECITATION',
]);

export function buildChatRequestPayload(message, conversationId) {
  return {
    message: String(message ?? '')
      .trim()
      .slice(0, MAX_MESSAGE_LENGTH),
    conversationId,
  };
}

export function extractChatResponseText(data) {
  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new UserFacingError(
      `Gemini blocked the prompt with reason: ${blockReason}`,
      BLOCKED_RESPONSE_MESSAGE
    );
  }

  const candidate = data?.candidates?.[0];
  const responseText = (candidate?.content?.parts ?? [])
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();

  if (responseText) {
    return responseText;
  }

  const finishReason = candidate?.finishReason;
  if (BLOCKED_FINISH_REASONS.has(finishReason)) {
    throw new UserFacingError(
      `Gemini stopped the response with finish reason: ${finishReason}`,
      BLOCKED_RESPONSE_MESSAGE
    );
  }

  throw new UserFacingError(
    `Gemini returned no usable text${finishReason ? ` (${finishReason})` : ''}`,
    EMPTY_RESPONSE_MESSAGE
  );
}

export function getTypeSpeed(
  htmlContent,
  typingSpeed = DEFAULT_TYPING_SPEED,
  maxTypingTime = MAX_TYPING_TIME
) {
  const contentLength = Math.max(htmlContent.length, 1);
  const typingTime = Math.min(contentLength * typingSpeed, maxTypingTime);
  return typingTime / contentLength;
}
