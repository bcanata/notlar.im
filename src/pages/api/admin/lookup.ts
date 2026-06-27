export const prerender = false;

import type { APIRoute } from 'astro';
import { normalizeIsbn, lookupByIsbn } from '../../../lib/openlibrary';
import { findBookByIsbn } from '../../../lib/books';

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
}

/**
 * GET /api/admin/lookup?isbn=...
 * Normalises the scanned barcode, reports whether the book is already in the
 * library, and returns Open Library / Google Books metadata for confirmation.
 * (Auth enforced by src/middleware.ts.)
 */
export const GET: APIRoute = async ({ url, locals }) => {
    const isbn = normalizeIsbn(url.searchParams.get('isbn') ?? '');
    if (!isbn) return json({ error: 'invalid_isbn' }, 400);

    const db = locals.runtime.env.DB;
    const existing = await findBookByIsbn(db, isbn);
    const meta = await lookupByIsbn(isbn);

    return json({
        isbn,
        found: !!meta,
        exists: !!existing,
        existingSlug: existing?.slug ?? null,
        meta,
    });
};
