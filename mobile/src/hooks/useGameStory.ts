// The room's game story — what everyone shot, back to back.
//
// A story is not a new thing to store. The photos and clips are already in the
// thread, already uploaded, already served; this only decides which of them
// belong to today's game and whether there are enough to be worth watching.
// Nothing is rendered, here or on a server: the player shows them in order,
// which is what "stitched" means to the person watching.
//
// THE THRESHOLD IS THE POINT. One person's three selfies is not a story, it
// is a demonstration that nobody else was there — and showing that to somebody
// who just sat through a game alone is worse than showing nothing. So the
// story does not exist below MIN_ITEMS pieces from MIN_PEOPLE people, and the
// entry point is absent rather than empty.

import { useMemo } from "react";
import type { HuddleMessage } from "@/hooks/useHuddleMessages";
import { getGameState, type GameContext } from "@/hooks/useLiveGameContext";

/** Enough to be a story, and enough to prove somebody else was in the room. */
export const MIN_ITEMS = 5;
export const MIN_PEOPLE = 2;

/**
 * How long after kickoff a game is assumed over even if nobody said so.
 *
 * Doing double duty. It bounds which media belongs to this game rather than
 * next week's, and it is the fallback for a row that never flips to final —
 * which happens: useLiveGameContext carries a note about a Mets room stuck on
 * "Padres 1 — Mets 4, 9 · 0:00" because one row was never closed out. Without
 * this those rooms would never get a story at all.
 */
const ASSUME_OVER_MS = 6 * 60 * 60 * 1000;

/**
 * The pause between the final whistle and the story offering itself.
 *
 * The last shot of a game is taken after it ends — the celebration, the walk
 * out, the face of whoever lost the bet — so opening the story the instant
 * the scoreboard settles cuts off the part people most want in it. Measured
 * from games.went_final_at, stamped by a trigger on the transition.
 *
 * A game with no stamp — one that ended before the column existed, or that
 * came from the live_events or ESPN fallbacks — shows as soon as it reads
 * final, which is what happened before there was a clock to read.
 */
const AFTER_FULL_TIME_MS = 15 * 60 * 1000;

/** A still holds this long; a clip plays, but never for longer than this. */
export const PHOTO_MS = 4500;
export const MAX_CLIP_MS = 8000;

export type StoryItem = {
  id: string;
  url: string;
  isVideo: boolean;
  /** What the scoreboard said when it was taken, when the capture burned it in. */
  caption: string | null;
  authorName: string;
  authorId: string;
  avatarUrl: string | null;
  takenAt: string;
};

export type GameStory = {
  items: StoryItem[];
  people: number;
  /** False when there is nothing worth opening — hide the entry point. */
  ready: boolean;
  /** Stable per game, so "dismissed" means this game and not forever. */
  key: string | null;
};

/**
 * The window a game's story covers.
 *
 * From kickoff to six hours after it, which covers a long game plus the hour
 * afterwards when the good ones actually get posted. A room with no game has
 * no game story — it is a room, not an occasion.
 */
function windowFor(game: GameContext | null | undefined): [number, number] | null {
  if (!game?.startTime) return null;
  const start = Date.parse(game.startTime);
  if (!Number.isFinite(start)) return null;
  return [start, start + ASSUME_OVER_MS];
}

export function useGameStory(
  messages: HuddleMessage[] | undefined,
  game: GameContext | null | undefined,
  /**
   * App admins see the story at any size.
   *
   * The threshold is right for everyone else and wrong for the one person who
   * has to check the thing works: a feature that hides itself below five
   * pieces from two people cannot be tested on a TestFlight build by someone
   * sitting on their own. This is the only way in without shipping a debug
   * menu or editing the constant before every build.
   */
  ignoreThreshold = false,
): GameStory {
  return useMemo(() => {
    const empty: GameStory = { items: [], people: 0, ready: false, key: null };
    const win = windowFor(game);
    if (!win || !messages?.length) return empty;
    const [from, to] = win;

    const items: StoryItem[] = [];
    for (const m of messages) {
      // The bot's cards and clips are the game, not the room. A story is what
      // the people in it made.
      if (m.isBotMessage || m.isTeamAgent) continue;
      if (!m.mediaUrl) continue;
      const kind = (m.mediaType || "").toLowerCase();
      if (kind !== "image" && kind !== "video") continue;
      const at = Date.parse(m.createdAt);
      if (!Number.isFinite(at) || at < from || at > to) continue;

      items.push({
        id: m.id,
        url: m.mediaUrl,
        isVideo: kind === "video",
        caption: (m.content || "").trim() || null,
        authorName: m.displayName || "Someone",
        authorId: m.userId,
        avatarUrl: m.avatarUrl,
        takenAt: m.createdAt,
      });
    }

    // The thread arrives newest-first; a story runs the way the game did.
    items.sort((a, b) => Date.parse(a.takenAt) - Date.parse(b.takenAt));

    const people = new Set(items.map((i) => i.authorId)).size;

    // A STORY IS THE RECAP, NOT A RUNNING TOTAL. Offering it in the third
    // quarter competes with the room it is made of, and asks people to look
    // back while the thing is still happening. So it waits for full time —
    // or for the game to be old enough that a stuck row is the likelier
    // explanation than a game still being played.
    const finalAt = game?.wentFinalAt ? Date.parse(game.wentFinalAt) : NaN;
    const over = Number.isFinite(finalAt)
      ? Date.now() >= finalAt + AFTER_FULL_TIME_MS
      : getGameState(game ?? null) === "postgame" || Date.now() > to;

    const enough = ignoreThreshold
      ? items.length > 0
      : items.length >= MIN_ITEMS && people >= MIN_PEOPLE;
    const ready = enough && (over || ignoreThreshold);

    return {
      items,
      people,
      ready,
      key: game?.id ? `story-${game.id}` : null,
    };
  }, [messages, game, ignoreThreshold]);
}
