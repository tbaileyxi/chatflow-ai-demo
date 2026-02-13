
# Premium Subscription and Wallet System

## Overview

This plan introduces a Premium tier ($5/month via Stripe) that replaces the existing "Verified" terminology throughout the app. It changes how the virtual chip economy works (free users can hit 0 and get locked out, premium users have a 100-chip floor), adds advanced leaderboards, analytics, and a premium badge.

## Phase 1: Database Schema Changes

### profiles table -- add Premium columns
- `is_premium` (boolean, default false)
- `stripe_customer_id` (text, nullable)
- `stripe_subscription_id` (text, nullable)
- `premium_since` (timestamptz, nullable)
- `premium_expires_at` (timestamptz, nullable) -- for grace period handling

### user_portfolios table -- add Premium-aware columns
- `is_premium` (boolean, default false)
- `starting_chips` (integer, default 1000)
- `minimum_chips` (integer, default 0)

### Update `place_shadow_bet` DB function
- Check `minimum_chips`: if free user (min=0), block at 0 chips. If premium (min=100), ensure chips don't drop below 100.
- Update the insufficient chips error to indicate premium status.

### Update `reset_weekly_chips` DB function
- Premium users reset to 1500 (not 1000)
- Free users reset to 1000 when below 100

## Phase 2: Stripe Integration -- Premium Subscription

### New Edge Function: `create-premium-checkout/index.ts`
- Creates a Stripe Checkout session for a $5/month recurring subscription
- Product: "Side Huddle Premium"
- Success URL: `/ledger?premium=success`
- Cancel URL: `/ledger?premium=cancelled`
- Stores `stripe_customer_id` in profiles

### New Edge Function: `stripe-premium-webhook/index.ts`
- Handles events:
  - `checkout.session.completed` -- activate premium, set `is_premium=true`, add 500 chips, set `minimum_chips=100`, `starting_chips=1500`
  - `customer.subscription.deleted` -- downgrade: `is_premium=false`, `minimum_chips=0`, `starting_chips=1000`
  - `invoice.payment_failed` -- set `premium_expires_at` to 3 days from now (grace period)
- Config: `verify_jwt = false`

### New Edge Function: `create-premium-portal/index.ts`
- Creates Stripe Customer Portal session for managing subscription
- Returns portal URL for premium users

### Secret needed
- `STRIPE_PREMIUM_WEBHOOK_SECRET` -- user must configure this in Stripe Dashboard

## Phase 3: Frontend -- Premium Hooks and Context

### New hook: `src/hooks/usePremium.ts`
- Reads `is_premium`, `premium_since` from profiles
- Exposes: `isPremium`, `premiumSince`, `loading`
- Real-time subscription for premium status changes

### Update `src/hooks/usePortfolio.ts`
- Add `is_premium`, `starting_chips`, `minimum_chips` to Portfolio interface
- Compute `profit` based on `starting_chips` (not hardcoded 1000)
- Expose `isPremium`, `minimumChips`, `isOutOfChips` (chips <= minimum)

## Phase 4: Frontend -- UI Components

### New: `src/components/premium/PremiumUpgradeModal.tsx`
- Modal shown when free user hits 0 chips
- Copy as specified: "Out of Chips!" with feature list
- "Upgrade to Premium" button launches Stripe checkout
- "Maybe Later" closes modal but locks betting

### New: `src/components/premium/PremiumBadge.tsx`
- Renders a star icon or "PRO" text next to username
- Used in chat messages, leaderboards, and profiles

### New: `src/components/premium/PremiumBanner.tsx`
- Persistent banner for free users at 0 chips: "Upgrade to Premium to keep playing"
- Shown in Ledger and chat prediction cards

### New: `src/components/premium/PremiumSettingsCard.tsx`
- Free users: Feature comparison table + Upgrade CTA
- Premium users: "Premium Member since [date]", Manage Subscription button, Cancel option

### New: `src/pages/Settings.tsx`
- New settings page with premium management
- Legal disclaimer section
- Route: `/settings`

## Phase 5: Update Existing Components

### `src/components/predictions/PredictionCard.tsx`
- Before placing bet, check if user has enough chips considering their minimum floor
- Free user at 0: show "Out of Chips!" + upgrade CTA inline
- Premium user low: show warning "Low chips! Bet carefully."
- Show balance + min floor for premium users

