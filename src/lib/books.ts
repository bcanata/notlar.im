/**
 * Book data helpers. The catalogue lives in Cloudflare D1 as a bibliographic
 * record per book (`books`) plus one row per physical copy (`copies`, see
 * db/schema.sql). Reading status + rating are about the work and live on
 * `books`; physical location + loan + per-copy notes live on `copies`.
 *
 * Stable URL slug per book (the work):
 *   ISBN-13  →  ISBN-10  →  title-slug   (with a numeric suffix on collision)
 *
 * VISIBILITY: two read shapes. The PUBLIC shape (Book/BookWithSlug, via
 * listBooks/getBookBySlug) carries only copy *location* + a per-copy `isLent`
 * flag — never the borrower name or private notes. The ADMIN shape (AdminBook,
 * via getBookForAdmin) carries everything for the edit form.
 */
import { tagSlug } from './tags';

/** Public per-copy info: location + loan flag (no borrower name). */
export interface PublicCopy {
    bookcase: string | null;
    shelf: string | null;
    isLent: boolean;
}

/** Public, renderable book (the work) + its copies. */
export interface Book {
    title: string;
    author: string | null;
    isbn13: string | null;
    isbn10: string | null;
    publisher: string | null;
    year: number | null;
    pages: number | null;
    description: string | null;
    status: string | null; // reading status: okunmadi | okunuyor | okundu
    rating: number | null;
    cover: string | null;
    copies: PublicCopy[];
    isLent: boolean; // any copy currently on loan (name withheld)
}

export interface BookWithSlug extends Book {
    slug: string;
    /** Lowercased, diacritic-folded haystack (title + author + publisher + locations). */
    search: string;
}

/** Admin per-copy info: everything incl. the private loan + notes. */
export interface AdminCopy {
    id: number;
    bookcase: string | null;
    shelf: string | null;
    lent_to: string | null;
    lent_at: string | null;
    lent_note: string | null;
    copy_note: string | null;
    added: string | null;
    isLent: boolean;
}

export interface AdminBook {
    slug: string;
    title: string;
    author: string | null;
    isbn13: string | null;
    isbn10: string | null;
    publisher: string | null;
    year: number | null;
    pages: number | null;
    description: string | null;
    status: string | null;
    rating: number | null;
    cover: string | null;
    copies: AdminCopy[];
}

interface BookRow {
    id: number;
    slug: string;
    title: string;
    author: string | null;
    isbn13: string | null;
    isbn10: string | null;
    publisher: string | null;
    year: number | null;
    pages: number | null;
    description: string | null;
    status: string | null;
    rating: number | null;
    cover_key: string | null;
}

interface PublicCopyRow {
    book_id: number;
    bookcase: string | null;
    shelf: string | null;
    isLent: number;
}

interface AdminCopyRow {
    id: number;
    bookcase: string | null;
    shelf: string | null;
    lent_to: string | null;
    lent_at: string | null;
    lent_note: string | null;
    copy_note: string | null;
    added: string | null;
}

/** Fold Turkish letters to ASCII + lowercase, for accent-insensitive search. */
export function foldTr(s: string): string {
    return s
        .toLocaleLowerCase('tr')
        .replace(/ç/g, 'c')
        .replace(/ğ/g, 'g')
        .replace(/ı/g, 'i')
        .replace(/i̇/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ş/g, 's')
        .replace(/ü/g, 'u');
}

const BOOK_COLS =
    'id, slug, title, author, isbn13, isbn10, publisher, year, pages, description, status, rating, cover_key';

function buildBook(row: BookRow, copies: PublicCopy[]): BookWithSlug {
    const locations = copies.flatMap((c) => [c.bookcase, c.shelf]);
    return {
        title: row.title,
        author: row.author ?? null,
        isbn13: row.isbn13 ?? null,
        isbn10: row.isbn10 ?? null,
        publisher: row.publisher ?? null,
        year: row.year ?? null,
        pages: row.pages ?? null,
        description: row.description ?? null,
        status: row.status ?? null,
        rating: row.rating ?? null,
        cover: row.cover_key ? `/covers/${row.cover_key}` : null,
        copies,
        isLent: copies.some((c) => c.isLent),
        slug: row.slug,
        search: foldTr([row.title, row.author, row.publisher, ...locations].filter(Boolean).join(' ')),
    };
}

