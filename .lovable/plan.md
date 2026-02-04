
# Multi-Team Sponsorship Selection with Bulk Discount

## Overview
Add the ability for sponsors to select multiple teams at once, with a **20% discount** automatically applied when 3 or more teams are selected. This creates a cart-like experience before checkout.

## User Experience Flow

```text
1. User browses team directory
2. Instead of "Reserve This Team" button → Checkbox to add/remove teams
3. Selected teams appear in a floating "cart" panel (sticky at bottom or side)
4. Cart shows:
   - List of selected teams (with remove option)
   - Price breakdown: $149 x [count]
   - Discount line (if 3+ teams): -20% discount
   - Total amount
   - "Proceed to Checkout" button
5. Checkout creates single Stripe session with multiple line items
6. Webhook processes all teams as reserved
```

## Technical Implementation

### 1. Frontend Changes (Sponsor.tsx)

**New State Variables:**
- `selectedTeams: Team[]` - Array of teams added to cart
- `showCartPanel: boolean` - Toggle cart visibility on mobile

**Team Card Updates:**
- Replace "Reserve This Team" button with a checkbox for available teams
- Show visual indicator (check mark, border highlight) when selected
- Keep "Join Waitlist" for reserved teams unchanged

**New Cart Component:**
- Floating panel (bottom sheet on mobile, sidebar on desktop)
- Lists selected teams with team name and remove button
- Shows pricing breakdown:
  - Base: $149 x [count] = $[subtotal]
  - If count >= 3: "Bulk Discount (20%): -$[discount]"
  - Total: $[final_amount]
- "Proceed to Checkout" button (disabled if no teams selected)
- Discount badge/banner: "Select 3+ teams for 20% off!"

### 2. Edge Function Updates (create-sponsor-checkout)

**Updated Request Body:**
```typescript
{
  teams: Array<{ teamId: string; teamName: string }>
}
```

**Pricing Logic:**
```typescript
const DEPOSIT_PER_TEAM = 14900; // $149 in cents
const BULK_DISCOUNT_THRESHOLD = 3;
const BULK_DISCOUNT_PERCENT = 20;

const teamCount = teams.length;
const subtotal = DEPOSIT_PER_TEAM * teamCount;
const discount = teamCount >= BULK_DISCOUNT_THRESHOLD 
  ? Math.round(subtotal * BULK_DISCOUNT_PERCENT / 100) 
  : 0;
const total = subtotal - discount;
```

**Stripe Session:**
- Create line items for each team OR single line item with quantity
- Apply discount via Stripe coupon or adjusted pricing
- Store all team IDs in metadata (comma-separated or JSON)

### 3. Webhook Updates (stripe-sponsor-webhook)

**Multi-Team Processing:**
- Parse team IDs from metadata
- Loop through and create reservation for each team
- Send single confirmation email listing all reserved teams

### 4. Deposit Info Section Update

Update the static "Founding Partner Deposit" section to show:
- "$149 per team"
- Highlight: "Reserve 3+ teams and save 20%"

### 5. Success Modal Update

- Show all reserved team names (not just one)
- Confirm total amount paid

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Sponsor.tsx` | Add multi-select state, cart UI, checkout logic |
| `supabase/functions/create-sponsor-checkout/index.ts` | Accept array of teams, calculate discount, create session |
| `supabase/functions/stripe-sponsor-webhook/index.ts` | Process multiple team reservations |

## Pricing Examples

| Teams Selected | Subtotal | Discount | Total |
|----------------|----------|----------|-------|
| 1 team | $149 | $0 | $149 |
| 2 teams | $298 | $0 | $298 |
| 3 teams | $447 | -$89.40 (20%) | $357.60 |
| 5 teams | $745 | -$149 (20%) | $596 |
| 10 teams | $1,490 | -$298 (20%) | $1,192 |

## Edge Cases

- **Team becomes reserved while in cart:** Check availability before checkout, remove unavailable teams with notification
- **Promo code + bulk discount:** Both can apply (Stripe handles promo codes separately)
- **Empty cart:** Disable checkout button
- **Max teams:** No artificial limit, but could add one if needed

## UI Wireframe Concept

```text
┌─────────────────────────────────────────────┐
│  Team Card (Available)                      │
│  ┌──────┐                                   │
│  │ Logo │  Chicago Bears                    │
│  └──────┘  NFL                              │
│            ● Available                      │
│            Est: $499-$699/mo                │
│  ┌─────────────────────────────────────┐    │
│  │ ☑ Add to Reservation                │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  YOUR RESERVATION (3 teams)         [Hide]  │
├─────────────────────────────────────────────┤
│  ✓ Chicago Bears  (NFL)               [×]   │
│  ✓ Green Bay Packers  (NFL)           [×]   │
│  ✓ Los Angeles Lakers  (NBA)          [×]   │
├─────────────────────────────────────────────┤
│  🎉 20% bulk discount applied!              │
│                                             │
│  Subtotal: $447.00                          │
│  Discount: -$89.40                          │
│  ─────────────────────────                  │
│  Total: $357.60                             │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │     Proceed to Checkout             │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## Implementation Order

1. Update Edge Function to accept multiple teams + discount logic
2. Update Webhook to process multiple reservations  
3. Add frontend cart state and selection logic
4. Build cart UI component
5. Update success modal for multi-team display
6. Test end-to-end flow
