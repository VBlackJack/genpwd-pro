module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  ignorePatterns: ['dist/', 'node_modules/'],
  overrides: [
    {
      files: ['tools/**/*.js'],
      env: {
        node: true
      },
      parserOptions: {
        sourceType: 'script'
      }
    }
  ],
  rules: {
    'no-console': 'off'
  }
};
