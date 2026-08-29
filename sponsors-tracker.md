> **ARCHIVED — 2026-08-21. Do not update this file.**
>
> The sponsor pipeline now lives in the `sponsor_leads` table, shown on `/outreach`.
> That is what `outreach-send` actually reads, so statuses here are stale and will
> drift further. Kept for history and for the prospect notes, which the table has no
> column for. See CLAUDE.md.

# Side Huddle Sponsors — Outreach Tracker

Single source of truth for sponsor prospecting + outreach. The `sponsor-blitz` agent reads/writes this file. You (or Claude) update statuses manually as outreach progresses.

## How to update

Just talk to Claude in plain English. Examples:

- *"Mark Bojangles as Sent"* → updates Status, bumps Last Touch to today
- *"I emailed Wingstop this morning"* → Status: `Emailed`, Last Touch today, log note appended
- *"Bojangles replied — booking a call Thursday"* → Status: `Replied`, appends a log note
- *"Mark Marco's Pizza as Dead — they said no thanks"* → Status: `Dead`
- *"Who haven't I followed up with in 7+ days?"* → Claude scans the table and lists them
- *"Show me everyone in Drafted status"* → filtered list
- *"What's my pipeline value?"* → sums $/mo across active prospects

## Status definitions

| Status | Meaning |
|--------|---------|
| `Researched` | Added to tracker. No outreach yet. |
| `Drafted` | Outreach written. Not sent yet. |
| `Sent` | Connection note sent on LinkedIn. Awaiting accept. |
| `Emailed` | Cold email sent from sidehuddlesports@gmail.com. Awaiting reply. |
| `Connected` | They accepted the connection. First DM sent or pending. |
| `Replied` | They responded. Active conversation. |
| `Booked` | Meeting scheduled. |
| `Won` | Signed as sponsor. 🏆 |
| `Dead` | No-go. Logged so we don't re-pitch. |

---

## Pipeline

