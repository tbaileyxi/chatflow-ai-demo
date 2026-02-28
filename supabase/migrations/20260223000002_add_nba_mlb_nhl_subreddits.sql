-- Add subreddit mappings for NBA, MLB, and NHL teams
-- Uses dynamic team_id lookup so it works regardless of UUID generation

-- NBA Teams
INSERT INTO team_subreddits (team_id, subreddit_name, rss_url, is_active)
SELECT t.id, sub.subreddit, 'https://www.reddit.com/r/' || sub.subreddit || '/.rss', true
FROM teams t
JOIN (VALUES
  ('Hawks', 'Atlanta', 'AtlantaHawks'),
  ('Celtics', 'Boston', 'bostonceltics'),
  ('Nets', 'Brooklyn', 'GoNets'),
  ('Hornets', 'Charlotte', 'CharlotteHornets'),
  ('Bulls', 'Chicago', 'chicagobulls'),
  ('Cavaliers', 'Cleveland', 'clevelandcavs'),
  ('Mavericks', 'Dallas', 'Mavericks'),
  ('Nuggets', 'Denver', 'denvernuggets'),
  ('Pistons', 'Detroit', 'DetroitPistons'),
  ('Warriors', 'Golden State', 'warriors'),
  ('Rockets', 'Houston', 'rockets'),
  ('Pacers', 'Indiana', 'pacers'),
  ('Clippers', 'Los Angeles', 'LAClippers'),
  ('Lakers', 'Los Angeles', 'lakers'),
  ('Grizzlies', 'Memphis', 'memphisgrizzlies'),
  ('Heat', 'Miami', 'heat'),
  ('Bucks', 'Milwaukee', 'MkeBucks'),
  ('Timberwolves', 'Minnesota', 'timberwolves'),
  ('Pelicans', 'New Orleans', 'NOLAPelicans'),
  ('Knicks', 'New York', 'NYKnicks'),
  ('Thunder', 'Oklahoma City', 'Thunder'),
  ('Magic', 'Orlando', 'OrlandoMagic'),
  ('76ers', 'Philadelphia', 'sixers'),
  ('Suns', 'Phoenix', 'suns'),
  ('Trail Blazers', 'Portland', 'ripcity'),
  ('Kings', 'Sacramento', 'kings'),
  ('Spurs', 'San Antonio', 'NBASpurs'),
  ('Raptors', 'Toronto', 'torontoraptors'),
  ('Jazz', 'Utah', 'UtahJazz'),
  ('Wizards', 'Washington', 'washingtonwizards')
) AS sub(team_name, team_city, subreddit)
ON t.name = sub.team_name AND t.city = sub.team_city AND t.league = 'NBA'
ON CONFLICT (team_id) DO NOTHING;

-- MLB Teams
INSERT INTO team_subreddits (team_id, subreddit_name, rss_url, is_active)
SELECT t.id, sub.subreddit, 'https://www.reddit.com/r/' || sub.subreddit || '/.rss', true
FROM teams t
JOIN (VALUES
  ('Diamondbacks', 'Arizona', 'azdiamondbacks'),
  ('Braves', 'Atlanta', 'Braves'),
  ('Orioles', 'Baltimore', 'orioles'),
  ('Red Sox', 'Boston', 'redsox'),
  ('Cubs', 'Chicago', 'CHICubs'),
  ('White Sox', 'Chicago', 'whitesox'),
  ('Reds', 'Cincinnati', 'Reds'),
  ('Guardians', 'Cleveland', 'ClevelandGuardians'),
  ('Rockies', 'Colorado', 'ColoradoRockies'),
  ('Tigers', 'Detroit', 'motorcitykitties'),
  ('Astros', 'Houston', 'Astros'),
  ('Royals', 'Kansas City', 'KCRoyals'),
  ('Angels', 'Los Angeles', 'angelsbaseball'),
  ('Dodgers', 'Los Angeles', 'Dodgers'),
  ('Marlins', 'Miami', 'letsgofish'),
  ('Brewers', 'Milwaukee', 'Brewers'),
  ('Twins', 'Minnesota', 'minnesotatwins'),
  ('Mets', 'New York', 'NewYorkMets'),
  ('Yankees', 'New York', 'NYYankees'),
  ('Athletics', 'Oakland', 'OaklandAthletics'),
  ('Phillies', 'Philadelphia', 'phillies'),
  ('Pirates', 'Pittsburgh', 'buccos'),
  ('Padres', 'San Diego', 'Padres'),
  ('Giants', 'San Francisco', 'SFGiants'),
  ('Mariners', 'Seattle', 'Mariners'),
  ('Cardinals', 'St. Louis', 'Cardinals'),
  ('Rays', 'Tampa Bay', 'tampabayrays'),
  ('Rangers', 'Texas', 'TexasRangers'),
  ('Blue Jays', 'Toronto', 'Torontobluejays'),
  ('Nationals', 'Washington', 'Nationals')
) AS sub(team_name, team_city, subreddit)
ON t.name = sub.team_name AND t.city = sub.team_city AND t.league = 'MLB'
ON CONFLICT (team_id) DO NOTHING;

-- NHL Teams
INSERT INTO team_subreddits (team_id, subreddit_name, rss_url, is_active)
SELECT t.id, sub.subreddit, 'https://www.reddit.com/r/' || sub.subreddit || '/.rss', true
FROM teams t
JOIN (VALUES
  ('Ducks', 'Anaheim', 'AnaheimDucks'),
  ('Bruins', 'Boston', 'BostonBruins'),
  ('Sabres', 'Buffalo', 'sabres'),
  ('Flames', 'Calgary', 'CalgaryFlames'),
  ('Hurricanes', 'Carolina', 'canes'),
  ('Blackhawks', 'Chicago', 'hawks'),
  ('Avalanche', 'Colorado', 'ColoradoAvalanche'),
  ('Blue Jackets', 'Columbus', 'BlueJackets'),
  ('Stars', 'Dallas', 'DallasStars'),
  ('Red Wings', 'Detroit', 'DetroitRedWings'),
  ('Oilers', 'Edmonton', 'EdmontonOilers'),
  ('Panthers', 'Florida', 'FloridaPanthers'),
  ('Kings', 'Los Angeles', 'losangeleskings'),
  ('Wild', 'Minnesota', 'wildhockey'),
  ('Canadiens', 'Montreal', 'Habs'),
  ('Predators', 'Nashville', 'Predators'),
  ('Devils', 'New Jersey', 'devils'),
  ('Islanders', 'New York', 'NewYorkIslanders'),
  ('Rangers', 'New York', 'rangers'),
  ('Senators', 'Ottawa', 'OttawaSenators'),
  ('Flyers', 'Philadelphia', 'Flyers'),
  ('Penguins', 'Pittsburgh', 'penguins'),
  ('Blues', 'St. Louis', 'stlouisblues'),
  ('Sharks', 'San Jose', 'SanJoseSharks'),
  ('Kraken', 'Seattle', 'SeattleKraken'),
  ('Lightning', 'Tampa Bay', 'TampaBayLightning'),
  ('Maple Leafs', 'Toronto', 'leafs'),
  ('Canucks', 'Vancouver', 'canucks'),
  ('Golden Knights', 'Vegas', 'goldenknights'),
  ('Capitals', 'Washington', 'caps'),
  ('Jets', 'Winnipeg', 'winnipegjets'),
  ('Utah Hockey Club', 'Utah', 'UtahHC')
) AS sub(team_name, team_city, subreddit)
ON t.name = sub.team_name AND t.city = sub.team_city AND t.league = 'NHL'
ON CONFLICT (team_id) DO NOTHING;
