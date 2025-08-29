-- Add Boise State Broncos as a separate team to fix the API mapping issue
INSERT INTO public.teams (name, city, league, conference, status) 
VALUES ('Broncos', 'Boise State', 'NCAA', 'Mountain West', 'active')
ON CONFLICT DO NOTHING;