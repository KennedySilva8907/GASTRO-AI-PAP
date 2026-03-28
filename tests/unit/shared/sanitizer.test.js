// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeHtml, SANITIZE_CONFIG, SANITIZE_CONFIG_EXTENDED } from '../../../src/shared/sanitizer.js';

describe('sanitizeHtml', () => {
  describe('with DOMPurify available', () => {
    beforeEach(() => {
      // Override the browser-globals stub with a spy for precise assertions
      globalThis.DOMPurify = {
        sanitize: vi.fn((html) => html.replace(/<script[^>]*>.*?<\/script>/gi, '')),
      };
    });

    it('calls DOMPurify.sanitize with html and config', () => {
      sanitizeHtml('<p>hello</p>');
      expect(globalThis.DOMPurify.sanitize).toHaveBeenCalledWith('<p>hello</p>', SANITIZE_CONFIG);
    });

    it('returns the sanitized result from DOMPurify', () => {
      const result = sanitizeHtml('<p>safe</p><script>evil()</script>');
      expect(result).toContain('<p>safe</p>');
      expect(result).not.toContain('<script>');
    });

    it('uses SANITIZE_CONFIG as default config', () => {
      sanitizeHtml('<b>bold</b>');
      const calledConfig = globalThis.DOMPurify.sanitize.mock.calls[0][1];
      expect(calledConfig).toBe(SANITIZE_CONFIG);
    });

    it('accepts a custom config parameter', () => {
      const customConfig = { ALLOWED_TAGS: ['b'] };
      sanitizeHtml('<b>bold</b>', customConfig);
      expect(globalThis.DOMPurify.sanitize).toHaveBeenCalledWith('<b>bold</b>', customConfig);
    });
  });

  describe('fallback when DOMPurify is undefined', () => {
    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      globalThis.DOMPurify = undefined;
    });

    it('strips all HTML tags', () => {
      const result = sanitizeHtml('<b>bold</b><script>alert(1)</script><p>text</p>');
      expect(result).toBe('boldalert(1)text');
    });

    it('preserves plain text without tags', () => {
      const result = sanitizeHtml('plain text no tags');
      expect(result).toBe('plain text no tags');
    });

    it('logs a security warning', () => {
      sanitizeHtml('<p>test</p>');
      expect(console.warn).toHaveBeenCalledWith(
        '[Security] DOMPurify not loaded, stripping all HTML tags'
      );
    });
  });
});

describe('SANITIZE_CONFIG', () => {
  it('forbids script, style, and iframe tags', () => {
    expect(SANITIZE_CONFIG.FORBID_TAGS).toContain('script');
    expect(SANITIZE_CONFIG.FORBID_TAGS).toContain('style');
    expect(SANITIZE_CONFIG.FORBID_TAGS).toContain('iframe');
  });

  it('allows safe formatting tags', () => {
    expect(SANITIZE_CONFIG.ALLOWED_TAGS).toContain('p');
    expect(SANITIZE_CONFIG.ALLOWED_TAGS).toContain('strong');
    expect(SANITIZE_CONFIG.ALLOWED_TAGS).toContain('em');
    expect(SANITIZE_CONFIG.ALLOWED_TAGS).toContain('code');
    expect(SANITIZE_CONFIG.ALLOWED_TAGS).toContain('a');
  });

  it('forbids dangerous event handler attributes', () => {
    expect(SANITIZE_CONFIG.FORBID_ATTR).toContain('onerror');
    expect(SANITIZE_CONFIG.FORBID_ATTR).toContain('onclick');
  });
});

describe('SANITIZE_CONFIG_EXTENDED', () => {
  it('includes div and i in ALLOWED_TAGS beyond the base config', () => {
    expect(SANITIZE_CONFIG_EXTENDED.ALLOWED_TAGS).toContain('div');
    expect(SANITIZE_CONFIG_EXTENDED.ALLOWED_TAGS).toContain('i');
  });

  it('inherits FORBID_TAGS from base config', () => {
    expect(SANITIZE_CONFIG_EXTENDED.FORBID_TAGS).toEqual(SANITIZE_CONFIG.FORBID_TAGS);
  });
});
