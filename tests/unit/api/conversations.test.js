import { describe, it, expect } from 'vitest';
import {
  FREE_CONVERSATION_LIMIT,
  sanitizeTitle,
  buildHistory,
  isOverConversationLimit,
} from '../../../api/_conversations.js';

describe('sanitizeTitle', () => {
  it('strips the quotes the model likes to wrap titles in', () => {
    expect(sanitizeTitle('"Risoto de cogumelos"')).toBe('Risoto de cogumelos');
  });

  it('strips markdown emphasis and heading marks', () => {
    expect(sanitizeTitle('## **Menu de Natal**')).toBe('Menu de Natal');
  });

  it('collapses a title spread over two lines', () => {
    expect(sanitizeTitle('Harmonizar\nvinho do Douro')).toBe('Harmonizar vinho do Douro');
  });

  it('caps the length at 60 characters', () => {
    expect(sanitizeTitle('a'.repeat(120))).toHaveLength(60);
  });

  it('returns null for anything empty or not a string', () => {
    expect(sanitizeTitle('   ')).toBeNull();
    expect(sanitizeTitle('')).toBeNull();
    expect(sanitizeTitle(null)).toBeNull();
    expect(sanitizeTitle(42)).toBeNull();
  });

  it('keeps Portuguese accents intact', () => {
    expect(sanitizeTitle('Pêssego em calda de açúcar')).toBe('Pêssego em calda de açúcar');
  });
});

describe('buildHistory', () => {
  const messages = [
    { role: 'user', content: 'um' },
    { role: 'model', content: 'dois' },
    { role: 'user', content: 'tres' },
    { role: 'model', content: 'quatro' },
  ];

  it('renames content to text because that is what the payload wants', () => {
    expect(buildHistory(messages, 10)).toEqual([
      { role: 'user', text: 'um' },
      { role: 'model', text: 'dois' },
      { role: 'user', text: 'tres' },
      { role: 'model', text: 'quatro' },
    ]);
  });

  it('keeps only the most recent entries', () => {
    expect(buildHistory(messages, 2)).toEqual([
      { role: 'user', text: 'tres' },
      { role: 'model', text: 'quatro' },
    ]);
  });

  it('drops entries with empty content', () => {
    expect(buildHistory([{ role: 'user', content: '  ' }], 10)).toEqual([]);
  });

  it('treats an unknown role as user', () => {
    expect(buildHistory([{ role: 'assistant', content: 'oi' }], 10)).toEqual([
      { role: 'user', text: 'oi' },
    ]);
  });

  it('returns an empty array when given nothing', () => {
    expect(buildHistory(null, 10)).toEqual([]);
    expect(buildHistory(undefined, 10)).toEqual([]);
  });
});

describe('isOverConversationLimit', () => {
  it('stops a free account at three', () => {
    expect(isOverConversationLimit({ plan: 'free', count: 2 })).toBe(false);
    expect(isOverConversationLimit({ plan: 'free', count: 3 })).toBe(true);
    expect(isOverConversationLimit({ plan: 'free', count: 9 })).toBe(true);
  });

  it('never stops a pro account', () => {
    expect(isOverConversationLimit({ plan: 'pro', count: 500 })).toBe(false);
  });

  it('exposes the limit so the dialog can say the number', () => {
    expect(FREE_CONVERSATION_LIMIT).toBe(3);
  });
});
