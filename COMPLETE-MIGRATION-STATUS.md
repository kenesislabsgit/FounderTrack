# Complete Firebase → Supabase Migration Status

## 📊 Your Firebase Users (7 Total)

| Email | Name | Role | Status |
|-------|------|------|--------|
| dheekshith35@gmail.com | Dheekshith T | founder | ✅ **Migrated** (logged in) |
| kdineshkumarofficial@gmail.com | Dinesh Kumar | founder | ✅ **Migrated** (logged in) |
| kenesislabs@gmail.com | Kenesis | admin | ✅ **Migrated** (logged in) |
| danieldaskomarapu@gmail.com | Daniel | founder | ⏳ **Waiting** (needs first login) |
| aswinjd5@gmail.com | Aswin JD | founder | ⏳ **Waiting** (needs first login) |
| dheekshithoff@gmail.com | Dheekshith | founder | ⏳ **Waiting** (needs first login) |
| amrishstm@gmail.com | Amrish | founder | ⏳ **Waiting** (needs first login) |

---

## ✅ Already Migrated (3 users)

These users logged into Supabase and had their UIDs migrated:
- **Dheekshith T** - All data preserved
- **Dinesh Kumar** - All data preserved  
- **Kenesis** - All data preserved

---

## ⏳ Waiting for First Login (4 users)

These users have their Firebase data in the database but **haven't logged into Supabase yet**:

### What happens when they log in for the first time:

1. They sign in with Google OAuth at your app
2. Supabase Auth creates a new auth record (new UUID)
3. The app will:
   - Find their old Firebase profile by email
   - Show role selection (because UID mismatch)
   - After role selection, run the migration script
   - Link all their old data to the new Supabase UID

### Their current data status:

| User | Has Profile | Has Data |
|------|-------------|----------|
| Daniel | ✅ Yes (Firebase UID) | Check with SQL |
| Aswin JD | ✅ Yes (Firebase UID) | Check with SQL |
| Dheekshith (alt) | ✅ Yes (Firebase UID) | Check with SQL |
| Amrish | ✅ Yes (Firebase UID) | Check with SQL |

---

## 🔧 What You Need to Do

### Step 1: Run the Complete Migration Script

This will properly migrate the 3 users who already logged in:

```bash
# In Supabase SQL Editor, run:
scripts/complete-migration-for-all-users.sql
```

This script:
- ✅ Fixes UID mismatches for logged-in users
- ✅ Migrates ALL data (attendance, reports, leaves)
- ✅ Cleans up duplicate records
- ✅ Keeps Firebase profiles intact for users who haven't logged in yet

### Step 2: Invite the 4 Remaining Users to Log In

Send them this message:

> **Subject: Action Required - Log into New FounderTrack System**
>
> Hi team,
>
> We've migrated FounderTrack from Firebase to Supabase. Your data is safe, but you need to log in once to complete the migration.
>
> **What to do:**
> 1. Go to http://localhost:4141 (or your production URL)
> 2. Click "Sign in with Google"
> 3. Select your role when prompted (should be "founder" for most of you)
> 4. Your old attendance, reports, and leave data will automatically be linked
>
> **Users who need to log in:**
> - Daniel (danieldaskomarapu@gmail.com)
> - Aswin JD (aswinjd5@gmail.com)
> - Dheekshith (dheekshithoff@gmail.com)
> - Amrish (amrishstm@gmail.com)

### Step 3: Fix Kenesis Role (If Needed)

If Kenesis should be "admin" instead of "employee":

```sql
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'kenesislabs@gmail.com';
```

### Step 4: Clean Up Duplicate Leave Requests

```bash
# In Supabase SQL Editor, run:
scripts/cleanup-duplicates.sql
```

---

## 🔍 Verify Everything is Working

After all users log in, run this in Supabase SQL Editor:

```sql
-- Show all users and their migration status
scripts/show-all-firebase-users.sql
```

Expected output: **All 7 users with "✅ MIGRATED"**

---

## 🚨 Important Notes

### Firebase UIDs in Leave Requests

You have orphaned leave requests with these Firebase UIDs:
- `DguB4MQdknfFoNJhIzUID0WJeLJ2`
- `ZBryE83rdcbRVUifssqHu3Fegss2`
- `ZXSLJcmz9ncSREhJs5VjpkIKh1e2`
- `ohquwRY3pwf1oMGwWgUy5BUZ4kt2`

These belong to the 4 users who haven't logged in yet. Their data will be **automatically migrated** when they log in for the first time.

### What Gets Preserved

✅ **Everything from Firebase:**
- User profiles (name, email, role, photo)
- All attendance records
- All daily reports
- All leave requests
- All brainstorm ideas
- All review cycles
- All ballots

❌ **What Doesn't Transfer:**
- Firebase Auth tokens (users must re-authenticate with Google)
- Old UIDs (replaced with new Supabase UUIDs)

---

## 📞 If Something Goes Wrong

1. **User can't log in** → Check if their email is in `auth.users`
2. **Data is missing** → Run `show-all-firebase-users.sql` to check status
3. **Duplicate records** → Run `cleanup-duplicates.sql`
4. **UID mismatch persists** → Re-run `complete-migration-for-all-users.sql`

---

## ✅ Success Checklist

- [ ] Run `complete-migration-for-all-users.sql`
- [ ] Verify 3 logged-in users show "✅ MIGRATED"
- [ ] Invite 4 remaining users to log in
- [ ] Each user logs in once with Google OAuth
- [ ] Run `show-all-firebase-users.sql` to verify all 7 migrated
- [ ] Run `cleanup-duplicates.sql` to remove duplicates
- [ ] Test: All users can log in and see their data
- [ ] Test: Admins can approve/reject leave requests

**Once complete, all 7 Firebase users will be fully migrated to Supabase with ALL their data intact! 🎉**
