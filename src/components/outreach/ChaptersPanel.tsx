import { useEffect, useMemo, useState } from "react";
import { Download, Mail, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ChapterStatus = "new" | "queued" | "sent" | "replied" | "onboarded" | "dead";

const STATUS_OPTIONS: ChapterStatus[] = [
  "new", "queued", "sent", "replied", "onboarded", "dead",
];

type Chapter = {
  id: string;
  source: string;
  org: string;
  org_type: string;
  chapter_name: string;
  city: string | null;
  state: string | null;
  venue: string | null;
  leader_name: string | null;
  first_name: string | null;
  email: string | null;
  phone: string | null;
  facebook: string | null;
  member_count: number | null;
  contact_channel: string;
  score: number;
  status: ChapterStatus;
  emailed: boolean;
  sequence_step: number;
  bounced: boolean;
  unsubscribed: boolean;
  last_touch: string | null;
  /** The six characters a president types to claim their room. */
  claim_code: string | null;
};

type SendResult = {
  step: number;
  mode: string;
  eligible: number;
  sent: number;
  errors: Array<{ chapter: string; error: string }>;
  previews: Array<{ chapter: string; to: string; subject: string; text?: string }>;
};

// "sent" is three different facts wearing one label.
//
// A chapter that got the intro and one that has had all three emails both read
// as "sent", so the only way to know which was which was to remember the order
// the batches went out in. sequence_step has carried the answer all along; it
// was simply never shown.
function statusBadge(status: ChapterStatus, step?: number) {
  const tone: Record<ChapterStatus, string> = {
    new: "bg-muted text-muted-foreground",
    queued: "bg-blue-500/15 text-blue-600",
    sent: "bg-amber-500/15 text-amber-600",
    replied: "bg-emerald-500/15 text-emerald-600",
    onboarded: "bg-emerald-600 text-white",
    dead: "bg-destructive/15 text-destructive",
  };
  // Only "sent" gains the step. A replied or onboarded chapter is past the
  // sequence, and which email finally landed is no longer the useful fact.
  const label =
    status === "sent" && step && step >= 1 ? `sent · email ${step}` : status;
  return <Badge className={`${tone[status] ?? tone.new} border-0`}>{label}</Badge>;
}

function scoreBadge(score: number) {
  if (score >= 80) return <Badge className="border-0 bg-emerald-500/15 text-emerald-600">{score}</Badge>;
  if (score >= 50) return <Badge className="border-0 bg-amber-500/15 text-amber-600">{score}</Badge>;
  return <Badge variant="outline">{score}</Badge>;
}

/**
 * Pull the real message out of a failed `functions.invoke`.
 *
 * supabase-js turns any non-2xx into a FunctionsHttpError whose `message` is
 * the useless string "Edge Function returned a non-2xx status code" — the JSON
 * body the function actually returned is left on `error.context`, unread. Every
 * reason chapter-send can refuse a send ("BREVO_API_KEY not configured",
 * "Admin access required. Current role: user", a Brevo 401 with the provider's
 * own text) lives in that body, so without this the operator is told only that
 * something went wrong.
 */
async function invokeError(e: unknown): Promise<string> {
  const ctx = (e as { context?: unknown })?.context;
  if (ctx instanceof Response) {
    try {
      const body = await ctx.clone().json();
      if (body?.error) return `${body.error} (HTTP ${ctx.status})`;
    } catch {
      try {
        const text = (await ctx.clone().text()).trim();
        if (text) return `${text.slice(0, 300)} (HTTP ${ctx.status})`;
      } catch { /* body already consumed — fall through to the generic message */ }
    }
    return `HTTP ${ctx.status} from chapter-send`;
  }
  return e instanceof Error ? e.message : String(e);
}

export default function ChaptersPanel() {
  const { toast } = useToast();

  const [rows, setRows] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [org, setOrg] = useState("");
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [live, setLive] = useState(false);
  const [maxEmails, setMaxEmails] = useState("25");
  const [testTo, setTestTo] = useState('');
  const [sending, setSending] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<SendResult | null>(null);

  async function load() {
    setLoading(true);
    try {
      // 1,300+ rows sit above PostgREST's default page size, so page through.
      const page = 1000;
      let from = 0;
      const all: Chapter[] = [];
      for (;;) {
        const { data, error } = await supabase
          .from("chapter_leads")
          .select(
            "id,source,org,org_type,chapter_name,city,state,venue,leader_name,first_name,email,phone,facebook,member_count,contact_channel,score,status,emailed,sequence_step,bounced,unsubscribed,last_touch,claim_code",
          )
          .order("score", { ascending: false })
          .range(from, from + page - 1);
        if (error) throw error;
        all.push(...((data || []) as Chapter[]));
        if (!data || data.length < page) break;
        from += page;
      }
      setRows(all);
    } catch (e) {
      toast({
        title: "Could not load chapters",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orgs = useMemo(
    () => Array.from(new Set(rows.map((r) => r.org))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (org && r.org !== org) return false;
      if (channel && r.contact_channel !== channel) return false;
      if (status && r.status !== status) return false;
      if (!q) return true;
      return [r.chapter_name, r.leader_name, r.city, r.state, r.venue, r.email]
        .some((v) => v && v.toLowerCase().includes(q));
    });
  }, [rows, search, org, channel, status]);

  const metrics = useMemo(() => ({
    total: rows.length,
    withEmail: rows.filter((r) => r.contact_channel === "email").length,
    contacted: rows.filter((r) => r.emailed).length,
    replied: rows.filter((r) => r.status === "replied" || r.status === "onboarded").length,
  }), [rows]);

  const selectedEmailable = useMemo(
    () => filtered.filter(
      (r) => selected.has(r.id) && r.contact_channel === "email" && !r.bounced && !r.unsubscribed,
    ),
    [filtered, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    const visible = filtered.map((r) => r.id);
    const allOn = visible.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  async function updateStatus(row: Chapter, next: ChapterStatus) {
    const previous = row.status;
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
    const { error } = await supabase
      .from("chapter_leads")
      .update({ status: next, last_touch: new Date().toISOString().slice(0, 10) })
      .eq("id", row.id);
    if (error) {
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status: previous } : r)));
      toast({ title: "Status not saved", description: error.message, variant: "destructive" });
    }
  }

  // Fires chapter-send in "self" mode: real HTML, real delivery, and it reads
  // and writes nothing in chapter_leads. Negative `sending` values keep this
  // spinner distinct from the step buttons above.
  async function runSelfTest(step: number) {
    setSending(-step);
    try {
      const { data, error } = await supabase.functions.invoke("chapter-send", {
        body: { mode: "self", testTo, sequenceStep: step },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: `Step ${step} sent to you`,
        description: `${data.subject} — no lead was touched.`,
      });
    } catch (e) {
      toast({
        title: "Test send failed",
        description: await invokeError(e),
        variant: "destructive",
      });
    } finally {
      setSending(null);
    }
  }

  async function runSend(step: number) {
    const useSelection = selectedEmailable.length > 0;
    if (live) {
      const target = useSelection
        ? `${selectedEmailable.length} selected chapter(s)`
        : `up to ${maxEmails} chapters eligible for step ${step}`;
      if (!window.confirm(`Send step ${step} for real to ${target}?`)) return;
    }
    setSending(step);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("chapter-send", {
        body: {
          sequenceStep: step,
          mode: live ? "live" : "test",
          maxEmails: Number(maxEmails) || 25,
          org: org || null,
          ids: useSelection ? selectedEmailable.map((r) => r.id) : null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLastResult(data as SendResult);
      toast({
        title: live ? `Step ${step} sent` : `Step ${step} preview`,
        description: live
          ? `${data.sent} sent · ${data.errors.length} errors`
          : `${data.sent === 0 ? data.previews.length : data.sent} would send. Nothing sent in test mode.`,
      });
      if (live) await load();
    } catch (e) {
      toast({
        title: "Send failed",
        description: await invokeError(e),
        variant: "destructive",
      });
    } finally {
      setSending(null);
    }
  }

  function downloadCsv() {
    const cols = [
      "first_name", "chapter_name", "org", "city", "state", "venue",
      "email", "facebook", "contact_channel", "score", "status", "claim_code",
    ] as const;
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      cols.join(","),
      ...filtered.map((r) => cols.map((c) => esc((r as Record<string, unknown>)[c])).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `chapters-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="container mx-auto grid gap-6 px-4 py-8 xl:grid-cols-[390px,1fr]">
      <div className="space-y-6">
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-lg font-semibold">Send sequence</h2>
            <p className="text-sm text-muted-foreground">
              Step 1 goes to chapters never emailed. Steps 2 and 3 follow up on the
              previous step. Select rows to override and send to exactly those.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label className="text-sm font-medium">Live send</Label>
              <p className="text-xs text-muted-foreground">
                {live ? "Emails will actually be sent." : "Test mode — preview only."}
              </p>
            </div>
            <Switch checked={live} onCheckedChange={setLive} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Max emails per run</Label>
            <Input value={maxEmails} onChange={(e) => setMaxEmails(e.target.value)} />
          </div>

          {selectedEmailable.length > 0 && (
            <p className="rounded-md bg-muted p-2 text-xs">
              {selectedEmailable.length} selected — the step filter is ignored and these
              are sent instead.
            </p>
          )}

          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((step) => (
              <Button
                key={step}
                variant={step === 1 ? "default" : "outline"}
                onClick={() => runSend(step)}
                disabled={sending !== null}
              >
                <Mail className="mr-1 h-4 w-4" />
                {sending === step ? "..." : `Step ${step}`}
              </Button>
            ))}
          </div>

          {/* Send the real HTML to yourself.
              "Test" mode above only shows stripped text, which cannot tell you
              whether the gold survives Gmail or how the subject reads in a list
              of forty others. This sends the genuine article, and touches no
              chapter_leads row — nothing is marked emailed, no lead consumed. */}
          <div className="mt-4 space-y-2 rounded-md border border-dashed p-3">
            <p className="text-xs font-medium">Send the real email to yourself</p>
            <input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            />
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((step) => (
                <Button
                  key={step}
                  variant="secondary"
                  size="sm"
                  onClick={() => runSelfTest(step)}
                  disabled={sending !== null || !testTo.includes("@")}
                >
                  {sending === -step ? "..." : `Email me ${step}`}
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Uses a sample chapter (Sarasota Browns Backers · The Greenlight Bar · 140
              members) so every merge field is filled in. No lead is touched.
            </p>
          </div>
        </Card>

        {lastResult && (
          <Card className="space-y-2 p-5 text-sm">
            <h3 className="font-semibold">Step {lastResult.step} · {lastResult.mode}</h3>
            <p>
              {lastResult.mode === "live" ? "Sent" : "Would send"}:{" "}
              <strong>{lastResult.mode === "live" ? lastResult.sent : lastResult.previews.length}</strong>{" "}
              / {lastResult.eligible} eligible
            </p>
            {lastResult.errors.length > 0 && (
              <p className="text-destructive">Errors: {lastResult.errors.length}</p>
            )}
            {lastResult.previews.length > 0 && (
              <details>
                <summary className="cursor-pointer text-muted-foreground">
                  Preview emails ({lastResult.previews.length}) — full text as the recipient sees it
                </summary>
                <ul className="mt-2 space-y-3">
                  {lastResult.previews.map((p, i) => (
                    <li key={i} className="rounded border border-border p-3 text-xs">
                      <div className="font-medium">{p.chapter}</div>
                      <div className="text-muted-foreground">To: {p.to}</div>
                      <div className="text-muted-foreground">Subject: {p.subject}</div>
                      {p.text && (
                        <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap border-t border-border pt-2 font-sans leading-relaxed">
                          {p.text}
                        </pre>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Card>
        )}

        <Card className="space-y-2 p-5 text-sm">
          <h3 className="font-semibold">Pipeline</h3>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Chapters" value={metrics.total} />
            <Metric label="Emailable" value={metrics.withEmail} />
            <Metric label="Contacted" value={metrics.contacted} />
            <Metric label="Replied" value={metrics.replied} />
          </div>
        </Card>
      </div>

      <div className="min-w-0">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="w-56 pl-8"
                placeholder="Chapter, leader, city, bar…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="h-10 rounded-md border border-input bg-background px-2 text-sm"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
            >
              <option value="">All orgs</option>
              {orgs.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-2 text-sm"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="">All channels</option>
              <option value="email">Email</option>
              <option value="facebook">Facebook</option>
              <option value="phone">Phone</option>
              <option value="none">No contact</option>
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={downloadCsv} disabled={!filtered.length}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </div>
        </div>

        <p className="mb-2 text-xs text-muted-foreground">
          {filtered.length} shown of {rows.length}
          {selected.size > 0 && ` · ${selected.size} selected`}
        </p>

        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filtered.length > 0 && filtered.every((r) => selected.has(r.id))}
                    onCheckedChange={toggleAllVisible}
                    aria-label="Select all visible"
                  />
                </TableHead>
                <TableHead className="w-14">Pts</TableHead>
                <TableHead>Chapter</TableHead>
                <TableHead>Leader</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="w-20">Members</TableHead>
                <TableHead className="w-36">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 300).map((r) => (
                <TableRow key={r.id} className={selected.has(r.id) ? "bg-muted/40" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={() => toggle(r.id)}
                      aria-label={`Select ${r.chapter_name}`}
                    />
                  </TableCell>
                  <TableCell>{scoreBadge(r.score)}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{r.chapter_name}</div>
                    <div className="text-xs text-muted-foreground">{r.org}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.leader_name || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.email ? (
                      <a className="text-primary hover:underline" href={`mailto:${r.email}`}>{r.email}</a>
                    ) : r.facebook ? (
                      <a className="text-primary hover:underline" href={r.facebook} target="_blank" rel="noreferrer">
                        Facebook
                      </a>
                    ) : (
                      <span className="text-muted-foreground">{r.phone || "—"}</span>
                    )}
                    {r.bounced && <Badge className="ml-1 border-0 bg-destructive/15 text-destructive">bounced</Badge>}
                    {r.unsubscribed && <Badge className="ml-1 border-0 bg-destructive/15 text-destructive">unsub</Badge>}
                  </TableCell>
                  <TableCell>
                    {r.claim_code ? (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(r.claim_code!);
                          toast({ title: `Copied ${r.claim_code}` });
                        }}
                        className="rounded border border-border px-2 py-0.5 font-mono text-xs tracking-widest hover:bg-muted"
                        title="Copy this chapter's claim code"
                      >
                        {r.claim_code}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.venue || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm">
                    {[r.city, r.state].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">{r.member_count ?? ""}</TableCell>
                  <TableCell>
                    <div className="mb-2">{statusBadge(r.status, r.sequence_step)}</div>
                    {/* When, not just whether. Nothing in chapter-send enforces a
                        gap between steps, so this is the only thing standing
                        between a considered follow-up and two emails in a day. */}
                    {r.last_touch && (
                      <div className="mb-2 text-xs text-muted-foreground tabular-nums">
                        {r.last_touch}
                      </div>
                    )}
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={r.status}
                      onChange={(e) => updateStatus(r, e.target.value as ChapterStatus)}
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length > 300 && (
            <p className="p-3 text-xs text-muted-foreground">
              Showing the top 300 by score. Narrow the filters to see the rest.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
