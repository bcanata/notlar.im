#!/usr/bin/env node
/**
 * Enrich the LibraryThing CSV export into src/data/books.json + download
 * cover images into public/covers/.
 *
 * Source: src/data/library.csv  (LibraryThing export)
 * Covers: Open Library covers API — https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg
 *         (`?default=false` → 404 when no cover, so misses are detectable).
 *         Google Books was unusable from this environment (returns 0 results
 *         even for popular titles — rate-limited without an API key).
 *
 * Resumable: if public/covers/{isbn}.jpg already exists it's not re-fetched,
 * so re-running fills gaps after Open Library rate-limit windows reset.
 *
 * Run: pnpm enrich-books
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CSV = join(ROOT, 'src', 'data', 'library.csv');
const OUT = join(ROOT, 'src', 'data', 'books.json');
const COVERS = join(ROOT, 'public', 'covers');

mkdirSync(COVERS, { recursive: true });

/* --- minimal CSV parser (quoted fields, embedded commas/newlines) --- */
function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else inQuotes = false;
            } else field += c;
        } else if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c === '\r') { /* skip */ }
        else field += c;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
}

const raw = readFileSync(CSV, 'utf8');
const table = parseCSV(raw);
const header = table[0];
const idx = (name) => header.indexOf(name);
const I = {
    title: idx('title'),
    creators: idx('creators'),
    collection: idx('collection'),
    isbn13: idx('ean_isbn13'),
    isbn10: idx('upc_isbn10'),
    description: idx('description'),
    publisher: idx('publisher'),
    publish_date: idx('publish_date'),
    length: idx('length'),
    status: idx('status'),
    added: idx('added'),
};

// Some CSV rows carry bookseller-injected boilerplate in the description
// field (e.g. "WELCOME TO SELLER PAYITAHT'S LIBRARY!!!"). Strip these banners;
// if nothing real is left, drop the description entirely.
function cleanDescription(raw) {
    let s = (raw || '').trim();
    if (!s) return null;
    s = s
        .replace(/welcome to seller[^!]*!{1,}/gi, '')
        .replace(/^\s*[-–—•*]+\s*/, '')
        .trim();
    return s || null;
}

const books = table
    .slice(1)
    .filter((r) => r[I.title]?.trim())
    .map((r) => {
        const isbn13 = (r[I.isbn13] || '').trim();
        const isbn10 = (r[I.isbn10] || '').trim();
        const year = (r[I.publish_date] || '').slice(0, 4) || null;
        return {
            title: r[I.title].trim(),
            author: (r[I.creators] || '').trim() || null,
            isbn13: isbn13 || null,
            isbn10: isbn10 || null,
            publisher: (r[I.publisher] || '').trim() || null,
            year: /^\d{4}$/.test(year) ? Number(year) : null,
            pages: Number(r[I.length]) || null,
            description: cleanDescription(r[I.description]),
            status: (r[I.status] || '').trim() || null,
            added: (r[I.added] || '').trim() || null,
            cover: null, // filled below
        };
    });

console.log(`Parsed ${books.length} books from CSV.`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Download a cover for one ISBN from Open Library. Returns true on success.
 * `default=false` makes the endpoint 404 when no cover exists.
 */
async function fetchCover(isbn, destPath) {
    const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
    const res = await fetch(url, {
        headers: { 'user-agent': 'notlar.im books enrichment (+https://notlar.im)' },
        redirect: 'follow',
    });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    // Open Library sometimes returns a tiny 1x1 even with default=false; guard.
    if (buf.length < 1500) return false;
    writeFileSync(destPath, buf);
    return true;
}

let downloaded = 0, cached = 0, missed = 0, rateLimited = 0;

for (const b of books) {
    const key = b.isbn13 || b.isbn10;
    if (!key) { missed++; continue; }
    const dest = join(COVERS, `${key}.jpg`);

    if (existsSync(dest) && statSync(dest).size > 1500) {
        b.cover = `/covers/${key}.jpg`;
        cached++;
        continue;
    }

    let ok = false;
    for (const isbn of [b.isbn13, b.isbn10].filter(Boolean)) {
        try {
            ok = await fetchCover(isbn, dest);
        } catch (e) {
            if (String(e).includes('403') || String(e).includes('429')) {
                rateLimited++;
                await sleep(5000); // back off on rate limit
            }
            ok = false;
        }
        if (ok) break;
        await sleep(400); // be polite between ISBN variants
    }

    if (ok) { b.cover = `/covers/${key}.jpg`; downloaded++; }
    else missed++;

    await sleep(700); // ~1.4 req/s — under Open Library's 100/5min cover cap
    if ((downloaded + missed) % 25 === 0) {
        console.log(`  …${downloaded + cached + missed}/${books.length} (covers: ${downloaded + cached})`);
    }
}

const payload = {
    generatedAt: new Date().toISOString(),
    count: books.length,
    withCover: books.filter((b) => b.cover).length,
    books,
};
writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');

console.log(`\n✓ Wrote ${OUT}`);
console.log(`  books: ${books.length}`);
console.log(`  covers downloaded this run: ${downloaded}, cached: ${cached}, missing: ${missed}`);
if (rateLimited) console.log(`  rate-limit backoffs: ${rateLimited} (re-run to fill gaps)`);
