import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

/**
 * Creators — X accounts that actually post about a team.
 *
 * Sorted by ENGAGEMENT EARNED, never by follower count. A 1,700-follower account
 * averaging 45 likes is a better room owner than a 90,000-follower newspaper
 * averaging 3, and sorting by audience size buries exactly the people worth
 * talking to.
 *
 * There is no send button here on purpose. Bulk DMs on X are how an account gets
 * suspended, and the DM endpoints need a paid tier and OAuth besides. So this
 * hands over the name, the best thing they wrote, and a way to reach them —
 * and the message is sent by a person.
 */

type Status = "new" | "queued" | "sent" | "replied" | "onboarded" | "dead";

type Creator = {
  id: string;
  handle: string;
  display_name: string | null;
  org: string | null;
  followers: number;
  posts_seen: number;
  avg_likes: number;
  best_post: string | null;
  bio: string | null;
  email: string | null;
  website: string | null;
  status: Status;
  last_touch: string | null;
};

const STATUSES: Status[] = ["new", "queued", "sent", "replied", "onboarded", "dead"];

type Team = { id: string; city: string; name: string; league: string | null };
type Invite = { x_handle: string; status: "pending" | "claimed" | "revoked"; token: string; created_at: string };
type CreatorProfile = { user_id: string; display_name: string | null; username: string | null; x_handle: string; verified_creator: boolean };

const INVITE_BASE = "https://sidehuddlesports.com/invite/";

/**
 * Paste a list in — a sheet, a discovery export, anything with a header row.
 *
 * Headers are matched by name, not position, because every list arrives in a
 * different order. A blank cell never erases what is already known: the
 * import coalesces server-side, so a paste that only knows the handle and the
 * tier leaves the engagement and the email alone.
 */
type ImportRow = {
  handle: string; display_name: string | null; org: string | null; followers: number;
  bio: string | null; email: string | null; website: string | null;
  status: string | null; tier: string | null; dm_able: boolean;
};

const HEADER_ALIASES: Record<string, string> = {
  handle: "handle", "x handle": "handle", "x-handle": "handle", twitter: "handle", account: "handle",
  name: "display_name", "display name": "display_name", creator: "display_name",
  org: "org", team: "org", school: "org",
  followers: "followers",
  bio: "bio", notes: "bio", note: "bio",
  email: "email", website: "website", url: "website",
  status: "status", tier: "tier",
  "dm-able": "dm_able", dmable: "dm_able", "dm able": "dm_able", dm: "dm_able",
};

const LEAD_STATUSES = ["new", "queued", "sent", "replied", "onboarded", "dead"];

/** "~123K" → 123000, "1.2M" → 1200000, "12,345" → 12345. */
function parseFollowers(v: string): number {
  const t = (v || "").replace(/[~,\s]/g, "");
  const m = t.match(/^([\d.]+)([kKmM])?$/);
  if (!m) return 0;
  const n = parseFloat(m[1]) || 0;
  const suffix = (m[2] || "").toLowerCase();
  return Math.round(n * (suffix === "k" ? 1000 : suffix === "m" ? 1000000 : 1));
}

/** A CSV parser that survives quoted commas and newlines inside a cell. */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else quoted = false; }
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === "," || c === "\t") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function toRows(text: string): { rows: ImportRow[]; skipped: number; missingHandle: boolean } {
  const grid = parseCSV(text);
  if (!grid.length) return { rows: [], skipped: 0, missingHandle: true };
  const head = grid[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? "");
  if (!head.includes("handle")) return { rows: [], skipped: 0, missingHandle: true };
  const at = (r: string[], key: string) => {
    const i = head.indexOf(key);
    return i === -1 ? "" : (r[i] ?? "").trim();
  };
  const rows: ImportRow[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const r of grid.slice(1)) {
    const handle = at(r, "handle").replace(/^@/, "");
    if (!handle || seen.has(handle.toLowerCase())) { skipped++; continue; }
    seen.add(handle.toLowerCase());
    const bio = at(r, "bio");
    // Lists tag the team in the notes — "[ohio-state] pure fan content".
    const tag = (bio.match(/^\[([a-z0-9-]+)\]/i) ?? [])[1] ?? null;
    const pretty = tag ? tag.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : null;
    const status = at(r, "status").toLowerCase();
    rows.push({
      handle,
      display_name: at(r, "display_name") || null,
      org: at(r, "org") || pretty,
      followers: parseFollowers(at(r, "followers")),
      bio: bio || null,
      email: at(r, "email") || null,
      website: at(r, "website") || null,
      status: LEAD_STATUSES.includes(status) ? status : null,
      tier: at(r, "tier") || null,
      dm_able: /^(y|yes|true|1)$/i.test(at(r, "dm_able")),
    });
  }
  return { rows, skipped, missingHandle: false };
}
const teamLabel = (t: Team) => `${t.city} ${t.name}`.trim();
const key = (h: string) => h.replace(/^@/, "").toLowerCase();

