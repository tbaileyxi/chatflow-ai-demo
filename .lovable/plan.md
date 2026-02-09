

## Rename "Verified" to "Hosted" + Add Host Profile to Hosted Page

### 1. Bottom Nav: "Discover" -> "Hosted"

**File: `src/components/mobile/BottomNav.tsx`**
- Change label from `'Discover'` to `'Hosted'` in both `loggedInNavItems` and `anonymousNavItems`

**File: `src/components/mobile/MobileBottomNav.tsx`**
- Change the `'Discover'` nav item label to `'Hosted'`

### 2. Global Terminology: "Verified" -> "Hosted"

All user-facing text referencing "Verified" will change to "Hosted" across these files:

**`src/components/VerifiedBadge.tsx`**
- Badge text: "VERIFIED" -> "HOSTED"

**`src/pages/HuddleSearch.tsx`** (the Hosted page)
- Header title: "Discover Huddles" -> "Hosted Huddles"
- Description: "Browse verified team huddles" -> "Browse hosted team huddles"
- Search placeholder: "Search verified huddles or teams..." -> "Search hosted huddles or teams..."
- Info banner: "Verified Huddles" -> "Hosted Huddles" with updated description
- Loading/empty states updated
- Create button text stays "Create"

**`src/components/CreateVerifiedHuddleDialog.tsx`**
- Dialog title: "Create Verified Huddle" -> "Create Hosted Huddle"
- "What is a Verified Huddle?" -> "What is a Hosted Huddle?"
- Bullet points remain the same (they describe features, not naming)
- Error messages updated

**`src/components/HuddleVerificationDialog.tsx`**
- Dialog title: "Upgrade to Verified Huddle" -> "Upgrade to Hosted Huddle"
- Card title: "Verified Huddle Features" -> "Hosted Huddle Features"
- Button text: "Get Verified" / "Verify" -> "Get Hosted" / "Host"

**`src/pages/HuddleSettings.tsx`**
- Section header: "VERIFIED" -> "HOSTED" / "Huddle Verification" -> "Hosted Status"
- Status text: "Verified Huddle" -> "Hosted Huddle"
- Toast messages updated

**`src/components/HuddleJoinButton.tsx`**
- "Free Verified Huddle" -> "Free Hosted Huddle"
- "This verified huddle requires..." -> "This hosted huddle requires..."

**`src/components/mobile/HuddleList.tsx`**
- Badge text: "VERIFIED" -> "HOSTED"

**`src/components/StartHuddleDialog.tsx`**
- "Get verified?" link text -> "Get hosted?"

**`src/pages/Profile.tsx`**
- "Your Lifetime Verified Huddle Code" -> "Your Lifetime Hosted Huddle Code"
- "Use when creating a Verified Huddle" -> "Use when creating a Hosted Huddle"

### 3. Hosted Page Card Redesign: Add Host Profile

**File: `src/pages/HuddleSearch.tsx`**

The current card layout shows: huddle name, team name, member count, price. The new layout will be:

```text
[Team Logo]  Browns Again (huddle name)
             Browns (team)
             Hosted by [Avatar] Ty Bailey
             Bio text if populated...
             
             FREE        [Join Huddle]
```

Technical changes:
- Update the Supabase query for owner profiles to also fetch `avatar_url` and `bio` (currently only fetches `display_name` and `username`)
- Update the `owner_profile` interface to include `avatar_url`
- Redesign `renderHuddleCard` to show the host's avatar, display name, and huddle bio in the new order:
  1. Huddle name + hosted badge
  2. Team name
  3. "Hosted by" line with small avatar + display name
  4. Bio (if populated)
  5. Price label (FREE or $X.XX/mo) + Join button

### Files Changed (total: 10)

1. `src/components/mobile/BottomNav.tsx` -- nav label
2. `src/components/mobile/MobileBottomNav.tsx` -- nav label
3. `src/components/VerifiedBadge.tsx` -- badge text
4. `src/pages/HuddleSearch.tsx` -- page copy + card redesign with host profile
5. `src/components/CreateVerifiedHuddleDialog.tsx` -- dialog copy
6. `src/components/HuddleVerificationDialog.tsx` -- dialog copy
7. `src/pages/HuddleSettings.tsx` -- settings section copy
8. `src/components/HuddleJoinButton.tsx` -- join dialog copy
9. `src/components/mobile/HuddleList.tsx` -- badge text
10. `src/components/StartHuddleDialog.tsx` -- link text
11. `src/pages/Profile.tsx` -- promo code label

Note: Database column names (`is_verified`) and CSS class names (`verified-primary`) remain unchanged -- only user-facing text is updated.

