/**
 * ISBN lookup + cover fetching for the /admin scanner.
 *
 * Metadata: Open Library "Books API" (jscmd=data) first — it returns resolved
 * author/publisher names in one request — then Google Books as a fallback and
 * to fill in a description (which Open Library usually omits). Covers: the
 * Open Library covers API (`default=false` so a miss 404s instead of serving
 * a 1×1 placeholder). Mirrors the heuristics in scripts/enrich-books.mjs.
 *
 * Runs inside the Worker, so the requests originate from Cloudflare's network
 * (not a home IP) — Google Books, rate-limited in the local importer, is
 * usable here as a fallback.
 */

export interface BookMeta {
    isbn13: string | null;
    isbn10: string | null;
    title: string;
    author: string | null;
    publisher: string | null;
    year: number | null;
    pages: number | null;
    description: string | null;
    /** URL we'll pull cover bytes from when saving (not stored as-is). */
    coverUrl: string | null;
    source: 'openlibrary' | 'google';
}

const UA = 'notlar.im book scanner (+https://notlar.im)';

/** Strip to digits/X and validate as a 10- or 13-char ISBN. */
export function normalizeIsbn(raw: string): string | null {
    const s = (raw || '').replace(/[^0-9Xx]/g, '').toUpperCase();
    if (s.length === 13 && /^\d{13}$/.test(s)) return s;
    if (s.length === 10 && /^\d{9}[\dX]$/.test(s)) return s;
    return null;
}

function isbn10to13(isbn10: string): string | null {
    if (isbn10.length !== 10) return null;
    const core = '978' + isbn10.slice(0, 9);
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
    const check = (10 - (sum % 10)) % 10;
    return core + check;
}

function isbn13to10(isbn13: string): string | null {
    if (isbn13.length !== 13 || !isbn13.startsWith('978')) return null;
    const core = isbn13.slice(3, 12);
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += Number(core[i]) * (10 - i);
    const check = (11 - (sum % 11)) % 11;
    return core + (check === 10 ? 'X' : String(check));
}

/** Given any valid ISBN, return both the 13- and 10-digit forms when derivable. */
export function isbnPair(isbn: string): { isbn13: string | null; isbn10: string | null } {
    if (isbn.length === 13) return { isbn13: isbn, isbn10: isbn13to10(isbn) };
    if (isbn.length === 10) return { isbn13: isbn10to13(isbn), isbn10: isbn };
    return { isbn13: null, isbn10: null };
}

function yearFrom(s: string | undefined | null): number | null {
    const m = (s || '').match(/\d{4}/);
    return m ? Number(m[0]) : null;
}

async function fetchJson(url: string): Promise<any | null> {
    try {
        const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

async function fromOpenLibrary(isbn: string): Promise<BookMeta | null> {
    const data = await fetchJson(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
    );
    const rec = data?.[`ISBN:${isbn}`];
    if (!rec?.title) return null;
    const pair = isbnPair(isbn);
    return {
        ...pair,
        title: String(rec.title).trim(),
        author: Array.isArray(rec.authors) && rec.authors.length
            ? rec.authors.map((a: any) => a.name).filter(Boolean).join(', ')
            : null,
        publisher: Array.isArray(rec.publishers) && rec.publishers.length
            ? rec.publishers[0].name ?? null
            : null,
        year: yearFrom(rec.publish_date),
        pages: typeof rec.number_of_pages === 'number' ? rec.number_of_pages : null,
        description: null, // OL data endpoint rarely carries one; Google fills it
        coverUrl: rec.cover?.large || rec.cover?.medium || null,
        source: 'openlibrary',
    };
}

async function fromGoogle(isbn: string): Promise<BookMeta | null> {
    const data = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const v = data?.items?.[0]?.volumeInfo;
    if (!v?.title) return null;
    const pair = isbnPair(isbn);
    return {
        ...pair,
        title: [v.title, v.subtitle].filter(Boolean).join(': ').trim(),
        author: Array.isArray(v.authors) && v.authors.length ? v.authors.join(', ') : null,
        publisher: v.publisher ?? null,
        year: yearFrom(v.publishedDate),
        pages: typeof v.pageCount === 'number' && v.pageCount > 0 ? v.pageCount : null,
        description: v.description?.trim() || null,
        coverUrl: null, // prefer the Open Library cover endpoint
        source: 'google',
    };
}

/**
 * Look up a book by ISBN. Tries Open Library, falls back to Google Books, and
 * (when OL won) borrows Google's description / missing fields. Returns null if
 * neither source knows the ISBN.
 */
export async function lookupByIsbn(isbn: string): Promise<BookMeta | null> {
    const [ol, google] = await Promise.all([fromOpenLibrary(isbn), fromGoogle(isbn)]);
    if (!ol) return google;
    if (google) {
        ol.description ??= google.description;
        ol.author ??= google.author;
        ol.publisher ??= google.publisher;
        ol.year ??= google.year;
        ol.pages ??= google.pages;
    }
    return ol;
}

/** Fetch cover image bytes for an ISBN from Open Library. Null when missing. */
export async function fetchCoverBytes(
    isbn: string,
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
    try {
        const res = await fetch(
            `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
            { headers: { 'user-agent': UA }, redirect: 'follow' },
        );
        if (!res.ok) return null;
        const bytes = await res.arrayBuffer();
        // OL sometimes returns a tiny 1×1 even with default=false; guard on size.
        if (bytes.byteLength < 1500) return null;
        return { bytes, contentType: res.headers.get('content-type') || 'image/jpeg' };
    } catch {
        return null;
    }
}
