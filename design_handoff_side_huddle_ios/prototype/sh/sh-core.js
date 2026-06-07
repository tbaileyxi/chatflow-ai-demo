/* ─────────────────────────────────────────────────────────────
   SIDE HUDDLE v5 — core: theme tokens, data, helpers
   Plain JS (no babel). Everything hangs off window.SH
   ───────────────────────────────────────────────────────────── */
(function(){

// Theme tokens resolve to CSS vars (palette swapped via [data-theme] on the phone screen)
const C = {
  bg:'var(--bg)', elev:'var(--elev)', surface:'var(--surface)', surface2:'var(--surface2)',
  line:'var(--line)', lineSoft:'var(--line-soft)',
  text:'var(--text)', text2:'var(--text2)', text3:'var(--text3)',
  accent:'var(--accent)', accentDim:'var(--accent-dim)', accentLine:'var(--accent-line)', onAccent:'var(--on-accent)',
  live:'var(--live)', liveDim:'var(--live-dim)', liveLine:'var(--live-line)',
  pos:'var(--pos)', neg:'var(--neg)', info:'var(--info)',
};

const FONT = "'DM Sans',-apple-system,system-ui,sans-serif";
const MONO = "'DM Mono',ui-monospace,monospace";

// ── deterministic muted color for a person, from their name ──
function person(seed){
  let h=0; for(let i=0;i<seed.length;i++) h=(h*31+seed.charCodeAt(i))%360;
  return { bg:`hsl(${h} 26% 19%)`, fg:`hsl(${h} 48% 74%)`, line:`hsl(${h} 24% 30%)` };
}
function initials(name){
  const p=name.trim().split(/\s+/);
  return (p.length>1 ? p[0][0]+p[1][0] : name.slice(0,2)).toUpperCase();
}

// ── Teams the user follows (feed Super Huddle) ──
const TEAMS = {
  bears:   { id:'bears',   name:'Chicago Bears',          abbr:'CHI', league:'NFL',  color:'#0B162A', ink:'#C83803' },
  bulls:   { id:'bulls',   name:'Chicago Bulls',          abbr:'CHI', league:'NBA',  color:'#1A1A1E', ink:'#CE1141' },
  knicks:  { id:'knicks',  name:'New York Knicks',        abbr:'NYK', league:'NBA',  color:'#0B2240', ink:'#F58426' },
  canes:   { id:'canes',   name:'Carolina Hurricanes',    abbr:'CAR', league:'NHL',  color:'#1A1416', ink:'#CC0000' },
  nd:      { id:'nd',      name:'Notre Dame',             abbr:'ND',  league:'NCAAF',color:'#0C2340', ink:'#C99700' },
};
const FOLLOWED = ['bears','bulls','knicks','canes','nd'];

// ── Friends in rooms right now (the rail + room-jump) ──
const FRIENDS_LIVE = [
  { name:'Ty',    room:'Bears Crew',       roomId:'r_crew',  team:'bears',  status:'Bears 21–14 · Q3', others:2 },
  { name:'Mike D',room:'The Boys Fantasy', roomId:'r_boys',  team:'bears',  status:'talking trades',   others:4 },
  { name:'Dan',   room:'Sports Degens',    roomId:'r_degen', team:'bulls',  status:'live now',          others:3 },
  { name:'Sara',  room:'Bulls Room',       roomId:'r_bulls', team:'bulls',  status:'comeback W',        others:1 },
  { name:'Jess',  room:'Sports Degens',    roomId:'r_degen', team:'bulls',  status:'live now',          others:3 },
];

// ── Your rooms ── (owner = you created it; otherwise you're a member)
const MY_ROOMS = [
  { id:'r_boys',  name:'The Boys Fantasy', team:'bears', owner:true,  joined:true, members:8,  unread:7, live:true,  here:['Mike D','Dan','Sara'], preview:'Mike: you seeing this trade proposal?', pinned:'Draft trades close at kickoff. Get your offers in.' },
  { id:'r_crew',  name:'Bears Crew',       team:'bears', owner:false, joined:true, members:14, unread:0, live:true,  here:['Ty','Greg'],            preview:'Bears Bot · Bears up 21–14 in the 3rd', pinned:'Room is open all season. Check in while you watch.' },
  { id:'r_degen', name:'Sports Degens',    team:'bulls', owner:false, joined:true, members:22, unread:2, live:true,  here:['Dan','Jess'],           preview:'Bears Bot · Kalshi line moved to +180', pinned:'' },
  { id:'r_bulls', name:'Bulls Room',       team:'bulls', owner:true,  joined:true, members:6,  unread:0, live:false, here:[],                       preview:'DeRozan 34 — comeback win', pinned:'' },
];

// ── Super Huddle: read-only combined digest from all your teams ──
const SUPER_HUDDLE = [
  { id:'s1', team:'bears',  time:'now',   kind:'score', data:{ home:'Bears', homeScore:21, away:'Lions', awayScore:14, state:'Q3 · 4:22', note:'Caleb Williams 12-yd TD run' } },
  { id:'s2', team:'bears',  time:'6m',    kind:'post',  data:{ source:'X', handle:'@AdamSchefter', text:'Bears have requested tape on three defensive coordinators, per sources. Big offseason brewing in Chicago.', media:false } },
  { id:'s3', team:'bulls',  time:'22m',   kind:'news',  data:{ source:'ESPN', headline:'DeRozan drops 34 as Bulls erase 18-point deficit to beat the Heat', media:true } },
  { id:'s4', team:'canes',  time:'38m',   kind:'pred',  data:{ question:'Hurricanes win tonight?', yes:54, no:46, moved:'+4% today' } },
  { id:'s5', team:'knicks', time:'1h',    kind:'score', data:{ home:'Knicks', homeScore:0, away:'Spurs', awayScore:0, state:'Tip 8:30 ET', note:'Brunson questionable — game-time decision' } },
  { id:'s6', team:'nd',     time:'2h',    kind:'news',  data:{ source:'ESPN', headline:'Notre Dame jumps to No. 6 in the new College Football Playoff rankings', media:false } },
];

// ── Members of a room (who's-in sheet) ──
const ROOM_MEMBERS = [
  { name:'Ty',     status:'watching', seen:'now' },
  { name:'Mike D', status:'watching', seen:'now' },
  { name:'Dan',    status:'typing',   seen:'now' },
  { name:'Sara',   status:'online',   seen:'2m' },
  { name:'Greg',   status:'online',   seen:'5m' },
  { name:'Jess',   status:'away',     seen:'1h' },
  { name:'Pat',    status:'away',     seen:'3h' },
];

// ── A room's messages (oldest → newest; chat is bottom-anchored) ──
function buildRoomMsgs(){
  return [
    { id:'m1', type:'system', text:'Ty joined the room' },
    { id:'m2', type:'msg', from:'Dan', time:'4:58', text:'Caleb has been ELITE today. Top-5 QB talk starts now.',
      replies:[ {from:'Mike D', text:'Been saying it since week 3'}, {from:'Sara', text:'Top 3 easy. Tape don\'t lie.'} ] },
    { id:'m3', type:'bot', team:'bears', time:'5:01', kind:'score',
      data:{ home:'Bears', homeScore:21, away:'Lions', awayScore:14, state:'Q3 · 4:22', note:'Caleb Williams 12-yd TD run' } },
    { id:'m4', type:'bot', team:'bears', time:'5:02', kind:'post',
      data:{ source:'X', handle:'@CalebWilliams', text:'BLOCK PARTY. On to the next one.', media:true } },
    { id:'m5', type:'msg', from:'Mike D', time:'5:04', text:'Trade deadline starts NOW. I want all the Bears skill players on my roster.',
      replies:[ {from:'Dan', text:'too late bro, I already called dibs'} ] },
    { id:'m6', type:'bot', team:'bears', time:'5:06', kind:'pred',
      data:{ question:'Bears win Super Bowl LX?', yes:34, no:66, moved:'+4% today' } },
    { id:'m7', type:'msg', from:'You', mine:true, time:'5:09', text:'Just got to the bar — section 204, anyone around?',
      replies:[ {from:'Dan', text:'I\'m in 206! come thru at halftime'} ] },
  ];
}

// ── Team picker grid (Create Room) ──
const PICKER_TEAMS = [
  {abbr:'BUF',name:'Bills',league:'NFL',color:'#00338D'},   {abbr:'MIA',name:'Dolphins',league:'NFL',color:'#008E97'},
  {abbr:'NE', name:'Patriots',league:'NFL',color:'#0B2240'},{abbr:'NYJ',name:'Jets',league:'NFL',color:'#125740'},
  {abbr:'BAL',name:'Ravens',league:'NFL',color:'#241773'},  {abbr:'CIN',name:'Bengals',league:'NFL',color:'#FB4F14'},
  {abbr:'CLE',name:'Browns',league:'NFL',color:'#311D00'},  {abbr:'PIT',name:'Steelers',league:'NFL',color:'#1A1A1A'},
  {abbr:'CHI',name:'Bears',league:'NFL',color:'#0B162A'},   {abbr:'DET',name:'Lions',league:'NFL',color:'#0076B6'},
  {abbr:'GB', name:'Packers',league:'NFL',color:'#203731'}, {abbr:'MIN',name:'Vikings',league:'NFL',color:'#4F2683'},
  {abbr:'CHI',name:'Bulls',league:'NBA',color:'#1A1A1E'},   {abbr:'NYK',name:'Knicks',league:'NBA',color:'#0B2240'},
  {abbr:'LAL',name:'Lakers',league:'NBA',color:'#552583'},  {abbr:'BOS',name:'Celtics',league:'NBA',color:'#11472B'},
  {abbr:'CAR',name:'Hurricanes',league:'NHL',color:'#1A1416'},{abbr:'NYR',name:'Rangers',league:'NHL',color:'#0038A8'},
  {abbr:'ND', name:'Notre Dame',league:'NCAAF',color:'#0C2340'},{abbr:'OSU',name:'Ohio State',league:'NCAAF',color:'#3F0000'},
];

window.SH = { C, FONT, MONO, person, initials, TEAMS, FOLLOWED, FRIENDS_LIVE, MY_ROOMS, SUPER_HUDDLE, ROOM_MEMBERS, buildRoomMsgs, PICKER_TEAMS };
})();
