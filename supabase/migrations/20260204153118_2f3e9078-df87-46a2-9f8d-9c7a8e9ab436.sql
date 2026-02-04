-- Fix NCAA team logos to use correct ESPN numeric team IDs
-- ESPN format: https://a.espncdn.com/i/teamlogos/ncaa/500/{id}.png

-- Big Ten Conference
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/356.png' WHERE league = 'NCAA' AND city = 'Illinois' AND name = 'Fighting Illini'; -- 356
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/2294.png' WHERE league = 'NCAA' AND city = 'Iowa' AND name = 'Hawkeyes'; -- 2294
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/120.png' WHERE league = 'NCAA' AND city = 'Maryland' AND name = 'Terrapins'; -- 120
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/130.png' WHERE league = 'NCAA' AND city = 'Michigan' AND name = 'Wolverines'; -- 130
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/127.png' WHERE league = 'NCAA' AND city = 'Michigan State' AND name = 'Spartans'; -- 127
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/135.png' WHERE league = 'NCAA' AND city = 'Minnesota' AND name = 'Golden Gophers'; -- 135
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/158.png' WHERE league = 'NCAA' AND city = 'Nebraska' AND name = 'Cornhuskers'; -- 158
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/77.png' WHERE league = 'NCAA' AND city = 'Northwestern' AND name = 'Wildcats'; -- 77
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png' WHERE league = 'NCAA' AND city = 'Ohio State' AND name = 'Buckeyes'; -- 194
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/213.png' WHERE league = 'NCAA' AND city = 'Penn State' AND name = 'Nittany Lions'; -- 213
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/2509.png' WHERE league = 'NCAA' AND city = 'Purdue' AND name = 'Boilermakers'; -- 2509
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/164.png' WHERE league = 'NCAA' AND city = 'Rutgers' AND name = 'Scarlet Knights'; -- 164
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/26.png' WHERE league = 'NCAA' AND city = 'UCLA' AND name = 'Bruins'; -- 26
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/30.png' WHERE league = 'NCAA' AND city = 'USC' AND name = 'Trojans'; -- 30
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/264.png' WHERE league = 'NCAA' AND city = 'Washington' AND name = 'Huskies'; -- 264
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/275.png' WHERE league = 'NCAA' AND city = 'Wisconsin' AND name = 'Badgers'; -- 275
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png' WHERE league = 'NCAA' AND city = 'Oregon' AND name = 'Ducks'; -- 2483
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png' WHERE league = 'NCAA' AND city = 'Indiana' AND name = 'Hoosiers'; -- 84

-- Big 12 Conference
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/12.png' WHERE league = 'NCAA' AND city = 'Arizona' AND name = 'Wildcats'; -- 12
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/9.png' WHERE league = 'NCAA' AND city = 'Arizona State' AND name = 'Sun Devils'; -- 9
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/239.png' WHERE league = 'NCAA' AND city = 'Baylor' AND name = 'Bears'; -- 239
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/252.png' WHERE league = 'NCAA' AND city = 'BYU' AND name = 'Cougars'; -- 252
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/2132.png' WHERE league = 'NCAA' AND city = 'Cincinnati' AND name = 'Bearcats'; -- 2132
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/248.png' WHERE league = 'NCAA' AND city = 'Houston' AND name = 'Cougars'; -- 248
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/66.png' WHERE league = 'NCAA' AND city = 'Iowa State' AND name = 'Cyclones'; -- 66
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/2305.png' WHERE league = 'NCAA' AND city = 'Kansas' AND name = 'Jayhawks'; -- 2305
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/2306.png' WHERE league = 'NCAA' AND city = 'Kansas State' AND name = 'Wildcats'; -- 2306
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/197.png' WHERE league = 'NCAA' AND city = 'Oklahoma State' AND name = 'Cowboys'; -- 197
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/2628.png' WHERE league = 'NCAA' AND city = 'TCU' AND name = 'Horned Frogs'; -- 2628
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/2116.png' WHERE league = 'NCAA' AND city = 'UCF' AND name = 'Knights'; -- 2116
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/254.png' WHERE league = 'NCAA' AND city = 'Utah' AND name = 'Utes'; -- 254
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/277.png' WHERE league = 'NCAA' AND city = 'West Virginia' AND name = 'Mountaineers'; -- 277
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/38.png' WHERE league = 'NCAA' AND city = 'Colorado' AND name = 'Buffaloes'; -- 38
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/2641.png' WHERE league = 'NCAA' AND city = 'Texas Tech' AND name = 'Red Raiders'; -- 2641

