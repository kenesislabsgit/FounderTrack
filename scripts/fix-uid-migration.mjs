#!/usr/bin/env node
/**
 * Fix UID Migration Issues
 *
 * This script updates old Firebase UIDs to new Supabase Auth UIDs
 * by matching on email address and updating all related records.
 *
 * Usage: node scripts/fix-uid-migration.mjs <email>
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env');
    const content = readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const match = line.match(/^([^#=]+)=["']?(.+?)["']?\s*$/);
      if (match) {
        process.env[match[1].trim()] = match[2].trim();
      }
    });
  } catch {
    console.error('❌ Could not load .env file');
    process.exit(1);
  }
}
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Use service role to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/fix-uid-migration.mjs <email>');
  console.error('Example: node scripts/fix-uid-migration.mjs user@example.com');
  process.exit(1);
}

console.log(`\n🔧 Fixing UID migration for: ${email}\n`);

async function fixUidMigration() {
  // 1. Get the current Supabase Auth UID
  console.log('1️⃣  Finding current auth user...');
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error('❌ Error fetching auth users:', authError.message);
    process.exit(1);
  }

  const authUser = authUsers.users.find(u => u.email === email);
  if (!authUser) {
    console.error(`❌ No auth user found with email: ${email}`);
    console.log('   Make sure the user has logged in at least once.');
    process.exit(1);
  }

  const newUid = authUser.id;
  console.log(`✅ Found auth user with UID: ${newUid}`);

  // 2. Find the old profile in public.users
  console.log('\n2️⃣  Finding old profile...');
  const { data: oldProfiles, error: oldProfileError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email);

  if (oldProfileError) {
    console.error('❌ Error fetching old profile:', oldProfileError.message);
    process.exit(1);
  }

  if (!oldProfiles || oldProfiles.length === 0) {
    console.log('✅ No old profile found. Creating new one...');

    // Create new profile
    const { error: insertError } = await supabase.from('users').insert({
      uid: newUid,
      name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'User',
      email: authUser.email,
      role: 'admin', // First user gets admin
      photo_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
    });

    if (insertError) {
      console.error('❌ Error creating profile:', insertError.message);
      process.exit(1);
    }

    console.log('✅ Profile created successfully!');
    process.exit(0);
  }

  const oldProfile = oldProfiles[0];
  const oldUid = oldProfile.uid;

  if (oldUid === newUid) {
    console.log('✅ UID already matches! No migration needed.');
    console.log(`   Current role: ${oldProfile.role}`);
    process.exit(0);
  }

  console.log(`✅ Found old profile with UID: ${oldUid}`);
  console.log(`   Name: ${oldProfile.name}`);
  console.log(`   Role: ${oldProfile.role}`);

  if (oldProfiles.length > 1) {
    console.warn(`⚠️  WARNING: Found ${oldProfiles.length} profiles with this email!`);
  }

  // 3. Approach: Create a new user profile with the new UID, copy data, then migrate FKs
  console.log('\n3️⃣  Creating new user profile with new UID...');

  // Create new profile (might already exist from a failed login attempt)
  const { error: insertError } = await supabase.from('users').insert({
    uid: newUid,
    name: oldProfile.name,
    email: oldProfile.email,
    role: oldProfile.role,
    photo_url: oldProfile.photo_url,
    preferences: oldProfile.preferences,
  });

  if (insertError) {
    // If it already exists, just update it to match the old profile
    if (insertError.code === '23505') {
      console.log('   Profile with new UID already exists, updating it...');
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: oldProfile.name,
          role: oldProfile.role,
          photo_url: oldProfile.photo_url,
          preferences: oldProfile.preferences,
        })
        .eq('uid', newUid);

      if (updateError) {
        console.error('❌ Error updating existing profile:', updateError.message);
        process.exit(1);
      }
    } else {
      console.error('❌ Error creating new profile:', insertError.message);
      process.exit(1);
    }
  }

  console.log('✅ New profile created/updated');

  // 4. Update all related records to point to the new UID
  console.log('\n4️⃣  Migrating related records to new UID...');

  const tables = [
    { name: 'attendance', uidColumn: 'uid' },
    { name: 'daily_reports', uidColumn: 'uid' },
    { name: 'leave_requests', uidColumn: 'uid' },
    { name: 'brainstorm_ideas', uidColumn: 'uid' },
    { name: 'ballots', uidColumn: 'voter_uid' },
    { name: 'review_cycles', uidColumn: 'underperformer_uid' },
    { name: 'review_cycles', uidColumn: 'tie_breaker_uid' },
  ];

  for (const table of tables) {
    const { data: records, error: fetchError } = await supabase
      .from(table.name)
      .select('*')
      .eq(table.uidColumn, oldUid);

    if (fetchError) {
      console.error(`   ⚠️  Error fetching ${table.name}:`, fetchError.message);
      continue;
    }

    if (records && records.length > 0) {
      const { error: updateError } = await supabase
        .from(table.name)
        .update({ [table.uidColumn]: newUid })
        .eq(table.uidColumn, oldUid);

      if (updateError) {
        console.error(`   ❌ Error updating ${table.name}:`, updateError.message);
      } else {
        console.log(`   ✅ Migrated ${records.length} records in ${table.name}`);
      }
    }
  }

  // 5. Delete the old user profile (now that FKs are migrated)
  console.log('\n5️⃣  Cleaning up old profile...');
  const { error: deleteError } = await supabase
    .from('users')
    .delete()
    .eq('uid', oldUid);

  if (deleteError) {
    console.warn('⚠️  Could not delete old profile:', deleteError.message);
    console.warn('   This is usually fine - you can delete it manually later.');
  } else {
    console.log('✅ Old profile deleted');
  }

  // 6. Verify the migration
  console.log('\n6️⃣  Verifying migration...');
  const { data: verifyProfile, error: verifyError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (verifyError || !verifyProfile) {
    console.error('❌ Verification failed:', verifyError?.message);
    process.exit(1);
  }

  console.log('✅ Verification successful!');
  console.log(`   UID: ${verifyProfile.uid}`);
  console.log(`   Name: ${verifyProfile.name}`);
  console.log(`   Email: ${verifyProfile.email}`);
  console.log(`   Role: ${verifyProfile.role}`);

  console.log('\n🎉 Migration complete! You can now log in normally.\n');
}

fixUidMigration().catch((err) => {
  console.error('\n❌ Unexpected error:', err.message);
  console.error(err);
  process.exit(1);
});
