import { describe, it, expect } from 'vitest';
import { UserFacingError } from '../../../src/shared/errors.js';
import {
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
