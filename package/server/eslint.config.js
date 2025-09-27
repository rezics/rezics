import {defineConfig} from 'eslint/config';
import globals from 'globals';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import {includeIgnoreFile} from '@eslint/compat';
// import prettier from 'eslint-plugin-prettier';
import pluginN from 'eslint-plugin-n';
import path from 'node:path';

export default defineConfig([
  includeIgnoreFile(path.join(import.meta.dirname, '.gitignore')),
  // Base settings for all files
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: {...globals.browser, ...globals.node},
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      // prettier,
    },
    rules: {
      // Core JS
      // 'prettier/prettier': 'error',
      'block-scoped-var': 'error',
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'no-restricted-properties': [
        'error',
        {
          object: 'describe',
          property: 'only',
        },
        {
          object: 'it',
          property: 'only',
        },
      ],
    },
  },

  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },

  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    extends: [js.configs.recommended],
  },

  // TS settings
  tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      n: pluginN,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',

      // Node plugin settings for TS
      'n/no-missing-import': 'off',
      'n/no-empty-function': 'off',
      'n/no-unsupported-features/es-syntax': 'off',
      'n/no-missing-require': 'off',

      'no-dupe-class-members': 'off',
      'require-atomic-updates': 'off',
    },
  },
  {
    ignores: ['**/build/', '**/dist/', '**/node_modules/'],
  },
]);
