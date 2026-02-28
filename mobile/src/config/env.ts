import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

export const env = {
  adminPhoneNumber: (extra.adminPhoneNumber as string) ?? "",
  bypassPhoneNumber: (extra.bypassPhoneNumber as string) ?? "5555555555",
} as const;
