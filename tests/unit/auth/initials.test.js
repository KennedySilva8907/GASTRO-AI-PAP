import { describe, it, expect } from 'vitest';
import { initials } from '../../../src/auth/initials.js';

describe('initials', () => {
  it('returns "?" for empty/nullish input', () => {
    expect(initials('')).toBe('?');
    expect(initials(null)).toBe('?');
    expect(initials(undefined)).toBe('?');
    expect(initials('   ')).toBe('?');
  });

  it('uses the email local part when given an email', () => {
    expect(initials('vitoria@gmail.com')).toBe('VI');
    expect(initials('joao.paulo@x.com')).toBe('JP');
  });

  it('strips digits and punctuation from the local part', () => {
    // 'joao.paulo928' -> parts 'joao', 'paulo' (digits stripped)
    expect(initials('joao.paulo928@gmail.com')).toBe('JP');
    expect(initials('user123_456')).toBe('US');
  });

  it('combines the first letter of two name parts', () => {
    expect(initials('Kennedy Silva')).toBe('KS');
    expect(initials('Vitoria Pereira Silva')).toBe('VP');
  });

  it('returns the first two letters when only one name part is present', () => {
    expect(initials('Madonna')).toBe('MA');
    expect(initials('Al')).toBe('AL');
  });

  it('falls back to a single letter when the name is one character', () => {
    expect(initials('X')).toBe('X');
  });

  it('falls back to the first original character if no letters survived', () => {
    // "12345@x.com" -> local "12345" -> no letters -> first char "1"
    expect(initials('12345@x.com')).toBe('1');
  });

  it('handles accented characters (Portuguese-friendly)', () => {
    expect(initials('Álvaro Évora')).toBe('ÁÉ');
  });
});
