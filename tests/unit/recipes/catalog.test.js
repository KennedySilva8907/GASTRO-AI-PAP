// @vitest-environment jsdom
/**
 * Unit tests for recipe catalog normalization from carousel DOM.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { buildRecipeCatalog } from '../../../src/recipes/catalog.js';

describe('buildRecipeCatalog', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('builds normalized recipe records from rail items, backgrounds, and #recipes-data articles', () => {
    document.body.innerHTML = `
      <ul>
        <li class="js-carousel-list-item">
          <a href="#" data-video-id="vid-xyz?si=1" data-recipe="test_dish">
            <p class="c-mouse-vertical-carousel__eyebrow u-b4">
              <span>01</span> Testland
            </p>
            <p class="c-mouse-vertical-carousel__title u-a5">Test Recipe Title</p>
          </a>
        </li>
      </ul>
      <i class="js-carousel-bg-img" data-bg="https://example.com/hero.jpg"></i>
      <div id="recipes-data">
        <article id="recipe-test_dish" class="recipe-content"><section>x</section></article>
      </div>
    `;

    const catalog = buildRecipeCatalog(document);

    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toEqual({
      id: 'test_dish',
      index: 0,
      articleId: 'recipe-test_dish',
      title: 'Test Recipe Title',
      country: 'Testland',
      videoId: 'vid-xyz?si=1',
      backgroundUrl: 'https://example.com/hero.jpg',
      content: '<section>x</section>',
    });
  });

  it('builds normalized recipe records when given a subtree root element', () => {
    document.body.innerHTML = `
      <section id="catalog-root">
        <ul>
          <li class="js-carousel-list-item">
            <a href="#" data-video-id="vid-subtree" data-recipe="subtree_dish">
              <p class="c-mouse-vertical-carousel__eyebrow u-b4">
                <span>01</span> Subtree Country
              </p>
              <p class="c-mouse-vertical-carousel__title u-a5">Subtree Title</p>
            </a>
          </li>
        </ul>
        <i class="js-carousel-bg-img" data-bg="https://example.com/subtree.jpg"></i>
        <div id="recipes-data">
          <article id="recipe-subtree_dish" class="recipe-content"><p>Subtree body</p></article>
        </div>
      </section>
    `;

    const root = document.querySelector('#catalog-root');
    const catalog = buildRecipeCatalog(root);

    expect(catalog).toEqual([
      {
        id: 'subtree_dish',
        index: 0,
        articleId: 'recipe-subtree_dish',
        title: 'Subtree Title',
        country: 'Subtree Country',
        videoId: 'vid-subtree',
        backgroundUrl: 'https://example.com/subtree.jpg',
        content: '<p>Subtree body</p>',
      },
    ]);
  });

  it('accepts the modern cinematic rail selectors for country and title', () => {
    document.body.innerHTML = `
      <section id="catalog-root-modern">
        <ul class="recipes-rail__list js-carousel-list">
          <li class="recipes-rail__item js-carousel-list-item">
            <a href="#" data-video-id="vid-modern" data-recipe="modern_dish">
              <p class="recipes-rail__eyebrow" data-recipe-country>
                <span>01</span> Modern Country
              </p>
              <p class="recipes-rail__title" data-recipe-title>Modern Title</p>
            </a>
          </li>
        </ul>
        <i class="recipes-stage__bg js-carousel-bg-img" data-bg="https://example.com/modern.jpg"></i>
        <div id="recipes-data">
          <article id="recipe-modern_dish" class="recipe-content"><p>Modern body</p></article>
        </div>
      </section>
    `;

    const root = document.querySelector('#catalog-root-modern');
    const catalog = buildRecipeCatalog(root);

    expect(catalog).toEqual([
      {
        id: 'modern_dish',
        index: 0,
        articleId: 'recipe-modern_dish',
        title: 'Modern Title',
        country: 'Modern Country',
        videoId: 'vid-modern',
        backgroundUrl: 'https://example.com/modern.jpg',
        content: '<p>Modern body</p>',
      },
    ]);
  });
});
