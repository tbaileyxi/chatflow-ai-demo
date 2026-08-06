// /arena — live battle arena, standalone web (not part of the mobile app).
// A "battle" is any two-sided contest with real stakes:
//   • kind 'game'  — MLB rows from the games table (legacy path, still live)
//   • kind 'event' — arena_events rows (World Cup matches, prop cards, later
//     politics/culture), synced by arena-sync-events
// Parimutuel pots on arena_stakes (game_id XOR event_id), server bankrolls,
// daily claim streaks, house pot seeding, cron settlement. Every particle is a
// real stake or a real game/market event — no fake crowd outside SIM mode.
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const POLL_MS = 15000;
const LEADERBOARD_MS = 30000;
const THROW_SIZE = 100;
const START_BANKROLL = 1000;
const ODDS_FRESH_MS = 10 * 60 * 1000;
const HOUSE_ID = "00000000-0000-0000-0000-0000000000aa";

const MLB_COLORS: Record<string, string> = {
  Yankees: "#7c8fd1", "Red Sox": "#ff4d4d", Mets: "#ff7f2a", Phillies: "#ff5a5a",
  Braves: "#ff5e4d", Orioles: "#ff8c1a", "Blue Jays": "#4d94ff", Rays: "#66b3ff",
  Guardians: "#ff6666", "White Sox": "#c0c0c0", Tigers: "#ff9933", Twins: "#66a3ff",
  Royals: "#66b2ff", Astros: "#ff9540", Rangers: "#5c8aff", Athletics: "#4dcc74",
  Mariners: "#33cccc", Angels: "#ff6058", Dodgers: "#5da0ff", Giants: "#ff8830",
  Padres: "#e0b060", Rockies: "#b088e8", Diamondbacks: "#ff6e6e", Cubs: "#5a8cff",
  Cardinals: "#ff5c5c", Brewers: "#ffd24d", Pirates: "#ffd633", Reds: "#ff4d4d",
  Nationals: "#ff6161", Marlins: "#4dd2ff",
};
const COUNTRY_COLORS: Record<string, string> = {
  USA: "#66a3ff", BELGIUM: "#ff4d4d", PORTUGAL: "#4dcc74", SPAIN: "#ffd24d",
  ARGENTINA: "#7cc4f0", EGYPT: "#ff6666", SWITZERLAND: "#ff5a5a", COLOMBIA: "#ffd24d",
  FRANCE: "#5c8aff", MOROCCO: "#e05252", NORWAY: "#ff6666", ENGLAND: "#f2f6ff",
  BRAZIL: "#ffe14d", GERMANY: "#c0c0c0", MEXICO: "#4dcc74", JAPAN: "#ff6e8a",
  NETHERLANDS: "#ff8c1a", ITALY: "#4dcc74", CANADA: "#ff5a5a", URUGUAY: "#66b3ff",
  CROATIA: "#ff6e6e", KOREA: "#ff6e8a",
};
function sideColor(label: string | undefined, mlbTeam: string | undefined, fallback: string): string {
  if (mlbTeam && MLB_COLORS[mlbTeam]) return MLB_COLORS[mlbTeam];
  const key = (label ?? "").toUpperCase();
  if (COUNTRY_COLORS[key]) return COUNTRY_COLORS[key];
  if (key.startsWith("OVER") || key === "YES") return "#4dcc74";
  if (key.startsWith("UNDER") || key === "NO") return "#ff6e6e";
  return fallback;
}
function colorDist(a: string, b: string): number {
  const n = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  return Math.abs(n(a, 1) - n(b, 1)) + Math.abs(n(a, 3) - n(b, 3)) + Math.abs(n(a, 5) - n(b, 5));
}

