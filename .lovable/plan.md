

## Replace Peer-to-Peer Betting with Kalshi Shadow Market System

This is a major architectural overhaul that replaces the current "Fades" peer-to-peer betting system with a Kalshi-powered prediction market using fake chips.

---

### Phase Overview

Since you want it all built at once, here's the full scope organized by dependency order:

1. Database tables + RLS policies
2. Edge functions (Kalshi API sync + settlement + market posting)
3. Frontend: Shadow bet card component (in chat)
4. Frontend: Ledger page complete redesign
5. Cleanup: Remove old fades/cash mode code

---

### 1. Database Changes

**New tables:**

**`kalshi_markets`** - Cached Kalshi market data
- `id` (uuid, PK, default gen_random_uuid)
- `kalshi_ticker` (text, unique, not null) -- Kalshi's market ticker
- `team_id` (uuid, references teams, nullable) -- linked team
- `huddle_id` (uuid, references huddles, nullable) -- which huddle this was posted to
- `question` (text, not null) -- e.g. "Will Duke cover -4?"
- `current_yes_price` (integer, 0-100) -- cents
- `market_type` (text) -- spread, total, player_prop, winner
- `event_start_time` (timestamptz)
- `is_resolved` (boolean, default false)
- `resolution` (text, nullable) -- YES or NO
- `resolved_at` (timestamptz, nullable)
- `kalshi_event_ticker` (text) -- parent event
- `metadata` (jsonb, default '{}') -- extra Kalshi data
- `created_at` / `updated_at` (timestamptz)

**`shadow_bets`** - User predictions
- `id` (uuid, PK)
- `user_id` (uuid, not null)
- `market_id` (uuid, references kalshi_markets)
- `huddle_id` (uuid, references huddles)
- `position` (text) -- 'YES' or 'NO'
- `chips_risked` (integer) -- cost based on Kalshi price
- `potential_payout` (integer, default 100) -- always 100 cents
- `placed_at` (timestamptz, default now)
- `is_settled` (boolean, default false)
- `won` (boolean, nullable)
- `chips_won` (integer, default 0)
- unique constraint on (user_id, market_id) -- one bet per market per user

**`user_portfolios`** - Chip balances
- `user_id` (uuid, PK)
- `total_chips` (integer, default 1000)
- `total_bets` (integer, default 0)
- `total_wins` (integer, default 0)
- `total_losses` (integer, default 0)
- `last_reset_at` (timestamptz, default now)
- `created_at` / `updated_at` (timestamptz)

**RLS Policies:**
- `kalshi_markets`: authenticated users can SELECT all
- `shadow_bets`: authenticated users can SELECT where user is member of the huddle; INSERT own bets; no UPDATE/DELETE by users
- `user_portfolios`: authenticated users can SELECT all (leaderboard); INSERT/UPDATE own row only

**Database functions:**
- `place_shadow_bet(p_market_id, p_huddle_id, p_position)` -- atomic: checks chips, deducts, inserts bet, updates portfolio counts
- `settle_shadow_bets(p_market_id, p_resolution)` -- atomic: settles all bets for a market, updates portfolios
- `get_huddle_leaderboard(p_huddle_id)` -- returns ranked users by profit
- `reset_weekly_chips()` -- resets users below 100 chips back to 1000

---

### 2. Edge Functions

**`kalshi-sync-markets`** -- Cron job (every 30 min)
- Authenticates with Kalshi API using stored API key
- For each league (NBA, NFL, NHL, NCAA):
  - Fetches upcoming events/markets from Kalshi public API: `GET https://api.elections.kalshi.com/trade-api/v2/markets?series_ticker=KXNBA&status=open`
  - Maps Kalshi markets to our teams using team name matching
  - Filters to top 5-8 markets per game (spread, total, winner, top player props) by volume
  - Upserts into `kalshi_markets` table
  - Also checks resolved markets and calls `settle_shadow_bets` for each

**`kalshi-post-predictions`** -- Cron job (every hour)
- Finds markets where `event_start_time` is within 24 hours AND hasn't been posted to chat yet
- For each team's huddle, posts prediction cards as bot messages with `message_type: 'prediction_card'`
- The message content is a JSON payload with market IDs and questions
- Marks markets as posted (via `huddle_id` field or a `posted_at` timestamp)

**`kalshi-settle`** -- Cron job (every 15 min)
- Checks `kalshi_markets` where `event_start_time` < now() AND `is_resolved = false`
- Fetches resolution from Kalshi API
- Calls `settle_shadow_bets` DB function
- Posts result messages to chat

---

### 3. Frontend: Prediction Card Component

**New file: `src/components/predictions/PredictionCard.tsx`**
- Renders a prediction market card in the chat stream
- Shows: question, YES button (with cost), NO button (with cost)
- Before betting: just buttons, no stats shown
- After betting: shows community %, Kalshi %, divergence
- After resolution: shows result (WIN/LOSS with chip amount)
- Integrates with `shadow_bets` table for placing bets
- Real-time subscription for community stats updates

**New file: `src/components/predictions/PredictionCardInMessage.tsx`**
- Wrapper that detects `message_type === 'prediction_card'` in chat messages
- Parses the JSON content to render one or more PredictionCards
- Used inside the existing chat message rendering pipeline

