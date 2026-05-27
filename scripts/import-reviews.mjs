#!/usr/bin/env node
/**
 * Convert a Google Takeout Maps reviews export into src/data/reviews.json.
 *
 * Source: a Google Takeout "Maps (your places)/Reviews.json" file (GeoJSON
 * FeatureCollection). There is no official Google API for reviews authored
 * by a user, so this is a manual snapshot — re-run it after a fresh Takeout
 * to refresh the data.
 *
 * Each feature's `properties` carries: date, five_star_rating_published,
 * google_maps_url, location: { name, address, country_code },
 * review_text_published. The point geometry gives [lng, lat], which we keep
 * for the map. Field names vary by export vintage, so reads are defensive.
 *
 * We keep only reviews that have both readable text and an identifiable
 * place (the ones worth showing), sorted newest-first.
 *
 * Run: pnpm import-reviews "<path>/Maps (your places)/Reviews.json"
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'src', 'data', 'reviews.json');

function fail(msg) {
    console.error(`error: ${msg}`);
    process.exit(1);
}

const inputPath = process.argv[2];
if (!inputPath) {
    fail('usage: pnpm import-reviews "<path>/Maps (your places)/Reviews.json"');
}

let data;
try {
    data = JSON.parse(readFileSync(inputPath, 'utf8'));
} catch {
    fail(`cannot read/parse input: ${inputPath}`);
}

const features = Array.isArray(data?.features) ? data.features : [];
if (!features.length) fail('no features found — is this a Maps reviews export?');

const pick = (obj, ...keys) => {
    for (const k of keys) {
        if (obj && obj[k] != null && obj[k] !== '') return obj[k];
    }
    return undefined;
};

const toISODate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

let skippedNoText = 0;
let skippedNoPlace = 0;

const reviews = [];
for (const feature of features) {
    const p = feature?.properties ?? {};
    const text = pick(p, 'review_text_published', 'review_text');
    const loc = p.location ?? {};
    const place = pick(loc, 'name');

    if (!text) { skippedNoText++; continue; }
    if (!place) { skippedNoPlace++; continue; }

    const rating = Number(pick(p, 'five_star_rating_published', 'star_rating') ?? 0);
    const coords = feature?.geometry?.coordinates;
    const [lng, lat] = Array.isArray(coords) ? coords : [null, null];

    reviews.push({
        place,
        address: pick(loc, 'address') ?? null,
        rating: Number.isFinite(rating) ? rating : 0,
        text: String(text).trim(),
        date: toISODate(pick(p, 'date')),
        url: pick(p, 'google_maps_url', 'google_maps_uri') ?? null,
        // Keep coordinates for the map. Drop (0,0) sentinels (no location).
        lat: typeof lat === 'number' && (lat !== 0 || lng !== 0) ? lat : null,
        lng: typeof lng === 'number' && (lat !== 0 || lng !== 0) ? lng : null,
    });
}

// Newest first; reviews without a date sink to the bottom.
reviews.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

const payload = {
    generatedAt: new Date().toISOString(),
    count: reviews.length,
    withCoords: reviews.filter((r) => r.lat != null && r.lng != null).length,
    reviews,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');

console.log(`\n✓ Wrote ${OUT}`);
console.log(`  reviews: ${reviews.length} (with coords: ${payload.withCoords})`);
console.log(`  skipped: ${skippedNoText} rating-only, ${skippedNoPlace} without a place name`);
