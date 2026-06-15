import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
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
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
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
  const [region, setRegion] = useState("");
  const [maxResults, setMaxResults] = useState("25");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [sending, setSending] = useState<number | null>(null);

  const [live, setLive] = useState(false);
  const [maxEmails, setMaxEmails] = useState("40");
  const [lastResult, setLastResult] = useState<SendResult | null>(null);

  async function loadLeads() {
    const { data, error } = await supabase
      .from("sponsor_leads")
      .select(
        "id,company,vertical,region,contact_name,contact_title,contact_email,email_confidence,priority,emailed,sequence_step,bounced,unsubscribed",
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
  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Admin access required.
      </div>
    );
  }

  async function runEnrich() {
    if (!vertical.trim()) {
      toast({ title: "Enter a vertical", variant: "destructive" });
      return;
    }
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke("outreach-enrich", {
        body: { vertical, region, maxResults: Number(maxResults) || 25 },
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

  const withEmail = leads.filter((l) => l.contact_email).length;
  const emailed = leads.filter((l) => l.emailed).length;

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
              <Label htmlFor="vertical">Vertical</Label>
              <Input
                id="vertical"
                value={vertical}
                onChange={(e) => setVertical(e.target.value)}
                placeholder="e.g. QSR, auto dealers, regional banks"
              />
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
            <p className="text-sm text-muted-foreground">
              {leads.length} leads · {withEmail} with email · {emailed} contacted
            </p>
            <Button variant="ghost" size="sm" onClick={loadLeads}>
              Refresh
            </Button>
          </div>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Step</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No leads yet. Run enrichment to populate.
                    </TableCell>
                  </TableRow>
                )}
                {leads.map((l) => (
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
                    <TableCell>{priorityBadge(l.priority)}</TableCell>
                    <TableCell>
                      {l.emailed ? (
                        <Badge variant="outline">{l.sequence_step}/3</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
