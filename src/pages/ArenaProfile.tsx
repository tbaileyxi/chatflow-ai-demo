// /arena/p/:clientId — a prophet's public profile: avatar, full record,
// open positions, bet history, follow button. All data is already public
// (stakes/players have public SELECT); this page just assembles it.
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AVATARS = ["🦅", "🐺", "🦈", "👑", "⚡", "🔥", "🎯", "🧙", "🤖", "🦍", "💀", "🐐"];

interface PlayerRow { client_id: string; handle: string; avatar: string; bankroll: number; streak_days: number; created_at: string }
interface StakeRow { game_id: string | null; event_id: string | null; side: "away" | "home"; amount: number; payout: number | null; settled: boolean; created_at: string }
interface BetLine { label: string; sideLabel: string; amount: number; outcome: string; net: number | null; when: string }

function myId(): string {
  return localStorage.getItem("arena_client_id") ?? "";
}

export default function ArenaProfile() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [player, setPlayer] = useState<PlayerRow | null>(null);
  const [bets, setBets] = useState<BetLine[]>([]);
  const [stats, setStats] = useState<{ w: number; l: number; net: number; staked: number; biggest: number } | null>(null);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(false);
  const [missing, setMissing] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const isMe = clientId === myId();

  const load = useCallback(async () => {
    if (!clientId) return;
    const { data: p } = await supabase.from("arena_players" as never)
      .select("*")
      .eq("client_id", clientId).maybeSingle();
    if (!p) { setMissing(true); return; }
    setPlayer(p as unknown as PlayerRow);

    const { count } = await supabase.from("arena_follows" as never)
      .select("*", { count: "exact", head: true }).eq("followed", clientId);
    setFollowers(count ?? 0);
    if (!isMe && myId()) {
      const { data: f } = await supabase.from("arena_follows" as never)
        .select("follower").eq("followed", clientId).eq("follower", myId()).maybeSingle();
      setFollowing(!!f);
    }

    const { data: stakes } = await supabase.from("arena_stakes" as never)
      .select("game_id, event_id, side, amount, payout, settled, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }).limit(60);
    const rows = (stakes ?? []) as unknown as StakeRow[];

    let w = 0, l = 0, net = 0, staked = 0, biggest = 0;
    for (const s of rows) {
      staked += s.amount;
      if (s.settled && s.payout != null) {
        net += s.payout - s.amount;
        if (s.payout > s.amount) { w++; biggest = Math.max(biggest, s.payout - s.amount); }
        else if (s.payout === 0) l++;
      }
    }
    setStats({ w, l, net, staked, biggest });

    const gameIds = [...new Set(rows.map((r) => r.game_id).filter(Boolean))] as string[];
    const eventIds = [...new Set(rows.map((r) => r.event_id).filter(Boolean))] as string[];
    const labels = new Map<string, { title: string; a: string; b: string }>();
    if (gameIds.length) {
      const { data: gs } = await supabase.from("games")
        .select("id, home:teams!games_home_team_id_fkey(name), away:teams!games_away_team_id_fkey(name)")
        .in("id", gameIds);
      for (const g of (gs ?? []) as unknown as { id: string; home: { name: string } | null; away: { name: string } | null }[]) {
        const a = (g.away?.name ?? "?").toUpperCase(), b = (g.home?.name ?? "?").toUpperCase();
        labels.set(g.id, { title: `${a} vs ${b}`, a, b });
      }
    }
    if (eventIds.length) {
      const { data: es } = await supabase.from("arena_events" as never)
        .select("id, title, side_a_label, side_b_label").in("id", eventIds);
      for (const e of (es ?? []) as unknown as { id: string; title: string; side_a_label: string; side_b_label: string }[]) {
        labels.set(e.id, { title: e.title.slice(0, 46), a: e.side_a_label.toUpperCase(), b: e.side_b_label.toUpperCase() });
      }
    }
    setBets(rows.slice(0, 25).map((s) => {
      const lb = labels.get((s.game_id ?? s.event_id)!) ?? { title: "—", a: "A", b: "B" };
      let outcome = "OPEN", betNet: number | null = null;
      if (s.settled && s.payout != null) {
        betNet = s.payout - s.amount;
        outcome = s.payout > s.amount ? "WON" : s.payout === 0 ? "LOST" : "REFUND";
      }
      return {
        label: lb.title, sideLabel: s.side === "home" ? lb.b : lb.a,
        amount: s.amount, outcome, net: betNet,
        when: new Date(s.created_at).toLocaleDateString([], { month: "numeric", day: "numeric" }),
      };
    }));
  }, [clientId, isMe]);

  useEffect(() => { load(); }, [load]);

  const toggleFollow = async () => {
    const { data, error } = await (supabase.rpc as CallableFunction)("arena_toggle_follow", {
      p_client: myId(), p_target: clientId,
    });
    if (error) return;
    const r = data as { following: boolean; followers: number };
    setFollowing(r.following); setFollowers(r.followers);
  };

  const setAvatar = async (a: string) => {
    await (supabase.rpc as CallableFunction)("arena_set_avatar", { p_client: myId(), p_avatar: a });
    setPlayer((p) => (p ? { ...p, avatar: a } : p));
  };

  const saveName = async () => {
    const name = nameDraft.trim().slice(0, 20);
    if (name.length < 2) return;
    // the claim RPC updates the handle without granting chips when already claimed
    const d = new Date();
    const localDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const { error } = await (supabase.rpc as CallableFunction)("arena_claim_daily", {
      p_client: myId(), p_handle: name, p_day: localDay,
    });
    if (error) return;
    localStorage.setItem("arena_handle", name);
    setPlayer((p) => (p ? { ...p, handle: name } : p));
    setEditingName(false);
  };

  const outcomeColor: Record<string, string> = {
    OPEN: "#ffd24d", WON: "#4dff88", LOST: "#ff5a5a", REFUND: "#5a6b85",
  };
  const winRate = stats && stats.w + stats.l > 0 ? Math.round((stats.w / (stats.w + stats.l)) * 100) : null;
  const roi = stats && stats.staked > 0 ? Math.round((stats.net / stats.staked) * 100) : null;

  return (
    <div className="min-h-screen w-full" style={{ background: "#05060a", fontFamily: "'JetBrains Mono','SF Mono',ui-monospace,monospace", color: "#c8d2e8" }}>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between text-xs tracking-widest" style={{ color: "#5a6b85" }}>
          <button onClick={() => navigate("/arena")}
            className="px-2 py-1 rounded text-[11px] tracking-widest"
            style={{ background: "transparent", border: "1px solid #38445c", color: "#8fa2c4" }}>
            ◂ THE DOME
          </button>
          <span>PROPHETDOME · PROPHET</span>
        </div>

        {missing && (
          <div className="mt-10 text-center text-sm" style={{ color: "#5a6b85" }}>PROPHET NOT FOUND</div>
        )}

        {player && (
          <>
            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center justify-center rounded-full text-4xl"
                style={{ width: 76, height: 76, background: "#11162a", border: "2px solid #3a4a78" }}>
                {player.avatar || player.handle.replace(/^FAN-/, "").slice(0, 2)}
              </div>
              <div className="min-w-0">
                {editingName && isMe ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={nameDraft} autoFocus maxLength={20}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveName()}
                      className="px-2 py-1 rounded text-xl font-bold"
                      style={{ background: "#0b0e18", border: "1px solid #4dff88", color: "#f2f6ff", width: 220, outline: "none" }}
                    />
                    <button onClick={saveName} className="px-2 py-1 rounded text-[11px] tracking-widest"
                      style={{ background: "transparent", border: "1px solid #4dff88", color: "#4dff88" }}>
                      SAVE
                    </button>
                  </div>
                ) : (
                  <div className="text-2xl font-bold" style={{ color: "#f2f6ff" }}>
                    {player.handle || `FAN-${player.client_id.slice(0, 4).toUpperCase()}`}
                    {isMe && (
                      <button
                        onClick={() => { setNameDraft(player.handle); setEditingName(true); }}
                        className="ml-2 px-1.5 py-0.5 rounded text-[10px] tracking-widest align-middle"
                        style={{ background: "transparent", border: "1px solid #38445c", color: "#8fa2c4" }}>
                        EDIT ✎
                      </button>
                    )}
                  </div>
                )}
                <div className="text-xs" style={{ color: "#5a6b85" }}>
                  {followers} FOLLOWER{followers === 1 ? "" : "S"}
                  {player.streak_days > 1 && <span style={{ color: "#ff8c1a" }}> · ▲ DAY {player.streak_days}</span>}
                  {" · SINCE "}{new Date(player.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                </div>
              </div>
              {!isMe && (
                <button onClick={toggleFollow}
                  className="ml-auto px-4 py-2 rounded font-bold tracking-widest text-xs"
                  style={{
                    background: following ? "#11162a" : "#4dff8822",
                    border: `1px solid ${following ? "#38445c" : "#4dff88"}`,
                    color: following ? "#8fa2c4" : "#4dff88",
                  }}>
                  {following ? "FOLLOWING ✓" : "FOLLOW"}
                </button>
              )}
            </div>

            {isMe && (
              <div className="mt-4 flex items-center gap-1 flex-wrap">
                <span className="text-[10px] tracking-widest mr-2" style={{ color: "#5a6b85" }}>YOUR BATTLE AVATAR</span>
                {AVATARS.map((a) => (
                  <button key={a} onClick={() => setAvatar(a)}
                    className="rounded text-xl px-1.5 py-0.5"
                    style={{ background: player.avatar === a ? "#3a3010" : "transparent", border: `1px solid ${player.avatar === a ? "#ffd24d" : "#1a2236"}` }}>
                    {a}
                  </button>
                ))}
              </div>
            )}

            {stats && (
              <div className="mt-6 grid gap-3" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
                {[
                  { k: "RECORD", v: `${stats.w}W·${stats.l}L`, c: "#e8eefc" },
                  { k: "WIN RATE", v: winRate != null ? `${winRate}%` : "—", c: "#e8eefc" },
                  { k: "NET CHIPS", v: `${stats.net >= 0 ? "+" : ""}${stats.net.toLocaleString()}`, c: stats.net >= 0 ? "#4dff88" : "#ff5a5a" },
                  { k: "ROI", v: roi != null ? `${roi >= 0 ? "+" : ""}${roi}%` : "—", c: (roi ?? 0) >= 0 ? "#4dff88" : "#ff5a5a" },
                  { k: "BEST WIN", v: stats.biggest > 0 ? `+${stats.biggest.toLocaleString()}` : "—", c: "#ffd24d" },
                ].map((s) => (
                  <div key={s.k} className="rounded-lg p-3 text-center" style={{ border: "1px solid #1a2236", background: "#080a12" }}>
                    <div className="text-[9px] tracking-widest" style={{ color: "#5a6b85" }}>{s.k}</div>
                    <div className="text-lg font-bold mt-1" style={{ color: s.c, fontVariantNumeric: "tabular-nums" }}>{s.v}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 rounded-lg p-4" style={{ border: "1px solid #1a2236", background: "#080a12" }}>
              <div className="text-xs tracking-widest mb-3" style={{ color: "#66b3ff" }}>BET HISTORY</div>
              {bets.length === 0 && <div className="text-xs" style={{ color: "#38445c" }}>NO BETS YET</div>}
              {bets.map((bt, i) => (
                <div key={i} className="py-1.5 text-xs flex items-center justify-between gap-3" style={{ borderBottom: i < bets.length - 1 ? "1px solid #10141f" : "none" }}>
                  <span className="min-w-0">
                    <span className="font-bold" style={{ color: "#c8d2e8" }}>{bt.sideLabel} · {bt.amount}</span>
                    <span className="block truncate" style={{ color: "#5a6b85" }}>{bt.label}</span>
                  </span>
                  <span className="shrink-0 text-right font-bold" style={{ color: outcomeColor[bt.outcome], fontVariantNumeric: "tabular-nums" }}>
                    {bt.outcome}
                    {bt.net != null && bt.outcome !== "REFUND" && ` ${bt.net >= 0 ? "+" : ""}${bt.net.toLocaleString()}`}
                    <span className="block font-normal" style={{ color: "#38445c" }}>{bt.when}</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
