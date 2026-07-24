# ConjuGo ES

ConjuGo ES is an offline-first Expo/React Native app for searching Spanish
verbs, studying conjugation tables, and practising with quizzes and
flashcards. Learning history, preferences, favourites, and spaced-repetition
weights stay in local device storage.

## Development

The app currently targets Expo SDK 54 and Node 24. Install and verify it with:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run coverage
npm run audit:examples
EXPO_DOCTOR_SKIP_DEPENDENCY_VERSION_CHECK=1 npx expo-doctor
```

The doctor version check is skipped because this branch deliberately keeps
Jest 30, `@types/jest` 30, and `eslint-config-expo` 56. Required peer
dependencies and the remaining project-health checks still run.

Start Metro with `npm start`, or create local native builds with
`npm run ios` / `npm run android`. Native project folders are generated from
`app.json`; do not remove the `react-native-iap` config plugin or its Kotlin
2.2 build property while the app remains on `react-native-iap` 15.0.0.

## Project map

- `src/data/verbs.json` — verb dataset
- `src/utils/conjugate.ts` — conjugation engine and canonical tense types
- `src/screens` — Search, Quiz, Flashcards, Stats, and More screens
- `src/store` — validated local persistence
- `src/__tests__` — logic and React Native component tests
- `docs/index.html` — hosted privacy policy

The three tip products are consumable in-app purchases. Store products,
pricing, and purchase lifecycle changes require sandbox testing on real
devices in both stores; unit tests cannot validate store delivery or
acknowledgement.

See [the release checklist](docs/release-checklist.md) before shipping.
