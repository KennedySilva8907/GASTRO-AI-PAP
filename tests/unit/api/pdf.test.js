import { describe, it, expect } from 'vitest';
import { stripEmoji, markdownToBlocks, slugify, signerName } from '../../../api/_pdf.js';

describe('stripEmoji', () => {
  it('removes emoji that have no glyph in the embedded fonts', () => {
    expect(stripEmoji('Bom apetite 🍝')).toBe('Bom apetite');
  });

  it('leaves Portuguese accents alone', () => {
    expect(stripEmoji('ação, pêssego, açúcar, ãõ')).toBe('ação, pêssego, açúcar, ãõ');
  });

  it('does not leave a double space where the emoji was', () => {
    expect(stripEmoji('mexe 🔥 sempre')).toBe('mexe sempre');
  });

  it('handles anything that is not a string', () => {
    expect(stripEmoji(null)).toBe('');
    expect(stripEmoji(42)).toBe('');
  });
});

describe('markdownToBlocks', () => {
  it('turns a heading into a heading block', () => {
    expect(markdownToBlocks('## Ingredientes')).toEqual([
      { type: 'heading', text: 'Ingredientes' },
    ]);
  });

  it('keeps an unordered list as a list', () => {
    expect(markdownToBlocks('- 320 g de arroz\n- 1 L de caldo')).toEqual([
      { type: 'list', ordered: false, items: ['320 g de arroz', '1 L de caldo'] },
    ]);
  });

  it('marks a numbered list as ordered', () => {
    const blocks = markdownToBlocks('1. Aquece o caldo\n2. Refoga a cebola');

    expect(blocks[0].ordered).toBe(true);
    expect(blocks[0].items).toEqual(['Aquece o caldo', 'Refoga a cebola']);
  });

  it('flattens bold and italic into plain text', () => {
    expect(markdownToBlocks('**Dica do chef:** mexe sempre')).toEqual([
      { type: 'paragraph', text: 'Dica do chef: mexe sempre' },
    ]);
  });

  it('keeps a real recipe in the right order', () => {
    const markdown = [
      'Com esses dois ja la vais.',
      '',
      '## Ingredientes',
      '- 320 g de arroz',
      '',
      '## Preparacao',
      '1. Aquece o caldo',
      '2. Refoga a cebola',
      '',
      '**Dica:** mexe sempre',
    ].join('\n');

    expect(markdownToBlocks(markdown).map((b) => b.type)).toEqual([
      'paragraph',
      'heading',
      'list',
      'heading',
      'list',
      'paragraph',
    ]);
  });

  it('falls back to a paragraph for markdown it cannot draw', () => {
    expect(markdownToBlocks('| a | b |\n| --- | --- |\n| 1 | 2 |')[0].type).toBe('paragraph');
  });

  it('returns an empty array for empty input', () => {
    expect(markdownToBlocks('')).toEqual([]);
    expect(markdownToBlocks(null)).toEqual([]);
  });

  it('strips emoji inside list items too', () => {
    expect(markdownToBlocks('- arroz 🍚')[0].items).toEqual(['arroz']);
  });
});

describe('slugify', () => {
  it('strips accents and spaces for the file name', () => {
    expect(slugify('Risoto de cogumelos à moda')).toBe('risoto-de-cogumelos-a-moda');
  });

  it('never returns an empty name', () => {
    expect(slugify('')).toBe('conversa');
    expect(slugify(null)).toBe('conversa');
    expect(slugify('!!!')).toBe('conversa');
  });

  it('caps the length', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(50);
  });
});

describe('signerName', () => {
  it('uses the name the account was registered with', () => {
    const user = {
      email: 'kakabob555@gmail.com',
      claims: { user_metadata: { name: 'Kennedy Silva' } },
    };

    expect(signerName(user)).toBe('Kennedy Silva');
  });

  it('trims a name that was typed with spaces around it', () => {
    const user = { email: 'a@b.pt', claims: { user_metadata: { name: '  Ana Sousa ' } } };

    expect(signerName(user)).toBe('Ana Sousa');
  });

  it('falls back to the email when the account has no name', () => {
    expect(signerName({ email: 'kennedy@example.com', claims: {} })).toBe('Kennedy');
  });

  it('falls back to the email when the name is only spaces', () => {
    const user = { email: 'kennedy@example.com', claims: { user_metadata: { name: '   ' } } };

    expect(signerName(user)).toBe('Kennedy');
  });

  it('survives an account with no email and no name', () => {
    expect(signerName({})).toBe('Utilizador');
    expect(signerName(null)).toBe('Utilizador');
  });
});
