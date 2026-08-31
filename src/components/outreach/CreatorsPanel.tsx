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

  useEffect(() => { load(); }, []);

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
          </div>

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
                </TableRow>
              ))}
              {!filtered.length && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                    No creators yet — run discovery for a team and they'll appear here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
