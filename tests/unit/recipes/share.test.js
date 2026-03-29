// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shareRecipe } from '../../../src/recipes/share.js';

describe('shareRecipe', () => {
  let originalNavigator;

  beforeEach(() => {
    originalNavigator = { ...navigator };
    // Clear DOM safely — remove all children without innerHTML assignment
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    // Create a minimal .recipe-container for URL display fallback
    const container = document.createElement('div');
    container.className = 'recipe-container';
    document.body.appendChild(container);
    vi.useFakeTimers();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
    vi.useRealTimers();
  });

  it('calls navigator.share with correct data when available', async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: { share: mockShare },
      configurable: true,
    });

    await shareRecipe('Bacalhau a Bras', 'https://example.com/recipes');

    expect(mockShare).toHaveBeenCalledWith({
      title: 'GASTRO-AI: Bacalhau a Bras',
      text: 'Confira esta receita: Bacalhau a Bras',
      url: 'https://example.com/recipes',
    });
  });

  it('silently swallows AbortError without triggering fallback', async () => {
    const abortErr = new DOMException('Share cancelled', 'AbortError');
    const mockShare = vi.fn().mockRejectedValue(abortErr);
    Object.defineProperty(globalThis, 'navigator', {
      value: { share: mockShare },
      configurable: true,
    });

    await expect(shareRecipe('Carbonara', 'https://example.com')).resolves.toBeUndefined();
    // No feedback toast should exist
    expect(document.querySelector('.share-feedback')).toBeNull();
  });

  it('falls back to clipboard on non-AbortError from navigator.share', async () => {
    const otherErr = new Error('Network error');
    otherErr.name = 'DataError';
    const mockShare = vi.fn().mockRejectedValue(otherErr);
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: { share: mockShare, clipboard: { writeText: mockWriteText } },
      configurable: true,
    });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

    await shareRecipe('Ramen', 'https://example.com/recipes');

    expect(mockWriteText).toHaveBeenCalledWith('https://example.com/recipes');
  });

  it('uses clipboard fallback when navigator.share is absent', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: mockWriteText } },
      configurable: true,
    });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

    await shareRecipe('Feijoada', 'https://example.com/recipes');

    expect(mockWriteText).toHaveBeenCalledWith('https://example.com/recipes');
    // Should show feedback toast
    const feedback = document.querySelector('.share-feedback');
    expect(feedback).not.toBeNull();
    expect(feedback.textContent).toContain('copiado');
  });

  it('shows URL display when both APIs are absent', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true,
    });

    await shareRecipe('Moussaka', 'https://example.com/recipes');

    const urlDisplay = document.querySelector('.share-url-display');
    expect(urlDisplay).not.toBeNull();
    expect(urlDisplay.textContent).toBe('https://example.com/recipes');
    expect(urlDisplay.tagName.toLowerCase()).toBe('output');
  });

  it('removes feedback toast after 2500ms', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: mockWriteText } },
      configurable: true,
    });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

    await shareRecipe('Brisket', 'https://example.com/recipes');

    expect(document.querySelector('.share-feedback')).not.toBeNull();
    vi.advanceTimersByTime(2500);
    expect(document.querySelector('.share-feedback')).toBeNull();
  });
});
