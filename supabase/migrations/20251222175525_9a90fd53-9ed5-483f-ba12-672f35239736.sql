-- Add missing NFL teams
INSERT INTO teams (id, name, city, league, status) VALUES
  (gen_random_uuid(), 'Bears', 'Chicago', 'NFL', 'active'),
  (gen_random_uuid(), 'Bengals', 'Cincinnati', 'NFL', 'active'),
  (gen_random_uuid(), 'Panthers', 'Carolina', 'NFL', 'active'),
  (gen_random_uuid(), 'Cardinals', 'Arizona', 'NFL', 'active'),
  (gen_random_uuid(), 'Ravens', 'Baltimore', 'NFL', 'active'),
  (gen_random_uuid(), 'Broncos', 'Denver', 'NFL', 'active'),
  (gen_random_uuid(), 'Colts', 'Indianapolis', 'NFL', 'active'),
  (gen_random_uuid(), 'Jets', 'New York', 'NFL', 'active'),
  (gen_random_uuid(), 'Saints', 'New Orleans', 'NFL', 'active'),
  (gen_random_uuid(), 'Titans', 'Tennessee', 'NFL', 'active'),
  (gen_random_uuid(), 'Eagles', 'Philadelphia', 'NFL', 'active'),
  (gen_random_uuid(), 'Commanders', 'Washington', 'NFL', 'active')
ON CONFLICT DO NOTHING;

-- Add subreddit mappings for the new teams
INSERT INTO team_subreddits (team_id, subreddit_name, rss_url, is_active)
SELECT id, 'CHIBears', 'https://www.reddit.com/r/CHIBears/.rss', true FROM teams WHERE name = 'Bears' AND league = 'NFL'
ON CONFLICT (team_id) DO UPDATE SET subreddit_name = EXCLUDED.subreddit_name, rss_url = EXCLUDED.rss_url, is_active = true;

INSERT INTO team_subreddits (team_id, subreddit_name, rss_url, is_active)
SELECT id, 'bengals', 'https://www.reddit.com/r/bengals/.rss', true FROM teams WHERE name = 'Bengals' AND league = 'NFL'
ON CONFLICT (team_id) DO UPDATE SET subreddit_name = EXCLUDED.subreddit_name, rss_url = EXCLUDED.rss_url, is_active = true;

INSERT INTO team_subreddits (team_id, subreddit_name, rss_url, is_active)
SELECT id, 'panthers', 'https://www.reddit.com/r/panthers/.rss', true FROM teams WHERE name = 'Panthers' AND league = 'NFL'
ON CONFLICT (team_id) DO UPDATE SET subreddit_name = EXCLUDED.subreddit_name, rss_url = EXCLUDED.rss_url, is_active = true;

INSERT INTO team_subreddits (team_id, subreddit_name, rss_url, is_active)
SELECT id, 'AZCardinals', 'https://www.reddit.com/r/AZCardinals/.rss', true FROM teams WHERE name = 'Cardinals' AND league = 'NFL'
ON CONFLICT (team_id) DO UPDATE SET subreddit_name = EXCLUDED.subreddit_name, rss_url = EXCLUDED.rss_url, is_active = true;

INSERT INTO team_subreddits (team_id, subreddit_name, rss_url, is_active)
SELECT id, 'ravens', 'https://www.reddit.com/r/ravens/.rss', true FROM teams WHERE name = 'Ravens' AND league = 'NFL'
ON CONFLICT (team_id) DO UPDATE SET subreddit_name = EXCLUDED.subreddit_name, rss_url = EXCLUDED.rss_url, is_active = true;

INSERT INTO team_subreddits (team_id, subreddit_name, rss_url, is_active)
SELECT id, 'DenverBroncos', 'https://www.reddit.com/r/DenverBroncos/.rss', true FROM teams WHERE name = 'Broncos' AND league = 'NFL'
ON CONFLICT (team_id) DO UPDATE SET subreddit_name = EXCLUDED.subreddit_name, rss_url = EXCLUDED.rss_url, is_active = true;

INSERT INTO team_subreddits (team_id, subreddit_name, rss_url, is_active)
SELECT id, 'Colts', 'https://www.reddit.com/r/Colts/.rss', true FROM teams WHERE name = 'Colts' AND league = 'NFL'
ON CONFLICT (team_id) DO UPDATE SET subreddit_name = EXCLUDED.subreddit_name, rss_url = EXCLUDED.rss_url, is_active = true;

INSERT INTO team_subreddits (team_id, subreddit_name, rss_url, is_active)
SELECT id, 'nyjets', 'https://www.reddit.com/r/nyjets/.rss', true FROM teams WHERE name = 'Jets' AND league = 'NFL'
ON CONFLICT (team_id) DO UPDATE SET subreddit_name = EXCLUDED.subreddit_name, rss_url = EXCLUDED.rss_url, is_active = true;

INSERT INTO team_subreddits (team_id, subreddit_name, rss_url, is_active)
SELECT id, 'Saints', 'https://www.reddit.com/r/Saints/.rss', true FROM teams WHERE name = 'Saints' AND league = 'NFL'
ON CONFLICT (team_id) DO UPDATE SET subreddit_name = EXCLUDED.subreddit_name, rss_url = EXCLUDED.rss_url, is_active = true;

INSERT INTO team_subreddits (team_id, subreddit_name, rss_url, is_active)
SELECT id, 'Tennesseetitans', 'https://www.reddit.com/r/Tennesseetitans/.rss', true FROM teams WHERE name = 'Titans' AND league = 'NFL'
ON CONFLICT (team_id) DO UPDATE SET subreddit_name = EXCLUDED.subreddit_name, rss_url = EXCLUDED.rss_url, is_active = true;

INSERT INTO team_subreddits (team_id, subreddit_name, rss_url, is_active)
SELECT id, 'eagles', 'https://www.reddit.com/r/eagles/.rss', true FROM teams WHERE name = 'Eagles' AND league = 'NFL'
ON CONFLICT (team_id) DO UPDATE SET subreddit_name = EXCLUDED.subreddit_name, rss_url = EXCLUDED.rss_url, is_active = true;

INSERT INTO team_subreddits (team_id, subreddit_name, rss_url, is_active)
SELECT id, 'Commanders', 'https://www.reddit.com/r/Commanders/.rss', true FROM teams WHERE name = 'Commanders' AND league = 'NFL'
ON CONFLICT (team_id) DO UPDATE SET subreddit_name = EXCLUDED.subreddit_name, rss_url = EXCLUDED.rss_url, is_active = true;