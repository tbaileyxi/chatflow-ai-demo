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

export const TEST_LOGINS: TestLogin[] = [
  {
    userId: "00000000-0000-4000-8000-000000000101",
    phone: "+15555550101",
    displayPhone: "(555) 555-0101",
    email: "tester-101@sidehuddle.test",
    password: "SideHuddleTest!101",
    displayName: "Ty Bailey",
    username: "tybailey",
  },
  {
    userId: "00000000-0000-4000-8000-000000000102",
    phone: "+15555550102",
    displayPhone: "(555) 555-0102",
    email: "tester-102@sidehuddle.test",
    password: "SideHuddleTest!102",
    displayName: "Account Two",
    username: "accounttwo",
  },
  {
    userId: "00000000-0000-4000-8000-000000000103",
    phone: "+15555550103",
    displayPhone: "(555) 555-0103",
    email: "tester-103@sidehuddle.test",
    password: "SideHuddleTest!103",
    displayName: "Account Three",
    username: "accountthree",
  },
];

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
