# Android

Not a port. The same `mobile/` code builds for both platforms — Android is
`--platform android` instead of `--platform ios`. There is no second codebase
and there must never be one; two copies drift and the second one rots.

Work happens on the `android` branch until a build is proven on a real phone,
so the shipping iOS app is never at risk.

## What was already true

- `app.config.ts` had an `android` block — package `com.sidehuddle.sports`,
  adaptive icon, edge-to-edge. Someone set this up and never built it.
- `assets/adaptive-icon.png` exists.
- Push uses Expo push tokens (`getExpoPushTokenAsync`), not raw APNs. Expo
  routes to Google's service, so `send-push-notification` needs no change —
  only Firebase credentials uploaded to the Expo account.
- All 12 `Platform.OS` branches already have an Android arm. Whoever wrote them
  wrote them properly.
- No iOS-only dependencies.

## Done on this branch

- `eas.json`: APK for development/preview/simulator so a tester can sideload;
  app-bundle for production because that is what Play accepts.
- `app.config.ts`: `intentFilters` for App Links, the Android half of the
  Universal Links work already done for iOS.

## Still open, in the order it bites

1. **The hardware back button.** Nothing in the app handles it — `BackHandler`
   appears nowhere. React Navigation covers plain stack screens, but modals and
   the root screen do not, and on the root screen Android's back gesture drops
   the person out of the app with no warning. This is the one that makes an app
   feel broken to an Android user on day one.

2. **`assetlinks.json` is not published.** `autoVerify` fails silently without
   it and every shared link falls back to the browser — the exact bug that was
   just fixed on iOS. Chicken-and-egg: the file needs the app's signing
   fingerprint, which does not exist until the first EAS build. So build first,
   then `eas credentials` for the SHA-256, then publish the file next to
   `apple-app-site-association`.

3. **Pinning a message is broken on Android.** `HuddleScreen.tsx:1219` uses
   `Alert.prompt`, which is iOS-only. The fallback does not ask for input at
   all — it silently pins the fixed string "Room is open. Check in while you
   watch." An Android owner would tap Pin and get text they never typed. Needs
   a real text-input modal.

4. **Firebase credentials** for push. A Google project and a config file
   uploaded to Expo. Tedious, not hard.

5. **UI shakeout.** Shadows, fonts, keyboard insets and safe areas all render
   differently. Nothing conceptually hard; this is where the days actually go.

## Before registering for Play

A Chrome Web Store account is not a Google Play account — different consoles,
separate registration. And the account TYPE matters more than anything
technical here: a *personal* account (registered after late 2023) has to run a
closed test with 12 testers for 14 continuous days before it can publish
publicly. An organization account does not. Check the current rule before
paying, because choosing wrong costs two weeks of calendar that cannot be
bought back.

## First build

    cd mobile
    EAS_NO_VCS=1 npx eas build --platform android --profile preview

Preview, not production: it produces an installable APK, and the point of the
first build is to find out what breaks, not to ship.
