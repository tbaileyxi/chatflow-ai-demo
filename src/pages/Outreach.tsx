import { useEffect, useMemo, useState } from "react";
import { Download, Mail, MapPin, RefreshCw, Search, Trash2, Copy, AtSign } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import CreatorsPanel from "@/components/outreach/CreatorsPanel";
import BrevoImport from "@/components/outreach/BrevoImport";
import WorkPanel from "@/components/outreach/WorkPanel";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

type LeadStatus = "New" | "Drafted" | "Sent" | "Follow-up" | "Replied" | "Won" | "Lost";

type Lead = {
  id: string;
  created_at?: string;
  company: string;
  vertical: string;
  region: string | null;
  market: string | null;
  school: string | null;
  website: string | null;
  domain: string | null;
  phone: string | null;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  instagram_handle: string | null;
  email_confidence: string | null;
  priority: string | null;
  sponsor_signal: string | null;
  sponsor_score: number | null;
  best_package: string | null;
  best_angle: string | null;
  status: LeadStatus | null;
  follow_up_date: string | null;
  last_touch: string | null;
  notes: string | null;
  emailed: boolean;
  sequence_step: number;
  bounced: boolean;
  unsubscribed: boolean;
};

type SendResult = {
  step: number;
  mode: string;
  campaign: string;
  sent: number;
  eligible: number;
  skipped_duplicate: number;
  errors: string[];
  previews: Array<{ to: string; company: string; subject: string; text?: string }>;
};

type Campaign =
  | string // "vertical:<name>" — the audience you are writing to
  | "school_partner_batch_4"
  | "school_partner_batch_3"
  | "school_partner_batch_2"
  | "school_partner"
  | "all";

type SchoolPartnerProspect = {
  school: string;
  organization: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string | null;
  fit: string;
  batch: "batch1" | "batch2" | "batch3";
};

const SCHOOL_PARTNER_VERTICAL = "school partner";
const OFFICIAL_PARTNER_PREFIX = "official side huddle partner";

// The 60+ booster-org import is gone with the $1,000 pitch it existed to feed.
// Those rows were drafted with best_package "$1,000/season" and best_angle
// "Official Side Huddle Partner for X" — a price we do not charge and a status
// we cannot grant. Re-importing them would put that back in the table.

const HUDDLE_LABELS: Record<string, string> = {
  Alabama: "Crimson Tide",
  Auburn: "Tiger",
  Clemson: "Tiger",
  Florida: "Gator",
  "Florida State": "Seminole",
  Georgia: "Bulldog",
  Kentucky: "Wildcat",
  LSU: "Tiger",
  Michigan: "Wolverine",
  Nebraska: "Husker",
  "Notre Dame": "Irish",
  "Ohio State": "Buckeye",
  Oklahoma: "Sooner",
  "Ole Miss": "Rebel",
  Oregon: "Duck",
  "Penn State": "Nittany Lion",
  "South Carolina": "Gamecock",
  Tennessee: "Volunteer",
  Texas: "Longhorn",
  "Texas A&M": "Aggie",
  Arkansas: "Razorback",
  "North Carolina": "Tar Heel",
  "NC State": "Wolfpack",
  Iowa: "Hawkeye",
  Missouri: "Mizzou",
  "Mississippi State": "Bulldog",
  Wisconsin: "Badger",
  Kansas: "Jayhawk",
  "Kansas State": "Wildcat",
  "Oklahoma State": "Cowboy",
  "Texas Tech": "Red Raider",
  Baylor: "Bear",
  "Virginia Tech": "Hokie",
  Virginia: "Cavalier",
  "West Virginia": "Mountaineer",
  Miami: "Hurricane",
  "Michigan State": "Spartan",
  Washington: "Husky",
  BYU: "Cougar",
  Utah: "Ute",
  SMU: "Mustang",
  TCU: "Horned Frog",
  Indiana: "Hoosier",
  UCF: "Knight",
  Arizona: "Wildcat",
  "Arizona State": "Sun Devil",
  Houston: "Cougar",
  "Boise State": "Bronco",
  Cincinnati: "Bearcat",
  Illinois: "Illini",
  Tulane: "Green Wave",
  Memphis: "Tiger",
  "Boston College": "Eagle",
  Colorado: "Buffalo",
  Duke: "Blue Devil",
  "Georgia Tech": "Yellow Jacket",
  "Iowa State": "Cyclone",
  Louisville: "Cardinal",
  Pittsburgh: "Panther",
  Purdue: "Boilermaker",
  Syracuse: "Orange",
  USC: "Trojan",
  Vanderbilt: "Commodore",
  "Wake Forest": "Demon Deacon",
};

