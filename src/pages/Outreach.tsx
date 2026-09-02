import { useEffect, useMemo, useState } from "react";
import { Download, Mail, MapPin, RefreshCw, Search, Trash2, Copy, AtSign, UploadCloud } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import ChaptersPanel from "@/components/outreach/ChaptersPanel";
import CreatorsPanel from "@/components/outreach/CreatorsPanel";
import CoveragePanel from "@/components/outreach/CoveragePanel";
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

const SCHOOL_PARTNER_PROSPECTS: SchoolPartnerProspect[] = [
  { school: "Clemson", organization: "IPTAY", contactName: "Travis Furbee", contactTitle: "CEO", contactEmail: "tfurbee@clemson.edu", fit: "IPTAY is practically its own consumer brand, not merely a donation office.", batch: "batch1" },
  { school: "Alabama", organization: "Yea Alabama", contactName: "Doug Killough", contactTitle: "Director of Marketing & Membership", contactEmail: "doug@yea-alabama.com", fit: "Official fan-experience and membership community fit.", batch: "batch1" },
  { school: "South Carolina", organization: "Gamecock Club", contactName: "Wayne Hiott", contactTitle: "CEO", contactEmail: "wayne@sc.edu", fit: "Exclusive content and fan experiences already support membership growth.", batch: "batch1" },
  { school: "Georgia", organization: "Georgia Bulldog Club", contactName: "Ford Williams", contactTitle: "Executive Director", contactEmail: "fwilliams@sports.uga.edu", fit: "Huge donor culture, strong status value, and a clearly branded fundraising organization.", batch: "batch1" },
  { school: "Tennessee", organization: "Tennessee Fund", contactName: "Brady Hart", contactTitle: "Deputy AD and Chief Revenue Officer", contactEmail: "bhart8@utk.edu", fit: "Revenue owner with a direct fit for a new fan-engagement position.", batch: "batch1" },
  { school: "Florida", organization: "Gator Boosters", contactName: "Paul Vosilla", contactTitle: "Assistant Executive Director, Stewardship", contactEmail: "PaulV@gators.ufl.edu", fit: "Membership, stewardship, and external partner relationship remit.", batch: "batch1" },
  { school: "Auburn", organization: "Tigers Unlimited", contactName: "Tim Jackson", contactTitle: "Deputy AD, Tigers Unlimited", contactEmail: "tj@auburn.edu", fit: "Powerful branded booster identity with an audience that understands exclusivity.", batch: "batch1" },
  { school: "LSU", organization: "Tiger Athletic Foundation", contactName: "Matt Borman", contactTitle: "President and CEO", contactEmail: "info@lsutaf.org", fit: "TAF works across donor and NIL-adjacent angles.", batch: "batch1" },
  { school: "Texas A&M", organization: "12th Man Foundation", contactName: "Travis Dabney", contactTitle: "President and CEO", contactEmail: "travis@12thmanfoundation.com", fit: "12th Man is one of the strongest donor/fan identities in college sports.", batch: "batch1" },
  { school: "Texas", organization: "Longhorn Foundation", contactName: "Carly Northup", contactTitle: "Executive Senior Associate AD", contactEmail: null, fit: "Massive alumni base and a strong status-and-access culture; route through contact page.", batch: "batch1" },
  { school: "Ohio State", organization: "Buckeye Club", contactName: "Ben Waite", contactTitle: "Director of Annual Giving", contactEmail: "waite.51@osu.edu", fit: "Huge national fanbase with a specific annual-membership organization.", batch: "batch1" },
  { school: "Penn State", organization: "Nittany Lion Club", contactName: "Alyssa Francona", contactTitle: "Senior Associate AD for Advancement", contactEmail: "alyssa.francona@psu.edu", fit: "Strong club identity, enormous alumni network, and organized regional chapters.", batch: "batch1" },
  { school: "Michigan", organization: "Michigan Athletic Development", contactName: "Brian Kegler", contactTitle: "Executive Associate AD for Development", contactEmail: "bkegler@umich.edu", fit: "Huge alumni reach and strong demand for officially associated status.", batch: "batch1" },
  { school: "Nebraska", organization: "Huskers Athletic Fund", contactName: "Tyler Kai", contactTitle: "Deputy AD for Revenue Generation", contactEmail: "tkai@huskers.com", fit: "Concentrated statewide fan identity; direct revenue-generation owner.", batch: "batch1" },
  { school: "Oklahoma", organization: "Sooner Club", contactName: "Matt Schaeperkoetter", contactTitle: "Senior Associate AD for Athletics Advancement", contactEmail: "schaeperkoetter@ou.edu", fit: "Sooner Club fundraising plus donor and alumni engagement.", batch: "batch1" },
  { school: "Notre Dame", organization: "Monogram Club / Rockne Athletics Fund", contactName: "Matt Weldy", contactTitle: "Monogram Club Executive Director", contactEmail: "mweldy@nd.edu", fit: "Prestige, access, former-athlete credibility, and a national audience.", batch: "batch1" },
  { school: "Oregon", organization: "Duck Athletic Fund", contactName: "Justin Fisher", contactTitle: "Executive Associate AD for Development", contactEmail: "jjfisher@uoregon.edu", fit: "Strong national brand, digital sophistication, and willingness to experiment.", batch: "batch1" },
  { school: "Florida State", organization: "Seminole Boosters", contactName: "Stephen Ponder", contactTitle: "President and CEO", contactEmail: "Stephen.Ponder@fsu.edu", fit: "Distinct booster brand with a clear executive decision-maker.", batch: "batch1" },
  { school: "Ole Miss", organization: "Ole Miss Athletics Foundation", contactName: "Drew Ingraham", contactTitle: "Senior Associate AD for External Engagement", contactEmail: "ingraham@olemiss.edu", fit: "External engagement is the internal category this pitch belongs under.", batch: "batch1" },
  { school: "Kentucky", organization: "K Fund", contactName: "Candice Chaffin", contactTitle: "Senior Associate AD for Development", contactEmail: "candice.chaffin@uky.edu", fit: "Organized fundraising and donor-engagement arm for Kentucky Athletics.", batch: "batch1" },
  { school: "Arkansas", organization: "Razorback Foundation", contactName: "Ryan White", contactTitle: "Executive Director", contactEmail: "rwhite@razorbackfoundation.com", fit: "Strong statewide identity and a standalone booster brand.", batch: "batch2" },
  { school: "North Carolina", organization: "The Rams Club", contactName: "Matt Terrell", contactTitle: "Chief Strategy & Communications Officer", contactEmail: "matt@ramsclub.com", fit: "A communications, visibility, and membership-growth channel for Carolina supporters.", batch: "batch2" },
  { school: "NC State", organization: "Wolfpack Club", contactName: "Donnell Priest", contactTitle: "Director of Premium Seating & Advertising", contactEmail: "donnell.priest@wolfpackclub.com", fit: "Directly oversees advertising and sales inventory.", batch: "batch2" },
  { school: "Iowa", organization: "I-Club / Iowa Athletics Development", contactName: "Scott Brickman", contactTitle: "Associate AD for NIL Strategy & Revenue Generation", contactEmail: "Scott-Brickman@uiowa.edu", fit: "NIL, strategy, and revenue-generation owner.", batch: "batch2" },
  { school: "Missouri", organization: "Mizzou Athletics Fund", contactName: "Blair DeBord", contactTitle: "Executive Athletics Director and Chief Revenue Officer", contactEmail: "bdebord@missouri.edu", fit: "Oversees philanthropy, sponsorships, NIL, premium seating, fan engagement, and new business development.", batch: "batch2" },
  { school: "Mississippi State", organization: "Bulldog Club", contactName: "KK Seago", contactTitle: "Director of Business Partnerships", contactEmail: "kseago@athletics.msstate.edu", fit: "Responsible for third-party NIL and business-development opportunities.", batch: "batch2" },
  { school: "Wisconsin", organization: "Wisconsin Athletic Development", contactName: "Zachary Epstein", contactTitle: "Director of Annual Giving", contactEmail: "ZAE@athletics.wisc.edu", fit: "Annual-giving leaders care about adding younger supporters and repeated fan touchpoints.", batch: "batch2" },
  { school: "Kansas", organization: "Williams Education Fund", contactName: "Natalie Terwilliger", contactTitle: "Assistant Director of Annual Giving", contactEmail: "Natalie.T@ku.edu", fit: "Reasonable first contact for a $1,000 season experiment tied to acquiring and engaging Jayhawk supporters.", batch: "batch2" },
  { school: "Kansas State", organization: "Ahearn Fund", contactName: "Rob Heil", contactTitle: "Senior Associate AD for Development", contactEmail: "rheil@kstatesports.com", fit: "Leads K-State's fundraising operation and has a directly published email.", batch: "batch2" },
  { school: "Oklahoma State", organization: "POSSE / OSU NIL Alliance", contactName: "Brakston Brock", contactTitle: "Senior Associate AD for NIL Strategy & Revenue Generation", contactEmail: "brakston.brock@okstate.edu", fit: "Sits across both POSSE and the NIL operation.", batch: "batch2" },
  { school: "Texas Tech", organization: "Red Raider Club", contactName: "Andrea Tirey", contactTitle: "Senior Associate AD for Development", contactEmail: "andrea.tirey@ttu.edu", fit: "Responsible for fundraising operation and can see the value of an exclusive Red Raider position.", batch: "batch2" },
  { school: "Baylor", organization: "Bear Foundation", contactName: "Chris Lynn", contactTitle: "Executive Director", contactEmail: "Chris_Lynn@baylor.edu", fit: "Runs the Bear Foundation day-to-day operation and annual fund.", batch: "batch2" },
  { school: "Virginia Tech", organization: "Hokie Club", contactName: "Brad Wurthman", contactTitle: "Executive Associate AD and Chief Revenue Officer", contactEmail: "wurthman@vt.edu", fit: "Revenue ownership makes him likely to understand a low-cost exclusive fan-engagement asset.", batch: "batch2" },
  { school: "Virginia", organization: "Virginia Athletics Foundation", contactName: "Erin Wissing", contactTitle: "Deputy Executive Director", contactEmail: "erin.wissing@virginia.edu", fit: "Marketing, communications, events, stewardship, and organizational strategy fit.", batch: "batch2" },
  { school: "West Virginia", organization: "Mountaineer Athletic Club", contactName: "Matt Waggoner", contactTitle: "Director of Development - Annual Giving", contactEmail: "mwaggoner@wvuf.org", fit: "Intense statewide fan identity and direct annual-giving/supporter acquisition remit.", batch: "batch2" },
  { school: "Miami", organization: "Hurricane Club", contactName: "Kayla Blake Grimes", contactTitle: "Assistant VP, Hurricane Club & Premium Sales", contactEmail: "athleticdevelopment@miami.edu", fit: "Manages the Hurricane Club annual fund and premium sales.", batch: "batch2" },
  { school: "Michigan State", organization: "Spartan Fund", contactName: "Jacob Kirkham", contactTitle: "Executive Director, Athletics Constituency Programs", contactEmail: "kirkham@ath.msu.edu", fit: "Leads athletics advancement constituency and is senior enough to approve a branded test.", batch: "batch2" },
  { school: "Washington", organization: "Tyee Club", contactName: "Troy Welin", contactTitle: "Director of the Annual Fund", contactEmail: "welint@uw.edu", fit: "Uses broad supporter participation, making the huddle-growth angle relevant.", batch: "batch2" },
  { school: "BYU", organization: "Cougar Club", contactName: "Randall Hild", contactTitle: "Associate AD for Development", contactEmail: "randall_hild@byu.edu", fit: "Oversees Cougar Club activities, renewals, events, and membership growth strategies.", batch: "batch2" },
  { school: "Utah", organization: "Crimson Club", contactName: "JT Tumanuvao", contactTitle: "Director of Annual Giving", contactEmail: "jtumanuvao@huntsman.utah.edu", fit: "Owns annual giving and is a strong entry point for a $1,000 season exclusive test.", batch: "batch2" },
  { school: "SMU", organization: "Mustang Club", contactName: "Kirsten Brown", contactTitle: "Assistant AD for Development", contactEmail: "kirstenbrown@smu.edu", fit: "A clear booster-club fit for owning the Mustang fan position before growth opens publicly.", batch: "batch3" },
  { school: "TCU", organization: "Frog Club", contactName: "Nick Parsons", contactTitle: "Associate AD, Loyalty Giving", contactEmail: "nick.parsons@tcu.edu", fit: "Loyalty giving maps directly to repeat fan touchpoints and membership energy.", batch: "batch3" },
  { school: "Indiana", organization: "Varsity Club", contactName: "Kevin Van Rooy", contactTitle: "Senior Associate AD/Director", contactEmail: "kvanrooy@iu.edu", fit: "Senior annual giving leader for a passionate statewide alumni base.", batch: "batch3" },
  { school: "UCF", organization: "ChargeOn Fund", contactName: "Latoya Jackson", contactTitle: "Associate AD, Annual Giving", contactEmail: "ljackson@athletics.ucf.edu", fit: "Annual giving owner for a fast-growing fan and alumni base.", batch: "batch3" },
  { school: "Arizona", organization: "Wildcat Club", contactName: "Trevor Wilkey", contactTitle: "Annual Giving & Development Operations", contactEmail: "trevorwilkey@arizona.edu", fit: "Annual giving and development operations can test a low-cost exclusive fan position.", batch: "batch3" },
  { school: "Arizona State", organization: "Sun Devil Club", contactName: "Scott Nelson", contactTitle: "VP of Enterprise Development", contactEmail: "Scott.D.Nelson@asu.edu", fit: "Enterprise development owner with a natural fit for a new fan-engagement channel.", batch: "batch3" },
  { school: "Houston", organization: "Cougar Pride", contactName: "Alvin Franklin", contactTitle: "Chief Revenue Officer", contactEmail: "arfrank4@central.uh.edu", fit: "Revenue leadership can evaluate an exclusive position attached to Cougar fan rooms.", batch: "batch3" },
  { school: "Boise State", organization: "Bronco Athletic Association", contactName: "Austin Mullen", contactTitle: "Associate AD, Development", contactEmail: "austinmullen@boisestate.edu", fit: "Strong regional identity and direct development ownership.", batch: "batch3" },
  { school: "Cincinnati", organization: "UCATS", contactName: "Niki Cianciola", contactTitle: "Director, UCATS", contactEmail: "nikol.cianciola@foundation.uc.edu", fit: "UCATS is the branded supporter arm for an audience that can understand exclusivity.", batch: "batch3" },
  { school: "Illinois", organization: "I FUND", contactName: "Brian Russell", contactTitle: "Chief Commercial Officer", contactEmail: "brussui@illinois.edu", fit: "Commercial leadership should understand a reserved fan-engagement asset.", batch: "batch3" },
  { school: "Tulane", organization: "Green Wave Club", contactName: "Mike Miller", contactTitle: "Associate AD, Revenue Generation", contactEmail: "mmiller12@tulane.edu", fit: "Revenue generation remit fits a direct $1,000/season founding partnership test.", batch: "batch3" },
  { school: "Memphis", organization: "Memphis Athletics Fund", contactName: "Chris Condit", contactTitle: "Associate AD, Revenue & Analytics", contactEmail: "chris.condit@memphis.edu", fit: "Revenue and analytics owner can evaluate early traction and supporter growth.", batch: "batch3" },
  { school: "Boston College", organization: "Flynn Fund", contactName: "Joey McIntyre", contactTitle: "Assistant AD, Annual Giving", contactEmail: "Joseph.McIntyre@bc.edu", fit: "Annual giving owner for a branded athletics fund with alumni and regional reach.", batch: "batch3" },
  { school: "Colorado", organization: "Buff Club", contactName: "Adrian Pina", contactTitle: "Assistant AD, Annual Giving & Premium Seating", contactEmail: "Adrian.Pina@colorado.edu", fit: "Annual giving and premium seating remit connects to fan access and recurring engagement.", batch: "batch3" },
  { school: "Duke", organization: "Iron Dukes", contactName: "Jennifer Hughes", contactTitle: "Director, Annual Fund", contactEmail: "jennifer.hughes@duke.edu", fit: "Annual fund leader for a high-affinity donor and alumni audience.", batch: "batch3" },
  { school: "Georgia Tech", organization: "Alexander-Tharpe Fund", contactName: "Robby Poteat", contactTitle: "Executive Director of Development", contactEmail: "rpoteat@athletics.gatech.edu", fit: "Development executive with a clear path to test a new supporter visibility product.", batch: "batch3" },
  { school: "Iowa State", organization: "Cyclone Club", contactName: "Blair Danner", contactTitle: "Associate Director, Annual Giving", contactEmail: "bdanner@iastate.edu", fit: "Annual giving and Cyclone Club supporter identity align with the pitch.", batch: "batch3" },
  { school: "Louisville", organization: "Cardinal Athletic Fund", contactName: "Ryan Tuttle", contactTitle: "Associate Director, Annual Fund", contactEmail: "ryant@gocards.com", fit: "Annual fund owner for a recognizable athletics supporter organization.", batch: "batch3" },
  { school: "Pittsburgh", organization: "Panther Club/NIL", contactName: "Pat Bostick", contactTitle: "NIL Business Development & Strategic Partnerships", contactEmail: "pbostick@athletics.pitt.edu", fit: "NIL and strategic partnerships remit fits exclusive fan-room visibility.", batch: "batch3" },
  { school: "Purdue", organization: "John Purdue Club", contactName: "Meghan King", contactTitle: "Revenue Generation & Development", contactEmail: "king556@purdue.edu", fit: "Revenue generation and development owner for a branded supporter club.", batch: "batch3" },
  { school: "Syracuse", organization: "'Cuse Athletics Fund", contactName: "Antonio Barbosa", contactTitle: "Assistant AD, Annual Fund", contactEmail: "ambarbos@syr.edu", fit: "Annual fund owner with a clear supporter-growth remit.", batch: "batch3" },
  { school: "USC", organization: "Trojan Athletic Fund", contactName: "Michael Rorabaugh", contactTitle: "Chief Development Officer", contactEmail: "rorabaug@usc.edu", fit: "Chief development owner for a national alumni brand.", batch: "batch3" },
  { school: "Vanderbilt", organization: "National Commodore Club", contactName: "Mark Carter", contactTitle: "Senior Executive Director", contactEmail: "ncc@vanderbilt.edu", fit: "National Commodore Club is the supporter brand; route the email to Mark Carter through the public inbox.", batch: "batch3" },
  { school: "Wake Forest", organization: "Deacon Club", contactName: "Barry Faircloth", contactTitle: "Executive Associate AD, Development & Sales", contactEmail: "fairclbw@wfu.edu", fit: "Development and sales leader with a direct path to test a founding partnership.", batch: "batch3" },
];

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
  return value || "$1,500";
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
  const [importingProspects, setImportingProspects] = useState(false);

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
  const [view, setView] = useState<"school" | "priority" | "all" | "contacted" | "followup">("school");
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

  async function importSchoolPartnerProspects() {
    setImportingProspects(true);
    try {
      const rows = SCHOOL_PARTNER_PROSPECTS.map((p) => ({
        company: p.organization,
        vertical: SCHOOL_PARTNER_VERTICAL,
        region: p.batch === "batch3" ? "College athletics batch 3" : p.batch === "batch2" ? "College athletics batch 2" : "College athletics batch 1",
        market: p.school,
        school: p.school,
        website: null,
        domain: p.contactEmail ? p.contactEmail.split("@").pop()?.toLowerCase() ?? null : null,
        contact_name: p.contactName,
        contact_title: p.contactTitle,
        contact_email: p.contactEmail,
        email_confidence: p.contactEmail ? "high" : "manual",
        priority: "TIER1",
        sponsor_signal: p.fit,
        sponsor_score: 20,
        best_package: "$1,000/season",
        best_angle: `Official Side Huddle Partner for ${p.school}`,
        status: "Drafted",
        notes: p.contactEmail ? `school partner ${p.batch}` : `school partner ${p.batch}; no direct public email listed; route through the contact page.`,
      }));

      const withEmail = rows.filter((r) => r.contact_email);
      const withoutEmail = rows.filter((r) => !r.contact_email);

      if (withEmail.length) {
        const { error } = await (supabase as any)
          .from("sponsor_leads")
          .upsert(withEmail, { onConflict: "contact_email" });
        if (error) throw error;
      }
      if (withoutEmail.length) {
        const { data: existingNoEmail, error: existingError } = await (supabase as any)
          .from("sponsor_leads")
          .select("company,school")
          .eq("vertical", SCHOOL_PARTNER_VERTICAL)
          .is("contact_email", null);
        if (existingError) throw existingError;
        const existingKeys = new Set(
          ((existingNoEmail || []) as Array<{ company: string; school: string | null }>).map((r) => `${r.company}|${r.school || ""}`),
        );
        const missingNoEmail = withoutEmail.filter((r) => !existingKeys.has(`${r.company}|${r.school || ""}`));
        if (missingNoEmail.length) {
          const { error } = await (supabase as any)
            .from("sponsor_leads")
            .insert(missingNoEmail);
          if (error) throw error;
        }
      }

      toast({
        title: "School partner batch loaded",
        description: `${SCHOOL_PARTNER_PROSPECTS.length} prospects drafted; ${withEmail.length} are ready to send.`,
      });
      setView("school");
      setCampaign("school_partner_batch_3");
      await loadLeads();
    } catch (e) {
      toast({
        title: "Import failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setImportingProspects(false);
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

  function pitchText(l: Lead) {
    if (isSchoolPartnerLead(l)) {
      const schoolName = l.school || l.market || "your school";
      const organization = l.company;
      const huddleName = huddleLabelForSchool(schoolName);
      return `Subject: ${pitchSubject(l)}\n\nHi ${l.contact_name?.split(" ")[0] || "there"},\n\nImagine every group of ${huddleName} fans - alumni chapters, students, fraternities, families, tailgates and lifelong friends - having its own private, AI-enhanced ${huddleName} huddle.\n\nLive scores, news, highlights and game-day prompts flow into the room while fans talk with their own people, see where friends are active and jump from huddle to huddle.\n\nNow imagine one organization visible across all of it.\n\nWe think that should be ${organization}.\n\nYou would not have to manage another community or create another content channel. You would be the exclusive partner across every ${huddleName} huddle fans create - sponsoring the fandom at the moments it is most alive.\n\nEvery new room, invitation and fan group grows your presence.\n\nThis school will have a Side Huddle presence. The question is whether ${organization} owns that position, or someone else does.\n\nReserve the ${huddleName} Side Huddle partnership for $1,000 for the season ($500 holds it):\n\nhttps://www.sidehuddlesports.com/sponsors\n\nTy Bailey\nFounder, Side Huddle Sports`;
    }
    const where = l.school || l.market || l.region || "your local team";
    const fans = where === "your local team"
      ? "local fans, friends, parents, and alumni"
      : `${where} fans, friends, parents, and alumni`;
    return `Hi ${l.contact_name?.split(" ")[0] || "there"},\n\nI am opening one exclusive local sponsor slot for ${where} on Side Huddle Sports.\n\nSide Huddle is an AI-enhanced private chat experience where ${fans} meet around the team — before games, during games, and all week.\n\nThe ${where} sponsor is placed across the ${where} rooms, inside the conversation, not just on one page or one ad.\n\nYou can hold the ${where} slot today for $500, with $1,000 covering the full season. It locks your exclusivity as the local sponsor for that team.\n\nFounding sponsors keep that rate for as long as they stay, and if the team's huddles don't reach 250 members this season, the next season is on us.\n\nHere is the sponsor page: https://sidehuddlesports.com/sponsors\n\nTy`;
  }

  function pitchSubject(l: Lead) {
    if (isSchoolPartnerLead(l)) {
      return `The Official Side Huddle Partner for ${l.school || l.market || "your school"}`;
    }
    const where = l.school || l.market || l.region || "your local team";
    return `${where} sponsor slot on Side Huddle`;
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
              <h1 className="text-3xl font-bold text-foreground">
                {audience === "work" ? "Outreach by team" : audience === "coverage" ? "Coverage" : audience === "creators" ? "Creator Outreach" : audience === "chapters" ? "Chapter Outreach" : "Sponsor Prospecting Engine"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {audience === "chapters"
                  ? "Fan-club and alumni chapters, ranked by reachability. Contact the president, they bring the group."
                  : "Build local sponsor maps by school, score the warmest fits, and work the follow-up queue."}
              </p>
            </div>
            {audience === "sponsors" && (
              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-6">
                <Metric label="Leads" value={metrics.total} />
                <Metric label="Schools" value={metrics.schoolPartners} />
                <Metric label="12+ score" value={metrics.priority} />
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
              variant={audience === "chapters" ? "default" : "outline"}
              size="sm"
              onClick={() => setAudience("chapters")}
            >
              Chapters
            </Button>
            <Button
              variant={audience === "creators" ? "default" : "outline"}
              size="sm"
              onClick={() => setAudience("creators")}
            >
              Creators
            </Button>
            {/* Every other tab answers "what is in my list". This one answers
                "where have I been", which is the question you ask before
                deciding where to spend a morning. */}
            <Button
              variant={audience === "coverage" ? "default" : "outline"}
              size="sm"
              onClick={() => setAudience("coverage")}
            >
              Where I've been
            </Button>
          </div>
        </div>
      </div>

      {audience === "work" ? <WorkPanel /> : audience === "coverage" ? <CoveragePanel /> : audience === "creators" ? <CreatorsPanel /> : audience === "chapters" ? <ChaptersPanel /> : (

      <div className="container mx-auto grid gap-6 px-4 py-8 xl:grid-cols-[390px,1fr]">
        <div className="space-y-6">
          <BrevoImport onDone={loadLeads} />

          <Card className="space-y-4 p-5">
            <div>
              <h2 className="text-lg font-semibold">School Partner Batch</h2>
              <p className="text-sm text-muted-foreground">
                Load the booster and NIL prospects, with their contact and school context.
              </p>
            </div>
            <Button className="w-full gap-2" variant="secondary" onClick={importSchoolPartnerProspects} disabled={importingProspects}>
              <UploadCloud className="h-4 w-4" />
              {importingProspects ? "Loading..." : "Load school partner drafts"}
            </Button>
          </Card>

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

          <Card className="space-y-4 p-5">
            <div>
              <h2 className="text-lg font-semibold">Email Sequence</h2>
              <p className="text-sm text-muted-foreground">
                Use after reviewing the priority list. Test mode previews recipients first.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <Label htmlFor="live" className="cursor-pointer">
                  {live ? "Live send" : "Test mode"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {live ? "Emails will actually send." : "Nothing sends until this is on."}
                </p>
              </div>
              <Switch id="live" checked={live} onCheckedChange={setLive} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign">Campaign</Label>
              <select
                id="campaign"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={campaign}
                onChange={(e) => setCampaign(e.target.value as Campaign)}
              >
                {audiences.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label} ({a.ready} ready{a.noEmail ? `, ${a.noEmail} need an email` : ""})
                  </option>
                ))}
                <option value="all">Everyone ({leads.length})</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Step 1 only targets unsent leads. Already-sent leads are skipped automatically.
                {campaign === "all"
                  ? " Everyone means every unsent lead of every kind."
                  : ` Table is filtered to ${campaignLabel(campaign)}.`}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxEmails">Max emails</Label>
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
                <Button key={step} variant={step === 1 ? "default" : "outline"} onClick={() => runSend(step)} disabled={sending !== null}>
                  <Mail className="mr-1 h-4 w-4" />
                  {sending === step ? "..." : `Step ${step}`}
                </Button>
              ))}
            </div>
          </Card>

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
                        <div className="text-sm">{l.best_angle || "Player of the Week"}</div>
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
