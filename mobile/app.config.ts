import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Side Huddle Sports",
  slug: "side-huddle-sports",
  scheme: "sidehuddle",
  version: "1.0.3",
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
    buildNumber: "40",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
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
