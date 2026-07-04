import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { renderPostHtml } from '../lib/rss-content';

export async function GET(context: APIContext) {
    const posts = await getCollection(
        'blog',
        (p) => !p.data.draft && p.data.lang === 'tr',
    );

    const items = await Promise.all(
        posts.map(async (p) => ({
            title: p.data.title,
            pubDate: p.data.updated ?? p.data.date,
            description: p.data.description ?? p.data.excerpt ?? '',
            link: `/blog/${p.id}`,
            categories: p.data.tags,
            content: await renderPostHtml(p),
        })),
    );
    items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

    return rss({
        title: 'notlar.im',
        description:
            "Buğra Canata — yazılım, amatör telsiz, bisiklet ve dünya üzerine kısa notlar.",
        site: context.site ?? 'https://notlar.im',
        items,
        customData: '<language>tr-TR</language>',
    });
}
