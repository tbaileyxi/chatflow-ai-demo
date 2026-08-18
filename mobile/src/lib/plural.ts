/**
 * "1 people" was on the first screen of the app, under every room with a
 * single member — which is most of them right now. Small, but it is the first
 * text a new user reads and it undercuts everything around it.
 *
 * Three screens each rendered their own count string and two got it wrong.
 * This is the one place that decides.
 */
export function pluralize(n: number, one: string, many?: string): string {
  return `${n} ${n === 1 ? one : many ?? `${one}s`}`;
}
