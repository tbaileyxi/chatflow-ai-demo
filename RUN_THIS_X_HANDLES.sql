-- Where the video actually gets posted.
--
-- The in-game clip pipeline has been asking xAI to go and FIND a video of a
-- play — a vague question, and the hit rate says so: 93 attempts, 7 clips. It
-- was never looking at the accounts that actually post the highlight, because
-- nothing in this database knew what those accounts were.
--
-- This is that list. With it, the search becomes
--   (from:Broncos OR from:Chiefs) has:videos -is:retweet
-- on the X API directly, which is one request, deterministic, and takes xAI
-- out of the in-game path altogether.
--
-- ON ACCURACY: these are written from knowledge, not scraped, and handles do
-- occasionally change. A wrong one costs a search that finds nothing — the
-- same as today — so this fails soft. `verified_at` is null until something
-- actually confirms the handle resolves; nothing is claimed to be checked
-- that has not been.

create table if not exists public.team_x_accounts (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  handle      text not null,
  -- 'official' is the club's own account. Room for beat writers and conference
  -- networks later without another migration.
  kind        text not null default 'official',
  -- Lower first, so the club's own account is preferred over anything added later.
  priority    smallint not null default 0,
  verified_at timestamptz,
  created_at  timestamptz not null default now()
);

create unique index if not exists team_x_accounts_unique
  on public.team_x_accounts (team_id, lower(handle));
create index if not exists team_x_accounts_team_idx
  on public.team_x_accounts (team_id, priority);

alter table public.team_x_accounts enable row level security;
drop policy if exists "x accounts are readable" on public.team_x_accounts;
create policy "x accounts are readable"
  on public.team_x_accounts for select using (true);


-- Matched the same way the venues seed was: pro leagues on nickname, which is
-- unique inside a league; college on city, which for NCAA rows holds the school.
create or replace function public.seed_x_handle(
  p_league text, p_match text, p_handle text
) returns void language plpgsql as $$
begin
  insert into public.team_x_accounts (team_id, handle)
  select t.id, p_handle
    from public.teams t
   where t.league = p_league
     and (case when p_league = 'NCAA' then t.city else t.name end) = p_match
  on conflict (team_id, lower(handle)) do nothing;
end $$;


-- ── NFL ──────────────────────────────────────────────────────────────────────
select public.seed_x_handle('NFL','Cardinals','AZCardinals');
select public.seed_x_handle('NFL','Falcons','AtlantaFalcons');
select public.seed_x_handle('NFL','Ravens','Ravens');
select public.seed_x_handle('NFL','Bills','BuffaloBills');
select public.seed_x_handle('NFL','Panthers','Panthers');
select public.seed_x_handle('NFL','Bears','ChicagoBears');
select public.seed_x_handle('NFL','Bengals','Bengals');
select public.seed_x_handle('NFL','Browns','Browns');
select public.seed_x_handle('NFL','Cowboys','dallascowboys');
select public.seed_x_handle('NFL','Broncos','Broncos');
select public.seed_x_handle('NFL','Lions','Lions');
select public.seed_x_handle('NFL','Packers','packers');
select public.seed_x_handle('NFL','Texans','HoustonTexans');
select public.seed_x_handle('NFL','Colts','Colts');
select public.seed_x_handle('NFL','Jaguars','Jaguars');
select public.seed_x_handle('NFL','Chiefs','Chiefs');
select public.seed_x_handle('NFL','Raiders','Raiders');
select public.seed_x_handle('NFL','Chargers','chargers');
select public.seed_x_handle('NFL','Rams','RamsNFL');
select public.seed_x_handle('NFL','Dolphins','MiamiDolphins');
select public.seed_x_handle('NFL','Vikings','Vikings');
select public.seed_x_handle('NFL','Patriots','Patriots');
select public.seed_x_handle('NFL','Saints','Saints');
select public.seed_x_handle('NFL','Giants','Giants');
select public.seed_x_handle('NFL','Jets','nyjets');
select public.seed_x_handle('NFL','Eagles','Eagles');
select public.seed_x_handle('NFL','Steelers','steelers');
select public.seed_x_handle('NFL','49ers','49ers');
select public.seed_x_handle('NFL','Seahawks','Seahawks');
select public.seed_x_handle('NFL','Buccaneers','Buccaneers');
select public.seed_x_handle('NFL','Titans','Titans');
select public.seed_x_handle('NFL','Commanders','Commanders');

