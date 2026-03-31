// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResponsiveModalHandler, VerticalCarousel } from '../../../src/recipes/carousel.js';

describe('recipe panel scroll lock', () => {
  const OriginalImage = globalThis.Image;
  const originalGsap = globalThis.gsap;
  const originalInnerWidth = window.innerWidth;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

  beforeEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }

    document.body.innerHTML = `
      <div class="js-carousel">
        <ul class="js-carousel-list">
          <li class="js-carousel-list-item">
            <a href="#" data-video-id="abc123" data-recipe="bacalhau_a_bras">
              <p class="c-mouse-vertical-carousel__eyebrow u-b4"><span>01</span> Portugal</p>
              <p class="c-mouse-vertical-carousel__title u-a5">Bacalhau à Brás</p>
            </a>
          </li>
        </ul>
        <i class="js-carousel-bg-img" style="background-image: url('https://example.com/bg.jpg')"></i>
      </div>
      <div id="recipe-panel" class="recipe-panel">
        <div class="recipe-panel__surface">
          <button type="button" class="close-button" aria-label="Fechar painel">&times;</button>
          <div class="recipe-panel__body">
            <div class="video-container">
              <iframe src="" title="Vídeo da receita"></iframe>
            </div>
            <div class="recipe-container">
              <h2 id="recipeTitle"></h2>
              <div id="recipeContent"></div>
            </div>
          </div>
        </div>
      </div>
      <div id="recipes-data">
        <article id="recipe-bacalhau_a_bras" class="recipe-content">
          <p>Receita preservada.</p>
        </article>
      </div>
    `;

    document.body.style.overflow = '';

    globalThis.Image = class {
      set src(value) {
        this._src = value;
        this.onload?.();
      }

      get src() {
        return this._src;
      }
    };

    globalThis.gsap = {
      ...originalGsap,
      to: vi.fn((target, vars = {}) => {
        vars.onComplete?.();
        return { kill: () => {} };
      }),
      fromTo: vi.fn(() => ({ kill: () => {} })),
      set: vi.fn(),
      killTweensOf: vi.fn(),
    };
  });

  afterEach(() => {
    document.body.style.overflow = '';
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
    globalThis.Image = OriginalImage;
    globalThis.gsap = originalGsap;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('locks body scrolling when opened and unlocks it when closed', () => {
    const carousel = new VerticalCarousel(
      {},
      {
        bacalhau_a_bras: {
          title: 'Bacalhau à Brás',
          content: '<p>Receita preservada.</p>',
        },
      }
    );

    new ResponsiveModalHandler();

    carousel.openModal('abc123', 'bacalhau_a_bras');
    expect(document.body.style.overflow).toBe('hidden');

    document.querySelector('.close-button').click();
    expect(document.body.style.overflow).toBe('');
  });

  it('ResponsiveModalHandler.closeModal clicks the .recipes-panel__close fallback', () => {
    const closeButton = document.querySelector('.close-button');
    closeButton.className = 'recipes-panel__close';

    const handler = new ResponsiveModalHandler();
    const clickSpy = vi.spyOn(closeButton, 'click');

    handler.closeModal();

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the modal DOM is absent', () => {
    document.getElementById('recipe-panel')?.remove();

    expect(
      () =>
        new VerticalCarousel(
          {},
          {
            bacalhau_a_bras: {
              title: 'Bacalhau à Brás',
              content: '<p>Receita preservada.</p>',
            },
          }
        ),
    ).not.toThrow();
  });

  it('does not throw when the carousel has zero list items', () => {
    document.querySelector('.js-carousel-list').innerHTML = '';

    expect(
      () =>
        new VerticalCarousel(
          {},
          {
            bacalhau_a_bras: {
              title: 'Bacalhau à Brás',
              content: '<p>Receita preservada.</p>',
            },
          }
        ),
    ).not.toThrow();

    expect(document.querySelectorAll('.progress-dot')).toHaveLength(0);
  });

  it('does not leave a loading overlay behind when there are zero background images', () => {
    document.querySelector('.js-carousel-bg-img')?.remove();

    expect(
      () =>
        new VerticalCarousel(
          {},
          {
            bacalhau_a_bras: {
              title: 'Bacalhau à Brás',
              content: '<p>Receita preservada.</p>',
            },
          }
        ),
    ).not.toThrow();

    expect(document.querySelector('.loading-overlay')).toBeNull();
  });

  it('uses finite scroll targets for a single-item carousel', () => {
    const list = document.querySelector('.js-carousel-list');
    list.scrollTo = vi.fn();

    const carousel = new VerticalCarousel(
      {},
      {
        bacalhau_a_bras: {
          title: 'Bacalhau à Brás',
          content: '<p>Receita preservada.</p>',
        },
      }
    );

    const item = document.querySelector('.js-carousel-list-item');
    item.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(carousel).toBeTruthy();
    expect(list.scrollTo).toHaveBeenCalled();
    expect(list.scrollTo.mock.calls[0][0]).toMatchObject({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('treats near-bottom scroll positions as bottom with a small tolerance', () => {
    const handler = new ResponsiveModalHandler();
    document.getElementById('recipe-panel').style.display = 'block';
    const recipeContainer = document.querySelector('.recipe-container');
    const preventDefault = vi.fn();

    Object.defineProperty(recipeContainer, 'scrollHeight', {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(recipeContainer, 'scrollTop', {
      configurable: true,
      value: 49.5,
    });
    Object.defineProperty(recipeContainer, 'clientHeight', {
      configurable: true,
      value: 50,
    });

    handler._onModalTouchStart({ touches: [{ clientY: 100 }] });
    handler._onModalTouchMove({
      touches: [{ clientY: 80 }],
      preventDefault,
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.recipe-panel__surface').style.transform).toBe(
      'translateY(-20px)',
    );
  });

  it('uses clearTimeout instead of cancelAnimationFrame for mobile scroll debounce', () => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 480,
    });

    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const cancelAnimationFrameSpy = vi.fn();
    globalThis.cancelAnimationFrame = cancelAnimationFrameSpy;

    const carousel = new VerticalCarousel(
      {},
      {
        bacalhau_a_bras: {
          title: 'Bacalhau à Brás',
          content: '<p>Receita preservada.</p>',
        },
      }
    );

    const list = document.querySelector('.js-carousel-list');
    list.dispatchEvent(new window.Event('scroll'));
    vi.advanceTimersByTime(61);
    list.dispatchEvent(new window.Event('scroll'));

    expect(carousel).toBeTruthy();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(cancelAnimationFrameSpy).not.toHaveBeenCalled();
  });

  it('destroy removes document listeners registered by VerticalCarousel', () => {
    const carousel = new VerticalCarousel(
      {},
      {
        bacalhau_a_bras: {
          title: 'Bacalhau à Brás',
          content: '<p>Receita preservada.</p>',
        },
      }
    );
    const panel = document.getElementById('recipe-panel');
    const iframe = document.querySelector('.video-container iframe');
    const fullscreenSpy = vi.spyOn(carousel, 'handleFullscreenChange');

    carousel.openModal('abc123', 'bacalhau_a_bras');
    expect(panel.style.display).toBe('block');
    expect(iframe.getAttribute('src')).toContain('youtube.com/embed/abc123');

    carousel.destroy();
    fullscreenSpy.mockClear();

    document.dispatchEvent(new window.Event('fullscreenchange'));
    document.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );

    expect(fullscreenSpy).not.toHaveBeenCalled();
    expect(panel.style.display).toBe('block');
    expect(iframe.getAttribute('src')).toContain('youtube.com/embed/abc123');
  });
});
