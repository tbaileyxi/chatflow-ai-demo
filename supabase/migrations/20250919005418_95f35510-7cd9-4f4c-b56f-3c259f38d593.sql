-- Create 2025 NFL season weeks (weeks 3-18 since week 1-2 exist)
INSERT INTO pickem_weeks (league, season_year, week_number, start_at, end_at) VALUES
('nfl', 2025, 3, '2025-09-19 00:00:00+00', '2025-09-23 23:59:59.999+00'),
('nfl', 2025, 4, '2025-09-26 00:00:00+00', '2025-09-30 23:59:59.999+00'),
('nfl', 2025, 5, '2025-10-03 00:00:00+00', '2025-10-07 23:59:59.999+00'),
('nfl', 2025, 6, '2025-10-10 00:00:00+00', '2025-10-14 23:59:59.999+00'),
('nfl', 2025, 7, '2025-10-17 00:00:00+00', '2025-10-21 23:59:59.999+00'),
('nfl', 2025, 8, '2025-10-24 00:00:00+00', '2025-10-28 23:59:59.999+00'),
('nfl', 2025, 9, '2025-10-31 00:00:00+00', '2025-11-04 23:59:59.999+00'),
('nfl', 2025, 10, '2025-11-07 00:00:00+00', '2025-11-11 23:59:59.999+00'),
('nfl', 2025, 11, '2025-11-14 00:00:00+00', '2025-11-18 23:59:59.999+00'),
('nfl', 2025, 12, '2025-11-21 00:00:00+00', '2025-11-25 23:59:59.999+00'),
('nfl', 2025, 13, '2025-11-28 00:00:00+00', '2025-12-02 23:59:59.999+00'),
('nfl', 2025, 14, '2025-12-05 00:00:00+00', '2025-12-09 23:59:59.999+00'),
('nfl', 2025, 15, '2025-12-12 00:00:00+00', '2025-12-16 23:59:59.999+00'),
('nfl', 2025, 16, '2025-12-19 00:00:00+00', '2025-12-23 23:59:59.999+00'),
('nfl', 2025, 17, '2025-12-26 00:00:00+00', '2025-12-30 23:59:59.999+00'),
('nfl', 2025, 18, '2026-01-02 00:00:00+00', '2026-01-06 23:59:59.999+00')
ON CONFLICT (league, season_year, week_number) DO NOTHING;

-- Add some sample NFL games for week 3 to test Pick 'Em functionality
INSERT INTO pickem_games (week_id, espn_game_id, home_team, away_team, start_time, status) 
SELECT 
  pw.id,
  'nfl_' || pw.week_number || '_game_' || generate_series(1, 16),
  CASE generate_series(1, 16) % 4
    WHEN 1 THEN 'Kansas City Chiefs'
    WHEN 2 THEN 'Buffalo Bills' 
    WHEN 3 THEN 'Dallas Cowboys'
    ELSE 'Green Bay Packers'
  END,
  CASE generate_series(1, 16) % 4
    WHEN 1 THEN 'Denver Broncos'
    WHEN 2 THEN 'Miami Dolphins'
    WHEN 3 THEN 'New York Giants'
    ELSE 'Chicago Bears'
  END,
  pw.start_at + interval '1 day' + (generate_series(1, 16) % 3) * interval '1 day',
  'scheduled'
FROM pickem_weeks pw 
WHERE pw.league = 'nfl' AND pw.season_year = 2025 AND pw.week_number = 3
ON CONFLICT (week_id, espn_game_id) DO NOTHING;