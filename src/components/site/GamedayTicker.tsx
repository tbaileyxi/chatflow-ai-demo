// The gameday ticker: real public rooms with their team's next game, and the
// week's real matchups. Shared by /sponsor and the landing page.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type TickerTeam = { id: string; city: string; name: string; league: string | null };

/**
 * Ticker lines from the app's own data: each public room, with its team's next
 * game ("Browns in CHS • Cleveland at Tampa Bay · Sun 1:00 PM"). Private rooms
 * and DMs are never read into it. When there are few rooms, the week's real
 * matchups fill in. Nothing is made up; no data, no lines.
 */
export function useTicker(teams: TickerTeam[]): string[] {
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    if (!teams.length) return;
    let cancelled = false;
    void (async () => {
      const now = new Date();
      const weekOut = new Date(now.getTime() + 7 * 86400e3);
      const [roomsRes, gamesRes] = await Promise.all([
        (supabase as any)
          .from('huddles')
          .select('name, team_id, expires_at')
          .eq('is_private', false)
          .eq('is_dm', false)
          .eq('is_game_room', false)
          .not('team_id', 'is', null)
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .limit(150),
        supabase
          .from('games')
          .select('home_team_id, away_team_id, start_time, status')
          .gte('start_time', now.toISOString())
          .lte('start_time', weekOut.toISOString())
          .neq('status', 'final')
          .order('start_time')
          .limit(500),
      ]);
      if (cancelled || gamesRes.error || !gamesRes.data) return;

      const byId = new Map(teams.map((t) => [t.id, t]));
      const when = (iso: string) =>
        new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
      type G = { home_team_id: string; away_team_id: string; start_time: string };
      const label = (g: G) => {
        const home = byId.get(g.home_team_id);
        const away = byId.get(g.away_team_id);
        return home && away ? `${away.city} at ${home.city} · ${when(g.start_time)}` : null;
      };
      const next = new Map<string, G>();
      for (const g of gamesRes.data as G[]) {
        for (const id of [g.home_team_id, g.away_team_id]) if (!next.has(id)) next.set(id, g);
      }

      const out: string[] = [];
      const seen = new Set<string>();
      const used = new Set<G>();
      for (const r of (roomsRes.data ?? []) as { name: string; team_id: string; expires_at: string | null }[]) {
        const name = (r.name || '').trim();
        if (!name || /\btest\b|closed/i.test(name)) continue;
        if (r.expires_at && Date.parse(r.expires_at) < now.getTime()) continue;
        if (seen.has(name.toLowerCase())) continue;
        const g = next.get(r.team_id);
        const m = g && label(g);
        if (!m) continue;
        seen.add(name.toLowerCase());
        used.add(g!);
        out.push(`${name} • ${m}`);
        if (out.length >= 24) break;
      }
      for (const g of gamesRes.data as G[]) {
        if (out.length >= 12) break;
        const m = !used.has(g) && label(g);
        if (m) out.push(m);
      }
      setItems(out);
    })();
    return () => { cancelled = true; };
  }, [teams]);
  return items;
}

export function Ticker({ items }: { items: string[] }) {
  if (!items.length) return null;
  const secs = Math.max(30, items.length * 7);
  return (
    <div className="overflow-hidden border-y border-[#FFD60A]/30 bg-black">
      <style>{`
        @keyframes sh-ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        .sh-ticker { animation: sh-ticker var(--sh-ticker-d) linear infinite }
        .sh-ticker:hover { animation-play-state: paused }
        @media (prefers-reduced-motion: reduce) { .sh-ticker { animation: none } }
      `}</style>
      <div
        className="sh-ticker flex w-max items-center py-2.5"
        style={{ ['--sh-ticker-d' as string]: `${secs}s` } as React.CSSProperties}
      >
        {[...items, ...items].map((t, i) => (
          <span
            key={i}
            aria-hidden={i >= items.length || undefined}
            className="flex items-center whitespace-nowrap text-[13px] font-semibold tracking-wide text-[#FFD60A]"
          >
            <span className="px-5">{t}</span>
            <span className="text-[8px] text-[#FFD60A]/50">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}


/** The ticker with its own team list, for pages that do not load one. */
export function GamedayTicker() {
  const [teams, setTeams] = useState<TickerTeam[]>([]);
  useEffect(() => {
    void supabase
      .from('teams')
      .select('id, city, name, league')
      .eq('status', 'active')
      .then(({ data }) => setTeams((data ?? []) as TickerTeam[]));
  }, []);
  return <Ticker items={useTicker(teams)} />;
}
