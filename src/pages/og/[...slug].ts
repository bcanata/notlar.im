/**
 * Per-post Open Graph image generator. Uses astro-og-canvas to render a
 * 1200×630 PNG per blog post at build time. URL: /og/<slug>.png.
 *
 * The slug must match the blog entry's `id` (filename without extension).
 * Astro 5's `getCollection` returns entries with ids preserved verbatim by
 * our `generateId` override in content.config.ts, so capitalised slugs
 * like `Quansheng-UV-K5` resolve correctly.
 */

import { getCollection } from 'astro:content';
import { OGImageRoute } from 'astro-og-canvas';
import { t } from '../../lib/i18n';

const posts = await getCollection('blog', (p) => !p.data.draft);

const pages = {
    ...Object.fromEntries(
        posts.map((p) => [
            p.id,
            {
                title: p.data.title,
                description: p.data.description ?? p.data.excerpt ?? '',
                lang: p.data.lang,
                date: p.data.date.toISOString(),
            },
        ]),
    ),
    // Site-wide fallback card: Page.astro points non-article pages at /og/_default.png.
    _default: {
        title: 'notlar.im',
        byline: t('tr', 'site_tagline'),
    },
};

export const { getStaticPaths, GET } = await OGImageRoute({
    pages,
    param: 'slug',
    getImageOptions: (_path, page) => ({
        title: page.title,
        description: page.byline ?? 'notlar.im',
        bgGradient: [
            [255, 255, 255],
            [245, 245, 245],
        ],
        border: {
            color: [220, 220, 220],
            width: 2,
            side: 'inline-start',
        },
        padding: 80,
        fonts: ['./src/fonts/Roboto-Regular.ttf', './src/fonts/Roboto-Bold.ttf'],
        font: {
            title: {
                size: 64,
                families: ['Roboto'],
                weight: 'Bold',
                color: [17, 17, 17],
                lineHeight: 1.15,
            },
            description: {
                size: 28,
                families: ['Roboto'],
                color: [120, 120, 120],
                lineHeight: 1.3,
            },
        },
        format: 'PNG',
        quality: 90,
    }),
});
