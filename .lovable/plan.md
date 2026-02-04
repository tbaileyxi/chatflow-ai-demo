
# Add NCAA Power Four Conference Teams

## Overview
Add all missing teams from the four major NCAA football conferences (Big Ten, Big 12, SEC, ACC) to the teams database. The system currently has 16 NCAA teams, and we need to add the remaining Power Four teams while avoiding duplicates.

## Power Four Conferences (2024-25 Realignment)

### Teams Already in Database (No Action Needed)
| Team | Conference |
|------|------------|
| Texas A&M Aggies | SEC |
| Colorado Buffaloes | Big 12 |
| Georgia Bulldogs | SEC |
| Alabama Crimson Tide | SEC |
| Oregon Ducks | Big Ten |
| South Carolina Gamecocks | SEC |
| Florida Gators | SEC |
| Indiana Hoosiers | Big Ten |
| Miami Hurricanes | ACC |
| Texas Tech Red Raiders | Big 12 |
| North Carolina Tar Heels | ACC |
| LSU Tigers | SEC |
| Auburn Tigers | SEC |
| Tennessee Volunteers | SEC |

### Teams to Add

**Big Ten Conference (14 teams needed)**
| City | Name | Slug |
|------|------|------|
| Illinois | Fighting Illini | ill |
| Iowa | Hawkeyes | iowa |
| Maryland | Terrapins | md |
| Michigan | Wolverines | mich |
| Michigan State | Spartans | msu |
| Minnesota | Golden Gophers | minn |
| Nebraska | Cornhuskers | neb |
| Northwestern | Wildcats | nw |
| Ohio State | Buckeyes | osu |
| Penn State | Nittany Lions | psu |
| Purdue | Boilermakers | pur |
| Rutgers | Scarlet Knights | rut |
| UCLA | Bruins | ucla |
| USC | Trojans | usc |
| Washington | Huskies | wash |
| Wisconsin | Badgers | wis |

**Big 12 Conference (14 teams needed)**
| City | Name | Slug |
|------|------|------|
| Arizona | Wildcats | ari |
| Arizona State | Sun Devils | asu |
| Baylor | Bears | bay |
| BYU | Cougars | byu |
| Cincinnati | Bearcats | cin |
| Houston | Cougars | hou |
| Iowa State | Cyclones | isu |
| Kansas | Jayhawks | kan |
| Kansas State | Wildcats | ksu |
| Oklahoma State | Cowboys | okst |
| TCU | Horned Frogs | tcu |
| UCF | Knights | ucf |
| Utah | Utes | utah |
| West Virginia | Mountaineers | wvu |

**SEC (2 teams needed)**
| City | Name | Slug |
|------|------|------|
| Arkansas | Razorbacks | ark |
| Kentucky | Wildcats | uk |
| Mississippi State | Bulldogs | miss |
| Missouri | Tigers | miz |
| Oklahoma | Sooners | okla |
| Ole Miss | Rebels | olemiss |
| Texas | Longhorns | tex |
| Vanderbilt | Commodores | van |

**ACC (13 teams needed)**
| City | Name | Slug |
|------|------|------|
| Boston College | Eagles | bc |
| California | Golden Bears | cal |
| Clemson | Tigers | clem |
| Duke | Blue Devils | duke |
| Florida State | Seminoles | fsu |
| Georgia Tech | Yellow Jackets | gt |
| Louisville | Cardinals | lou |
| NC State | Wolfpack | ncsu |
| Pitt | Panthers | pitt |
| SMU | Mustangs | smu |
| Stanford | Cardinal | stan |
| Syracuse | Orange | syr |
| Virginia | Cavaliers | uva |
| Virginia Tech | Hokies | vt |
| Wake Forest | Demon Deacons | wake |

## Implementation

### Logo URL Pattern
Following the established pattern from NBA/MLB additions:
```
https://a.espncdn.com/i/teamlogos/ncaa/500/[slug].png
```

### Database Insert Strategy
Create an edge function to bulk insert all teams with proper deduplication logic:

1. Check existing teams by matching `city` + `name` combination
2. Skip teams that already exist
3. Insert new teams with:
   - `league`: 'NCAA'
   - `conference`: The appropriate conference name
   - `status`: 'active'
   - `logo_url`: ESPN CDN URL

### Total Teams to Add
- Big Ten: ~14 new teams
- Big 12: ~14 new teams  
- SEC: ~2 new teams (most already exist)
- ACC: ~13 new teams

**Approximate Total: 43 new NCAA teams**

## Technical Details

### SQL Insert Statement Pattern
```sql
INSERT INTO teams (name, city, league, conference, logo_url, status)
VALUES 
  ('Wolverines', 'Michigan', 'NCAA', 'Big Ten', 'https://a.espncdn.com/i/teamlogos/ncaa/500/mich.png', 'active'),
  -- ... more teams
ON CONFLICT DO NOTHING;
```

### Files to Modify
- No code changes needed - this is a data-only update
- Will execute SQL directly to add teams

### After Insertion
- Teams will immediately appear in `/sponsor` page
- Teams will appear in Team Directory
- Teams will be available for huddle creation
- `sync-highlightly-teams` function can map them to Highlightly IDs for scores/highlights

## Verification Steps
1. Run the insert SQL
2. Verify teams appear on sponsor page with correct logos
3. Confirm no duplicate teams were created
4. Test that new teams can be selected for sponsorship
