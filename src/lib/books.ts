/**
 * Book data helpers. Loads the enriched catalogue (src/data/books.json,
 * produced by scripts/enrich-books.mjs) and assigns each book a stable,
 * unique URL slug:
 *
 *   ISBN-13  →  ISBN-10  →  title-slug   (with a numeric suffix on collision)
 *
 * Slugs feed both the grid card links and the detail-page getStaticPaths,
 * so the two always agree.
 */
import booksData from '../data/books.json';
import { tagSlug } from './tags';

export interface Book {
    title: string;
    author: string | null;
    isbn13: string | null;
    isbn10: string | null;
    publisher: string | null;
    year: number | null;
    pages: number | null;
    description: string | null;
    status: string | null;
    added: string | null;
    cover: string | null;
}

export interface BookWithSlug extends Book {
    slug: string;
    /** Lowercased, diacritic-folded haystack for client-side search. */
    search: string;
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

function rawSlug(b: Book): string {
    if (b.isbn13) return b.isbn13;
    if (b.isbn10) return b.isbn10;
    return tagSlug(b.title) || 'kitap';
}

let cache: BookWithSlug[] | null = null;

export function allBooks(): BookWithSlug[] {
    if (cache) return cache;
    const seen = new Map<string, number>();
    cache = (booksData.books as Book[]).map((b) => {
        let slug = rawSlug(b);
        const n = seen.get(slug) ?? 0;
        seen.set(slug, n + 1);
        if (n > 0) slug = `${slug}-${n + 1}`;
        const search = foldTr(
            [b.title, b.author, b.publisher].filter(Boolean).join(' '),
        );
        return { ...b, slug, search };
    });
    return cache;
}

export function bookCount(): number {
    return (booksData as { count: number }).count;
}
