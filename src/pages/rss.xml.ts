import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
    const blog = await getCollection('blog', (p) => !p.data.draft);
    const notlar = await getCollection('notlar', (n) => !n.data.draft);

    const items = [
        ...blog.map((p) => ({
            title: p.data.title,
            pubDate: p.data.date,
            description: p.data.description ?? p.data.excerpt ?? '',
            link: `/blog/${p.id}`,
            categories: p.data.tags,
        })),
        ...notlar.map((n) => ({
            title: n.data.title,
            pubDate: n.data.updated ?? n.data.date,
            description: n.data.description ?? n.data.excerpt ?? '',
            link: `/notlar/${n.id}`,
            categories: n.data.tags,
        })),
    ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

    return rss({
        title: 'notlar.im',
        description:
            "Buğra Canata — yazılım, amatör telsiz, bisiklet ve dünya üzerine kısa notlar.",
        site: context.site ?? 'https://notlar.im',
        items,
        customData: '<language>tr-TR</language>',
    });
}