| Date Added | Company | Contact | Title | Category | Bundle | $/mo | LinkedIn | Status | Last Touch | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-05-06 | Group 1 Automotive | (search) | SVP / CMO (Shelley Washburn) | Auto Dealer Group | Houston Cougars, Texans, Astros, Rockets, A&M, Longhorns, TCU (6-team) | $1,200 | https://www.linkedin.com/search/results/people/?keywords=Group%201%20Automotive%20marketing | Drafted | 2026-05-06 | Already partner with UH Athletics — strong signal |
| 2026-05-06 | Sewell Automotive | (search) | VP Marketing / Brand Director | Auto Dealer Group | Cowboys, Mavericks, Rangers, Stars, Texans, Astros, Rockets, Spurs, Longhorns, A&M (10-team) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=Sewell%20Automotive%20marketing | Drafted | 2026-05-06 | Statewide footprint DFW/HOU/AUS/SA — fits 10+ bundle |
| 2026-05-06 | Gillman Automotive Group | (search) | Marketing Manager / Director | Auto Dealer Group | Texans, Astros, Rockets, Houston Cougars, Spurs (3-team starter) | $650 | https://www.linkedin.com/search/results/people/?keywords=Gillman%20Automotive%20marketing | Drafted | 2026-05-06 | Family-owned, Houston + SA. Sponsors Buffalo Bayou Regatta |
| 2026-05-06 | Classic Chevrolet (Grapevine) | (search) | Marketing Director / GM | Auto Dealer | Cowboys, Mavericks, Rangers (3-team) | $650 | https://www.linkedin.com/search/results/people/?keywords=Classic%20Chevrolet%20Grapevine%20marketing | Drafted | 2026-05-06 | #1 Chevy dealer in DFW, single-point but huge volume |
| 2026-05-06 | Sonic Automotive (Texas region) | (search) | Regional Marketing Director — TX | Auto Dealer Group | Texans, Astros, Rockets, Houston Cougars, Cowboys, Mavericks (6-team) | $1,200 | https://www.linkedin.com/search/results/people/?keywords=Sonic%20Automotive%20Texas%20marketing | Drafted | 2026-05-06 | 19 Houston locations, already runs Dave Ward podcast sponsorship |
| 2026-05-06 | Allstate | (search) | Director of Sponsorships / Sports Marketing | Insurance | Alabama, Georgia, LSU, Ohio State, Michigan, Texas, Oklahoma, Notre Dame, Penn State, USC (10+ team) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=Allstate%20sponsorships%20sports%20marketing | Drafted | 2026-05-06 | 19th yr Sugar Bowl title sponsor; Big 12 naming rights frontrunner |
| 2026-05-06 | State Farm | (search) | Sports & Sponsorships Marketing Lead | Insurance | Illinois State + Big Ten flagships (10+ team) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=State%20Farm%20sports%20marketing%20sponsorships | Drafted | 2026-05-06 | First on-field logo at Illinois State Hancock Stadium (Nov 2024) |
| 2026-05-06 | Nationwide | (search) | Director of Sports Marketing / Sponsorships | Insurance | Ohio State, Cincinnati, Ohio (3-team) | $650 | https://www.linkedin.com/search/results/people/?keywords=Nationwide%20sports%20marketing%20sponsorships | Drafted | 2026-05-06 | 10-yr $17.1M Ohio State Official Insurance Sponsor — Columbus alignment |
| 2026-05-06 | USAA | (search) | Director of Sponsorships / Sports & Entertainment Marketing | Insurance | Army, Navy, Air Force, UT, A&M, UTSA, Baylor, TCU, Houston, TTU (10+ team) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=USAA%20sponsorships%20sports%20marketing | Drafted | 2026-05-06 | First/only Army-Navy presenting sponsor since 2009, extended through 2030 |
| 2026-05-06 | Liberty Mutual | (search) | Director of Sports Marketing / Brand Partnerships | Insurance | Notre Dame, BC, Penn State, Michigan, Ohio State, Clemson (6-team) | $1,200 | https://www.linkedin.com/search/results/people/?keywords=Liberty%20Mutual%20sports%20marketing%20sponsorships | Drafted | 2026-05-06 | Coach of the Year Award heritage — VERIFY current activation |
| 2026-05-06 | DraftKings | (search) | Director of Brand Marketing / Sponsorships | Sportsbook | Alabama, Georgia, LSU, Ohio State, Michigan, Texas, Penn State, USC, Notre Dame, Clemson (10+ team) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=DraftKings%20brand%20marketing%20sponsorships | Drafted | 2026-05-06 | NBCU multi-year ad deal (Sept 2025) locked sportsbook category across NFL/CFB/NBA |
| 2026-05-06 | FanDuel | (search) | VP Brand Marketing / Head of Sponsorships | Sportsbook | Alabama, Georgia, LSU, Ohio State, Michigan, Texas (6-team) | $1,200 | https://www.linkedin.com/search/results/people/?keywords=FanDuel%20brand%20marketing%20sponsorships | Drafted | 2026-05-06 | April 2026 push into sports prediction markets — natural bot integration |
| 2026-05-06 | PrizePicks | (search) | Director of Brand Marketing / Partnerships | DFS | Georgia, Alabama, LSU, Auburn, Tennessee, Florida (6-team) | $1,200 | https://www.linkedin.com/search/results/people/?keywords=PrizePicks%20brand%20marketing%20partnerships | Drafted | 2026-05-06 | Atlanta HQ; "It's Good To Be Right" CFB campaign w/ Marshawn Lynch, Reggie Bush (Jan 2026) |
| 2026-05-06 | Underdog Fantasy | (search) | VP Marketing / Head of Brand | DFS | Missouri, Kansas State, Kansas (3-team) | $650 | https://www.linkedin.com/search/results/people/?keywords=Underdog%20Fantasy%20marketing%20brand | Drafted | 2026-05-06 | Multi-year deals w/ KC Royals + St. Louis Blues — Missouri corridor investment |
| 2026-05-06 | Kalshi | (search) | Head of Marketing / Sports Lead | Prediction Markets | Alabama, Georgia, LSU, Ohio State, Michigan, Texas, Penn State, USC, Notre Dame, Oregon (10+ team) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=Kalshi%20marketing%20sports | Drafted | 2026-05-06 | 89% US prediction market share; sports = 72% of volume (BofA, Apr 2026) |
| 2026-05-07 | Polymarket | Art Malkov (CMO) | CMO / Head of Partnership Marketing | Prediction Markets | Oregon, Washington, USC, Miami, FSU, Clemson, UNC, Virginia Tech, Pitt, Stanford (10+ team — Pac-12/ACC, avoids Kalshi overlap) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=Polymarket%20marketing%20partnerships | Drafted | 2026-05-07 | US relaunch Dec 3 2025 via $112M QCEX acquisition + CFTC approval; X's official prediction market partner. CONFLICT: per-team exclusivity vs. Kalshi |
| 2026-05-07 | DoorDash | (search) | Director / VP Brand Marketing or Sponsorships | Food Delivery / QSR | LAFC, Inter Miami, Atlanta United, Seattle Sounders, NYCFC, Columbus Crew, LA Galaxy, Houston Cougars, UCLA, Washington (10-team MLS + WC-host CFB) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=DoorDash%20brand%20marketing%20sponsorships | Drafted | 2026-05-07 | FIFA WC 2026 + 2027 Official Tournament Supporter (Nov 2025); MLS Hat Trick yr 2; College Football campaign on 2026 Hashtag Sports shortlist |
| 2026-05-07 | Uber Eats | (search) | Head of Brand / Sports Marketing Lead | Food Delivery / QSR | Cowboys, Eagles, Chiefs, 49ers, Bills, Ravens (6-team NFL — non-overlap w/ DoorDash) | $1,200 | https://www.linkedin.com/search/results/people/?keywords=Uber%20Eats%20brand%20marketing%20sports | Drafted | 2026-05-07 | 2026 Ad Age Creativity Awards — Best Partnership for Uber Eats x NFL; "Build Your Own Super Bowl" w/ McConaughey + Bradley Cooper |
| 2026-05-07 | Wingstop | (search) | CMO / VP Brand Marketing | QSR | Lakers, Knicks, Warriors, Celtics, Mavericks, Heat (6-team NBA) | $1,200 | https://www.linkedin.com/search/results/people/?keywords=Wingstop%20brand%20marketing%20CMO | Drafted | 2026-05-07 | NBA Official Chicken + Official Wing partner (first major-league deal); CEO: brand on "a heck of a lot more sports" this year |
| 2026-05-07 | Buffalo Wild Wings | Seth Freeman (CMO) | CMO / Director of Brand | QSR | Duke, UNC, Kansas, Kentucky, UConn, Gonzaga (6-team CBB bluebloods) | $1,200 | https://www.linkedin.com/search/results/people/?keywords=Buffalo%20Wild%20Wings%20brand%20marketing%20Seth%20Freeman | Drafted | 2026-05-07 | "Official Hangout for NCAA Sports" since 2013; "That's March Madness" relaunch under new CMO Seth Freeman |
| 2026-05-07 | Domino's Pizza | Kate Trumbull (CMO) | CMO / VP Brand Marketing | QSR | Tampa Bay Buccaneers, Florida Gators, FSU, Miami Hurricanes, UCF, USF (6-team Florida) | $1,200 | https://www.linkedin.com/search/results/people/?keywords=Domino%27s%20Pizza%20brand%20marketing%20CMO | Drafted | 2026-05-07 | Multi-year Bucs deal w/ "Game Changer" $9.99 promo; long-running "Official Pizza of the NCAA"; Florida bundle extends Bucs partnership statewide |
| 2026-05-07 | JPMorgan Chase | (search) | Head of Sports Marketing / Sponsorships | Bank | Yankees, Knicks, Giants, Jets, Rangers, Mets, UConn MBB, Notre Dame, Michigan, Penn State (10-team NY/NE + Big Ten) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=JPMorgan%20Chase%20sports%20marketing%20sponsorships | Drafted | 2026-05-07 | JPMorganChase Athlete Council launched Mar 18 2026 — Steph, Magic, Sue Bird advising on financial literacy at universities |
| 2026-05-07 | Bank of America | (search) | SVP, Global Sponsorships & Experiential | Bank | Panthers, Hornets, Charlotte FC, UNC, NC State, Duke, Wake, Clemson, USC, VT (10-team Carolinas/ACC) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=Bank%20of%20America%20sponsorships%20sports%20marketing | Drafted | 2026-05-07 | First global FIFA banking partner; Beckham 5-yr ambassador (Nov 2025); BofA Stadium = Panthers home since 2004 |
| 2026-05-07 | Capital One | (search) | VP / Director of Sponsorships & Sports Marketing | Bank | Miami, FSU, UF, UCF, USF, Texas, Oklahoma, Tennessee, Auburn, Georgia (10-team SEC + FL) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=Capital%20One%20sponsorships%20sports%20marketing | Drafted | 2026-05-07 | Orange Bowl title sponsor since 2014 thru 2026; Rose Bowl CFP semifinal presenting at 107th edition; Bowl Mania across all ESPN bowls |
| 2026-05-07 | Truist | (search) | Head of Sports Sponsorships / Brand Partnerships | Bank | Wake, GT, Virginia, Louisville, Pitt, BC (6-team ACC interior — non-overlap w/ BofA) | $1,200 | https://www.linkedin.com/search/results/people/?keywords=Truist%20sports%20sponsorships%20brand%20partnerships | Drafted | 2026-05-07 | Largest non-naming-rights deal in Wake Forest history; Presenting Partner WFU women's athletics; Truist Momentum financial literacy across all WFU athletes |
| 2026-05-07 | Fifth Third Bank | (search) | CMO / Director of Sponsorships & NIL | Bank | Cincinnati, Dayton, Louisville, Michigan State, Auburn, Xavier (6-team — Team Fifth Third NIL footprint) | $1,200 | https://www.linkedin.com/search/results/people/?keywords=Fifth%20Third%20Bank%20sponsorships%20NIL%20brand | Drafted | 2026-05-07 | Team Fifth Third NIL expanded Feb 2026 to 30 athletes / 9 schools; Comerica Park renamed Fifth Third Field for Tigers (Apr 2026) |
| 2026-05-07 | Robinhood | (search) | Head of Brand Marketing / Sports Partnerships | Trading Platform | Alabama, Georgia, LSU, Ohio State, Michigan, Texas, Penn State, USC, Notre Dame, Oregon (10-team CFB flagships) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=Robinhood%20brand%20marketing%20sports%20partnerships | Drafted | 2026-05-07 | Aug 2025 Kalshi partnership rolled NFL + Power-4 CFB prediction markets in; 23XI NASCAR yr 2; brand publicly distinguishes sponsorships from prediction markets. CONFLICT: per-team vs. Kalshi |
| 2026-05-07 | SoFi | (search) | VP Brand Marketing / Sports & Entertainment | Trading/Lending | Rams, Chargers, UCLA, USC, Stanford, Cal, SDSU, Fresno St, SJSU, Boise St (10-team West Coast) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=SoFi%20brand%20marketing%20sports%20partnerships | Drafted | 2026-05-07 | SoFi Stadium $625M/20-yr naming rights; 55% NIL funding rate (4.4x industry avg) via NIL Club. CONFLICT: USC overlap vs. Robinhood — first to close locks |
| 2026-05-07 | Public.com | (search) | Head of Brand / Marketing | Trading Platform | Duke, Syracuse, Johns Hopkins (3-team starter — lacrosse-heavy, maps to PLL roster) | $650 | https://www.linkedin.com/search/results/people/?keywords=Public.com%20head%20of%20brand%20marketing | Drafted | 2026-05-07 | Official Investing App of the Premier Lacrosse League; 6 PLL athletes on platform; Paul Rabil (350K+ followers) active; $10K invest sweepstakes |
| 2026-05-07 | PayPal / Venmo | (search) | VP Sports Marketing / Brand Partnerships | Payments | Cowboys, Eagles, Chiefs, 49ers, Bills, Ravens, Lions, Packers, Steelers, Bucs (10-team NFL) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=PayPal%20Venmo%20sports%20marketing%20partnerships | Drafted | 2026-05-07 | Named Official P2P Payments Partner of the NFL April 21 2026; multi-year, $1M sweepstakes program; 100M+ Venmo users. Cross-sub-category overlap w/ Uber Eats permitted |
| 2026-05-07 | Coinbase | (search) | Head of Brand Marketing / Sports Partnerships | Crypto | Lakers, Warriors, Clippers, Celtics, Heat, Knicks, 76ers, Mavs, Nuggets, Suns (10-team NBA) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=Coinbase%20brand%20marketing%20sports%20partnerships | Drafted | 2026-05-07 | Exclusive crypto partner of NBA/WNBA/G League/2K League/USA Basketball; Jan 2026 "NBA Rookie Firsts" content series w/ Kon Knueppel + Tyrese Proctor; Warriors + Clippers team deals |
| 2026-05-07 | SeatGeek | Sarah Kettler (VP Brand/Consumer/Enterprise Mktg) | VP Brand, Consumer & Enterprise Marketing | Sports Ticketing | Michigan, FC Cincinnati, Chicago Fire, Cowboys, Nets, NYCFC, Spurs, Eagles, Falcons, Cavaliers (10-team — mirrors SeatGeek partner footprint) | $1,800 | https://www.linkedin.com/in/skettler/ | Drafted | 2026-05-07 | Run 2 (media-buy framing): direct LI URL for Sarah Kettler — leads partner mktg org that closed Cowboys/Saints/Pelicans/MLS/LAFC/SKC. Run 1 hook: Matt Herman CMO Oct 2025; FC Cincinnati + Chicago Fire stadium ticketing |
| 2026-05-07 | StubHub | Adam Budelli (Head of Partnerships) | Head of Partnerships | Sports Ticketing | Cowboys, Eagles, Yankees, Mets, Lakers, Knicks, Warriors, Heat, Bears, Patriots (10-team high-volume secondary) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=Adam%20Budelli%20StubHub | Drafted | 2026-05-07 | Run 2 (media-buy framing): Adam Budelli is named — backup Jill Gonzalez (Head Consumer/Product/Tech Comms). Direct-issuance + New Era F1 expansions = lockup-deal mode. Run 1 hook: IPO + post-Ropars marketing reset |
| 2026-05-07 | Vivid Seats | Rich Lesperance (CMO) | CMO | Sports Ticketing | Cubs, White Sox, Bears, Bulls, Blackhawks, Northwestern + Illinois + ND (6-team Chicago/Big Ten) | $1,200 | https://www.linkedin.com/search/results/people/?keywords=Rich%20Lesperance%20Vivid%20Seats%20CMO | Drafted | 2026-05-07 | Run 2 (media-buy framing): same Rich Lesperance contact, sharper line-item-vs-Chicago-radio math. Lawrence Fey CEO 2026 growth mandate creates urgency |
| 2026-05-07 | Gametime | Joyce Li (Sr Mgr Brand — interim) | Sr Manager Brand (CMO seat in transition) | Sports Ticketing | Warriors, 49ers, Giants, A's, Sharks, Lakers, Dodgers, Clippers, Rams, Chargers (10-team West Coast) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=Joyce%20Li%20Gametime%20brand | Drafted | 2026-05-07 | Run 2 (media-buy framing): Curt Geen LEFT mid-2024, CMO seat in transition. Joyce Li joined 12/01/25 as Sr Mgr Brand — founder-to-brand-lead path. Bot card "Tickets from $X — Powered by Gametime" = native utility |
| 2026-05-07 | TickPick | Matt Ferrel (VP Growth & Marketing) | VP Growth & Marketing | Sports Ticketing | Yankees, Knicks, Giants (3-team NY-metro starter) | $650 | https://www.linkedin.com/in/mrferrel/ | Drafted | 2026-05-07 | Run 2 (media-buy framing): direct LI URL for Matt Ferrel verified. He scaled TickPick TV ads via M+C Saatchi — buys media for a living, recognizes the math instantly. Top of suggested order. |
| 2026-05-07 | K&K Insurance Group | Lorena Hatfield (Mktg Mgr) | Marketing Manager / Director | Sports Insurance | Notre Dame, Indiana, Purdue, Ohio State, Michigan, Mich State, Penn State, Northwestern, Illinois, Wisconsin (10-team Big Ten/Indiana) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=K%26K%20Insurance%20marketing%20director | Drafted | 2026-05-07 | Aon subsidiary; 250+ employees specialty sports/leisure. "Insuring the world's fun." @KKinsuringfun on X |
| 2026-05-07 | American Specialty Insurance | Spencer Batt (EVP/CMO) | CMO / VP Marketing | Sports Insurance | Indiana, Purdue, Notre Dame, Butler, Indiana State, Ball State (6-team Indiana) | $1,200 | https://www.linkedin.com/search/results/people/?keywords=American%20Specialty%20Insurance%20CMO%20marketing | Drafted | 2026-05-07 | Brown & Brown sub. NGBs since 1995, last 2 US Olympic Games. Agent distribution +55% in 3 yrs |
| 2026-05-07 | NFP Sports & Entertainment | Eric Boester (EVP/CMO/Head S&E) | EVP, CMO & Head of Sports & Entertainment | Sports Insurance | Yankees, Knicks, Giants, Jets, Mets, Rangers, UConn, Syracuse, Notre Dame, Michigan (10-team NE/Big Ten) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=Eric%20Boester%20NFP | Drafted | 2026-05-07 | Aon company. ~12K pro athletes, NCAA gov body, 500+ ADs, 2,000+ K-12. Boester took Head of S&E role 2024 |
| 2026-05-07 | Sadler Sports & Recreation | Taylor Landis (VP Mktg & Automation) | VP Marketing & Automation | Sports Insurance | Clemson, South Carolina, Coastal Carolina (3-team Carolinas) | $650 | https://www.linkedin.com/search/results/people/?keywords=Taylor%20Landis%20Sadler%20marketing | Drafted | 2026-05-07 | Columbia SC HQ. Dominant youth/amateur sports insurer. @SadlerSports on X. Top of suggested order |
| 2026-05-07 | HUB International (Sports Practice) | Ellina Shinnick (CMO) / Sports Practice Lead | CMO / Sports Practice VP | Sports Insurance | Cubs, White Sox, Bears, Bulls, Blackhawks, Northwestern, Illinois, Notre Dame, Michigan, Ohio State (10-team Chicago/B1G) | $1,800 | https://www.linkedin.com/search/results/people/?keywords=HUB%20International%20sports%20marketing%20director | Drafted | 2026-05-07 | $1.4B+ pro sports bonuses, $100M+ coaches bonuses 15+ yrs. Shinnick added to Exec Mgmt Team Apr 2024 |