-- ── MLB ──────────────────────────────────────────────────────────────────────
select public.seed_x_handle('MLB','Diamondbacks','Dbacks');
select public.seed_x_handle('MLB','Braves','Braves');
select public.seed_x_handle('MLB','Orioles','Orioles');
select public.seed_x_handle('MLB','Red Sox','RedSox');
select public.seed_x_handle('MLB','Cubs','Cubs');
select public.seed_x_handle('MLB','White Sox','whitesox');
select public.seed_x_handle('MLB','Reds','Reds');
select public.seed_x_handle('MLB','Guardians','CleGuardians');
select public.seed_x_handle('MLB','Rockies','Rockies');
select public.seed_x_handle('MLB','Tigers','tigers');
select public.seed_x_handle('MLB','Astros','astros');
select public.seed_x_handle('MLB','Royals','Royals');
select public.seed_x_handle('MLB','Angels','Angels');
select public.seed_x_handle('MLB','Dodgers','Dodgers');
select public.seed_x_handle('MLB','Marlins','Marlins');
select public.seed_x_handle('MLB','Brewers','Brewers');
select public.seed_x_handle('MLB','Twins','Twins');
select public.seed_x_handle('MLB','Mets','Mets');
select public.seed_x_handle('MLB','Yankees','Yankees');
select public.seed_x_handle('MLB','Athletics','Athletics');
select public.seed_x_handle('MLB','Phillies','Phillies');
select public.seed_x_handle('MLB','Pirates','Pirates');
select public.seed_x_handle('MLB','Padres','Padres');
select public.seed_x_handle('MLB','Giants','SFGiants');
select public.seed_x_handle('MLB','Mariners','Mariners');
select public.seed_x_handle('MLB','Cardinals','Cardinals');
select public.seed_x_handle('MLB','Rays','RaysBaseball');
select public.seed_x_handle('MLB','Rangers','Rangers');
select public.seed_x_handle('MLB','Blue Jays','BlueJays');
select public.seed_x_handle('MLB','Nationals','Nationals');

-- ── NBA ──────────────────────────────────────────────────────────────────────
select public.seed_x_handle('NBA','Hawks','ATLHawks');
select public.seed_x_handle('NBA','Celtics','celtics');
select public.seed_x_handle('NBA','Nets','BrooklynNets');
select public.seed_x_handle('NBA','Hornets','hornets');
select public.seed_x_handle('NBA','Bulls','chicagobulls');
select public.seed_x_handle('NBA','Cavaliers','cavs');
select public.seed_x_handle('NBA','Mavericks','dallasmavs');
select public.seed_x_handle('NBA','Nuggets','nuggets');
select public.seed_x_handle('NBA','Pistons','DetroitPistons');
select public.seed_x_handle('NBA','Warriors','warriors');
select public.seed_x_handle('NBA','Rockets','HoustonRockets');
select public.seed_x_handle('NBA','Pacers','Pacers');
select public.seed_x_handle('NBA','Clippers','LAClippers');
select public.seed_x_handle('NBA','Lakers','Lakers');
select public.seed_x_handle('NBA','Grizzlies','memgrizz');
select public.seed_x_handle('NBA','Heat','MiamiHEAT');
select public.seed_x_handle('NBA','Bucks','Bucks');
select public.seed_x_handle('NBA','Timberwolves','Timberwolves');
select public.seed_x_handle('NBA','Pelicans','PelicansNBA');
select public.seed_x_handle('NBA','Knicks','nyknicks');
select public.seed_x_handle('NBA','Thunder','okcthunder');
select public.seed_x_handle('NBA','Magic','OrlandoMagic');
select public.seed_x_handle('NBA','76ers','sixers');
select public.seed_x_handle('NBA','Suns','Suns');
select public.seed_x_handle('NBA','Trail Blazers','trailblazers');
select public.seed_x_handle('NBA','Kings','SacramentoKings');
select public.seed_x_handle('NBA','Spurs','spurs');
select public.seed_x_handle('NBA','Raptors','Raptors');
select public.seed_x_handle('NBA','Jazz','utahjazz');
select public.seed_x_handle('NBA','Wizards','WashWizards');

