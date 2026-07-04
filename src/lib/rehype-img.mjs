/*
 * Adds `loading="lazy"` + `decoding="async"` to content images, skipping the
 * FIRST image in each document — it may be the LCP element, and lazy-loading
 * the LCP image actively hurts paint time. Dimensions are not touched: most
 * content images are remote hotlinks whose size isn't known at build time
 * (localizing the at-risk ones is a separate content task).
 *
 * Plain .mjs (not .ts): astro.config.mjs imports it at config-load time,
 * before any TS pipeline exists.
 */
import { visit } from 'unist-util-visit';

export default function rehypeLazyImages() {
    return (tree) => {
        let first = true;
        visit(tree, 'element', (node) => {
            if (node.tagName !== 'img') return;
            if (first) {
                first = false;
                return;
            }
            node.properties.loading ??= 'lazy';
            node.properties.decoding ??= 'async';
        });
    };
}
