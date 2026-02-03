-- Fix Pelicans logo URL (was incorrectly using MLB path)
UPDATE public.teams 
SET logo_url = 'https://a.espncdn.com/i/teamlogos/nba/500/no.png' 
WHERE name = 'Pelicans' AND league = 'NBA';