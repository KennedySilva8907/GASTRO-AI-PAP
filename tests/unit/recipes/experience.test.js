// @vitest-environment jsdom
/**
 * Unit tests for RecipesExperience coordinator (catalog + stage + panel + responsive).
 */

import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';

vi.mock('../../../src/recipes/share.js', () => ({
  shareRecipe: vi.fn().mockResolvedValue(undefined),
}));

import {
  RecipesExperience,
  ResponsiveModalHandler,
} from '../../../src/recipes/carousel.js';

function experienceFixture() {
  document.body.innerHTML = `
    <main id="page-root">
      <section class="recipes-stage">
        <i class="recipes-stage__bg js-carousel-bg-img"></i>
        <div data-hero-title>
          <h1 class="recipes-stage__hero-title">Initial</h1>
        </div>
        <p data-hero-summary class="recipes-stage__hero-summary">Summary.</p>
        <ul class="recipes-rail__list js-carousel-list">
          <li class="recipes-rail__item js-carousel-list-item">
            <a href="#" data-video-id="vid-open?x=1" data-recipe="alpha">
              <p class="c-mouse-vertical-carousel__eyebrow u-b4"><span>01</span> Land</p>
              <p class="c-mouse-vertical-carousel__title u-a5">Alpha Dish</p>
            </a>
          </li>
        </ul>
        <div class="float-layer" data-depth="2"></div>
      </section>
    </main>
    <div id="recipe-panel" class="recipe-panel" hidden>
      <div class="recipe-panel__surface">
        <button type="button" class="close-button" aria-label="Close">&times;</button>
        <div class="recipe-panel__body">
          <div class="video-container">
            <iframe src="" title="Video"></iframe>
          </div>
          <div class="recipe-container">
            <p data-panel-summary hidden></p>
            <h2 id="recipeTitle"></h2>
            <div id="recipeContent"></div>
            <div data-panel-actions></div>
          </div>
        </div>
      </div>
    </div>
    <div id="recipes-data">
      <article id="recipe-alpha" class="recipe-content"><p>Body HTML</p></article>
    </div>
  `;
}