function clientId(): string {
  let id = localStorage.getItem("arena_client_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("arena_client_id", id);
  }
  return id;
}
function defaultHandle(id: string): string {
  return localStorage.getItem("arena_handle") || `FAN-${id.slice(0, 4).toUpperCase()}`;
}
function todayStr(): string {
  const d = new Date(); // LOCAL calendar day — streaks follow the user's day
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Side = "away" | "home";
interface Totals { away: number; home: number }
interface Player { handle: string; avatar?: string; bankroll: number; streak_days: number; last_claim_date: string | null }
interface BoardRow { cid: string; handle: string; avatar?: string; value: number; streak?: number; mine: boolean; record?: string }
interface BackerRow { handle: string; away: number; home: number; mine: boolean; house: boolean }
interface MyBet { label: string; sideLabel: string; amount: number; payout: number | null; outcome: "OPEN" | "WON" | "LOST" | "REFUND"; hex: string }
interface TapeRow { t: string; handle: string; side: Side; amount: number; house: boolean }

interface Battle {
  kind: "game" | "event";
  id: string;
  category: string;           // MLB | WORLD CUP | PROP | MARKET
  title: string;
  aLabel: string; bLabel: string;
  aTeam?: string; bTeam?: string; // MLB nicknames for color lookup
  status: string;
  winner: "a" | "b" | "tie" | null;
  scoreA: number; scoreB: number;
  periodLabel: string | null;
  startsAt: string;
  probA: number | null;       // P(side A) when the sync provides it
  pmCondition?: string;       // Polymarket condition id -> live trade flow
  pmAOutcome?: string;        // which Polymarket outcome label is side A
}

function battleColors(b: Battle | null): { a: string; h: string } {
  const hHex = sideColor(b?.bLabel, b?.bTeam, "#ff5a5a");
  let aHex = sideColor(b?.aLabel, b?.aTeam, "#5da0ff");
  if (colorDist(aHex, hHex) < 150) {
    aHex = colorDist("#66b3ff", hHex) >= 150 ? "#66b3ff" : "#ffd24d";
  }
  return { a: aHex, h: hHex };
}

function isFinal(status: string | undefined): boolean {
  return status === "final" || status === "completed";
}
function isLive(status: string | undefined): boolean {
  return status === "live" || status === "in_progress";
}

// score-based fallback for MLB when live odds are stale
function mlbHeuristic(b: Battle): number {
  const diff = b.scoreB - b.scoreA;
  const inning = parseInt(b.periodLabel?.replace(/\D/g, "") || "1", 10) || 1;
  if (isFinal(b.status)) return b.scoreB > b.scoreA ? 0.98 : b.scoreB < b.scoreA ? 0.02 : 0.5;
  if (b.status === "scheduled") return 0.535;
  const remaining = Math.max(0.5, 9 - inning + 0.5);
  return Math.min(0.97, Math.max(0.03, 0.5 + 0.5 * Math.tanh((diff * 0.38) / Math.sqrt(remaining)) + 0.02));
}
// P(side B) — the front line position
function battleProbB(b: Battle, liveOddsHomeProb: number | null): number {
  if (b.kind === "game") return liveOddsHomeProb ?? mlbHeuristic(b);
  if (b.probA != null) return 1 - b.probA;
  if (isFinal(b.status)) return b.winner === "b" ? 0.97 : b.winner === "a" ? 0.03 : 0.5;
  return 0.5;
}

interface Particle { side: Side; x: number; y: number; v: number; r: number; hue: string; trail: boolean; glyph?: string }
interface FlashMsg { text: string; until: number; color: string }

function makeSimBattle(): Battle {
  return {
    kind: "game", id: "sim", category: "SIM", title: "YANKEES vs RED SOX", aLabel: "YANKEES", bLabel: "RED SOX",
    aTeam: "Yankees", bTeam: "Red Sox", status: "live", winner: null,
    scoreA: 0, scoreB: 0, periodLabel: "INNING 1", startsAt: new Date().toISOString(), probA: null,
  };
}

const GAME_SELECT =
  "id, status, period, clock, home_score, away_score, start_time," +
  "home:teams!games_home_team_id_fkey(id, name, city)," +
  "away:teams!games_away_team_id_fkey(id, name, city)";

interface GameRowRaw {
  id: string; status: string; period: string | null; clock: string | null;
  home_score: number | null; away_score: number | null; start_time: string;
  home: { name: string } | null; away: { name: string } | null;
}
interface EventRowRaw {
  id: string; category: string; title: string; side_a_label: string; side_b_label: string;
  status: string; winner: "a" | "b" | "tie" | null; prob_a: number | null;
  score_a: number; score_b: number; period_label: string | null; starts_at: string;
  source: { pm_condition?: string; pm_a_outcome?: string } | null;
}

function gameToBattle(g: GameRowRaw): Battle {
  return {
    kind: "game", id: g.id, category: "MLB",
    title: `${(g.away?.name ?? "AWAY").toUpperCase()} vs ${(g.home?.name ?? "HOME").toUpperCase()}`,
    aLabel: (g.away?.name ?? "AWAY").toUpperCase(), bLabel: (g.home?.name ?? "HOME").toUpperCase(),
    aTeam: g.away?.name, bTeam: g.home?.name,
    status: g.status, winner: null,
    scoreA: g.away_score ?? 0, scoreB: g.home_score ?? 0,
    periodLabel: isLive(g.status) ? `INNING ${g.period ?? "1"}` : null,
    startsAt: g.start_time, probA: null,
  };
}
function eventToBattle(e: EventRowRaw): Battle {
  return {
    kind: "event", id: e.id,
    title: e.title ?? "",
    category: e.category === "worldcup" ? "WORLD CUP" : e.category === "prop" ? "PROP"
      : e.category === "market" ? "TRENDING" : e.category.toUpperCase(),
    aLabel: e.side_a_label.toUpperCase(), bLabel: e.side_b_label.toUpperCase(),
    status: e.status, winner: e.winner,
    scoreA: e.score_a, scoreB: e.score_b,
    periodLabel: e.period_label, startsAt: e.starts_at,
    probA: e.prob_a != null ? Number(e.prob_a) : null,
    pmCondition: e.source?.pm_condition, pmAOutcome: e.source?.pm_a_outcome,
  };
}
function battleSort(a: Battle, b: Battle): number {
  // sports first (live, then upcoming), 24/7 markets after, finals last
  const rank = (x: Battle) =>
    x.category === "TRENDING" ? 2 : isLive(x.status) ? 0 : x.status === "scheduled" ? 1 : 3;
  return rank(a) - rank(b) || Date.parse(a.startsAt) - Date.parse(b.startsAt);
}

export default function Arena() {
  const { gameId: routeId } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [lobby, setLobby] = useState<Battle[]>([]);
  const [rowExpanded, setRowExpanded] = useState<Record<string, boolean>>({});
  const [isSim, setIsSim] = useState(false);
  const [player, setPlayer] = useState<Player | null>(null);
  const [serverOk, setServerOk] = useState(false);
  const [localBankroll, setLocalBankroll] = useState<number>(() => {
    const v = Number(localStorage.getItem("arena_bankroll"));
    return Number.isFinite(v) && v > 0 ? v : START_BANKROLL;
  });
  const [myStake, setMyStake] = useState<Totals>({ away: 0, home: 0 });
  const [totals, setTotals] = useState<Totals>({ away: 0, home: 0 });
  const [flash, setFlash] = useState<FlashMsg | null>(null);
  const [probSource, setProbSource] = useState<"MARKET LINE" | "SCORE MODEL">("SCORE MODEL");
  const [topBoard, setTopBoard] = useState<BoardRow[]>([]);
  const [todayBoard, setTodayBoard] = useState<BoardRow[]>([]);
  const [boardMode, setBoardMode] = useState<"ALL-TIME" | "TODAY">("ALL-TIME");
  const [backers, setBackers] = useState<BackerRow[]>([]);
  const [myBets, setMyBets] = useState<MyBet[]>([]);
  const [myRecord, setMyRecord] = useState<{ w: number; l: number; net: number } | null>(null);
  const [authedEmail, setAuthedEmail] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [saveEmail, setSaveEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [tape, setTape] = useState<TapeRow[]>([]);
  const riverTicks = useRef<{ p: number; t: number }[]>([]); // P(side A) history, oldest first
  const flowPressure = useRef<{ away: number; home: number }>({ away: 0, home: 0 });

  const front = useRef(0.5);
  const target = useRef(0.5);
  const particles = useRef<Particle[]>([]);
  const battleRef = useRef<Battle | null>(null);
  const prevScore = useRef<{ a: number; b: number } | null>(null);
  const prevProb = useRef<number | null>(null);
  const lastBankroll = useRef<number | null>(null);
  const simTick = useRef(0);
  const me = useRef(clientId());

  useEffect(() => { localStorage.setItem("arena_bankroll", String(localBankroll)); }, [localBankroll]);

  const spawn = useCallback((side: Side, n: number, boost = 0, glyph?: string) => {
    const cv = canvasRef.current; if (!cv) return;
    const cols = battleColors(battleRef.current);
    const hue = side === "home" ? cols.h : cols.a;
    for (let i = 0; i < n; i++) {
      particles.current.push({
        side,
        x: side === "away" ? -12 : cv.width + 12,
        y: 24 + Math.random() * (cv.height - 48),
        v: (2.2 + Math.random() * 3 + boost) * (side === "away" ? 1 : -1),
        r: 1.6 + Math.random() * 2.6,
        hue,
        trail: Math.random() < 0.35,
        glyph: i === 0 ? glyph : undefined, // your avatar rides the burst
      });
    }
  }, []);

  const fireFlash = useCallback((text: string, color: string) => {
    setFlash({ text, until: Date.now() + 3200, color });
  }, []);

  // ---- player ----------------------------------------------------------------
  const refreshPlayer = useCallback(async () => {
    const { data, error } = await supabase.from("arena_players" as never)
      .select("*")
      .eq("client_id", me.current).maybeSingle();
    if (error) { setServerOk(false); return; }
    setServerOk(true);
    if (data) {
      const p = data as unknown as Player;
      if (lastBankroll.current != null && p.bankroll > lastBankroll.current &&
          isFinal(battleRef.current?.status)) {
        fireFlash(`SETTLED · +${(p.bankroll - lastBankroll.current).toLocaleString()} CHIPS`, "#4dff88");
      }
      lastBankroll.current = p.bankroll;
      setPlayer(p);
    }
  }, [fireFlash]);

  useEffect(() => { refreshPlayer(); }, [refreshPlayer]);

  // ---- save your record: email magic link binds client_id to an account ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthedEmail(data.session?.user?.email ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthedEmail(session?.user?.email ?? null);
    });
    return () => { data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!authedEmail || !serverOk) return;
    if (localStorage.getItem("arena_linked") === authedEmail) return;
    (async () => {
      const { data, error } = await (supabase.rpc as CallableFunction)("arena_link_account", {
        p_client: me.current,
      });
      if (error) return; // migration not applied yet -> silently skip
      localStorage.setItem("arena_linked", authedEmail);
      const canonical = (data as { client_id: string }).client_id;
      if (canonical && canonical !== me.current) {
        // this device adopts the account's existing record
        localStorage.setItem("arena_client_id", canonical);
        window.location.reload();
        return;
      }
      fireFlash("RECORD SAVED TO YOUR ACCOUNT", "#4dff88");
      refreshPlayer();
    })();
  }, [authedEmail, serverOk, refreshPlayer, fireFlash]);

  const sendMagicLink = async () => {
    const email = saveEmail.trim();
    if (!/.+@.+\..+/.test(email)) { fireFlash("ENTER A VALID EMAIL", "#ffd24d"); return; }
    const { error } = await supabase.auth.signInWithOtp({
      email, options: { emailRedirectTo: `${window.location.origin}/arena` },
    });
    if (error) { fireFlash(String(error.message).toUpperCase().slice(0, 40), "#ffd24d"); return; }
    localStorage.setItem("arena_otp_email", email); // survive refresh/tab switch
    setOtpSent(true);
    fireFlash("EMAIL SENT — CLICK THE LINK OR ENTER THE CODE", "#4dff88");
  };

  const verifyCode = async () => {
    const token = otpCode.trim();
    if (token.length < 6) { fireFlash("ENTER THE CODE FROM THE EMAIL", "#ffd24d"); return; }
    const { error } = await supabase.auth.verifyOtp({
      email: saveEmail.trim(), token, type: "email",
    });
    if (error) { fireFlash(String(error.message).toUpperCase().slice(0, 40), "#ffd24d"); return; }
    localStorage.removeItem("arena_otp_email");
    setShowSave(false); setOtpSent(false); setOtpCode("");
    // onAuthStateChange picks up the session and links the record
  };

  // a pending code survives page refreshes — the input is always waiting
  useEffect(() => {
    const pending = localStorage.getItem("arena_otp_email");
    if (pending) { setSaveEmail(pending); setShowSave(true); setOtpSent(true); }
  }, []);

  const claimDaily = async () => {
    const { data, error } = await (supabase.rpc as CallableFunction)("arena_claim_daily", {
      p_client: me.current, p_handle: defaultHandle(me.current), p_day: todayStr(),
    });
    if (error) { fireFlash("CLAIM FAILED — TRY AGAIN", "#ffd24d"); return; }
    const r = data as { claimed: number; bankroll: number; streak_days: number; last_claim_date: string; handle: string };
    lastBankroll.current = r.bankroll;
    setPlayer({ handle: r.handle, bankroll: r.bankroll, streak_days: r.streak_days, last_claim_date: r.last_claim_date });
    if (r.claimed > 0) fireFlash(`+${r.claimed} CHIPS · DAY ${r.streak_days} STREAK`, "#4dff88");
  };

  // ---- lobby + active battle poll ----------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function fetchLobby(): Promise<Battle[]> {
      const battles: Battle[] = [];
      const winFrom = new Date(Date.now() - 12 * 3600_000).toISOString();
      const winTo = new Date(Date.now() + 48 * 3600_000).toISOString();
      const [gamesRes, eventsRes] = await Promise.all([
        supabase.from("games").select(GAME_SELECT)
          .ilike("sport_key", "%mlb%")
          .gt("start_time", winFrom).lt("start_time", winTo)
          .order("start_time", { ascending: false }).limit(14),
        supabase.from("arena_events" as never).select("*")
          .gt("starts_at", winFrom).lt("starts_at", winTo)
          .order("starts_at", { ascending: true }).limit(20),
      ]);
      for (const g of (gamesRes.data ?? []) as unknown as GameRowRaw[]) battles.push(gameToBattle(g));
      for (const e of (eventsRes.data ?? []) as unknown as EventRowRaw[]) battles.push(eventToBattle(e));
      return battles.sort(battleSort);
    }

    async function fetchGameLiveOdds(id: string): Promise<{ prob: number | null; cond?: string; aOut?: string }> {
      const { data } = await supabase.from("arena_live_odds" as never)
        .select("*").eq("game_id", id).maybeSingle();
      const row = data as unknown as { home_prob: number; updated_at: string; pm_condition?: string | null; pm_a_outcome?: string | null } | null;
      if (!row) return { prob: null };
      const fresh = Date.now() - Date.parse(row.updated_at) <= ODDS_FRESH_MS;
      return {
        prob: fresh ? Number(row.home_prob) : null,
        cond: row.pm_condition ?? undefined,
        aOut: row.pm_a_outcome ?? undefined,
      };
    }

    function advanceSim() {
      const b = battleRef.current ?? makeSimBattle();
      simTick.current++;
      const copy = { ...b };
      if (simTick.current % 2 === 0 && Math.random() < 0.7) {
        const inning = Math.min(9, (parseInt(copy.periodLabel?.replace(/\D/g, "") || "1", 10) || 1) + (Math.random() < 0.4 ? 1 : 0));
        copy.periodLabel = `INNING ${inning}`;
        if (Math.random() < 0.45) {
          const runs = Math.random() < 0.75 ? 1 : 2;
          if (Math.random() < 0.5) copy.scoreB += runs; else copy.scoreA += runs;
        }
      }
      apply(copy, true, null);
    }

    function apply(b: Battle, sim: boolean, gameOddsProb: number | null) {
      if (cancelled) return;
      const sameBattle = battleRef.current?.id === b.id;
      const prev = sameBattle ? prevScore.current : null;
      if (prev && (b.scoreA !== prev.a || b.scoreB !== prev.b)) {
        const bScored = b.scoreB > prev.b;
        const label = bScored ? b.bLabel : b.aLabel;
        const n = bScored ? b.scoreB - prev.b : b.scoreA - prev.a;
        spawn(bScored ? "home" : "away", 30 + n * 12, 3.5);
        fireFlash(`${label} SCORE${n > 1 ? ` +${n}` : ""}`, battleColors(b)[bScored ? "h" : "a"]);
      }
      prevScore.current = { a: b.scoreA, b: b.scoreB };
      const p = battleProbB(b, gameOddsProb);
      if (sameBattle && prevProb.current != null && Math.abs(p - prevProb.current) > 0.06 &&
          prev && b.scoreA === prev.a && b.scoreB === prev.b) {
        spawn(p > prevProb.current ? "home" : "away", 22, 3);
        fireFlash("SHARP MOVE", "#ffd24d");
      }
      if (!sameBattle) { front.current = p; particles.current = []; }
      prevProb.current = p;
      target.current = p;
      battleRef.current = b;
      setBattle(b);
      setIsSim(sim);
      setProbSource(b.kind === "event"
        ? (b.probA != null ? "MARKET LINE" : "SCORE MODEL")
        : (gameOddsProb != null ? "MARKET LINE" : "SCORE MODEL"));
    }

    async function tick() {
      if (battleRef.current?.id === "sim" && !routeId) { advanceSim(); return; }
      const list = await fetchLobby().catch(() => [] as Battle[]);
      if (cancelled) return;
      setLobby(list);
      const active = (routeId && list.find((x) => x.id === routeId)) || list[0] || null;
      if (!active) { if (!battleRef.current) apply(makeSimBattle(), true, null); return; }
      let oddsProb: number | null = null;
      if (active.kind === "game") {
        const odds = await fetchGameLiveOdds(active.id).catch(() => ({ prob: null } as { prob: number | null; cond?: string; aOut?: string }));
        oddsProb = odds.prob;
        active.pmCondition = odds.cond;   // MLB battles stream Polymarket flow too
        active.pmAOutcome = odds.aOut;
      }
      apply(active, false, oddsProb);
      if (isFinal(active.status)) refreshPlayer();
    }

    tick();
    const iv = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [routeId, spawn, fireFlash, refreshPlayer]);

  // ---- stakes: totals + backers + realtime --------------------------------------
  const battleId = battle?.id;
  const battleKind = battle?.kind;
  const stakeCol = battleKind === "event" ? "event_id" : "game_id";

  const refreshBackers = useCallback(async (col: string, id: string) => {
    const { data } = await supabase.from("arena_stakes" as never)
      .select("client_id, side, amount, created_at").eq(col, id)
      .order("created_at", { ascending: false }).limit(400);
    if (!data) return;
    const t: Totals = { away: 0, home: 0 };
    const byClient = new Map<string, { away: number; home: number }>();
    const raw = data as unknown as { client_id: string; side: Side; amount: number; created_at: string }[];
    for (const s of raw) {
      t[s.side] += s.amount;
      const cur = byClient.get(s.client_id) ?? { away: 0, home: 0 };
      cur[s.side] += s.amount;
      byClient.set(s.client_id, cur);
    }
    setTotals(t);
    const ids = [...byClient.keys()].filter((x) => x !== HOUSE_ID);
    const handles = new Map<string, string>();
    if (ids.length) {
      const { data: hs } = await supabase.from("arena_players" as never)
        .select("client_id, handle").in("client_id", ids);
      for (const h of (hs ?? []) as unknown as { client_id: string; handle: string }[]) {
        handles.set(h.client_id, h.handle);
      }
    }
    setBackers([...byClient.entries()]
      .map(([id2, v]) => ({
        handle: id2 === HOUSE_ID ? "HOUSE" : (handles.get(id2) || `FAN-${id2.slice(0, 4).toUpperCase()}`),
        away: v.away, home: v.home, mine: id2 === me.current, house: id2 === HOUSE_ID,
      }))
      .sort((a, b) => (b.away + b.home) - (a.away + a.home))
      .slice(0, 10));
    setTape(raw.slice(0, 9).map((s) => ({
      t: new Date(s.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      handle: s.client_id === HOUSE_ID ? "HOUSE"
        : s.client_id === me.current ? "YOU"
        : (handles.get(s.client_id) || `FAN-${s.client_id.slice(0, 4).toUpperCase()}`),
      side: s.side, amount: s.amount, house: s.client_id === HOUSE_ID,
    })));
  }, []);

  // real global order flow: every fresh Polymarket trade on this battle's
  // market becomes particles on its side, sized by dollars. This is why the
  // battlefield is never dead — the world is trading even when nobody here is.
  const pmCond = battle?.pmCondition;
  const pmAOut = battle?.pmAOutcome;
  useEffect(() => {
    if (!pmCond) return;
    let cancelled = false;
    let lastTs = Math.floor(Date.now() / 1000) - 900; // backfill 15 min on entry
    let first = true;
    async function poll() {
      try {
        const res = await fetch(`https://data-api.polymarket.com/trades?market=${pmCond}&limit=40`);
        if (!res.ok) return;
        const trades = (await res.json()) as { outcome: string; size: number; price: number; timestamp: number }[];
        const fresh = trades.filter((t) => Number(t.timestamp) > lastTs)
          .sort((x, y) => Number(x.timestamp) - Number(y.timestamp));
        if (!fresh.length) return;
        lastTs = Math.max(...fresh.map((t) => Number(t.timestamp)));
        const show = first ? fresh.slice(-10) : fresh;
        first = false;
        if (cancelled) return;
        for (const t of show) {
          const side: Side = pmAOut && t.outcome === pmAOut ? "away" : "home";
          const usd = Number(t.size) * Number(t.price);
          // feed the continuous pressure stream; big prints also burst outright
          flowPressure.current[side] = Math.min(8000, flowPressure.current[side] + usd);
          if (usd > 1000) spawn(side, Math.min(16, 4 + Math.floor(usd / 800)), 3);
          if (usd >= 250) {
            setTape((prev) => [{
              t: new Date(Number(t.timestamp) * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
              handle: "FLOW", side, amount: Math.round(usd), house: false,
            }, ...prev].slice(0, 9));
          }
        }
      } catch { /* flow is decoration; never break the arena */ }
    }
    poll();
    const iv = setInterval(poll, 8000);
    // continuous ambient fire: rate per side follows real betting pressure
    // (decaying), with a faint baseline so a traded market never sits still
    const stream = setInterval(() => {
      const pr = flowPressure.current;
      for (const side of ["away", "home"] as Side[]) {
        const lean = side === "away" ? 1 - target.current : target.current;
        const rate = Math.min(1, pr[side] / 2500) + 0.12 * lean;
        if (Math.random() < rate) spawn(side, 1 + (Math.random() < rate * 0.5 ? 1 : 0), 0);
        pr[side] *= 0.96;
      }
    }, 420);
    return () => { cancelled = true; clearInterval(iv); clearInterval(stream); };
  }, [pmCond, pmAOut, spawn]);

  // price-river history for the active battle
  useEffect(() => {
    if (!battleId || battleId === "sim") { riverTicks.current = []; return; }
    let cancelled = false;
    async function loadTicks() {
      const { data } = await supabase.from("arena_ticks" as never)
        .select("prob, created_at").eq("target", battleId)
        .order("created_at", { ascending: true }).limit(300);
      if (!cancelled && data) {
        riverTicks.current = (data as unknown as { prob: number; created_at: string }[])
          .map((r) => ({ p: Number(r.prob), t: Date.parse(r.created_at) }));
      }
    }
    loadTicks();
    const iv = setInterval(loadTicks, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [battleId]);

  useEffect(() => {
    if (!battleId || battleId === "sim") { setBackers([]); return; }
    setMyStake({
      away: Number(localStorage.getItem(`arena_my_away_${battleId}`)) || 0,
      home: Number(localStorage.getItem(`arena_my_home_${battleId}`)) || 0,
    });
    setTotals({ away: 0, home: 0 });
    refreshBackers(stakeCol, battleId);

    const ch = supabase
      .channel(`arena-${battleId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "arena_stakes", filter: `${stakeCol}=eq.${battleId}` },
        (payload) => {
          const row = payload.new as { side: Side; amount: number; client_id: string };
          setTotals((t) => ({ ...t, [row.side]: t[row.side] + row.amount }));
          if (row.client_id !== me.current) spawn(row.side, 18, 2);
          refreshBackers(stakeCol, battleId);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [battleId, stakeCol, spawn, refreshBackers]);

  // ---- my bets across battles ----------------------------------------------------
  const refreshMyBets = useCallback(async () => {
    const { data: stakes } = await supabase.from("arena_stakes" as never)
      .select("game_id, event_id, side, amount, settled, payout, created_at")
      .eq("client_id", me.current)
      .order("created_at", { ascending: false }).limit(24);
    if (!stakes) return;
    const rows = stakes as unknown as { game_id: string | null; event_id: string | null; side: Side; amount: number; settled: boolean; payout: number | null }[];
    const gameIds = [...new Set(rows.map((r) => r.game_id).filter(Boolean))] as string[];
    const eventIds = [...new Set(rows.map((r) => r.event_id).filter(Boolean))] as string[];
    const battles = new Map<string, Battle>();
    if (gameIds.length) {
      const { data: gs } = await supabase.from("games").select(GAME_SELECT).in("id", gameIds);
      for (const g of (gs ?? []) as unknown as GameRowRaw[]) battles.set(g.id, gameToBattle(g));
    }
    if (eventIds.length) {
      const { data: es } = await supabase.from("arena_events" as never).select("*").in("id", eventIds);
      for (const e of (es ?? []) as unknown as EventRowRaw[]) battles.set(e.id, eventToBattle(e));
    }
    const merged = new Map<string, { b: Battle; side: Side; amount: number; settled: boolean; payout: number | null }>();
    for (const r of rows) {
      const id = (r.game_id ?? r.event_id)!;
      const b = battles.get(id); if (!b) continue;
      const key = `${id}:${r.side}`;
      const cur = merged.get(key);
      if (cur) {
        cur.amount += r.amount;
        cur.settled = cur.settled && r.settled;
        if (r.payout != null) cur.payout = (cur.payout ?? 0) + r.payout;
      } else merged.set(key, { b, side: r.side, amount: r.amount, settled: r.settled, payout: r.payout });
    }
    setMyBets([...merged.values()].map(({ b, side, amount, settled, payout }) => {
      const cols = battleColors(b);
      let outcome: MyBet["outcome"] = "OPEN";
      if (isFinal(b.status) && settled) {
        const winSide = b.kind === "event"
          ? b.winner
          : b.scoreB === b.scoreA ? "tie" : b.scoreB > b.scoreA ? "b" : "a";
        outcome = winSide === "tie" ? "REFUND"
          : (winSide === "b" ? "home" : "away") === side ? "WON" : "LOST";
      }
      return {
        label: b.category === "TRENDING" || b.category === "PROP"
          ? b.title.slice(0, 46)
          : `${b.aLabel} vs ${b.bLabel}`,
        sideLabel: side === "home" ? b.bLabel : b.aLabel,
        amount, payout, outcome, hex: side === "home" ? cols.h : cols.a,
      };
    }).slice(0, 8));
    // lifetime line: W-L and net chips across every settled stake
    let w = 0, l = 0, net = 0;
    for (const r of rows) {
      if (!r.settled || r.payout == null) continue;
      net += r.payout - r.amount;
      if (r.payout > r.amount) w++;
      else if (r.payout === 0) l++;
    }
    setMyRecord(w + l > 0 ? { w, l, net } : null);
  }, []);

  // ---- leaderboard + my bets poll --------------------------------------------------
  useEffect(() => {
    if (!serverOk) return;
    let cancelled = false;
    async function refreshBoards() {
      const { data: tops } = await supabase.from("arena_players" as never)
        .select("*")
        .order("bankroll", { ascending: false }).limit(8);
      if (!cancelled && tops) {
        const players = tops as unknown as { client_id: string; handle: string; avatar: string; bankroll: number; streak_days: number }[];
        // all-time W-L from settled stakes (payout > amount = win, 0 = loss)
        const records = new Map<string, { w: number; l: number }>();
        const { data: hist } = await supabase.from("arena_stakes" as never)
          .select("client_id, amount, payout")
          .in("client_id", players.map((p) => p.client_id))
          .eq("settled", true).not("payout", "is", null).limit(1000);
        for (const s of (hist ?? []) as unknown as { client_id: string; amount: number; payout: number }[]) {
          const r = records.get(s.client_id) ?? { w: 0, l: 0 };
          if (s.payout > s.amount) r.w++;
          else if (s.payout === 0) r.l++;
          records.set(s.client_id, r);
        }
        if (!cancelled) {
          setTopBoard(players.map((r) => {
            const rec = records.get(r.client_id);
            return {
              cid: r.client_id, avatar: r.avatar || undefined,
              handle: r.handle || `FAN-${r.client_id.slice(0, 4).toUpperCase()}`,
              value: r.bankroll, streak: r.streak_days, mine: r.client_id === me.current,
              record: rec ? `${rec.w}W·${rec.l}L` : undefined,
            };
          }));
        }
      }

      // today's board: net chips on stakes placed since local midnight
      const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
      const { data: todays } = await supabase.from("arena_stakes" as never)
        .select("client_id, amount, payout")
        .eq("settled", true).not("payout", "is", null)
        .neq("client_id", HOUSE_ID)
        .gt("created_at", midnight.toISOString()).limit(1000);
      if (!cancelled && todays) {
        const nets = new Map<string, number>();
        for (const s of todays as unknown as { client_id: string; amount: number; payout: number }[]) {
          nets.set(s.client_id, (nets.get(s.client_id) ?? 0) + (s.payout - s.amount));
        }
        const ids2 = [...nets.keys()];
        const meta = new Map<string, { handle: string; avatar: string }>();
        if (ids2.length) {
          const { data: hs2 } = await supabase.from("arena_players" as never)
            .select("*").in("client_id", ids2);
          for (const h of (hs2 ?? []) as unknown as { client_id: string; handle: string; avatar: string }[]) {
            meta.set(h.client_id, { handle: h.handle, avatar: h.avatar });
          }
        }
        setTodayBoard([...nets.entries()]
          .sort((x, y) => y[1] - x[1]).slice(0, 8)
          .map(([cid, net]) => ({
            cid, avatar: meta.get(cid)?.avatar || undefined,
            handle: meta.get(cid)?.handle || `FAN-${cid.slice(0, 4).toUpperCase()}`,
            value: net, mine: cid === me.current,
          })));
      }
      refreshMyBets();
    }
    refreshBoards();
    const iv = setInterval(refreshBoards, LEADERBOARD_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [serverOk, refreshMyBets]);

  // ---- sim-only ambient crowd -------------------------------------------------------
  useEffect(() => {
    if (!isSim) return;
    const crowd = setInterval(() => {
      const p = target.current;
      const side: Side = Math.random() < 1 - p ? "away" : "home";
      spawn(side, 1 + Math.floor(Math.random() * 4));
      setTotals((t) => ({ ...t, [side]: t[side] + Math.floor(20 + Math.random() * 120) }));
    }, 480);
    return () => clearInterval(crowd);
  }, [isSim, spawn]);

  // ---- local-mode settlement (games only; events settle via cron) --------------------
  useEffect(() => {
    if (!battle || battle.id === "sim" || battle.kind !== "game" || !isFinal(battle.status) || serverOk) return;
    const key = `arena_settled_${battle.id}`;
    if (localStorage.getItem(key)) return;
    if (battle.scoreA === battle.scoreB) return;
    const winner: Side = battle.scoreB > battle.scoreA ? "home" : "away";
    const pot = totals.away + totals.home;
    const mine = myStake[winner];
    if (totals[winner] > 0 && mine > 0) {
      const payout = Math.floor((mine / totals[winner]) * pot);
      setLocalBankroll((v) => v + payout);
      fireFlash(`SETTLED · +${payout.toLocaleString()} CHIPS`, "#4dff88");
    }
    localStorage.setItem(key, "1");
  }, [battle, totals, myStake, serverOk, fireFlash]);

  // ---- render loop ---------------------------------------------------------------------
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    const cx = cv.getContext("2d"); if (!cx) return;

    let raf = 0;
    const draw = () => {
      const W = cv.width, H = cv.height;
      cx.clearRect(0, 0, W, H);
      const cols = battleColors(battleRef.current);
      const fx = (1 - front.current) * W;

      cx.fillStyle = "#05060a"; cx.fillRect(0, 0, W, H);
      cx.globalAlpha = 0.10;
      cx.fillStyle = cols.a; cx.fillRect(0, 0, fx, H);
      cx.fillStyle = cols.h; cx.fillRect(fx, 0, W - fx, H);
      cx.globalAlpha = 1;

      cx.strokeStyle = "rgba(120,140,180,0.10)";
      for (let i = 1; i < 12; i++) {
        cx.beginPath(); cx.moveTo((i * W) / 12, 0); cx.lineTo((i * W) / 12, H); cx.stroke();
      }
      for (let i = 1; i < 4; i++) {
        cx.beginPath(); cx.moveTo(0, (i * H) / 4); cx.lineTo(W, (i * H) / 4); cx.stroke();
      }

      // price river: the front line's history as a wake, oldest at top,
      // flowing down into the live line's current position
      const ticks = riverTicks.current;
      if (ticks.length > 1) {
        cx.save();
        cx.strokeStyle = "rgba(255,255,255,0.35)";
        cx.lineWidth = 1.5;
        cx.beginPath();
        for (let i = 0; i < ticks.length; i++) {
          const x = ticks[i].p * W;                     // ticks store P(side A); fx = pA*W
          const y = (i / ticks.length) * (H - 8);
          if (i === 0) cx.moveTo(x, y); else cx.lineTo(x, y);
        }
        cx.lineTo(fx, H - 4);
        cx.stroke();
        // time anchors so the wake reads top(past) -> bottom(now)
        cx.font = "10px ui-monospace, monospace";
        cx.fillStyle = "rgba(140,160,200,0.5)";
        const t0 = new Date(ticks[0].t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        cx.fillText(t0, Math.min(W - 44, ticks[0].p * W + 8), 14);
        cx.fillText("NOW", Math.min(W - 40, fx + 8), H - 10);
        cx.restore();
      }

      cx.save();
      cx.shadowBlur = 18; cx.shadowColor = "#ffffff";
      cx.fillStyle = "rgba(255,255,255,0.9)"; cx.fillRect(fx - 1.5, 0, 3, H);
      cx.restore();

      const arr = particles.current;
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i]; p.x += p.v;
        const hit = p.side === "away" ? p.x >= fx - 6 : p.x <= fx + 6;
        if (hit) {
          front.current += (p.side === "home" ? 1 : -1) * 0.0009;
          arr.splice(i, 1); continue;
        }
        if (p.trail) {
          cx.globalAlpha = 0.25; cx.fillStyle = p.hue;
          cx.fillRect(p.side === "away" ? p.x - 14 : p.x + 2, p.y - 0.5, 12, 1);
          cx.globalAlpha = 1;
        }
        if (p.glyph) {
          cx.save(); cx.shadowBlur = 14; cx.shadowColor = p.hue;
          cx.font = "26px serif"; cx.textAlign = "center"; cx.fillStyle = "#f2f6ff";
          cx.fillText(p.glyph, p.x, p.y + 9); cx.restore();
        } else {
          cx.save(); cx.shadowBlur = 8; cx.shadowColor = p.hue; cx.fillStyle = p.hue;
          cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI * 2); cx.fill(); cx.restore();
        }
      }

      front.current += (target.current - front.current) * 0.02;
      front.current = Math.min(0.97, Math.max(0.03, front.current));
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), Math.max(0, flash.until - Date.now()));
    return () => clearTimeout(t);
  }, [flash]);

  const bankroll = player ? player.bankroll : localBankroll;

  const throwChips = async (side: Side) => {
    const b = battleRef.current;
    if (!b) return;
    if (isFinal(b.status)) { fireFlash("BATTLE SETTLED", "#ffd24d"); return; }
    if (serverOk && !player) { fireFlash("CLAIM YOUR DAILY CHIPS TO ENTER", "#ffd24d"); return; }
    if (bankroll < THROW_SIZE) { fireFlash("BANKROLL EMPTY — CLAIM TOMORROW", "#ffd24d"); return; }

    const commitLocal = () => {
      setMyStake((s) => {
        const next = { ...s, [side]: s[side] + THROW_SIZE };
        if (b.id !== "sim") localStorage.setItem(`arena_my_${side}_${b.id}`, String(next[side]));
        return next;
      });
      spawn(side, 26, 2.5);
      // your marker always rides the burst — chosen avatar, or your initials —
      // so you can always SEE your own stake fly across the field
      const marker = player?.avatar
        || (player?.handle || defaultHandle(me.current)).replace(/^FAN-/, "").slice(0, 2).toUpperCase();
      spawn(side, 1, 3.5, marker);
    };

    if (b.id === "sim" || !serverOk || !player) {
      setLocalBankroll((v) => v - THROW_SIZE);
      commitLocal();
      setTotals((t) => ({ ...t, [side]: t[side] + THROW_SIZE }));
      return;
    }

    const { data, error } = await (supabase.rpc as CallableFunction)("arena_place_stake_v2", {
      p_client: me.current, p_side: side, p_amount: THROW_SIZE,
      p_game: b.kind === "game" ? b.id : null,
      p_event: b.kind === "event" ? b.id : null,
    });
    if (error) {
      fireFlash(String(error.message || "STAKE FAILED").toUpperCase().slice(0, 40), "#ffd24d");
      return;
    }
    const r = data as { bankroll: number };
    lastBankroll.current = r.bankroll;
    setPlayer((p) => (p ? { ...p, bankroll: r.bankroll } : p));
    commitLocal();
  };

  const shareBattle = async () => {
    const b = battleRef.current;
    const url = `${window.location.origin}/arena${b && b.id !== "sim" ? `/${b.id}` : ""}`;
    const text = b && b.id !== "sim" ? `${b.aLabel} vs ${b.bLabel} — live in the ProphetDome` : "ProphetDome — live";
    try {
      if (navigator.share) { await navigator.share({ title: "ProphetDome", text, url }); return; }
      await navigator.clipboard.writeText(url);
      fireFlash("LINK COPIED", "#4dff88");
    } catch { /* user cancelled */ }
  };

  const b = battle;
  const pot = totals.away + totals.home;
  const homeP = Math.round(front.current * 100);
  const cols = battleColors(b);
  const awayHex = cols.a, homeHex = cols.h;
  const liveish = isLive(b?.status);
  const isProp = b?.category === "PROP";
  const isMarket = b?.category === "TRENDING";
  const hideScores = isProp || isMarket;
  // gates close on decided LIVE sports battles only — trending markets are
  // 24/7 and longshots there are the whole point
  const gated = !isFinal(b?.status) && liveish && !isMarket && (homeP >= 85 || homeP <= 15);
  const statusLabel = !b ? "CONNECTING" : isMarket
    ? (isFinal(b.status) ? "RESOLVED" : "OPEN MARKET")
    : liveish
      ? (b.periodLabel ?? "LIVE")
      : b.status === "scheduled"
        ? `STARTS ${new Date(b.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
        : "FINAL";
  const mult = (side: Side) => {
    const sideTotal = totals[side];
    if (pot > 0 && sideTotal > 0) return (pot / sideTotal).toFixed(2);
    const p = side === "home" ? front.current : 1 - front.current;
    return (1 / Math.max(0.03, p)).toFixed(2);
  };
  const toWin = (side: Side) =>
    totals[side] > 0 ? Math.floor((myStake[side] / totals[side]) * pot) : myStake[side] * 2;
  // what a fresh 100-chip throw on this side would collect if it wins
  const winIf = (side: Side) =>
    Math.floor(((pot + THROW_SIZE) * THROW_SIZE) / (totals[side] + THROW_SIZE));
  const canClaim = serverOk && (!player || player.last_claim_date !== todayStr());
  const canBailout = serverOk && !!player && !canClaim && player.bankroll < 100;
  const claimAmount = canBailout ? 150 : 200 + 50 * Math.min((player?.streak_days ?? 0) + 1, 7);

  const outcomeColor: Record<MyBet["outcome"], string> = {
    OPEN: "#ffd24d", WON: "#4dff88", LOST: "#ff5a5a", REFUND: "#5a6b85",
  };

  return (
    <div className="min-h-screen w-full" style={{ background: "#05060a", fontFamily: "'JetBrains Mono','SF Mono',ui-monospace,monospace", color: "#c8d2e8" }}>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex items-center justify-between text-xs tracking-widest" style={{ color: "#5a6b85" }}>
          <span className="flex items-center gap-3">
            {routeId && (
              <button onClick={() => navigate("/arena")}
                className="px-2 py-1 rounded text-[11px] tracking-widest"
                style={{ background: "transparent", border: "1px solid #38445c", color: "#8fa2c4" }}>
                ◂ ALL BATTLES
              </button>
            )}
            <span>PROPHETDOME</span>
          </span>
          <span className="flex items-center gap-3">
            {isSim && <span style={{ color: "#ffd24d" }}>SIM MODE</span>}
            {!serverOk && !isSim && <span style={{ color: "#ffd24d" }}>LOCAL DEMO</span>}
            <span style={{ color: liveish ? "#4dff88" : "#5a6b85" }}>
              {liveish ? "● LIVE" : "○"} {statusLabel}
            </span>
            {serverOk && (authedEmail ? (
              <span className="text-[11px]" style={{ color: "#4dff88" }}>✓ SAVED</span>
            ) : showSave ? (
              <span className="flex items-center gap-1">
                {!otpSent ? (
                  <>
                    <input
                      value={saveEmail}
                      onChange={(e) => setSaveEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMagicLink()}
                      placeholder="you@email.com"
                      className="px-2 py-1 rounded text-[11px]"
                      style={{ background: "#0b0e18", border: "1px solid #38445c", color: "#c8d2e8", width: 150, outline: "none" }}
                    />
                    <button onClick={sendMagicLink} className="px-2 py-1 rounded text-[11px] tracking-widest"
                      style={{ background: "transparent", border: "1px solid #4dff88", color: "#4dff88" }}>
                      SEND
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && verifyCode()}
                      placeholder="6-digit code"
                      className="px-2 py-1 rounded text-[11px]"
                      style={{ background: "#0b0e18", border: "1px solid #4dff88", color: "#c8d2e8", width: 110, outline: "none" }}
                    />
                    <button onClick={verifyCode} className="px-2 py-1 rounded text-[11px] tracking-widest"
                      style={{ background: "transparent", border: "1px solid #4dff88", color: "#4dff88" }}>
                      VERIFY
                    </button>
                  </>
                )}
                <button onClick={() => { setShowSave(false); setOtpSent(false); localStorage.removeItem("arena_otp_email"); }} className="px-1 text-[11px]" style={{ background: "transparent", border: "none", color: "#5a6b85" }}>
                  ✕
                </button>
              </span>
            ) : (
              <button onClick={() => setShowSave(true)} className="px-2 py-1 rounded text-[11px] tracking-widest"
                style={{ background: "transparent", border: "1px solid #4dff88", color: "#4dff88" }}>
                SAVE RECORD
              </button>
            ))}
            <button onClick={shareBattle}
              className="px-2 py-1 rounded text-[11px] tracking-widest"
              style={{ background: "transparent", border: "1px solid #38445c", color: "#8fa2c4" }}>
              SHARE ↗
            </button>
          </span>
        </div>

        {[
          { label: "GAMES", items: lobby.filter((x) => x.category !== "TRENDING") },
          { label: "TRENDING", items: lobby.filter((x) => x.category === "TRENDING") },
        ].filter((row) => row.items.length > 0).map((row) => (
          <div key={row.label} className="mt-2 flex items-center gap-2">
            <span className="shrink-0 text-[9px] tracking-widest" style={{ color: "#38445c", width: 58 }}>
              {row.label}
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1">
            {(rowExpanded[row.label] ? row.items : row.items.slice(0, 10)).map((bt) => {
              const active = bt.id === b?.id;
              const btLive = isLive(bt.status);
              const c = battleColors(bt);
              return (
                <button key={bt.id} onClick={() => navigate(`/arena/${bt.id}`)}
                  className="shrink-0 px-3 py-2 rounded text-left"
                  style={{
                    background: active ? "#11162a" : "#080a12",
                    border: `1px solid ${active ? "#3a4a78" : "#1a2236"}`,
                  }}>
                  <div className="text-[10px] tracking-widest flex gap-2" style={{ color: btLive && bt.category !== "TRENDING" ? "#4dff88" : "#5a6b85" }}>
                    <span>{bt.category}</span>
                    <span>
                      {bt.category === "TRENDING" ? (isFinal(bt.status) ? "RESOLVED" : "OPEN")
                        : btLive ? `● ${bt.periodLabel ?? "LIVE"}` : isFinal(bt.status) ? "FINAL"
                          : new Date(bt.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="text-xs font-bold mt-0.5" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {bt.category === "TRENDING" ? (
                      <>
                        <span style={{ color: "#e8eefc" }}>{bt.title.slice(0, 30)}</span>
                        {bt.probA != null && <span style={{ color: c.a }}> {Math.round(bt.probA * 100)}¢</span>}
                      </>
                    ) : (
                      <>
                        <span style={{ color: c.a }}>{bt.aLabel}</span>
                        {bt.category !== "PROP" && <span style={{ color: "#e8eefc" }}> {bt.scoreA}–{bt.scoreB} </span>}
                        {bt.category === "PROP" && <span style={{ color: "#e8eefc" }}> / </span>}
                        <span style={{ color: c.h }}>{bt.bLabel}</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
            {row.items.length > 10 && (
              <button
                onClick={() => setRowExpanded((s) => ({ ...s, [row.label]: !s[row.label] }))}
                className="shrink-0 px-3 py-2 rounded text-[11px] tracking-widest"
                style={{ background: "#080a12", border: "1px dashed #2a3450", color: "#8fa2c4" }}
              >
                {rowExpanded[row.label] ? "LESS" : `+${row.items.length - 10} MORE`}
              </button>
            )}
            </div>
          </div>
        ))}

        <div className="mt-4 flex items-end justify-between">
          <div className="flex items-center gap-4">
            {!hideScores && (
              <span className="text-5xl font-bold" style={{ color: "#f2f6ff", fontVariantNumeric: "tabular-nums" }}>
                {b?.scoreA ?? 0}
              </span>
            )}
            <div>
              <div className="text-2xl font-bold" style={{ color: awayHex, textShadow: `0 0 24px ${awayHex}55` }}>
                {b?.aLabel ?? "—"}
              </div>
              <div className="text-lg" style={{ color: "#e8eefc" }}>{100 - homeP}%
                <span className="text-xs ml-2" style={{ color: "#5a6b85" }}>×{mult("away")} payout</span>
              </div>
            </div>
          </div>
          <div className="text-center text-xs" style={{ color: "#5a6b85" }}>
            <div>POT</div>
            <div className="text-xl" style={{ color: "#e8eefc" }}>{pot.toLocaleString()}</div>
            <div className="mt-0.5 text-[10px] max-w-[300px] mx-auto">
              {isMarket && b ? b.title.slice(0, 64) :
                isProp && b ? `SCORE ${b.scoreA}–${b.scoreB} · ${probSource}` :
                `${homeP === 50 ? "EVEN" : `${homeP > 50 ? b?.bLabel : b?.aLabel} FAVORED`} · ${probSource}`}
            </div>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <div className="text-2xl font-bold" style={{ color: homeHex, textShadow: `0 0 24px ${homeHex}55` }}>
                {b?.bLabel ?? "—"}
              </div>
              <div className="text-lg" style={{ color: "#e8eefc" }}>
                <span className="text-xs mr-2" style={{ color: "#5a6b85" }}>×{mult("home")} payout</span>
                {homeP}%
              </div>
            </div>
            {!hideScores && (
              <span className="text-5xl font-bold" style={{ color: "#f2f6ff", fontVariantNumeric: "tabular-nums" }}>
                {b?.scoreB ?? 0}
              </span>
            )}
          </div>
        </div>

        <div className="relative mt-3 rounded-lg overflow-hidden" style={{ border: "1px solid #1a2236" }}>
          <canvas ref={canvasRef} width={1180} height={300} className="block w-full" style={{ height: 300 }} />
          {flash && (
            <div
              className="absolute left-1/2 top-4 -translate-x-1/2 px-4 py-1.5 text-sm font-bold tracking-widest rounded"
              style={{ color: "#05060a", background: flash.color, boxShadow: `0 0 30px ${flash.color}` }}
            >
              {flash.text}
            </div>
          )}
        </div>

        {tape.length > 0 && (
          <div className="mt-2 flex gap-4 overflow-x-auto text-[11px] tracking-wider whitespace-nowrap" style={{ color: "#5a6b85" }}>
            {tape.map((tp, i) => (
              <span key={i} className="shrink-0">
                <span style={{ color: "#38445c" }}>{tp.t}</span>{" "}
                <span style={{ color: tp.handle === "YOU" ? "#ffd24d" : tp.handle === "FLOW" ? "#66b3ff" : tp.house ? "#8fa2c4" : "#c8d2e8", fontWeight: 700 }}>{tp.handle}</span>
                {" ▸ "}
                <span style={{ color: tp.side === "away" ? awayHex : homeHex, fontWeight: 700 }}>
                  {tp.side === "away" ? b?.aLabel : b?.bLabel} {tp.handle === "FLOW" ? `$${tp.amount.toLocaleString()}` : tp.amount}
                </span>
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div>
            <button
              onClick={() => !gated && throwChips("away")}
              className="w-full py-3 rounded font-bold tracking-widest text-sm transition-transform active:scale-95"
              style={{
                background: "transparent",
                border: `1px solid ${gated ? "#38445c" : awayHex}`,
                color: gated ? "#5a6b85" : awayHex,
                textShadow: gated ? "none" : `0 0 12px ${awayHex}66`,
                cursor: gated ? "not-allowed" : "pointer",
              }}
            >
              {gated ? "GATES CLOSED" : <>BACK {b?.aLabel ?? ""} · {THROW_SIZE}</>}
              <span className="block text-[10px] font-normal" style={{ opacity: 0.75 }}>
                {gated ? "BATTLE DECIDED" : `(WINS ${winIf("away").toLocaleString()})`}
              </span>
            </button>
            {myStake.away > 0 && (
              <div className="mt-1 text-center text-xs" style={{ color: awayHex }}>
                {myStake.away} staked · TO WIN {toWin("away").toLocaleString()}
              </div>
            )}
          </div>
          <div className="text-center text-xs" style={{ color: "#5a6b85" }}>
            <div>
              BANKROLL
              {player && player.streak_days > 0 && (
                <span className="ml-2" style={{ color: "#ff8c1a" }}>▲ DAY {player.streak_days}</span>
              )}
            </div>
            <div className="text-lg" style={{ color: "#ffd24d" }}>{bankroll.toLocaleString()}</div>
            {canClaim || canBailout ? (
              <button
                onClick={claimDaily}
                className="mt-1 px-3 py-1.5 rounded font-bold tracking-widest text-xs animate-pulse"
                style={{ background: "#4dff8822", border: "1px solid #4dff88", color: "#4dff88" }}
              >
                {canBailout ? "BAILOUT" : "CLAIM"} +{claimAmount}
              </button>
            ) : (
              <div className="mt-1" style={{ color: "#38445c" }}>
                {serverOk ? "CLAIMED · BACK TOMORROW" : "OFFLINE CHIPS"}
              </div>
            )}
          </div>
          <div>
            <button
              onClick={() => !gated && throwChips("home")}
              className="w-full py-3 rounded font-bold tracking-widest text-sm transition-transform active:scale-95"
              style={{
                background: "transparent",
                border: `1px solid ${gated ? "#38445c" : homeHex}`,
                color: gated ? "#5a6b85" : homeHex,
                textShadow: gated ? "none" : `0 0 12px ${homeHex}66`,
                cursor: gated ? "not-allowed" : "pointer",
              }}
            >
              {gated ? "GATES CLOSED" : <>BACK {b?.bLabel ?? ""} · {THROW_SIZE}</>}
              <span className="block text-[10px] font-normal" style={{ opacity: 0.75 }}>
                {gated ? "BATTLE DECIDED" : `(WINS ${winIf("home").toLocaleString()})`}
              </span>
            </button>
            {myStake.home > 0 && (
              <div className="mt-1 text-center text-xs" style={{ color: homeHex }}>
                {myStake.home} staked · TO WIN {toWin("home").toLocaleString()}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={async () => {
            try { await navigator.clipboard.writeText("teamnilmedia@gmail.com"); fireFlash("SPONSOR EMAIL COPIED", "#ffd24d"); }
            catch { fireFlash("EMAIL: TEAMNILMEDIA@GMAIL.COM", "#ffd24d"); }
          }}
          className="mt-5 w-full rounded-lg py-4 px-4 text-center transition-transform active:scale-[0.99]"
          style={{ background: "#f2f6ff", border: "3px solid #ffd24d", cursor: "pointer" }}
        >
          <span className="block text-[10px] tracking-[0.3em]" style={{ color: "#5a6b85" }}>
            TONIGHT'S POTS PRESENTED BY
          </span>
          <span className="block text-2xl font-black tracking-widest mt-1" style={{ color: "#0a0c14" }}>
            YOUR BRAND HERE
          </span>
          <span className="block text-[10px] tracking-[0.25em] mt-1 font-bold" style={{ color: "#b8860b" }}>
            SPONSOR PROPHETDOME · TAP TO COPY CONTACT
          </span>
        </button>

        {serverOk && (
          <div className="mt-5 grid gap-4" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div className="rounded-lg p-4" style={{ border: "1px solid #1a2236", background: "#080a12" }}>
              <div className="text-xs tracking-widest mb-3" style={{ color: "#ffd24d" }}>IN THE POT</div>
              {backers.length === 0 && (
                <div className="text-xs" style={{ color: "#38445c" }}>EMPTY — BE FIRST IN</div>
              )}
              {backers.map((bk, i) => (
                <div key={i} className="flex items-center justify-between py-1 text-sm"
                  style={{ color: bk.mine ? "#ffd24d" : "#c8d2e8" }}>
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 flex items-center justify-center rounded-full text-[10px] font-bold"
                      style={{
                        width: 22, height: 22,
                        background: bk.house ? "#1a2236" : bk.mine ? "#3a3010" : "#141a2e",
                        border: `1px solid ${bk.house ? "#5a6b85" : bk.mine ? "#ffd24d" : "#2a3450"}`,
                        color: bk.house ? "#8fa2c4" : bk.mine ? "#ffd24d" : "#8fa2c4",
                      }}>
                      {bk.house ? "⌂" : bk.handle.replace(/^FAN-/, "").slice(0, 2)}
                    </span>
                    <span className="font-bold truncate">{bk.house ? "HOUSE · POT SEED" : bk.handle}{bk.mine ? " · YOU" : ""}</span>
                  </span>
                  <span className="shrink-0" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {bk.away > 0 && <span style={{ color: awayHex }}>{bk.away.toLocaleString()}</span>}
                    {bk.away > 0 && bk.home > 0 && <span style={{ color: "#38445c" }}> / </span>}
                    {bk.home > 0 && <span style={{ color: homeHex }}>{bk.home.toLocaleString()}</span>}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-lg p-4" style={{ border: "1px solid #1a2236", background: "#080a12" }}>
              <div className="text-xs tracking-widest mb-3 flex items-center justify-between" style={{ color: "#66b3ff" }}>
                <span>MY BETS</span>
                {myRecord && (
                  <span style={{ color: myRecord.net >= 0 ? "#4dff88" : "#ff5a5a", fontVariantNumeric: "tabular-nums" }}>
                    {myRecord.w}W·{myRecord.l}L · {myRecord.net >= 0 ? "+" : ""}{myRecord.net.toLocaleString()}
                  </span>
                )}
              </div>
              {myBets.length === 0 && (
                <div className="text-xs" style={{ color: "#38445c" }}>NO BETS YET</div>
              )}
              {myBets.map((mb, i) => (
                <div key={i} className="py-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold" style={{ color: mb.hex }}>{mb.sideLabel} · {mb.amount}</span>
                    <span className="font-bold" style={{ color: outcomeColor[mb.outcome], fontVariantNumeric: "tabular-nums" }}>
                      {mb.outcome}
                      {mb.outcome === "WON" && mb.payout != null && ` +${(mb.payout - mb.amount).toLocaleString()}`}
                      {mb.outcome === "LOST" && ` −${mb.amount.toLocaleString()}`}
                      {mb.outcome === "REFUND" && " ±0"}
                    </span>
                  </div>
                  <div style={{ color: "#5a6b85" }}>{mb.label}</div>
                </div>
              ))}
            </div>

            <div className="rounded-lg p-4" style={{ border: "1px solid #1a2236", background: "#080a12" }}>
              <div className="text-xs tracking-widest mb-3 flex items-center justify-between" style={{ color: "#4dff88" }}>
                <span>TOP PROPHETS</span>
                <span className="flex gap-1">
                  {(["ALL-TIME", "TODAY"] as const).map((m) => (
                    <button key={m} onClick={() => setBoardMode(m)}
                      className="px-1.5 py-0.5 rounded text-[9px] tracking-widest"
                      style={{
                        background: boardMode === m ? "#11321f" : "transparent",
                        border: `1px solid ${boardMode === m ? "#4dff88" : "#1a2236"}`,
                        color: boardMode === m ? "#4dff88" : "#5a6b85",
                      }}>
                      {m}
                    </button>
                  ))}
                </span>
              </div>
              {(boardMode === "ALL-TIME" ? topBoard : todayBoard).length === 0 && (
                <div className="text-xs" style={{ color: "#38445c" }}>
                  {boardMode === "TODAY" ? "NOTHING SETTLED TODAY YET" : "NO PLAYERS YET"}
                </div>
              )}
              {(boardMode === "ALL-TIME" ? topBoard : todayBoard).map((r, i) => (
                <div key={i} onClick={() => navigate(`/arena/p/${r.cid}`)}
                  className="flex items-center justify-between py-1 text-sm cursor-pointer"
                  style={{ color: r.mine ? "#ffd24d" : "#c8d2e8" }}>
                  <span className="flex items-center gap-2">
                    <span style={{ color: "#5a6b85", width: 18, display: "inline-block" }}>{i + 1}</span>
                    {r.avatar && <span>{r.avatar}</span>}
                    <span className="font-bold underline decoration-dotted underline-offset-2">{r.handle}{r.mine ? " · YOU" : ""}</span>
                    {r.streak != null && r.streak > 1 && (
                      <span className="text-xs" style={{ color: "#ff8c1a" }}>▲{r.streak}D</span>
                    )}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: boardMode === "TODAY" ? (r.value >= 0 ? "#4dff88" : "#ff5a5a") : undefined }}>
                    {r.record && <span className="text-xs mr-2" style={{ color: "#5a6b85" }}>{r.record}</span>}
                    {boardMode === "TODAY" && r.value >= 0 ? "+" : ""}{r.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 text-center text-[11px] tracking-widest" style={{ color: "#38445c" }}>
          CHIPS ARE VIRTUAL · NO CASH VALUE · SOCCER SETTLES ON 90 MINUTES, DRAWS REFUND
        </div>
      </div>
    </div>
  );
}
