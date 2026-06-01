# FounderTrack: Firebase → Supabase Migration Fix Guide

## Problem Overview

When migrating from Firebase to Supabase, your user IDs changed from Firebase UIDs to Supabase Auth UUIDs. This causes authentication issues because:

1. Your old profile in `public.users` has the **old Firebase UID**
2. When you log in now, Supabase Auth generates a **new UUID**
3. The app can't match them, so it tries to create a duplicate profile
4. This fails with a **409 Conflict** error (duplicate email)

## Symptoms

- ✅ Can log in with Google OAuth
- ❌ Gets stuck on "Choose Your Role" screen
- ❌ Selecting a role shows error: `duplicate key value violates unique constraint "users_email_key"`
- ❌ Console shows: `409 Conflict` errors when trying to upsert user profile

## Solution Steps

### Step 1: Fix RLS Policies (Run Once for the Entire Database)

The current RLS policies block new users from inserting the admin sentinel. Fix this:

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Go to **SQL Editor**
3. Copy and paste the contents of `scripts/fix-rls-policies.sql`
4. Click **Run**

**What this does:**
- Allows authenticated users to read from `settings` table (needed for admin check)
- Allows any authenticated user to insert `admin-assigned` sentinel
- Allows users to delete stale profiles with their email (for cleanup)

### Step 2: Migrate Your User's UID

Run the migration script for each affected user:

```bash
node scripts/fix-uid-migration.mjs your-email@example.com
```

**Example:**
```bash
node scripts/fix-uid-migration.mjs kenesislabs@gmail.com
```

**What this script does:**
1. Finds your current Supabase Auth UID
2. Finds your old profile in `public.users`
3. Updates all related records (attendance, reports, leaves, etc.) to use the new UID
4. Updates your user profile to use the new UID
5. Verifies the migration was successful

### Step 3: Test Login

1. Refresh your browser
2. Sign in with Google
3. You should be taken directly to the dashboard (no role selection)
4. Your old data (attendance, reports) should still be there

## Diagnostic Tools

### Check User Profile Status

```bash
node scripts/check-user-profile.mjs your-email@example.com
```

This shows:
- ✅ Whether the user exists in `auth.users`
- ✅ Whether the user exists in `public.users`
- ⚠️ Any duplicate profiles
- 📊 Current role and profile data

### Manual Database Query

If you have access to Supabase SQL Editor:

```sql
-- Check auth users
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
WHERE email = 'your-email@example.com';

-- Check public profiles
SELECT uid, name, email, role
FROM public.users
WHERE email = 'your-email@example.com';

-- Check for UID mismatches
SELECT
  au.id as auth_uid,
  pu.uid as profile_uid,
  pu.email,
  CASE
    WHEN au.id = pu.uid THEN '✅ Match'
    ELSE '❌ Mismatch'
  END as status
FROM auth.users au
LEFT JOIN public.users pu ON pu.email = au.email
WHERE au.email = 'your-email@example.com';
```

## Troubleshooting

### Error: "Failed to load resource: 403"
- **Cause:** RLS policies blocking access to `settings` table
- **Fix:** Run `scripts/fix-rls-policies.sql` in Supabase SQL Editor

### Error: "409 Conflict - duplicate key violates unique constraint"
- **Cause:** Old Firebase UID still in database
- **Fix:** Run `node scripts/fix-uid-migration.mjs your-email@example.com`

### Error: "Could not update UID (FK constraints)"
- **Cause:** Related records (attendance, reports) prevent direct UID update
- **Fix:** The migration script handles this by updating all related records first

### Multiple Profiles for Same Email
```bash
node scripts/check-user-profile.mjs your-email@example.com
```

If you see multiple profiles:
```sql
-- In Supabase SQL Editor:
-- 1. Find the correct UID from auth.users
SELECT id FROM auth.users WHERE email = 'your-email@example.com';

-- 2. Delete the wrong profiles
DELETE FROM public.users
WHERE email = 'your-email@example.com'
AND uid != 'correct-auth-uid-from-step-1';
```

## Prevention for New Users

New users signing up after the migration will NOT have this issue because:
- They're created directly in Supabase Auth (not migrated from Firebase)
- Their UID matches from the start
- The RLS policies now allow proper profile creation

## Technical Details

### Why UIDs Changed

Firebase Auth UIDs look like: `abc123xyz456...` (28 characters, alphanumeric)
Supabase Auth UUIDs look like: `9fda3591-38d9-405e-82f9-3f7e1cc89d9e` (36 characters with hyphens)

When you exported from Firebase and imported to Supabase:
- **Data was migrated** (attendance, reports, user profiles)
- **Auth identities were NOT migrated** (you re-authenticated with Google OAuth)
- This created **new Supabase Auth records with new UUIDs**

### Migration Script Process

The `fix-uid-migration.mjs` script:
1. **Service Role Key**: Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS
2. **Email Matching**: Finds old UID by email (unique constraint)
3. **Cascade Update**: Updates all foreign key references:
   - `attendance.uid`
   - `daily_reports.uid`
   - `leave_requests.uid`
   - `brainstorm_ideas.uid`
   - `ballots.voter_uid`
   - `review_cycles.underperformer_uid`
   - `review_cycles.tie_breaker_uid`
4. **Profile Update**: Updates `users.uid` (must be last due to FK constraints)
5. **Verification**: Confirms the update succeeded

## Questions?

If you encounter issues not covered here:
1. Check the browser console (F12 → Console)
2. Run the diagnostic script: `node scripts/check-user-profile.mjs your-email@example.com`
3. Check Supabase logs in the dashboard
4. Verify the RLS policies were updated correctly
