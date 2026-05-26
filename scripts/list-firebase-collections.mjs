#!/usr/bin/env node
/**
 * Deep diagnostic: Lists all Firestore databases in the project,
 * checks subcollection patterns and storage bucket contents.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let admin;
try {
  admin = (await import('firebase-admin')).default;
} catch {
  console.error('❌  Run: npm install firebase-admin first');
  process.exit(1);
}

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', 'firebase-service-account.json'), 'utf8')
);

const projectId = serviceAccount.project_id;
console.log(`\n🔍  Deep Diagnostic for project: ${projectId}\n`);

// ── Check default database ──────────────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
console.log('📋  Checking default Firestore database (databases/default)...');
const defaultCols = await db.listCollections();
console.log(`    → ${defaultCols.length} top-level collections found`);
defaultCols.forEach(c => console.log(`      • ${c.id}`));

// ── Check Firebase Auth users ──────────────────────────────────────────────
console.log('\n👥  Checking Firebase Auth users...');
try {
  const authList = await admin.auth().listUsers(5);
  console.log(`    → ${authList.users.length} user(s) found (showing up to 5):`);
  authList.users.forEach(u => {
    console.log(`      • [${u.uid}] ${u.email} (${u.displayName || 'no name'})`);
  });
  if (authList.pageToken) {
    console.log('      ... (more users exist)');
  }
} catch (err) {
  console.log(`    ⚠️  Auth check failed: ${err.message}`);
}

// ── Check Firebase Storage buckets ────────────────────────────────────────
console.log('\n🗂️  Checking Firebase Storage...');
try {
  const bucket = admin.storage().bucket(`${projectId}.appspot.com`);
  const [files] = await bucket.getFiles({ maxResults: 10 });
  console.log(`    → ${files.length} file(s) found in default storage bucket:`);
  files.forEach(f => console.log(`      • ${f.name}`));
} catch (err) {
  console.log(`    ⚠️  Storage check failed: ${err.message}`);
}

console.log('\n✅  Diagnostic complete.\n');
process.exit(0);
