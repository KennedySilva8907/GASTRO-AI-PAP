/**
 * Floating editorial recipe panel: video embed, copy, share, focus management.
 */

import { shareRecipe } from './share.js';

/**
 * Normalize a YouTube video id or URL fragment to an embed URL.
 * @param {string} [videoId]
 * @returns {string}
 */
export function buildYouTubeEmbedUrl(videoId = '') {
  const raw = String(videoId ?? '').trim();
  if (!raw) return '';
  const id = raw.split(/[?&#]/)[0].trim();
  if (!id) return '';
  return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
}

export class RecipePanelController {
  /**
   * @param {ParentNode} root
   * @param {unknown[]} catalog
   */
  constructor(root, catalog) {
    this.root = root;
    this.catalog = catalog;
    this._lastTrigger = undefined;
    this._onCloseClick = this.close.bind(this);
    this._onKeydown = this._onKeydown.bind(this);

    this.panel = root.querySelector('#recipe-panel');
    this.closeBtn = root.querySelector('.recipes-panel__close');
    this.videoFrame = root.querySelector('[data-panel-video]');
    this.countryEl = root.querySelector('[data-panel-country]');
    this.titleEl = root.querySelector('[data-panel-title]');
    this.summaryEl = root.querySelector('[data-panel-summary]');
    this.contentEl = root.querySelector('[data-panel-content]');
    this.actionsEl = root.querySelector('[data-panel-actions]');
  }

  init() {
    this.closeBtn?.addEventListener('click', this._onCloseClick);
    document.addEventListener('keydown', this._onKeydown);
  }

  /** Hide panel, stop media, and clear scroll/body state (no focus restore). */
  _teardownPanelUi() {
    if (this.panel) this.panel.hidden = true;
    if (this.videoFrame) {
      this.videoFrame.setAttribute('src', '');
    }
    document.body.classList.remove('recipes-panel-open');
  }

  /**
   * Capture focus relative to the panel before hiding. Browsers may move
   * `document.activeElement` when the panel is hidden; decisions must use this snapshot.
   * @returns {{ wasOpen: boolean, activeBefore: Element | null, focusWasInsidePanel: boolean }}
   */
  _snapshotFocusBeforePanelTeardown() {
    const wasOpen = !!(this.panel && !this.panel.hidden);
    const activeBefore = document.activeElement;
    const focusWasInsidePanel =
      wasOpen &&
      !!this.panel &&
      !!activeBefore &&
      typeof this.panel.contains === 'function' &&
      this.panel.contains(activeBefore);
    return { wasOpen, activeBefore, focusWasInsidePanel };
  }

  /**
   * @param {{ wasOpen: boolean, activeBefore: Element | null, focusWasInsidePanel: boolean }} snap
   */
  _restoreFocusAfterPanelTeardown(snap) {
    if (!snap.wasOpen || !snap.focusWasInsidePanel) return;
    const t = this._lastTrigger;
    if (t && typeof t.focus === 'function') {
      t.focus();
    } else if (snap.activeBefore && typeof snap.activeBefore.blur === 'function') {
      snap.activeBefore.blur();
    }

    // Disabled or non-focusable triggers: focus() can be a no-op; focus may stay on a
    // control inside the now-hidden panel — blur so focus is not trapped invisibly.
    if (
      this.panel &&
      document.activeElement &&
      typeof this.panel.contains === 'function' &&
      this.panel.contains(document.activeElement)
    ) {
      const stuck = document.activeElement;
      if (typeof stuck.blur === 'function') {
        stuck.blur();
      }
    }
  }

  destroy() {
    const snap = this._snapshotFocusBeforePanelTeardown();

    // Always tear down visuals so listeners can be removed without stranding an open panel.
    this._teardownPanelUi();
    this._restoreFocusAfterPanelTeardown(snap);

    this.closeBtn?.removeEventListener('click', this._onCloseClick);
    document.removeEventListener('keydown', this._onKeydown);
  }

  /** @param {KeyboardEvent} e */
  _onKeydown(e) {
    if (e.key !== 'Escape') return;
    if (!this.panel || this.panel.hidden) return;
    this.close();
  }

  /**
   * @param {{
   *   id: string,
   *   title: string,
   *   country?: string,
   *   summary?: string,
   *   videoId?: string,
   *   content?: string
   * }} recipe
   * @param {HTMLElement} [trigger]
   */
  open(recipe, trigger) {
    this._lastTrigger = trigger;

    if (this.countryEl) this.countryEl.textContent = recipe.country ?? '';
    if (this.titleEl) this.titleEl.textContent = recipe.title ?? '';
    if (this.summaryEl) this.summaryEl.textContent = recipe.summary ?? '';
    if (this.contentEl) this.contentEl.innerHTML = recipe.content ?? '';

    if (this.videoFrame) {
      this.videoFrame.setAttribute('src', buildYouTubeEmbedUrl(recipe.videoId ?? ''));
    }

    if (this.actionsEl) {
      this.actionsEl.replaceChildren();
      const shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'share-button recipes-panel__share';
      shareBtn.textContent = 'Partilhar';
      shareBtn.addEventListener('click', () => {
        const url = `${window.location.origin}/recipes/receitas.html#${recipe.id}`;
        void shareRecipe(recipe.title, url);
      });
      this.actionsEl.appendChild(shareBtn);
    }

    if (this.panel) this.panel.hidden = false;
    document.body.classList.add('recipes-panel-open');
    this.closeBtn?.focus();
  }

  close() {
    const snap = this._snapshotFocusBeforePanelTeardown();
    this._teardownPanelUi();
    this._restoreFocusAfterPanelTeardown(snap);
  }
}
