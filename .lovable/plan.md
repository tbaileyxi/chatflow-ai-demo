

## Add "HOSTED" Badge to Your Huddles + Make Hosted Page Cards Clickable for Members

### Problem 1: No "HOSTED" designation in Your Huddles
When a user is a member of a Hosted Huddle, it shows up under "Private" in the Your Huddles section on the homepage. While hosted huddles already have a green background and "HOSTED" badge in the HuddleList (My Huddles tab), the **YourHuddlesSection on the Home page** does not distinguish them -- they all show with a Lock icon as "private" type.

### Problem 2: Can't enter Hosted Huddles from the Hosted page
On the Hosted Huddles discovery page, the Join button always shows even if the user is already a member or owner. Members/owners should see an "Enter Huddle" button that navigates them directly.

---

### Changes

**File 1: `src/components/home/YourHuddlesSection.tsx`**
- Split the "Private" section into two groups: **Hosted Huddles** and **Private Huddles**
- Hosted huddles (`is_verified === true`) get their own subsection with a "Hosted" header and a distinct visual style (emerald/green accent with ShieldCheck icon instead of Lock icon)
- Regular private huddles remain under "Private" with the Lock icon
- Add "HOSTED" badge next to the huddle name for hosted ones

**File 2: `src/pages/HuddleSearch.tsx`**
- Fetch the user's huddle memberships (query `huddle_members` for current user) to know which hosted huddles the user already belongs to
- In `renderHuddleCard`: if the user is already a member or is the owner, show an **"Enter Huddle"** button (navigates to `/huddle/{id}`) instead of the `HuddleJoinButton`
- The "Enter Huddle" button will use a distinct style (outline or secondary) to differentiate from the Join action

---

### Technical Details

**YourHuddlesSection changes:**
- Import `ShieldCheck` from lucide-react and `Badge` from UI components
- Filter `privateHuddles` into `hostedHuddles` (where `is_verified === true`) and `regularPrivateHuddles` (where `is_verified !== true`)
- Add a new section between Public and Private for hosted huddles with emerald styling
- In the `HuddleCard` component, add a third type `'hosted'` with ShieldCheck icon and emerald accent colors

**HuddleSearch changes:**
- Add a state `memberHuddleIds: Set<string>` to track which huddles the user is in
- On mount (when user exists), query `huddle_members` filtered by `user_id` to get all the user's huddle IDs
- Also check `owner_id` match against the user
- In `renderHuddleCard`, conditionally render either a navigate button ("Enter Huddle") or the existing `HuddleJoinButton`

### Files Modified (2 total)
1. `src/components/home/YourHuddlesSection.tsx` -- add hosted huddle section with badge
2. `src/pages/HuddleSearch.tsx` -- check membership, show "Enter Huddle" for members/owners

