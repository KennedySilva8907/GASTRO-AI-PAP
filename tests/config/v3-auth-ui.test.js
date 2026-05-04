import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();

describe('V3 account UI contract', () => {
  ['src/main.js', 'src/chat/index.js', 'src/recipes/index.js', 'src/challenges/index.js'].forEach(
    (file) => {
      it(`${file} initializes the shared account bar`, () => {
        const source = readFileSync(resolve(ROOT, file), 'utf8');
        expect(source).toContain('initAccountBar');
        expect(source).toContain('initAccountBar();');
      });
    }
  );

  it('defines shared account bar styles', () => {
    const css = readFileSync(resolve(ROOT, 'style.css'), 'utf8');
    expect(css).toContain('.account-bar');
    expect(css).toContain('.account-dialog');
  });
});
