# ConjuGo ES

ConjuGo ES is an offline-first Expo/React Native app for searching Spanish
verbs, studying conjugation tables, and practising with quizzes and
flashcards. Learning history, preferences, favourites, and spaced-repetition
weights stay in local device storage.

## Development

The app targets Expo SDK 58 and Node 24. Use these commands to install and verify it.

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run coverage
npm run audit:examples
npx expo-doctor
```

TypeScript stays on 5.9 for `ts-jest` compatibility and Jest global types.
The `expo.install.exclude` entry in `package.json` preserves that pin when
Expo aligns dependencies.

Start Metro with `npm start`, or create local native builds with
`npm run ios` / `npm run android`. Native project folders are generated from
`app.json`. The `expo-iap` config plugin selects Google Play Billing for
Android builds.

## Project map

- `src/data/verbs.json` — verb dataset
- `src/utils/conjugate.ts` — conjugation engine and canonical tense types
- `src/screens` — Search, Quiz, Flashcards, Stats, and More screens
- `src/store` — validated local persistence
- `src/__tests__` — logic and React Native component tests
- `docs/index.html` — hosted privacy policy

The tip jar offers one consumable in-app purchase, `tip_small`, and displays
the store's localized price. The app also finishes completed purchases of the
retired `tip_medium` and `tip_large` products. Verify store delivery and
transaction completion on real devices in both sandboxes using
release-configuration native builds.

See [the release checklist](docs/release-checklist.md) before shipping.