-- ── NHL ──────────────────────────────────────────────────────────────────────
select public.seed_x_handle('NHL','Ducks','AnaheimDucks');
select public.seed_x_handle('NHL','Bruins','NHLBruins');
select public.seed_x_handle('NHL','Sabres','BuffaloSabres');
select public.seed_x_handle('NHL','Flames','NHLFlames');
select public.seed_x_handle('NHL','Hurricanes','Canes');
select public.seed_x_handle('NHL','Blackhawks','NHLBlackhawks');
select public.seed_x_handle('NHL','Avalanche','Avalanche');
select public.seed_x_handle('NHL','Blue Jackets','BlueJacketsNHL');
select public.seed_x_handle('NHL','Stars','DallasStars');
select public.seed_x_handle('NHL','Red Wings','DetroitRedWings');
select public.seed_x_handle('NHL','Oilers','EdmontonOilers');
select public.seed_x_handle('NHL','Panthers','FlaPanthers');
select public.seed_x_handle('NHL','Kings','LAKings');
select public.seed_x_handle('NHL','Wild','mnwild');
select public.seed_x_handle('NHL','Canadiens','CanadiensMTL');
select public.seed_x_handle('NHL','Predators','PredsNHL');
select public.seed_x_handle('NHL','Devils','NJDevils');
select public.seed_x_handle('NHL','Islanders','NYIslanders');
select public.seed_x_handle('NHL','Rangers','NYRangers');
select public.seed_x_handle('NHL','Senators','Senators');
select public.seed_x_handle('NHL','Flyers','NHLFlyers');
select public.seed_x_handle('NHL','Penguins','penguins');
select public.seed_x_handle('NHL','Sharks','SanJoseSharks');
select public.seed_x_handle('NHL','Kraken','SeattleKraken');
select public.seed_x_handle('NHL','Blues','StLouisBlues');
select public.seed_x_handle('NHL','Lightning','TBLightning');
select public.seed_x_handle('NHL','Maple Leafs','MapleLeafs');
select public.seed_x_handle('NHL','Canucks','Canucks');
select public.seed_x_handle('NHL','Golden Knights','GoldenKnights');
select public.seed_x_handle('NHL','Capitals','Capitals');
select public.seed_x_handle('NHL','Jets','NHLJets');

