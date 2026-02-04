-- Fix NCAA teams with broken base64 logo URLs - update to ESPN CDN URLs
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/tam.png' WHERE id = '9f19b8cd-5b1b-4b0f-a0a4-818fd9b66cd7'; -- Texas A&M Aggies
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/bois.png' WHERE id = '9c57d429-6c6c-43f7-93ae-52ff8cf152ba'; -- Boise State Broncos
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/ga.png' WHERE id = '9adb4619-ab1a-4cdf-8c42-dcee715d92d3'; -- Georgia Bulldogs
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/ore.png' WHERE id = '5139b4d2-d5cc-414f-a42d-6e08f5f8603e'; -- Oregon Ducks
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/nd.png' WHERE id = '01e63921-30e2-4f92-bf4f-fac8e6c6f301'; -- Notre Dame Fighting Irish
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/scar.png' WHERE id = '8e71e6fd-2ce2-41fb-8c9b-f6c6d402a28a'; -- South Carolina Gamecocks
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/mia.png' WHERE id = 'd732be6e-add5-446a-b1ab-917abf739196'; -- Miami Hurricanes
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/unc.png' WHERE id = '299c6436-ad76-4996-8791-266a855db622'; -- North Carolina Tar Heels
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/aub.png' WHERE id = '5fcc6b69-da55-4951-9432-d8a08daf464a'; -- Auburn Tigers
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/lsu.png' WHERE id = '4077fcb4-a4b9-4624-896c-a8cee9c17f87'; -- LSU Tigers
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/tenn.png' WHERE id = '74594ba8-a023-4aa2-9ce2-e152db2bf1da'; -- Tennessee Volunteers