// One-shot seeder: attach SB Nation team-blog RSS feeds to teams so the news
// bot can pull inline action photos (Source 2). SB Nation runs a team-specific
// blog per franchise whose RSS embeds Getty/Imagn photos in each item.
//
// This version VERIFIES each candidate feed from the edge (200 + items + image)
// before inserting, so wrong/dead slugs are auto-rejected. Guarded by SEED_TOKEN.
//
// Deploy, invoke per league, then delete:
//   supabase functions deploy seed-news-feeds
//   curl -X POST .../seed-news-feeds -d '{"token":"<SEED_TOKEN>","league":"NFL"}'
//   supabase functions delete seed-news-feeds
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// (city|name) -> sbnation blog slug. Feed = https://www.<slug>.com/rss/index.xml
const MAPS: Record<string, Record<string, string>> = {
  MLB: {
    "Arizona|Diamondbacks": "azsnakepit", "Atlanta|Braves": "talkingchop",
    "Baltimore|Orioles": "camdenchat", "Boston|Red Sox": "overthemonster",
    "Chicago|White Sox": "southsidesox", "Chicago|Cubs": "bleedcubbieblue",
    "Cincinnati|Reds": "redreporter", "Cleveland|Guardians": "letsgotribe",
    "Colorado|Rockies": "purplerow", "Detroit|Tigers": "blessyouboys",
    "Houston|Astros": "crawfishboxes", "Kansas City|Royals": "royalsreview",
    "Los Angeles|Angels": "halosheaven", "Los Angeles|Dodgers": "truebluela",
    "Miami|Marlins": "fishstripes", "Milwaukee|Brewers": "brewcrewball",
    "Minnesota|Twins": "twinkietown", "New York|Mets": "amazinavenue",
    "New York|Yankees": "pinstripealley", "Oakland|Athletics": "athleticsnation",
    "Philadelphia|Phillies": "thegoodphight", "Pittsburgh|Pirates": "bucsdugout",
    "San Diego|Padres": "gaslampball", "San Francisco|Giants": "mccoveychronicles",
    "Seattle|Mariners": "lookoutlanding", "St. Louis|Cardinals": "vivaelbirdos",
    "Tampa Bay|Rays": "draysbay", "Texas|Rangers": "lonestarball",
    "Toronto|Blue Jays": "bluebirdbanter", "Washington|Nationals": "federalbaseball",
  },
  NFL: {
    "Arizona|Cardinals": "revengeofthebirds", "Atlanta|Falcons": "thefalcoholic",
    "Baltimore|Ravens": "baltimorebeatdown", "Buffalo|Bills": "buffalorumblings",
    "Carolina|Panthers": "catscratchreader", "Chicago|Bears": "windycitygridiron",
    "Cincinnati|Bengals": "cincyjungle", "Cleveland|Browns": "dawgsbynature",
    "Dallas|Cowboys": "bloggingtheboys", "Denver|Broncos": "milehighreport",
    "Detroit|Lions": "prideofdetroit", "Green Bay|Packers": "acmepackingcompany",
    "Houston|Texans": "battleredblog", "Indianapolis|Colts": "stampedeblue",
    "Jacksonville|Jaguars": "bigcatcountry", "Kansas City|Chiefs": "arrowheadpride",
    "Las Vegas|Raiders": "silverandblackpride", "Los Angeles|Chargers": "boltsfromtheblue",
    "Los Angeles|Rams": "turfshowtimes", "Miami|Dolphins": "thephinsider",
    "Minnesota|Vikings": "dailynorseman", "New England|Patriots": "patspulpit",
    "New Orleans|Saints": "canalstreetchronicles", "New York|Giants": "bigblueview",
    "New York|Jets": "ganggreennation", "Philadelphia|Eagles": "bleedinggreennation",
    "Pittsburgh|Steelers": "behindthesteelcurtain", "San Francisco|49ers": "ninersnation",
    "Seattle|Seahawks": "fieldgulls", "Tampa Bay|Buccaneers": "bucsnation",
    "Tennessee|Titans": "musiccitymiracles", "Washington|Commanders": "hogshaven",
  },
  NBA: {
    "Atlanta|Hawks": "peachtreehoops", "Boston|Celtics": "celticsblog",
    "Brooklyn|Nets": "netsdaily", "Charlotte|Hornets": "atthehive",
    "Chicago|Bulls": "blogabull", "Cleveland|Cavaliers": "fearthesword",
    "Dallas|Mavericks": "mavsmoneyball", "Denver|Nuggets": "denverstiffs",
    "Detroit|Pistons": "detroitbadboys", "Golden State|Warriors": "goldenstateofmind",
    "Houston|Rockets": "thedreamshake", "Indiana|Pacers": "indycornrows",
    "Los Angeles|Clippers": "clipsnation", "Los Angeles|Lakers": "silverscreenandroll",
    "Memphis|Grizzlies": "grizzlybearblues", "Miami|Heat": "hothothoops",
    "Milwaukee|Bucks": "brewhoop", "Minnesota|Timberwolves": "canishoopus",
    "New Orleans|Pelicans": "thebirdwrites", "New York|Knicks": "postingandtoasting",
    "Oklahoma City|Thunder": "welcometoloudcity", "Orlando|Magic": "orlandopinstripedpost",
    "Philadelphia|76ers": "libertyballers", "Phoenix|Suns": "brightsideofthesun",
    "Portland|Trail Blazers": "blazersedge", "Sacramento|Kings": "sactownroyalty",
    "San Antonio|Spurs": "poundingtherock", "Toronto|Raptors": "raptorshq",
    "Utah|Jazz": "slcdunk", "Washington|Wizards": "bulletsforever",
  },
  NHL: {
    "Anaheim|Ducks": "anaheimcalling", "Boston|Bruins": "stanleycupofchowder",
    "Buffalo|Sabres": "diebytheblade", "Calgary|Flames": "matchsticksandgasoline",
    "Carolina|Hurricanes": "canescountry", "Chicago|Blackhawks": "secondcityhockey",
    "Colorado|Avalanche": "milehighhockey", "Columbus|Blue Jackets": "jacketscannon",
    "Dallas|Stars": "defendingbigd", "Detroit|Red Wings": "wingingitinmotown",
    "Edmonton|Oilers": "copperandblue", "Florida|Panthers": "litterboxcats",
    "Los Angeles|Kings": "jewelsfromthecrown", "Minnesota|Wild": "hockeywilderness",
    "Montreal|Canadiens": "habseyesontheprize", "Nashville|Predators": "ontheforecheck",
    "New Jersey|Devils": "allaboutthejersey", "New York|Islanders": "lighthousehockey",
    "New York|Rangers": "blueshirtbanter", "Ottawa|Senators": "silversevensens",
    "Philadelphia|Flyers": "broadstreethockey", "Pittsburgh|Penguins": "pensburgh",
    "San Jose|Sharks": "fearthefin", "St. Louis|Blues": "stlouisgametime",
    "Tampa Bay|Lightning": "rawcharge", "Toronto|Maple Leafs": "pensionplanpuppets",
    "Vancouver|Canucks": "nucksmisconduct", "Vegas|Golden Knights": "knightsonice",
    "Washington|Capitals": "japersrink", "Winnipeg|Jets": "arcticicehockey",
  },
  NCAA: {
    "Alabama|Crimson Tide": "rollbamaroll", "Auburn|Tigers": "collegeandmagnolia",
    "LSU|Tigers": "anddthevalleyshook", "Florida|Gators": "alligatorarmy",
    "Georgia|Bulldogs": "dawgsports", "Tennessee|Volunteers": "rockytoptalk",
    "Texas A&M|Aggies": "goodbullhunting", "Ole Miss|Rebels": "redcuprebellion",
    "Florida State|Seminoles": "tomahawknation", "Notre Dame|FIghting Irish": "onefootdown",
    "Michigan|Wolverines": "maizenbrew", "Michigan State|Spartans": "theonlycolors",
    "Ohio State|Buckeyes": "landgrantholyland", "Penn State|Nittany Lions": "blackshoediaries",
    "Wisconsin|Badgers": "buckys5thquarter", "Nebraska|Cornhuskers": "cornnation",
    "Oklahoma|Sooners": "crimsonandcreammachine", "Texas|Longhorns": "burntorangenation",
    "USC|Trojans": "conquestchronicles", "UCLA|Bruins": "bruinsnation",
    "Oregon|Ducks": "addictedtoquack", "Colorado|Buffaloes": "ralphiereport",
    "Iowa|Hawkeyes": "blackheartgoldpants", "Minnesota|Golden Gophers": "thedailygopher",
    "North Carolina|Tar Heels": "tarheelblog", "Virginia Tech|Hokies": "gobblercountry",
    "Pitt|Panthers": "cardiachill", "Syracuse|Orange": "nunesmagician",
    "Louisville|Cardinals": "cardchronicle", "Boston College|Eagles": "bcinterruption",
    "NC State|Wolfpack": "backingthepack", "Maryland|Terrapins": "testudotimes",
    "Rutgers|Scarlet Knights": "onthebanks", "Indiana|Hoosiers": "crimsonquarry",
    "Purdue|Boilermakers": "hammerandrails", "Illinois|Fighting Illini": "thechampaignroom",
    "Northwestern|Wildcats": "insidenu", "Kentucky|Wildcats": "aseaofblue",
    "Missouri|Tigers": "rockmnation", "South Carolina|Gamecocks": "garnetandblackattack",
    "Mississippi State|Bulldogs": "forwhomthecowbelltolls", "Arkansas|Razorbacks": "arkansasfight",
    "Texas Tech|Red Raiders": "vivathematadors", "Kansas|Jayhawks": "rockchalktalk",
    "Kansas State|Wildcats": "bringonthecats", "Oklahoma State|Cowboys": "cowboysrideforfree",
    "Iowa State|Cyclones": "widerightnatlee", "West Virginia|Mountaineers": "smokingmusket",
    "TCU|Horned Frogs": "frogsowar", "Baylor|Bears": "ourdailybears",
    "Cincinnati|Bearcats": "downthedrive", "UCF|Knights": "blackandgoldbanneret",
    "California|Golden Bears": "californiagoldenblogs", "Washington|Huskies": "uwdawgpound",
    "Utah|Utes": "blocku", "Arizona|Wildcats": "arizonadesertswarm",
    "Arizona State|Sun Devils": "houseofsparky", "Clemson|Tigers": "shakinthesouthland",
    "Wake Forest|Demon Deacons": "bloggersodeacon", "Georgia Tech|Yellow Jackets": "frombtherumbleseat",
    "Miami|Hurricanes": "stateoftheu", "Stanford|Cardinal": "ruleoftree",
  },
};

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function fetchHead(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/html, */*" } });
    if (!r.ok) return null;
    return (await r.text()).slice(0, 120000);
  } catch {
    return null;
  }
}

function looksLikeFeed(xml: string): boolean {
  const items = (xml.match(/<item>|<entry[\s>]/gi) || []).length;
  return items >= 1 && /<img[^>]+src=|<media:(content|thumbnail)/i.test(xml);
}

// Returns the working feed URL for a slug, or null. Tries the standard SB Nation
// path; if that 404s, discovers the feed from the homepage's <link alternate>.
async function resolveFeed(slug: string): Promise<string | null> {
  const std = `https://www.${slug}.com/rss/index.xml`;
  const x = await fetchHead(std);
  if (x && looksLikeFeed(x)) return std;

  const home = await fetchHead(`https://www.${slug}.com/`);
  if (!home) return null;
  const m = home.match(/<link[^>]+type="application\/(?:rss|atom)\+xml"[^>]*href="([^"]+)"/i)
        || home.match(/href="([^"]+)"[^>]+type="application\/(?:rss|atom)\+xml"/i);
  if (!m) return null;
  let feed = m[1].replace(/&amp;/g, "&");
  if (feed.startsWith("/")) feed = `https://www.${slug}.com${feed}`;
  const y = await fetchHead(feed);
  return y && looksLikeFeed(y) ? feed : null;
}

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const body = await req.json().catch(() => ({}));
  if (body.token !== Deno.env.get("SEED_TOKEN")) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const league = body.league || "MLB";
  const map = MAPS[league];
  if (!map) return new Response(JSON.stringify({ error: `no map for ${league}` }), { status: 400 });

  const { data: teams, error: teamErr } = await supabase
    .from("teams").select("id, city, name").eq("league", league);
  if (teamErr) return new Response(JSON.stringify({ error: teamErr.message }), { status: 500 });

  const byKey = new Map<string, string>();
  for (const t of teams ?? []) byKey.set(`${t.city}|${t.name}`, t.id);

  const rows: { team_id: string; feed_url: string; source_label: string }[] = [];
  const verified: string[] = [], failed: string[] = [], unmatched: string[] = [];

  // Verify in small concurrent batches to avoid hammering Vox.
  const entries = Object.entries(map);
  for (let i = 0; i < entries.length; i += 3) {
    await Promise.all(entries.slice(i, i + 3).map(async ([key, slug]) => {
      const teamId = byKey.get(key);
      if (!teamId) { unmatched.push(key); return; }
      const url = await resolveFeed(slug);
      if (url) {
        rows.push({ team_id: teamId, feed_url: url, source_label: "sbnation" });
        verified.push(`${key} -> ${url}`);
      } else {
        failed.push(`${key} -> ${slug}`);
      }
    }));
  }

  let upserted = 0;
  if (rows.length) {
    const { error: upErr, count } = await supabase
      .from("team_feeds").upsert(rows, { onConflict: "team_id,feed_url", ignoreDuplicates: true, count: "exact" });
    if (upErr) return new Response(JSON.stringify({ error: upErr.message, verified, failed }), { status: 500 });
    upserted = count ?? rows.length;
  }

  return new Response(
    JSON.stringify({ league, verifiedCount: verified.length, upserted, failed, unmatched }, null, 2),
    { headers: { "Content-Type": "application/json" } },
  );
});