### `src/pages/Ledger.tsx`
- Add premium banner for locked-out free users
- Enhanced leaderboard for premium users (filters, compare, detailed stats)
- History: free users see last 30 days, premium see all-time
- Add premium success callback handling from URL params

### `src/components/room/ChatBottomBar.tsx`
- Enforce max 2 private huddles for free users when creating
- Show upgrade prompt when limit reached

### Chat message bubbles (ModernMessageBubble, RoomMessageBubble, etc.)
- Show PremiumBadge next to premium users' display names

### Leaderboard display
- Show star/PRO badge next to premium usernames
- Premium users see "Compare" button and filter/sort options

## Phase 6: Rename "Verified" to "Hosted" (Already Partially Done)

The existing `VerifiedBadge` component already shows "HOSTED" text. The `is_verified` field on huddles relates to **huddle verification** (a separate paid feature for huddle owners), not user verification. This should remain separate from user Premium status.

Key distinction:
- **Premium** = user-level subscription ($5/month) for chip economy + features
- **Hosted/Verified huddle** = huddle-level one-time payment for huddle owners

No changes needed to the huddle verification system itself.

## Phase 7: Private Huddle Limits

### Update huddle creation logic
- Before creating a private huddle, count user's existing private huddles
- Free users: max 2 private huddles
- Premium users: unlimited
- Show upgrade prompt when free user exceeds limit

## Technical Details

### Database Migration SQL (summary)

```text
-- profiles: add premium columns
ALTER TABLE profiles ADD COLUMN is_premium boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN stripe_customer_id text;
ALTER TABLE profiles ADD COLUMN stripe_subscription_id text;
ALTER TABLE profiles ADD COLUMN premium_since timestamptz;
ALTER TABLE profiles ADD COLUMN premium_expires_at timestamptz;

-- user_portfolios: add premium-aware columns
ALTER TABLE user_portfolios ADD COLUMN is_premium boolean DEFAULT false;
ALTER TABLE user_portfolios ADD COLUMN starting_chips integer DEFAULT 1000;
ALTER TABLE user_portfolios ADD COLUMN minimum_chips integer DEFAULT 0;

-- Update place_shadow_bet to enforce minimum_chips floor
-- Update reset_weekly_chips for premium starting chips
```

### Edge Function Config (config.toml additions)

```text
[functions.create-premium-checkout]
verify_jwt = true

[functions.stripe-premium-webhook]
verify_jwt = false

[functions.create-premium-portal]
verify_jwt = true
```

### New Route
- `/settings` -- Settings page with premium management

### Files Created (new)
- `supabase/functions/create-premium-checkout/index.ts`
- `supabase/functions/stripe-premium-webhook/index.ts`
- `supabase/functions/create-premium-portal/index.ts`
- `src/hooks/usePremium.ts`
- `src/components/premium/PremiumUpgradeModal.tsx`
- `src/components/premium/PremiumBadge.tsx`
- `src/components/premium/PremiumBanner.tsx`
- `src/components/premium/PremiumSettingsCard.tsx`
- `src/pages/Settings.tsx`

### Files Modified
- `supabase/config.toml` -- add 3 new function configs
- `src/App.tsx` -- add `/settings` route
- `src/hooks/usePortfolio.ts` -- premium-aware portfolio
- `src/components/predictions/PredictionCard.tsx` -- chip floor enforcement + upgrade prompts
- `src/pages/Ledger.tsx` -- premium features, locked-out banner, premium success callback
- `src/components/room/ChatBottomBar.tsx` -- private huddle limit enforcement
- Chat bubble components -- show PremiumBadge
- Database migration for schema changes
- Update `place_shadow_bet` and `reset_weekly_chips` DB functions

### Implementation Order
1. Database migration (schema + updated functions)
2. Edge functions (checkout, webhook, portal)
3. Frontend hooks (usePremium, updated usePortfolio)
4. UI components (modal, badge, banner, settings)
5. Integration into existing pages (Ledger, PredictionCard, ChatBottomBar)
6. Testing end-to-end with Stripe test mode

### Legal Disclaimer
Added to Settings page:
> "Virtual currency for entertainment purposes only. Cannot be redeemed for cash, prizes, or real-world value. Side Huddle is a game of skill and prediction, not gambling."
