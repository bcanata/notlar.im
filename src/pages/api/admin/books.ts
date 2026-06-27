export const prerender = false;

import type { APIRoute } from 'astro';
import { normalizeIsbn, isbnPair, fetchCoverBytes } from '../../../lib/openlibrary';
import {
    insertBook,
    deleteBookBySlug,
    findBookByIsbn,
    getBookForAdmin,
    updateBook,
    addCopy,
    type BookEdit,
} from '../../../lib/books';

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
}
const num = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
};
const str = (v: unknown): string | null => {
    const s = (v ?? '').toString().trim();
    return s || null;
};
const rating = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
};

/** GET /api/admin/books?slug=... — full record (work + copies) for the edit form. */
export const GET: APIRoute = async ({ url, locals }) => {
    const slug = url.searchParams.get('slug');
    if (!slug) return json({ error: 'slug_required' }, 400);
    const book = await getBookForAdmin(locals.runtime.env.DB, slug);
    if (!book) return json({ error: 'not_found' }, 404);
    return json({ ok: true, book });
};

/**
 * POST /api/admin/books — add a scanned book. If the ISBN is already in the
 * library, this adds **another physical copy** to that book (at the given
 * location) instead of rejecting it. Otherwise it creates the book + its first
 * copy, pulling the cover into R2.
 * Body: { isbn?, title, author?, publisher?, year?, pages?, description?, status?, bookcase?, shelf?, copy_note? }
 */
export const POST: APIRoute = async ({ request, locals }) => {
    const env = locals.runtime.env;
    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return json({ error: 'bad_json' }, 400);
    }

    const seed = body.isbn ? normalizeIsbn(String(body.isbn)) : null;

    // Known ISBN → add another copy to the existing book.
    if (seed) {
        const existing = await findBookByIsbn(env.DB, seed);
        if (existing) {
            await addCopy(env.DB, existing.id, {
                bookcase: str(body.bookcase),
                shelf: str(body.shelf),
                copy_note: str(body.copy_note),
            });
            const book = await getBookForAdmin(env.DB, existing.slug);
            return json({ ok: true, addedCopy: true, book });
        }
    }

    const title = str(body.title);
    if (!title) return json({ error: 'title_required' }, 400);

    const { isbn13, isbn10 } = seed ? isbnPair(seed) : { isbn13: null, isbn10: null };

    // New book → pull the cover into R2 (keyed by ISBN).
    let coverKey: string | null = null;
    const coverIsbn = isbn13 || isbn10;
    if (coverIsbn) {
        const cover = await fetchCoverBytes(coverIsbn);
        if (cover) {
            coverKey = `${coverIsbn}.jpg`;
            await env.COVERS.put(coverKey, cover.bytes, { httpMetadata: { contentType: cover.contentType } });
        }
    }

    const inserted = await insertBook(env.DB, {
        title,
        author: str(body.author),
        isbn13,
        isbn10,
        publisher: str(body.publisher),
        year: num(body.year),
        pages: num(body.pages),
        description: str(body.description),
        status: str(body.status) ?? 'okunmadi',
        bookcase: str(body.bookcase),
        shelf: str(body.shelf),
        copyNote: str(body.copy_note),
        coverKey,
    });
    const book = await getBookForAdmin(env.DB, inserted.slug);
    return json({ ok: true, addedCopy: false, book }, 201);
};

/**
 * PUT /api/admin/books — edit a book's work-level fields (title, author,
 * publisher, year, pages, description, reading status, rating). Per-copy data
 * is edited via /api/admin/copies. Body: { slug, ...fields }.
 */
export const PUT: APIRoute = async ({ request, locals }) => {
    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return json({ error: 'bad_json' }, 400);
    }
    const slug = str(body.slug);
    if (!slug) return json({ error: 'slug_required' }, 400);

    const edit: BookEdit = {};
    if ('title' in body) { const v = str(body.title); if (v) edit.title = v; } // never null
    if ('author' in body) edit.author = str(body.author);
    if ('publisher' in body) edit.publisher = str(body.publisher);
    if ('year' in body) edit.year = num(body.year);
    if ('pages' in body) edit.pages = num(body.pages);
    if ('description' in body) edit.description = str(body.description);
    if ('status' in body) edit.status = str(body.status);
    if ('rating' in body) edit.rating = rating(body.rating);

    const book = await updateBook(locals.runtime.env.DB, slug, edit);
    if (!book) return json({ error: 'not_found' }, 404);
    return json({ ok: true, book });
};

/** DELETE /api/admin/books?slug=... — remove a book, all its copies, and its cover. */
export const DELETE: APIRoute = async ({ url, locals }) => {
    const env = locals.runtime.env;
    const slug = url.searchParams.get('slug');
    if (!slug) return json({ error: 'slug_required' }, 400);

    const coverKey = await deleteBookBySlug(env.DB, slug);
    if (coverKey === undefined) return json({ error: 'not_found' }, 404);
    if (coverKey) await env.COVERS.delete(coverKey).catch(() => {});
    return json({ ok: true });
};
