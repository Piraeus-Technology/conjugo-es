# ConjuGo ES release checklist

## Code and metadata

- [ ] Start from a clean release branch and review every included commit.
- [ ] Set the release version in `package.json` (`version`) and `app.json`
      (`expo.version`). EAS increments the remotely managed iOS build number
      and Android version code.
- [ ] Run `npm ci`, typecheck, lint, tests with coverage, and the example audit.
- [ ] Run `npx expo-doctor` and confirm all project-health checks pass.
- [ ] Run a clean Expo prebuild and build both native platforms.
- [ ] Confirm the privacy policy and store/support links match shipped behavior.

## Device smoke tests

- [ ] Test search, conjugation audio, quiz, flashcards, stats, settings, and
      learning-data reset with light/dark themes and large text.
- [ ] Test cold launch, background/foreground, and remount behavior.
- [ ] Confirm offline use after installation.
- [ ] Swipe left on Recent and Favorites rows to remove them. Check that
      search results have no swipe action and that the screen-reader remove
      actions work.

## Tip-jar sandbox tests

Run these in native builds with `expo-iap` on physical devices against both
Apple and Google sandbox accounts for `tip_small`.

- [ ] Cold-launch the app, then complete a purchase.
- [ ] Remount/navigate away and back before completing a purchase.
- [ ] Cancel a purchase and confirm no error or thank-you state is shown.
- [ ] Recover an interrupted purchase on cold launch before opening More.
      Confirm recovery is silent and the transaction clears.
- [ ] Verify delayed payment and Ask to Buy display the pending message and
      only completed purchases are finished.
- [ ] Replay a pending transaction for a retired product (`tip_medium` or
      `tip_large`) and confirm the app finishes it after payment. Include
      startup and foreground recovery on both platforms.
- [ ] Confirm every delivered transaction is finished/acknowledged and does
      not replay on the next cold launch.
- [ ] Confirm unrelated product identifiers are ignored.

## Distribution

- [ ] Supply App Store Connect credentials through the release environment or
      EAS credentials; no personal Apple login is committed in `eas.json`.
- [ ] Review the production archive/export size and bundled assets.
- [ ] Upload internal builds first and complete store review metadata.
- [ ] Record the release tag, store build identifiers, and sandbox evidence.

