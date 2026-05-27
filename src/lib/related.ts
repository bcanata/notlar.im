/**
 * Related-posts helper.
 *
 * Ranks other published posts in the same language by tag overlap with the
 * current post. Ties broken by recency. Returns up to `n` posts.
 *
 * Caller is responsible for passing the full collection — this function is
 * pure and does no I/O so it can be inlined into any getStaticPaths route.
 */

import type { CollectionEntry } from 'astro:content';

export function relatedPosts(
    current: CollectionEntry<'blog'>,
    all: CollectionEntry<'blog'>[],
    n = 3,
): CollectionEntry<'blog'>[] {
    const currentTags = new Set(current.data.tags);
    if (currentTags.size === 0) return [];

    return all
        .filter(
            (p) =>
                p.id !== current.id &&
                p.data.lang === current.data.lang &&
                !p.data.draft,
        )
        .map((p) => ({
            post: p,
            overlap: p.data.tags.filter((t) => currentTags.has(t)).length,
        }))
        .filter((x) => x.overlap > 0)
        .sort(
            (a, b) =>
                b.overlap - a.overlap ||
                b.post.data.date.getTime() - a.post.data.date.getTime(),
        )
        .slice(0, n)
        .map((x) => x.post);
}

/**
 * Adjacent-post helper. Returns the post immediately newer (prev) and
 * immediately older (next) than `current` from a chronologically sorted
 * (newest first) array of same-language published posts.
 */
export function adjacentPosts(
    current: CollectionEntry<'blog'>,
    sorted: CollectionEntry<'blog'>[],
): {
    newer: CollectionEntry<'blog'> | null;
    older: CollectionEntry<'blog'> | null;
} {
    const i = sorted.findIndex((p) => p.id === current.id);
    if (i === -1) return { newer: null, older: null };
    return {
        newer: i > 0 ? sorted[i - 1] : null,
        older: i < sorted.length - 1 ? sorted[i + 1] : null,
    };
}
