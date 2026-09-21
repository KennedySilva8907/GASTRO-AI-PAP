import { describe, it, expect } from 'vitest';
import { UserFacingError } from '../../../src/shared/errors.js';
import {
  messageForApiError,
  buildChatRequestPayload,
  extractChatResponseText,
  getTypeSpeed,
} from '../../../src/chat/chat-api.js';

describe('buildChatRequestPayload', () => {
  it('trims the message and carries the conversation id', () => {
    expect(buildChatRequestPayload('  Como temperar salmão?  ', 'conv-1')).toEqual({
      message: 'Como temperar salmão?',
      conversationId: 'conv-1',
    });
  });

  it('sends no history, because the server reads it from the database', () => {
    expect(buildChatRequestPayload('ola', 'conv-1')).not.toHaveProperty('history');
  });

  it('caps the message length', () => {
    const payload = buildChatRequestPayload('a'.repeat(900), 'conv-1');

    expect(payload.message).toHaveLength(500);
  });
});

describe('extractChatResponseText', () => {
  it('joins text parts from the first Gemini candidate', () => {
    expect(
      extractChatResponseText({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                { text: 'Olá ' },
                { inlineData: { mimeType: 'image/png' } },
                { text: 'chef' },
              ],
            },
          },
        ],
      })
    ).toBe('Olá chef');
  });

  it('throws a user-facing error when Gemini blocks the prompt', () => {
    expect(() =>
      extractChatResponseText({
        promptFeedback: {
          blockReason: 'SAFETY',
        },
      })
    ).toThrow(UserFacingError);
  });

  it('throws a user-facing error when the candidate has no text', () => {
    let thrownError;

    try {
      extractChatResponseText({
        candidates: [
          {
            finishReason: 'OTHER',
            content: {
              parts: [{ inlineData: { mimeType: 'image/png' } }],
            },
          },
        ],
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(UserFacingError);
    expect(thrownError.userMessage).toBe('A resposta da IA veio vazia. Tente novamente.');
  });
});

describe('getTypeSpeed', () => {
  it('falls back to the default speed when html content is empty', () => {
    const typeSpeed = getTypeSpeed('');

    expect(typeSpeed).toBeGreaterThan(0);
    expect(Number.isNaN(typeSpeed)).toBe(false);
  });
});

describe('messageForApiError', () => {
  it('says you ran out of daily messages instead of a generic error', () => {
    const text = messageForApiError({ code: 'ERR_RATE_LIMIT_001', status: 429 });

    expect(text).toContain('limite de mensagens de hoje');
    expect(text).not.toContain('ocorreu um erro');
  });

  it('falls back on the status when there is no code', () => {
    expect(messageForApiError({ status: 429 })).toContain('limite de mensagens');
    expect(messageForApiError({ status: 404 })).toContain('já não existe');
    expect(messageForApiError({ status: 401 })).toContain('sessão');
  });

  it('tells you to slow down when you are being rate limited by IP', () => {
    expect(messageForApiError({ code: 'ERR_RATE_LIMIT_002' })).toContain('muito depressa');
  });

  it('keeps the old generic message for anything it does not know', () => {
    expect(messageForApiError({ code: 'ERR_SOMETHING_NEW', status: 500 })).toContain(
      'ocorreu um erro'
    );
  });
});
