#!/usr/bin/env node
/**
 * Debug script to check user profiles in Supabase
 * Usage: node scripts/check-user-profile.mjs <email>
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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/check-user-profile.mjs <email>');
  process.exit(1);
}

console.log(`\n🔍 Checking user profile for: ${email}\n`);

// Check auth.users
const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
if (authError) {
  console.error('❌ Error fetching auth users:', authError.message);
} else {
  const authUser = authUsers.users.find(u => u.email === email);
  if (authUser) {
    console.log('✅ Found in auth.users:');
    console.log('   ID:', authUser.id);
    console.log('   Email:', authUser.email);
    console.log('   Created:', authUser.created_at);
    console.log('   Last sign in:', authUser.last_sign_in_at);
  } else {
    console.log('❌ NOT found in auth.users');
  }
}

// Check public.users
const { data: publicUsers, error: publicError } = await supabase
  .from('users')
  .select('*')
  .eq('email', email);

if (publicError) {
  console.error('\n❌ Error fetching public.users:', publicError.message);
} else if (!publicUsers || publicUsers.length === 0) {
  console.log('\n❌ NOT found in public.users table');
  console.log('   → This user needs to complete role selection');
} else {
  console.log('\n✅ Found in public.users:');
  publicUsers.forEach((user, idx) => {
    if (idx > 0) console.log('\n   ⚠️ DUPLICATE ENTRY:');
    console.log('   UID:', user.uid);
    console.log('   Name:', user.name);
    console.log('   Email:', user.email);
    console.log('   Role:', user.role);
    console.log('   Photo URL:', user.photo_url || '(none)');
  });

  if (publicUsers.length > 1) {
    console.log('\n⚠️  WARNING: Multiple profiles found for this email!');
    console.log('   This can cause authentication issues.');
    console.log('   Consider running: DELETE FROM public.users WHERE email = \'' + email + '\' AND uid != \'<correct-uid>\';');
  }
}

console.log('\n');