**Modified: `src/components/room/ChatMessage.tsx`**
- Add case for `message_type === 'prediction_card'` to render PredictionCardInMessage

**Modified: `src/components/room/UnifiedChat.tsx`**
- Remove `onCashModeRequired` prop
- Remove FadesInChat import/usage

---

### 4. Frontend: Ledger Page Redesign

**Complete rewrite: `src/pages/Ledger.tsx`**

Single scrollable page with these sections:

1. **Portfolio Overview Card** -- total chips, total bets, win rate, P/L, huddle rank
2. **Open Bets Section** -- active shadow bets (game hasn't started), sorted by game time
3. **Pending Results Section** -- games finished, awaiting Kalshi resolution
4. **Closed Markets Section** -- settled bets (last 30 days for free, all-time for premium)
5. **Leaderboard Section** -- top predictors in user's huddles, ranked by profit
6. **Browse Markets Section** -- (premium only) all available Kalshi markets

Each section uses cards with team colors, green/red for wins/losses, chip icon.

**New hooks:**
- `src/hooks/usePortfolio.ts` -- fetches/subscribes to user_portfolios
- `src/hooks/useShadowBets.ts` -- fetches user's shadow bets with real-time updates

---

### 5. Code Removal (Old Fades System)

**Delete these files:**
- `src/components/fades/ActiveFadeCard.tsx`
- `src/components/fades/CashModeUpgradeModal.tsx`
- `src/components/fades/FadeConfirmSheet.tsx`
- `src/components/fades/FadeOptionCard.tsx`
- `src/components/fades/FadesInChat.tsx`
- `src/components/fades/FadesSidebar.tsx`
- `src/components/fades/FadesTab.tsx`
- `src/components/fades/GameFadeCards.tsx`
- `src/components/fades/InlineFadeCard.tsx`
- `src/components/fades/LockedFadeCard.tsx`
- `src/components/fades/PostFadeModal.tsx`
- `src/components/fades/PrivateFeaturesTeaser.tsx`
- `src/components/fades/RivalriesTab.tsx`
- `src/components/fades/SettledFadeCard.tsx`
- `src/components/fades/VenmoSetupModal.tsx`
- `src/components/fades/LiveCountdown.tsx`
- `src/components/fades/LedgerModal.tsx`
- `src/components/fades/index.ts`
- `src/hooks/useCashMode.ts`
- `supabase/functions/fades-get-odds/index.ts`
- `supabase/functions/fades-settle/index.ts`
- `supabase/functions/create-cashmode-checkout/index.ts`
- `supabase/functions/stripe-cashmode-webhook/index.ts`

**Remove fades references from:**
- `src/pages/Huddle.tsx` -- remove FadesSidebar, GameFadeCards, CashModeUpgradeModal, LedgerModal imports and state
- `src/pages/Room.tsx` -- remove FadesSidebar import and state
- `src/components/room/ChatBottomBar.tsx` -- remove LedgerModal, fades button
- `src/components/room/ChatMessage.tsx` -- remove FadeMessageAction, CashMode props
- `src/components/room/UnifiedChat.tsx` -- remove onCashModeRequired prop
- `src/components/room/FadeMessageAction.tsx` -- delete file
- `src/components/PickEmSettingsCard.tsx` -- remove any fades references if present

**Keep but modify:**
- `src/components/fades/` directory renamed to `src/components/predictions/`
- Ledger route `/ledger` stays the same

---

### 6. Secrets Required

- **`KALSHI_API_KEY`** -- needed for the Kalshi API edge functions (you said you have one)

---

### 7. Edge Cases Handled

- **Out of chips**: Show message + auto-reset to 1000 chips weekly (Sunday midnight cron)
- **Market canceled**: Refund all chips, remove from open bets, notify in chat
- **Insufficient chips**: Error toast with current balance
- **Betting after lockout**: Disable buttons 5 min before game start
- **One bet per market**: Database unique constraint prevents double-betting
- **Empty states**: Custom messages for each Ledger section

---

### Files Changed Summary

**New files (10):**
1. `src/components/predictions/PredictionCard.tsx`
2. `src/components/predictions/PredictionCardInMessage.tsx`
3. `src/components/predictions/index.ts`
4. `src/hooks/usePortfolio.ts`
5. `src/hooks/useShadowBets.ts`
6. `supabase/functions/kalshi-sync-markets/index.ts`
7. `supabase/functions/kalshi-post-predictions/index.ts`
8. `supabase/functions/kalshi-settle/index.ts`
9. Migration SQL (new tables + functions + RLS)
10. Cron jobs SQL (3 scheduled functions)

**Modified files (6):**
1. `src/pages/Ledger.tsx` -- complete rewrite
2. `src/pages/Huddle.tsx` -- remove fades, add predictions
3. `src/pages/Room.tsx` -- remove fades sidebar
4. `src/components/room/ChatBottomBar.tsx` -- remove fades/ledger modal
5. `src/components/room/ChatMessage.tsx` -- add prediction card rendering
6. `src/components/room/UnifiedChat.tsx` -- remove cash mode props

**Deleted files (~22):**
- All files in `src/components/fades/`
- `src/hooks/useCashMode.ts`
- `src/components/room/FadeMessageAction.tsx`
- 4 edge functions (fades-get-odds, fades-settle, create-cashmode-checkout, stripe-cashmode-webhook)

