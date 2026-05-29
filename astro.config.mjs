// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

// Canonical site URL. Used by sitemap + RSS to emit absolute links.
const SITE = 'https://notlar.im';

export default defineConfig({
    site: SITE,
    i18n: {
        defaultLocale: 'tr',
        locales: ['tr', 'en'],
        routing: {
            // Turkish lives at the root (/blog/foo). English mirrors at /en/.
            // The `notlar` collection was folded into `blog`; the redirects
            // below keep the old /notlar/* URLs alive for inbound links.
            prefixDefaultLocale: false,
        },
    },
    /*
     * 301-redirect the old /notlar/ URL space into /blog/. Astro emits
     * meta-refresh + Refresh-header pages for static-output redirects.
     */
    redirects: {
        '/notlar/Quansheng-UV-K5': '/blog/Quansheng-UV-K5',
        '/notlar/bisiklet-uygulamalari': '/blog/bisiklet-uygulamalari',
        '/en/notlar/quansheng-uv-k5-en': '/en/blog/quansheng-uv-k5-en',
        '/en/notlar/cycling-apps': '/en/blog/cycling-apps',
        // The 2021 "bisiklet-android-ve-iphone-uygulamalari" post was merged
        // into "bisiklet-uygulamalari" (and its EN counterpart into cycling-apps).
        '/blog/bisiklet-android-ve-iphone-uygulamalari': '/blog/bisiklet-uygulamalari',
        '/notlar/bisiklet-android-ve-iphone-uygulamalari': '/blog/bisiklet-uygulamalari',
        '/en/blog/cycling-mobile-apps-en': '/en/blog/cycling-apps',
        '/en/notlar/cycling-mobile-apps-en': '/en/blog/cycling-apps',
    },
    integrations: [mdx(), sitemap()],
    vite: {
        plugins: [tailwindcss()],
    },
    markdown: {
        /*
         * Shiki dual themes — the light/dark variants are selected by a CSS
         * media query (and overridden by [data-theme] when the user toggles
         * the theme manually in src/components/ThemeToggle.astro).
         */
        shikiConfig: {
            themes: {
                light: 'github-light',
                dark: 'github-dark',
            },
            wrap: true,
        },
        /*
         * Auto-generate `id` attributes on headings (rehype-slug) so post
         * subsections can be deep-linked, then append a `#` anchor button
         * after each heading (rehype-autolink-headings). The button's class
         * is styled in src/styles/global.css to fade in on heading hover.
         */
        rehypePlugins: [
            rehypeSlug,
            [
                rehypeAutolinkHeadings,
                {
                    behavior: 'append',
                    // No DOM text content inside the anchor — the visible `#`
                    // glyph is rendered via CSS `::after` in global.css so it
                    // never enters textContent. This keeps sub-result titles
                    // in the Pagefind search index clean.
                    properties: {
                        className: ['anchor-link'],
                        ariaHidden: 'true',
                        tabIndex: -1,
                        'data-pagefind-ignore': '',
                    },
                },
            ],
        ],
    },
    trailingSlash: 'never',
    build: {
        // Output flat .html files so Cloudflare Workers Static Assets serves
        // /blog/foo -> /blog/foo/index.html with html_handling: auto-trailing-slash.
        format: 'directory',
    },
});
