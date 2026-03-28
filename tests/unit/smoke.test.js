import { describe, it, expect } from 'vitest';

describe('Vitest setup', () => {
  it('runs a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('has access to browser globals from setup file', () => {
    expect(globalThis.Matter).toBeDefined();
    expect(globalThis.gsap).toBeDefined();
    expect(globalThis.DOMPurify).toBeDefined();
    expect(globalThis.marked).toBeDefined();
  });
});
