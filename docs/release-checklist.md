# ConjuGo ES release checklist

## Code and metadata

- [ ] Start from a clean release branch and review every included commit.
- [ ] Keep `package.json` and `app.json` versions aligned.
- [ ] Update iOS build number and Android version code as required.
- [ ] Run `npm ci`, typecheck, lint, tests with coverage, and the example audit.
- [ ] Run Expo Doctor and confirm the required peer-dependency check passes.
- [ ] Run a clean Expo prebuild and build both native platforms.
- [ ] Confirm the privacy policy and store/support links match shipped behavior.

## Device smoke tests

- [ ] Test search, conjugation audio, quiz, flashcards, stats, settings, and
      learning-data reset with light/dark themes and large text.
- [ ] Test cold launch, background/foreground, and remount behavior.
- [ ] Confirm offline use after installation.

## Tip-jar sandbox tests

Run these on physical devices against both Apple and Google sandbox accounts
for `tip_small`, `tip_medium`, and `tip_large`.

- [ ] Cold-launch the app, then complete a purchase.
- [ ] Remount/navigate away and back before completing a purchase.
- [ ] Cancel a purchase and confirm no error or thank-you state is shown.
- [ ] Replay or recover an interrupted purchase and confirm it is processed
      once.
- [ ] Confirm every delivered transaction is finished/acknowledged and does
      not replay on the next cold launch.
- [ ] Confirm unrelated product identifiers are ignored.

## Distribution

- [ ] Supply App Store Connect credentials through the release environment or
      EAS credentials; no personal Apple login is committed in `eas.json`.
- [ ] Review the production archive/export size and bundled assets.
- [ ] Upload internal builds first and complete store review metadata.
- [ ] Record the release tag, store build identifiers, and sandbox evidence.

