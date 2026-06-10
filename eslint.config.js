const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['node_modules/*', 'coverage/*', '.expo/*', 'dist/*'],
  },
  {
    rules: {
      // React-compiler-era rules that reject patterns this codebase uses
      // deliberately: latest-value refs assigned during render (the
      // useSessionAutosave claim/rollback design) and async-gated
      // setState-in-effect (question/card generation after stores load).
      // The classic rules-of-hooks and exhaustive-deps stay on.
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['jest.setup.ui.js'],
    languageOptions: {
      globals: { jest: 'readonly' },
    },
  },
]);
