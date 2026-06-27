-- Multiple physical copies per book. Splits the single-row model into a
-- bibliographic record (books) + per-copy holdings (copies): location and loan
-- columns move from books to copies; reading status + rating stay on books
-- (they're about the work, not a copy).
--
-- Apply:  wrangler d1 execute notlar-library --remote --file=db/migrations/0003_copies.sql
-- Local D1 rejects multi-statement DDL files — apply each statement with --command.

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
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_copies_book ON copies (book_id);

-- One copy per existing book, carrying the columns being moved.
INSERT INTO copies (book_id, bookcase, shelf, lent_to, lent_at, lent_note, copy_note, added)
SELECT id, bookcase, shelf, lent_to, lent_at, lent_note, notes, added FROM books;

-- Drop the moved columns from books — location/loan/notes now live on copies.
ALTER TABLE books DROP COLUMN bookcase;
ALTER TABLE books DROP COLUMN shelf;
ALTER TABLE books DROP COLUMN lent_to;
ALTER TABLE books DROP COLUMN lent_at;
ALTER TABLE books DROP COLUMN lent_note;
ALTER TABLE books DROP COLUMN notes;
