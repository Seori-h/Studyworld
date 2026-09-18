import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const browserWorkerGlobals = Object.fromEntries(
  [
    'AbortController',
    'atob',
    'Blob',
    'btoa',
    'console',
    'crypto',
    'document',
    'Event',
    'fetch',
    'File',
    'FormData',
    'Headers',
    'history',
    'HTMLInputElement',
    'location',
    'navigator',
    'Request',
    'Response',
    'setTimeout',
    'clearTimeout',
    'TextDecoder',
    'TextEncoder',
    'URL',
    'URLSearchParams',
    'window',
  ].map((name) => [name, 'readonly']),
);

const nodeScriptGlobals = {
  console: 'readonly',
  URL: 'readonly',
};

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '.wrangler/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: browserWorkerGlobals,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      'no-console': [
        'error',
        { allow: ['warn', 'error'] },
      ],
    },
  },

  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: nodeScriptGlobals,
    },
  },
);