import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const vercelConfig = JSON.parse(
  readFileSync(resolve(ROOT, 'vercel.json'), 'utf-8')
);

describe('vercel.json Cache-Control Headers', () => {

  it('has a headers array', () => {
    expect(vercelConfig).toHaveProperty('headers');
    expect(Array.isArray(vercelConfig.headers)).toBe(true);
    expect(vercelConfig.headers.length).toBeGreaterThanOrEqual(4);
  });

  it('API routes have no-store header', () => {
    const apiHeader = vercelConfig.headers.find(h => h.source.includes('/api/'));
    expect(apiHeader).toBeDefined();
    const cacheControl = apiHeader.headers.find(h => h.key === 'Cache-Control');
    expect(cacheControl.value).toContain('no-store');
  });

  it('CSS files have immutable cache header', () => {
    const cssHeader = vercelConfig.headers.find(h => h.source.includes('.css'));
    expect(cssHeader).toBeDefined();
    const cacheControl = cssHeader.headers.find(h => h.key === 'Cache-Control');
    expect(cacheControl.value).toContain('immutable');
    expect(cacheControl.value).toContain('max-age=31536000');
  });

  it('JS files have immutable cache header', () => {
    const jsHeader = vercelConfig.headers.find(h => h.source.includes('.js'));
    expect(jsHeader).toBeDefined();
    const cacheControl = jsHeader.headers.find(h => h.key === 'Cache-Control');
    expect(cacheControl.value).toContain('immutable');
    expect(cacheControl.value).toContain('max-age=31536000');
  });

  it('image files have immutable cache header', () => {
    const imgHeader = vercelConfig.headers.find(h =>
      h.source.includes('.png') || h.source.includes('.jpg') || h.source.includes('.svg')
    );
    expect(imgHeader).toBeDefined();
    const cacheControl = imgHeader.headers.find(h => h.key === 'Cache-Control');
    expect(cacheControl.value).toContain('immutable');
  });

  it('HTML files have must-revalidate header (not immutable)', () => {
    const htmlHeader = vercelConfig.headers.find(h => h.source.includes('.html'));
    expect(htmlHeader).toBeDefined();
    const cacheControl = htmlHeader.headers.find(h => h.key === 'Cache-Control');
    expect(cacheControl.value).toContain('must-revalidate');
    expect(cacheControl.value).not.toContain('immutable');
  });

  it('API no-store rule appears before JS immutable rule', () => {
    const apiIndex = vercelConfig.headers.findIndex(h => h.source.includes('/api/'));
    const jsIndex = vercelConfig.headers.findIndex(h =>
      h.source.includes('.js') && !h.source.includes('/api/')
    );
    expect(apiIndex).toBeLessThan(jsIndex);
  });

  it('preserves existing builds and routes', () => {
    expect(vercelConfig).toHaveProperty('builds');
    expect(vercelConfig).toHaveProperty('routes');
    expect(vercelConfig.builds.length).toBe(2);
    expect(vercelConfig.routes.length).toBe(5);
  });

});
