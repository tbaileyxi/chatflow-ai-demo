import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Side Huddle Sports",
  slug: "side-huddle-sports",
  scheme: "sidehuddle",
  version: "1.0.0",
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
    supportsTablet: true,
    bundleIdentifier: "com.sidehuddle.sports",
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
  },
});
