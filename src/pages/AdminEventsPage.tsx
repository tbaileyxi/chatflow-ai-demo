import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import shLogo from '@/assets/sh-logo-updated.png';

// ─── Types ──────────────────────────────────────────────────────────────────

interface MajorEvent {
  id: string;
  name: string;
  short_name: string | null;
  sport: string;
  league: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string;
  status: 'upcoming' | 'live' | 'ended';
  kalshi_market_ticker: string | null;
  kalshi_market_url: string | null;
  content_pulse_interval_minutes: number;
  content_daily_pull_hour: number;
  created_at: string;
}

interface ContentSource {
  id: string;
  platform: string;
  source_type: string;
  source_value: string;
  confidence: number | null;
  auto_discovered: boolean;
  active: boolean;
}

const EMPTY_FORM: Partial<MajorEvent> = {
  name: '',
  short_name: '',
  sport: 'golf',
  league: '',
  description: '',
  starts_at: '',
  ends_at: '',
  status: 'upcoming',
  kalshi_market_ticker: '',
  kalshi_market_url: '',
  content_pulse_interval_minutes: 20,
  content_daily_pull_hour: 6,
};

const SPORTS = ['golf', 'nfl', 'nba', 'mlb', 'nhl', 'soccer', 'ufc', 'other'];
const STATUS_COLORS = {
  upcoming: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  live: 'text-red-400 bg-red-400/10 border-red-400/20',
  ended: 'text-white/30 bg-white/5 border-white/10',
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminEventsPage() {
  const [events, setEvents] = useState<MajorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<MajorEvent>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<MajorEvent | null>(null);
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { loadEvents(); }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const loadEvents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('starts_at', { ascending: true });
    setEvents((data as MajorEvent[]) ?? []);
    setLoading(false);
  };

  const loadSources = async (eventId: string) => {
    const { data } = await supabase
      .from('event_content_sources')
      .select('*')
      .eq('event_id', eventId)
      .order('confidence', { ascending: false });
    setSources((data as ContentSource[]) ?? []);
  };

  const selectEvent = (event: MajorEvent) => {
    setSelectedEvent(event);
    setSources([]);
    loadSources(event.id);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.starts_at || !form.ends_at) {
      showToast('Name, start date, and end date are required.');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      short_name: form.short_name || null,
      sport: form.sport,
      league: form.league || null,
      description: form.description || null,
      starts_at: form.starts_at,
      ends_at: form.ends_at,
      status: form.status,
      kalshi_market_ticker: form.kalshi_market_ticker || null,
      kalshi_market_url: form.kalshi_market_url || null,
      content_pulse_interval_minutes: form.content_pulse_interval_minutes ?? 20,
      content_daily_pull_hour: form.content_daily_pull_hour ?? 6,
    };

    if (form.id) {
      await supabase.from('events').update(payload).eq('id', form.id);
      showToast('Event updated.');
    } else {
      await supabase.from('events').insert(payload);
      showToast('Event created!');
    }

    setSaving(false);
    setShowForm(false);
    setForm(EMPTY_FORM);
    await loadEvents();
  };

  const handleStatusChange = async (event: MajorEvent, status: MajorEvent['status']) => {
    await supabase.from('events').update({ status }).eq('id', event.id);
    showToast(`Status → ${status}`);
    await loadEvents();
    if (selectedEvent?.id === event.id) {
      setSelectedEvent({ ...selectedEvent, status });
    }
  };

  const handleDiscover = async () => {
    if (!selectedEvent) return;
    setDiscovering(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('discover-event-sources', {
        body: { event_id: selectedEvent.id },
      });
      if (res.error) throw res.error;
      showToast(`Auto-discovery done! Found ${res.data?.inserted ?? 0} new sources.`);
      await loadSources(selectedEvent.id);
    } catch (err: any) {
      showToast(`Discovery failed: ${err.message}`);
    } finally {
      setDiscovering(false);
    }
  };

  const handlePull = async () => {
    if (!selectedEvent) return;
    setPulling(true);
    try {
      const res = await supabase.functions.invoke('pull-event-content', {
        body: { event_id: selectedEvent.id },
      });
      if (res.error) throw res.error;
      showToast(`Pulled ${res.data?.inserted ?? 0} new posts.`);
    } catch (err: any) {
      showToast(`Pull failed: ${err.message}`);
    } finally {
      setPulling(false);
    }
  };

  const toggleSource = async (source: ContentSource) => {
    await supabase
      .from('event_content_sources')
      .update({ active: !source.active })
      .eq('id', source.id);
    setSources(prev => prev.map(s => s.id === source.id ? { ...s, active: !s.active } : s));
  };

  const deleteSource = async (sourceId: string) => {
    await supabase.from('event_content_sources').delete().eq('id', sourceId);
    setSources(prev => prev.filter(s => s.id !== sourceId));
  };

  const editEvent = (event: MajorEvent) => {
    setForm(event);
    setShowForm(true);
    setSelectedEvent(null);
  };

  const platformIcon = (platform: string) => platform === 'twitter' ? '𝕏' : '🔴';
  const sourceIcon = (type: string) => type === 'subreddit' ? 'r/' : type === 'account' ? '@' : '#';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#FFD700] text-black text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <img src={shLogo} alt="Side Huddle" className="h-7 w-7 rounded-full" />
          <span className="font-orbitron text-sm font-bold text-[#FFD700]">ADMIN</span>
          <span className="text-white/20 text-sm">/ Major Events</span>
        </div>
        <a href="/" className="text-xs text-white/30 hover:text-white/60 transition-colors">← Back to site</a>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Events List ── */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-orbitron text-sm font-bold text-[#FFD700] uppercase tracking-widest">Events</h2>
            <button
              onClick={() => { setForm(EMPTY_FORM); setShowForm(true); setSelectedEvent(null); }}
              className="text-xs bg-[#FFD700] text-black font-bold px-3 py-1.5 rounded-lg hover:bg-yellow-300 transition-colors"
            >
              + New
            </button>
          </div>

          {loading ? (
            <div className="text-white/30 text-sm text-center py-8">Loading...</div>
          ) : events.length === 0 ? (
            <div className="text-white/20 text-sm text-center py-12 border border-dashed border-white/10 rounded-xl">
              No events yet.<br />Create your first one.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {events.map(event => (
                <div
                  key={event.id}
                  onClick={() => selectEvent(event)}
                  className={`rounded-xl border p-4 cursor-pointer transition-all ${
                    selectedEvent?.id === event.id
                      ? 'border-[#FFD700]/40 bg-[#FFD700]/5'
                      : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-semibold text-sm text-white leading-tight">{event.name}</span>
                    <span className={`flex-shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_COLORS[event.status]}`}>
                      {event.status}
                    </span>
                  </div>
                  <div className="text-xs text-white/40">
                    {event.sport.toUpperCase()} · {new Date(event.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Detail / Form ── */}
        <div className="lg:col-span-2">

          {/* Create / Edit Form */}
          {showForm && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <h3 className="font-orbitron text-sm font-bold text-[#FFD700] uppercase tracking-widest mb-5">
                {form.id ? 'Edit Event' : 'New Event'}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Event Name *">
                  <input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="The Masters 2026" className={inputCls} />
                </Field>
                <Field label="Short Name">
                  <input value={form.short_name ?? ''} onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))}
                    placeholder="The Masters" className={inputCls} />
                </Field>
                <Field label="Sport *">
                  <select value={form.sport ?? 'golf'} onChange={e => setForm(f => ({ ...f, sport: e.target.value }))}
                    className={inputCls}>
                    {SPORTS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                  </select>
                </Field>
                <Field label="League / Tour">
                  <input value={form.league ?? ''} onChange={e => setForm(f => ({ ...f, league: e.target.value }))}
                    placeholder="PGA Tour" className={inputCls} />
                </Field>
                <Field label="Starts *">
                  <input type="datetime-local" value={form.starts_at ? form.starts_at.slice(0, 16) : ''}
                    onChange={e => setForm(f => ({ ...f, starts_at: new Date(e.target.value).toISOString() }))}
                    className={inputCls} />
                </Field>
                <Field label="Ends *">
                  <input type="datetime-local" value={form.ends_at ? form.ends_at.slice(0, 16) : ''}
                    onChange={e => setForm(f => ({ ...f, ends_at: new Date(e.target.value).toISOString() }))}
                    className={inputCls} />
                </Field>
                <Field label="Kalshi Ticker" hint="e.g. MASTERS-2026-WINNER">
                  <input value={form.kalshi_market_ticker ?? ''} onChange={e => setForm(f => ({ ...f, kalshi_market_ticker: e.target.value }))}
                    placeholder="MASTERS-2026-WINNER" className={inputCls} />
                </Field>
                <Field label="Kalshi URL">
                  <input value={form.kalshi_market_url ?? ''} onChange={e => setForm(f => ({ ...f, kalshi_market_url: e.target.value }))}
                    placeholder="https://kalshi.com/markets/..." className={inputCls} />
                </Field>
                <Field label="Live Pulse Interval (min)">
                  <input type="number" value={form.content_pulse_interval_minutes ?? 20}
                    onChange={e => setForm(f => ({ ...f, content_pulse_interval_minutes: parseInt(e.target.value) }))}
                    className={inputCls} />
                </Field>
                <Field label="Daily Pull Hour (UTC)">
                  <input type="number" min={0} max={23} value={form.content_daily_pull_hour ?? 6}
                    onChange={e => setForm(f => ({ ...f, content_daily_pull_hour: parseInt(e.target.value) }))}
                    className={inputCls} />
                </Field>
              </div>

              <Field label="Description" className="mt-4">
                <textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} placeholder="One or two sentences shown to users on the opt-in card."
                  className={`${inputCls} resize-none`} />
              </Field>

              <div className="flex gap-3 mt-6">
                <button onClick={handleSave} disabled={saving}
                  className="bg-[#FFD700] text-black font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-yellow-300 transition-colors disabled:opacity-50">
                  {saving ? 'Saving…' : form.id ? 'Update Event' : 'Create Event'}
                </button>
                <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                  className="text-sm text-white/40 border border-white/10 px-4 py-2.5 rounded-xl hover:text-white/60 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Event Detail */}
          {selectedEvent && !showForm && (
            <div className="flex flex-col gap-5">
              {/* Header */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="font-orbitron text-xl font-bold text-white mb-1">{selectedEvent.name}</h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_COLORS[selectedEvent.status]}`}>
                        {selectedEvent.status}
                      </span>
                      <span className="text-xs text-white/40">{selectedEvent.sport.toUpperCase()}</span>
                      {selectedEvent.league && <span className="text-xs text-white/40">· {selectedEvent.league}</span>}
                    </div>
                  </div>
                  <button onClick={() => editEvent(selectedEvent)}
                    className="text-xs border border-white/10 text-white/50 px-3 py-1.5 rounded-lg hover:text-white/80 transition-colors">
                    Edit
                  </button>
                </div>

                {selectedEvent.description && (
                  <p className="text-sm text-white/50 mb-4">{selectedEvent.description}</p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-5">
                  <Stat label="Starts" value={new Date(selectedEvent.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                  <Stat label="Ends" value={new Date(selectedEvent.ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                  <Stat label="Pulse" value={`${selectedEvent.content_pulse_interval_minutes}min`} />
                  <Stat label="Daily Pull" value={`${selectedEvent.content_daily_pull_hour}:00 UTC`} />
                </div>

                {selectedEvent.kalshi_market_ticker && (
                  <div className="flex items-center gap-2 mb-5 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <span className="text-emerald-400 text-xs font-bold">Kalshi</span>
                    <span className="text-emerald-300/70 text-xs font-mono">{selectedEvent.kalshi_market_ticker}</span>
                    {selectedEvent.kalshi_market_url && (
                      <a href={selectedEvent.kalshi_market_url} target="_blank" rel="noopener noreferrer"
                        className="text-emerald-400/60 text-xs hover:text-emerald-400 ml-auto transition-colors">
                        View market ↗
                      </a>
                    )}
                  </div>
                )}

                {/* Status controls */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/30 mr-1">Set status:</span>
                  {(['upcoming', 'live', 'ended'] as const).map(s => (
                    <button key={s}
                      onClick={() => handleStatusChange(selectedEvent, s)}
                      disabled={selectedEvent.status === s}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                        selectedEvent.status === s
                          ? 'border-[#FFD700]/40 bg-[#FFD700]/10 text-[#FFD700] cursor-default'
                          : 'border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Sources */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-orbitron text-sm font-bold text-[#FFD700] uppercase tracking-widest">
                      Content Sources
                    </h3>
                    <p className="text-xs text-white/30 mt-0.5">
                      {sources.filter(s => s.active).length} active / {sources.length} total
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleDiscover} disabled={discovering}
                      className="text-xs bg-[#FFD700]/10 border border-[#FFD700]/20 text-[#FFD700] font-semibold px-4 py-2 rounded-lg hover:bg-[#FFD700]/20 transition-colors disabled:opacity-50">
                      {discovering ? 'Discovering…' : '✦ Auto-Discover'}
                    </button>
                    <button onClick={handlePull} disabled={pulling}
                      className="text-xs bg-white/5 border border-white/10 text-white/60 font-semibold px-4 py-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50">
                      {pulling ? 'Pulling…' : '↓ Pull Content'}
                    </button>
                  </div>
                </div>

                {sources.length === 0 ? (
                  <div className="text-center py-8 text-white/20 text-sm">
                    No sources yet. Hit <span className="text-[#FFD700]/60">Auto-Discover</span> to let AI find the best X accounts, hashtags, and subreddits.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {sources.map(source => (
                      <div key={source.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        source.active ? 'border-white/8 bg-white/[0.02]' : 'border-white/4 bg-transparent opacity-40'
                      }`}>
                        <span className="text-base">{platformIcon(source.platform)}</span>
                        <span className="text-xs text-white/40 font-mono w-6">{sourceIcon(source.source_type)}</span>
                        <span className="flex-1 text-sm text-white/80 font-mono truncate">{source.source_value}</span>
                        {source.confidence != null && (
                          <span className="text-xs text-[#FFD700]/60 w-10 text-right">
                            {Math.round(source.confidence * 100)}%
                          </span>
                        )}
                        {source.auto_discovered && (
                          <span className="text-[10px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded">AI</span>
                        )}
                        {/* Toggle */}
                        <button onClick={() => toggleSource(source)}
                          className={`w-8 h-4 rounded-full border transition-colors ${
                            source.active ? 'bg-[#FFD700]/20 border-[#FFD700]/40' : 'bg-white/5 border-white/10'
                          }`}>
                          <div className={`w-3 h-3 rounded-full mx-auto transition-all ${
                            source.active ? 'bg-[#FFD700]' : 'bg-white/20'
                          }`} />
                        </button>
                        <button onClick={() => deleteSource(source.id)}
                          className="text-white/20 hover:text-red-400 text-xs transition-colors px-1">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!showForm && !selectedEvent && (
            <div className="h-64 flex items-center justify-center text-white/20 text-sm border border-dashed border-white/5 rounded-2xl">
              Select an event or create a new one
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#FFD700]/40 transition-colors';

function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs text-white/40 mb-1.5">
        {label} {hint && <span className="text-white/20 font-normal">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5">
      <div className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}
