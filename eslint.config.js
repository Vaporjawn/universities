const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettierPlugin = require('eslint-plugin-prettier');

module.exports = tseslint.config(
  {
    // the old .eslintignore skipped every .js file; keep that
    ignores: ['dist/**', 'coverage/**', 'docs/jsdoc/**', 'node_modules/**', '**/*.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { prettier: prettierPlugin },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-unused-vars': 'warn',
      'prefer-const': 'warn',
      'prefer-destructuring': 'warn',
      'no-console': 'off',
      'no-case-declarations': 'off',
      quotes: ['error', 'single'],
      'prettier/prettier': 'warn',
    },
  }
);
