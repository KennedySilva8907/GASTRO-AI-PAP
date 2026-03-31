// @vitest-environment jsdom
/**
 * Unit tests for recipes floating editorial panel controller.
 */

import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';

vi.mock('../../../src/recipes/share.js', () => ({
  shareRecipe: vi.fn().mockResolvedValue(undefined),
}));

import {
  buildYouTubeEmbedUrl,
  RecipePanelController,
} from '../../../src/recipes/panel-controller.js';
import { shareRecipe } from '../../../src/recipes/share.js';

let controllers = [];

describe('buildYouTubeEmbedUrl', () => {
  it('strips query string and returns embed URL with autoplay and rel=0', () => {
    expect(buildYouTubeEmbedUrl('FzCOdimBIeU?si=abc123')).toBe(
      'https://www.youtube.com/embed/FzCOdimBIeU?autoplay=1&rel=0',
    );
  });
});

function panelFixture() {
  document.body.innerHTML = `
    <main id="root">
      <div id="recipe-panel" hidden>
        <button type="button" class="recipes-panel__close">Close</button>
        <iframe data-panel-video title="Video"></iframe>
        <span data-panel-country></span>
        <h2 data-panel-title></h2>
        <p data-panel-summary></p>
        <div data-panel-content></div>
        <div data-panel-actions></div>
      </div>
    </main>
  `;
  return document.getElementById('root');
}

function createController(root, catalog = []) {
  const ctrl = new RecipePanelController(root, catalog);
  controllers.push(ctrl);
  return ctrl;
}

