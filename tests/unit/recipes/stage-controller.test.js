// @vitest-environment jsdom
/**
 * Unit tests for recipes stage controller (active recipe + depth parallax).
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  buildDepthTransform,
  RecipesStageController,
} from '../../../src/recipes/stage-controller.js';

describe('buildDepthTransform', () => {
  it('uses calc(-50% + …) for X and Y when centered is true', () => {
    const t = buildDepthTransform(8, 0.12, -0.07, { centered: true });
    expect(t).toMatch(/calc\(\s*-50%\s*\+/);
    expect(t).toContain('calc(-50%');
    expect(t.split('calc(-50%').length).toBeGreaterThanOrEqual(3);
  });

  it('does not use centered calc pattern when centered is false', () => {
    const t = buildDepthTransform(8, 0.12, -0.07, { centered: false });
    expect(t).not.toMatch(/calc\(\s*-50%\s*\+/);
  });

  it('keeps parallax travel subtle instead of throwing layers across the stage', () => {
    const t = buildDepthTransform(120, 1, 1, { centered: false });
    expect(t).toMatch(/translate3d\(8(\.\d+)?px,\s*8(\.\d+)?px,\s*120px\)/);
  });

  it('caps travel for very deep layers so the 3D effect stays inside the stage', () => {
    const t = buildDepthTransform(300, 1, 1, { centered: false });
    expect(t).toMatch(/translate3d\(10(\.0+)?px,\s*10(\.0+)?px,\s*300px\)/);
  });
});

describe('RecipesStageController', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('setActive(1) activates second rail item and bg, and updates hero title', () => {
    document.body.innerHTML = `
      <main id="root">
        <section class="recipes-stage">
          <i class="recipes-stage__bg js-carousel-bg-img"></i>
          <i class="recipes-stage__bg js-carousel-bg-img"></i>
          <div data-hero-title>
            <h1 class="recipes-stage__hero-title">First Recipe</h1>
          </div>
          <p data-hero-summary class="recipes-stage__hero-summary">Initial summary.</p>
          <ul class="recipes-rail__list js-carousel-list">
            <li class="recipes-rail__item js-carousel-list-item"></li>
            <li class="recipes-rail__item js-carousel-list-item"></li>
          </ul>
          <div class="float-layer" data-depth="4"></div>
        </section>
      </main>
    `;

    const root = document.getElementById('root');
    const catalog = [
      { id: 'r1', title: 'First Recipe', country: 'Alpha' },
      { id: 'r2', title: 'Second Recipe', country: 'Beta' },
    ];

    const ctrl = new RecipesStageController(root, catalog, {
      onOpen: vi.fn(),
    });

    ctrl.setActive(1);

    const items = root.querySelectorAll('.recipes-rail__item.js-carousel-list-item');
    const bgs = root.querySelectorAll('.recipes-stage__bg.js-carousel-bg-img');
    const titleEl = root.querySelector('.recipes-stage__hero-title');

    expect(items[0].classList.contains('is-active')).toBe(false);
    expect(items[1].classList.contains('is-active')).toBe(true);
    expect(bgs[0].classList.contains('is-visible')).toBe(false);
    expect(bgs[1].classList.contains('is-visible')).toBe(true);
    expect(titleEl.textContent).toBe('Second Recipe');
    expect(root.querySelector('.recipes-stage').dataset.activeRecipe).toBe('r2');
    expect(root.querySelector('[data-hero-summary]').textContent).toBe(
      'Beta em destaque nas receitas do mundo.',
    );
  });

  it('ignores clicks on rail items without matching recipe data', () => {
    document.body.innerHTML = `
      <main id="root">
        <section class="recipes-stage">
          <i class="recipes-stage__bg js-carousel-bg-img"></i>
          <i class="recipes-stage__bg js-carousel-bg-img"></i>
          <div data-hero-title>
            <h1 class="recipes-stage__hero-title">First Recipe</h1>
          </div>
          <p data-hero-summary class="recipes-stage__hero-summary">Initial summary.</p>
          <ul class="recipes-rail__list js-carousel-list">
            <li class="recipes-rail__item js-carousel-list-item"></li>
            <li class="recipes-rail__item js-carousel-list-item"></li>
            <li class="recipes-rail__item js-carousel-list-item"></li>
          </ul>
          <div class="float-layer" data-depth="4"></div>
        </section>
      </main>
    `;

    const root = document.getElementById('root');
    const catalog = [
      { id: 'r1', title: 'First Recipe', country: 'Alpha' },
      { id: 'r2', title: 'Second Recipe', country: 'Beta' },
    ];
    const onOpen = vi.fn();

    const ctrl = new RecipesStageController(root, catalog, { onOpen });
    ctrl.init();

    const items = root.querySelectorAll('.recipes-rail__item.js-carousel-list-item');
    items[2].dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(items[0].classList.contains('is-active')).toBe(true);
    expect(items[1].classList.contains('is-active')).toBe(false);
    expect(items[2].classList.contains('is-active')).toBe(false);
    expect(root.querySelector('.recipes-stage').dataset.activeRecipe).toBe('r1');
    expect(root.querySelector('.recipes-stage__hero-title').textContent).toBe(
      'First Recipe',
    );
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('destroy removes rail and stage listeners', () => {
    document.body.innerHTML = `
      <main id="root">
        <section class="recipes-stage">
          <i class="recipes-stage__bg js-carousel-bg-img"></i>
          <div data-hero-title>
            <h1 class="recipes-stage__hero-title">First Recipe</h1>
          </div>
          <p data-hero-summary class="recipes-stage__hero-summary">Initial summary.</p>
          <ul class="recipes-rail__list js-carousel-list">
            <li class="recipes-rail__item js-carousel-list-item"></li>
          </ul>
          <div class="float-layer" data-depth="4"></div>
        </section>
      </main>
    `;

    const root = document.getElementById('root');
    const stage = root.querySelector('.recipes-stage');
    const item = root.querySelector('.recipes-rail__item.js-carousel-list-item');
    const catalog = [{ id: 'r1', title: 'First Recipe', country: 'Alpha' }];
    const onOpen = vi.fn();

    const ctrl = new RecipesStageController(root, catalog, { onOpen });
    const handleSpy = vi.spyOn(ctrl, 'handlePointer');
    const resetSpy = vi.spyOn(ctrl, 'resetDepth');

    ctrl.init();
    handleSpy.mockClear();
    resetSpy.mockClear();
    ctrl.destroy();

    item.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    stage.dispatchEvent(
      new window.MouseEvent('pointermove', { bubbles: true, clientX: 10, clientY: 10 }),
    );
    stage.dispatchEvent(new window.MouseEvent('pointerleave', { bubbles: true }));

    expect(onOpen).not.toHaveBeenCalled();
    expect(handleSpy).not.toHaveBeenCalled();
    expect(resetSpy).not.toHaveBeenCalled();
  });

  it('still activates the first rail item and opens recipes when .recipes-stage is missing', () => {
    document.body.innerHTML = `
      <main id="root">
        <div data-hero-title>
          <h1 class="recipes-stage__hero-title">Initial title</h1>
        </div>
        <p data-hero-summary class="recipes-stage__hero-summary">Initial summary.</p>
        <ul class="recipes-rail__list js-carousel-list">
          <li class="recipes-rail__item js-carousel-list-item"></li>
          <li class="recipes-rail__item js-carousel-list-item"></li>
        </ul>
      </main>
    `;

    const root = document.getElementById('root');
    const catalog = [
      { id: 'r1', title: 'First Recipe', country: 'Alpha' },
      { id: 'r2', title: 'Second Recipe', country: 'Beta' },
    ];
    const onOpen = vi.fn();

    const ctrl = new RecipesStageController(root, catalog, { onOpen });
    ctrl.init();

    const items = root.querySelectorAll('.recipes-rail__item.js-carousel-list-item');
    items[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(items[0].classList.contains('is-active')).toBe(true);
    expect(items[1].classList.contains('is-active')).toBe(false);
    expect(root.querySelector('.recipes-stage__hero-title').textContent).toBe('First Recipe');
    expect(root.querySelector('[data-hero-summary]').textContent).toBe(
      'Alpha em destaque nas receitas do mundo.',
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(catalog[0], items[0]);
  });

  it('init seeds depth layers with their resting translateZ transforms so the stage keeps visible 3D before hover', () => {
    document.body.innerHTML = `
      <main id="root">
        <section class="recipes-stage">
          <i class="recipes-stage__bg js-carousel-bg-img" data-depth="-48"></i>
          <div data-hero-title>
            <h1 class="recipes-stage__hero-title">First Recipe</h1>
          </div>
          <p data-hero-summary class="recipes-stage__hero-summary">Initial summary.</p>
          <ul class="recipes-rail__list js-carousel-list">
            <li class="recipes-rail__item js-carousel-list-item"></li>
          </ul>
          <div class="float-layer" data-depth="24"></div>
        </section>
      </main>
    `;

    const root = document.getElementById('root');
    const catalog = [{ id: 'r1', title: 'First Recipe', country: 'Alpha' }];
    const ctrl = new RecipesStageController(root, catalog, {
      onOpen: vi.fn(),
    });

    ctrl.init();

    expect(root.querySelector('.recipes-stage__bg').style.transform).toBe(
      'translateZ(-48px) scale(1.18)',
    );
    expect(root.querySelector('.float-layer').style.transform).toBe('translateZ(24px)');
  });

  it('toggles top and bottom rail fade classes only when cards are actually passing the scroll bounds', () => {
    document.body.innerHTML = `
      <main id="root">
        <section class="recipes-stage">
          <i class="recipes-stage__bg js-carousel-bg-img"></i>
          <div data-hero-title>
            <h1 class="recipes-stage__hero-title">First Recipe</h1>
          </div>
          <p data-hero-summary class="recipes-stage__hero-summary">Initial summary.</p>
          <aside class="recipes-rail">
            <ul class="recipes-rail__list js-carousel-list">
              <li class="recipes-rail__item js-carousel-list-item"></li>
            </ul>
          </aside>
        </section>
      </main>
    `;

    const root = document.getElementById('root');
    const rail = root.querySelector('.recipes-rail');
    const list = root.querySelector('.recipes-rail__list');
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: 640 });
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 320 });
    Object.defineProperty(list, 'scrollTop', { configurable: true, writable: true, value: 0 });

    const catalog = [{ id: 'r1', title: 'First Recipe', country: 'Alpha' }];
    const ctrl = new RecipesStageController(root, catalog, {
      onOpen: vi.fn(),
    });

    ctrl.init();

    expect(rail.classList.contains('has-fade-top')).toBe(false);
    expect(rail.classList.contains('has-fade-bottom')).toBe(true);

    list.scrollTop = 120;
    list.dispatchEvent(new window.Event('scroll'));

    expect(rail.classList.contains('has-fade-top')).toBe(true);
    expect(rail.classList.contains('has-fade-bottom')).toBe(true);

    list.scrollTop = 320;
    list.dispatchEvent(new window.Event('scroll'));

    expect(rail.classList.contains('has-fade-top')).toBe(true);
    expect(rail.classList.contains('has-fade-bottom')).toBe(false);
  });
});
