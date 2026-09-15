/**
 * Put the demo cast in the room, for real.
 *
 * The green "watching now" ring is not a database column — it comes from a
 * Supabase Realtime presence channel, which only knows who is actually
 * connected. So rather than mock it in the UI for a screenshot (which would
 * make the screenshot a drawing of the app rather than the app), this opens
 * the same channel the app opens and tracks the demo accounts on it.
 *
 * While this is running they are genuinely present, and the app is genuinely
 * showing presence. Stop it and they disappear, exactly as a real person
 * closing the app would.
 *
 *   node tools/demo-presence.mjs            # everyone in the lobby
 *   node tools/demo-presence.mjs <huddleId> "Sunday Section"
 */
import { createClient } from "@supabase/supabase-js";

const URL = "https://dejuwyeypiggvlyfliap.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY;
if (!ANON) {
  console.error("set SUPABASE_ANON_KEY");
  process.exit(1);
}

const huddleId = process.argv[2] ?? null;
const huddleName = process.argv[3] ?? null;

// Matches RUN_THIS_DEMO_SEED.sql.
const CAST = [
  { id: "11111111-0000-4000-8000-000000000001", name: "Marcus Ellery" },
  { id: "11111111-0000-4000-8000-000000000002", name: "Dana Whitfield" },
  { id: "11111111-0000-4000-8000-000000000003", name: "Theo Barnes" },
  { id: "11111111-0000-4000-8000-000000000004", name: "Gus" },
];

const channels = [];
for (const person of CAST) {
  // One client per person: the presence key is set per channel at construction
  // and a single connection can only hold one identity on a channel.
  const client = createClient(URL, ANON, {
    realtime: { params: { eventsPerSecond: 2 } },
  });
  const ch = client.channel("presence:lobby", {
    config: { presence: { key: person.id } },
  });

  await new Promise((resolve) => {
    ch.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      await ch.track({
        userId: person.id,
        displayName: person.name,
        avatarUrl: null,
        huddleId,
        huddleName,
      });
      console.log(`  ${person.name} is present${huddleName ? ` in ${huddleName}` : ""}`);
      resolve();
    });
  });
  channels.push(ch);

  // The lobby is what Home reads ("Marcus · Sunday Section"). Inside the room,
  // the member row's ring reads a separate per-room channel — see
  // useHuddlePresence — so the lobby alone leaves everyone grey in there.
  if (huddleId) {
    const room = client.channel(`presence-${huddleId}`, {
      config: { presence: { key: person.id } },
    });
    await new Promise((resolve) => {
      room.subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        await room.track({ userId: person.id, displayName: person.name, avatarUrl: null });
        resolve();
      });
    });
    channels.push(room);
  }
}

console.log("\nHolding presence. Ctrl-C to clear them.\n");
process.on("SIGINT", async () => {
  for (const ch of channels) await ch.untrack().catch(() => {});
  process.exit(0);
});
setInterval(() => {}, 1 << 30);
