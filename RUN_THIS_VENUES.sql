-- Where the games are played.
--
-- Nothing about "at the stadium" can be built without this: `games` has no
-- venue column and there is no venues table, so the app has never known where
-- a fixture physically happens.
--
-- ON PRECISION. These coordinates are stadium centres, good to roughly a
-- hundred metres. That is fine for what they are for — a TAILGATE-sized fence
-- of about a kilometre, which has to cover the lots as well as the bowl.
-- Do not tighten the radius below ~500m against this data without checking
-- the specific venue first.
--
-- Two venues are shared and that is not a mistake: the Giants and Jets both
-- play at MetLife, the Rams and Chargers both at SoFi. Miami's college team
-- and the Dolphins share Hard Rock; Pitt and the Steelers share Acrisure.

create table if not exists public.venues (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  lat         double precision not null,
  lng         double precision not null,
  team_id     uuid references public.teams(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create unique index if not exists venues_team_idx on public.venues (team_id);
create index if not exists venues_latlng_idx on public.venues (lat, lng);

alter table public.venues enable row level security;
drop policy if exists "venues are readable by anyone" on public.venues;
create policy "venues are readable by anyone" on public.venues for select using (true);


-- ── NFL ──────────────────────────────────────────────────────────────────────
-- Matched on nickname, which is unique inside the league.
insert into public.venues (name, lat, lng, team_id)
select v.name, v.lat, v.lng, t.id
from (values
  ('State Farm Stadium',            33.5276, -112.2626, 'Cardinals'),
  ('Mercedes-Benz Stadium',         33.7554,  -84.4008, 'Falcons'),
  ('M&T Bank Stadium',              39.2780,  -76.6227, 'Ravens'),
  ('Highmark Stadium',              42.7738,  -78.7870, 'Bills'),
  ('Bank of America Stadium',       35.2258,  -80.8528, 'Panthers'),
  ('Soldier Field',                 41.8623,  -87.6167, 'Bears'),
  ('Paycor Stadium',                39.0955,  -84.5161, 'Bengals'),
  ('Huntington Bank Field',         41.5061,  -81.6995, 'Browns'),
  ('AT&T Stadium',                  32.7473,  -97.0945, 'Cowboys'),
  ('Empower Field at Mile High',    39.7439, -105.0201, 'Broncos'),
  ('Ford Field',                    42.3400,  -83.0456, 'Lions'),
  ('Lambeau Field',                 44.5013,  -88.0622, 'Packers'),
  ('NRG Stadium',                   29.6847,  -95.4107, 'Texans'),
  ('Lucas Oil Stadium',             39.7601,  -86.1639, 'Colts'),
  ('EverBank Stadium',              30.3239,  -81.6373, 'Jaguars'),
  ('GEHA Field at Arrowhead',       39.0489,  -94.4839, 'Chiefs'),
  ('Allegiant Stadium',             36.0909, -115.1833, 'Raiders'),
  ('SoFi Stadium',                  33.9535, -118.3392, 'Chargers'),
  ('SoFi Stadium',                  33.9535, -118.3392, 'Rams'),
  ('Hard Rock Stadium',             25.9580,  -80.2389, 'Dolphins'),
  ('U.S. Bank Stadium',             44.9736,  -93.2575, 'Vikings'),
  ('Gillette Stadium',              42.0909,  -71.2643, 'Patriots'),
  ('Caesars Superdome',             29.9511,  -90.0812, 'Saints'),
  ('MetLife Stadium',               40.8135,  -74.0745, 'Giants'),
  ('MetLife Stadium',               40.8135,  -74.0745, 'Jets'),
  ('Lincoln Financial Field',       39.9008,  -75.1675, 'Eagles'),
  ('Acrisure Stadium',              40.4468,  -80.0158, 'Steelers'),
  ('Levi''s Stadium',               37.4033, -121.9694, '49ers'),
  ('Lumen Field',                   47.5952, -122.3316, 'Seahawks'),
  ('Raymond James Stadium',         27.9759,  -82.5033, 'Buccaneers'),
  ('Nissan Stadium',                36.1665,  -86.7713, 'Titans'),
  ('Northwest Stadium',             38.9077,  -76.8645, 'Commanders')
) as v(name, lat, lng, nickname)
join public.teams t on t.name = v.nickname and t.league = 'NFL'
on conflict (team_id) do update
  set name = excluded.name, lat = excluded.lat, lng = excluded.lng;


-- ── College football ─────────────────────────────────────────────────────────
-- Matched on `city`, which for NCAA rows holds the SCHOOL ("Ohio State",
-- "Penn State", "LSU"). Any school not listed simply gets no venue and no
-- badge — the feature degrades to nothing rather than to something wrong.
insert into public.venues (name, lat, lng, team_id)
select v.name, v.lat, v.lng, t.id
from (values
  ('Bryant-Denny Stadium',      33.2083,  -87.5504, 'Alabama'),
  ('Sanford Stadium',           33.9497,  -83.3733, 'Georgia'),
  ('Tiger Stadium',             30.4119,  -91.1839, 'LSU'),
  ('Kyle Field',                30.6100,  -96.3403, 'Texas A&M'),
  ('Neyland Stadium',           35.9550,  -83.9250, 'Tennessee'),
  ('Ben Hill Griffin Stadium',  29.6500,  -82.3486, 'Florida'),
  ('Jordan-Hare Stadium',       32.6025,  -85.4894, 'Auburn'),
  ('Vaught-Hemingway Stadium',  34.3617,  -89.5333, 'Ole Miss'),
  ('Davis Wade Stadium',        33.4560,  -88.7936, 'Mississippi State'),
  ('Razorback Stadium',         36.0681,  -94.1786, 'Arkansas'),
  ('Williams-Brice Stadium',    33.9731,  -81.0192, 'South Carolina'),
  ('Kroger Field',              38.0222,  -84.5050, 'Kentucky'),
  ('Faurot Field',              38.9358,  -92.3333, 'Missouri'),
  ('FirstBank Stadium',         36.1447,  -86.8086, 'Vanderbilt'),
  ('Gaylord Family Stadium',    35.2058,  -97.4422, 'Oklahoma'),
  ('DKR-Texas Memorial',        30.2837,  -97.7325, 'Texas'),
  ('Ohio Stadium',              40.0017,  -83.0197, 'Ohio State'),
  ('Michigan Stadium',          42.2658,  -83.7487, 'Michigan'),
  ('Beaver Stadium',            40.8122,  -77.8562, 'Penn State'),
  ('Camp Randall Stadium',      43.0700,  -89.4125, 'Wisconsin'),
  ('Kinnick Stadium',           41.6586,  -91.5514, 'Iowa'),
  ('Memorial Stadium',          40.8206,  -96.7056, 'Nebraska'),
  ('Spartan Stadium',           42.7281,  -84.4847, 'Michigan State'),
  ('Huntington Bank Stadium',   44.9764,  -93.2247, 'Minnesota'),
  ('Memorial Stadium',          40.0956,  -88.2364, 'Illinois'),
  ('Memorial Stadium',          39.1806,  -86.5258, 'Indiana'),
  ('Ross-Ade Stadium',          40.4350,  -86.9186, 'Purdue'),
  ('Ryan Field',                42.0658,  -87.6925, 'Northwestern'),
  ('SECU Stadium',              38.9906,  -76.9472, 'Maryland'),
  ('SHI Stadium',               40.5136,  -74.4650, 'Rutgers'),
  ('LA Memorial Coliseum',      34.0141, -118.2879, 'USC'),
  ('Rose Bowl',                 34.1613, -118.1676, 'UCLA'),
  ('Autzen Stadium',            44.0583, -123.0681, 'Oregon'),
  ('Husky Stadium',             47.6503, -122.3016, 'Washington'),
  ('Reser Stadium',             44.5590, -123.2820, 'Oregon State'),
  ('Bill Snyder Family Stadium',39.2019,  -96.5936, 'Kansas State'),
  ('David Booth Memorial',      38.9639,  -95.2467, 'Kansas'),
  ('Boone Pickens Stadium',     36.1269,  -97.0653, 'Oklahoma State'),
  ('McLane Stadium',            31.5589,  -97.1150, 'Baylor'),
  ('Amon G. Carter Stadium',    32.7097,  -97.3683, 'TCU'),
  ('Jones AT&T Stadium',        33.5906, -101.8725, 'Texas Tech'),
  ('Jack Trice Stadium',        42.0140,  -93.6358, 'Iowa State'),
  ('Milan Puskar Stadium',      39.6500,  -79.9550, 'West Virginia'),
  ('Nippert Stadium',           39.1314,  -84.5164, 'Cincinnati'),
  ('TDECU Stadium',             29.7211,  -95.3489, 'Houston'),
  ('FBC Mortgage Stadium',      28.6078,  -81.1925, 'UCF'),
  ('LaVell Edwards Stadium',    40.2578, -111.6547, 'BYU'),
  ('Rice-Eccles Stadium',       40.7600, -111.8489, 'Utah'),
  ('Folsom Field',              40.0097, -105.2669, 'Colorado'),
  ('Arizona Stadium',           32.2289, -110.9489, 'Arizona'),
  ('Mountain America Stadium',  33.4264, -111.9325, 'Arizona State'),
  ('Memorial Stadium',          34.6786,  -82.8433, 'Clemson'),
  ('Doak Campbell Stadium',     30.4381,  -84.3044, 'Florida State'),
  ('Hard Rock Stadium',         25.9580,  -80.2389, 'Miami'),
  ('Kenan Stadium',             35.9061,  -79.0478, 'North Carolina'),
  ('Carter-Finley Stadium',     35.8003,  -78.7200, 'NC State'),
  ('Lane Stadium',              37.2200,  -80.4183, 'Virginia Tech'),
  ('L&N Stadium',               38.2064,  -85.7550, 'Louisville'),
  ('Acrisure Stadium',          40.4468,  -80.0158, 'Pittsburgh'),
  ('Wallace Wade Stadium',      36.0011,  -78.9428, 'Duke'),
  ('Scott Stadium',             38.0314,  -78.5136, 'Virginia'),
  ('Bobby Dodd Stadium',        33.7725,  -84.3928, 'Georgia Tech'),
  ('JMA Wireless Dome',         43.0361,  -76.1364, 'Syracuse'),
  ('Alumni Stadium',            42.3350,  -71.1664, 'Boston College'),
  ('Allegacy Stadium',          36.1325,  -80.2547, 'Wake Forest'),
  ('Gerald J. Ford Stadium',    32.8364,  -96.7842, 'SMU'),
  ('California Memorial',       37.8714, -122.2508, 'California'),
  ('Stanford Stadium',          37.4344, -122.1611, 'Stanford'),
  ('Notre Dame Stadium',        41.6983,  -86.2336, 'Notre Dame'),
  ('Michie Stadium',            41.3897,  -73.9631, 'Army'),
  ('Navy-Marine Corps Stadium', 38.9853,  -76.5069, 'Navy'),
  ('Yulman Stadium',            29.9400,  -90.1200, 'Tulane'),
  ('Simmons Bank Liberty',      35.1211,  -89.9436, 'Memphis'),
  ('Albertsons Stadium',        43.6028, -116.1994, 'Boise State')
) as v(name, lat, lng, school)
join public.teams t on t.city = v.school and t.league = 'NCAA'
on conflict (team_id) do update
  set name = excluded.name, lat = excluded.lat, lng = excluded.lng;


-- ── check ────────────────────────────────────────────────────────────────────
select
  (select count(*) from public.venues v join public.teams t on t.id = v.team_id
    where t.league = 'NFL')  as nfl_venues,     -- expect 32
  (select count(*) from public.venues v join public.teams t on t.id = v.team_id
    where t.league = 'NCAA') as college_venues; -- expect up to 74
