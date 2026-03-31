/**
 * Build a normalized catalog of recipes from carousel DOM (rail, backgrounds, hidden articles).
 */

import { getBackgroundImageUrl } from './preloader.js';

/** @param {string|null|undefined} value */
function trimText(value) {
  return (value ?? '').trim();
}

/**
 * Country line in the eyebrow may include a numeric index in a leading <span>; strip spans and trim.
 * @param {Element|null|undefined} eyebrowEl
 */
function extractCountryFromEyebrow(eyebrowEl) {
  if (!eyebrowEl) return '';
  const clone = eyebrowEl.cloneNode(true);
  clone.querySelectorAll('span').forEach((span) => span.remove());
  return trimText(clone.textContent);
}

/**
 * @param {ParentNode} [root]
 * @returns {Array<{
 *   id: string,
 *   index: number,
 *   articleId: string,
 *   title: string,
 *   country: string,
 *   videoId: string,
 *   backgroundUrl: string|null,
 *   content: string
 * }>}
 */
export function buildRecipeCatalog(root = document) {
  const items = [...root.querySelectorAll('.js-carousel-list-item')];
  const backgrounds = [...root.querySelectorAll('.js-carousel-bg-img')];

  return items
    .map((item, index) => {
      const anchor = item.querySelector('a[data-recipe]');
      if (!anchor) return null;

      const recipeId = anchor.getAttribute('data-recipe');
      if (!recipeId) return null;

      const articleId = `recipe-${recipeId}`;
      const article = root.querySelector(`[id="${articleId}"]`);
      if (!article) return null;

      const eyebrow =
        anchor.querySelector('[data-recipe-country]') ??
        anchor.querySelector('.recipes-rail__eyebrow') ??
        anchor.querySelector('.c-mouse-vertical-carousel__eyebrow');
      const titleEl =
        anchor.querySelector('[data-recipe-title]') ??
        anchor.querySelector('.recipes-rail__title') ??
        anchor.querySelector('.c-mouse-vertical-carousel__title');

      const backgroundEl = backgrounds[index];
      const backgroundUrl = backgroundEl ? getBackgroundImageUrl(backgroundEl) : null;

      return {
        id: recipeId,
        index,
        articleId,
        title: trimText(titleEl?.textContent),
        country: extractCountryFromEyebrow(eyebrow),
        videoId: anchor.getAttribute('data-video-id') ?? '',
        backgroundUrl,
        content: article.innerHTML,
      };
    })
    .filter((record) => record != null);
}
