-- Add all MLB teams
INSERT INTO public.teams (name, city, logo_url, conference, division, league, status) VALUES
-- American League East
('Yankees', 'New York', 'https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png', 'American League', 'East', 'MLB', 'active'),
('Red Sox', 'Boston', 'https://a.espncdn.com/i/teamlogos/mlb/500/bos.png', 'American League', 'East', 'MLB', 'active'),
('Blue Jays', 'Toronto', 'https://a.espncdn.com/i/teamlogos/mlb/500/tor.png', 'American League', 'East', 'MLB', 'active'),
('Rays', 'Tampa Bay', 'https://a.espncdn.com/i/teamlogos/mlb/500/tb.png', 'American League', 'East', 'MLB', 'active'),
('Orioles', 'Baltimore', 'https://a.espncdn.com/i/teamlogos/mlb/500/bal.png', 'American League', 'East', 'MLB', 'active'),
-- American League Central
('Guardians', 'Cleveland', 'https://a.espncdn.com/i/teamlogos/mlb/500/cle.png', 'American League', 'Central', 'MLB', 'active'),
('Twins', 'Minnesota', 'https://a.espncdn.com/i/teamlogos/mlb/500/min.png', 'American League', 'Central', 'MLB', 'active'),
('White Sox', 'Chicago', 'https://a.espncdn.com/i/teamlogos/mlb/500/chw.png', 'American League', 'Central', 'MLB', 'active'),
('Tigers', 'Detroit', 'https://a.espncdn.com/i/teamlogos/mlb/500/det.png', 'American League', 'Central', 'MLB', 'active'),
('Royals', 'Kansas City', 'https://a.espncdn.com/i/teamlogos/mlb/500/kc.png', 'American League', 'Central', 'MLB', 'active'),
-- American League West
('Astros', 'Houston', 'https://a.espncdn.com/i/teamlogos/mlb/500/hou.png', 'American League', 'West', 'MLB', 'active'),
('Rangers', 'Texas', 'https://a.espncdn.com/i/teamlogos/mlb/500/tex.png', 'American League', 'West', 'MLB', 'active'),
('Mariners', 'Seattle', 'https://a.espncdn.com/i/teamlogos/mlb/500/sea.png', 'American League', 'West', 'MLB', 'active'),
('Angels', 'Los Angeles', 'https://a.espncdn.com/i/teamlogos/mlb/500/laa.png', 'American League', 'West', 'MLB', 'active'),
('Athletics', 'Oakland', 'https://a.espncdn.com/i/teamlogos/mlb/500/oak.png', 'American League', 'West', 'MLB', 'active'),
-- National League East
('Braves', 'Atlanta', 'https://a.espncdn.com/i/teamlogos/mlb/500/atl.png', 'National League', 'East', 'MLB', 'active'),
('Phillies', 'Philadelphia', 'https://a.espncdn.com/i/teamlogos/mlb/500/phi.png', 'National League', 'East', 'MLB', 'active'),
('Mets', 'New York', 'https://a.espncdn.com/i/teamlogos/mlb/500/nym.png', 'National League', 'East', 'MLB', 'active'),
('Marlins', 'Miami', 'https://a.espncdn.com/i/teamlogos/mlb/500/mia.png', 'National League', 'East', 'MLB', 'active'),
('Nationals', 'Washington', 'https://a.espncdn.com/i/teamlogos/mlb/500/wsh.png', 'National League', 'East', 'MLB', 'active'),
-- National League Central
('Brewers', 'Milwaukee', 'https://a.espncdn.com/i/teamlogos/mlb/500/mil.png', 'National League', 'Central', 'MLB', 'active'),
('Cubs', 'Chicago', 'https://a.espncdn.com/i/teamlogos/mlb/500/chc.png', 'National League', 'Central', 'MLB', 'active'),
('Reds', 'Cincinnati', 'https://a.espncdn.com/i/teamlogos/mlb/500/cin.png', 'National League', 'Central', 'MLB', 'active'),
('Pirates', 'Pittsburgh', 'https://a.espncdn.com/i/teamlogos/mlb/500/pit.png', 'National League', 'Central', 'MLB', 'active'),
('Cardinals', 'St. Louis', 'https://a.espncdn.com/i/teamlogos/mlb/500/stl.png', 'National League', 'Central', 'MLB', 'active'),
-- National League West
('Dodgers', 'Los Angeles', 'https://a.espncdn.com/i/teamlogos/mlb/500/lad.png', 'National League', 'West', 'MLB', 'active'),
('Padres', 'San Diego', 'https://a.espncdn.com/i/teamlogos/mlb/500/sd.png', 'National League', 'West', 'MLB', 'active'),
('Giants', 'San Francisco', 'https://a.espncdn.com/i/teamlogos/mlb/500/sf.png', 'National League', 'West', 'MLB', 'active'),
('Diamondbacks', 'Arizona', 'https://a.espncdn.com/i/teamlogos/mlb/500/ari.png', 'National League', 'West', 'MLB', 'active'),
('Rockies', 'Colorado', 'https://a.espncdn.com/i/teamlogos/mlb/500/col.png', 'National League', 'West', 'MLB', 'active'),