---

## Prospect log

Free-form notes per prospect. Newest entries on top per company. Add when something happens (sent, replied, call notes, etc).

### Group 1 Automotive
- **2026-05-06** — Drafted via blitz: 6-team Houston/Texas bundle, $1,200/mo. Hook: Just announced multi-year UH Athletics partnership (Nov 2025) as official luxury vehicle partner.

### Sewell Automotive
- **2026-05-06** — Drafted via blitz: 10-team statewide bundle, $1,800/mo. Hook: Sewell sponsorship page covers DFW/Houston/Austin/SA — perfect fit for 10+ team statewide founding sponsor.

### Gillman Automotive Group
- **2026-05-06** — Drafted via blitz: 3-team Houston starter, $650/mo. Hook: Three-time presenting sponsor of Buffalo Bayou Regatta; Stacey Gillman won AAF-Houston Trailblazer.

### Classic Chevrolet (Grapevine)
- **2026-05-06** — Drafted via blitz: 3-team DFW bundle, $650/mo. Hook: GM Dealer of the Year 15 years running (Sugar Land); Grapevine Chamber leadership.

### Sonic Automotive (Texas region)
- **2026-05-06** — Drafted via blitz: 6-team TX bundle, $1,200/mo. Hook: Already buying Houston podcast sponsorships (Dave Ward "Dave & Friends") — proves they spend on local audio/digital.

