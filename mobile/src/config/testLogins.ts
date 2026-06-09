export const TEST_LOGIN_CODE = "123456";

export type TestLogin = {
  userId: string;
  phone: string;
  displayPhone: string;
  email: string;
  password: string;
  displayName: string;
  username: string;
};

// Dev-test phone shortcuts retired. All sign-ins now go through Supabase
// email OTP. Keeping the array empty preserves any imports without breaking
// the build; getTestLogin() always returns undefined.
export const TEST_LOGINS: TestLogin[] = [];

export function formatPhoneForAuth(countryCode: string, phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const countryDigits = countryCode.replace(/\D/g, "");
  const localDigits =
    digits.length > 10 && digits.startsWith(countryDigits)
      ? digits.slice(countryDigits.length)
      : digits;
  return `${countryCode}${localDigits}`;
}

export function getTestLogin(phone: string): TestLogin | undefined {
  const normalized = phone.replace(/\D/g, "");
  return TEST_LOGINS.find(
    (login) =>
      login.phone.replace(/\D/g, "") === normalized ||
      normalized.endsWith(login.phone.replace(/\D/g, "").slice(-10)),
  );
}

export function getTestLoginHint(): string {
  return `${TEST_LOGINS.map((login) => login.displayPhone).join(", ")} / code ${TEST_LOGIN_CODE}`;
}