/** All books, covered first then by title, each with its public copies. */
export async function listBooks(db: D1Database): Promise<BookWithSlug[]> {
    const [{ results: bookRows }, { results: copyRows }] = await db.batch<any>([
        db.prepare(
            `SELECT ${BOOK_COLS} FROM books ORDER BY (cover_key IS NULL), title COLLATE NOCASE`,
        ),
        db.prepare(
            `SELECT book_id, bookcase, shelf, (lent_to IS NOT NULL) AS isLent FROM copies`,
        ),
    ]);

    const byBook = new Map<number, PublicCopy[]>();
    for (const c of (copyRows ?? []) as PublicCopyRow[]) {
        const list = byBook.get(c.book_id) ?? [];
        list.push({ bookcase: c.bookcase ?? null, shelf: c.shelf ?? null, isLent: !!c.isLent });
        byBook.set(c.book_id, list);
    }
    return ((bookRows ?? []) as BookRow[]).map((r) => buildBook(r, byBook.get(r.id) ?? []));
}

/** A single book (public shape) by slug, or null. */
export async function getBookBySlug(db: D1Database, slug: string): Promise<BookWithSlug | null> {
    const row = await db.prepare(`SELECT ${BOOK_COLS} FROM books WHERE slug = ?`).bind(slug).first<BookRow>();
    if (!row) return null;
    const { results } = await db
        .prepare(`SELECT bookcase, shelf, (lent_to IS NOT NULL) AS isLent FROM copies WHERE book_id = ?`)
        .bind(row.id)
        .all<{ bookcase: string | null; shelf: string | null; isLent: number }>();
    const copies: PublicCopy[] = (results ?? []).map((c) => ({
        bookcase: c.bookcase ?? null,
        shelf: c.shelf ?? null,
        isLent: !!c.isLent,
    }));
    return buildBook(row, copies);
}

/** Full record incl. private per-copy loan + notes — admin edit form only. */
export async function getBookForAdmin(db: D1Database, slug: string): Promise<AdminBook | null> {
    const row = await db.prepare(`SELECT ${BOOK_COLS} FROM books WHERE slug = ?`).bind(slug).first<BookRow>();
    if (!row) return null;
    const { results } = await db
        .prepare(
            `SELECT id, bookcase, shelf, lent_to, lent_at, lent_note, copy_note, added
             FROM copies WHERE book_id = ? ORDER BY id`,
        )
        .bind(row.id)
        .all<AdminCopyRow>();
    const copies: AdminCopy[] = (results ?? []).map((c) => ({
        id: c.id,
        bookcase: c.bookcase ?? null,
        shelf: c.shelf ?? null,
        lent_to: c.lent_to ?? null,
        lent_at: c.lent_at ?? null,
        lent_note: c.lent_note ?? null,
        copy_note: c.copy_note ?? null,
        added: c.added ?? null,
        isLent: !!c.lent_to,
    }));
    return {
        slug: row.slug,
        title: row.title,
        author: row.author ?? null,
        isbn13: row.isbn13 ?? null,
        isbn10: row.isbn10 ?? null,
        publisher: row.publisher ?? null,
        year: row.year ?? null,
        pages: row.pages ?? null,
        description: row.description ?? null,
        status: row.status ?? null,
        rating: row.rating ?? null,
        cover: row.cover_key ? `/covers/${row.cover_key}` : null,
        copies,
    };
}

/** Find a book row by either ISBN (for the "add another copy" scan flow). */
export async function findBookByIsbn(
    db: D1Database,
    isbn: string,
): Promise<{ id: number; slug: string; title: string } | null> {
    return db
        .prepare(`SELECT id, slug, title FROM books WHERE isbn13 = ?1 OR isbn10 = ?1 LIMIT 1`)
        .bind(isbn)
        .first<{ id: number; slug: string; title: string }>();
}