describe('RecipePanelController', () => {
  beforeEach(() => {
    controllers = [];
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const ctrl of controllers) {
      ctrl.destroy?.();
    }
    document.body.innerHTML = '';
    document.body.className = '';
    document.body.removeAttribute('tabindex');
    vi.restoreAllMocks();
  });

  it('open(recipe) unhides panel, populates fields, sets iframe, body class, and share button', () => {
    const root = panelFixture();
    const catalog = [];
    const ctrl = createController(root, catalog);
    ctrl.init();

    const recipe = {
      id: 'bacalhau',
      title: 'Bacalhau',
      country: 'Portugal',
      summary: 'Um clássico.',
      videoId: 'FzCOdimBIeU?si=abc123',
      content: '<p>Steps here</p>',
    };

    ctrl.open(recipe);

    const panel = document.getElementById('recipe-panel');
    const iframe = root.querySelector('[data-panel-video]');
    const actions = root.querySelector('[data-panel-actions]');

    expect(panel.hidden).toBe(false);
    expect(root.querySelector('[data-panel-title]').textContent).toBe('Bacalhau');
    expect(root.querySelector('[data-panel-country]').textContent).toBe('Portugal');
    expect(root.querySelector('[data-panel-summary]').textContent).toBe('Um clássico.');
    expect(root.querySelector('[data-panel-content]').innerHTML).toBe('<p>Steps here</p>');
    expect(iframe.getAttribute('src')).toBe(
      'https://www.youtube.com/embed/FzCOdimBIeU?autoplay=1&rel=0',
    );
    expect(document.body.classList.contains('recipes-panel-open')).toBe(true);
    expect(actions.querySelector('button')).toBeTruthy();
    expect(actions.textContent).toMatch(/share|partilhar|compartilhar/i);
  });

  it('share click calls shareRecipe with title and hash URL', async () => {
    const root = panelFixture();
    const ctrl = createController(root, []);
    ctrl.init();

    const recipe = {
      id: 'ramen',
      title: 'Ramen',
      country: 'JP',
      summary: '',
      videoId: 'abc',
      content: '',
    };

    ctrl.open(recipe);
    const shareBtn = root.querySelector('[data-panel-actions] button');
    shareBtn.click();

    expect(shareRecipe).toHaveBeenCalledWith(
      'Ramen',
      `${window.location.origin}/recipes/receitas.html#ramen`,
    );
  });

  it('open focuses the close button', () => {
    const root = panelFixture();
    const ctrl = createController(root, []);
    ctrl.init();
    const closeBtn = root.querySelector('.recipes-panel__close');

    ctrl.open({
      id: 'x',
      title: 'T',
      country: '',
      summary: '',
      videoId: '',
      content: '',
    });

    expect(document.activeElement).toBe(closeBtn);
  });

  it('close() hides panel, clears iframe, removes body class, restores focus to trigger', () => {
    const root = panelFixture();
    const ctrl = createController(root, []);
    ctrl.init();

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = 'Open recipe';
    root.insertBefore(trigger, root.firstChild);

    const panel = document.getElementById('recipe-panel');
    const iframe = root.querySelector('[data-panel-video]');

    ctrl.open(
      {
        id: 'x',
        title: 'T',
        country: 'C',
        summary: 'S',
        videoId: 'vid?q=1',
        content: '<em>c</em>',
      },
      trigger,
    );

    expect(panel.hidden).toBe(false);
    ctrl.close();

    expect(panel.hidden).toBe(true);
    expect(iframe.getAttribute('src')).toBe('');
    expect(document.body.classList.contains('recipes-panel-open')).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('close() restores trigger when teardown moves focus before restore (pre-hide snapshot)', () => {
    const root = panelFixture();
    const ctrl = createController(root, []);
    ctrl.init();

    const trigger = document.createElement('button');
    trigger.type = 'button';
    root.insertBefore(trigger, root.firstChild);

    ctrl.open(
      {
        id: 'x',
        title: 'T',
        country: '',
        summary: '',
        videoId: '',
        content: '',
      },
      trigger,
    );

    const realTeardown = ctrl._teardownPanelUi.bind(ctrl);
    ctrl._teardownPanelUi = () => {
      realTeardown();
      document.body.setAttribute('tabindex', '-1');
      document.body.focus();
    };

    ctrl.close();

    expect(document.activeElement).toBe(trigger);
  });

  it('close() moves focus out of hidden panel when trigger is disabled (focus() no-op)', () => {
    const root = panelFixture();
    const ctrl = createController(root, []);
    ctrl.init();

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.disabled = true;
    root.insertBefore(trigger, root.firstChild);

    const panel = document.getElementById('recipe-panel');

    ctrl.open(
      {
        id: 'x',
        title: 'T',
        country: '',
        summary: '',
        videoId: '',
        content: '',
      },
      trigger,
    );

    ctrl.close();

    expect(panel.hidden).toBe(true);
    expect(panel.contains(document.activeElement)).toBe(false);
  });

  it('close() moves focus out of the hidden panel when there is no trigger', () => {
    const root = panelFixture();
    const ctrl = createController(root, []);
    ctrl.init();
    const panel = document.getElementById('recipe-panel');
    const closeBtn = root.querySelector('.recipes-panel__close');

    ctrl.open({
      id: 'x',
      title: 'T',
      country: '',
      summary: '',
      videoId: '',
      content: '',
    });

    expect(document.activeElement).toBe(closeBtn);

    ctrl.close();

    expect(panel.hidden).toBe(true);
    expect(panel.contains(document.activeElement)).toBe(false);
  });

  it('close button and Escape key close the panel', () => {
    const root = panelFixture();
    const ctrl = createController(root, []);
    ctrl.init();
    const panel = document.getElementById('recipe-panel');
    const closeBtn = root.querySelector('.recipes-panel__close');

    ctrl.open({
      id: 'a',
      title: 'A',
      country: '',
      summary: '',
      videoId: 'v',
      content: '',
    });
    expect(panel.hidden).toBe(false);

    closeBtn.click();
    expect(panel.hidden).toBe(true);

    ctrl.open({
      id: 'b',
      title: 'B',
      country: '',
      summary: '',
      videoId: 'v2',
      content: '',
    });
    document.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(panel.hidden).toBe(true);
  });

  it('destroy closes an open panel and clears its visual state', () => {
    const root = panelFixture();
    const ctrl = createController(root, []);
    ctrl.init();

    const panel = document.getElementById('recipe-panel');
    const iframe = root.querySelector('[data-panel-video]');
    ctrl.open({
      id: 'destroy-test',
      title: 'Destroy Test',
      country: '',
      summary: '',
      videoId: 'clip',
      content: '',
    });

    expect(panel.hidden).toBe(false);
    expect(typeof ctrl.destroy).toBe('function');

    ctrl.destroy();

    expect(panel.hidden).toBe(true);
    expect(iframe.getAttribute('src')).toBe('');
    expect(document.body.classList.contains('recipes-panel-open')).toBe(false);
  });

  it('destroy() restores focus to last trigger when the panel was open', () => {
    const root = panelFixture();
    const ctrl = createController(root, []);
    ctrl.init();

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = 'Open';
    root.insertBefore(trigger, root.firstChild);

    ctrl.open(
      {
        id: 'x',
        title: 'T',
        country: '',
        summary: '',
        videoId: '',
        content: '',
      },
      trigger,
    );

    expect(document.activeElement).not.toBe(trigger);

    ctrl.destroy();

    expect(document.activeElement).toBe(trigger);
  });

  it('destroy() restores trigger when teardown moves focus before restore (pre-hide snapshot)', () => {
    const root = panelFixture();
    const ctrl = createController(root, []);
    ctrl.init();

    const trigger = document.createElement('button');
    trigger.type = 'button';
    root.insertBefore(trigger, root.firstChild);

    ctrl.open(
      {
        id: 'x',
        title: 'T',
        country: '',
        summary: '',
        videoId: '',
        content: '',
      },
      trigger,
    );

    const realTeardown = ctrl._teardownPanelUi.bind(ctrl);
    ctrl._teardownPanelUi = () => {
      realTeardown();
      document.body.setAttribute('tabindex', '-1');
      document.body.focus();
    };

    ctrl.destroy();

    expect(document.activeElement).toBe(trigger);
  });

  it('destroy() moves focus out of the hidden panel when there is no trigger', () => {
    const root = panelFixture();
    const ctrl = createController(root, []);
    ctrl.init();
    const panel = document.getElementById('recipe-panel');
    const closeBtn = root.querySelector('.recipes-panel__close');

    ctrl.open({
      id: 'x',
      title: 'T',
      country: '',
      summary: '',
      videoId: '',
      content: '',
    });

    expect(document.activeElement).toBe(closeBtn);

    ctrl.destroy();

    expect(panel.hidden).toBe(true);
    expect(panel.contains(document.activeElement)).toBe(false);
  });

  it('destroy removes the Escape key listener', () => {
    const root = panelFixture();
    const ctrl = createController(root, []);
    ctrl.init();

    ctrl.open({
      id: 'destroy-test',
      title: 'Destroy Test',
      country: '',
      summary: '',
      videoId: 'clip',
      content: '',
    });

    const closeSpy = vi.spyOn(ctrl, 'close');

    ctrl.destroy();

    closeSpy.mockClear();
    document.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );

    expect(closeSpy).not.toHaveBeenCalled();
  });
});
