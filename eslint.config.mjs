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
  {
    /*
     * `next/image` is used for static bundled assets, but it is the wrong tool
     * for these files and enabling it here would cause real regressions:
     *
     *  - Avatars resolve to unbounded third-party or user-supplied hosts
     *    (DiceBear, uploaded URLs). `next/image` requires every host to be
     *    allowlisted in `images.remotePatterns`, so an unlisted host throws at
     *    runtime instead of simply rendering.
     *  - Journal attachments are private bytes served from
     *    `/api/journal/attachments/:id` and authorised by the session cookie.
     *    The image optimiser refetches server-side without that cookie, so
     *    optimisation would turn every attachment into a 401.
     *  - Upload previews are local `blob:`/`data:` URLs, which the optimiser
     *    cannot process at all.
     *
     * The rule stays enabled everywhere else so new static imagery is flagged.
     */
    files: [
      'src/components/ImageUpload.tsx',
      'src/components/Layout.tsx',
      'src/views/Auth.tsx',
      'src/views/Friends.tsx',
      'src/views/Journal.tsx',
      'src/views/Leaderboard.tsx',
      'src/views/Messages.tsx',
      'src/views/Onboarding.tsx',
      'src/views/Settings.tsx',
    ],
    rules: {
      '@next/next/no-img-element': 'off',
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