### Allstate
- **2026-05-06** — Drafted via blitz: 10+ team CFB founding bundle, $1,800/mo. Hook: 19th year as Sugar Bowl title sponsor; Good Hands field goal nets 20th anniv; Big 12 naming rights frontrunner. Full drafts: [sponsor-outreach/2026-05-06-insurance-cfb-sponsors.md](sponsor-outreach/2026-05-06-insurance-cfb-sponsors.md)

### State Farm
- **2026-05-06** — Drafted via blitz: 10+ team Big Ten + Illinois State bundle, $1,800/mo. Hook: First brand on Hancock Stadium 25-yard lines (Nov 2024); Champions Classic title sponsor through 2028. Full drafts: [sponsor-outreach/2026-05-06-insurance-cfb-sponsors.md](sponsor-outreach/2026-05-06-insurance-cfb-sponsors.md)

### Nationwide
- **2026-05-06** — Drafted via blitz: 3-team Ohio bundle, $650/mo. Hook: 10-yr $17.1M Ohio State Official Insurance Sponsor — Columbus-to-Columbus alignment. Full drafts: [sponsor-outreach/2026-05-06-insurance-cfb-sponsors.md](sponsor-outreach/2026-05-06-insurance-cfb-sponsors.md)

### USAA
- **2026-05-06** — Drafted via blitz: 10+ team military/Texas CFB bundle, $1,800/mo. Hook: First/only Army-Navy presenting sponsor since 2009, just extended through 2030. Full drafts: [sponsor-outreach/2026-05-06-insurance-cfb-sponsors.md](sponsor-outreach/2026-05-06-insurance-cfb-sponsors.md)

