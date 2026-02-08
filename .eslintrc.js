module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true,
  },
  extends: ['airbnb', 'prettier'],
  plugins: ['prettier'],
  overrides: [
    {
      env: {
        node: true,
      },
      files: ['.eslintrc.{js,cjs}'],
      parserOptions: {
        sourceType: 'script',
      },
    },
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    'import/no-unresolved': 'off',
    'no-param-reassign': 'off',
    'import/extensions': 'off',
    'import/no-extraneous-dependencies': 'off',
    'consistent-return': 'off',
    'arrow-body-style': 'off',
    'node/no-missing-requires': 'off',
  },
};
