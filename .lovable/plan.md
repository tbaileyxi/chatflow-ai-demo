

# Post-Game Summaries, Viral Sharing, and Leaderboard Enhancements

## What's Already Done
The Premium subscription system, wallet mechanics, chip floors, PremiumBadge, PremiumUpgradeModal, PremiumBanner, PremiumSettingsCard, Settings page, Stripe checkout/webhook/portal edge functions, and database schema (profiles + user_portfolios premium columns) are all implemented and functional.

## What This Plan Adds

### 1. Post-Game Coach Bot Summary

Currently the `kalshi-settle` edge function posts individual "Market resolved" messages per market. Replace that with a single consolidated game summary posted once per game/huddle.

**Changes to `supabase/functions/kalshi-settle/index.ts`:**
- After settling all markets for a game, group settled bets by huddle
- For each huddle, generate ONE summary message:
  - Final score (from game data or market context)
  - Huddle performance: X correct / Y total (Z%)
  - Top predictor (most wins that game, with profit)
  - Biggest single win
  - Community vs Kalshi accuracy comparison
- Post as a single `huddle_messages` entry with `message_type: 'game_summary'`
- Remove the per-market individual result posts

### 2. Database: Shares and Referrals Tables

**New table: `shares`**
- `id` (uuid, PK)
- `user_id` (uuid, not null)
- `bet_id` (uuid, not null, references shadow_bets)
- `platform` (text: 'x', 'instagram', 'imessage', 'download', 'copy')
- `shared_content_type` (text: 'win', 'loss', 'contrarian', 'huddle_summary')
- `created_at` (timestamptz)

RLS: Users can insert their own shares, read their own shares.

**New table: `referrals`**
- `id` (uuid, PK)
- `referred_by` (uuid, not null)
- `new_user_id` (uuid, nullable -- filled when someone signs up)
- `source_share_id` (uuid, nullable, references shares)
- `referral_code` (text, unique)
- `joined_at` (timestamptz, nullable)
- `created_at` (timestamptz)

RLS: Users can read their own referrals.

### 3. Share Button on Settled Bets (Ledger)

**Update `src/pages/Ledger.tsx`:**
- Add a "Share" button (Share2 icon) on each settled bet card
- On tap, open a share modal/sheet
- More prominent on wins, subtle on losses
- Track shares in the `shares` table

**New component: `src/components/sharing/BetShareModal.tsx`**
- Shows preview of the share card
- Platform options: Share to X, Instagram Stories, iMessage, Download Image, Copy Link
- Pre-filled text per platform:
  - X wins: "Just called it on @SideHuddle! [bet question] [profit]. Join me: [link]"
  - X losses: "Can't win 'em all. Still [winRate]% on @SideHuddle. [link]"
  - X contrarian: "Faded the crowd and WON on @SideHuddle! [link]"
- Uses Web Share API when available, falls back to copy link
- Records share in database

### 4. Share Card Image Generation

**New component: `src/components/sharing/ShareCardGenerator.tsx`**
- HTML canvas-based image generation (1080x1080 for IG, 1200x675 for X)
- Three card variants:
  - **Win card**: Team color gradient, "CALLED IT" headline, bet details, profit, user stats, "Join me on Side Huddle" footer
  - **Loss card**: Darker gradient, "Can't win 'em all" headline, self-deprecating copy, positive season stats
  - **Contrarian win card** (divergence >25%): Gold gradient, "CONTRARIAN WIN / FADED THE CROWD", shows how user bet against majority
- Includes: bet question, result, profit/loss, win rate, total bets, community vs Kalshi stats
- Compressed output under 500KB
- Cached for 24 hours (in-memory or blob URL)
- Fallback: text + link if canvas fails

### 5. Huddle Summary Sharing

**Update Coach Bot game summary (from item 1):**
- Add a "Share Results" button at the bottom of the summary message in chat
- Generates a huddle-wide share card with top 3 predictors, accuracy, best contrarian call
- Anyone in the huddle can share it
- Uses the same BetShareModal but with `shared_content_type: 'huddle_summary'`

### 6. Referral Tracking

- Generate unique referral links: `sidehuddlesports.com/join/[user_id]` or short code
- Track in `referrals` table when someone signs up via a shared link
- In Ledger, show "Your Shares" section:
  - Free users: total share count only
  - Premium users: full analytics (platform breakdown, signups, conversion rate)

### 7. Leaderboard Enhancements in Ledger

**Update `src/pages/Ledger.tsx` leaderboard section:**

Free users:
- Top 10 in current huddle
- Username, chips, win rate, bet count
- Premium badge next to premium users

Premium users additionally see:
- Full rankings (not capped at 10)
- Time period filter tabs: This Week / This Month / All-Time
- Sort options: by chips, win rate, total bets
- "Compare" button on each user row -- shows head-to-head stats
- Cross-huddle option (see rankings across all huddles user belongs to)

**New component: `src/components/sharing/UserCompareModal.tsx`** (Premium only)
- Shows side-by-side stats between current user and selected user
- Win rate, total bets, profit, common bets where both picked

### 8. Settled Bets History Filtering

- Free users: show last 30 days of settled bets only
- Premium users: show all-time history
- Add date filter in the `useShadowBets` hook

## Technical Details

### Database Migration

```text
-- shares table
CREATE TABLE shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bet_id uuid REFERENCES shadow_bets(id),
  platform text NOT NULL,
  shared_content_type text NOT NULL DEFAULT 'win',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
-- Users can insert/read their own shares

-- referrals table
CREATE TABLE referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referred_by uuid NOT NULL,
  new_user_id uuid,
  source_share_id uuid REFERENCES shares(id),
  referral_code text UNIQUE,
  joined_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
-- Users can read their own referrals
```

### Files Created (new)
- `src/components/sharing/BetShareModal.tsx` -- share modal with platform options
- `src/components/sharing/ShareCardGenerator.tsx` -- canvas-based image generation
- `src/components/sharing/UserCompareModal.tsx` -- Premium head-to-head comparison

### Files Modified
- `supabase/functions/kalshi-settle/index.ts` -- consolidated post-game summary instead of per-market messages
- `src/pages/Ledger.tsx` -- share buttons on settled bets, leaderboard section with premium filters/compare, 30-day limit for free users, referral stats section
- `src/hooks/useShadowBets.ts` -- add date filtering for free vs premium history
- `src/integrations/supabase/types.ts` -- auto-updated by migration

### Implementation Order
1. Database migration (shares + referrals tables)
2. Update `kalshi-settle` for consolidated game summaries
3. Build ShareCardGenerator (canvas image gen)
4. Build BetShareModal (share flow + tracking)
5. Update Ledger with share buttons, leaderboard enhancements, and referral stats
6. Update useShadowBets for date-filtered history
7. Build UserCompareModal for premium comparisons
