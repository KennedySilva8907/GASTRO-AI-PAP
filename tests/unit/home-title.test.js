// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { initTitleRepel, repelOffset } from '../../src/home-title.js';

function fakeWindow({ reducedMotion = false } = {}) {
  return {
    matchMedia: () => ({ matches: reducedMotion }),
    addEventListener: () => {},
    requestAnimationFrame: () => 0,
  };
}

describe('how far a letter gets pushed by the cursor', () => {
  it('leaves letters alone when the cursor is far away', () => {
    expect(repelOffset(400, 0)).toEqual({ x: 0, y: 0 });
  });

  it('pushes a letter away from the cursor', () => {
    const right = repelOffset(40, 0);
    const left = repelOffset(-40, 0);

    expect(right.x).toBeGreaterThan(0);
    expect(left.x).toBeLessThan(0);
  });

  it('pushes harder the closer the cursor gets', () => {
    expect(repelOffset(30, 0).x).toBeGreaterThan(repelOffset(90, 0).x);
  });

  it('sends the letter under the cursor up instead of shaking it around', () => {
    const under = repelOffset(0, 0);

    expect(Number.isFinite(under.x)).toBe(true);
    expect(Number.isFinite(under.y)).toBe(true);
    expect(under.y).toBeLessThan(0);
  });
});

describe('starting the title effect', () => {
  it('does nothing for anyone who asked for reduced motion', () => {
    document.body.innerHTML =
      '<div class="container"><h1><span class="logo-letter">G</span></h1></div>';
    const container = document.querySelector('.container');

    expect(initTitleRepel(container, fakeWindow({ reducedMotion: true }))).toBe(false);
  });

  it('does nothing when the page has no title', () => {
    expect(initTitleRepel(null, fakeWindow())).toBe(false);
  });

  it('starts when there are letters to move', () => {
    document.body.innerHTML =
      '<div class="container"><h1><span class="logo-letter">G</span></h1></div>';
    const container = document.querySelector('.container');

    expect(initTitleRepel(container, fakeWindow())).toBe(true);
  });
});
