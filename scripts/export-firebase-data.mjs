#!/usr/bin/env node
/**
 * ============================================================
 * FounderTrack: Firebase Firestore Data Exporter
 * ============================================================
 *
 * This script exports all FounderTrack Firestore collections
 * into the JSON format expected by migrate-firebase-to-supabase.mjs
 *
 * PREREQUISITES:
 *   1. npm install firebase-admin
 *   2. Download your Firebase service account key:
 *      Firebase Console → Project Settings → Service Accounts
 *      → "Generate new private key" → save as firebase-service-account.json
 *      in the project root (this file is gitignored)
 *
 * USAGE:
 *   node scripts/export-firebase-data.mjs
 *   → Creates: firebase-export.json in project root
 *
 * Then run the migration:
 *   node scripts/migrate-firebase-to-supabase.mjs
 * ============================================================
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// ─── Check if firebase-admin is installed ─────────────────────────────────────
let admin;
try {
  admin = await import('firebase-admin');
  admin = admin.default || admin;
} catch {
  log('\n❌  firebase-admin is not installed.', 'red');
  log('\nInstall it first (temp, for export only):', 'yellow');
  log('  npm install firebase-admin', 'cyan');
  log('\nThen re-run this script.\n', 'dim');
  process.exit(1);
}

// ─── Load service account ─────────────────────────────────────────────────────
const serviceAccountPath = join(__dirname, '..', 'firebase-service-account.json');
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
} catch {
  log('\n❌  firebase-service-account.json not found.', 'red');
  log('\nSteps to get it:', 'yellow');
  log('  1. Go to: Firebase Console → Project Settings → Service Accounts', 'dim');
  log('  2. Click "Generate new private key"', 'dim');
  log('  3. Save the downloaded file as:', 'dim');
  log(`     ${serviceAccountPath}`, 'cyan');
  log('\nNote: This file is gitignored and safe to use locally.\n', 'green');
  process.exit(1);
}

// ─── Init Firebase Admin ──────────────────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Specify the exact named database that contains the data
const db = admin.firestore();
db.settings({
  databaseId: 'ai-studio-51dcfb55-893e-4533-a86e-15b9ec265a0f'
});

// ─── Collection Mappings ─────────────────────────────────────────────────────
/**
 * Maps Firestore collection paths to export keys and field transformers
 * Adjust collection names to match your Firebase project structure
 */