-- Add all NBA teams
-- Eastern Conference - Atlantic
('Celtics', 'Boston', 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png', 'Eastern', 'Atlantic', 'NBA', 'active'),
('Nets', 'Brooklyn', 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png', 'Eastern', 'Atlantic', 'NBA', 'active'),
('Knicks', 'New York', 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png', 'Eastern', 'Atlantic', 'NBA', 'active'),
('76ers', 'Philadelphia', 'https://a.espncdn.com/i/teamlogos/nba/500/phi.png', 'Eastern', 'Atlantic', 'NBA', 'active'),
('Raptors', 'Toronto', 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png', 'Eastern', 'Atlantic', 'NBA', 'active'),
-- Eastern Conference - Central
('Bulls', 'Chicago', 'https://a.espncdn.com/i/teamlogos/nba/500/chi.png', 'Eastern', 'Central', 'NBA', 'active'),
('Cavaliers', 'Cleveland', 'https://a.espncdn.com/i/teamlogos/nba/500/cle.png', 'Eastern', 'Central', 'NBA', 'active'),
('Pistons', 'Detroit', 'https://a.espncdn.com/i/teamlogos/nba/500/det.png', 'Eastern', 'Central', 'NBA', 'active'),
('Pacers', 'Indiana', 'https://a.espncdn.com/i/teamlogos/nba/500/ind.png', 'Eastern', 'Central', 'NBA', 'active'),
('Bucks', 'Milwaukee', 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png', 'Eastern', 'Central', 'NBA', 'active'),
-- Eastern Conference - Southeast
('Hawks', 'Atlanta', 'https://a.espncdn.com/i/teamlogos/nba/500/atl.png', 'Eastern', 'Southeast', 'NBA', 'active'),
('Hornets', 'Charlotte', 'https://a.espncdn.com/i/teamlogos/nba/500/cha.png', 'Eastern', 'Southeast', 'NBA', 'active'),
('Heat', 'Miami', 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png', 'Eastern', 'Southeast', 'NBA', 'active'),
('Magic', 'Orlando', 'https://a.espncdn.com/i/teamlogos/nba/500/orl.png', 'Eastern', 'Southeast', 'NBA', 'active'),
('Wizards', 'Washington', 'https://a.espncdn.com/i/teamlogos/nba/500/wsh.png', 'Eastern', 'Southeast', 'NBA', 'active'),
-- Western Conference - Northwest
('Nuggets', 'Denver', 'https://a.espncdn.com/i/teamlogos/nba/500/den.png', 'Western', 'Northwest', 'NBA', 'active'),
('Timberwolves', 'Minnesota', 'https://a.espncdn.com/i/teamlogos/nba/500/min.png', 'Western', 'Northwest', 'NBA', 'active'),
('Thunder', 'Oklahoma City', 'https://a.espncdn.com/i/teamlogos/nba/500/okc.png', 'Western', 'Northwest', 'NBA', 'active'),
('Trail Blazers', 'Portland', 'https://a.espncdn.com/i/teamlogos/nba/500/por.png', 'Western', 'Northwest', 'NBA', 'active'),
('Jazz', 'Utah', 'https://a.espncdn.com/i/teamlogos/nba/500/uta.png', 'Western', 'Northwest', 'NBA', 'active'),
-- Western Conference - Pacific
('Warriors', 'Golden State', 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png', 'Western', 'Pacific', 'NBA', 'active'),
('Clippers', 'Los Angeles', 'https://a.espncdn.com/i/teamlogos/nba/500/lac.png', 'Western', 'Pacific', 'NBA', 'active'),
('Lakers', 'Los Angeles', 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png', 'Western', 'Pacific', 'NBA', 'active'),
('Suns', 'Phoenix', 'https://a.espncdn.com/i/teamlogos/nba/500/phx.png', 'Western', 'Pacific', 'NBA', 'active'),
('Kings', 'Sacramento', 'https://a.espncdn.com/i/teamlogos/nba/500/sac.png', 'Western', 'Pacific', 'NBA', 'active'),
-- Western Conference - Southwest
('Mavericks', 'Dallas', 'https://a.espncdn.com/i/teamlogos/nba/500/dal.png', 'Western', 'Southwest', 'NBA', 'active'),
('Rockets', 'Houston', 'https://a.espncdn.com/i/teamlogos/nba/500/hou.png', 'Western', 'Southwest', 'NBA', 'active'),
('Grizzlies', 'Memphis', 'https://a.espncdn.com/i/teamlogos/nba/500/mem.png', 'Western', 'Southwest', 'NBA', 'active'),
('Pelicans', 'New Orleans', 'https://a.espncdn.com/i/teamlogos/mlb/500/no.png', 'Western', 'Southwest', 'NBA', 'active'),
('Spurs', 'San Antonio', 'https://a.espncdn.com/i/teamlogos/nba/500/sa.png', 'Western', 'Southwest', 'NBA', 'active')
ON CONFLICT DO NOTHING;