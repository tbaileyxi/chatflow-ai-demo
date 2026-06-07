export type DevTeam = {
  id: string;
  name: string;
  city: string;
  logoUrl: string | null;
  league: string;
  espnSlug: string;
};

export type DevFriend = {
  id: string;
  name: string;
  avatar: string;
  status: "watching" | "online" | "away";
  roomName: string;
  teamId: string;
};

export const DEV_FOLLOWS_STORAGE_KEY = "side-huddle-dev-followed-teams";
export const DEV_ROOMS_STORAGE_KEY = "side-huddle-dev-rooms";

type TeamSeed = [league: string, city: string, name: string, espnSlug: string, legacyId?: string];

const TEAM_SEEDS: TeamSeed[] = [
  ["NFL", "Buffalo", "Bills", "buf"],
  ["NFL", "Miami", "Dolphins", "mia"],
  ["NFL", "New England", "Patriots", "ne"],
  ["NFL", "New York", "Jets", "nyj"],
  ["NFL", "Baltimore", "Ravens", "bal"],
  ["NFL", "Cincinnati", "Bengals", "cin"],
  ["NFL", "Cleveland", "Browns", "cle"],
  ["NFL", "Pittsburgh", "Steelers", "pit"],
  ["NFL", "Houston", "Texans", "hou"],
  ["NFL", "Indianapolis", "Colts", "ind"],
  ["NFL", "Jacksonville", "Jaguars", "jax"],
  ["NFL", "Tennessee", "Titans", "ten"],
  ["NFL", "Denver", "Broncos", "den"],
  ["NFL", "Kansas City", "Chiefs", "kc", "10000000-0000-4000-8000-000000000006"],
  ["NFL", "Las Vegas", "Raiders", "lv"],
  ["NFL", "Los Angeles", "Chargers", "lac"],
  ["NFL", "Dallas", "Cowboys", "dal"],
  ["NFL", "New York", "Giants", "nyg"],
  ["NFL", "Philadelphia", "Eagles", "phi"],
  ["NFL", "Washington", "Commanders", "wsh"],
  ["NFL", "Chicago", "Bears", "chi", "10000000-0000-4000-8000-000000000001"],
  ["NFL", "Detroit", "Lions", "det"],
  ["NFL", "Green Bay", "Packers", "gb"],
  ["NFL", "Minnesota", "Vikings", "min"],
  ["NFL", "Atlanta", "Falcons", "atl"],
  ["NFL", "Carolina", "Panthers", "car"],
  ["NFL", "New Orleans", "Saints", "no"],
  ["NFL", "Tampa Bay", "Buccaneers", "tb"],
  ["NFL", "Arizona", "Cardinals", "ari"],
  ["NFL", "Los Angeles", "Rams", "lar"],
  ["NFL", "San Francisco", "49ers", "sf"],
  ["NFL", "Seattle", "Seahawks", "sea"],

  ["NBA", "Boston", "Celtics", "bos"],
  ["NBA", "Brooklyn", "Nets", "bkn"],
  ["NBA", "New York", "Knicks", "ny", "10000000-0000-4000-8000-000000000009"],
  ["NBA", "Philadelphia", "76ers", "phi"],
  ["NBA", "Toronto", "Raptors", "tor"],
  ["NBA", "Chicago", "Bulls", "chi", "10000000-0000-4000-8000-000000000002"],
  ["NBA", "Cleveland", "Cavaliers", "cle"],
  ["NBA", "Detroit", "Pistons", "det"],
  ["NBA", "Indiana", "Pacers", "ind"],
  ["NBA", "Milwaukee", "Bucks", "mil"],
  ["NBA", "Atlanta", "Hawks", "atl"],
  ["NBA", "Charlotte", "Hornets", "cha"],
  ["NBA", "Miami", "Heat", "mia"],
  ["NBA", "Orlando", "Magic", "orl"],
  ["NBA", "Washington", "Wizards", "wsh"],
  ["NBA", "Denver", "Nuggets", "den"],
  ["NBA", "Minnesota", "Timberwolves", "min"],
  ["NBA", "Oklahoma City", "Thunder", "okc"],
  ["NBA", "Portland", "Trail Blazers", "por"],
  ["NBA", "Utah", "Jazz", "uta"],
  ["NBA", "Golden State", "Warriors", "gs"],
  ["NBA", "Los Angeles", "Clippers", "lac"],
  ["NBA", "Los Angeles", "Lakers", "lal", "10000000-0000-4000-8000-000000000005"],
  ["NBA", "Phoenix", "Suns", "phx"],
  ["NBA", "Sacramento", "Kings", "sac"],
  ["NBA", "Dallas", "Mavericks", "dal"],
  ["NBA", "Houston", "Rockets", "hou"],
  ["NBA", "Memphis", "Grizzlies", "mem"],
  ["NBA", "New Orleans", "Pelicans", "no"],
  ["NBA", "San Antonio", "Spurs", "sa"],

  ["MLB", "New York", "Yankees", "nyy", "10000000-0000-4000-8000-000000000004"],
  ["MLB", "Boston", "Red Sox", "bos"],
  ["MLB", "Toronto", "Blue Jays", "tor"],
  ["MLB", "Tampa Bay", "Rays", "tb"],
  ["MLB", "Baltimore", "Orioles", "bal"],
  ["MLB", "Cleveland", "Guardians", "cle"],
  ["MLB", "Minnesota", "Twins", "min"],
  ["MLB", "Chicago", "White Sox", "chw"],
  ["MLB", "Detroit", "Tigers", "det"],
  ["MLB", "Kansas City", "Royals", "kc"],
  ["MLB", "Houston", "Astros", "hou"],
  ["MLB", "Texas", "Rangers", "tex"],
  ["MLB", "Seattle", "Mariners", "sea"],
  ["MLB", "Los Angeles", "Angels", "laa"],
  ["MLB", "Athletics", "Athletics", "ath"],
  ["MLB", "Atlanta", "Braves", "atl"],
  ["MLB", "Philadelphia", "Phillies", "phi"],
  ["MLB", "New York", "Mets", "nym"],
  ["MLB", "Miami", "Marlins", "mia"],
  ["MLB", "Washington", "Nationals", "wsh"],
  ["MLB", "Milwaukee", "Brewers", "mil"],
  ["MLB", "Chicago", "Cubs", "chc", "10000000-0000-4000-8000-000000000003"],
  ["MLB", "Cincinnati", "Reds", "cin"],
  ["MLB", "Pittsburgh", "Pirates", "pit"],
  ["MLB", "St. Louis", "Cardinals", "stl"],
  ["MLB", "Los Angeles", "Dodgers", "lad"],
  ["MLB", "San Diego", "Padres", "sd"],
  ["MLB", "San Francisco", "Giants", "sf"],
  ["MLB", "Arizona", "Diamondbacks", "ari"],
  ["MLB", "Colorado", "Rockies", "col"],

  ["NHL", "Boston", "Bruins", "bos"],
  ["NHL", "Buffalo", "Sabres", "buf"],
  ["NHL", "Detroit", "Red Wings", "det"],
  ["NHL", "Florida", "Panthers", "fla"],
  ["NHL", "Montreal", "Canadiens", "mtl"],
  ["NHL", "Ottawa", "Senators", "ott"],
  ["NHL", "Tampa Bay", "Lightning", "tb"],
  ["NHL", "Toronto", "Maple Leafs", "tor"],
  ["NHL", "Carolina", "Hurricanes", "car"],
  ["NHL", "Columbus", "Blue Jackets", "cbj"],
  ["NHL", "New Jersey", "Devils", "nj"],
  ["NHL", "New York", "Islanders", "nyi"],
  ["NHL", "New York", "Rangers", "nyr"],
  ["NHL", "Philadelphia", "Flyers", "phi"],
  ["NHL", "Pittsburgh", "Penguins", "pit"],
  ["NHL", "Washington", "Capitals", "wsh"],
  ["NHL", "Chicago", "Blackhawks", "chi"],
  ["NHL", "Colorado", "Avalanche", "col"],
  ["NHL", "Dallas", "Stars", "dal"],
  ["NHL", "Minnesota", "Wild", "min"],
  ["NHL", "Nashville", "Predators", "nsh"],
  ["NHL", "St. Louis", "Blues", "stl"],
  ["NHL", "Utah", "Mammoth", "uta"],
  ["NHL", "Winnipeg", "Jets", "wpg"],
  ["NHL", "Anaheim", "Ducks", "ana"],
  ["NHL", "Calgary", "Flames", "cgy"],
  ["NHL", "Edmonton", "Oilers", "edm"],
  ["NHL", "Los Angeles", "Kings", "la"],
  ["NHL", "San Jose", "Sharks", "sj"],
  ["NHL", "Seattle", "Kraken", "sea"],
  ["NHL", "Vancouver", "Canucks", "van"],
  ["NHL", "Vegas", "Golden Knights", "vgk"],

  ["NCAAF", "Michigan", "Wolverines", "130", "10000000-0000-4000-8000-000000000007"],
  ["NCAAF", "Ohio State", "Buckeyes", "194", "10000000-0000-4000-8000-000000000008"],
  ["NCAAF", "Notre Dame", "Fighting Irish", "87"],
  ["NCAAF", "Alabama", "Crimson Tide", "333"],
  ["NCAAF", "Georgia", "Bulldogs", "61"],
  ["NCAAF", "Texas", "Longhorns", "251"],
  ["NCAAF", "USC", "Trojans", "30"],
  ["NCAAF", "Oregon", "Ducks", "2483"],
  ["NCAAF", "Penn State", "Nittany Lions", "213"],
  ["NCAAF", "LSU", "Tigers", "99"],
  ["NCAAF", "Clemson", "Tigers", "228"],
  ["NCAAF", "Florida State", "Seminoles", "52"],
  ["NCAAF", "Miami", "Hurricanes", "2390"],
  ["NCAAF", "Florida", "Gators", "57"],
  ["NCAAF", "Tennessee", "Volunteers", "2633"],
  ["NCAAF", "Auburn", "Tigers", "2"],
  ["NCAAF", "Oklahoma", "Sooners", "201"],
  ["NCAAF", "Texas A&M", "Aggies", "245"],
  ["NCAAF", "Ole Miss", "Rebels", "145"],
  ["NCAAF", "Mississippi State", "Bulldogs", "344"],
  ["NCAAF", "Arkansas", "Razorbacks", "8"],
  ["NCAAF", "South Carolina", "Gamecocks", "2579"],
  ["NCAAF", "Kentucky", "Wildcats", "96"],
  ["NCAAF", "Missouri", "Tigers", "142"],
  ["NCAAF", "Wisconsin", "Badgers", "275"],
  ["NCAAF", "Iowa", "Hawkeyes", "2294"],
  ["NCAAF", "Nebraska", "Cornhuskers", "158"],
  ["NCAAF", "Minnesota", "Golden Gophers", "135"],
  ["NCAAF", "Michigan State", "Spartans", "127"],
  ["NCAAF", "Indiana", "Hoosiers", "84"],
  ["NCAAF", "Illinois", "Fighting Illini", "356"],
  ["NCAAF", "Purdue", "Boilermakers", "2509"],
  ["NCAAF", "Northwestern", "Wildcats", "77"],
  ["NCAAF", "UCLA", "Bruins", "26"],
  ["NCAAF", "Washington", "Huskies", "264"],
  ["NCAAF", "Utah", "Utes", "254"],
  ["NCAAF", "Colorado", "Buffaloes", "38"],
  ["NCAAF", "Arizona", "Wildcats", "12"],
  ["NCAAF", "Arizona State", "Sun Devils", "9"],
  ["NCAAF", "Stanford", "Cardinal", "24"],
  ["NCAAF", "California", "Golden Bears", "25"],
  ["NCAAF", "Baylor", "Bears", "239"],
  ["NCAAF", "TCU", "Horned Frogs", "2628"],
  ["NCAAF", "Texas Tech", "Red Raiders", "2641"],
  ["NCAAF", "Kansas", "Jayhawks", "2305"],
  ["NCAAF", "Kansas State", "Wildcats", "2306"],
  ["NCAAF", "Oklahoma State", "Cowboys", "197"],
  ["NCAAF", "Iowa State", "Cyclones", "66"],
  ["NCAAF", "BYU", "Cougars", "252"],
  ["NCAAF", "Boise State", "Broncos", "68"],
  ["NCAAF", "North Carolina", "Tar Heels", "153"],
  ["NCAAF", "NC State", "Wolfpack", "152"],
  ["NCAAF", "Duke", "Blue Devils", "150"],
  ["NCAAF", "Virginia Tech", "Hokies", "259"],
  ["NCAAF", "Louisville", "Cardinals", "97"],
  ["NCAAF", "Pittsburgh", "Panthers", "221"],
  ["NCAAF", "Syracuse", "Orange", "183"],
];

