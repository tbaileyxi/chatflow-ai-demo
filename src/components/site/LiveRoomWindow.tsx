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

      const { data: rows } = await supabase
        .from("huddle_messages")
        .select("id, content, created_at, is_bot_message, media_url, media_type")
        .eq("huddle_id", room.id)
        .order("created_at", { ascending: false })
        .limit(14);
      if (cancelled) return;
      setMsgs((rows ?? []).reverse() as Msg[]);
      setState((rows ?? []).length ? "ready" : "empty");

      const { data: g } = await supabase
        .from("games")
        .select("status, start_time, home_score, away_score, period, clock, home_team:home_team_id(name), away_team:away_team_id(name)")
        .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
        .order("start_time", { ascending: false })
        .limit(6);
      const live = (g ?? []).find((x: any) => x.status === "in_progress");
      const next = [...(g ?? [])].reverse().find((x: any) =>
        x.status === "scheduled" && Date.parse(x.start_time) > Date.now());
      const pick: any = live ?? next ?? (g ?? [])[0];
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
      {/* phone */}
      <div
        className="rounded-[38px] border-[10px] border-[#1b1b1f] bg-[#0b0b0f] shadow-2xl overflow-hidden"
        style={{ boxShadow: `0 30px 80px ${accent}22, 0 20px 50px rgba(0,0,0,.6)` }}
      >
        <div className="h-6 bg-[#0b0b0f] flex items-center justify-center">
          <div className="h-1.5 w-20 rounded-full bg-[#26262e]" />
        </div>

        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1c1c24]">
          <div
            className="h-7 w-7 rounded-lg grid place-items-center text-[10px] font-extrabold"
            style={{ background: accent, color: ink }}
          >
            {teamName.split(" ").map((w) => w[0]).join("").slice(0, 3)}
          </div>
          <div className="text-[13px] font-semibold truncate">{roomName ?? `${teamName} Community`}</div>
        </div>

        {game && (
          <div className="px-3 py-2 border-b border-[#1c1c24] bg-[#101016]">
            <div className="text-[12.5px] font-bold tracking-tight">
              {game.away} {game.awayScore ?? ""} &nbsp;—&nbsp; {game.home} {game.homeScore ?? ""}
            </div>
            <div className="text-[10.5px] text-[#8b8b95] flex items-center gap-1.5 mt-0.5">
              {game.live && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />}
              {game.live ? `${game.period ?? ""} ${game.clock ?? ""}` : kickoff}
            </div>
          </div>
        )}

        <div className="h-[370px] overflow-hidden px-3 py-3 flex flex-col justify-end gap-2">
          {state === "loading" && <div className="text-[12px] text-[#6c6c76]">Loading the room…</div>}
          {state === "empty" && (
            <div className="text-[12px] text-[#6c6c76]">
              This room is quiet right now. It wakes up on game day.
            </div>
          )}
          {msgs.map((m) => (
            <div key={m.id} className="flex gap-2 items-start">
              <div
                className="h-5 w-5 rounded-full grid place-items-center text-[7.5px] font-extrabold flex-none mt-0.5"
                style={
                  m.is_bot_message
                    ? { background: "#23232b", color: accent, border: `1.5px solid ${accent}` }
                    : { background: "#2b2b34", color: "#c9c9d2" }
                }
              >
                {m.is_bot_message ? "SH" : "•"}
              </div>
              <div className="rounded-xl bg-[#1b1b21] border border-[#26262e] px-2.5 py-1.5 text-[12px] leading-snug text-[#e9e9e6] max-w-[86%]">
                {(m.content ?? "").slice(0, 220)}
                {m.media_type === "video" && (
                  <div className="mt-1.5 rounded-md bg-[#101015] border border-[#26262e] h-16 grid place-items-center text-[10px] text-[#7b7b85]">
                    ▶ clip
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-center text-[11.5px] text-white/40">
        Live from the {teamName} room. Not a mockup.
      </p>
    </div>
  );
}
