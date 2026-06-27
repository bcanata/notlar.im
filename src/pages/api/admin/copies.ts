export const prerender = false;

import type { APIRoute } from 'astro';
import {
    addCopy,
    updateCopy,
    deleteCopy,
    bookIdForSlug,
    bookSlugForCopy,
    getBookForAdmin,
    listCopiesByBookcase,
    type CopyEdit,
} from '../../../lib/books';

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8' },
    });
}
const str = (v: unknown): string | null => {
    const s = (v ?? '').toString().trim();
    return s || null;
};
const idOf = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
};

function copyEditFrom(body: Record<string, unknown>): CopyEdit {
    const edit: CopyEdit = {};
    if ('bookcase' in body) edit.bookcase = str(body.bookcase);
    if ('shelf' in body) edit.shelf = str(body.shelf);
    if ('lent_to' in body) edit.lent_to = str(body.lent_to);
    if ('lent_at' in body) edit.lent_at = str(body.lent_at);
    if ('lent_note' in body) edit.lent_note = str(body.lent_note);
    if ('copy_note' in body) edit.copy_note = str(body.copy_note);
    return edit;
}

/** GET /api/admin/copies?bookcase=... — every copy in a bookcase (browse a shelf, incl. back row). */
export const GET: APIRoute = async ({ url, locals }) => {
    const bookcase = url.searchParams.get('bookcase');
    if (!bookcase) return json({ error: 'bookcase_required' }, 400);
    const copies = await listCopiesByBookcase(locals.runtime.env.DB, bookcase);
    return json({ ok: true, bookcase, copies });
};

/** POST /api/admin/copies — add a copy to an existing book. Body: { slug, ...copy }. */
export const POST: APIRoute = async ({ request, locals }) => {
    const env = locals.runtime.env;
    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return json({ error: 'bad_json' }, 400);
    }
    const slug = str(body.slug);
    if (!slug) return json({ error: 'slug_required' }, 400);
    const bookId = await bookIdForSlug(env.DB, slug);
    if (!bookId) return json({ error: 'not_found' }, 404);

    await addCopy(env.DB, bookId, copyEditFrom(body));
    return json({ ok: true, book: await getBookForAdmin(env.DB, slug) }, 201);
};

/** PUT /api/admin/copies — update one copy. Body: { id, ...copy }. Empty borrower returns it. */
export const PUT: APIRoute = async ({ request, locals }) => {
    const env = locals.runtime.env;
    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return json({ error: 'bad_json' }, 400);
    }
    const id = idOf(body.id);
    if (!id) return json({ error: 'id_required' }, 400);

    const slug = await bookSlugForCopy(env.DB, id);
    if (!slug) return json({ error: 'not_found' }, 404);
    await updateCopy(env.DB, id, copyEditFrom(body));
    return json({ ok: true, book: await getBookForAdmin(env.DB, slug) });
};

/** DELETE /api/admin/copies?id=... — remove one physical copy. */
export const DELETE: APIRoute = async ({ url, locals }) => {
    const env = locals.runtime.env;
    const id = idOf(url.searchParams.get('id'));
    if (!id) return json({ error: 'id_required' }, 400);

    const slug = await bookSlugForCopy(env.DB, id);
    if (!slug) return json({ error: 'not_found' }, 404);
    await deleteCopy(env.DB, id);
    return json({ ok: true, book: await getBookForAdmin(env.DB, slug) });
};