-- ── College football ─────────────────────────────────────────────────────────
-- FOOTBALL accounts, not the athletic department: the department posts swimming
-- results on a Saturday night and the football account posts the touchdown.
select public.seed_x_handle('NCAA','Alabama','AlabamaFTBL');
select public.seed_x_handle('NCAA','Georgia','GeorgiaFootball');
select public.seed_x_handle('NCAA','LSU','LSUfootball');
select public.seed_x_handle('NCAA','Texas A&M','AggieFootball');
select public.seed_x_handle('NCAA','Tennessee','Vol_Football');
select public.seed_x_handle('NCAA','Florida','GatorsFB');
select public.seed_x_handle('NCAA','Auburn','AuburnFootball');
select public.seed_x_handle('NCAA','Ole Miss','OleMissFB');
select public.seed_x_handle('NCAA','Mississippi State','HailStateFB');
select public.seed_x_handle('NCAA','Arkansas','RazorbackFB');
select public.seed_x_handle('NCAA','South Carolina','GamecockFB');
select public.seed_x_handle('NCAA','Kentucky','UKFootball');
select public.seed_x_handle('NCAA','Missouri','MizzouFootball');
select public.seed_x_handle('NCAA','Vanderbilt','VandyFootball');
select public.seed_x_handle('NCAA','Oklahoma','OU_Football');
select public.seed_x_handle('NCAA','Texas','TexasFootball');
select public.seed_x_handle('NCAA','Ohio State','OhioStateFB');
select public.seed_x_handle('NCAA','Michigan','UMichFootball');
select public.seed_x_handle('NCAA','Penn State','PennStateFball');
select public.seed_x_handle('NCAA','Wisconsin','BadgerFootball');
select public.seed_x_handle('NCAA','Iowa','HawkeyeFootball');
select public.seed_x_handle('NCAA','Nebraska','HuskerFBNation');
select public.seed_x_handle('NCAA','Michigan State','MSU_Football');
select public.seed_x_handle('NCAA','Minnesota','GopherFootball');
select public.seed_x_handle('NCAA','Illinois','IlliniFootball');
select public.seed_x_handle('NCAA','Indiana','IndianaFootball');
select public.seed_x_handle('NCAA','Purdue','BoilerFootball');
select public.seed_x_handle('NCAA','Northwestern','NUFBFamily');
select public.seed_x_handle('NCAA','Maryland','TerpsFootball');
select public.seed_x_handle('NCAA','Rutgers','RFootball');
select public.seed_x_handle('NCAA','USC','uscfb');
select public.seed_x_handle('NCAA','UCLA','UCLAFootball');
select public.seed_x_handle('NCAA','Oregon','oregonfootball');
select public.seed_x_handle('NCAA','Washington','UW_Football');
select public.seed_x_handle('NCAA','Oregon State','BeaverFootball');
select public.seed_x_handle('NCAA','Kansas State','KStateFB');
select public.seed_x_handle('NCAA','Kansas','KU_Football');
select public.seed_x_handle('NCAA','Oklahoma State','CowboyFB');
select public.seed_x_handle('NCAA','Baylor','BUFootball');
select public.seed_x_handle('NCAA','TCU','TCUFootball');
select public.seed_x_handle('NCAA','Texas Tech','TexasTechFB');
select public.seed_x_handle('NCAA','Iowa State','CycloneFB');
select public.seed_x_handle('NCAA','West Virginia','WVUfootball');
select public.seed_x_handle('NCAA','Cincinnati','GoBearcatsFB');
select public.seed_x_handle('NCAA','Houston','UHCougarFB');
select public.seed_x_handle('NCAA','UCF','UCF_Football');
select public.seed_x_handle('NCAA','BYU','BYUfootball');
select public.seed_x_handle('NCAA','Utah','Utah_Football');
select public.seed_x_handle('NCAA','Colorado','CUBuffsFootball');
select public.seed_x_handle('NCAA','Arizona','ArizonaFBall');
select public.seed_x_handle('NCAA','Arizona State','ASUFootball');
select public.seed_x_handle('NCAA','Clemson','ClemsonFB');
select public.seed_x_handle('NCAA','Florida State','FSUFootball');
select public.seed_x_handle('NCAA','Miami','CanesFootball');
select public.seed_x_handle('NCAA','North Carolina','UNCFootball');
select public.seed_x_handle('NCAA','NC State','PackFootball');
select public.seed_x_handle('NCAA','Virginia Tech','HokiesFB');
select public.seed_x_handle('NCAA','Louisville','LouisvilleFB');
select public.seed_x_handle('NCAA','Pittsburgh','Pitt_FB');
select public.seed_x_handle('NCAA','Duke','DukeFOOTBALL');
select public.seed_x_handle('NCAA','Virginia','UVAFootball');
select public.seed_x_handle('NCAA','Georgia Tech','GeorgiaTechFB');
select public.seed_x_handle('NCAA','Syracuse','CuseFootball');
select public.seed_x_handle('NCAA','Boston College','BCFootball');
select public.seed_x_handle('NCAA','Wake Forest','WakeFB');
select public.seed_x_handle('NCAA','SMU','SMUFB');
select public.seed_x_handle('NCAA','California','CalFootball');
select public.seed_x_handle('NCAA','Stanford','StanfordFball');
select public.seed_x_handle('NCAA','Notre Dame','NDFootball');
select public.seed_x_handle('NCAA','Army','ArmyWP_Football');
select public.seed_x_handle('NCAA','Navy','NavyFB');
select public.seed_x_handle('NCAA','Tulane','GreenWaveFB');
select public.seed_x_handle('NCAA','Memphis','MemphisFB');
select public.seed_x_handle('NCAA','Boise State','BroncoSportsFB');

drop function if exists public.seed_x_handle(text, text, text);

select
  t.league,
  count(*) as handles
from public.team_x_accounts x
join public.teams t on t.id = x.team_id
group by t.league
order by t.league;
