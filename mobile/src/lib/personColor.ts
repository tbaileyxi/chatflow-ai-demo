/**
 * A colour per person, stable forever.
 *
 * Everyone's name rendering in the same gold makes a thread read as one voice.
 * In a group of five arguing about a game, telling who is talking at a glance
 * IS the interface — the design gives each person a colour and carries it on
 * their avatar ring and their name, so you track a conversation by colour
 * before you read a word of it.
 *
 * Derived from the user id, not assigned in join order: the same person has to
 * be the same colour in every room, on every device, forever. A counter would
 * give someone a different colour depending on who else was in the room.
 *
 * All six read against the dark ground and against each other. Gold is
 * deliberately NOT in here — that is the app's own accent and belongs to you,
 * applied separately so your messages always stand apart from everybody else's.
 */
const PALETTE = [
  "#4ADE80", // green
  "#60A5FA", // blue
  "#C084FC", // purple
  "#FB7185", // rose
  "#2DD4BF", // teal
  "#FB923C", // orange
] as const;

/** Your own colour. The accent, so your line is never one of the crowd. */
export const OWN_COLOR = "#F5C518";

export function personColor(userId: string | null | undefined, isOwn = false): string {
  if (isOwn) return OWN_COLOR;
  if (!userId) return PALETTE[0];

  // djb2. Cheap, and spreads adjacent ids across the palette rather than
  // clustering them the way a sum of char codes would.
  let hash = 5381;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) + hash + userId.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
