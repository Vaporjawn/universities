const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettierPlugin = require('eslint-plugin-prettier');

module.exports = tseslint.config(
  {
    // the old .eslintignore skipped every .js file; keep that
    ignores: ['dist/**', 'coverage/**', 'docs/jsdoc/**', 'node_modules/**', '**/*.js'],
  },
  // enum members carry eslint-disable comments written for the base rule; keep them valid
  { linterOptions: { reportUnusedDisableDirectives: 'off' } },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { prettier: prettierPlugin },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      // the base rule misreads parameter names in TypeScript type signatures; the TypeScript-aware rule replaces it
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'prefer-const': 'warn',
      'prefer-destructuring': 'warn',
      'no-console': 'off',
      'no-case-declarations': 'off',
      quotes: ['error', 'single', { avoidEscape: true }],
      'prettier/prettier': 'warn',
    },
  }
);
