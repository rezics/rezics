-- Modify "book" table
ALTER TABLE "book" ADD CONSTRAINT "book_release_status_check" CHECK (release_status = ANY (ARRAY['ongoing'::text, 'hiatus'::text, 'completed'::text, 'cancelled'::text])), ADD COLUMN "release_status" text NOT NULL;
-- Modify "media" table
ALTER TABLE "media" ADD CONSTRAINT "media_release_status_check" CHECK (release_status = ANY (ARRAY['ongoing'::text, 'hiatus'::text, 'completed'::text, 'cancelled'::text])), ADD COLUMN "release_status" text NOT NULL;
