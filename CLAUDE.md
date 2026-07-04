# CLAUDE.md

This file tells Claude Code (claude.ai/code) how to work in this repo.

## What this repo is

`notlar.im` — Buğra Canata's personal blog, **bilingual**: Turkish at the root, English mirrored under `/en/` (paired via `translationKey` frontmatter). Yazılım, amatör telsiz, bisiklet, ve karşıma çıkan başka şeyler üzerine kısa notlar. Besides posts there are sections for videos (`/videolar`, from `src/data/youtube.json`), the home library (`/kitaplik`, D1-backed — see below), places (`/mekanlar`, Google-reviews map), and tags.

This is a **fresh Astro 5 rebuild** of an earlier Docusaurus site at the same domain. The old Docusaurus codebase is preserved at `~/Developer/Kisisel/notlar.im-docusaurus-backup/` (untouched, no remote pushes) and its git history lives on as the `docusaurus-arsiv` branch of the GitHub repo (`bcanata/notlar.im`). The visual direction is borrowed from [tuhat.net](https://tuhat.net) — single-column reverse-chronological feed, hashtag-style tags. Typography: body text on the system sans stack; headlines/wordmark in **Fraunces** (self-hosted via `@fontsource-variable/fraunces` — no third-party font CDN). Tailwind v4 + Astro Content Collections + plain MDX + Pagefind search (⌘K modal, lazy-loaded). Deployed on Cloudflare Workers, same account as `canata.dev`.

## Commands

- `pnpm install` — one-time setup.
- `pnpm dev` — Astro dev server at `http://localhost:4321`.
- `pnpm build` — runs `astro check` (type-checks frontmatter + content) then `astro build` into `./dist`.
- `pnpm exec wrangler dev` — serves the **built** site (Worker + assets) locally; use this instead of `astro preview`, which the Cloudflare adapter rejects.
- `pnpm run deploy` — build + `wrangler deploy`. **Must be `pnpm run deploy`, not bare `pnpm deploy`** — `deploy` is a reserved pnpm builtin (workspace deploy) and fails with `ERR_PNPM_CANNOT_DEPLOY`. **No longer a pure static upload** — it deploys a Worker (the `@astrojs/cloudflare` adapter) with D1 + R2 bindings. Most pages are still prerendered; only the library + `/admin` routes are server-rendered.
- `pnpm deploy:dry` — build + `wrangler deploy --dry-run` (use before any production deploy).
- **Library (D1) commands:**
  - `pnpm enrich-books` — (legacy) rebuild `src/data/books.json` + covers from the CSV. The live catalogue now lives in D1; this is only used to regenerate the seed.
  - `pnpm export-books-sql` — regenerate `db/seed.sql` from `books.json` (preserving the original slugs).
  - `pnpm db:schema:remote` / `pnpm db:seed:remote` — apply `db/schema.sql` / `db/seed.sql` to the production D1 (`:local` variants seed the dev DB used by `pnpm dev`).
  - `pnpm upload-covers-r2` — one-shot: upload `public/covers/*.jpg` into the R2 bucket (already run during the D1 migration; `public/covers/` has since been removed).

## Architecture

- **`src/content/blog/`** — the **single** content collection (the old `notlar` collection was folded in; `astro.config.mjs` `redirects` keeps the old `/notlar/*` URLs alive). One `.mdx` per file. Slug = filename (case-preserved). Frontmatter: `title`, `date`, `updated?`, `tags`, `description?`, `draft?`, `lang` (default `tr`), `translationKey?` (pairs TR↔EN), `ai?` (renders a YZ/AI provenance badge), `canonical?`, `cover?`. `taslak.mdx` is an intentional `draft: true` scratchpad — leave it be.
- **`src/content.config.ts`** — Zod schema. Uses `glob` loader's `generateId` to preserve filename casing verbatim — critical for SEO continuity (capitalised slugs like `/blog/Quansheng-UV-K5` must stay).
- **`src/pages/`** — Astro page routes (each has an `en/` mirror unless noted):
  - `index.astro` — the feed (via `src/lib/feed.ts` `buildFeed(lang)`), newest as lead, rest listed. Unpaginated by design.
  - `blog/[...slug].astro` — post template: reading time, TOC (`src/components/Toc.astro`, ≥3 headings), prev/next + related (`src/lib/related.ts`), BlogPosting JSON-LD (`src/lib/jsonld.ts`).
  - `t/[tag].astro` + `etiketler.astro` — tag pages, language-scoped (TR posts → `/t/`, EN posts → `/en/t/`). Tag slug via `src/lib/tags.ts` `tagSlug()` (Turkish-aware: ğ→g, ş→s, ı→i, etc.).
  - `videolar/[...page].astro` — YouTube feed, paginated 12/page (`scripts/refresh-youtube.mjs` refreshes `src/data/youtube.json`).
  - `mekanlar.astro` / `en/places.astro` — Leaflet map of Google reviews (`src/data/reviews.json`, `scripts/import-reviews.mjs`).
  - `hakkimda.astro` — about page (Person JSON-LD). **The URL is intentionally `/hakkimda/` not `/hakkinda/`** — preserved from the old site's indexing.
  - `ara.astro` / `en/search.astro` — standalone Pagefind pages; accept `?q=` (SearchAction target).
  - `rss.xml.ts` / `en/rss.xml.ts` — per-language feeds (each filters `lang`).
  - `og/[...slug].ts` — build-time per-post OG PNGs (astro-og-canvas + `src/fonts/Roboto-*.ttf` for Turkish glyphs), `/og/_default.png` fallback.
- **`src/layouts/Page.astro`** — single top-level layout: nav, footer, full head (OG/Twitter meta, canonical, hreflang + x-default, JSON-LD via `schema` prop, favicon set, manifest), search modal.
- **`src/styles/global.css`** — Tailwind v4 entry + `.prose` class for rendered markdown body. Bespoke not `@tailwindcss/typography`; keeps the rules small and editable.
- **`src/lib/rehype-img.mjs`** — adds `loading="lazy"`/`decoding="async"` to markdown content images (first image per doc skipped for LCP). Raw HTML `<img>` in MDX is not covered.
- **`src/assets/blog/<slug>/`** — localized content images (relative markdown paths → astro:assets emits dimensions). Used for images whose original hosts died (were archive.org/imgur hotlinks).
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

- **Bilingual content.** Turkish is the default locale (root URLs); English mirrors under `/en/`. TR and EN versions of a post share a `translationKey`. UI strings live in the typed dictionary in `src/lib/i18n.ts` (TS forces both languages).
- **Fonts:** body on the system sans stack (`--font-sans`); headlines/wordmark on self-hosted Fraunces (`@fontsource-variable/fraunces/opsz.css`, bundled by Vite). **No third-party font CDN** (no Google Fonts requests) — that's the rule; self-hosted is fine.
- **Tags are per-language.** TR posts carry Turkish tags, EN posts English tags (`bisiklet` ↔ `cycling` is correct, not a duplicate); shared technical terms (docker, kindle, qrp…) are fine on both. Tag pages never mix languages. Don't re-add redundant tags that were consolidated (telsiz, hosting, e-okuyucu, radio, e-reader — redirects exist in `astro.config.mjs`).
- **MDX callouts exist — use them.** `<Note>`, `<Tip>`, `<Warning>` in `src/components/mdx/` (import from `../../components/mdx` at the top of an `.mdx`).
- **`ai: true`** on any post produced or substantially assisted by AI — renders the YZ/AI badge. Human-written posts (and translations of them) stay `ai: false`.
- **No comment system.** Replies go to RSS subscribers / canata.dev contact form / email.
- **No analytics.** If you add one later, prefer something privacy-friendly (Plausible self-hosted or Cloudflare Web Analytics).
- **Tag slugs are URL-safe transliterations** of Turkish characters. Don't try to encode UTF-8 in tag URLs; the `tagSlug()` function in `src/lib/tags.ts` is the single source of truth.
- **Slug preservation is sacred.** Don't rename existing content files. Their filename = their URL = their SEO. New posts can use kebab-case Turkish-transliterated slugs; existing files keep whatever capitalisation they had on the old site.
- **`draft: true` posts** are hidden from feeds and tag pages, but the page templates still allow direct-URL access (useful for sharing a preview).
- **Privacy hard bans** carry over from the rest of his sites (see `~/.claude/.../memory/feedback_render_rules.md`): no phone number, no legal name `Şevket`, no Hacettepe BA GPA `2.39`, no home district, no family.
- **Teaching content is OK on this site specifically.** Unlike `canata.dev` (developer-only framing), `notlar.im` is the personal blog and old "Buğra Hoca" / "eğitim" content from the Docusaurus era was migrated as-is. New teaching-flavoured content is fine here.

## Editing workflow

The whole point of this rebuild was that editing was too painful on Docusaurus. The new workflow:

1. Open any `.mdx` file in `src/content/blog/`.
2. Frontmatter is small. Body is plain Markdown (MDX optional if you need a component).
3. Save. `pnpm dev` hot-reloads.
4. Commit. `pnpm run deploy`. Done.

No sidebar config. No plugin churn. No CMS.

## Deferred work

(The 2025-era list — custom-domain flip, OG image, MDX callouts, Cloudflare Access, admin editing — is all **done**. Current list:)

- **Full-content RSS.** Feeds are summary-only. Plan: render post bodies at build time with the experimental Container API (`experimental_AstroContainer` + `sanitize-html`); endpoints are prerendered so the Workers runtime isn't involved. Fallback if the Container API misbehaves: `markdown-it` over `post.body` (no published post uses MDX components, so output is equivalent).
- **EN translations for the ~19 TR-only posts.** All EN posts have TR counterparts; the reverse is ~57%. Prioritize by GSC traffic (amateur-radio guides first). `translationKey`s are pre-wired.
- **Homepage pagination** if the per-language feed grows past ~80 entries (TR is at ~40). The `paginate()` pattern to copy lives in `videolar/[...page].astro`.
- **Full astro:assets migration** of remaining hotlinked content images (Amazon/GitHub links still remote; only the dead-host ones were localized to `src/assets/blog/`).
- **Sitemap hreflang alternates** only if GSC reports hreflang issues — page-level tags already cover it; the sitemap plugin's `i18n` option must stay OFF (slug mismatch, see `astro.config.mjs` comment).
- **Draft triage.** 3 TR+EN draft pairs linger (installed-apps-2021, docker-images, rtl-sdr). Publish-after-refresh or delete — owner's call; rtl-sdr is the strongest candidate to finish.

## Don't

- Don't rename or move files in `src/content/`. The filename is the URL.
- Don't add third-party font requests (Google Fonts etc.). Display font is already self-hosted Fraunces; body stays system sans.
- Don't reach for a CMS (Tina/Decap/Keystatic). The old Docusaurus repo had a `.tina/` directory from a previous attempt — that's exactly the dependency creep we're trying to escape. Markdown files in git is the CMS.
- Don't merge this with `canata.dev` or `bugracanata.com.tr`. Three sites, three audiences:
  - `canata.dev` → developers, recruiters
  - `bugracanata.com.tr` → Turkish educators / school audience
  - `notlar.im` → personal blog (you)

See also `../canata.dev/CLAUDE.md`, `../canata.dev-inner/CLAUDE.md`, and the user's memory at `~/.claude/projects/-Users-bugracanata-Developer-Kisisel-bugracanata-com-tr-PersonalSites/`.
