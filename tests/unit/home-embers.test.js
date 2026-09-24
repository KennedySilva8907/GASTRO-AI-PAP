// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { initEmbers, spawnEmbers, stepEmber } from '../../src/home-embers.js';

function fakeWindow({ reducedMotion = false, finePointer = true } = {}) {
  return {
    matchMedia: (query) => ({
      matches: query.includes('reduced-motion') ? reducedMotion : finePointer,
    }),
    addEventListener: () => {},
    requestAnimationFrame: () => 0,
    devicePixelRatio: 1,
    innerWidth: 800,
    innerHeight: 600,
  };
}

describe('the embers behind the cursor', () => {
  it('lets out a few embers where the cursor is, all going up', () => {
    const embers = spawnEmbers(200, 300);

    expect(embers).toHaveLength(3);
    embers.forEach((ember) => {
      expect(Math.abs(ember.x - 200)).toBeLessThanOrEqual(4);
      expect(Math.abs(ember.y - 300)).toBeLessThanOrEqual(4);
      expect(ember.vy).toBeLessThan(0);
    });
  });

  it('rises while it burns', () => {
    const [ember] = spawnEmbers(200, 300);
    const startY = ember.y;

    stepEmber(ember, 0.1);

    expect(ember.y).toBeLessThan(startY);
  });

  it('goes out once its life is over', () => {
    const [ember] = spawnEmbers(200, 300);

    expect(stepEmber(ember, 0.1)).toBe(true);
    expect(stepEmber(ember, ember.max)).toBe(false);
  });
});

describe('starting the ember trail', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('adds nothing to the page for anyone who asked for reduced motion', () => {
    expect(initEmbers(document, fakeWindow({ reducedMotion: true }))).toBe(false);
    expect(document.querySelector('canvas')).toBeNull();
  });

  it('adds nothing to the page on a screen without a mouse', () => {
    expect(initEmbers(document, fakeWindow({ finePointer: false }))).toBe(false);
    expect(document.querySelector('canvas')).toBeNull();
  });
});