export async function bookCount(db: D1Database): Promise<number> {
    const row = await db.prepare('SELECT COUNT(*) AS n FROM books').first<{ n: number }>();
    return row?.n ?? 0;
}

/** Distinct bookcase names (for the admin <datalist> + browse-by-location). */
export async function listBookcases(db: D1Database): Promise<string[]> {
    const { results } = await db
        .prepare(`SELECT DISTINCT bookcase FROM copies WHERE bookcase IS NOT NULL ORDER BY bookcase`)
        .all<{ bookcase: string }>();
    return (results ?? []).map((r) => r.bookcase);
}

/** One copy located in a bookcase (admin browse-by-location — shows the back row). */
export interface LocatedCopy {
    id: number;
    slug: string;
    title: string;
    shelf: string | null;
    copy_note: string | null;
    lent_to: string | null;
}

/** Every copy in a bookcase, ordered by shelf then title — incl. the hidden back row. */
export async function listCopiesByBookcase(db: D1Database, bookcase: string): Promise<LocatedCopy[]> {
    const { results } = await db
        .prepare(
            `SELECT c.id, b.slug, b.title, c.shelf, c.copy_note, c.lent_to
             FROM copies c JOIN books b ON b.id = c.book_id
             WHERE c.bookcase = ?
             ORDER BY c.shelf COLLATE NOCASE, b.title COLLATE NOCASE`,
        )
        .bind(bookcase)
        .all<LocatedCopy>();
    return results ?? [];
}

function baseSlug(b: Pick<Book, 'isbn13' | 'isbn10' | 'title'>): string {
    if (b.isbn13) return b.isbn13;
    if (b.isbn10) return b.isbn10;
    return tagSlug(b.title) || 'kitap';
}

export async function uniqueSlug(
    db: D1Database,
    b: Pick<Book, 'isbn13' | 'isbn10' | 'title'>,
): Promise<string> {
    const base = baseSlug(b);
    let slug = base;
    for (let i = 2; ; i++) {
        const hit = await db.prepare('SELECT 1 FROM books WHERE slug = ?').bind(slug).first();
        if (!hit) return slug;
        slug = `${base}-${i}`;
    }
}

const today = () => new Date().toISOString().slice(0, 10);

export interface NewBook {
    title: string;
    author?: string | null;
    isbn13?: string | null;
    isbn10?: string | null;
    publisher?: string | null;
    year?: number | null;
    pages?: number | null;
    description?: string | null;
    status?: string | null;
    coverKey?: string | null;
    // First physical copy:
    bookcase?: string | null;
    shelf?: string | null;
    copyNote?: string | null;
}

/** Insert a scanned book (the work) + its first copy. Returns the public book. */
export async function insertBook(db: D1Database, b: NewBook): Promise<BookWithSlug> {
    const slug = await uniqueSlug(db, {
        isbn13: b.isbn13 ?? null,
        isbn10: b.isbn10 ?? null,
        title: b.title,
    });
    const added = today();
    const res = await db
        .prepare(
            `INSERT INTO books
               (slug, title, author, isbn13, isbn10, publisher, year, pages, description, status, added, cover_key)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
            slug, b.title, b.author ?? null, b.isbn13 ?? null, b.isbn10 ?? null,
            b.publisher ?? null, b.year ?? null, b.pages ?? null, b.description ?? null,
            b.status ?? 'okunmadi', added, b.coverKey ?? null,
        )
        .run();
    const bookId = Number(res.meta.last_row_id);
    await addCopy(db, bookId, { bookcase: b.bookcase ?? null, shelf: b.shelf ?? null, copy_note: b.copyNote ?? null });
    const created = await getBookBySlug(db, slug);
    if (!created) throw new Error('insert succeeded but row not found');
    return created;
}

/** Editable work-level fields. */
export interface BookEdit {
    title?: string | null;
    author?: string | null;
    publisher?: string | null;
    year?: number | null;
    pages?: number | null;
    description?: string | null;
    status?: string | null;
    rating?: number | null;
}

const BOOK_EDITABLE: (keyof BookEdit)[] = [
    'title', 'author', 'publisher', 'year', 'pages', 'description', 'status', 'rating',
];

/** Partial update of a book's work fields by slug. Returns the admin record. */
export async function updateBook(db: D1Database, slug: string, edit: BookEdit): Promise<AdminBook | null> {
    const sets: string[] = [];
    const values: (string | number | null)[] = [];
    for (const key of BOOK_EDITABLE) {
        if (key in edit) {
            sets.push(`${key} = ?`);
            const v = edit[key];
            values.push(v === undefined || v === '' ? null : v);
        }
    }
    if (sets.length) {
        sets.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`);
        values.push(slug);
        const res = await db.prepare(`UPDATE books SET ${sets.join(', ')} WHERE slug = ?`).bind(...values).run();
        if (!res.meta.changes) return null;
    }
    return getBookForAdmin(db, slug);
}

