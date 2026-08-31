import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * The room, on the open web, in a phone.
 *
 * Every link Side Huddle has ever put in front of a stranger has pointed at the
 * App Store — a page of screenshots asking for an install before showing
 * anything. This points at the product running: real messages from the real
 * room, the real score, updating while you watch.
 *
 * It costs nothing to serve. Room messages are already readable without a login
 * (that was a deliberate decision — browsing a room is the feature), so this
 * reads rows that already exist. No X API, no model calls, nothing per view.
 */

type Msg = {
  id: string;
  content: string | null;
  created_at: string;
  is_bot_message: boolean | null;
  media_url: string | null;
  media_type: string | null;
};

type GameLine = {
  home: string; away: string;
  homeScore: number | null; awayScore: number | null;
  period: string | null; clock: string | null; live: boolean;
  startTime: string;
};

export default function LiveRoomWindow({
  teamName, accent, ink,
}: { teamName: string; accent: string; ink: string }) {
  const [roomName, setRoomName] = useState<string | null>(null);
  const [members, setMembers] = useState<number | null>(null);
  const [jump, setJump] = useState<string[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [game, setGame] = useState<GameLine | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      // Match the team by name rather than by id: the page knows a display name
      // and nothing else, and this keeps the component usable on any team page.
      const { data: teams } = await supabase
        .from("teams").select("id, name, city").eq("status", "active").limit(500);
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const want = norm(teamName);
      const team = (teams ?? []).find((t: any) =>
        norm(`${t.city ?? ""}${t.name ?? ""}`) === want ||
        norm(`${t.city ?? ""}${t.name ?? ""}`).includes(want) ||
        want.includes(norm(`${t.city ?? ""}${t.name ?? ""}`)));
      if (!team || cancelled) { setState("empty"); return; }

      // The official room is the public one. A member's private side huddle is
      // not ours to put on a billboard.
      const { data: rooms } = await supabase
        .from("huddles")
        .select("id, name, is_private, is_official_team_huddle")
        .eq("team_id", team.id)
        .eq("is_private", false)
        .order("is_official_team_huddle", { ascending: false })
        .limit(1);
      const room = rooms?.[0];
      if (!room || cancelled) { setState("empty"); return; }
      setRoomName(room.name);
      const { count } = await supabase
        .from("huddle_members").select("id", { count: "exact", head: true }).eq("huddle_id", room.id);
      if (!cancelled) setMembers(count ?? 0);

      // The JUMP row is the point of the product — a person belongs to several
      // rooms, not one. Hardcoding this account's own rooms both lied and
      // implied rooms the visitor does not have.
      const { data: others } = await supabase
        .from("huddles").select("name").eq("is_private", false)
        .neq("id", room.id).limit(3);
      if (!cancelled) setJump((others ?? []).map((o: any) => o.name).filter(Boolean).slice(0, 3));

      const { data: rows } = await supabase
        .from("huddle_messages")
        .select("id, content, created_at, is_bot_message, media_url, media_type")
        .eq("huddle_id", room.id)
        .order("created_at", { ascending: false })
        .limit(14);
      if (cancelled) return;
      setMsgs((rows ?? []).reverse() as Msg[]);
      setState((rows ?? []).length ? "ready" : "empty");

      // Two queries, because "the next game" and "the last game" are opposite
      // sorts. Asking for the six latest fixtures and taking the first future
      // one out of them put a December game on the Browns page in August — the
      // whole season is in the table, so "latest" is January.
      const cols = "status, start_time, home_score, away_score, period, clock, home_team:home_team_id(name), away_team:away_team_id(name)";
      const mine = `home_team_id.eq.${team.id},away_team_id.eq.${team.id}`;

      const { data: liveRows } = await supabase
        .from("games").select(cols).or(mine)
        .eq("status", "in_progress").limit(1);
      const { data: nextRows } = await supabase
        .from("games").select(cols).or(mine)
        .eq("status", "scheduled")
        .gt("start_time", new Date().toISOString())
        .order("start_time", { ascending: true }).limit(1);
      const { data: lastRows } = await supabase
        .from("games").select(cols).or(mine)
        .eq("status", "final")
        .order("start_time", { ascending: false }).limit(1);

      const pick: any = liveRows?.[0] ?? nextRows?.[0] ?? lastRows?.[0];
      if (pick && !cancelled) {
        setGame({
          home: pick.home_team?.name ?? "Home",
          away: pick.away_team?.name ?? "Away",
          homeScore: pick.home_score, awayScore: pick.away_score,
          period: pick.period, clock: pick.clock,
          live: pick.status === "in_progress",
          startTime: pick.start_time,
        });
      }

      // Live, because a page that says "live" and does not move is worse than a
      // static screenshot — it tells the visitor the product is pretend.
      channel = supabase
        .channel(`public-room-${room.id}`)
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "huddle_messages", filter: `huddle_id=eq.${room.id}` },
          (payload) => setMsgs((m) => [...m.slice(-13), payload.new as Msg]))
        .subscribe();
    })();

    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, [teamName]);

  const kickoff = game && !game.live
    ? new Date(game.startTime).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <div className="mx-auto w-full max-w-[340px]">
      {/* The app's chrome, not a generic phone. Someone who installs after
          seeing this should recognise the screen they land on. */}
      <div
        className="rounded-[38px] border-[10px] border-[#1b1b1f] bg-[#0b0b0f] shadow-2xl overflow-hidden"
        style={{ boxShadow: `0 30px 80px ${accent}22, 0 20px 50px rgba(0,0,0,.6)` }}
      >
        <div className="h-5 bg-[#0b0b0f]" />

        {/* header */}
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <span className="text-white/40 text-lg leading-none">‹</span>
          <div
            className="h-8 w-8 rounded-full grid place-items-center text-[10px] font-extrabold flex-none"
            style={{ background: accent, color: ink }}
          >
            {teamName.split(" ").map((w) => w[0]).join("").slice(0, 3)}
          </div>
          <div className="text-[14px] font-bold truncate flex-1">{roomName ?? `${teamName} Community`}</div>
          {members ? <span className="text-[10px] text-white/45">👥 {members}</span> : null}
          <div
            className="h-7 w-7 rounded-full grid place-items-center text-[12px] font-bold flex-none"
            style={{ background: "#F5C518", color: "#12100A" }}
          >+</div>
        </div>

        {/* scoreboard */}
        {game && (
          <div
            className="px-3 py-2.5 text-center"
            style={{ background: `${accent}14`, borderTop: "1px solid #1c1c24", borderBottom: "1px solid #1c1c24" }}
          >
            <div className="text-[14px] font-bold tracking-tight">
              {game.live
                ? `${game.away} ${game.awayScore ?? 0} — ${game.home} ${game.homeScore ?? 0}`
                : `${game.away}  @  ${game.home}`}
            </div>
            <div className="text-[11px] text-white/45 mt-0.5 flex items-center justify-center gap-1.5">
              {game.live && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />}
              {game.live ? `${game.period ?? ""} · ${game.clock ?? ""}` : kickoff}
            </div>
          </div>
        )}

        {/* jump row */}
        <div className="flex items-center gap-1.5 px-3 py-2 overflow-hidden border-b border-[#161620]">
          <span className="text-[9.5px] tracking-widest text-white/35 font-semibold flex-none">JUMP</span>
          {jump.map((r) => (
            <span key={r} className="rounded-full bg-[#17171e] border border-[#25252f] px-2.5 py-1 text-[10.5px] text-white/60 flex-none">
              {r}
            </span>
          ))}
        </div>

        {/* action row */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#161620]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10.5px] text-white/50">{members || ""}</span>
          <div className="ml-auto flex gap-1.5">
            <span className="rounded-full border border-[#2b2b35] px-2.5 py-1 text-[10.5px] text-white/70">⚔ Fade</span>
            <span className="rounded-full px-2.5 py-1 text-[10.5px] font-semibold" style={{ background: "#14351f", color: "#4ADE80" }}>
              📣 Rally the huddle
            </span>
          </div>
        </div>

        {/* thread, on the room background */}
        <div
          className="h-[330px] overflow-hidden px-3 py-3 flex flex-col justify-end gap-2"
          style={{
            backgroundColor: `${accent}0d`,
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='118' height='118'%3E%3Ctext x='59' y='68' font-family='Arial Black, sans-serif' font-size='30' font-weight='900' fill='%23ffffff' fill-opacity='0.045' text-anchor='middle'%3ESH%3C/text%3E%3C/svg%3E\")",
          }}
        >
          {state === "loading" && <div className="text-[12px] text-white/35">Loading the room…</div>}
          {state === "empty" && (
            <div className="text-[12px] text-white/35">This room wakes up on game day.</div>
          )}
          {msgs.map((m) => (
            <div key={m.id} className="flex gap-2 items-start">
              <div
                className="h-6 w-6 rounded-full grid place-items-center text-[7.5px] font-extrabold flex-none mt-0.5"
                style={
                  m.is_bot_message
                    ? { background: "#1b1b21", color: "#F5C518", border: "1.5px solid #F5C518" }
                    : { background: "#2b2b34", color: "#c9c9d2" }
                }
              >
                {m.is_bot_message ? "SH" : "•"}
              </div>
              <div
                className="rounded-xl bg-[#1b1b21]/95 px-2.5 py-1.5 text-[12px] leading-snug text-[#e9e9e6] max-w-[86%]"
                style={m.is_bot_message ? { borderLeft: "3px solid #F5C518" } : { border: "1px solid #2a2a33" }}
              >
                {(m.content ?? "").slice(0, 200)}
                {m.media_type === "video" && (
                  <div className="mt-1.5 rounded-md bg-[#101015] border border-[#26262e] h-14 grid place-items-center text-[10px] text-white/35">
                    ▶ clip
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* composer */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-[#161620]">
          <span className="text-white/30 text-[13px]">📷</span>
          <span className="text-white/30 text-[13px]">🖼</span>
          <div className="flex-1 rounded-full border border-[#F5C518]/45 px-3 py-1.5 text-[11.5px] text-white/30">Message…</div>
          <div className="h-7 w-7 rounded-full grid place-items-center text-[11px]" style={{ background: "#8a6f16" }}>➤</div>
        </div>
      </div>

      {/* THE PAGE USED TO IMPLY ONE BIG ROOM.
          It showed the community room and nothing else, so a visitor concluded
          Side Huddle was a single crowded chat — which is both less appealing
          than the truth and not what they find after installing. The product is
          the room you start with five friends; this one is the front door. */}
      <p className="mt-3 text-center text-[11.5px] text-white/45">
        Live from the {teamName} room. Not a mockup.
      </p>
      <p className="mt-1.5 text-center text-[12.5px] text-white/60 leading-snug max-w-[300px] mx-auto">
        Anyone can walk into this one. The one that matters is the
        {" "}<span className="text-white/85 font-semibold">one you start with your crew</span> —
        same live game, just your people.
      </p>
    </div>
  );
}
