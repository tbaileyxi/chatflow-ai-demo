import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Side Huddle Sports",
  slug: "side-huddle-sports",
  scheme: "sidehuddle",
  // 1.0.7 is now closed too. Anything new needs 1.0.8.
  //
  // A version is a "pre-release train", and Apple closes a train once that
  // version has been through review. 1.0.4 is closed: Transporter rejects any
  // build under it with "Invalid Pre-Release Train", no matter how high the
  // build number goes. New work needs a new version, not a new build.
  version: "1.0.8",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#0A0A0A",
  },
  ios: {
    // iPhone-only for 1.0. The app has no iPad-specific layouts, so claiming
    // tablet support meant reviewers would test an unoptimized UI on iPad (and
    // Apple demanded 13" iPad screenshots we have no honest way to produce).
    supportsTablet: false,
    bundleIdentifier: "com.sidehuddle.sports",
    // Universal Links. Without this the app never claims the domain, so a
    // shared https link always lands on the web page even when the app is
    // installed — which is exactly what was happening: tap a room link, get a
    // "Download on the App Store" button you already have.
    //
    // Pairs with public/.well-known/apple-app-site-association, which must be
    // served from the same host as JSON. Both halves or neither works.
    associatedDomains: [
      "applinks:sidehuddlesports.com",
      "applinks:www.sidehuddlesports.com",
    ],
    // Unique within its version train, so 1.0.5 could start at 1 — kept
    // climbing instead so a number is never reused anywhere and `eas
    // build:list` reads in order.
    buildNumber: "78",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // Contacts are hashed on this device and only the hashes are sent, so we
      // can tell you which of your people are already here. The address book
      // itself never leaves the phone and is never stored.
      NSContactsUsageDescription:
        "Side Huddle checks which of your contacts are already here so you can watch games with people you know. Your contacts stay on your device — we only send scrambled codes, never names or numbers.",

      // Camera / photos / microphone.
      //
      // 1.0.4 build 59 was REJECTED under guideline 5.1.1(ii) because these
      // three strings did not exist here at all. expo-image-picker and expo-av
      // then supplied their own defaults — "Allow $(PRODUCT_NAME) to access
      // your camera" — which is almost word for word the example Apple's own
      // guidance gives of a purpose string that does NOT pass review. Contacts
      // was written out properly above; these three were simply never added,
      // so nobody noticed they were template text.
      //
      // Apple asks for two things in each string: what the app does with the
      // resource, and a concrete example. Keep both, and keep them TRUE to
      // what the code actually does — a string promising more than the app
      // does is its own rejection.
      //   camera      -> MessageInput.launchCameraAsync (photo into room chat)
      //   photos      -> MessageInput.launchImageLibraryAsync (photo into room
      //                  chat) and ProfileScreen.launchImageLibraryAsync
      //                  (profile picture)
      //   microphone  -> MessageInput Audio.Recording (voice message in chat)
      NSCameraUsageDescription:
        "Side Huddle uses your camera so you can take a photo and post it straight into a huddle chat — for example, snapping the view from your seat at the game and sending it to your room.",
      NSPhotoLibraryUsageDescription:
        "Side Huddle uses your photo library so you can pick an existing photo to post in a huddle chat, set as your profile picture, or set as the background of a huddle you run — for example, choosing a tailgate photo from your camera roll to share with your room, or putting your chapter's bar photo behind your huddle's chat.",
      NSMicrophoneUsageDescription:
        "Side Huddle uses your microphone to record voice messages you send in a huddle chat — for example, recording a quick reaction to a touchdown and sending it to your room instead of typing it.",
    },
  },
  // The rejected strings came from these two plugins' defaults. Setting them
  // here fixes the value at its source instead of relying on ios.infoPlist
  // winning the merge — belt and braces, because a second rejection on the
  // same guideline is expensive.
  plugins: [
    [
      "expo-image-picker",
      {
        // MUST MATCH ios.infoPlist above. The plugin wins: whatever is set here
        // is what lands in Info.plist, so updating only ios.infoPlist changes
        // nothing — verified by reading the string back out of a built .ipa.
        photosPermission:
          "Side Huddle uses your photo library so you can pick an existing photo to post in a huddle chat, set as your profile picture, or set as the background of a huddle you run — for example, choosing a tailgate photo from your camera roll to share with your room, or putting your chapter's bar photo behind your huddle's chat.",
        cameraPermission:
          "Side Huddle uses your camera so you can take a photo and post it straight into a huddle chat, and to record a short reaction that shows your face and what you are watching at the same time — for example, snapping the view from your seat at the game and sending it to your room.",
      },
    ],
    [
      "expo-av",
      {
        microphonePermission:
          "Side Huddle uses your microphone to record voice messages you send in a huddle chat — for example, recording a quick reaction to a touchdown and sending it to your room instead of typing it.",
      },
    ],
  ],
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0A0A0A",
    },
    edgeToEdgeEnabled: true,
    package: "com.sidehuddle.sports",
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  extra: {
    adminPhoneNumber: process.env.ADMIN_PHONE_NUMBER ?? "",
    bypassPhoneNumber: process.env.BYPASS_PHONE_NUMBER ?? "5555555555",
    eas: {
      projectId: "9cbdc342-9160-4707-aaa0-c231ede47f17",
    },
  },
});
