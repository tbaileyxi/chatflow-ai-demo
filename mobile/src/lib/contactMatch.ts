// Contact matching — normalise + hash, on this device only.
//
// The rule that matters: the hash the client computes has to be byte-identical
// to the one Postgres computes, or nothing ever matches. Server side is
//   phone: encode(digest(phone_number, 'sha256'), 'hex')   -- phone_number is E.164
//   email: encode(digest(lower(btrim(email)), 'sha256'), 'hex')
// so these two functions have to produce exactly that. Change one, change both.

import * as Crypto from "expo-crypto";

// Matches normalizePhone in OnboardingScreen — the number we STORE and the
// number we HASH have to agree or a user can never be found by their own number.
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function normalizeEmail(raw: string): string | null {
  const clean = raw.trim().toLowerCase();
  return clean.includes("@") ? clean : null;
}

export async function sha256Hex(value: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

// Turn a device address book into the hash list we send, PLUS a local map from
// each hash back to the name the user has that person saved under.
//
// The map never leaves the device. It exists so a match can be shown as
// "Mike Burns" — the name in your phone — instead of that person's Side Huddle
// display name, which might be "burnsyny2000" and mean nothing to you.
export async function hashContacts(
  entries: { name?: string | null; phones: string[]; emails: string[] }[],
): Promise<{ hashes: string[]; nameByHash: Map<string, string> }> {
  // value -> contact name. First writer wins: if two contacts somehow carry the
  // same number, the earlier one is as good a guess as any.
  const owner = new Map<string, string>();

  for (const entry of entries) {
    const name = (entry.name ?? "").trim();
    for (const phone of entry.phones) {
      const e164 = normalizePhone(phone);
      if (e164 && !owner.has(e164)) owner.set(e164, name);
    }
    for (const email of entry.emails) {
      const clean = normalizeEmail(email);
      if (clean && !owner.has(clean)) owner.set(clean, name);
    }
  }

  const values = [...owner.keys()];
  const hashes = await Promise.all(values.map(sha256Hex));

  const nameByHash = new Map<string, string>();
  hashes.forEach((h, i) => {
    const name = owner.get(values[i]);
    if (name) nameByHash.set(h, name);
  });

  return { hashes, nameByHash };
}
