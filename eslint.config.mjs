import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginSecurity from 'eslint-plugin-security';
import pluginSonarjs from 'eslint-plugin-sonarjs';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/coverage/**',
      'reports/**',
    ],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  pluginSecurity.configs.recommended,
  pluginSonarjs.configs.recommended,
  prettier,

  {
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      'sonarjs/cognitive-complexity': ['warn', 20],
      'sonarjs/todo-tag': 'warn',
      'sonarjs/no-hardcoded-passwords': 'off',
    },
  },

  {
    files: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/require-await': 'warn',
    },
  },

  {
    files: ['scripts/**/*.ts', 'examples/**/*.ts'],
    rules: {
      'no-console': 'off',
      'security/detect-non-literal-fs-filename': 'off',
    },
  },

  {
    files: ['**/tests/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
    rules: {
      'security/detect-object-injection': 'off',
      'sonarjs/no-hardcoded-secrets': 'off',
    },
  },
);
