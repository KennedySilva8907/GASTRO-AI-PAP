import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const RECIPES_CSS = resolve(ROOT, 'recipes', 'style.css');

/**
 * @param {string} css
 * @param {string} mediaHeader e.g. '@media (prefers-reduced-motion: reduce)'
 * @returns {string[]}
 */
function extractTopLevelMediaBlockBodies(css, mediaHeader) {
  const bodies = [];
  let pos = 0;
  while (true) {
    const idx = css.indexOf(mediaHeader, pos);
    if (idx === -1) break;
    const open = css.indexOf('{', idx);
    if (open === -1) break;
    let depth = 0;
    for (let i = open; i < css.length; i++) {
      const c = css[i];
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          bodies.push(css.slice(open + 1, i));
          pos = i + 1;
          break;
        }
      }
    }
  }
  return bodies;
}

function readRecipesCss() {
  return readFileSync(RECIPES_CSS, 'utf-8');
}

describe('recipes/style.css design contract (cinematic layers)', () => {
  it('defines .recipes-stage with transform-style: preserve-3d', () => {
    const css = readRecipesCss();
    expect(css).toMatch(/\.recipes-stage\b/);
    const stageIdx = css.indexOf('.recipes-stage');
    expect(stageIdx).toBeGreaterThan(-1);
    const windowAround = css.slice(stageIdx, stageIdx + 900);
    expect(windowAround).toMatch(/transform-style:\s*preserve-3d/i);
  });

  it('defines .recipes-panel (editorial / modal shell hook)', () => {
    const css = readRecipesCss();
    expect(css).toMatch(/\.recipes-panel\b/);
  });

  it('defines the cinematic stage layers and does not keep the old gradient overlay shell', () => {
    const css = readRecipesCss();
    expect(css).toMatch(/\.recipes-stage__grain\b/);
    expect(css).toMatch(/\.recipes-stage__glow\b/);
    expect(css).toMatch(/\.recipes-stage__pill\b/);
    expect(css).toMatch(/\.recipes-panel__media\b/);
    expect(css).not.toMatch(/\.c-gradient-overlay\b/);
  });

  it('keeps the active rail card readable without a top gradient wash', () => {
    const css = readRecipesCss();
    expect(css).not.toMatch(/\.recipes-rail__item\.is-active a\s*\{[^}]*background:\s*linear-gradient/i);
    expect(css).not.toMatch(/\.recipes-rail__item\.is-active a\s*\{[^}]*241,\s*109,\s*34/i);
    expect(css).toMatch(
      /^\.recipes-rail__item\.is-active a\s*\{[\s\S]*?background:\s*rgba\(41,\s*31,\s*26,\s*0\.9[2-9]\);/m,
    );
  });

  it('overscans the stage background and offsets the rail away from the top-right corner', () => {
    const css = readRecipesCss();
    const bgIdx = css.indexOf('.recipes-stage__bg,');
    const bgWindow = css.slice(bgIdx, bgIdx + 260);
    expect(bgWindow).toMatch(/inset:\s*-\d+%/i);

    const railIdx = css.indexOf('.recipes-rail {');
    const railWindow = css.slice(railIdx, railIdx + 320);
    expect(railWindow).toMatch(/top:\s*clamp\(80px,\s*11vh,\s*118px\)/i);
    expect(railWindow).toMatch(/right:\s*clamp\(/i);
  });

  it('boosts the eyebrow label contrast in the recipe rail', () => {
    const css = readRecipesCss();
    expect(css).toMatch(
      /^\.recipes-rail__eyebrow\s*\{[\s\S]*?font-size:\s*12px;[\s\S]*?font-weight:\s*800;/m,
    );
    expect(css).not.toMatch(/^\.recipes-rail__eyebrow span\s*\{[\s\S]*b86f37/m);
  });

  it('moves the rail into normal flow on touch layouts so recipe switching stays reachable above the fold', () => {
    const css = readRecipesCss();
    const bodies = extractTopLevelMediaBlockBodies(css, '@media (max-width: 920px)');
    expect(bodies.length).toBeGreaterThan(0);
    const touchBlock = bodies[0];
    expect(touchBlock).toMatch(
      /\.recipes-rail\s*\{[\s\S]*?position:\s*relative;[\s\S]*?top:\s*auto;[\s\S]*?right:\s*auto;[\s\S]*?bottom:\s*auto;[\s\S]*?width:\s*auto;[\s\S]*?margin:\s*24px\s+24px\s+0;[\s\S]*?transform:\s*none;/m,
    );
    expect(touchBlock).toMatch(
      /\.recipes-rail__list\s*\{[\s\S]*?max-height:\s*290px;/m,
    );
  });

  it('keeps the portrait mobile rail compact instead of reintroducing the below-the-fold 64 percent offset', () => {
    const css = readRecipesCss();
    const bodies = extractTopLevelMediaBlockBodies(css, '@media (max-width: 640px)');
    expect(bodies.length).toBeGreaterThan(0);
    const mobileBlock = bodies[0];
    expect(mobileBlock).not.toMatch(/top:\s*64%/m);
    expect(mobileBlock).toMatch(
      /\.recipes-stage\s*\{[\s\S]*?min-height:\s*860px;/m,
    );
    expect(mobileBlock).toMatch(
      /\.recipes-rail\s*\{[\s\S]*?margin:\s*18px\s+12px\s+0;[\s\S]*?padding:\s*14px;/m,
    );
    expect(mobileBlock).toMatch(
      /\.recipes-rail__list\s*\{[\s\S]*?max-height:\s*248px;/m,
    );
  });

  it('adds extra top spacing for the stacked hero so the fixed back button does not overlap tablet/mobile copy', () => {
    const css = readRecipesCss();
    const bodies = extractTopLevelMediaBlockBodies(css, '@media (max-width: 920px)');
    expect(bodies.length).toBeGreaterThan(0);
    const tabletBlock = bodies[0];
    expect(tabletBlock).toMatch(
      /\.recipes-stage__hero\s*\{[\s\S]*?padding:\s*88px\s+24px\s+0;/m,
    );
  });

  it('adds a short-landscape override so the rail stays visible and the panel goes back to a split layout', () => {
    const css = readRecipesCss();
    const bodies = extractTopLevelMediaBlockBodies(
      css,
      '@media (max-width: 920px) and (max-height: 480px) and (orientation: landscape)',
    );
    expect(bodies.length).toBeGreaterThan(0);
    const shortLandscapeBlock = bodies[0];
    expect(shortLandscapeBlock).toMatch(
      /\.recipes-rail\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?top:\s*86px;[\s\S]*?bottom:\s*auto;[\s\S]*?width:\s*288px;/m,
    );
    expect(shortLandscapeBlock).toMatch(
      /\.recipes-panel\.recipe-panel__surface\s*\{[\s\S]*?grid-template-columns:\s*minmax\(260px,\s*1\.02fr\)\s+minmax\(260px,\s*0\.98fr\);/m,
    );
    expect(shortLandscapeBlock).toMatch(
      /\.recipes-panel__media\.video-container\s*\{[\s\S]*?padding-bottom:\s*0;/m,
    );
  });

  it('makes the active rail title and eyebrow high-contrast against the darker selected card', () => {
    const css = readRecipesCss();
    expect(css).toMatch(
      /^\.recipes-rail__item\.is-active \.recipes-rail__title\s*\{[\s\S]*?color:\s*#fff8ef;/m,
    );
    expect(css).toMatch(
      /^\.recipes-rail__item\.is-active \.recipes-rail__eyebrow\s*\{[\s\S]*?color:\s*#eadfce;/m,
    );
  });

  it('adds dynamic top and bottom fade masks so scrolled cards disappear instead of cutting off hard', () => {
    const css = readRecipesCss();
    expect(css).toMatch(/^\.recipes-rail\s*\{[\s\S]*?overflow:\s*hidden;/m);
    expect(css).toMatch(
      /^\.recipes-rail__list\s*\{[\s\S]*?mask-image:\s*linear-gradient\(/m,
    );
    expect(css).toMatch(
      /^\.recipes-rail\.has-fade-top \.recipes-rail__list\s*\{[\s\S]*?--rail-fade-top:\s*36px;/m,
    );
    expect(css).toMatch(
      /^\.recipes-rail\.has-fade-bottom \.recipes-rail__list\s*\{[\s\S]*?--rail-fade-bottom:\s*36px;/m,
    );
  });

  it('defines one real panel shell block and one centered floating panel surface block', () => {
    const css = readRecipesCss();
    expect(css.match(/^#recipe-panel\.recipe-panel\s*\{/gm) ?? []).toHaveLength(1);
    expect(css.match(/^\.recipes-panel\.recipe-panel__surface\s*\{\r?\n\s{2}left:\s*50%;/gm) ?? []).toHaveLength(1);
    expect(css.match(/^\.recipe-panel\s*\{/gm) ?? []).toHaveLength(0);
  });

  it('includes prefers-reduced-motion fallback that targets stage and real panel selector', () => {
    const css = readRecipesCss();
    const bodies = extractTopLevelMediaBlockBodies(
      css,
      '@media (prefers-reduced-motion: reduce)',
    );
    expect(bodies.length).toBeGreaterThan(0);
    const hasRecipesScopedReduce = bodies.some(
      (b) =>
        b.includes('.recipes-stage') &&
        b.includes('#recipe-panel.recipe-panel'),
    );
    expect(hasRecipesScopedReduce).toBe(true);
  });
});
