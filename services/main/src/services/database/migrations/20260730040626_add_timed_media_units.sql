-- Drop index "content_structure_singleton_kind_key" from table: "content_structure"
DROP INDEX "content_structure_singleton_kind_key";
-- Modify "content_structure" table
ALTER TABLE "content_structure" DROP CONSTRAINT "content_structure_kind_check", ADD CONSTRAINT "content_structure_kind_check" CHECK (kind = ANY (ARRAY['book.contents'::text, 'media.contents'::text, 'post.contents'::text, 'realm.taxonomy'::text, 'wiki.navigation'::text, 'zone.navigation'::text, 'page-structure'::text]));
-- Create index "content_structure_singleton_kind_key" to table: "content_structure"
CREATE UNIQUE INDEX "content_structure_singleton_kind_key" ON "content_structure" ("owner_unit_id", "kind") WHERE ((deleted_at IS NULL) AND (kind = ANY (ARRAY['book.contents'::text, 'media.contents'::text, 'post.contents'::text, 'realm.taxonomy'::text, 'page-structure'::text])));
-- Modify "unit" table
ALTER TABLE "unit" DROP CONSTRAINT "unit_kind_check", ADD CONSTRAINT "unit_kind_check" CHECK (kind = ANY (ARRAY['slug_namespace'::text, 'profile'::text, 'book'::text, 'software'::text, 'media'::text, 'video'::text, 'audio'::text, 'release'::text, 'entity'::text, 'label'::text, 'tag'::text, 'structure'::text, 'series'::text, 'zone'::text, 'zone_page'::text, 'collection'::text, 'post'::text, 'poll'::text, 'realm'::text, 'realm_rule'::text]));
-- Create "audio" table
CREATE TABLE "audio" (
  "id" uuid NOT NULL,
  "unit_kind" text NOT NULL DEFAULT 'audio',
  "duration_seconds" integer NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "audio_unit_kind_fkey" FOREIGN KEY ("id", "unit_kind") REFERENCES "unit" ("id", "kind") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "audio_duration_seconds_check" CHECK ((duration_seconds IS NULL) OR (duration_seconds > 0)),
  CONSTRAINT "audio_unit_kind_check" CHECK (unit_kind = 'audio'::text)
);
-- Create "video" table
CREATE TABLE "video" (
  "id" uuid NOT NULL,
  "unit_kind" text NOT NULL DEFAULT 'video',
  "duration_seconds" integer NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "video_unit_kind_fkey" FOREIGN KEY ("id", "unit_kind") REFERENCES "unit" ("id", "kind") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "video_duration_seconds_check" CHECK ((duration_seconds IS NULL) OR (duration_seconds > 0)),
  CONSTRAINT "video_unit_kind_check" CHECK (unit_kind = 'video'::text)
);
