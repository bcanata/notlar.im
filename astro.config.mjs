// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Canonical site URL. Used by sitemap + RSS to emit absolute links.
const SITE = 'https://notlar.im';

export default defineConfig({
    site: SITE,
    integrations: [mdx(), sitemap()],
    vite: {
        plugins: [tailwindcss()],
    },
    markdown: {
        shikiConfig: {
            theme: 'github-light',
            wrap: true,
        },
    },
    trailingSlash: 'never',
    build: {
        // Output flat .html files so Cloudflare Workers Static Assets serves
        // /blog/foo -> /blog/foo/index.html with html_handling: auto-trailing-slash.
        format: 'directory',
    },
});