const COLLECTIONS = [
  {
    key: 'users',
    collection: 'users',
    transform: (doc) => ({
      uid: doc.id,
      name: doc.name || doc.displayName || 'Unknown',
      email: doc.email || '',
      role: doc.role || 'employee',
      photoURL: doc.photoURL || doc.photo_url || null,
      preferences: doc.preferences || null,
    }),
  },
  {
    key: 'attendance',
    collection: 'attendance',
    transform: (doc) => ({
      uid: doc.uid,
      date: doc.date,
      checkInTime: doc.checkInTime
        ? (typeof doc.checkInTime.toDate === 'function'
            ? doc.checkInTime.toDate().toISOString()
            : doc.checkInTime)
        : null,
      checkOutTime: doc.checkOutTime
        ? (typeof doc.checkOutTime.toDate === 'function'
            ? doc.checkOutTime.toDate().toISOString()
            : doc.checkOutTime)
        : null,
      checkInLocation: doc.checkInLocation || null,
      checkOutLocation: doc.checkOutLocation || null,
      checkInPhoto: doc.checkInPhoto || null,
      checkOutPhoto: doc.checkOutPhoto || null,
      totalHours: doc.totalHours || null,
      status: doc.status || 'present',
    }),
  },
  {
    key: 'dailyReports',
    collection: 'dailyReports',
    transform: (doc) => ({
      uid: doc.uid,
      date: doc.date,
      reportUrl: doc.reportUrl || doc.report_url || null,
      todoList: Array.isArray(doc.todoList) ? doc.todoList : [],
    }),
  },
  {
    key: 'leaveRequests',
    collection: 'leaveRequests',
    transform: (doc) => ({
      uid: doc.uid,
      startDate: doc.startDate || doc.start_date,
      endDate: doc.endDate || doc.end_date,
      reason: doc.reason || '',
      type: doc.type || 'leave',
      status: doc.status || 'pending',
    }),
  },
  {
    key: 'brainstormIdeas',
    collection: 'brainstormIdeas',
    transform: (doc) => ({
      uid: doc.uid,
      authorName: doc.authorName || doc.author_name || 'Unknown',
      title: doc.title || '',
      description: doc.description || '',
      category: doc.category || 'idea',
      status: doc.status || 'open',
      createdAt: doc.createdAt
        ? (typeof doc.createdAt.toDate === 'function'
            ? doc.createdAt.toDate().toISOString()
            : doc.createdAt)
        : new Date().toISOString(),
      upvotes: Array.isArray(doc.upvotes) ? doc.upvotes : [],
    }),
  },
  {
    key: 'reviewCycles',
    collection: 'reviewCycles',
    transform: (doc) => ({
      id: doc.id,
      startDate: doc.startDate
        ? (typeof doc.startDate.toDate === 'function'
            ? doc.startDate.toDate().toISOString()
            : doc.startDate)
        : new Date().toISOString(),
      endDate: doc.endDate
        ? (typeof doc.endDate.toDate === 'function'
            ? doc.endDate.toDate().toISOString()
            : doc.endDate)
        : new Date().toISOString(),
      status: doc.status || 'active',
      underperformerUid: doc.underperformerUid || null,
      isTie: doc.isTie || false,
      tieBreakerUid: doc.tieBreakerUid || null,
      results: doc.results || null,
    }),
  },
  {
    key: 'ballots',
    collection: 'ballots',
    transform: (doc) => ({
      cycleId: doc.cycleId,
      voterUid: doc.voterUid,
      rankings: Array.isArray(doc.rankings) ? doc.rankings : [],
      createdAt: doc.createdAt
        ? (typeof doc.createdAt.toDate === 'function'
            ? doc.createdAt.toDate().toISOString()
            : doc.createdAt)
        : new Date().toISOString(),
    }),
  },
];

// ─── Export All Collections ───────────────────────────────────────────────────
async function exportCollection({ key, collection, transform }) {
  log(`  📦  Exporting ${collection}...`, 'dim');
  try {
    const snapshot = await db.collection(collection).get();
    const docs = snapshot.docs.map((doc) => {
      try {
        return transform({ id: doc.id, ...doc.data() });
      } catch (err) {
        log(`    ⚠️  Error transforming doc ${doc.id}: ${err.message}`, 'yellow');
        return null;
      }
    }).filter(Boolean);

    log(`  ✅  ${docs.length} records from ${collection}`, 'green');
    return { key, docs };
  } catch (err) {
    log(`  ❌  Failed to export ${collection}: ${err.message}`, 'red');
    return { key, docs: [] };
  }
}

async function main() {
  log('\n🔥  FounderTrack: Firebase Firestore Exporter', 'bold');
  log(`🎯  Project: ${serviceAccount.project_id}`, 'cyan');
  console.log('');

  const exportData = {};

  for (const config of COLLECTIONS) {
    const { key, docs } = await exportCollection(config);
    exportData[key] = docs;
  }

  const outputPath = join(__dirname, '..', 'firebase-export.json');
  writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf8');

  const totalRecords = Object.values(exportData).reduce((sum, arr) => sum + arr.length, 0);

  console.log('');
  log('══════════════════════════════════════════', 'cyan');
  log('  EXPORT COMPLETE', 'bold');
  log('══════════════════════════════════════════', 'cyan');
  log(`  ✅  Total records exported : ${totalRecords}`, 'green');
  log(`  📄  Output file           : firebase-export.json`, 'green');
  console.log('');
  log('Next step — run the migration:', 'yellow');
  log('  node scripts/migrate-firebase-to-supabase.mjs', 'cyan');
  console.log('');
}

main().catch((err) => {
  log(`\n❌  Unexpected error: ${err.message}`, 'red');
  console.error(err);
  process.exit(1);
});
