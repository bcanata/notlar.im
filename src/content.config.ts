import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/*
 * Single `blog` content collection — formerly split into blog + notlar, then
 * merged into one URL namespace at /blog/<slug>. Old /notlar/<slug> URLs are
 * 301-redirected via astro.config.mjs.
 *
 * URL slugs are taken verbatim from the filename (preserved by the
 * `generateId` override below). Some posts use SEO-sensitive casing like
 * `Quansheng-UV-K5.mdx` and `TA2KB-Rle-Listesi.mdx`; do not rename them.
 */
const sharedFields = {
    title: z.string(),
    description: z.string().optional(),
    excerpt: z.string().optional(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    canonical: z.string().url().optional(),
    cover: z.string().optional(),
    /*
     * Set `ai: true` on any post that was produced or substantially assisted
     * by AI. Renders as an explicit "YZ" badge near the title (separate from
     * tags) so readers can see the provenance at a glance.
     */
    ai: z.boolean().default(false),
    /*
     * Language of this post's body. Default is 'tr' so the existing TR
     * archive doesn't need touching.
     */
    lang: z.enum(['tr', 'en']).default('tr'),
    /*
     * Shared identifier across language versions of the same post.
     * Example: an Ender 3 post might have two files —
     *   ender-3-klipper-gecisi.md   (lang: tr, translationKey: ender3-klipper)
     *   ender-3-klipper-migration.md (lang: en, translationKey: ender3-klipper)
     * The language toggle uses this to jump between counterparts.
     */
    translationKey: z.string().optional(),
};

/*
 * Preserve the source filename verbatim as the entry id — case included.
 * Without this, Astro lowercases everything which would 404 inbound links
 * like /notlar/TA2KB-Rle-Listesi/ (our top GSC-traffic URL).
 */
function preserveFilenameId({ entry }: { entry: string }): string {
    return entry.replace(/\.(md|mdx)$/, '');
}

const blog = defineCollection({
    loader: glob({
        pattern: '**/*.{md,mdx}',
        base: './src/content/blog',
        generateId: preserveFilenameId,
    }),
    schema: z.object(sharedFields),
});

export const collections = { blog };