function isSchoolPartnerLead(lead: Pick<Lead, "vertical" | "best_angle">) {
  return lead.vertical === SCHOOL_PARTNER_VERTICAL ||
    (lead.best_angle || "").toLowerCase().startsWith(OFFICIAL_PARTNER_PREFIX);
}

function campaignRegion(campaign: Campaign) {
  if (campaign === "school_partner_batch_4") return "College athletics batch 4";
  if (campaign === "school_partner_batch_3") return "College athletics batch 3";
  if (campaign === "school_partner_batch_2") return "College athletics batch 2";
  return null;
}

function campaignLabel(campaign: Campaign) {
  if (campaign.startsWith("vertical:")) {
    return campaign.slice("vertical:".length);
  }
  if (campaign === "school_partner_batch_4") return "athletics partners batch 4";
  if (campaign === "school_partner_batch_3") return "school partner batch 3";
  if (campaign === "school_partner_batch_2") return "school partner batch 2";
  if (campaign === "school_partner") return "all school partner drafts";
  return "all eligible leads";
}

function campaignMatchesLead(lead: Lead, campaign: Campaign) {
  if (campaign === "all") return true;
  if (campaign.startsWith("vertical:")) {
    return (lead.vertical || "other").trim() === campaign.slice("vertical:".length);
  }
  if (!isSchoolPartnerLead(lead)) return false;
  const region = campaignRegion(campaign);
  return region ? lead.region === region : true;
}

function huddleLabelForSchool(school: string) {
  return HUDDLE_LABELS[school] || school;
}

const DEFAULT_CATEGORIES = [
  "pizza",
  "wings",
  "car dealership",
  "physical therapy",
  "orthodontist",
  "credit union",
  "insurance agency",
  "real estate agent",
  "urgent care",
  "gym",
  "car wash",
  "roofing company",
].join(", ");

const statusOptions: LeadStatus[] = ["New", "Drafted", "Sent", "Follow-up", "Replied", "Won", "Lost"];

function scoreBadge(score: number | null) {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  const tone = score >= 12 ? "bg-emerald-600/80" : score >= 9 ? "bg-amber-500/80" : "bg-muted";
  return <Badge className={tone}>{score}</Badge>;
}

function statusBadge(status: LeadStatus | null) {
  const s = status || "New";
  if (s === "Won") return <Badge className="bg-emerald-600/80">Won</Badge>;
  if (s === "Replied") return <Badge className="bg-sky-600/80">Replied</Badge>;
  if (s === "Sent" || s === "Follow-up") return <Badge variant="secondary">{s}</Badge>;
  if (s === "Lost") return <Badge variant="destructive">Lost</Badge>;
  return <Badge variant="outline">{s}</Badge>;
}

function dollars(value: string | null) {
  // The default used to be $1,500, a number from a model that no longer
  // exists. A blank field should read as blank, not as a price nobody quoted.
  return value || "—";
}

