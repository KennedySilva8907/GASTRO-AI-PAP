import { describe, it, expect } from 'vitest';
import { UserFacingError } from '../../../src/shared/errors.js';
import {
  MAX_HISTORY_ENTRIES,
  buildChatRequestPayload,
  extractChatResponseText,
  getTypeSpeed,
} from '../../../src/chat/chat-api.js';

describe('buildChatRequestPayload', () => {
  it('trims the message and keeps only the newest history entries', () => {
    const history = Array.from({ length: MAX_HISTORY_ENTRIES + 2 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'model',
      text: `mensagem ${index}`,
    }));

    expect(buildChatRequestPayload('  Como temperar salmão?  ', history)).toEqual({
      message: 'Como temperar salmão?',
      history: history.slice(-MAX_HISTORY_ENTRIES),
    });
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
              parts: [{ text: 'Olá ' }, { inlineData: { mimeType: 'image/png' } }, { text: 'chef' }],
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
