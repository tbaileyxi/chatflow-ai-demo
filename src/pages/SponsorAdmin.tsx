import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { monthlyForLeague } from '@/lib/founding';

// Protected seed/management path for founding sponsorships closed offline,
// and for editing the sponsor contact on any claim. Gated to admins.

interface Claim {
  id: string;
  team_key: string;
  team_name: string;
  league: string;
  // 'lapsed' is a sponsor who stopped paying. Setting it here is not just a
  // label: a trigger pulls their founding_partners row and deactivates the
  // team_sponsors one, so the name comes off the pregame card and the story
  // end card too.
  status: 'open' | 'reserved' | 'claimed' | 'lapsed';
  plan: string | null;
  business_name: string | null;
  sponsor_email: string | null;
  sponsor_phone: string | null;
  amount_paid_cents: number;
  monthly_cents: number | null;
  square_subscription_id: string | null;
  reserved_at: string | null;
  created_at: string;
}

const STATUSES: Claim['status'][] = ['open', 'reserved', 'claimed', 'lapsed'];

/** The three things a story can be seen to do. Nothing else is countable. */
type Reach = { shared: number; link_opened: number; downloaded: number };

export default function SponsorAdmin() {
  const { isAdmin, loading, user } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [reach, setReach] = useState<Reach | null>(null);
  const [busy, setBusy] = useState(false);
  const [add, setAdd] = useState({ teamKey: '', teamName: '', league: 'NFL', business: '', email: '', phone: '', status: 'reserved' as Claim['status'] });

  async function load() {
    const { data } = await supabase.from('sponsor_claims').select('*').order('created_at', { ascending: false });
    if (data) setClaims(data as unknown as Claim[]);
    // Null room = the whole app, which is the figure a first conversation
    // actually turns on: does any of this travel at all.
    const { data: r } = await (supabase.rpc as any)('story_counts', { p_huddle_id: null, p_days: 30 });
    setReach(Array.isArray(r) ? (r[0] as Reach) ?? null : (r as Reach) ?? null);
  }

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  async function update(id: string, patch: Partial<Claim>) {
    setBusy(true);
    const stamp: Partial<Claim> = { ...patch };
    if (patch.status === 'reserved' || patch.status === 'claimed') {
      const c = claims.find(x => x.id === id);
      if (!c?.reserved_at) (stamp as Record<string, unknown>).reserved_at = new Date().toISOString();
    }
    await supabase.from('sponsor_claims').update(stamp).eq('id', id);
    await load();
    setBusy(false);
  }

  async function addManual() {
    if (!add.teamKey || !add.teamName) return;
    setBusy(true);
    await supabase.from('sponsor_claims').upsert({
      team_key: add.teamKey, team_name: add.teamName, league: add.league,
      // 'reserve' was the old deposit plan and has not been sold in months.
      // An offline close is on the same monthly terms as an online one.
      status: add.status, plan: 'monthly',
      monthly_cents: monthlyForLeague(add.league) * 100,
      business_name: add.business || null, sponsor_email: add.email || null, sponsor_phone: add.phone || null,
      reserved_at: add.status !== 'open' ? new Date().toISOString() : null,
    }, { onConflict: 'team_key' });
    setAdd({ teamKey: '', teamName: '', league: 'NFL', business: '', email: '', phone: '', status: 'reserved' });
    await load();
    setBusy(false);
  }

  async function remove(id: string) {
    if (!confirm('Delete this claim? The team returns to OPEN on the board.')) return;
    setBusy(true);
    await supabase.from('sponsor_claims').delete().eq('id', id);
    await load();
    setBusy(false);
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: 32, color: '#fff', background: '#0a0a0a', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>Sponsor claim admin</h1>
      <p style={{ color: '#999', marginTop: 4, fontSize: 14 }}>Mark teams reserved/claimed for offline deals and edit sponsor contacts.</p>

      {/* REACH — the number the pitch now turns on.
          Three figures, never summed, and labelled as what they literally
          are. "Opens" is not "views" and neither is "shares": a sponsor who
          is quoted a number eventually asks to see it. */}
      <div style={{ marginTop: 24, padding: 20, border: '1px solid #222', borderRadius: 10, background: '#111' }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Reach · last 30 days</div>
        <p style={{ color: '#666', fontSize: 12, marginTop: 0, marginBottom: 14 }}>
          Every room. What we can actually witness — nothing here is a view on TikTok or X, which we cannot see at all.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12 }}>
          {([
            ['Stories sent', reach?.shared, 'Share sheet completed. Where it went is not knowable.'],
            ['Links opened', reach?.link_opened, 'Someone loaded the story page. The only count that is a stranger.'],
            ['Videos saved', reach?.downloaded, 'Render finished and handed over. The last thing we can see.'],
          ] as const).map(([label, value, note]) => (
            <div key={label} style={{ border: '1px solid #1c1c1c', borderRadius: 8, padding: 14, background: '#0d0d0d' }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#FFD60A', lineHeight: 1.1 }}>
                {value ?? '—'}
              </div>
              <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>{label}</div>
              <div style={{ color: '#666', fontSize: 11, marginTop: 4 }}>{note}</div>
            </div>
          ))}
        </div>
        {reach && reach.shared === 0 && reach.link_opened === 0 && reach.downloaded === 0 ? (
          <p style={{ color: '#666', fontSize: 12, marginTop: 12 }}>
            Nothing yet. Sends only start counting from the build that ships them.
          </p>
        ) : null}
      </div>

      {/* Manual add */}
      <div style={{ marginTop: 24, padding: 20, border: '1px solid #222', borderRadius: 10, background: '#111' }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Add / mark a team (offline close)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
          <Input placeholder='team_key e.g. NFL|Chicago|Bears' value={add.teamKey} onChange={e => setAdd({ ...add, teamKey: e.target.value })} />
          <Input placeholder='Team name e.g. Chicago Bears' value={add.teamName} onChange={e => setAdd({ ...add, teamName: e.target.value })} />
          <Input placeholder='League' value={add.league} onChange={e => setAdd({ ...add, league: e.target.value })} />
          <Input placeholder='Business name' value={add.business} onChange={e => setAdd({ ...add, business: e.target.value })} />
          <Input placeholder='Email' value={add.email} onChange={e => setAdd({ ...add, email: e.target.value })} />
          <Input placeholder='Phone' value={add.phone} onChange={e => setAdd({ ...add, phone: e.target.value })} />
          <select value={add.status} onChange={e => setAdd({ ...add, status: e.target.value as Claim['status'] })} style={{ background: '#080808', color: '#fff', border: '1px solid #222', borderRadius: 6, padding: '8px 10px' }}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <Button onClick={addManual} disabled={busy || !add.teamKey || !add.teamName} style={{ marginTop: 12 }}>Save team</Button>
        <p style={{ color: '#666', fontSize: 12, marginTop: 8 }}>team_key must match the board exactly: <code>LEAGUE|City|Name</code> (e.g. <code>NFL|Chicago|Bears</code>).</p>
      </div>

      {/* Existing claims */}
      <div style={{ marginTop: 28 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Claims ({claims.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {claims.map(c => (
            <div key={c.id} style={{ border: '1px solid #222', borderRadius: 8, padding: 14, background: '#111', display: 'grid', gridTemplateColumns: '1.4fr 2fr auto', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{c.team_name} <span style={{ color: '#666', fontWeight: 400 }}>· {c.league}</span></div>
                <div style={{ color: '#666', fontSize: 12 }}>{c.team_key}</div>
                {c.amount_paid_cents > 0 && <div style={{ color: '#7ec85f', fontSize: 12 }}>paid ${(c.amount_paid_cents / 100).toFixed(0)} · {c.plan}</div>}
                {c.monthly_cents ? (
                  <div style={{ color: '#888', fontSize: 12 }}>
                    ${(c.monthly_cents / 100).toFixed(0)}/mo
                    {/* A claimed row with no subscription id is the one shape
                        worth noticing: the money arrived but the recurring
                        half never attached, so a cancellation would never
                        find this team. */}
                    {c.square_subscription_id
                      ? ' · subscribed'
                      : c.status === 'claimed'
                        ? ' · ⚠ no subscription linked'
                        : ''}
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <Input placeholder='Business' defaultValue={c.business_name ?? ''} onBlur={e => e.target.value !== (c.business_name ?? '') && update(c.id, { business_name: e.target.value })} />
                <Input placeholder='Email' defaultValue={c.sponsor_email ?? ''} onBlur={e => e.target.value !== (c.sponsor_email ?? '') && update(c.id, { sponsor_email: e.target.value })} />
                <Input placeholder='Phone' defaultValue={c.sponsor_phone ?? ''} onBlur={e => e.target.value !== (c.sponsor_phone ?? '') && update(c.id, { sponsor_phone: e.target.value })} />
                <select value={c.status} onChange={e => update(c.id, { status: e.target.value as Claim['status'] })} style={{ background: '#080808', color: '#fff', border: '1px solid #222', borderRadius: 6, padding: '8px 10px' }}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <Button variant="ghost" onClick={() => remove(c.id)} style={{ color: '#ff6b6b' }}>Delete</Button>
            </div>
          ))}
          {claims.length === 0 && <div style={{ color: '#666' }}>No claims yet.</div>}
        </div>
      </div>
    </div>
  );
}
