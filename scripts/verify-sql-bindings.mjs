#!/usr/bin/env node
// Static check for the other common raw-SQL mistake in this codebase:
// a db.prepare('...?...?...') string whose number of `?` placeholders
// doesn't match the number of arguments passed to the following
// .bind(...) call. That class of bug either throws at runtime or,
// worse, silently binds the wrong value to the wrong column.
//
// This is a heuristic text scanner, not a real SQL/JS parser - it's
// meant to catch obvious drift, not replace review of a genuinely
// unusual query. It only understands this codebase's existing style
// (single string or template-literal argument to .prepare(), followed
// directly by .bind(...)).
//
// Run: node scripts/verify-sql-bindings.mjs  (or `npm run verify:sql`)

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const FILES = ['lib/server.ts', 'app/api/auth/signin/route.ts', 'app/api/whatsapp/webhook/route.ts'];

let failed = false;
let checked = 0;

for (const relPath of FILES) {
    const src = readFileSync(join(ROOT, relPath), 'utf8');
    let i = 0;
    while ((i = src.indexOf('.prepare(', i)) !== -1) {
        const openParen = i + '.prepare('.length;
        const quoteChar = src[openParen];
        if (quoteChar !== '`' && quoteChar !== "'" && quoteChar !== '"') { i = openParen; continue; }
        // Find the matching unescaped closing quote.
        let j = openParen + 1;
        while (j < src.length) {
            if (src[j] === '\\') { j += 2; continue; }
            if (src[j] === quoteChar) break;
            j++;
        }
        const sql = src.slice(openParen + 1, j);
        const placeholderCount = (sql.match(/\?/g) || []).length;
        const lineNo = src.slice(0, i).split('\n').length;

        // Expect `)` to close .prepare(, then optionally `.bind(...)`.
        let k = j + 1;
        while (k < src.length && /[\s)]/.test(src[k])) k++;
        let argCount = 0;
        if (src.startsWith('.bind(', k)) {
            const bindOpen = k + '.bind('.length;
            let depth = 1, m = bindOpen, inStr = null, sawArg = false, argDepth0Comma = 0;
            while (m < src.length && depth > 0) {
                const c = src[m];
                if (inStr) {
                    if (c === '\\') { m += 2; continue; }
                    if (c === inStr) inStr = null;
                    m++; continue;
                }
                if (c === '"' || c === "'" || c === '`') { inStr = c; sawArg = true; m++; continue; }
                if (c === '(' || c === '[' || c === '{') { depth++; sawArg = true; m++; continue; }
                if (c === ')' || c === ']' || c === '}') { depth--; m++; continue; }
                if (c === ',' && depth === 1) { argDepth0Comma++; m++; continue; }
                if (!/\s/.test(c)) sawArg = true;
                m++;
            }
            const inner = src.slice(bindOpen, m - 1).trim();
            argCount = inner.length === 0 ? 0 : argDepth0Comma + 1;
            void sawArg;
        }

        checked++;
        if (placeholderCount !== argCount) {
            failed = true;
            console.error(`✗ ${relPath}:${lineNo} — ${placeholderCount} "?" placeholder(s) but ${argCount} .bind() argument(s)`);
            console.error(`  ${sql.slice(0, 160)}${sql.length > 160 ? '…' : ''}`);
        }
        i = j + 1;
    }
}

if (failed) {
    console.error(`\nSQL binding check FAILED (checked ${checked} prepared statements).`);
    process.exit(1);
}
console.log(`✓ All ${checked} prepared statements have matching "?" placeholders and .bind() arguments.`);
