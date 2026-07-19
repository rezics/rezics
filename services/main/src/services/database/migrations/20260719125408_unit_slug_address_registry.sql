-- Drop index "unit_slug_root_key" from table: "unit"
DROP INDEX "unit_slug_root_key";
-- Modify "unit" table
ALTER TABLE "unit" DROP CONSTRAINT "unit_slug_address_shape_check", DROP CONSTRAINT "unit_slug_label_check", DROP CONSTRAINT "unit_slug_scope_not_self_check", DROP CONSTRAINT "unit_kind_check", ADD CONSTRAINT "unit_kind_check" CHECK (kind = ANY (ARRAY['slug_namespace'::text, 'profile'::text, 'book'::text, 'software'::text, 'media'::text, 'release'::text, 'entity'::text, 'tag'::text, 'series'::text, 'zone'::text, 'collection'::text, 'post'::text, 'poll'::text, 'realm'::text, 'realm_rule'::text])), DROP COLUMN "slug", DROP COLUMN "slug_scope_id";
-- Remove the former physical root namespace. NULL is now the virtual address root.
DELETE FROM "unit" WHERE "id" = '019b76da-a800-7000-8000-000000000000';
-- Create "unit_slug_address" table
CREATE TABLE "unit_slug_address" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "kind" text NOT NULL,
  "scope_unit_id" uuid NULL,
  "slug" text NOT NULL,
  "target_unit_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "unit_slug_address_scope_slug_key" UNIQUE NULLS NOT DISTINCT ("scope_unit_id", "slug"),
  CONSTRAINT "unit_slug_address_scope_unit_id_unit_id_fkey" FOREIGN KEY ("scope_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_slug_address_target_unit_id_unit_id_fkey" FOREIGN KEY ("target_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_slug_address_kind_check" CHECK (kind = ANY (ARRAY['canonical'::text, 'redirect'::text])),
  CONSTRAINT "unit_slug_address_label_check" CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'::text),
  CONSTRAINT "unit_slug_address_scope_not_target_check" CHECK ((scope_unit_id IS NULL) OR (scope_unit_id <> target_unit_id))
);
-- Create index "unit_slug_address_target_canonical_key" to table: "unit_slug_address"
CREATE UNIQUE INDEX "unit_slug_address_target_canonical_key" ON "unit_slug_address" ("target_unit_id") WHERE (kind = 'canonical'::text);
-- Create index "unit_slug_address_target_unit_idx" to table: "unit_slug_address"
CREATE INDEX "unit_slug_address_target_unit_idx" ON "unit_slug_address" ("target_unit_id");
-- Drop "unit_redirect" table
DROP TABLE "unit_redirect";
