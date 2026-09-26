#!/usr/bin/env node
// Guards against the exact class of mistake that's easy to make with
// hand-authored Drizzle migrations + raw D1 SQL: editing db/schema.ts
// (or writing a migration) without keeping db/schema.ts, the migration
// files, drizzle/meta/*_snapshot.json, and the live database schema all
// in agreement.
//
// What it checks:
//   1. Every journal entry has a matching .sql file, and vice versa
//      (no orphaned migration, no migration missing from the journal).
//   2. Replays every migration, in order, against a *fresh* throwaway
//      local D1 database (no network, no auth needed) - this catches
//      broken SQL, missing statement-breakpoints, wrong column types,
//      duplicate columns, etc. before they ever reach production.
//   3. Compares the resulting live schema against the latest
//      drizzle/meta/*_snapshot.json AND against db/schema.ts itself, per
//      table. Any column present in one but not the others is reported
//      as a mismatch - this is what catches "I renamed a column in
//      schema.ts but forgot the migration" or "I wrote a migration but
//      forgot to regenerate the snapshot".
//
// It does NOT touch your real database. It builds and tears down its own
// scratch SQLite file under a temp directory.
//
// Run: node scripts/verify-schema.mjs   (or `npm run verify:schema`)

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const sh = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

let failed = false;
const fail = (msg) => { console.error(`✗ ${msg}`); failed = true; };
const ok = (msg) => console.log(`✓ ${msg}`);

// --- 1. Journal <-> migration file parity -----------------------------
const journal = JSON.parse(readFileSync(join(ROOT, 'drizzle/meta/_journal.json'), 'utf8'));
const entries = journal.entries.slice().sort((a, b) => a.idx - b.idx);
entries.forEach((e, i) => { if (e.idx !== i) fail(`journal entry out of order/gap at position ${i} (idx=${e.idx})`); });

const sqlFiles = readdirSync(join(ROOT, 'drizzle')).filter(f => f.endsWith('.sql')).sort();
const journalTags = new Set(entries.map(e => `${e.tag}.sql`));
for (const f of sqlFiles) if (!journalTags.has(f)) fail(`migration file ${f} has no entry in drizzle/meta/_journal.json`);
for (const e of entries) if (!sqlFiles.includes(`${e.tag}.sql`)) fail(`journal entry "${e.tag}" has no matching drizzle/${e.tag}.sql file`);
if (!failed) ok(`${entries.length} migration(s) match the journal 1:1`);

// --- 2. Replay every migration against a fresh local D1 ----------------
const persistDir = mkdtempSync(join(tmpdir(), 'seminar-desk-schema-check-'));
try {
    for (const e of entries) {
        const file = join('drizzle', `${e.tag}.sql`);
        try {
            sh('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', '--persist-to', persistDir, '--config', 'dist/server/wrangler.json', '--file', file]);
        }
        catch (err) {
            fail(`migration ${e.tag} failed to apply: ${err.stdout || err.message}`);
            break; // later migrations will fail anyway once one is broken
        }
    }
    if (!failed) ok(`all ${entries.length} migrations replayed cleanly against a fresh database`);

    // --- 3. Compare live schema vs snapshot vs db/schema.ts -----------
    const latestEntry = entries[entries.length - 1];
    const snapshotIdx = String(latestEntry.idx).padStart(4, '0');
    const snapshotPath = join(ROOT, `drizzle/meta/${snapshotIdx}_snapshot.json`);
    let snapshot = {};
    try { snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')); }
    catch { fail(`could not read latest snapshot at drizzle/meta/${snapshotIdx}_snapshot.json`); }

    const schemaSource = readFileSync(join(ROOT, 'db/schema.ts'), 'utf8');
    const schemaTables = extractSchemaTables(schemaSource);

    for (const table of Object.keys(schemaTables)) {
        const expected = schemaTables[table]; // from db/schema.ts
        const snapCols = snapshot.tables?.[table] ? Object.keys(snapshot.tables[table].columns) : null;
        let liveCols;
        try {
            const raw = sh('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', '--persist-to', persistDir, '--config', 'dist/server/wrangler.json', '--json', '--command', `PRAGMA table_info(${table})`]);
            const parsed = JSON.parse(raw);
            liveCols = (parsed[0]?.results || []).map(r => r.name);
        }
        catch (err) {
            fail(`could not read live schema for "${table}": ${err.message}`);
            continue;
        }
        if (!liveCols.length) { fail(`table "${table}" does not exist in the replayed database (declared in db/schema.ts)`); continue; }

        const missingLive = expected.filter(c => !liveCols.includes(c));
        const extraLive = liveCols.filter(c => !expected.includes(c));
        if (missingLive.length) fail(`table "${table}": db/schema.ts has column(s) [${missingLive.join(', ')}] that no migration ever created`);
        if (extraLive.length) fail(`table "${table}": the database has column(s) [${extraLive.join(', ')}] that db/schema.ts no longer declares (dead column? or schema.ts is behind)`);

        if (snapCols) {
            const missingSnap = expected.filter(c => !snapCols.includes(c));
            const extraSnap = snapCols.filter(c => !expected.includes(c));
            if (missingSnap.length) fail(`table "${table}": db/schema.ts has column(s) [${missingSnap.join(', ')}] missing from the latest snapshot (drizzle/meta/${snapshotIdx}_snapshot.json) - snapshot needs regenerating`);
            if (extraSnap.length) fail(`table "${table}": the latest snapshot has column(s) [${extraSnap.join(', ')}] that db/schema.ts no longer declares`);
        }

        if (!missingLive.length && !extraLive.length && (!snapCols || (!snapCols.filter(c => !expected.includes(c)).length && !expected.filter(c => !snapCols.includes(c)).length)))
            ok(`table "${table}": db/schema.ts, latest snapshot, and replayed database all agree (${expected.length} columns)`);
    }
}
finally {
    rmSync(persistDir, { recursive: true, force: true });
}

if (failed) {
    console.error('\nSchema check FAILED — see above. Fix before committing/deploying.');
    process.exit(1);
}
console.log('\nSchema check passed.');

// Very small, deliberately naive parser for this codebase's consistent
// `sqliteTable('name', { col: text('col_name')... })` style. It only
// needs to extract DB column names, not understand full TypeScript.
function extractSchemaTables(src) {
    const tables = {};
    const re = /sqliteTable\(\s*'([a-zA-Z0-9_]+)'\s*,\s*\{/g;
    let m;
    while ((m = re.exec(src))) {
        const tableName = m[1];
        const start = m.index + m[0].length - 1; // position of the opening {
        let depth = 0, i = start, end = -1;
        for (; i < src.length; i++) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
        }
        const body = src.slice(start, end + 1);
        const cols = [];
        const colRe = /(?:text|integer)\(\s*'([a-zA-Z0-9_]+)'\s*\)/g;
        let cm;
        while ((cm = colRe.exec(body))) cols.push(cm[1]);
        tables[tableName] = cols;
    }
    return tables;
}