### Liberty Mutual
- **2026-05-06** — Drafted via blitz: 6-team CFB bundle, $1,200/mo. Hook: Coach of the Year Award heritage ($1.8M+ donated through winners) — VERIFY current activation cycle. Full drafts: [sponsor-outreach/2026-05-06-insurance-cfb-sponsors.md](sponsor-outreach/2026-05-06-insurance-cfb-sponsors.md)

### DraftKings
- **2026-05-06** — Drafted via blitz: 10+ team CFB national founding bundle, $1,800/mo. Hook: NBCU multi-year ad deal (Sept 2025) locked sportsbook category across NFL/CFB/NBA/PGA — they already pay broadcast rate cards for category lockup we offer at $180/team. Full drafts: [sponsor-outreach/2026-05-06-sportsbooks.md](sponsor-outreach/2026-05-06-sportsbooks.md)

### FanDuel
- **2026-05-06** — Drafted via blitz: 6-team CFB powers bundle, $1,200/mo. Hook: April 2026 CNN piece — FanDuel carving sports niche in prediction markets; Side Huddle bot natively surfaces markets in every huddle. Full drafts: [sponsor-outreach/2026-05-06-sportsbooks.md](sponsor-outreach/2026-05-06-sportsbooks.md)

### PrizePicks
- **2026-05-06** — Drafted via blitz: 6-team SEC bundle, $1,200/mo. Hook: Atlanta HQ; "It's Good To Be Right" campaign w/ Marshawn Lynch, Reggie Bush, Adam Devine (Jan 2026) shows heavy CFB voice spend. Full drafts: [sponsor-outreach/2026-05-06-sportsbooks.md](sponsor-outreach/2026-05-06-sportsbooks.md)

