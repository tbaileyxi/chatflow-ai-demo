import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra ?? {};

export const env = {
  adminPhoneNumber: (extra.adminPhoneNumber as string) ?? "",
} as const;
