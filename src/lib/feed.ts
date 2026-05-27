/**
 * Shared feed-building helper. Returns the blog feed for a given language,
 * filtered by draft + lang, sorted reverse-chronological. All posts live
 * under /blog/<slug> (TR) or /en/blog/<slug> (EN). The /notlar/* URL space
 * was retired; old URLs are 301-redirected at the routing layer.
 */

import { getCollection } from 'astro:content';
import type { Lang } from './i18n';

export interface FeedEntry {
    slug: string;
    href: string;
    title: string;
    description?: string;
    date: Date;
    tags: string[];
    ai: boolean;
}

export async function buildFeed(lang: Lang): Promise<FeedEntry[]> {
    const posts = (await getCollection('blog')).filter(
        (p) => !p.data.draft && p.data.lang === lang,
    );
    return posts
        .map((p) => ({
            slug: p.id,
            href: lang === 'tr' ? `/blog/${p.id}` : `/en/blog/${p.id}`,
            title: p.data.title,
            description: p.data.description ?? p.data.excerpt,
            // Notes that lived in the old `notlar` collection used `updated`
            // as the primary date. We preserve that behaviour by preferring
            // `updated` when both fields exist.
            date: p.data.updated ?? p.data.date,
            tags: p.data.tags,
            ai: p.data.ai,
        }))
        .sort((a, b) => b.date.getTime() - a.date.getTime());
}
