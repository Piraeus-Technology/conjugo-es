# ConjuGo ES release checklist

## Code and metadata

- [ ] Start from a clean release branch and review every included commit.
- [ ] Set the release version in `package.json` (`version`) and `app.json`
      (`expo.version`). EAS increments the remotely managed iOS build number
      and Android version code.
- [ ] Run `npm ci`, typecheck, lint, tests with coverage, and the example audit.
- [ ] Run `npx expo-doctor` and confirm all project-health checks pass.
- [ ] Run a clean Expo prebuild and build both native platforms.
- [ ] Confirm the iOS minimum is 16.4. Users on iOS 15.1–16.3 stay on 1.2.3.
- [ ] Confirm the privacy policy and store/support links match shipped behavior.

## Device smoke tests

- [ ] Test search, conjugation audio, quiz, flashcards, stats, settings, and
      learning-data reset with light/dark themes and large text.
- [ ] Test cold launch and returning from the background.
- [ ] Confirm offline use after installation.
- [ ] Set the Android phone language to English. Check that the infinitive,
      conjugation rows, flashcard answers, and auto-play speak Spanish.
- [ ] On iOS, check status-bar icon contrast with the phone set to Light and
      to Dark. For each phone setting, switch between the app's light and dark
      themes while it is open and check the status bar immediately.
- [ ] Tap a Favorite and a Recent row. The row should dim without showing the
      red delete panel or trash icon.
- [ ] Swipe left on Recent and Favorites rows to remove them. Check that
      the row does not linger before disappearing, search results have no
      swipe action, and the screen-reader remove actions work without exposing
      a separate trash icon.

## Tip-jar sandbox tests

Run these in release-configuration native builds with `expo-iap` on physical
devices against both Apple and Google sandbox accounts for `tip_small`.
Android runs R8 only on release builds.

- [ ] Cold-launch the app, then complete a purchase.
- [ ] Background the app during a purchase, then return to the foreground
      and complete it.
- [ ] Cancel a purchase and confirm no error or thank-you state is shown.
- [ ] Recover an interrupted purchase on cold launch before opening More.
      Confirm recovery is silent and the transaction clears.
- [ ] Verify delayed payment and Ask to Buy display the pending message and
      only completed purchases are finished.
- [ ] Replay a pending transaction for a retired product (`tip_medium` or
      `tip_large`) and confirm the app finishes it after payment. Include
      startup and foreground recovery on both platforms.
- [ ] Confirm every purchased, allowlisted tip is finished and does not
      replay on the next cold launch. On Play, a consumable must be consumed
      before it can be bought again. Check that `tip_small` can be bought again.
- [ ] Confirm unrelated product identifiers are ignored.

## Distribution

- [ ] Supply App Store Connect credentials through the release environment or
      EAS credentials; no personal Apple login is committed in `eas.json`.
- [ ] Review the production archive/export size and bundled assets.
- [ ] Upload internal builds first and complete store review metadata.
- [ ] Record the release tag, store build identifiers, and sandbox evidence.