### Underdog Fantasy
- **2026-05-06** — Drafted via blitz: 3-team Missouri-corridor starter, $650/mo. Hook: Multi-year deals w/ KC Royals + St. Louis Blues ahead of MO launch — already invested in Missouri corridor; CFB is next layer. Full drafts: [sponsor-outreach/2026-05-06-sportsbooks.md](sponsor-outreach/2026-05-06-sportsbooks.md)

### Kalshi
- **2026-05-06** — Drafted via blitz: 10+ team CFB national prediction-market bundle, $1,800/mo. Hook: 89% US prediction market share, sports = 72% of volume (BofA report, April 2026); bot natively surfaces prediction markets. Full drafts: [sponsor-outreach/2026-05-06-sportsbooks.md](sponsor-outreach/2026-05-06-sportsbooks.md)

### Polymarket
- **2026-05-07** — Drafted via blitz: 10-team Pac-12/ACC bundle (intentionally non-overlapping with Kalshi's SEC/B1G targets), $1,800/mo. Hook: US relaunch Dec 3 2025 after $112M QCEX acquisition + CFTC approval (Nov 25 2025), sports contracts as launch wedge; X's official prediction market partner (June 2025). CONFLICT NOTE: per-team exclusivity vs. Kalshi — first to close locks the team. Full drafts: [sponsor-outreach/2026-05-07-polymarket.md](sponsor-outreach/2026-05-07-polymarket.md)

### DoorDash
- **2026-05-07** — Drafted via blitz: 10-team MLS + World Cup-host CFB bundle, $1,800/mo. Hook: FIFA World Cup 2026 + 2027 Women's WC Official Tournament Supporter (Nov 2025); MLS Hat Trick promo year 2; DoorDash College Football campaign on 2026 Hashtag Sports Awards shortlist. Full drafts: [sponsor-outreach/2026-05-07-food-delivery-qsr.md](sponsor-outreach/2026-05-07-food-delivery-qsr.md)

### Uber Eats
- **2026-05-07** — Drafted via blitz: 6-team NFL bundle (Cowboys, Eagles, Chiefs, 49ers, Bills, Ravens), $1,200/mo. Hook: Just won 2026 Ad Age Creativity Awards Best Partnership for Uber Eats x NFL; "Build Your Own Super Bowl" / Football Is For Food universe two seasons deep w/ McConaughey + Bradley Cooper. Non-overlap w/ DoorDash bundle. Full drafts: [sponsor-outreach/2026-05-07-food-delivery-qsr.md](sponsor-outreach/2026-05-07-food-delivery-qsr.md)

### Wingstop
- **2026-05-07** — Drafted via blitz: 6-team NBA bundle (Lakers, Knicks, Warriors, Celtics, Mavs, Heat), $1,200/mo. Hook: NBA's Official Chicken + Official Wing partner (first-ever major-league deal); CEO publicly said brand will be on "a heck of a lot more sports" this year. Full drafts: [sponsor-outreach/2026-05-07-food-delivery-qsr.md](sponsor-outreach/2026-05-07-food-delivery-qsr.md)

### Buffalo Wild Wings
- **2026-05-07** — Drafted via blitz: 6-team CBB blueblood bundle (Duke, UNC, Kansas, Kentucky, UConn, Gonzaga), $1,200/mo. Hook: "Official Hangout for NCAA Sports" since 2013; "That's March Madness" campaign relaunch under new CMO Seth Freeman pushing four-wall differentiation. Full drafts: [sponsor-outreach/2026-05-07-food-delivery-qsr.md](sponsor-outreach/2026-05-07-food-delivery-qsr.md)

### Domino's Pizza
- **2026-05-07** — Drafted via blitz: 6-team Florida bundle (Bucs, UF, FSU, Miami, UCF, USF), $1,200/mo. Hook: Active multi-year Tampa Bay Buccaneers deal w/ "Game Changer" $9.99 promo + VIP gameday giveaways; "Official Pizza of the NCAA" heritage. Bundle extends Bucs partnership statewide. Full drafts: [sponsor-outreach/2026-05-07-food-delivery-qsr.md](sponsor-outreach/2026-05-07-food-delivery-qsr.md)

### JPMorgan Chase
- **2026-05-07** — Drafted via blitz: 10-team NY metro + Big Ten flagships, $1,800/mo. Hook: JPMorganChase Athlete Council launched Mar 18 2026 — Steph, Magic, Sue Bird advising on financial literacy at universities. Full drafts: [sponsor-outreach/2026-05-07-banks-fintech-trading.md](sponsor-outreach/2026-05-07-banks-fintech-trading.md)

### Bank of America
- **2026-05-07** — Drafted via blitz: 10-team Carolinas/ACC bundle, $1,800/mo. Hook: First global FIFA banking partner; Beckham 5-yr ambassador (Nov 2025); BofA Stadium = Panthers home since 2004. Full drafts: [sponsor-outreach/2026-05-07-banks-fintech-trading.md](sponsor-outreach/2026-05-07-banks-fintech-trading.md)

### Capital One
- **2026-05-07** — Drafted via blitz: 10-team SEC + Florida bundle, $1,800/mo. Hook: Orange Bowl title sponsor through 2026; presenting sponsor Rose Bowl CFP Semifinal (107th edition); Bowl Mania across all ESPN bowls. Full drafts: [sponsor-outreach/2026-05-07-banks-fintech-trading.md](sponsor-outreach/2026-05-07-banks-fintech-trading.md)

### Truist
- **2026-05-07** — Drafted via blitz: 6-team ACC interior bundle (Wake/GT/UVA/Louisville/Pitt/BC), $1,200/mo. Hook: Largest non-naming-rights deal in WFU Athletics history; Presenting Partner WFU women's athletics; Truist Momentum financial literacy program. Non-overlapping with BofA's Carolinas bundle. Full drafts: [sponsor-outreach/2026-05-07-banks-fintech-trading.md](sponsor-outreach/2026-05-07-banks-fintech-trading.md)

### Fifth Third Bank
- **2026-05-07** — Drafted via blitz: 6-team bundle (Cincy/Dayton/Louisville/MSU/Auburn/Xavier) exactly mirroring Team Fifth Third NIL roster, $1,200/mo. Hook: Team Fifth Third NIL expanded Feb 2026 to 30 athletes / 9 schools; Comerica Park renamed Fifth Third Field for Tigers (Apr 2026). Full drafts: [sponsor-outreach/2026-05-07-banks-fintech-trading.md](sponsor-outreach/2026-05-07-banks-fintech-trading.md)

### Robinhood
- **2026-05-07** — Drafted via blitz: 10-team CFB flagships, $1,800/mo. Hook: Aug 2025 Kalshi partnership rolled NFL + Power-4 CFB prediction markets into Robinhood; 23XI NASCAR yr 2; brand publicly distinguishes sponsorships (brand awareness) from prediction markets product. CONFLICT: per-team exclusivity vs. Kalshi — first to close locks. Full drafts: [sponsor-outreach/2026-05-07-banks-fintech-trading.md](sponsor-outreach/2026-05-07-banks-fintech-trading.md)

### SoFi
- **2026-05-07** — Drafted via blitz: 10-team West Coast bundle (Rams, Chargers + LA/Pac-12 colleges), $1,800/mo. Hook: SoFi Stadium $625M / 20-yr naming rights; 55% NIL funding rate (4.4x industry avg) via NIL Club. CONFLICT: USC overlaps with Robinhood bundle — first to close locks; recommend swapping Washington State if Robinhood signs first. Full drafts: [sponsor-outreach/2026-05-07-banks-fintech-trading.md](sponsor-outreach/2026-05-07-banks-fintech-trading.md)

### Public.com
- **2026-05-07** — Drafted via blitz: 3-team starter (Duke/Syracuse/JHU — lacrosse-heavy programs), $650/mo. Hook: Official Investing App of the Premier Lacrosse League; 6 PLL athletes on platform; Paul Rabil (350K+ followers) active; $10K invest-sweepstakes already run. Smallest target / founder-led / DM likely open — top of suggested order. Full drafts: [sponsor-outreach/2026-05-07-banks-fintech-trading.md](sponsor-outreach/2026-05-07-banks-fintech-trading.md)

### PayPal / Venmo
- **2026-05-07** — Drafted via blitz: 10-team NFL marquee bundle, $1,800/mo. Hook: Named Official P2P Payments Partner of the NFL April 21 2026; multi-year w/ $1M sweepstakes program; connects 100M+ Venmo users. Pitch line: "P2P happens in group chats. Side Huddle IS the gameday group chat." Full drafts: [sponsor-outreach/2026-05-07-banks-fintech-trading.md](sponsor-outreach/2026-05-07-banks-fintech-trading.md)

### Coinbase
- **2026-05-07** — Drafted via blitz: 10-team NBA bundle, $1,800/mo. Hook: Exclusive crypto partner of NBA/WNBA/G League/2K League/USA Basketball; Jan 2026 "NBA Rookie Firsts" content series w/ Kon Knueppel + Tyrese Proctor; Warriors + Clippers team deals. Full drafts: [sponsor-outreach/2026-05-07-banks-fintech-trading.md](sponsor-outreach/2026-05-07-banks-fintech-trading.md)

### SeatGeek
- **2026-05-07 (Run 2 — media-buy framing)** — Re-drafted with named contact Sarah Kettler (VP Brand/Consumer/Enterprise Mktg, direct LI: linkedin.com/in/skettler/). Email guess: sarah.kettler@seatgeek.com (VERIFY). Lead: "best per-dollar media buy in sports — 10 teams for less than two weeks of one local radio buy." Adds cold-email variant. Full drafts: [sponsor-outreach/2026-05-07-ticketing.md](sponsor-outreach/2026-05-07-ticketing.md)
- **2026-05-07** — Drafted via blitz: 10-team bundle mirroring SeatGeek's partner footprint, $1,800/mo. Hook: Matt Herman named CMO Oct 2025; expanded FC Cincinnati partnership + Chicago Fire downtown stadium ticketing (Apr 2026); pattern of going deeper on team-level fan engagement. Full drafts: [sponsor-outreach/2026-05-07-ticketing.md](sponsor-outreach/2026-05-07-ticketing.md)

### StubHub
- **2026-05-07 (Run 2 — media-buy framing)** — Re-drafted targeting Adam Budelli (Head of Partnerships) instead of Maggie Li/CMO; backup Jill Gonzalez (Head of Consumer/Product/Tech Comms). Email guess: adam.budelli@stubhub.com (VERIFY). Lead: media-buy math vs. local radio/TV. Adds cold-email variant. Full drafts: [sponsor-outreach/2026-05-07-ticketing.md](sponsor-outreach/2026-05-07-ticketing.md)
- **2026-05-07** — Drafted via blitz: 10-team high-volume secondary market bundle, $1,800/mo. Hook: IPO momentum + post-Olivier Ropars marketing org reset — window to land founding placements before next big-spend cycle locks. VERIFY current head of marketing (Maggie Li per RocketReach but unconfirmed). Full drafts: [sponsor-outreach/2026-05-07-ticketing.md](sponsor-outreach/2026-05-07-ticketing.md)

### Vivid Seats
- **2026-05-07 (Run 2 — media-buy framing)** — Re-drafted Rich Lesperance with sharper line-item math ($1,200/mo = ~one Chicago radio week across 6 teams). Email guess: rich.lesperance@vividseats.com (VERIFY). Adds cold-email variant. Full drafts: [sponsor-outreach/2026-05-07-ticketing.md](sponsor-outreach/2026-05-07-ticketing.md)
- **2026-05-07** — Drafted via blitz: 6-team Chicago/Big Ten bundle, $1,200/mo. Hook: Lawrence Fey named CEO with public 2026 growth strategy + leadership transition; CMO Rich Lesperance tenured since 2018 in execute-fast mode vs. StubHub/SeatGeek. Full drafts: [sponsor-outreach/2026-05-07-ticketing.md](sponsor-outreach/2026-05-07-ticketing.md)

### Gametime
- **2026-05-07 (Run 2 — media-buy framing)** — Re-targeted: Curt Geen LEFT Gametime mid-2024 (CMO seat in transition). New target = Joyce Li, Sr Manager Brand (joined 12/01/2025). Email guess: joyce.li@gametime.co (VERIFY). Lead: native bot utility "Tickets from $X — Powered by Gametime" + media-buy math. Adds cold-email variant. Full drafts: [sponsor-outreach/2026-05-07-ticketing.md](sponsor-outreach/2026-05-07-ticketing.md)
- **2026-05-07** — Drafted via blitz: 10-team West Coast bundle, $1,800/mo. Hook: Last-minute / mobile / mid-game ticket buying = exact moment Side Huddle hits — fans on phones during a game asking "should we go to next home game?" Bot card: "Tickets from $X — Powered by Gametime." Cleanest product fit in the category. Full drafts: [sponsor-outreach/2026-05-07-ticketing.md](sponsor-outreach/2026-05-07-ticketing.md)

### TickPick
- **2026-05-07 (Run 2 — media-buy framing)** — Re-drafted Matt Ferrel with direct LI URL verified (linkedin.com/in/mrferrel/). Email guess: matt@tickpick.com (VERIFY). Lead: "you buy media for a living so I'll skip the warmup" — leans on his M+C Saatchi TV scale-up resume. Adds cold-email variant. Top of suggested order. Full drafts: [sponsor-outreach/2026-05-07-ticketing.md](sponsor-outreach/2026-05-07-ticketing.md)
- **2026-05-07** — Drafted via blitz: 3-team NY-metro starter (Yankees/Knicks/Giants), $650/mo. Hook: "No-fee" positioning = value-conscious gameday fan = exact huddle audience. Smallest $ / founder-growth-led shop / fastest yes — top of suggested order. Full drafts: [sponsor-outreach/2026-05-07-ticketing.md](sponsor-outreach/2026-05-07-ticketing.md)

### K&K Insurance Group
- **2026-05-07** — Drafted via blitz: 10-team Big Ten/Indiana bundle, $1,800/mo. Hook: Aon subsidiary, "Insuring the world's fun" — already underwrites collegiate athletic associations + youth leagues; "Powered by K&K" on every bot card is category-perfect. Full drafts: [sponsor-outreach/2026-05-07-sports-insurance-agencies.md](sponsor-outreach/2026-05-07-sports-insurance-agencies.md)

### American Specialty Insurance
- **2026-05-07** — Drafted via blitz: 6-team Indiana flagship bundle, $1,200/mo. Hook: Brown & Brown sub, Roanoke IN HQ, NGB underwriter since 1995, last two US-hosted Olympics. Agent distribution +55% in 3 yrs = leaning into brand visibility. Full drafts: [sponsor-outreach/2026-05-07-sports-insurance-agencies.md](sponsor-outreach/2026-05-07-sports-insurance-agencies.md)

### NFP Sports & Entertainment
- **2026-05-07** — Drafted via blitz: 10-team NE + Big Ten bundle, $1,800/mo. Hook: Eric Boester became Head of Sports & Entertainment 2024 (added to CMO role); group covers ~12K pro athletes + 500 ADs + 2,000 K-12 schools — owns both brand + sports vertical at Aon-owned NFP. Full drafts: [sponsor-outreach/2026-05-07-sports-insurance-agencies.md](sponsor-outreach/2026-05-07-sports-insurance-agencies.md)

### Sadler Sports & Recreation
- **2026-05-07** — Drafted via blitz: 3-team Carolinas starter (Clemson/USC/Coastal), $650/mo. Hook: Columbia SC HQ youth/amateur sports specialist — fanbase parents + alumni ARE the huddle audience. Smallest $, founder-led, top of suggested order. Full drafts: [sponsor-outreach/2026-05-07-sports-insurance-agencies.md](sponsor-outreach/2026-05-07-sports-insurance-agencies.md)

### HUB International (Sports Practice)
- **2026-05-07** — Drafted via blitz: 10-team Chicago + Big Ten bundle, $1,800/mo. Hook: HUB underwrites $1.4B+ pro sports bonuses + $100M+ college coaches' bonuses over 15+ yrs — putting "Powered by HUB" in front of fans of the same teams whose contracts they insure. CMO Ellina Shinnick added to Exec Mgmt Team Apr 2024. Full drafts: [sponsor-outreach/2026-05-07-sports-insurance-agencies.md](sponsor-outreach/2026-05-07-sports-insurance-agencies.md)