function teamLogoUrl(league: string, espnSlug: string) {
  const folder = league === "NCAAF" ? "ncaa" : league.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/${folder}/500/${espnSlug}.png`;
}

function makeTeam([league, city, name, espnSlug, legacyId]: TeamSeed): DevTeam {
  return {
    id: legacyId ?? `dev-${league.toLowerCase()}-${espnSlug}`,
    name,
    city,
    logoUrl: teamLogoUrl(league, espnSlug),
    league,
    espnSlug,
  };
}

export const DEV_TEAMS: DevTeam[] = TEAM_SEEDS.map(makeTeam);

export const DEV_FRIENDS: DevFriend[] = [
  {
    id: "friend-ty",
    name: "Ty",
    avatar: "🏆",
    status: "watching",
    roomName: "Bears Crew Two",
    teamId: "10000000-0000-4000-8000-000000000001",
  },
  {
    id: "friend-mike",
    name: "Mike D",
    avatar: "🎩",
    status: "watching",
    roomName: "The Boys Fantasy",
    teamId: "10000000-0000-4000-8000-000000000001",
  },
  {
    id: "friend-dan",
    name: "Dan",
    avatar: "🏀",
    status: "online",
    roomName: "Knicks Watch",
    teamId: "10000000-0000-4000-8000-000000000009",
  },
  {
    id: "friend-sarah",
    name: "Sarah",
    avatar: "⭐",
    status: "watching",
    roomName: "Knicks Watch",
    teamId: "10000000-0000-4000-8000-000000000009",
  },
];

export function normalizeLeague(league: string | null | undefined): string {
  return league === "NCAA" ? "NCAAF" : league ?? "";
}

export function getDevTeamsByIds(teamIds: string[]): DevTeam[] {
  const selected = new Set(teamIds);
  return DEV_TEAMS.filter((team) => selected.has(team.id));
}

export function getDevTeamById(teamId: string): DevTeam | undefined {
  return DEV_TEAMS.find((team) => team.id === teamId);
}

export function getDevFriendsForTeam(teamId: string): DevFriend[] {
  return DEV_FRIENDS.filter((friend) => friend.teamId === teamId);
}
