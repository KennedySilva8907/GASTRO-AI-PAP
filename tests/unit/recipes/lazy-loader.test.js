// @vitest-environment jsdom
/**
 * Unit tests for LazyBackgroundLoader.
 * Tests cover IntersectionObserver-based lazy loading for CSS background-image elements.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { LazyBackgroundLoader } from '../../../src/recipes/lazy-loader.js';

// Store original IntersectionObserver to restore after fallback test
const OriginalIntersectionObserver = globalThis.IntersectionObserver;

describe('LazyBackgroundLoader', () => {
  let elements = [];

  afterEach(() => {
    // Clean up any DOM elements added during tests
    elements.forEach((el) => el.remove());
    elements = [];
    // Restore IntersectionObserver in case the fallback test deleted it
    globalThis.IntersectionObserver = OriginalIntersectionObserver;
    // Restore window.IntersectionObserver as well
    window.IntersectionObserver = OriginalIntersectionObserver;
  });

  /**
   * Helper: create a bg-img element with data-bg attribute and append to body.
   */
  function createBgElement(dataBg) {
    const el = document.createElement('i');
    el.className = 'c-mouse-vertical-carousel__bg-img js-carousel-bg-img';
    if (dataBg) {
      el.dataset.bg = dataBg;
    }
    document.body.appendChild(el);
    elements.push(el);
    return el;
  }

  // Test 1: init() observes all elements matching selector '.js-carousel-bg-img[data-bg]'
  it('observes all elements with [data-bg] selector after init()', () => {
    const el1 = createBgElement('https://example.com/image1.jpg');
    const el2 = createBgElement('https://example.com/image2.jpg');
    // This element has no data-bg, should NOT be observed
    const el3 = createBgElement(null);

    // Spy on the IntersectionObserver constructor to capture the instance
    let observerInstance;
    const OrigIO = globalThis.IntersectionObserver;
    const IOSpy = vi.fn(function (callback, options) {
      observerInstance = new OrigIO(callback, options);
      return observerInstance;
    });
    globalThis.IntersectionObserver = IOSpy;
    window.IntersectionObserver = IOSpy;

    const loader = new LazyBackgroundLoader();
    loader.init();

    // Should have observed elements with data-bg only (el1 and el2, not el3)
    expect(observerInstance.targets).toContain(el1);
    expect(observerInstance.targets).toContain(el2);
    expect(observerInstance.targets).not.toContain(el3);
  });

  // Test 2: When an observed element intersects, its style.backgroundImage is set from dataset.bg and dataset.bg is deleted
  it('sets style.backgroundImage from dataset.bg when element intersects', () => {
    const imageUrl = 'https://example.com/recipe.jpg';
    const el = createBgElement(imageUrl);

    let observerInstance;
    const OrigIO = globalThis.IntersectionObserver;
    const IOSpy = vi.fn(function (callback, options) {
      observerInstance = new OrigIO(callback, options);
      return observerInstance;
    });
    globalThis.IntersectionObserver = IOSpy;
    window.IntersectionObserver = IOSpy;

    const loader = new LazyBackgroundLoader();
    loader.init();

    // Verify data-bg is still set before intersection
    expect(el.dataset.bg).toBe(imageUrl);
    expect(el.style.backgroundImage).toBe('');

    // Trigger intersection
    observerInstance.triggerIntersection([{ target: el, isIntersecting: true }]);

    // After intersection, style should be set and data-bg removed
    // jsdom normalizes url() quotes, so check the URL is included rather than exact quote style
    expect(el.style.backgroundImage).toContain(imageUrl);
    expect(el.style.backgroundImage).toMatch(/^url\(/);
    expect(el.dataset.bg).toBeUndefined();
  });

  // Test 3: After intersection, observer.unobserve is called on that element
  it('calls unobserve on the element after it intersects', () => {
    const el = createBgElement('https://example.com/image.jpg');

    let observerInstance;
    const OrigIO = globalThis.IntersectionObserver;
    const IOSpy = vi.fn(function (callback, options) {
      observerInstance = new OrigIO(callback, options);
      return observerInstance;
    });
    globalThis.IntersectionObserver = IOSpy;
    window.IntersectionObserver = IOSpy;

    const loader = new LazyBackgroundLoader();
    loader.init();

    // Spy on unobserve method
    const unobserveSpy = vi.spyOn(observerInstance, 'unobserve');

    // Trigger intersection
    observerInstance.triggerIntersection([{ target: el, isIntersecting: true }]);

    expect(unobserveSpy).toHaveBeenCalledWith(el);
    // Element should no longer be in targets after unobserve
    expect(observerInstance.targets).not.toContain(el);
  });

  // Test 4: When IntersectionObserver is unavailable, loadAll() eagerly sets all background images
  it('falls back to loadAll() and sets all background images when IntersectionObserver is unavailable', () => {
    const url1 = 'https://example.com/fallback1.jpg';
    const url2 = 'https://example.com/fallback2.jpg';
    const el1 = createBgElement(url1);
    const el2 = createBgElement(url2);

    // Remove IntersectionObserver to simulate unsupported browser
    delete globalThis.IntersectionObserver;
    delete window.IntersectionObserver;

    const loader = new LazyBackgroundLoader();
    loader.init();

    // Both images should be eagerly set
    // jsdom normalizes url() quotes, so check the URL is included rather than exact quote style
    expect(el1.style.backgroundImage).toContain(url1);
    expect(el1.style.backgroundImage).toMatch(/^url\(/);
    expect(el2.style.backgroundImage).toContain(url2);
    expect(el2.style.backgroundImage).toMatch(/^url\(/);
  });

  // Test 5: Elements without dataset.bg are skipped (no error thrown)
  it('does not throw and skips elements without dataset.bg during handleIntersection', () => {
    // Element with data-bg
    const elWithBg = createBgElement('https://example.com/image.jpg');
    // Element without data-bg (added to DOM but no data-bg)
    const elWithoutBg = document.createElement('i');
    elWithoutBg.className = 'c-mouse-vertical-carousel__bg-img js-carousel-bg-img';
    document.body.appendChild(elWithoutBg);
    elements.push(elWithoutBg);

    let observerInstance;
    const OrigIO = globalThis.IntersectionObserver;
    const IOSpy = vi.fn(function (callback, options) {
      observerInstance = new OrigIO(callback, options);
      return observerInstance;
    });
    globalThis.IntersectionObserver = IOSpy;
    window.IntersectionObserver = IOSpy;

    const loader = new LazyBackgroundLoader();
    loader.init();

    // Manually trigger intersection for an element with no dataset.bg
    // (simulating an edge case where handleIntersection is called on an element
    //  that had its data-bg already removed or never had one)
    expect(() => {
      observerInstance.triggerIntersection([
        { target: elWithoutBg, isIntersecting: true },
      ]);
    }).not.toThrow();

    // The element with no data-bg should not have style.backgroundImage set
    expect(elWithoutBg.style.backgroundImage).toBe('');
    // The element with data-bg should be unaffected (not triggered yet)
    expect(elWithBg.style.backgroundImage).toBe('');
  });
});
