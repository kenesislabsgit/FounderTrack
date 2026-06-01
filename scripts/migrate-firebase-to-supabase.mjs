#!/usr/bin/env node
/**
 * ============================================================
 * FounderTrack: Firebase → Supabase Data Migration Script
 * ============================================================
 *
 * USAGE:
 *   node scripts/migrate-firebase-to-supabase.mjs [firebase-export.json]
 *
 * STEPS:
 *   1. Export your Firebase data (see README below)
 *   2. Place the exported JSON at the path passed as argument
 *      (or update FIREBASE_EXPORT_PATH below)
 *   3. Run: node scripts/migrate-firebase-to-supabase.mjs
 *
 * HOW TO EXPORT FROM FIREBASE:
 *   Option A (Recommended — Firebase Admin SDK):
 *     - Install: npm install -g firebase-tools
 *     - Run:     firebase firestore:export gs://your-bucket/export --project your-project
 *     - Then download the JSON with:
 *         firebase firestore:export --format=json ./firebase-export --project your-project
 *
 *   Option B (Quick — Google Cloud Console):
 *     - Go to Firebase Console → Firestore → Import/Export → Export
 *     - Download the exported files
 *     - Convert to the JSON format expected by this script (see below)
 *
 *   Option C (Manual — Build your own export JSON):
 *     - Use the format documented at the bottom of this file
 *
 * EXPECTED JSON FORMAT (firebase-export.json):
 *   {
 *     "users": [
 *       { "uid": "...", "name": "...", "email": "...", "role": "...", "photoURL": "..." }
 *     ],
 *     "attendance": [
 *       { "uid": "...", "date": "YYYY-MM-DD", "checkInTime": "ISO", "checkOutTime": "ISO",
 *         "checkInLocation": {...}, "checkOutLocation": {...},
 *         "checkInPhoto": "url", "checkOutPhoto": "url",
 *         "totalHours": 8.5, "status": "present" }
 *     ],
 *     "dailyReports": [
 *       { "uid": "...", "date": "YYYY-MM-DD", "reportUrl": "...",
 *         "todoList": [{ "task": "...", "completed": false }] }
 *     ],
 *     "leaveRequests": [
 *       { "uid": "...", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD",
 *         "reason": "...", "type": "leave|wfh", "status": "pending|approved|rejected" }
 *     ],
 *     "brainstormIdeas": [
 *       { "uid": "...", "authorName": "...", "title": "...", "description": "...",
 *         "category": "idea|todo|discussion", "status": "open|in-progress|completed|archived",
 *         "createdAt": "ISO", "upvotes": ["uid1", "uid2"] }
 *     ],
 *     "reviewCycles": [
 *       { "startDate": "ISO", "endDate": "ISO", "status": "active|voting|completed",
 *         "underperformerUid": "...", "isTie": false, "tieBreakerUid": "...",
 *         "results": { "uid1": 1.5, "uid2": 2.0 } }
 *     ],
 *     "ballots": [
 *       { "cycleId": "...", "voterUid": "...", "createdAt": "ISO",
 *         "rankings": [{ "targetUid": "...", "rank": 1, "reason": "..." }] }
 *     ]
 *   }
 * ============================================================
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ─── Config ───────────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars manually (no dotenv needed, just read .env file)
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
    // .env may not exist in CI
  }
}
loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌  Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// Use service-role key to bypass RLS during migration
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logSection(title) {
  console.log('');
  log(`╔══════════════════════════════════════╗`, 'cyan');
  log(`║  ${title.padEnd(36)}║`, 'cyan');
  log(`╚══════════════════════════════════════╝`, 'cyan');
}

async function upsertBatch(table, rows, conflictColumns, label) {
  if (!rows || rows.length === 0) {
    log(`  ⏭  No ${label} records to migrate.`, 'dim');
    return { count: 0, errors: 0 };
  }

  let imported = 0;
  let errors = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: conflictColumns, ignoreDuplicates: true });

    if (error) {
      log(`  ⚠️  Batch ${Math.floor(i / BATCH_SIZE) + 1} error: ${error.message}`, 'yellow');
      errors += batch.length;
    } else {
      imported += batch.length;
    }
  }

  if (errors > 0) {
    log(`  ✅  ${imported} ${label} migrated, ⚠️  ${errors} skipped/errored`, 'yellow');
  } else {
    log(`  ✅  ${imported} ${label} migrated successfully`, 'green');
  }
  return { count: imported, errors };
}

// ─── Transformers ─────────────────────────────────────────────────────────────

function transformUsers(fbUsers) {
  const map = new Map();
  fbUsers.forEach((u) => {
    map.set(u.uid, {
      uid: u.uid,
      name: u.name || u.displayName || 'Unknown',
      email: u.email,
      role: ['founder', 'admin', 'employee', 'intern'].includes(u.role) ? u.role : 'employee',
      photo_url: u.photoURL || u.photo_url || null,
      preferences: u.preferences || { emailNotifications: false, pushNotifications: false },
    });
  });
  return Array.from(map.values());
}

function transformAttendance(fbAttendance) {
  const map = new Map();
  fbAttendance.forEach((a) => {
    const key = `${a.uid}_${a.date}`;
    // Keep only one record per user+date to satisfy unique constraint
    if (!map.has(key) || a.checkOutTime) { // Prefer records that are complete (have checkOutTime)
      map.set(key, {
        uid: a.uid,
        date: a.date,
        check_in_time: a.checkInTime || a.check_in_time || null,
        check_out_time: a.checkOutTime || a.check_out_time || null,
        check_in_location: a.checkInLocation || a.check_in_location || null,
        check_out_location: a.checkOutLocation || a.check_out_location || null,
        check_in_photo: a.checkInPhoto || a.check_in_photo || null,
        check_out_photo: a.checkOutPhoto || a.check_out_photo || null,
        total_hours: a.totalHours || a.total_hours || null,
        status: ['present', 'wfh', 'leave'].includes(a.status) ? a.status : 'present',
      });
    }
  });
  return Array.from(map.values());
}

function transformDailyReports(fbReports) {
  const map = new Map();
  fbReports.forEach((r) => {
    const key = `${r.uid}_${r.date}`;
    if (!map.has(key)) {
      map.set(key, {
        uid: r.uid,
        date: r.date,
        report_url: r.reportUrl || r.report_url || null,
        todo_list: Array.isArray(r.todoList || r.todo_list)
          ? (r.todoList || r.todo_list)
          : [],
      });
    }
  });
  return Array.from(map.values());
}

function transformLeaveRequests(fbLeaves) {
  return fbLeaves.map((l) => ({
    uid: l.uid,
    start_date: l.startDate || l.start_date,
    end_date: l.endDate || l.end_date,
    reason: l.reason || '',
    type: ['leave', 'wfh'].includes(l.type) ? l.type : 'leave',
    status: ['pending', 'approved', 'rejected'].includes(l.status) ? l.status : 'pending',
  }));
}

function transformBrainstormIdeas(fbIdeas) {
  return fbIdeas.map((idea) => ({
    uid: idea.uid,
    author_name: idea.authorName || idea.author_name || 'Unknown',
    title: idea.title,
    description: idea.description || '',
    category: ['idea', 'todo', 'discussion'].includes(idea.category) ? idea.category : 'idea',
    status: ['open', 'in-progress', 'completed', 'archived'].includes(idea.status)
      ? idea.status
      : 'open',
    created_at: idea.createdAt || idea.created_at || new Date().toISOString(),
    upvotes: Array.isArray(idea.upvotes) ? idea.upvotes : [],
  }));
}

function transformReviewCycles(fbCycles) {
  return fbCycles.map((c) => ({
    start_date: c.startDate || c.start_date || new Date().toISOString(),
    end_date: c.endDate || c.end_date,
    status: ['active', 'voting', 'completed'].includes(c.status) ? c.status : 'active',
    underperformer_uid: c.underperformerUid || c.underperformer_uid || null,
    is_tie: c.isTie || c.is_tie || false,
    tie_breaker_uid: c.tieBreakerUid || c.tie_breaker_uid || null,
    results: c.results || null,
  }));
}

// Ballots need cycle_id which is the new Supabase UUID — we'll map by index
async function transformBallots(fbBallots, cycleIdMap) {
  return fbBallots
    .map((b) => {
      const cycleId = cycleIdMap.get(b.cycleId) || b.cycleId;
      return {
        cycle_id: cycleId,
        voter_uid: b.voterUid || b.voter_uid,
        rankings: Array.isArray(b.rankings) ? b.rankings : [],
        created_at: b.createdAt || b.created_at || new Date().toISOString(),
      };
    })
    .filter((b) => b.cycle_id && b.voter_uid);
}

// ─── Main Migration ───────────────────────────────────────────────────────────

async function migrate(exportPath) {
  log('\n🚀  FounderTrack: Firebase → Supabase Migration', 'bold');
  log(`📂  Reading export: ${exportPath}`, 'dim');

  let fbData;
  try {
    const raw = readFileSync(exportPath, 'utf8');
    fbData = JSON.parse(raw);
  } catch (err) {
    log(`❌  Failed to read/parse export file: ${err.message}`, 'red');
    log('\n💡  Make sure the file exists and is valid JSON.', 'yellow');
    log('    See the script header for expected format.\n', 'yellow');
    process.exit(1);
  }

  const stats = { total: 0, errors: 0 };

  // ── 1. Users ──────────────────────────────────────────────────────────────
  logSection('1 / 7  Migrating Users');
  log('  ⚠️  NOTE: Users must exist in Supabase Auth (auth.users) first.', 'yellow');
  log('      This script only populates the public.users profile table.', 'dim');
  log('      Firebase Auth users should log in once to auto-create auth records,', 'dim');
  log('      OR use the Supabase Admin API to import them (see README).', 'dim');

  if (fbData.users?.length) {
    const users = transformUsers(fbData.users);
    const result = await upsertBatch('users', users, 'uid', 'users');
    stats.total += result.count;
    stats.errors += result.errors;
  } else {
    log('  ⏭  No users in export.', 'dim');
  }

  // ── 2. Attendance ─────────────────────────────────────────────────────────
  logSection('2 / 7  Migrating Attendance');
  if (fbData.attendance?.length) {
    const attendance = transformAttendance(fbData.attendance);
    const result = await upsertBatch('attendance', attendance, 'uid,date', 'attendance records');
    stats.total += result.count;
    stats.errors += result.errors;
  } else {
    log('  ⏭  No attendance in export.', 'dim');
  }

  // ── 3. Daily Reports ──────────────────────────────────────────────────────
  logSection('3 / 7  Migrating Daily Reports');
  if (fbData.dailyReports?.length || fbData.daily_reports?.length) {
    const src = fbData.dailyReports || fbData.daily_reports;
    const reports = transformDailyReports(src);
    const result = await upsertBatch('daily_reports', reports, 'uid,date', 'daily reports');
    stats.total += result.count;
    stats.errors += result.errors;
  } else {
    log('  ⏭  No daily reports in export.', 'dim');
  }

  // ── 4. Leave Requests ─────────────────────────────────────────────────────
  logSection('4 / 7  Migrating Leave Requests');
  if (fbData.leaveRequests?.length || fbData.leave_requests?.length) {
    const src = fbData.leaveRequests || fbData.leave_requests;
    const leaves = transformLeaveRequests(src);
    const result = await upsertBatch('leave_requests', leaves, 'id', 'leave requests');
    stats.total += result.count;
    stats.errors += result.errors;
  } else {
    log('  ⏭  No leave requests in export.', 'dim');
  }

  // ── 5. Brainstorm Ideas ───────────────────────────────────────────────────
  logSection('5 / 7  Migrating Brainstorm Ideas');
  if (fbData.brainstormIdeas?.length || fbData.brainstorm_ideas?.length) {
    const src = fbData.brainstormIdeas || fbData.brainstorm_ideas;
    const ideas = transformBrainstormIdeas(src);
    const result = await upsertBatch('brainstorm_ideas', ideas, 'id', 'brainstorm ideas');
    stats.total += result.count;
    stats.errors += result.errors;
  } else {
    log('  ⏭  No brainstorm ideas in export.', 'dim');
  }

  // ── 6. Review Cycles ──────────────────────────────────────────────────────
  logSection('6 / 7  Migrating Review Cycles');
  const cycleIdMap = new Map(); // Map<firebase_id, supabase_uuid>

  if (fbData.reviewCycles?.length || fbData.review_cycles?.length) {
    const src = fbData.reviewCycles || fbData.review_cycles;
    const cycles = transformReviewCycles(src);

    // Insert each cycle individually to capture returned UUIDs for ballot linking
    let cycleCount = 0;
    for (let i = 0; i < cycles.length; i++) {
      const fbCycle = src[i];
      const { data, error } = await supabase
        .from('review_cycles')
        .upsert(cycles[i], { onConflict: 'id', ignoreDuplicates: false })
        .select('id')
        .single();

      if (error) {
        log(`  ⚠️  Cycle ${i + 1} error: ${error.message}`, 'yellow');
        stats.errors++;
      } else {
        if (fbCycle.id) cycleIdMap.set(fbCycle.id, data.id);
        cycleCount++;
        stats.total++;
      }
    }
    log(`  ✅  ${cycleCount} review cycles migrated`, 'green');
  } else {
    log('  ⏭  No review cycles in export.', 'dim');
  }

  // ── 7. Ballots ────────────────────────────────────────────────────────────
  logSection('7 / 7  Migrating Ballots');
  if (fbData.ballots?.length) {
    const ballots = await transformBallots(fbData.ballots, cycleIdMap);
    const result = await upsertBatch('ballots', ballots, 'cycle_id,voter_uid', 'ballots');
    stats.total += result.count;
    stats.errors += result.errors;
  } else {
    log('  ⏭  No ballots in export.', 'dim');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('');
  log('══════════════════════════════════════════', 'cyan');
  log('  MIGRATION COMPLETE', 'bold');
  log('══════════════════════════════════════════', 'cyan');
  log(`  ✅  Total records migrated : ${stats.total}`, 'green');
  if (stats.errors > 0) {
    log(`  ⚠️  Records with errors    : ${stats.errors}`, 'yellow');
    log('', '');
    log('  Some records were skipped. Common causes:', 'yellow');
    log('  • User UID not found in auth.users (user must log in first)', 'dim');
    log('  • Duplicate records with conflicting unique constraints', 'dim');
    log('  • Invalid enum values (role, status, type, category)', 'dim');
  } else {
    log('  🎉  All records migrated with zero errors!', 'green');
  }
  console.log('');
}

// ─── Entry Point ──────────────────────────────────────────────────────────────
const exportPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(__dirname, '..', 'firebase-export.json');

migrate(exportPath).catch((err) => {
  log(`\n❌  Unexpected error: ${err.message}`, 'red');
  console.error(err);
  process.exit(1);
});
