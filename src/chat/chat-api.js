import { UserFacingError } from '../shared/errors.js';

export const MAX_HISTORY_PAIRS = 5;
export const MAX_HISTORY_ENTRIES = MAX_HISTORY_PAIRS * 2;
export const MAX_MESSAGE_LENGTH = 500;
export const DEFAULT_TYPING_SPEED = 10;
export const MAX_TYPING_TIME = 30000;

const BLOCKED_RESPONSE_MESSAGE =
  'Não consegui responder a esse pedido com segurança. Tente reformular a pergunta.';
const EMPTY_RESPONSE_MESSAGE = 'A resposta da IA veio vazia. Tente novamente.';

const BLOCKED_FINISH_REASONS = new Set([
  'SAFETY',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
  'RECITATION',
]);

export function buildChatRequestPayload(message, history = []) {
  return {
    message: String(message ?? '').trim().slice(0, MAX_MESSAGE_LENGTH),
    history: history.slice(-MAX_HISTORY_ENTRIES),
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
