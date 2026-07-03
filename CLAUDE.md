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
- `pnpm run deploy` — build + `wrangler deploy`. **Must be `pnpm run deploy`, not bare `pnpm deploy`** — `deploy` is a reserved pnpm builtin (workspace deploy) and fails with `ERR_PNPM_CANNOT_DEPLOY`. **No longer a pure static upload** — it deploys a Worker (the `@astrojs/cloudflare` adapter) with D1 + R2 bindings. Most pages are still prerendered; only the library + `/admin` routes are server-rendered.
- `pnpm deploy:dry` — build + `wrangler deploy --dry-run` (use before any production deploy).
- `pnpm import` — re-runs the one-shot Docusaurus → Astro importer. Idempotent. Reads from `../notlar.im-docusaurus-backup/`.
- **Library (D1) commands:**
  - `pnpm enrich-books` — (legacy) rebuild `src/data/books.json` + covers from the CSV. The live catalogue now lives in D1; this is only used to regenerate the seed.
  - `pnpm export-books-sql` — regenerate `db/seed.sql` from `books.json` (preserving the original slugs).
  - `pnpm db:schema:remote` / `pnpm db:seed:remote` — apply `db/schema.sql` / `db/seed.sql` to the production D1 (`:local` variants seed the dev DB used by `pnpm dev`).
  - `pnpm upload-covers-r2` — one-shot: upload `public/covers/*.jpg` into the R2 bucket (already run during the D1 migration; `public/covers/` has since been removed).

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
- **`wrangler.jsonc`** — Worker config. The site is a Worker (`main: ./dist/_worker.js/index.js`) with Static Assets (`assets.binding: ASSETS`), a D1 binding (`DB` → `notlar-library`), an R2 binding (`COVERS` → `notlar-covers`), and the `notlar.im` / `www.notlar.im` custom-domain routes (live). `public/.assetsignore` keeps `_worker.js`/`_routes.json` from being uploaded as public assets.

## Kitaplık (library): D1 + R2 + /admin

The library is **not** content-collection markdown — it's structured data in Cloudflare D1, the one piece of the site that's server-rendered.

- **Source of truth:** D1 database `notlar-library`, table `books` (`db/schema.sql`). Originally seeded (182 books) from `src/data/library.csv` → `books.json` → `db/seed.sql`. The CSV/`books.json` are now just the historical seed; edits happen through `/admin` (or SQL).
- **Covers:** R2 bucket `notlar-covers`, one object per ISBN (`<isbn>.jpg`), served by `src/pages/covers/[...key].ts` with an immutable cache header. (The old in-repo `public/covers/` was migrated into R2 and deleted.)
- **Reads (`src/lib/books.ts`):** `listBooks`/`getBookBySlug`/`findByIsbn` query `Astro.locals.runtime.env.DB`. Slug rule is unchanged (ISBN-13 → ISBN-10 → title-slug, `-n` on collision) and persisted in the `slug` column, so existing book URLs survive.
- **Books + copies model (important):** a book is a **bibliographic record** (`books`: title/author/isbn/publisher/year/pages/description/cover, plus `status` as a reading-status enum `okunmadi`/`okunuyor`/`okundu` and `rating` 1–5 — these are about the *work*). Each **physical copy** is a row in `copies` (FK `book_id`) carrying `bookcase`/`shelf` (location), `lent_to`/`lent_at`/`lent_note` (current loan), `copy_note` ("imzalı", "2. baskı"). A book can have several copies in different places, one lent and one not.
- **Visibility:** two read shapes in `books.ts`. The **public** shape (`listBooks`/`getBookBySlug` → `Book`/`BookWithSlug`) gives `copies: PublicCopy[]` (location + per-copy `isLent` only) and a book-level `isLent` — it never exposes `lent_to`/`lent_note`. The **admin** shape (`getBookForAdmin` → `AdminBook`) carries full per-copy loan + notes. Work edits → `updateBook`; copy add/edit/delete → `addCopy`/`updateCopy`/`deleteCopy` (clearing `lent_to` returns a copy and nulls its loan). Deleting a book also deletes its copies (handled in code, not relying on FK cascade).
- **Migrations:** `0002_home_library.sql` (location/loan/rating/notes), `0003_copies.sql` (split into books+copies, backfilling one copy per book, dropping the moved columns from `books`). Apply with `pnpm db:migrate:remote` / `pnpm db:copies:remote`; **local D1 rejects multi-statement DDL files**, so apply those statements individually with `--command`.
- **SSR pages (`export const prerender = false`):** `kitaplik.astro`, `en/library.astro`, `kitaplik/[slug].astro`, `en/library/[slug].astro`, `covers/[...key].ts`, `admin/index.astro`, `api/admin/*`. A missing slug renders an inline 404 state (you can't `Astro.rewrite` to the prerendered `/404`).
- **`/admin`** (`src/pages/admin/index.astro`, Turkish-only, `noindex`): a ZXing camera scanner → `GET /api/admin/lookup?isbn=` (Open Library + Google Books fallback, `src/lib/openlibrary.ts`) → confirm (optionally shelve) → `POST /api/admin/books`. **Re-scanning a known ISBN adds another copy** to that book (no more 409). Each list row has **Düzenle** → `GET /api/admin/books?slug=` populates an edit panel: work fields (`PUT /api/admin/books`) + a per-copy section where each copy's location/loan/copy-note is managed via `/api/admin/copies` (`POST` add, `PUT` update, `DELETE` remove). `DELETE /api/admin/books?slug=` removes the book, all copies, and the cover. Bookcase names come from a `<datalist>` (`listBookcases`) for consistent naming.
- **Auth (`src/middleware.ts`):** `/admin*` + `/api/admin*` require a valid Cloudflare Access JWT (verified against `CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD`). **Fail-closed:** until those vars are set it returns 503, so the admin is never accidentally open (closes the `*.workers.dev` bypass too). Local `pnpm dev` skips the check.
- **Local dev:** `platformProxy` gives `pnpm dev` a local D1/R2 — seed it with `pnpm db:schema:local && pnpm db:seed:local`. Note R2 **binary** doesn't round-trip through the dev proxy (you'll see miniflare "Cannot stringify non-POJOs"); verify cover read/write with `wrangler dev --remote` instead.

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
4. Commit. `pnpm run deploy`. Done.

