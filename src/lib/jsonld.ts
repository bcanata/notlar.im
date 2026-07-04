/*
 * JSON-LD (schema.org) builders. Each returns a plain object; Page.astro
 * serializes it into a <script type="application/ld+json"> tag via its
 * `schema` prop. Kept as data-only helpers so the two mirrored post
 * templates (TR + EN) share one source of truth.
 */
import type { CollectionEntry } from 'astro:content';
import type { Lang } from './i18n';

const SITE = 'https://notlar.im';

const PERSON = {
    '@type': 'Person',
    name: 'Buğra Canata',
    url: 'https://canata.dev',
    sameAs: [
        SITE,
        'https://bugracanata.com.tr',
        'https://github.com/bcanata',
        'https://www.youtube.com/@bugra-hoca',
    ],
} as const;

export function person() {
    return { '@context': 'https://schema.org', ...PERSON };
}

export function webSite(lang: Lang) {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'notlar.im',
        url: lang === 'tr' ? `${SITE}/` : `${SITE}/en`,
        inLanguage: lang === 'tr' ? 'tr-TR' : 'en-GB',
        author: PERSON,
        // The standalone search pages accept ?q= (wired in SearchBox.astro),
        // which is what makes this SearchAction honest.
        potentialAction: {
            '@type': 'SearchAction',
            target: {
                '@type': 'EntryPoint',
                urlTemplate:
                    lang === 'tr'
                        ? `${SITE}/ara?q={search_term_string}`
                        : `${SITE}/en/search?q={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
        },
    };
}

export function blogPosting(post: CollectionEntry<'blog'>, url: string) {
    const d = post.data;
    const description = d.description ?? d.excerpt;
    return {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: d.title,
        ...(description ? { description } : {}),
        datePublished: d.date.toISOString(),
        dateModified: (d.updated ?? d.date).toISOString(),
        inLanguage: d.lang === 'tr' ? 'tr-TR' : 'en-GB',
        image: `${SITE}/og/${post.id}.png`,
        ...(d.tags.length > 0 ? { keywords: d.tags.join(', ') } : {}),
        author: PERSON,
        mainEntityOfPage: url,
        url,
    };
}
