module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    'import/no-extraneous-dependencies': 'off',
    'import/extensions': 'off',
    'import/no-unresolved': 'off',
    'import/no-import-module-exports': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    'no-unused-vars': 'warn',
    'prefer-const': 'warn',
    'prefer-destructuring': 'warn',
    'no-console': 'off',
    'no-case-declarations': 'off',
    'promise/always-return': 'off',
    'jsx-a11y/interactive-supports-focus': 'off',
    quotes: ['error', 'single'],
    'prettier/prettier': 'warn',
  },
};
