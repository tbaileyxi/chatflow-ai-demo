-- Insert subreddits for all active teams that don't have one
INSERT INTO team_subreddits (team_id, subreddit_name, rss_url, is_active) VALUES
-- NCAA Teams
('9f19b8cd-5b1b-4b0f-a0a4-818fd9b66cd7', '12thMan', 'https://www.reddit.com/r/12thMan/.rss', true),
('9c57d429-6c6c-43f7-93ae-52ff8cf152ba', 'BroncoSports', 'https://www.reddit.com/r/BroncoSports/.rss', true),
('bccb09c8-2e04-44b0-a3f2-9921a9b3120a', 'buffalobills', 'https://www.reddit.com/r/buffs/.rss', true),
('9adb4619-ab1a-4cdf-8c42-dcee715d92d3', 'georgiabulldogs', 'https://www.reddit.com/r/georgiabulldogs/.rss', true),
('79b5a9a1-7294-4303-a5cf-d8929d1abf59', 'rolltide', 'https://www.reddit.com/r/rolltide/.rss', true),
('01e63921-30e2-4f92-bf4f-fac8e6c6f301', 'notredamefootball', 'https://www.reddit.com/r/notredamefootball/.rss', true),
('8e71e6fd-2ce2-41fb-8c9b-f6c6d402a28a', 'Gamecocks', 'https://www.reddit.com/r/Gamecocks/.rss', true),
('45864425-29c1-4468-83fb-38f0b98e714e', 'FloridaGators', 'https://www.reddit.com/r/FloridaGators/.rss', true),
-- NFL Teams missing subreddits
('649a1db6-5df3-4e24-b5b1-470f043bdd62', 'Browns', 'https://www.reddit.com/r/Browns/.rss', true),
('b9c16504-22f2-41e3-a698-cc7802a90fa0', 'buccaneers', 'https://www.reddit.com/r/buccaneers/.rss', true),
('d1caddb6-4e72-4a36-b130-c1d237c862f3', 'Chargers', 'https://www.reddit.com/r/Chargers/.rss', true),
('64d2f2d5-2465-4f4a-8565-3b6667119044', 'miamidolphins', 'https://www.reddit.com/r/miamidolphins/.rss', true),
('4a07943f-f0b6-4c8b-bcdd-45d69b404bea', 'falcons', 'https://www.reddit.com/r/falcons/.rss', true),
('18085b27-0a72-4b93-a258-a635c3b334b0', 'Jaguars', 'https://www.reddit.com/r/Jaguars/.rss', true),
('49581517-f193-4b58-ac04-a1b2574d572e', 'Patriots', 'https://www.reddit.com/r/Patriots/.rss', true),
('f563c270-1734-4778-94b8-2a11b70b4764', 'raiders', 'https://www.reddit.com/r/raiders/.rss', true),
('dd6d0593-7c99-4b63-a981-c30c80b20021', 'LosAngelesRams', 'https://www.reddit.com/r/LosAngelesRams/.rss', true),
('a94aa5bc-37a7-40cc-a1d2-f5dbd9c8a5ae', 'Seahawks', 'https://www.reddit.com/r/Seahawks/.rss', true),
('eec04af2-f763-413f-8c29-37cb400b419a', 'steelers', 'https://www.reddit.com/r/steelers/.rss', true),
('d0dc6016-932e-428d-97ed-1707e8911030', 'Texans', 'https://www.reddit.com/r/Texans/.rss', true),
('8a1ede9e-40e8-4311-94ca-6f8af38b33f4', 'minnesotavikings', 'https://www.reddit.com/r/minnesotavikings/.rss', true)
ON CONFLICT (team_id) DO NOTHING;