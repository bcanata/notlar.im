# CLAUDE.md

This file tells Claude Code (claude.ai/code) how to work in this repo.

## What this repo is

`notlar.im` — Buğra Canata's Turkish personal blog. Yazılım, amatör telsiz, bisiklet, ve karşıma çıkan başka şeyler üzerine kısa notlar.

This is a **fresh Astro 5 rebuild** of an earlier Docusaurus site at the same domain. The old Docusaurus codebase is preserved at `~/Developer/Kisisel/notlar.im-docusaurus-backup/` (untouched, no remote pushes). The visual direction is borrowed from [tuhat.net](https://tuhat.net) — single-column reverse-chronological feed, system fonts, hashtag-style tags, no excerpts on the homepage. Tailwind v4 + Astro Content Collections + plain MDX. Deployed on Cloudflare Workers Static Assets, same account as `canata.dev`.

## Commands

- `pnpm install` — one-time setup.
- `pnpm dev` — Astro dev server at `http://localhost:4321`.
- `pnpm build` — runs `astro check` (type-checks frontmatter + content) then `astro build` into `./dist`.
- `pnpm preview` — serves the built site for a final look.
- `pnpm deploy` — build + `wrangler deploy`.
- `pnpm deploy:dry` — build + `wrangler deploy --dry-run` (use before any production deploy).
- `pnpm import` — re-runs the one-shot Docusaurus → Astro importer. Idempotent. Reads from `../notlar.im-docusaurus-backup/`.

## Architecture

- **`src/content/blog/`** — long-form, dated posts. One `.md` or `.mdx` per file. Slug = filename (case-preserved). Frontmatter: `title`, `date`, `updated?`, `tags`, `description?`, `draft?`.
- **`src/content/notlar/`** — evergreen, frequently-updated notes. Same schema as `blog/`. The note's "date" is its first-published date; use `updated` for the last revision.
- **`src/content.config.ts`** — Zod schema for both collections. Uses `glob` loader's `generateId` to preserve filename casing verbatim — critical for SEO continuity (e.g. `/notlar/TA2KB-Rle-Listesi/` is the top GSC traffic URL and must stay capitalised).
- **`src/pages/`** — Astro page routes:
  - `index.astro` — combined feed, blog + notlar, reverse-chronological.
  - `blog/index.astro` — blog-only feed.
  - `notlar/index.astro` — notes-only feed.
  - `blog/[...slug].astro` and `notlar/[...slug].astro` — single-entry templates. Render via `astro:content` `render()`.
  - `t/[tag].astro` — tag pages. Tag slug is computed via `src/lib/tags.ts` `tagSlug()` (Turkish-aware: ğ→g, ş→s, ı→i, etc.).
  - `hakkimda.astro` — about page. **The URL is intentionally `/hakkimda/` not `/hakkinda/`** because the old site indexed `/hakkimda/` and we're preserving that SEO.
  - `rss.xml.ts` — combined RSS for blog + notlar.
- **`src/layouts/Page.astro`** — single top-level layout with nav, footer, OG/Twitter meta, RSS link. All pages use it.
- **`src/styles/global.css`** — Tailwind v4 entry + `.prose` class for rendered markdown body. Bespoke not `@tailwindcss/typography`; keeps the rules small and editable.
- **`scripts/import-from-docusaurus.mjs`** — one-shot importer. Documented inline. Run via `pnpm import`. Handles Docusaurus quirks (`<!--truncate-->`, epoch-as-draft-sentinel dates, `⚠️ Taslak` titles).
- **`wrangler.jsonc`** — Cloudflare Workers Static Assets config. `workers_dev: true` initially; custom-domain routes for `notlar.im` + `www.notlar.im` are commented out until we're ready to flip DNS off the old host.

## Conventions

- **Turkish UI**, Turkish content. English only inside code/identifiers.
- **System fonts only.** No web fonts. The `--font-sans` stack hits `ui-sans-serif` first, then platform sans (Segoe UI / Helvetica Neue / system-ui). This is intentional — fast load, no FOUT, looks native everywhere.
- **No comment system.** Replies go to RSS subscribers / canata.dev contact form / email.
- **No analytics.** If you add one later, prefer something privacy-friendly (Plausible self-hosted or Cloudflare Web Analytics).
- **Tag slugs are URL-safe transliterations** of Turkish characters. Don't try to encode UTF-8 in tag URLs; the `tagSlug()` function in `src/lib/tags.ts` is the single source of truth.
- **Slug preservation is sacred.** Don't rename existing content files. Their filename = their URL = their SEO. New posts can use kebab-case Turkish-transliterated slugs; existing files keep whatever capitalisation they had on the old site.
- **`draft: true` posts** are hidden from feeds and tag pages, but the page templates still allow direct-URL access (useful for sharing a preview).
- **Privacy hard bans** carry over from the rest of his sites (see `~/.claude/.../memory/feedback_render_rules.md`): no phone number, no legal name `Şevket`, no Hacettepe BA GPA `2.39`, no home district, no family.
- **Teaching content is OK on this site specifically.** Unlike `canata.dev` (developer-only framing), `notlar.im` is the personal blog and old "Buğra Hoca" / "eğitim" content from the Docusaurus era was migrated as-is. New teaching-flavoured content is fine here.

## Editing workflow

The whole point of this rebuild was that editing was too painful on Docusaurus. The new workflow:

1. Open any `.mdx` file in `src/content/blog/` or `src/content/notlar/`.
2. Frontmatter is small. Body is plain Markdown (MDX optional if you need a component).
3. Save. `pnpm dev` hot-reloads.
4. Commit. `pnpm deploy`. Done.

No sidebar config. No plugin churn. No CMS.

## Deferred work

- **Custom-domain flip.** `notlar.im` + `www.notlar.im` DNS currently points elsewhere. When we're ready: uncomment the `routes` block in `wrangler.jsonc` and `pnpm deploy`. Cloudflare will repoint DNS at the same time — there's a brief outage moment.
- **Real OG image.** Currently no preview image; sites that unfurl will use the favicon. Add a 1200×630 PNG at `public/og-default.png` and reference it in `src/layouts/Page.astro`.
- **MDX components.** If you want admonitions / callouts (`<Note>`, `<Warning>`), add them as Astro components under `src/components/` and `import` them at the top of any `.mdx`.
- **Pagination on /blog and /notlar.** Currently they list everything. Fine at 24 + 4 entries; add pagination if it grows past ~80.

## Don't

- Don't rename or move files in `src/content/`. The filename is the URL.
- Don't introduce Google Fonts or a self-hosted web font. The aesthetic depends on system sans.
- Don't reach for a CMS (Tina/Decap/Keystatic). The old Docusaurus repo had a `.tina/` directory from a previous attempt — that's exactly the dependency creep we're trying to escape. Markdown files in git is the CMS.
- Don't merge this with `canata.dev` or `bugracanata.com.tr`. Three sites, three audiences:
  - `canata.dev` → developers, recruiters
  - `bugracanata.com.tr` → Turkish educators / school audience
  - `notlar.im` → personal blog (you)

See also `../canata.dev/CLAUDE.md`, `../canata.dev-inner/CLAUDE.md`, and the user's memory at `~/.claude/projects/-Users-bugracanata-Developer-Kisisel-bugracanata-com-tr-PersonalSites/`.