No sidebar config. No plugin churn. No CMS.

## Deferred work

- **Custom-domain flip.** `notlar.im` + `www.notlar.im` DNS currently points elsewhere. When we're ready: uncomment the `routes` block in `wrangler.jsonc` and `pnpm run deploy`. Cloudflare will repoint DNS at the same time — there's a brief outage moment.
- **Real OG image.** Currently no preview image; sites that unfurl will use the favicon. Add a 1200×630 PNG at `public/og-default.png` and reference it in `src/layouts/Page.astro`.
- **MDX components.** If you want admonitions / callouts (`<Note>`, `<Warning>`), add them as Astro components under `src/components/` and `import` them at the top of any `.mdx`.
- **Pagination on /blog and /notlar.** Currently they list everything. Fine at 24 + 4 entries; add pagination if it grows past ~80.
- **Cloudflare Access for `/admin` (REQUIRED before the admin is usable).** The middleware fails closed, so `/admin` returns 503 until this is done:
  1. Zero Trust dashboard → Access → Applications → add a self-hosted app for `notlar.im/admin*` (and `notlar.im/api/admin*`), policy = allow your email.
  2. Copy the app's **Application Audience (AUD) tag** and your team domain (`<team>.cloudflareaccess.com`) into the `vars` block of `wrangler.jsonc` (`CF_ACCESS_AUD`, `CF_ACCESS_TEAM_DOMAIN`), then `pnpm exec wrangler types` + `pnpm run deploy`.
- **Admin editing.** `/admin` can scan-add and delete; editing an existing book's fields isn't built yet (add a `PUT /api/admin/books`).

## Don't

- Don't rename or move files in `src/content/`. The filename is the URL.
- Don't introduce Google Fonts or a self-hosted web font. The aesthetic depends on system sans.
- Don't reach for a CMS (Tina/Decap/Keystatic). The old Docusaurus repo had a `.tina/` directory from a previous attempt — that's exactly the dependency creep we're trying to escape. Markdown files in git is the CMS.
- Don't merge this with `canata.dev` or `bugracanata.com.tr`. Three sites, three audiences:
  - `canata.dev` → developers, recruiters
  - `bugracanata.com.tr` → Turkish educators / school audience
  - `notlar.im` → personal blog (you)

See also `../canata.dev/CLAUDE.md`, `../canata.dev-inner/CLAUDE.md`, and the user's memory at `~/.claude/projects/-Users-bugracanata-Developer-Kisisel-bugracanata-com-tr-PersonalSites/`.
