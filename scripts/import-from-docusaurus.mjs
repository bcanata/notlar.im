#!/usr/bin/env node
/**
 * One-shot importer: Docusaurus → Astro Content Collections.
 *
 * Reads ../notlar.im-docusaurus-backup/blog/2021/*.mdx and notlar/*.mdx,
 * normalises frontmatter to the new schema, and writes:
 *
 *   src/content/blog/<slug>.mdx
 *   src/content/notlar/<slug>.mdx
 *
 * Preserves the original slug/filename so old inbound links from Google
 * (cross-checked against ~/Downloads/notlar/Pages.csv) keep resolving.
 *
 * Skips:
 *   - notlar/anasayfa.mdx  → was the Docusaurus docs index, not a real note.
 *
 * Special handling:
 *   - <!--truncate--> markers from Docusaurus excerpts: stripped.
 *   - "⚠️ Taslak" title → marked draft: true.
 *   - Tags wrapped in inline-flow YAML like `[yer imleri]` are passed through
 *     as a single tag because gray-matter parses that as a string scalar.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import matter from 'gray-matter';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OLD = join(ROOT, '..', 'notlar.im-docusaurus-backup');
const OUT_BLOG = join(ROOT, 'src', 'content', 'blog');
const OUT_NOTES = join(ROOT, 'src', 'content', 'notlar');

mkdirSync(OUT_BLOG, { recursive: true });
mkdirSync(OUT_NOTES, { recursive: true });

/** Coerce gray-matter's "anything" tag value into a clean string[]. */
function normaliseTags(raw) {
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw.map((s) => String(s).trim()).filter(Boolean);
    if (typeof raw === 'string') return [raw.trim()];
    return [];
}

/** Strip Docusaurus-specific syntax from the markdown body. */
function rewriteBody(body) {
    return body
        .replace(/<!--truncate-->\s*/g, '')
        .trimStart();
}

/**
 * Last-modified time of a file inside the old Docusaurus repo, taken from
 * git so we get the real authoring date rather than tar/clone mtime. Falls
 * back to a fixed historical date if git can't see the file.
 */
function gitDate(path, mode /* 'created' | 'modified' */) {
    try {
        const args = ['-C', OLD, 'log', mode === 'created' ? '--diff-filter=A' : '-1', '--format=%aI', '--', path.replace(OLD + '/', '')];
        const out = execFileSync('git', args, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
        if (out.length === 0) return null;
        return mode === 'created' ? out[out.length - 1] : out[0];
    } catch {
        return null;
    }
}

function importBlog() {
    const dir = join(OLD, 'blog', '2021');
    const files = readdirSync(dir).filter((f) => f.endsWith('.mdx'));
    const written = [];
    for (const f of files) {
        const path = join(dir, f);
        const raw = readFileSync(path, 'utf8');
        const parsed = matter(raw);
        const fm = parsed.data;

        const title = fm.title;
        if (!title) {
            console.warn(`  ! skipping ${f}: no title`);
            continue;
        }

        const slug = (fm.slug || basename(f, extname(f)).replace(/^\d{4}-\d{2}-\d{2}-/, '')).trim();

        // date_published is sometimes the Unix epoch (1970-01-01), which the
        // old Docusaurus theme used as a sentinel for "unpublished / draft."
        // In that case fall through to the explicit `date` field, then to the
        // YYYY-MM-DD- prefix on the filename, then git, then a sane default.
        const filenameDate = (f.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1];
        const candidates = [
            fm.date_published,
            fm.date,
            filenameDate,
            gitDate(path, 'created'),
            '2021-04-01',
        ];
        let date = null;
        for (const c of candidates) {
            if (!c) continue;
            const d = new Date(c);
            if (!isNaN(d.getTime()) && d.getFullYear() > 1970) {
                date = d;
                break;
            }
        }
        if (!date) date = new Date('2021-04-01');

        const updated = fm.date_updated ? new Date(fm.date_updated) : null;
        const tags = normaliseTags(fm.tags);
        const excerpt = fm.excerpt ? String(fm.excerpt).trim() : undefined;
        const draft = fm.draft === true;

        const newFm = {
            title,
            date: date.toISOString(),
            ...(updated && !isNaN(updated.getTime()) && updated.getTime() !== date.getTime()
                ? { updated: updated.toISOString() }
                : {}),
            tags,
            ...(excerpt ? { description: excerpt } : {}),
            ...(draft ? { draft: true } : {}),
        };

        const body = rewriteBody(parsed.content);
        const out = matter.stringify(body, newFm);

        // Some old files use .mdx.mdx double extension by accident — collapse.
        const cleanSlug = slug.replace(/\.mdxx?$/, '');
        const outPath = join(OUT_BLOG, `${cleanSlug}.mdx`);
        writeFileSync(outPath, out);
        written.push({ from: f, to: `blog/${cleanSlug}.mdx`, tags, date: newFm.date });
    }
    return written;
}

function importNotes() {
    const dir = join(OLD, 'notlar');
    const files = readdirSync(dir).filter(
        (f) => f.endsWith('.mdx') && f !== 'anasayfa.mdx',
    );
    const written = [];
    for (const f of files) {
        const path = join(dir, f);
        const raw = readFileSync(path, 'utf8');
        const parsed = matter(raw);
        const fm = parsed.data;

        let title = String(fm.title || '').trim();
        let draft = false;
        if (/^⚠️/.test(title)) {
            draft = true;
            title = title.replace(/^⚠️\s*/, '').trim();
        }
        if (!title) {
            console.warn(`  ! skipping ${f}: no title`);
            continue;
        }

        // Notes have no explicit date in old frontmatter — derive from git.
        const created = gitDate(join('notlar', f), 'created') || '2024-01-01';
        const modified = gitDate(join('notlar', f), 'modified') || created;

        const tags = normaliseTags(fm.tags);
        const description = fm.description ? String(fm.description).trim() : undefined;

        const newFm = {
            title,
            date: new Date(created).toISOString(),
            ...(modified !== created ? { updated: new Date(modified).toISOString() } : {}),
            tags,
            ...(description ? { description } : {}),
            ...(draft ? { draft: true } : {}),
        };

        const body = rewriteBody(parsed.content);
        const out = matter.stringify(body, newFm);

        // Preserve the exact filename casing so slug == old URL slug.
        const outPath = join(OUT_NOTES, f);
        writeFileSync(outPath, out);
        written.push({ from: f, to: `notlar/${f}`, tags, date: newFm.date, draft });
    }
    return written;
}

const blog = importBlog();
const notes = importNotes();

const allTags = new Set();
for (const item of [...blog, ...notes]) {
    for (const t of item.tags) allTags.add(t);
}

console.log(`\n✓ Imported ${blog.length} blog posts and ${notes.length} notes`);
console.log(`  Unique tags: ${[...allTags].sort().join(', ')}`);
console.log('\nBlog:');
for (const b of blog) console.log(`  ${b.to.padEnd(70)} ${b.date.slice(0, 10)}`);
console.log('\nNotes:');
for (const n of notes) console.log(`  ${n.to.padEnd(70)} ${n.date.slice(0, 10)}${n.draft ? ' [draft]' : ''}`);