function statusBadge(s: Status) {
  const tone: Record<Status, string> = {
    new: "bg-muted text-muted-foreground",
    queued: "bg-blue-500/15 text-blue-600",
    sent: "bg-amber-500/15 text-amber-600",
    replied: "bg-emerald-500/15 text-emerald-600",
    onboarded: "bg-emerald-600 text-white",
    dead: "bg-destructive/15 text-destructive",
  };
  return <Badge className={`${tone[s] ?? tone.new} border-0`}>{s}</Badge>;
}

export default function CreatorsPanel() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [org, setOrg] = useState("");

  // Verified-creator state, keyed by lowercased handle.
  const [teams, setTeams] = useState<Team[]>([]);
  const [invites, setInvites] = useState<Map<string, Invite>>(new Map());
  const [verified, setVerified] = useState<Map<string, CreatorProfile>>(new Map());
  const [teamFor, setTeamFor] = useState<Record<string, string>>({});
  const [grantUser, setGrantUser] = useState<Record<string, string>>({});
  const [busyHandle, setBusyHandle] = useState<string | null>(null);

  // Paste-a-list importer.
  const [importOpen, setImportOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const [importing, setImporting] = useState(false);
  const preview = useMemo(() => toRows(paste), [paste]);

  async function runImport() {
    if (!preview.rows.length) return;
    setImporting(true);
    const { data, error } = await (supabase.rpc as any)("admin_import_creator_leads", { p_rows: preview.rows });
    setImporting(false);
    if (error) return toast({ title: "Import failed", description: error.message, variant: "destructive" });
    const row = Array.isArray(data) ? data[0] : data;
    toast({
      title: `${row?.inserted ?? 0} added, ${row?.updated ?? 0} updated`,
      description: preview.skipped ? `${preview.skipped} row(s) skipped — no handle, or a repeat.` : undefined,
    });
    setPaste("");
    setImportOpen(false);
    load();
    loadVerification();
  }

  async function loadVerification() {
    const sb = supabase as any;
    const [t, inv, prof] = await Promise.all([
      sb.from("teams").select("id, city, name, league").eq("status", "active").order("name"),
      sb.from("creator_invites").select("x_handle, status, token, created_at").order("created_at", { ascending: false }),
      sb.from("profiles").select("user_id, display_name, username, x_handle, verified_creator").not("x_handle", "is", null),
    ]);
    setTeams((t.data ?? []) as Team[]);
    const m = new Map<string, Invite>();
    for (const i of (inv.data ?? []) as Invite[]) if (!m.has(key(i.x_handle))) m.set(key(i.x_handle), i);
    setInvites(m);
    setVerified(new Map(((prof.data ?? []) as CreatorProfile[]).map((p) => [key(p.x_handle), p])));
  }

  /** The team a row's invite is for: what the admin picked, else a guess from the org. */
  function teamIdFor(r: Creator): string | null {
    const typed = teamFor[r.id];
    const byLabel = (label: string) => teams.find((t) => teamLabel(t).toLowerCase() === label.trim().toLowerCase());
    if (typed !== undefined) return byLabel(typed)?.id ?? null;
    const o = (r.org ?? "").trim().toLowerCase();
    if (!o) return null;
    return (teams.find((t) => teamLabel(t).toLowerCase() === o) ?? teams.find((t) => t.city.toLowerCase() === o))?.id ?? null;
  }
  function teamText(r: Creator): string {
    if (teamFor[r.id] !== undefined) return teamFor[r.id];
    const id = teamIdFor(r);
    const t = teams.find((x) => x.id === id);
    return t ? teamLabel(t) : "";
  }

  async function copyInvite(r: Creator) {
    const teamId = teamIdFor(r);
    setBusyHandle(r.handle);
    const { data, error } = await (supabase.rpc as any)("admin_creator_invite", { p_handle: r.handle, p_team_id: teamId });
    setBusyHandle(null);
    if (error) return toast({ title: "No link", description: error.message, variant: "destructive" });
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.status === "claimed") {
      toast({ title: `@${r.handle} already claimed their link`, description: "Revoke first to issue a new one." });
    } else {
      const url = INVITE_BASE + row.token;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast({ title: "Invite link copied", description: url });
    }
    loadVerification();
  }

  async function revoke(r: Creator) {
    if (!window.confirm(`Revoke @${r.handle}? The verified badge comes off and their link stops working.`)) return;
    setBusyHandle(r.handle);
    const { error } = await (supabase.rpc as any)("admin_revoke_creator", { p_handle: r.handle });
    setBusyHandle(null);
    if (error) return toast({ title: "Revoke failed", description: error.message, variant: "destructive" });
    toast({ title: `@${r.handle} revoked` });
    loadVerification();
  }

  async function grant(r: Creator) {
    const who = (grantUser[r.id] ?? "").trim();
    const teamId = teamIdFor(r);
    if (!who) return toast({ title: "Enter their username or email", variant: "destructive" });
    if (!teamId) return toast({ title: "Pick a team first", variant: "destructive" });
    setBusyHandle(r.handle);
    const { error } = await (supabase.rpc as any)("admin_grant_creator", { p_user: who, p_handle: r.handle, p_team_id: teamId });
    setBusyHandle(null);
    if (error) return toast({ title: "Grant failed", description: error.message, variant: "destructive" });
    toast({ title: `@${r.handle} linked and verified`, description: who });
    setGrantUser((g) => ({ ...g, [r.id]: "" }));
    loadVerification();
  }

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("creator_leads")
      .select("id,handle,display_name,org,followers,posts_seen,avg_likes,best_post,bio,email,website,status,last_touch")
      .order("avg_likes", { ascending: false })
      .limit(500);
    if (error) toast({ title: "Could not load creators", description: error.message, variant: "destructive" });
    setRows((data ?? []) as Creator[]);
    setLoading(false);
  }

  useEffect(() => { load(); loadVerification(); }, []);

  const orgs = useMemo(
    () => [...new Set(rows.map((r) => r.org).filter(Boolean))].sort() as string[],
    [rows],
  );

  const filtered = useMemo(() => rows.filter((r) => {
    if (org && r.org !== org) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return `${r.handle} ${r.display_name ?? ""} ${r.bio ?? ""}`.toLowerCase().includes(q);
  }), [rows, org, search]);

  const reachable = filtered.filter((r) => r.email).length;

  async function setStatus(row: Creator, next: Status) {
    const prev = row.status;
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
    const { error } = await supabase
      .from("creator_leads")
      .update({ status: next, last_touch: new Date().toISOString().slice(0, 10) })
      .eq("id", row.id);
    if (error) {
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status: prev } : r)));
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[220px]">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="handle, name, bio…"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Team</label>
              <select
                className="block h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
              >
                <option value="">All teams</option>
                {orgs.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <Button variant="outline" onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </Button>
            <Button variant="outline" onClick={() => setImportOpen((v) => !v)}>
              {importOpen ? "Close import" : "Import list"}
            </Button>
          </div>

          {importOpen ? (
            <div className="space-y-2 rounded-lg border border-input p-3">
              <p className="text-xs text-muted-foreground">
                Paste a CSV with a header row. <b>handle</b> is the only column that has to be
                there; name, tier, followers, status, notes, email, website and DM-able are used
                when present. A blank cell never overwrites what is already known, and an
                existing lead keeps its pipeline status.
              </p>
              <textarea
                className="h-40 w-full rounded-md border border-input bg-background p-2 font-mono text-xs"
                placeholder={"handle,name,tier,followers,status,notes,dm-able\n@TheBuckeyeNut,The Buckeye Nut,main,~123K,new,[ohio-state] fan-content machine,yes"}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={runImport} disabled={importing || !preview.rows.length}>
                  {importing ? "Importing…" : `Import ${preview.rows.length} row${preview.rows.length === 1 ? "" : "s"}`}
                </Button>
                {paste.trim() && preview.missingHandle ? (
                  <span className="text-xs text-destructive">
                    No handle column found — the header needs "handle" or "X handle".
                  </span>
                ) : preview.rows.length ? (
                  <span className="text-xs text-muted-foreground">
                    {preview.rows.length} ready
                    {preview.skipped ? `, ${preview.skipped} skipped` : ""} ·{" "}
                    {preview.rows.filter((r) => r.dm_able).length} DM-able · first:{" "}
                    <b>@{preview.rows[0].handle}</b>
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            {filtered.length} creators · <b>{reachable}</b> with an email in their bio.
            X has no safe way to send bulk DMs, so the ones without an address are
            reached by hand — the rest can go through Brevo like the chapters.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Avg likes</TableHead>
                <TableHead className="text-right">Followers</TableHead>
                <TableHead>Best post</TableHead>
                <TableHead>Reach</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="min-w-[260px]">Verified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <a
                      href={`https://x.com/${r.handle}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      @{r.handle}
                    </a>
                    <div className="text-xs text-muted-foreground">{r.display_name}</div>
                    {r.org && <div className="text-xs text-muted-foreground">{r.org}</div>}
                  </TableCell>
                  {/* Engagement first, deliberately: it is the column that decides. */}
                  <TableCell className="text-right tabular-nums font-semibold">{r.avg_likes}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.followers.toLocaleString()}
                  </TableCell>
                  <TableCell className="max-w-[320px]">
                    <span className="text-sm text-muted-foreground line-clamp-2">{r.best_post}</span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.email ? (
                      <a className="text-primary hover:underline" href={`mailto:${r.email}`}>{r.email}</a>
                    ) : (
                      <a
                        className="text-muted-foreground hover:underline"
                        href={`https://x.com/messages/compose?recipient_id=&text=`}
                        onClick={(e) => { e.preventDefault(); window.open(`https://x.com/${r.handle}`, "_blank"); }}
                      >
                        DM on X
                      </a>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="mb-2">{statusBadge(r.status)}</div>
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={r.status}
                      onChange={(e) => setStatus(r, e.target.value as Status)}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </TableCell>
                  <TableCell className="align-top">
                    {(() => {
                      const inv = invites.get(key(r.handle));
                      const prof = verified.get(key(r.handle));
                      const isVerified = !!prof?.verified_creator;
                      const state = isVerified ? (inv?.status === "claimed" ? "claimed" : "verified") : inv?.status ?? "none";
                      const tone: Record<string, string> = {
                        none: "bg-muted text-muted-foreground",
                        pending: "bg-amber-500/15 text-amber-600",
                        claimed: "bg-emerald-600 text-white",
                        verified: "bg-emerald-600 text-white",
                        revoked: "bg-destructive/15 text-destructive",
                      };
                      const busy = busyHandle === r.handle;
                      return (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge className={`${tone[state]} border-0`}>{state}</Badge>
                            {isVerified && prof ? (
                              <span className="text-xs text-muted-foreground">
                                {prof.display_name ?? prof.username ?? "account linked"}
                              </span>
                            ) : null}
                          </div>
                          <Input
                            list="creator-teams"
                            className="h-8 text-xs"
                            placeholder="Team"
                            value={teamText(r)}
                            onChange={(e) => setTeamFor((m) => ({ ...m, [r.id]: e.target.value }))}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => copyInvite(r)}>
                              Copy invite link
                            </Button>
                            {state !== "none" && state !== "revoked" ? (
                              <Button size="sm" variant="outline" disabled={busy} onClick={() => revoke(r)}
                                className="text-destructive">
                                Revoke
                              </Button>
                            ) : null}
                          </div>
                          {/* Fallback: they signed up without tapping the link. */}
                          {!isVerified ? (
                            <div className="flex gap-2">
                              <Input
                                className="h-8 text-xs"
                                placeholder="Their username or email"
                                value={grantUser[r.id] ?? ""}
                                onChange={(e) => setGrantUser((g) => ({ ...g, [r.id]: e.target.value }))}
                              />
                              <Button size="sm" disabled={busy} onClick={() => grant(r)}>Link + verify</Button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && !loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                    No creators yet — run discovery for a team and they'll appear here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <datalist id="creator-teams">
            {teams.map((t) => <option key={t.id} value={teamLabel(t)} />)}
          </datalist>
        </CardContent>
      </Card>
    </div>
  );
}
