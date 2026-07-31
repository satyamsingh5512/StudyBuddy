import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig([
  ...nextVitals,
  prettier,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      // React 19 compiler-oriented rules are intentionally deferred while the app remains on React 18.
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
    },
  },
  globalIgnores([
    '**/.next/**',
    'node_modules/**',
    'dist/**',
    'dist-server/**',
    'build/**',
    'coverage/**',
    'android/**',
    'ios/**',
  ]),
]);
