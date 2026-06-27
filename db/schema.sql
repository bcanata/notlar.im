-- notlar.im library catalogue (Cloudflare D1).
--
-- Source of truth for /kitaplik, /library and the /admin scanner. Seeded once
-- from src/data/library.csv via scripts/export-books-sql.mjs (preserving the
-- exact slugs the old static build produced, so book URLs stay stable).
--
-- Model: a bibliographic record per book (`books`) + one row per physical copy
-- (`copies`). Reading status + rating are about the work and live on `books`;
-- physical location + loan + per-copy notes live on `copies`.
--
-- Apply:  wrangler d1 execute notlar-library --file=db/schema.sql --remote
--         wrangler d1 execute notlar-library --file=db/schema.sql --local

CREATE TABLE IF NOT EXISTS books (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT    NOT NULL UNIQUE,   -- URL slug: isbn13 → isbn10 → title-slug (+ -n on collision)
    title       TEXT    NOT NULL,
    author      TEXT,
    isbn13      TEXT,
    isbn10      TEXT,
    publisher   TEXT,
    year        INTEGER,
    pages       INTEGER,
    description TEXT,
    status      TEXT    DEFAULT 'okunmadi',-- reading status: okunmadi | okunuyor | okundu
    rating      INTEGER,                   -- public: 1–5
    added       TEXT,                      -- ISO date first added to the library
    cover_key   TEXT,                      -- R2 object key (e.g. "9789754030365.jpg"); NULL when no cover
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_books_isbn13 ON books (isbn13);
CREATE INDEX IF NOT EXISTS idx_books_isbn10 ON books (isbn10);
CREATE INDEX IF NOT EXISTS idx_books_added  ON books (added);

CREATE TABLE IF NOT EXISTS copies (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id     INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    bookcase    TEXT,                      -- public:  which bookcase/unit
    shelf       TEXT,                      -- public:  shelf within it
    lent_to     TEXT,                      -- admin:   borrower name; NULL = on the shelf
    lent_at     TEXT,                      -- admin:   ISO date lent
    lent_note   TEXT,                      -- admin:   optional loan note
    copy_note   TEXT,                      -- admin:   per-copy note, e.g. "imzalı", "2. baskı"
    added       TEXT,                      -- ISO date this copy was acquired
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_copies_book ON copies (book_id);
