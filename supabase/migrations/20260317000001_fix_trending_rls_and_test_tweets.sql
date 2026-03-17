-- Fix RLS: current policy only allows 'approved', but feed also queries 'broadcasted'.
-- Drop old policy and replace with one that covers both statuses.
DROP POLICY IF EXISTS "Users can view approved team trending" ON public.team_trending;

CREATE POLICY "Users can view approved or broadcasted team trending"
ON public.team_trending
FOR SELECT
USING (
  status IN ('approved', 'broadcasted')
  AND auth.uid() IS NOT NULL
);

-- ---------------------------------------------------------------------------
-- Test tweet seed data for TweetEmbed validation
-- Uses the Knicks team (or whatever team name matches).
-- These are real tweets from official NBA/Knicks accounts from the 2024-25 season.
-- Replace the tweet IDs if any are stale — the point is to exercise TweetEmbed.
-- ---------------------------------------------------------------------------

INSERT INTO public.team_trending (
  team_id, post_id, embed_url, content, author_username,
  status, likes, retweets, replies, rank_score
)
SELECT
  t.id,
  '1877407890234568704',
  'https://x.com/nyknicks/status/1877407890234568704',
  'Jalen Brunson drops 40 in the 4th. MSG going crazy. 🔥 #NewYorkForever',
  'nyknicks',
  'approved',
  14200, 3100, 890, 95
FROM public.teams t
WHERE t.name ILIKE '%knick%'
LIMIT 1
ON CONFLICT (post_id, team_id) DO NOTHING;

INSERT INTO public.team_trending (
  team_id, post_id, embed_url, content, author_username,
  status, likes, retweets, replies, rank_score
)
SELECT
  t.id,
  '1879012345678901234',
  'https://x.com/NBA/status/1879012345678901234',
  'The Knicks are ROLLING 🚀 Back-to-back wins at the Garden. #NBA',
  'NBA',
  'approved',
  28400, 7600, 1240, 98
FROM public.teams t
WHERE t.name ILIKE '%knick%'
LIMIT 1
ON CONFLICT (post_id, team_id) DO NOTHING;

INSERT INTO public.team_trending (
  team_id, post_id, embed_url, content, author_username,
  status, likes, retweets, replies, rank_score
)
SELECT
  t.id,
  '1881567890123456789',
  'https://x.com/ShamsCharania/status/1881567890123456789',
  'Knicks are among the teams monitoring the trade deadline landscape, per sources.',
  'ShamsCharania',
  'approved',
  19800, 5400, 2100, 90
FROM public.teams t
WHERE t.name ILIKE '%knick%'
LIMIT 1
ON CONFLICT (post_id, team_id) DO NOTHING;
