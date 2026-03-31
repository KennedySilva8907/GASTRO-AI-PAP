/**
 * Stage controller: active recipe rail/background/hero state and 3D depth parallax.
 */

/** Subtle per-depth travel factor inspired by the approved preview. */
const DEPTH_TRAVEL_FACTOR = 0.14;
const MAX_TRAVEL_PX = 10;
const RAIL_FADE_TOLERANCE_PX = 2;

/**
 * @param {number} value
 * @returns {number}
 */
function clampDepthTravel(value) {
  return Math.max(-MAX_TRAVEL_PX, Math.min(MAX_TRAVEL_PX, value));
}

/**
 * @param {number} depth - Layer depth multiplier (from data-depth).
 * @param {number} px - Normalized pointer X offset (0 = left edge, 1 = right).
 * @param {number} py - Normalized pointer Y offset (0 = top, 1 = bottom).
 * @param {{ centered?: boolean }} [options]
 * @returns {string}
 */
export function buildDepthTransform(depth, px, py, { centered = false } = {}) {
  const z = Number(depth);
  const cx = px - 0.5;
  const cy = py - 0.5;
  const ox = clampDepthTravel(cx * DEPTH_TRAVEL_FACTOR * z);
  const oy = clampDepthTravel(cy * DEPTH_TRAVEL_FACTOR * z);
  if (centered) {
    return `translate3d(calc(-50% + ${ox}px), calc(-50% + ${oy}px), ${z}px)`;
  }
  return `translate3d(${ox}px, ${oy}px, ${z}px)`;
}

/**
 * @param {Element} el
 * @returns {number}
 */
function getLayerScale(el) {
  return el.matches('.recipes-stage__bg, .js-carousel-bg-img') ? 1.18 : 1;
}

export class RecipesStageController {
  /**
   * @param {ParentNode} root
   * @param {Array<{ id: string, title: string, country: string }>} catalog
   * @param {{ onOpen: (recipe: object, item: Element) => void }} options
   */
  constructor(root, catalog, { onOpen }) {
    this.root = root;
    this.catalog = catalog;
    this.onOpen = onOpen;

    this.stage = root.querySelector('.recipes-stage');
    this.backgrounds = this.stage
      ? [...this.stage.querySelectorAll('.recipes-stage__bg')]
      : [];
    this.rail = root.querySelector('.recipes-rail');
    this.railList = root.querySelector('.recipes-rail__list');
    this.railItems = [...root.querySelectorAll('.recipes-rail__item')];
    this.heroTitleHost = root.querySelector('[data-hero-title]');
    this.heroSummaryHost = root.querySelector('[data-hero-summary]');
    this.depthLayers = [...root.querySelectorAll('[data-depth]')];

    /** @type {number} */
    this.activeIndex = -1;

    this._onRailClick = this._onRailClick.bind(this);
    this._onRailScroll = () => this.updateRailFadeState();
    this._onPointerMove = (e) => this.handlePointer(e);
    this._onPointerLeave = () => this.resetDepth();
  }

  /** @returns {Element|null} */
  _titleTextNode() {
    return (
      this.heroTitleHost?.querySelector('.recipes-stage__hero-title') ?? this.heroTitleHost
    );
  }

  /** @returns {Element|null} */
  _summaryTextNode() {
    return (
      this.heroSummaryHost?.querySelector('.recipes-stage__hero-summary') ??
      this.heroSummaryHost
    );
  }

  /**
   * @param {number} index
   * @returns {boolean}
   */
  _hasMatchingStageData(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.catalog.length) {
      return false;
    }

    if (this.backgrounds.length > 0 && index >= this.backgrounds.length) {
      return false;
    }

    return true;
  }

  init() {
    this.railItems.forEach((item) => {
      item.addEventListener('click', this._onRailClick);
    });

    this.railList?.addEventListener('scroll', this._onRailScroll, { passive: true });

    if (this.stage) {
      this.stage.addEventListener('pointermove', this._onPointerMove);
      this.stage.addEventListener('pointerleave', this._onPointerLeave);
    }

    this.setActive(0);
    this.resetDepth();
    this.updateRailFadeState();
  }

  destroy() {
    this.railItems.forEach((item) => {
      item.removeEventListener('click', this._onRailClick);
    });

    this.railList?.removeEventListener('scroll', this._onRailScroll);

    if (this.stage) {
      this.stage.removeEventListener('pointermove', this._onPointerMove);
      this.stage.removeEventListener('pointerleave', this._onPointerLeave);
    }
  }

  updateRailFadeState() {
    if (!this.rail || !this.railList) return;

    const scrollRange = Math.max(this.railList.scrollHeight - this.railList.clientHeight, 0);
    const hasOverflow = scrollRange > RAIL_FADE_TOLERANCE_PX;
    const hasTopFade = hasOverflow && this.railList.scrollTop > RAIL_FADE_TOLERANCE_PX;
    const hasBottomFade =
      hasOverflow && this.railList.scrollTop < scrollRange - RAIL_FADE_TOLERANCE_PX;

    this.rail.classList.toggle('has-fade-top', hasTopFade);
    this.rail.classList.toggle('has-fade-bottom', hasBottomFade);
  }

  /**
   * @param {MouseEvent} event
   */
  _onRailClick(event) {
    const item = event.currentTarget;
    const index = this.railItems.indexOf(item);
    if (index < 0) return;

    event.preventDefault();
    if (!this._hasMatchingStageData(index)) return;

    if (index === this.activeIndex) {
      const recipe = this.catalog[index];
      if (recipe) this.onOpen(recipe, item);
    } else {
      this.setActive(index);
    }
  }

  /**
   * @param {number} index
   */
  setActive(index) {
    if (!this._hasMatchingStageData(index)) return;

    const recipe = this.catalog[index];

    this.activeIndex = index;

    this.railItems.forEach((el, idx) => {
      el.classList.toggle('is-active', idx === index);
    });

    this.backgrounds.forEach((el, idx) => {
      el.classList.toggle('is-visible', idx === index);
    });

    const titleEl = this._titleTextNode();
    if (titleEl) titleEl.textContent = recipe.title;

    const summaryEl = this._summaryTextNode();
    if (summaryEl) {
      summaryEl.textContent = `${recipe.country} em destaque nas receitas do mundo.`;
    }

    if (this.stage) {
      this.stage.dataset.activeRecipe = recipe.id;
    }
  }

  /**
   * @param {PointerEvent} event
   */
  handlePointer(event) {
    if (!this.stage) return;
    const rect = this.stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;

    for (const el of this.depthLayers) {
      const raw = el.getAttribute('data-depth');
      const depth = raw != null && raw !== '' ? Number.parseFloat(raw) : 0;
      if (Number.isNaN(depth)) continue;

      const centered = el.classList.contains('recipes-panel');
      const scale = getLayerScale(el);
      const transform = buildDepthTransform(depth, px, py, { centered });
      el.style.transform = scale === 1 ? transform : `${transform} scale(${scale})`;
    }
  }

  resetDepth() {
    for (const el of this.depthLayers) {
      const raw = el.getAttribute('data-depth');
      const depth = raw != null && raw !== '' ? Number.parseFloat(raw) : 0;
      if (Number.isNaN(depth)) continue;

      const scale = getLayerScale(el);
      if (el.classList.contains('recipes-panel')) {
        el.style.transform = `translate3d(-50%, -50%, ${depth}px)`;
      } else if (scale !== 1) {
        el.style.transform = `translateZ(${depth}px) scale(${scale})`;
      } else {
        el.style.transform = `translateZ(${depth}px)`;
      }
    }
  }
}
