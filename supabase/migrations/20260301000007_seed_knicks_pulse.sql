-- Seed a test pulse message into the Knicks community huddle
-- This shows the X content rendering is working
INSERT INTO public.huddle_messages (
  huddle_id,
  user_id,
  content,
  message_type,
  is_bot_message,
  is_pulse_moment,
  pulse_source,
  embed_code
) VALUES (
  'd1026441-8bf7-4573-838b-21ae464e2ae9',
  '176b171d-410c-4645-85d7-3bd9d4664289',
  'Spurs at Knicks tonight at MSG. Jalen Brunson averaging 28.3 PPG in March, Knicks 8-2 in last 10. Victor Wembanyama questionable with knee soreness. Tip-off 7:30 PM ET.',
  'pulse',
  true,
  true,
  'x',
  'x:knicks_spurs_preview'
), (
  'd1026441-8bf7-4573-838b-21ae464e2ae9',
  '176b171d-410c-4645-85d7-3bd9d4664289',
  'Karl-Anthony Towns with 24 pts, 12 reb in last game. OG Anunoby defense elite — holding opponents to 38% FG. Knicks favored -7.5 tonight.',
  'pulse',
  true,
  true,
  'x',
  'x:knicks_kat_preview'
), (
  'd1026441-8bf7-4573-838b-21ae464e2ae9',
  '176b171d-410c-4645-85d7-3bd9d4664289',
  'r/NYKnicks hot take: "If we win tonight and Cavs lose, we clinch the 2 seed. This team is different." 450+ upvotes in 2 hours.',
  'pulse',
  true,
  true,
  'reddit',
  'reddit:knicks_seeding'
);
