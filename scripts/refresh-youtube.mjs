#!/usr/bin/env node
/**
 * Refresh the cached YouTube video list at src/data/youtube.json.
 *
 * Why a cache: YouTube's public RSS feed only returns the most recent 15
 * uploads — not enough for an "all videos" listing. The Data API would
 * solve it but needs an API key. yt-dlp scrapes the full channel without
 * one but is heavy to depend on at deploy time. Compromise: run yt-dlp
 * locally, dump the metadata to a committed JSON file, build reads from
 * the file. To refresh after new uploads:
 *
 *   pnpm refresh-yt && git add src/data/youtube.json && git commit -m "yt"
 *
 * Requires: yt-dlp on $PATH (brew install yt-dlp).
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT_PATH = join(ROOT, 'src', 'data', 'youtube.json');

const CHANNEL_URL = 'https://www.youtube.com/@bugra-hoca/videos';

console.log(`Fetching channel metadata: ${CHANNEL_URL}`);

/*
 * yt-dlp's `--flat-playlist` is fast but doesn't include per-video upload
 * timestamps, so the listing would be undated. Drop flat mode and use the
 * `--print` template to extract exactly the fields we want — this fetches
 * each video's metadata page (~1s per video) but still skips the actual
 * media. For ~30 videos that's a 30-60s refresh, acceptable for a manual
 * one-shot script.
 */
const FIELDS = ['id', 'title', 'webpage_url', 'timestamp', 'upload_date', 'duration', 'thumbnail'];
const SEP = ''; // ASCII unit separator — safe inside titles.
const TEMPLATE = FIELDS.map((f) => `%(${f})s`).join(SEP);

/*
 * yt-dlp exits non-zero if *any* video in the listing is unavailable
 * (deleted, private, members-only, etc) even with `--ignore-errors`. We
 * still want the successfully-extracted lines from stdout, so catch the
 * throw and read e.stdout. Only treat truly-empty stdout as a hard fail.
 */
let raw;
try {
    raw = execFileSync(
        'yt-dlp',
        [
            '--skip-download',
            '--no-warnings',
            '--ignore-errors',
            '--print',
            TEMPLATE,
            CHANNEL_URL,
        ],
        { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 },
    );
} catch (e) {
    raw = typeof e.stdout === 'string' ? e.stdout : '';
    if (!raw) {
        console.error('yt-dlp failed and produced no stdout:', e.message);
        process.exit(1);
    }
    console.warn(`yt-dlp had non-fatal errors (some videos unavailable); continuing with partial output.`);
}
const lines = raw.split('\n').filter((l) => l.includes(SEP));

const videos = lines
    .map((line) => {
        const parts = line.split(SEP);
        const rec = Object.fromEntries(FIELDS.map((f, i) => [f, parts[i]]));
        if (!rec.id || !rec.title) return null;
        const ts = Number(rec.timestamp);
        return {
            id: rec.id,
            title: rec.title,
            url: rec.webpage_url || `https://www.youtube.com/watch?v=${rec.id}`,
            timestamp: Number.isFinite(ts) && ts > 0 ? ts : null,
            uploadDate:
                rec.upload_date && rec.upload_date !== 'NA'
                    ? `${rec.upload_date.slice(0, 4)}-${rec.upload_date.slice(4, 6)}-${rec.upload_date.slice(6, 8)}`
                    : null,
            duration: Number.isFinite(Number(rec.duration)) ? Number(rec.duration) : null,
            thumbnail:
                rec.thumbnail && rec.thumbnail !== 'NA'
                    ? rec.thumbnail
                    : `https://i.ytimg.com/vi/${rec.id}/hqdefault.jpg`,
        };
    })
    .filter((v) => v !== null)
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

const payload = {
    channel: {
        title: 'Buğra Hoca',
        handle: '@bugra-hoca',
        url: 'https://www.youtube.com/@bugra-hoca',
    },
    fetchedAt: new Date().toISOString(),
    count: videos.length,
    videos,
};

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + '\n');

console.log(`✓ Wrote ${videos.length} videos to ${OUT_PATH}`);
console.log(`  Fetched at: ${payload.fetchedAt}`);
