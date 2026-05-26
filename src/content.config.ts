import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/*
 * Two collections. Same shape, different intent:
 *   - blog: dated, chronological writing.
 *   - notlar: evergreen notes that may be updated forever.
 *
 * `slug` is intentionally part of the schema so the importer can pin URLs
 * from the old Docusaurus site verbatim and we don't break inbound links.
 * Astro derives the URL slug from the filename, so to preserve a specific
 * slug we name the file the slug itself (importer does this) and the
 * `slug` frontmatter field becomes the source of truth in the rendered
 * page metadata.
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

const notlar = defineCollection({
    loader: glob({
        pattern: '**/*.{md,mdx}',
        base: './src/content/notlar',
        generateId: preserveFilenameId,
    }),
    schema: z.object(sharedFields),
});

export const collections = { blog, notlar };
