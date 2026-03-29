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

});
