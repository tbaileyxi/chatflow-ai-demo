import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Lead = {
  id: string;
  company: string;
  vertical: string;
  region: string | null;
  website: string | null;
  phone: string | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  instagram_handle: string | null;
  email_confidence: string | null;
  priority: string | null;
  emailed: boolean;
  sequence_step: number;
  bounced: boolean;
  unsubscribed: boolean;
};

type SendResult = {
  step: number;
  mode: string;
  sent: number;
  eligible: number;
  skipped_duplicate: number;
  errors: string[];
  previews: Array<{ to: string; company: string; subject: string }>;
};

function priorityBadge(p: string | null) {
  if (p === "TIER1") return <Badge className="bg-emerald-600/80">TIER1</Badge>;
  if (p === "TIER2") return <Badge variant="secondary">TIER2</Badge>;
  return <span className="text-muted-foreground">—</span>;
}

export default function Outreach() {
  const { isAdmin, loading: authLoading, user } = useAuth();
  const { toast } = useToast();

  const [vertical, setVertical] = useState("");
  const [company, setCompany] = useState("");
  const [region, setRegion] = useState("");
  const [maxResults, setMaxResults] = useState("25");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [sending, setSending] = useState<number | null>(null);

  const [live, setLive] = useState(false);
  const [maxEmails, setMaxEmails] = useState("40");
  const [lastResult, setLastResult] = useState<SendResult | null>(null);
  const [tab, setTab] = useState<"prospects" | "contacted">("prospects");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (error) throw error;
      // useAuth's onAuthStateChange picks up the session and role automatically.
    } catch (err) {
      toast({
        title: "Login failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setLoggingIn(false);
    }
  }

  async function loadLeads() {
    const { data, error } = await supabase
      .from("sponsor_leads")
      .select(
        "id,company,vertical,region,website,phone,contact_name,contact_title,contact_email,instagram_handle,email_confidence,priority,emailed,sequence_step,bounced,unsubscribed",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) {
      toast({ title: "Failed to load leads", description: error.message, variant: "destructive" });
      return;
    }
    setLeads((data || []) as Lead[]);
  }

  useEffect(() => {
    if (isAdmin) void loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm space-y-4 p-6">
          <div>
            <h1 className="text-xl font-bold">Sponsor Outreach</h1>
            <p className="text-sm text-muted-foreground">Sign in with your admin account.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="loginEmail">Email</Label>
              <Input
                id="loginEmail"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loginPassword">Password</Label>
              <Input
                id="loginPassword"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loggingIn}>
              {loggingIn ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>This account isn’t an admin.</p>
        <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>
          Sign out
        </Button>
      </div>
    );
  }

  async function runEnrich() {
    if (!vertical.trim() && !company.trim()) {
      toast({ title: "Enter a vertical or a company", variant: "destructive" });
      return;
    }
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke("outreach-enrich", {
        body: { vertical, company, region, maxResults: Number(maxResults) || 25 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Prospects enriched",
        description: `${data.found} found · ${data.stored} new · ${data.withEmail} with email`,
      });
      await loadLeads();
    } catch (e) {
      toast({
        title: "Enrichment failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setEnriching(false);
    }
  }

  async function runSend(step: number) {
    setSending(step);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("outreach-send", {
        body: { sequenceStep: step, mode: live ? "live" : "test", maxEmails: Number(maxEmails) || 40 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLastResult(data as SendResult);
      toast({
        title: live ? `Step ${step} sent` : `Step ${step} preview`,
        description: live
          ? `${data.sent} sent · ${data.skipped_duplicate} dup-skipped · ${data.errors.length} errors`
          : `${data.sent} would send (test mode — nothing sent)`,
      });
      if (live) await loadLeads();
    } catch (e) {
      toast({
        title: "Send failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSending(null);
    }
  }

  function dmText(l: Lead) {
    return `Hey ${l.company}! I run partnerships at Side Huddle Sports — AI-enhanced fan group chats where fans pack into live rooms every game day. We're signing one exclusive sponsor per team before launch ($2k for 3 teams all season). Want me to send the details?`;
  }

  async function copyDm(l: Lead) {
    try {
      await navigator.clipboard.writeText(dmText(l));
      toast({ title: "DM copied", description: l.instagram_handle ? `Paste into ${l.instagram_handle}` : l.company });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }

  async function deleteLead(l: Lead) {
    const { error } = await supabase.from("sponsor_leads").delete().eq("id", l.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setLeads((prev) => prev.filter((x) => x.id !== l.id));
    toast({ title: "Removed", description: l.company });
  }

  function downloadCsv() {
    const cols = [
      "company", "vertical", "region", "contact_name",
      "contact_title", "contact_email", "instagram_handle", "email_confidence",
      "priority", "emailed", "sequence_step",
    ] as const;
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = leads.map((l) => cols.map((c) => esc((l as Record<string, unknown>)[c])).join(","));
    const csv = [cols.join(","), ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `sponsor-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const prospects = leads.filter((l) => !l.emailed);
  const contacted = leads.filter((l) => l.emailed);
  const shown = tab === "contacted" ? contacted : prospects;
  const withEmail = prospects.filter((l) => l.contact_email).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-foreground">Sponsor Outreach</h1>
          <p className="font-mono text-sm text-muted-foreground">
            Apollo enrichment → Brevo sequence · sends from ty@sidehuddlesports.com
          </p>
        </div>
      </div>

      <div className="container mx-auto grid gap-6 px-4 py-8 lg:grid-cols-[380px,1fr]">
        {/* Left: controls */}
        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <h2 className="text-lg font-semibold">1 · Find prospects</h2>
            <div className="space-y-1.5">
              <Label htmlFor="vertical">Vertical / category</Label>
              <Input
                id="vertical"
                value={vertical}
                onChange={(e) => setVertical(e.target.value)}
                placeholder="e.g. restaurants, auto dealers, banks"
              />
              <p className="text-xs text-muted-foreground">Finds many companies in this category.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company">Company name (optional)</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Bojangles"
              />
              <p className="text-xs text-muted-foreground">Target one specific brand. Overrides the vertical.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="region">Region (optional)</Label>
              <Input
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Chicago, IL"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max">Max results</Label>
              <Input
                id="max"
                type="number"
                min={1}
                max={60}
                value={maxResults}
                onChange={(e) => setMaxResults(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={runEnrich} disabled={enriching}>
              {enriching ? "Searching Apollo…" : "Run enrichment"}
            </Button>
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="text-lg font-semibold">2 · Send sequence</h2>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <Label htmlFor="live" className="cursor-pointer">
                  {live ? "Live send" : "Test mode"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {live ? "Emails will actually send." : "Preview only — nothing sends."}
                </p>
              </div>
              <Switch id="live" checked={live} onCheckedChange={setLive} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxEmails">Max emails this run</Label>
              <Input
                id="maxEmails"
                type="number"
                min={1}
                max={200}
                value={maxEmails}
                onChange={(e) => setMaxEmails(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((step) => (
                <Button
                  key={step}
                  variant={step === 1 ? "default" : "outline"}
                  onClick={() => runSend(step)}
                  disabled={sending !== null}
                >
                  {sending === step ? "…" : `Step ${step}`}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Step 1 = intro · Step 2 = follow-up · Step 3 = breakup. Steps 2/3 only target rows that
              already received the prior step.
            </p>
          </Card>

          {lastResult && (
            <Card className="space-y-2 p-5 text-sm">
              <h3 className="font-semibold">
                Step {lastResult.step} · {lastResult.mode}
              </h3>
              <p>
                {lastResult.mode === "live" ? "Sent" : "Would send"}:{" "}
                <strong>{lastResult.sent}</strong> / {lastResult.eligible} eligible
              </p>
              {lastResult.skipped_duplicate > 0 && (
                <p className="text-muted-foreground">
                  Skipped (domain already contacted): {lastResult.skipped_duplicate}
                </p>
              )}
              {lastResult.errors.length > 0 && (
                <div className="text-destructive">
                  <p>Errors: {lastResult.errors.length}</p>
                  <ul className="list-disc pl-5">
                    {lastResult.errors.slice(0, 5).map((er, i) => (
                      <li key={i} className="break-all">{er}</li>
                    ))}
                  </ul>
                </div>
              )}
              {lastResult.previews.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-muted-foreground">
                    Preview recipients ({lastResult.previews.length})
                  </summary>
                  <ul className="mt-1 space-y-1">
                    {lastResult.previews.map((p, i) => (
                      <li key={i} className="text-xs">
                        <span className="text-foreground">{p.company}</span> · {p.to}
                        <br />
                        <span className="text-muted-foreground">{p.subject}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          )}
        </div>

        {/* Right: leads table */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex gap-2">
              <Button
                variant={tab === "prospects" ? "default" : "outline"}
                size="sm"
                onClick={() => setTab("prospects")}
              >
                Prospects ({prospects.length})
              </Button>
              <Button
                variant={tab === "contacted" ? "default" : "outline"}
                size="sm"
                onClick={() => setTab("contacted")}
              >
                Contacted ({contacted.length})
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadCsv} disabled={leads.length === 0}>
                Download CSV
              </Button>
              <Button variant="ghost" size="sm" onClick={loadLeads}>
                Refresh
              </Button>
            </div>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">
            {tab === "prospects"
              ? `${prospects.length} prospects · ${withEmail} with email`
              : `${contacted.length} contacted`}
          </p>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Instagram</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Step</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      {tab === "prospects"
                        ? "No prospects yet. Run enrichment to populate."
                        : "Nothing contacted yet."}
                    </TableCell>
                  </TableRow>
                )}
                {shown.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium">{l.company}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.vertical}
                        {l.region ? ` · ${l.region}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{l.contact_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{l.contact_title || ""}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {l.contact_email || <span className="text-muted-foreground">not found</span>}
                      {l.bounced && <span className="ml-1 text-destructive">(bounced)</span>}
                      {l.unsubscribed && <span className="ml-1 text-destructive">(unsub)</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {l.instagram_handle ? (
                        <a
                          href={`https://instagram.com/${l.instagram_handle.replace(/^@/, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sky-400 hover:underline"
                        >
                          {l.instagram_handle}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>{priorityBadge(l.priority)}</TableCell>
                    <TableCell>
                      {l.emailed ? (
                        <Badge variant="outline">{l.sequence_step}/3</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => copyDm(l)}>
                          Copy DM
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteLead(l)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
}
