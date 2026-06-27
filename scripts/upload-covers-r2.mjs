#!/usr/bin/env node
/**
 * One-shot: upload the existing in-repo covers (public/covers/*.jpg) into the
 * R2 bucket `notlar-covers`, keyed by filename. After the move to D1, covers
 * are served from R2 via the /covers/<key> route, so public/covers/ is no
 * longer shipped with the site (and can be deleted once this has run).
 *
 * Shells out to wrangler once per file (no bulk-put in the CLI). Idempotent:
 * re-running just overwrites identical objects.
 *
 *   node scripts/upload-covers-r2.mjs            # → remote R2 (production)
 *   node scripts/upload-covers-r2.mjs --local    # → local dev R2 (.wrangler)
 */
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DIR = join(ROOT, 'public', 'covers');
const BUCKET = 'notlar-covers';
const LOCAL = process.argv.includes('--local');
const scope = LOCAL ? '--local' : '--remote';
// Use the project-local wrangler (bare `wrangler` isn't always on PATH).
const WRANGLER = join(ROOT, 'node_modules', '.bin', 'wrangler');

let files;
try {
    files = readdirSync(DIR).filter((f) => f.endsWith('.jpg'));
} catch {
    console.error(`No ${DIR} directory — nothing to upload.`);
    process.exit(0);
}

console.log(`Uploading ${files.length} covers → ${BUCKET} (${scope})…`);
let ok = 0, fail = 0;
for (const [i, f] of files.entries()) {
    const res = spawnSync(
        WRANGLER,
        ['r2', 'object', 'put', `${BUCKET}/${f}`, '--file', join(DIR, f), scope],
        { stdio: ['ignore', 'ignore', 'pipe'], env: process.env },
    );
    if (res.status === 0) ok++;
    else { fail++; process.stderr.write(`\n  FAIL ${f}: ${res.stderr?.toString().trim().split('\n').pop()}\n`); }
    if ((i + 1) % 10 === 0 || i === files.length - 1) {
        process.stdout.write(`\r  ${i + 1}/${files.length} (ok ${ok}, fail ${fail})`);
    }
}
console.log(`\n✓ Done — uploaded ${ok}, failed ${fail}.`);
if (fail) process.exit(1);
