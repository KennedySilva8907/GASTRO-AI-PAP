import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

function readHTML(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8');
}

const pages = [
  { name: 'index.html', path: 'index.html' },
  { name: 'chat/chatbot.html', path: 'chat/chatbot.html' },
  { name: 'recipes/receitas.html', path: 'recipes/receitas.html' },
  { name: 'challenges/desafio.html', path: 'challenges/desafio.html' },
];

describe('HTML Performance Hints', () => {

  describe('meta description', () => {
    pages.forEach(({ name, path }) => {
      it(`${name} has a meta description`, () => {
        const html = readHTML(path);
        expect(html).toMatch(/<meta\s+name="description"\s+content="[^"]+"/);
      });
    });
  });

  describe('preconnect hints', () => {
    pages.forEach(({ name, path }) => {
      it(`${name} has at least one preconnect link`, () => {
        const html = readHTML(path);
        expect(html).toMatch(/<link\s+rel="preconnect"\s+href="https:\/\//);
      });
    });
  });

  describe('no render-blocking CDN scripts', () => {
    it('index.html: anime.js has defer', () => {
      const html = readHTML('index.html');
      expect(html).toMatch(/anime\.min\.js["']\s+defer/);
    });

    it('chat/chatbot.html: matter.js has defer', () => {
      const html = readHTML('chat/chatbot.html');
      expect(html).toMatch(/matter\.min\.js["']\s+defer/);
    });

    it('chat/chatbot.html: typed.js has defer', () => {
      const html = readHTML('chat/chatbot.html');
      expect(html).toMatch(/typed\.js@2\.0\.12["']\s+defer/);
    });

    it('chat/chatbot.html: marked has defer', () => {
      const html = readHTML('chat/chatbot.html');
      expect(html).toMatch(/marked\.min\.js["']\s+defer/);
    });

    it('chat/chatbot.html: dompurify has defer', () => {
      const html = readHTML('chat/chatbot.html');
      expect(html).toMatch(/purify\.min\.js["']\s+defer/);
    });

    it('recipes/receitas.html: gsap has defer', () => {
      const html = readHTML('recipes/receitas.html');
      expect(html).toMatch(/gsap\.min\.js["']\s+defer/);
    });

    it('challenges/desafio.html: dompurify has defer', () => {
      const html = readHTML('challenges/desafio.html');
      expect(html).toMatch(/purify\.min\.js["']\s+defer/);
    });
  });

  describe('defer scripts before module scripts', () => {
    pages.forEach(({ name, path }) => {
      it(`${name}: all defer scripts appear before type="module" script`, () => {
        const html = readHTML(path);
        // Find position of the entry-point module script (the last type="module" in the file,
        // which is always the local script.js entry point)
        const moduleMatches = [...html.matchAll(/type="module"/g)];
        if (moduleMatches.length === 0) return;
        // Use the LAST type="module" occurrence (the entry-point script.js)
        const lastModulePos = moduleMatches[moduleMatches.length - 1].index;
        // Find start positions of all <script> tags that have defer
        const deferScriptMatches = [...html.matchAll(/<script\b[^>]*\bdefer\b[^>]*>/g)];
        if (deferScriptMatches.length > 0) {
          deferScriptMatches.forEach((match) => {
            expect(match.index).toBeLessThan(lastModulePos);
          });
        }
      });
    });
  });

  describe('transition bootstrapping', () => {
    pages.forEach(({ name, path }) => {
      it(`${name}: preload script checks the transition metadata key`, () => {
        const html = readHTML(path);
        expect(html).toMatch(/sessionStorage\.getItem\(['"]gastro-transition-meta['"]\)/);
      });

      it(`${name}: legacy transition overlay markup is gone`, () => {
        const html = readHTML(path);
        expect(html).not.toContain('transition-overlay');
      });
    });
  });

  describe('recipes/receitas.html cinematic shell contract', () => {
    it('has required stage, panel, and rail hooks; no legacy modal class', () => {
      const html = readHTML('recipes/receitas.html');
      expect(html).toContain('class="recipes-stage"');
      expect(html).toContain('id="recipe-panel"');
      expect(html).toContain('class="recipes-rail__list js-carousel-list"');
      expect(html).not.toContain('class="modal"');
    });

    it('matches the approved cinematic A shell instead of the old carousel shell', () => {
      const html = readHTML('recipes/receitas.html');
      expect(html).toContain('class="recipes-stage__grain"');
      expect(html).toContain('class="recipes-stage__glow');
      expect(html).toContain('class="recipes-panel__media video-container"');
      expect(html).toContain('class="recipes-panel__close"');
      expect(html).not.toContain('c-gradient-overlay');
      expect(html).not.toContain('c-mouse-vertical-carousel js-carousel');
    });

    it('keeps the cinematic stage concise without helper hint copy or rail excerpts', () => {
      const html = readHTML('recipes/receitas.html');
      expect(html).not.toContain('class="recipes-rail__hint"');
      expect(html).not.toContain('class="recipes-rail__excerpt"');
      expect(html).not.toContain('class="recipes-stage__pill');
      expect(html).not.toContain('class="recipes-stage__chip"');
      expect(html).not.toContain('class="recipes-stage__lede"');
      expect(html).not.toContain('Seleção curada');
      expect(html).not.toContain('Arquivo curado');
      expect(html).not.toContain('Painel editorial');
      expect(html).not.toMatch(/World recipes archive/i);
      expect(html).not.toMatch(/arquivo cinematogr/i);
      expect(html).toContain('Vídeo + receita');
      expect(html).toContain('Sabores do mundo');
      expect(html.match(/class="recipes-panel__meta-pill"/g) ?? []).toHaveLength(1);
      expect(html).toContain('class="recipes-stage__grain" data-depth=');
      expect(html).toContain('class="recipes-stage__glow recipes-stage__glow--primary" data-depth=');
      expect(html).toContain('class="recipes-stage__hero" data-depth=');
      expect(html).not.toMatch(/<aside class="recipes-rail"[^>]*data-depth=/);
    });
  });

  describe('recipes/style.css mobile rail safeguards', () => {
    it('avoids duplicate 428px phone overrides and unreadable tiny rail text', () => {
      const css = readFileSync(resolve(ROOT, 'recipes/style.css'), 'utf-8');
      expect((css.match(/@media screen and \(max-width: 428px\)/g) ?? []).length).toBeLessThanOrEqual(1);
      expect(css).not.toContain('font-size: 0.5rem !important');
    });
  });

});
