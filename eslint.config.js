import js from '@eslint/js';
import prettier from 'eslint-config-prettier';

export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        DOMPurify: 'readonly',
        Matter: 'readonly',
        anime: 'readonly',
        Typed: 'readonly',
        marked: 'readonly',
        gsap: 'readonly',
        IntersectionObserver: 'readonly',
        MutationObserver: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        HTMLElement: 'readonly',
        AbortController: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        Image: 'readonly',
        cancelAnimationFrame: 'readonly',
        requestAnimationFrame: 'readonly'
      }
    }
  },
  js.configs.recommended,
  prettier,
  {
    rules: {
      'no-console': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error'
    }
  },
  {
    files: ['api/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly'
      }
    },
    rules: {
      'no-console': ['error', { allow: ['error', 'warn', 'info'] }]
    }
  },
  {
    ignores: ['node_modules/', 'public/', '.planning/', 'backend/']
  }
];
