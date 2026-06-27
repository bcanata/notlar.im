-- Home-library enrichment: physical location, current loan, reading status,
-- rating, private notes. Applied on top of db/schema.sql's `books` table.
--
-- Apply:  wrangler d1 execute notlar-library --remote --file=db/migrations/0002_home_library.sql
--         wrangler d1 execute notlar-library --local  --file=db/migrations/0002_home_library.sql
-- (No BEGIN TRANSACTION — D1 executes a --file atomically and rejects it.)

ALTER TABLE books ADD COLUMN bookcase  TEXT;   -- public:  which bookcase/unit
ALTER TABLE books ADD COLUMN shelf     TEXT;   -- public:  shelf within it
ALTER TABLE books ADD COLUMN lent_to   TEXT;   -- admin:   borrower name; NULL = on the shelf
ALTER TABLE books ADD COLUMN lent_at   TEXT;   -- admin:   ISO date lent
ALTER TABLE books ADD COLUMN lent_note TEXT;   -- admin:   optional loan note
ALTER TABLE books ADD COLUMN rating    INTEGER;-- public:  1–5
ALTER TABLE books ADD COLUMN notes     TEXT;   -- admin:   private free text

-- Existing 182 books all came from the one LibraryThing collection.
UPDATE books SET bookcase = 'Çalışma Odası' WHERE bookcase IS NULL;

-- `status` is repurposed as the reading-status enum: okunmadi | okunuyor | okundu.
UPDATE books SET status = 'okunmadi' WHERE status IS NULL OR status = 'Not begun';