describe('RecipesExperience', () => {
  const OriginalImage = globalThis.Image;
  const originalIO = globalThis.IntersectionObserver;
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    globalThis.Image = class {
      set src(_v) {
        this.onload?.();
      }
    };
    globalThis.IntersectionObserver = vi.fn(function () {
      this.observe = vi.fn();
      this.disconnect = vi.fn();
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.body.className = '';
    document.body.style.overflow = '';
    globalThis.Image = OriginalImage;
    globalThis.IntersectionObserver = originalIO;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('wires stage onOpen to panel: clicking the already-active rail opens the floating panel', () => {
    experienceFixture();
    const exp = new RecipesExperience(document);
    exp.init();

    const item = document.querySelector('.recipes-rail__item.js-carousel-list-item');
    const panel = document.getElementById('recipe-panel');

    item.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(panel.hidden).toBe(false);
    expect(document.getElementById('recipeTitle').textContent).toBe('Alpha Dish');
    expect(document.getElementById('recipeContent').innerHTML).toBe('<p>Body HTML</p>');
    expect(document.querySelector('.video-container iframe').getAttribute('src')).toContain(
      'youtube.com/embed/vid-open',
    );
    expect(document.body.classList.contains('recipes-panel-open')).toBe(true);
  });

  it('dispatches show on #recipe-panel when panel opens and hide when it closes (scroll-lock contract)', () => {
    experienceFixture();
    const panel = document.getElementById('recipe-panel');
    const showSpy = vi.fn();
    const hideSpy = vi.fn();
    panel.addEventListener('show', showSpy);
    panel.addEventListener('hide', hideSpy);

    const exp = new RecipesExperience(document);
    exp.init();

    const item = document.querySelector('.recipes-rail__item.js-carousel-list-item');
    item.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(showSpy).toHaveBeenCalledTimes(1);
    expect(hideSpy).not.toHaveBeenCalled();

    document.querySelector('.close-button').click();

    expect(hideSpy).toHaveBeenCalledTimes(1);
  });

  it('destroy dispatches hide and unlocks body when tearing down an open panel', () => {
    experienceFixture();
    const panel = document.getElementById('recipe-panel');
    const hideSpy = vi.fn();
    panel.addEventListener('hide', hideSpy);

    const exp = new RecipesExperience(document);
    exp.init();

    const item = document.querySelector('.recipes-rail__item.js-carousel-list-item');
    item.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(panel.hidden).toBe(false);
    expect(document.body.style.overflow).toBe('hidden');

    exp.destroy();

    expect(hideSpy).toHaveBeenCalledTimes(1);
    expect(panel.hidden).toBe(true);
    expect(document.body.style.overflow).toBe('');
    expect(document.body.classList.contains('recipes-panel-open')).toBe(false);
  });

  it('destroy removes responsive modal listeners so later show events do not relock body', () => {
    experienceFixture();
    const panel = document.getElementById('recipe-panel');
    const exp = new RecipesExperience(document);
    exp.init();

    exp.destroy();
    panel.dispatchEvent(new window.Event('show'));

    expect(document.body.style.overflow).toBe('');
  });

  it('destroy removes stage listeners so later rail clicks do not reopen the panel', () => {
    experienceFixture();
    const panel = document.getElementById('recipe-panel');
    const item = document.querySelector('.recipes-rail__item.js-carousel-list-item');
    const exp = new RecipesExperience(document);
    exp.init();

    exp.destroy();

    expect(() =>
      item.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })),
    ).not.toThrow();
    expect(panel.hidden).toBe(true);
    expect(document.body.classList.contains('recipes-panel-open')).toBe(false);
  });

  it('ResponsiveModalHandler.adjustModalSize ignores panels without explicit open signals', () => {
    experienceFixture();
    const panel = document.getElementById('recipe-panel');
    panel.removeAttribute('hidden');

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 480,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 800,
    });

    const handler = new ResponsiveModalHandler();
    handler.adjustModalSize();

    expect(panel.querySelector('.recipe-panel__surface').style.height).toBe('');
    expect(panel.querySelector('.video-container').style.paddingBottom).toBe('');
    expect(panel.querySelector('.recipe-container').style.maxHeight).toBe('');

    handler.destroy();
  });

  it('ResponsiveModalHandler.adjustModalSize treats hidden=false plus body class as open', () => {
    experienceFixture();
    const panel = document.getElementById('recipe-panel');
    panel.hidden = false;
    document.body.classList.add('recipes-panel-open');

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 480,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 800,
    });

    const handler = new ResponsiveModalHandler();
    handler.adjustModalSize();

    expect(panel.querySelector('.recipe-panel__surface').style.height).toBe('800px');
    expect(panel.querySelector('.video-container').style.paddingBottom).toBe('56.25%');
    expect(panel.querySelector('.recipe-container').style.maxHeight).toBe('50vh');

    handler.destroy();
  });

  it('ResponsiveModalHandler.destroy removes resize and show listeners', () => {
    vi.useFakeTimers();
    experienceFixture();
    const panel = document.getElementById('recipe-panel');
    const handler = new ResponsiveModalHandler();
    const adjustSpy = vi.spyOn(handler, 'adjustModalSize');

    panel.dispatchEvent(new window.Event('show'));
    expect(document.body.style.overflow).toBe('hidden');
    adjustSpy.mockClear();

    handler.destroy();
    document.body.style.overflow = '';

    window.dispatchEvent(new window.Event('resize'));
    vi.advanceTimersByTime(300);
    panel.dispatchEvent(new window.Event('show'));

    expect(adjustSpy).not.toHaveBeenCalled();
    expect(document.body.style.overflow).toBe('');
  });
});
