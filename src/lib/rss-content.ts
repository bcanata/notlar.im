/*
 * Full-content rendering for the RSS feeds. Both endpoints are prerendered,
 * so this runs in Node at build time — the Workers runtime never sees the
 * (experimental) Container API or sanitize-html.
 *
 * Fallback note: if a future Astro upgrade breaks the Container API here,
 * the cheap replacement is `markdown-it` over `post.body` — no published
 * post uses MDX components, so the output is equivalent (minus Shiki).
 */
import type { CollectionEntry } from 'astro:content';
import { render } from 'astro:content';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { loadRenderers } from 'astro:container';
import { getContainerRenderer as getMDXRenderer } from '@astrojs/mdx';
import sanitizeHtml from 'sanitize-html';

let containerPromise: Promise<AstroContainer> | null = null;
function getContainer(): Promise<AstroContainer> {
    containerPromise ??= loadRenderers([getMDXRenderer()]).then((renderers) =>
        AstroContainer.create({ renderers }),
    );
    return containerPromise;
}

export async function renderPostHtml(post: CollectionEntry<'blog'>): Promise<string> {
    const container = await getContainer();
    const { Content } = await render(post);
    const raw = await container.renderToString(Content);
    return sanitizeHtml(raw, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'figure', 'figcaption', 'iframe']),
        allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            img: ['src', 'alt', 'width', 'height'],
            iframe: ['src', 'allowfullscreen'],
        },
        // Drop the empty heading-anchor <a>s (rehype-autolink-headings) —
        // they're pure chrome and read as noise in feed readers. The class
        // check keeps legitimate empty links (e.g. an <a> wrapping an <img>)
        // intact.
        exclusiveFilter: (frame) =>
            frame.tag === 'a' && (frame.attribs.class ?? '').includes('anchor-link'),
    });
}
