

## Add All 32 NHL Teams to Side Huddle Sports

### What We're Doing
Insert all 32 NHL teams into the `teams` table following the exact same pattern used for NBA and MLB teams. The NHL filter already exists in the team directory, so once the data is in, everything will just work.

### Logo Source
ESPN CDN pattern: `https://a.espncdn.com/i/teamlogos/nhl/500/{slug}.png`
(Same pattern as NBA/MLB, just with `nhl` instead)

### All 32 NHL Teams

**Eastern Conference -- Atlantic Division**
- Boston Bruins (bos)
- Buffalo Sabres (buf)
- Detroit Red Wings (det)
- Florida Panthers (fla)
- Montreal Canadiens (mtl)
- Ottawa Senators (ott)
- Tampa Bay Lightning (tb)
- Toronto Maple Leafs (tor)

**Eastern Conference -- Metropolitan Division**
- Carolina Hurricanes (car)
- Columbus Blue Jackets (cbj)
- New Jersey Devils (nj)
- New York Islanders (nyi)
- New York Rangers (nyr)
- Philadelphia Flyers (phi)
- Pittsburgh Penguins (pit)
- Washington Capitals (wsh)

**Western Conference -- Central Division**
- Arizona/Utah Hockey Club (utah)
- Chicago Blackhawks (chi)
- Colorado Avalanche (col)
- Dallas Stars (dal)
- Minnesota Wild (min)
- Nashville Predators (nsh)
- St. Louis Blues (stl)
- Winnipeg Jets (wpg)

**Western Conference -- Pacific Division**
- Anaheim Ducks (ana)
- Calgary Flames (cgy)
- Edmonton Oilers (edm)
- Los Angeles Kings (la)
- San Jose Sharks (sj)
- Seattle Kraken (sea)
- Vancouver Canucks (van)
- Vegas Golden Knights (vgk)

### Technical Details

- **Single SQL migration** inserting 32 rows into the `teams` table
- Fields: `name`, `city`, `league` (NHL), `conference` (Eastern/Western), `division` (Atlantic/Metropolitan/Central/Pacific), `logo_url`, `status` (active), `featured_order` (999)
- Logo URLs follow ESPN CDN pattern matching NBA/MLB
- No code changes needed -- the NHL filter tab already exists in the team directory

