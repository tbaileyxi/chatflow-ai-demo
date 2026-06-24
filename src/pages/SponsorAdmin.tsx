import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Protected seed/management path for founding sponsorships closed offline,
// and for editing the sponsor contact on any claim. Gated to admins.

interface Claim {
  id: string;
  team_key: string;
  team_name: string;
  league: string;
  status: 'open' | 'reserved' | 'claimed';
  plan: string | null;
  business_name: string | null;
  sponsor_email: string | null;
  sponsor_phone: string | null;
  amount_paid_cents: number;
  reserved_at: string | null;
  created_at: string;
}

const STATUSES: Claim['status'][] = ['open', 'reserved', 'claimed'];

export default function SponsorAdmin() {
  const { isAdmin, loading, user } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [busy, setBusy] = useState(false);
  const [add, setAdd] = useState({ teamKey: '', teamName: '', league: 'NFL', business: '', email: '', phone: '', status: 'reserved' as Claim['status'] });

  async function load() {
    const { data } = await supabase.from('sponsor_claims').select('*').order('created_at', { ascending: false });
    if (data) setClaims(data as Claim[]);
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
      status: add.status, plan: 'reserve',
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
