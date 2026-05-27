/**
 * Review data helpers. Loads the snapshot (src/data/reviews.json, produced by
 * scripts/import-reviews.mjs) and assigns each review a stable id plus a
 * diacritic-folded search haystack. The id links a list card to its map
 * marker; the haystack powers the list's instant client-side filter.
 */
import reviewsData from '../data/reviews.json';
import { foldTr } from './books';

export interface Review {
    place: string;
    address: string | null;
    rating: number;
    text: string;
    date: string | null;
    url: string | null;
    lat: number | null;
    lng: number | null;
}

export interface ReviewWithMeta extends Review {
    /** Stable id (`r0`, `r1`, …) used to link list cards to map markers. */
    id: string;
    /** Lowercased, diacritic-folded haystack for client-side search. */
    search: string;
}

let cache: ReviewWithMeta[] | null = null;

export function allReviews(): ReviewWithMeta[] {
    if (cache) return cache;
    cache = (reviewsData.reviews as Review[]).map((r, i) => ({
        ...r,
        id: `r${i}`,
        search: foldTr([r.place, r.address, r.text].filter(Boolean).join(' ')),
    }));
    return cache;
}

export function reviewCount(): number {
    return (reviewsData as { count: number }).count;
}

/** Reviews carrying coordinates — the subset the map can plot. */
export function mappableReviews(): ReviewWithMeta[] {
    return allReviews().filter((r) => r.lat != null && r.lng != null);
}