-- SEC Conference
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png' WHERE league = 'NCAA' AND city = 'Alabama' AND name = 'Crimson Tide'; -- 333
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/8.png' WHERE league = 'NCAA' AND city = 'Arkansas' AND name = 'Razorbacks'; -- 8
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/2.png' WHERE league = 'NCAA' AND city = 'Auburn' AND name = 'Tigers'; -- 2
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/57.png' WHERE league = 'NCAA' AND city = 'Florida' AND name = 'Gators'; -- 57
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png' WHERE league = 'NCAA' AND city = 'Georgia' AND name = 'Bulldogs'; -- 61
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/96.png' WHERE league = 'NCAA' AND city = 'Kentucky' AND name = 'Wildcats'; -- 96
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/99.png' WHERE league = 'NCAA' AND city = 'LSU' AND name = 'Tigers'; -- 99
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/344.png' WHERE league = 'NCAA' AND city = 'Mississippi State' AND name = 'Bulldogs'; -- 344
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/142.png' WHERE league = 'NCAA' AND city = 'Missouri' AND name = 'Tigers'; -- 142
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/201.png' WHERE league = 'NCAA' AND city = 'Oklahoma' AND name = 'Sooners'; -- 201
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/145.png' WHERE league = 'NCAA' AND city = 'Ole Miss' AND name = 'Rebels'; -- 145
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/2579.png' WHERE league = 'NCAA' AND city = 'South Carolina' AND name = 'Gamecocks'; -- 2579
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png' WHERE league = 'NCAA' AND city = 'Tennessee' AND name = 'Volunteers'; -- 2633
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png' WHERE league = 'NCAA' AND city = 'Texas' AND name = 'Longhorns'; -- 251
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png' WHERE league = 'NCAA' AND city = 'Texas A&M' AND name = 'Aggies'; -- 245
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/238.png' WHERE league = 'NCAA' AND city = 'Vanderbilt' AND name = 'Commodores'; -- 238

-- ACC Conference
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/103.png' WHERE league = 'NCAA' AND city = 'Boston College' AND name = 'Eagles'; -- 103
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/25.png' WHERE league = 'NCAA' AND city = 'California' AND name = 'Golden Bears'; -- 25
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/228.png' WHERE league = 'NCAA' AND city = 'Clemson' AND name = 'Tigers'; -- 228
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/150.png' WHERE league = 'NCAA' AND city = 'Duke' AND name = 'Blue Devils'; -- 150
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/52.png' WHERE league = 'NCAA' AND city = 'Florida State' AND name = 'Seminoles'; -- 52
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/59.png' WHERE league = 'NCAA' AND city = 'Georgia Tech' AND name = 'Yellow Jackets'; -- 59
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/97.png' WHERE league = 'NCAA' AND city = 'Louisville' AND name = 'Cardinals'; -- 97
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/2350.png' WHERE league = 'NCAA' AND city = 'Miami' AND name = 'Hurricanes'; -- 2350
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png' WHERE league = 'NCAA' AND city = 'NC State' AND name = 'Wolfpack'; -- 153
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png' WHERE league = 'NCAA' AND city = 'North Carolina' AND name = 'Tar Heels'; -- Actually 153
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/221.png' WHERE league = 'NCAA' AND city = 'Pitt' AND name = 'Panthers'; -- 221
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/2567.png' WHERE league = 'NCAA' AND city = 'SMU' AND name = 'Mustangs'; -- 2567
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/24.png' WHERE league = 'NCAA' AND city = 'Stanford' AND name = 'Cardinal'; -- 24
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/183.png' WHERE league = 'NCAA' AND city = 'Syracuse' AND name = 'Orange'; -- 183
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/258.png' WHERE league = 'NCAA' AND city = 'Virginia' AND name = 'Cavaliers'; -- 258
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/259.png' WHERE league = 'NCAA' AND city = 'Virginia Tech' AND name = 'Hokies'; -- 259
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/154.png' WHERE league = 'NCAA' AND city = 'Wake Forest' AND name = 'Demon Deacons'; -- 154
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png' WHERE league = 'NCAA' AND city = 'North Carolina' AND name = 'Tar Heels'; -- 153

-- Independents
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/87.png' WHERE league = 'NCAA' AND city = 'Notre Dame' AND name LIKE '%Irish%'; -- 87
UPDATE teams SET logo_url = 'https://a.espncdn.com/i/teamlogos/ncaa/500/68.png' WHERE league = 'NCAA' AND city = 'Boise State' AND name = 'Broncos'; -- 68