export default function Outreach() {
  const { isAdmin, loading: authLoading, user, userRole, signOut } = useAuth();
  const { toast } = useToast();

  const [market, setMarket] = useState("");
  const [school, setSchool] = useState("");
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [company, setCompany] = useState("");
  const [maxResults, setMaxResults] = useState("40");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [barHunt, setBarHunt] = useState<string | null>(null);
  const [findingEmail, setFindingEmail] = useState<string | null>(null);
  const [sending, setSending] = useState<number | null>(null);

  const [live, setLive] = useState(false);
  const [maxEmails, setMaxEmails] = useState("25");
  const [campaign, setCampaign] = useState<Campaign>("all");

  // Who you can write to, worked out from the data instead of hardcoded.
  //
  // The old list was import batches — "school partner batch 3" — which says
  // when a row was loaded, not who is on the other end, and it grew by one
  // dead option every time anything was imported. This cannot go stale: add a
  // new kind of lead and it appears, with a count of how many can actually be
  // emailed today.
  const audiences = useMemo(() => {
    const by = new Map<string, { ready: number; noEmail: number }>();
    for (const l of leads) {
      const v = (l.vertical || "other").trim();
      const b = by.get(v) ?? { ready: 0, noEmail: 0 };
      if (l.bounced || l.unsubscribed) continue;
      if (l.contact_email) b.ready++;
      else b.noEmail++;
      by.set(v, b);
    }
    return [...by.entries()]
      .map(([v, n]) => ({
        key: `vertical:${v}`,
        label: v.replace(/\b\w/g, (c) => c.toUpperCase()),
        ...n,
      }))
      .sort((a, b) => b.ready - a.ready || b.noEmail - a.noEmail);
  }, [leads]);
  const [lastResult, setLastResult] = useState<SendResult | null>(null);
  const [view, setView] = useState<
    "school" | "business" | "priority" | "all" | "contacted" | "followup"
  >("school");
  // The worklist opens by default. Everything else on this page is machinery —
  // campaigns, scores, filters — and machinery is not what anyone came to do.
  const [audience, setAudience] = useState<
    "work" | "sponsors" | "chapters" | "creators" | "coverage"
  >("work");

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
    setLoadingLeads(true);
    const { data, error } = await (supabase as any)
      .from("sponsor_leads")
      .select(
        "id,created_at,company,vertical,region,market,school,website,domain,phone,contact_name,contact_title,contact_email,instagram_handle,email_confidence,priority,sponsor_signal,sponsor_score,best_package,best_angle,status,follow_up_date,last_touch,notes,emailed,sequence_step,bounced,unsubscribed",
      )
      .order("sponsor_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(500);
    setLoadingLeads(false);
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

  const metrics = useMemo(() => {
    const priority = leads.filter((l) => (l.sponsor_score || 0) >= 12);
    const schoolPartners = leads.filter(isSchoolPartnerLead);
    const due = leads.filter((l) => l.follow_up_date && l.follow_up_date <= new Date().toISOString().slice(0, 10));
    const contacted = leads.filter((l) => l.emailed || l.status === "Sent" || l.status === "Follow-up");
    return {
      total: leads.length,
      priority: priority.length,
      schoolPartners: schoolPartners.length,
      // Businesses had no tab of their own — they were only visible under
      // "All", which is where the 665 bars went to be forgotten.
      businesses: leads.filter((l) => !isSchoolPartnerLead(l)).length,
      withEmail: leads.filter((l) => l.contact_email).length,
      due: due.length,
      contacted: contacted.length,
    };
  }, [leads]);

  const filtered = useMemo(() => {
    if (view === "school") return leads.filter((l) => campaignMatchesLead(l, campaign));
    if (view === "business") return leads.filter((l) => !isSchoolPartnerLead(l));
    if (view === "priority") return leads.filter((l) => (l.sponsor_score || 0) >= 12 || l.priority === "TIER1");
    if (view === "contacted") return leads.filter((l) => l.emailed || l.status === "Sent" || l.status === "Follow-up");
    if (view === "followup") {
      const today = new Date().toISOString().slice(0, 10);
      return leads.filter((l) => l.follow_up_date && l.follow_up_date <= today);
    }
    return leads;
  }, [campaign, leads, view]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading...
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
              {loggingIn ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </Card>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md space-y-4 p-6">
          <div className="space-y-2">
            <Badge variant="destructive" className="w-fit">
              Admin role required
            </Badge>
            <h1 className="text-xl font-bold text-foreground">Sponsor Outreach is locked</h1>
            <p className="text-sm text-muted-foreground">
              You are signed in, but this tool needs the exact Supabase role{" "}
              <span className="font-medium text-foreground">admin</span>.
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Account</span>
              <span className="break-all text-right font-medium text-foreground">
                {user.email || user.id}
              </span>
            </div>
            <div className="mt-2 flex justify-between gap-3">
              <span className="text-muted-foreground">Current role</span>
              <span className="font-medium text-foreground">{userRole || "member"}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => window.location.reload()}>
              Refresh
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  async function runEnrich() {
    if (!school.trim() && !market.trim() && !company.trim()) {
      toast({ title: "Enter a school, market, or company", variant: "destructive" });
      return;
    }
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke("outreach-enrich", {
        body: {
          market,
          school,
          vertical: categories,
          company,
          region: market,
          maxResults: Number(maxResults) || 40,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Sponsor map built",
        description: `${data.found} found · ${data.stored} new/updated · ${data.withEmail} with email`,
      });
      await loadLeads();
    } catch (e) {
      toast({
        title: "Prospecting failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setEnriching(false);
    }
  }

  async function runSend(step: number) {
    if (live && campaign === "all") {
      const ok = window.confirm(
        "All eligible leads will send to every unsent lead across campaigns. Already-sent leads are still skipped. Continue?",
      );
      if (!ok) return;
    }
    setSending(step);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("outreach-send", {
        body: { sequenceStep: step, mode: live ? "live" : "test", maxEmails: Number(maxEmails) || 25, campaign },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLastResult(data as SendResult);
      toast({
        title: live ? `Step ${step} sent` : `Step ${step} preview`,
        description: live
          ? `${data.sent} sent · ${data.skipped_duplicate} dup-skipped · ${data.errors.length} errors`
          : `${data.sent} would send. Nothing sent in test mode.`,
      });
      await loadLeads();
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


  // Find emails for the bars we already know about, biggest crowd first.
  //
  // Every bar loaded from chapter-db is a venue some fan club already watches
  // at, and sponsor_signal carries how many people that is. Looking them up one
  // click at a time meant fifty clicks, so nobody did it.
  //
  // Skips anything already emailed, bounced or unsubscribed — re-pitching
  // somebody who told us to stop is the one mistake that costs a domain.
  async function findBarEmails() {
    const size = (l: Lead) => {
      const m = (l.sponsor_signal || "").match(/(\d[\d,]*)\s*members/i);
      return m ? Number(m[1].replace(/,/g, "")) : 0;
    };
    const queue = leads
      .filter(
        (l) =>
          l.vertical === "sports bar" &&
          !l.contact_email &&
          !l.bounced &&
          !l.unsubscribed &&
          !l.emailed,
      )
      .sort((a, b) => size(b) - size(a))
      .slice(0, 50);

    if (queue.length === 0) {
      toast({
        title: "Nothing to look up",
        description: "Every bar either has an email already or has been contacted.",
      });
      return;
    }

    let found = 0;
    const reasons = new Map<string, number>();
    for (let i = 0; i < queue.length; i++) {
      const l = queue[i];
      setBarHunt(`${i + 1} of ${queue.length} — ${l.company}`);
      try {
        const { data } = await supabase.functions.invoke("outreach-enrich", {
          body: { leadId: l.id },
        });
        if (data?.contact_email) found++;
        else if (data?.reason) reasons.set(data.reason, (reasons.get(data.reason) ?? 0) + 1);
      } catch {
        // One bad lookup must not end the run — the rest of the list is fine.
      }
    }
    setBarHunt(null);
    await loadLeads();

    // The commonest reason, said out loud. "Found 0 of 50" on its own sent us
    // looking for the wrong problem twice.
    const top = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0];
    toast({
      title: `Found ${found} of ${queue.length}`,
      description: found
        ? "Those bars can be emailed now."
        : top
          ? `Commonest reason: ${top[0]}`
          : "Nothing came back and nothing said why.",
    });
  }

  async function findEmail(l: Lead) {
    setFindingEmail(l.id);
    try {
      const { data, error } = await supabase.functions.invoke("outreach-enrich", {
        body: { leadId: l.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.contact_email) {
        toast({
          title: "Email found",
          description: `${l.company} · ${data.contact_email}`,
        });
      } else {
        toast({
          title: "No email found",
          description: `${l.company} still needs manual contact research.`,
        });
      }
      await loadLeads();
    } catch (e) {
      toast({
        title: "Find email failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setFindingEmail(null);
    }
  }

  /**
   * The copy-pitch letter, kept identical in substance to what outreach-send
   * actually mails. Two versions of one offer is how a prospect ends up quoted
   * two prices — this page used to promise $1,000 a season with $500 to hold,
   * "Official Side Huddle Partner" status we cannot grant, placement "across
   * the rooms" that does not exist, and a free season if a room missed 250
   * members. None of that was true by the time it was being pasted.
   */
  function pitchText(l: Lead) {
    const where = l.school || l.market || l.region || "your local team";
    const who = l.contact_name?.split(" ")[0] || "there";
    const slug = where
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const link = slug
      ? `https://sidehuddlesports.com/sponsor?team=${slug}`
      : "https://sidehuddlesports.com/sponsor";

    return [
      `Subject: ${pitchSubject(l)}`,
      `Hi ${who},`,
      `Side Huddle is where ${where} fans watch the game together — a private room with their own people, the score and the news landing in it as it happens.`,
      `I am taking one founding partner per team per season, and ${l.company} would be it for ${where}. Nobody else in your category, this season or while you keep it.`,
      `What that is: founding partner status and the launch story that goes with it; a pregame card in the room when the game starts, carrying a small "powered by"; the same line under the clips fans post of themselves watching; and co-branded shirts in the team's colours.`,
      `$2,500 for the season, flat. The founding rate is locked for three seasons and you get first refusal after that.`,
      link,
      `Ty`,
    ].join("\n\n");
  }

  function pitchSubject(l: Lead) {
    const where = l.school || l.market || l.region || "your local team";
    return `founding partner — ${where}`;
  }

  async function copyPitch(l: Lead) {
    try {
      await navigator.clipboard.writeText(pitchText(l));
      toast({ title: "Pitch copied", description: l.company });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }

  async function updateLead(l: Lead, patch: Partial<Lead>) {
    const { error } = await (supabase as any).from("sponsor_leads").update(patch).eq("id", l.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    setLeads((prev) => prev.map((x) => (x.id === l.id ? { ...x, ...patch } : x)));
  }

  async function deleteLead(l: Lead) {
    const { error } = await (supabase as any).from("sponsor_leads").delete().eq("id", l.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setLeads((prev) => prev.filter((x) => x.id !== l.id));
    toast({ title: "Removed", description: l.company });
  }

  function downloadCsv() {
    const cols = [
      "market",
      "school",
      "company",
      "vertical",
      "website",
      "contact_name",
      "contact_title",
      "contact_email",
      "phone",
      "instagram_handle",
      "sponsor_signal",
      "sponsor_score",
      "best_package",
      "best_angle",
      "status",
      "follow_up_date",
      "last_touch",
      "notes",
    ] as const;
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = filtered.map((l) => cols.map((c) => esc((l as Record<string, unknown>)[c])).join(","));
    const csv = [cols.join(","), ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `side-huddle-sponsor-map-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              {/* ONE TITLE. It used to rename itself per tab, so the page you
                  were on was never the page you remembered being on. */}
              <h1 className="text-3xl font-bold text-foreground">Outreach</h1>
              <p className="text-sm text-muted-foreground">
                Work a team at a time: its fan clubs, its booster group, and the
                local businesses around it.
              </p>
            </div>
            {audience === "sponsors" && (
              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-6">
                <Metric label="Leads" value={metrics.total} />
                <Metric label="Schools" value={metrics.schoolPartners} />
                <Metric label="Emails" value={metrics.withEmail} />
                <Metric label="Due" value={metrics.due} />
                <Metric label="Contacted" value={metrics.contacted} />
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              variant={audience === "work" ? "default" : "outline"}
              size="sm"
              onClick={() => setAudience("work")}
            >
              By team
            </Button>
            <Button
              variant={audience === "sponsors" ? "default" : "outline"}
              size="sm"
              onClick={() => setAudience("sponsors")}
            >
              Sponsors
            </Button>
            <Button
              variant={audience === "creators" ? "default" : "outline"}
              size="sm"
              onClick={() => setAudience("creators")}
            >
              Creators
            </Button>
          </div>
        </div>
      </div>

      {audience === "work" ? <WorkPanel /> : audience === "creators" ? <CreatorsPanel /> : (

      <div className="container mx-auto grid gap-6 px-4 py-8 xl:grid-cols-[390px,1fr]">
        <div className="space-y-6">
          <BrevoImport onDone={loadLeads} />

          <Card className="space-y-4 p-5">
            <div>
              <h2 className="text-lg font-semibold">Build A Sponsor Map</h2>
              <p className="text-sm text-muted-foreground">
                Start with a school or city, then pull the local categories most likely to sponsor.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="school">School or team</Label>
              <Input
                id="school"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                placeholder="e.g. McCallie School"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="market">Market</Label>
              <Input
                id="market"
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                placeholder="e.g. Chattanooga, TN"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="categories">Categories</Label>
              <Textarea
                id="categories"
                value={categories}
                onChange={(e) => setCategories(e.target.value)}
                rows={5}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company">Specific company</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max">Max results</Label>
              <Input
                id="max"
                type="number"
                min={1}
                max={100}
                value={maxResults}
                onChange={(e) => setMaxResults(e.target.value)}
              />
            </div>
            <Button className="w-full gap-2" onClick={runEnrich} disabled={enriching}>
              <Search className="h-4 w-4" />
              {enriching ? "Building map..." : "Find and score sponsors"}
            </Button>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={findBarEmails}
              disabled={barHunt !== null}
            >
              <Search className="h-4 w-4" />
              {barHunt ? barHunt : "Find emails — top 50 bars"}
            </Button>
            <p className="text-xs text-muted-foreground">
              The bars fan clubs already watch at, biggest crowd first. Skips
              anyone already contacted.
            </p>
          </Card>

          {/* THE BULK SEQUENCE CARD IS GONE.
              Step 1/2/3 against a campaign dropdown sent to everyone matching a
              filter, with no preview of what any one person would receive. The
              By-team view sends the same letters with "Read the letter" in
              front of every send, which is the only send path that should
              exist. */}

          {lastResult && (
            <Card className="space-y-2 p-5 text-sm">
              <h3 className="font-semibold">
                Step {lastResult.step} · {lastResult.mode} · {campaignLabel(lastResult.campaign as Campaign)}
              </h3>
              <p>
                {lastResult.mode === "live" ? "Sent" : "Would send"}: <strong>{lastResult.sent}</strong> / {lastResult.eligible} eligible
              </p>
              {lastResult.errors.length > 0 && <p className="text-destructive">Errors: {lastResult.errors.length}</p>}
              {lastResult.previews.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-muted-foreground">
                    Preview emails ({lastResult.previews.length}) — full text as the recipient sees it
                  </summary>
                  <ul className="mt-2 space-y-3">
                    {lastResult.previews.map((p, i) => (
                      <li key={i} className="rounded border border-border p-3 text-xs">
                        <div className="font-medium">{p.company}</div>
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
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {/* WHO first, then what state. These used to sit in one row, so
                  "School partners" looked like a sibling of "Follow-up" — one
                  is an audience with its own letter, the other is a stage. */}
              <Button variant={view === "school" ? "default" : "outline"} size="sm" onClick={() => setView("school")}>
                School partners ({metrics.schoolPartners})
              </Button>
              <Button variant={view === "business" ? "default" : "outline"} size="sm" onClick={() => setView("business")}>
                Businesses ({metrics.businesses})
              </Button>
              <span className="mx-1 self-center text-muted-foreground">·</span>
              <Button variant={view === "priority" ? "default" : "outline"} size="sm" onClick={() => setView("priority")}>
                Priority ({metrics.priority})
              </Button>
              <Button variant={view === "followup" ? "default" : "outline"} size="sm" onClick={() => setView("followup")}>
                Follow-up ({metrics.due})
              </Button>
              <Button variant={view === "contacted" ? "default" : "outline"} size="sm" onClick={() => setView("contacted")}>
                Contacted ({metrics.contacted})
              </Button>
              <Button variant={view === "all" ? "default" : "outline"} size="sm" onClick={() => setView("all")}>
                All ({metrics.total})
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={downloadCsv} disabled={filtered.length === 0}>
                <Download className="h-4 w-4" />
                CSV
              </Button>
              <Button variant="ghost" size="sm" className="gap-2" onClick={loadLeads} disabled={loadingLeads}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[250px]">Prospect</TableHead>
                    <TableHead className="min-w-[190px]">Contact</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead className="min-w-[240px]">Signal</TableHead>
                    <TableHead className="min-w-[190px]">Angle</TableHead>
                    <TableHead className="min-w-[160px]">Status</TableHead>
                    <TableHead className="min-w-[150px]">Follow-up</TableHead>
                    <TableHead className="min-w-[160px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                        No leads in this view yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">{l.company}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          <span>{l.vertical}</span>
                          {(l.school || l.market || l.region) && (
                            <>
                              <span>·</span>
                              <MapPin className="h-3 w-3" />
                              <span>{[l.school, l.market || l.region].filter(Boolean).join(" / ")}</span>
                            </>
                          )}
                        </div>
                        {l.website && (
                          <a href={l.website} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-sky-400 hover:underline">
                            {l.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                          </a>
                        )}
                        {isSchoolPartnerLead(l) && (
                          <div className="mt-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
                            Subject: {pitchSubject(l)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>{l.contact_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{l.contact_title || ""}</div>
                        <div className="mt-1 break-all text-xs">
                          {l.contact_email || <span className="text-muted-foreground">email not found</span>}
                        </div>
                        {l.instagram_handle && (
                          <a
                            href={`https://instagram.com/${l.instagram_handle.replace(/^@/, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-sky-400 hover:underline"
                          >
                            {l.instagram_handle}
                          </a>
                        )}
                      </TableCell>
                      <TableCell>{scoreBadge(l.sponsor_score)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.sponsor_signal || "Local category fit; verify sponsor activity."}</TableCell>
                      <TableCell>
                        <div className="text-sm">{l.best_angle || "—"}</div>
                        <div className="text-xs text-muted-foreground">{dollars(l.best_package)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="mb-2">{statusBadge(l.status)}</div>
                        <select
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={l.status || "New"}
                          onChange={(e) => updateLead(l, { status: e.target.value as LeadStatus, last_touch: new Date().toISOString().slice(0, 10) })}
                        >
                          {statusOptions.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          value={l.follow_up_date || ""}
                          onChange={(e) => updateLead(l, { follow_up_date: e.target.value || null })}
                          className="h-8"
                        />
                        {l.last_touch && <div className="mt-1 text-xs text-muted-foreground">Last: {l.last_touch}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Button variant="outline" size="sm" onClick={() => copyPitch(l)}>
                            <Copy className="mr-1 h-4 w-4" />
                            Pitch
                          </Button>
                          {!l.contact_email && (
                            <Button variant="outline" size="sm" onClick={() => findEmail(l)} disabled={findingEmail === l.id}>
                              <AtSign className="mr-1 h-4 w-4" />
                              {findingEmail === l.id ? "Finding" : "Email"}
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteLead(l)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <div className="text-lg font-semibold leading-none">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
