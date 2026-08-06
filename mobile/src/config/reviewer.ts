// App Store review sign-in bypass.
//
// The app signs users in with an email OTP, but Apple's reviewer can't receive
// a code at the reviewer address. So for this ONE hard-coded address we skip
// the email step and sign in with a pre-provisioned password account (seeded
// in Supabase by the `seed-reviewer` edge function).
//
// Flow: on the sign-in screen we detect the reviewer email and go straight to
// the code screen without sending a real email; on the code screen the fixed
// code below triggers a password sign-in instead of verifyOtp.
//
// Scope is deliberately narrow — a single email + a single code. No other
// account is affected, and the reviewer account is an ordinary, low-privilege
// user. Once the app is approved this can be removed (with the seeded user).

export const REVIEWER_EMAIL = "appreview@sidehuddlesports.com";
export const REVIEWER_CODE = "123456";
// Baked-in on purpose: the client needs it to complete the password sign-in.
// It only unlocks the throwaway reviewer account.
export const REVIEWER_PASSWORD = "ShReview!2026$Qx7";

export function isReviewerEmail(email: string): boolean {
  return email.trim().toLowerCase() === REVIEWER_EMAIL;
}