export interface CopyEdit {
    bookcase?: string | null;
    shelf?: string | null;
    lent_to?: string | null;
    lent_at?: string | null;
    lent_note?: string | null;
    copy_note?: string | null;
}

const COPY_EDITABLE: (keyof CopyEdit)[] = [
    'bookcase', 'shelf', 'lent_to', 'lent_at', 'lent_note', 'copy_note',
];

/** Add a physical copy to a book. Returns the new copy id. */
export async function addCopy(db: D1Database, bookId: number, copy: CopyEdit): Promise<number> {
    const res = await db
        .prepare(
            `INSERT INTO copies (book_id, bookcase, shelf, lent_to, lent_at, lent_note, copy_note, added)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
            bookId, copy.bookcase ?? null, copy.shelf ?? null, copy.lent_to ?? null,
            copy.lent_at ?? null, copy.lent_note ?? null, copy.copy_note ?? null, today(),
        )
        .run();
    return Number(res.meta.last_row_id);
}

/** Update one copy. Clearing the borrower (lent_to) also clears the loan date/note. */
export async function updateCopy(db: D1Database, copyId: number, edit: CopyEdit): Promise<boolean> {
    const fields = { ...edit };
    if ('lent_to' in fields && !fields.lent_to) {
        fields.lent_to = null;
        fields.lent_at = null;
        fields.lent_note = null;
    }
    const sets: string[] = [];
    const values: (string | number | null)[] = [];
    for (const key of COPY_EDITABLE) {
        if (key in fields) {
            sets.push(`${key} = ?`);
            const v = fields[key];
            values.push(v === undefined || v === '' ? null : v);
        }
    }
    if (!sets.length) return true;
    sets.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`);
    values.push(copyId);
    const res = await db.prepare(`UPDATE copies SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
    return !!res.meta.changes;
}

export async function deleteCopy(db: D1Database, copyId: number): Promise<boolean> {
    const res = await db.prepare('DELETE FROM copies WHERE id = ?').bind(copyId).run();
    return !!res.meta.changes;
}

/** The slug of the book owning a copy (so the API can return the refreshed book). */
export async function bookSlugForCopy(db: D1Database, copyId: number): Promise<string | null> {
    const row = await db
        .prepare('SELECT b.slug AS slug FROM copies c JOIN books b ON b.id = c.book_id WHERE c.id = ?')
        .bind(copyId)
        .first<{ slug: string }>();
    return row?.slug ?? null;
}

/** Resolve a slug to its book id (for adding copies). */
export async function bookIdForSlug(db: D1Database, slug: string): Promise<number | null> {
    const row = await db.prepare('SELECT id FROM books WHERE slug = ?').bind(slug).first<{ id: number }>();
    return row?.id ?? null;
}

/** Delete a book, all its copies, and report its cover_key for R2 cleanup. */
export async function deleteBookBySlug(
    db: D1Database,
    slug: string,
): Promise<string | null | undefined> {
    const row = await db
        .prepare('SELECT id, cover_key FROM books WHERE slug = ?')
        .bind(slug)
        .first<{ id: number; cover_key: string | null }>();
    if (!row) return undefined;
    await db.batch([
        db.prepare('DELETE FROM copies WHERE book_id = ?').bind(row.id),
        db.prepare('DELETE FROM books WHERE id = ?').bind(row.id),
    ]);
    return row.cover_key;
}
