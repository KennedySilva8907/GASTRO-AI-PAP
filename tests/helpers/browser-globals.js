/**
 * Browser globals stub for Vitest.
 * These libraries are loaded via CDN <script> tags in HTML.
 * They do not exist in the Node.js test environment.
 * Each stub provides the minimum API surface to prevent ReferenceError
 * when importing src/ modules that reference these globals.
 */

import { vi } from 'vitest';

// Matter.js physics engine (used by src/chat/matter-setup.js)
globalThis.Matter = {
  Engine: { create: () => ({}), run: () => {}, update: () => {} },
  Render: { create: () => ({ canvas: {} }), run: () => {} },
  Bodies: { circle: () => ({}), rectangle: () => ({}) },
  Body: { setVelocity: () => {}, setPosition: () => {}, applyForce: () => {} },
  World: { add: () => {}, remove: () => {} },
  Composite: { add: () => {}, allBodies: () => [] },
  Runner: { create: () => ({}), run: () => {} },
  Events: { on: () => {} },
  Mouse: { create: () => ({}) },
  MouseConstraint: { create: () => ({}) },
};

// GSAP animation library (used by src/shared/animations.js, src/recipes/carousel.js)
globalThis.gsap = {
  to: () => ({ kill: () => {} }),
  from: () => ({ kill: () => {} }),
  fromTo: () => ({ kill: () => {} }),
  set: () => {},
  killTweensOf: () => {},
  timeline: () => ({
    to: () => ({}),
    from: () => ({}),
    play: () => {},
    pause: () => {},
  }),
};

// Typed.js typing animation (used by src/chat/handlers.js)
globalThis.Typed = class {
  constructor() {}
  destroy() {}
};

// marked.js markdown parser (used by src/chat/handlers.js)
globalThis.marked = { parse: (s) => s };

// anime.js animation (used by src/shared/animations.js)
globalThis.anime = vi.fn(() => ({ finished: Promise.resolve() }));

// DOMPurify XSS protection (used by src/shared/sanitizer.js)
// NOTE: Individual tests may override this with vi.fn() for specific test scenarios.
// This default stub prevents ReferenceError on import.
globalThis.DOMPurify = {
  sanitize: (html) => html,
};

// IntersectionObserver API (used by src/recipes/lazy-loader.js)
globalThis.IntersectionObserver = class {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.targets = [];
  }
  observe(el) { this.targets.push(el); }
  unobserve(el) { this.targets = this.targets.filter(t => t !== el); }
  disconnect() { this.targets = []; }
  // Test helper: trigger intersection manually
  triggerIntersection(entries) {
    this.callback(entries, this);
  }
};
