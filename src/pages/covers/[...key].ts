export const prerender = false; // streams cover bytes from the R2 COVERS bucket

import type { APIRoute } from 'astro';

/**
 * Serve a book cover from R2. Covers are immutable (keyed by ISBN), so they
 * carry a one-year immutable cache header and Cloudflare's edge caches them —
 * the Worker only runs on the first miss per PoP. Replaces the old static
 * public/covers/*.jpg files.
 */
export const GET: APIRoute = async ({ params, locals }) => {
    const key = params.key;
    if (!key) return new Response('Not found', { status: 404 });

    const obj = await locals.runtime.env.COVERS.get(key);
    if (!obj) return new Response('Not found', { status: 404 });

    // Buffer the bytes rather than streaming obj.body — covers are small, and
    // the R2 body stream doesn't round-trip cleanly through the dev server.
    const bytes = await obj.arrayBuffer();
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('etag', obj.httpEtag);
    headers.set('cache-control', 'public, max-age=31536000, immutable');
    if (!headers.has('content-type')) headers.set('content-type', 'image/jpeg');

    return new Response(bytes, { headers });
};
