-- Modify "book" table
ALTER TABLE "book" ADD CONSTRAINT "book_word_count_check" CHECK ((word_count IS NULL) OR (word_count >= 0)), ADD COLUMN "word_count" integer NULL;
-- Drop index "content_structure_singleton_kind_key" from table: "content_structure"
DROP INDEX "content_structure_singleton_kind_key";
-- Modify "content_structure" table
ALTER TABLE "content_structure" DROP CONSTRAINT "content_structure_kind_check", ADD CONSTRAINT "content_structure_kind_check" CHECK (kind = ANY (ARRAY['book.contents'::text, 'post.contents'::text, 'realm.taxonomy'::text, 'realm.navigation'::text, 'zone.navigation'::text, 'zone.pages'::text]));
-- Create index "content_structure_singleton_kind_key" to table: "content_structure"
CREATE UNIQUE INDEX "content_structure_singleton_kind_key" ON "content_structure" ("owner_unit_id", "kind") WHERE ((deleted_at IS NULL) AND (kind = ANY (ARRAY['book.contents'::text, 'post.contents'::text, 'realm.taxonomy'::text, 'zone.pages'::text])));
-- Modify "unit" table
ALTER TABLE "unit" DROP CONSTRAINT "unit_kind_check", ADD CONSTRAINT "unit_kind_check" CHECK (kind = ANY (ARRAY['slug_namespace'::text, 'profile'::text, 'book'::text, 'software'::text, 'media'::text, 'release'::text, 'entity'::text, 'label'::text, 'tag'::text, 'series'::text, 'zone'::text, 'zone_page'::text, 'collection'::text, 'post'::text, 'poll'::text, 'realm'::text, 'realm_rule'::text]));
-- Create "search_document" table
CREATE TABLE "search_document" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "document" jsonb NOT NULL,
  "deleted_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "search_document_deleted_at_check" CHECK ((deleted_at IS NULL) OR (deleted_at >= created_at)),
  CONSTRAINT "search_document_document_check" CHECK (jsonb_typeof(document) = 'object'::text)
);
-- Create "search_document_revision" table
CREATE TABLE "search_document_revision" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "search_document_id" uuid NOT NULL,
  "parent_revision_id" uuid NULL,
  "source_revision_id" uuid NULL,
  "content_id" uuid NOT NULL,
  "actor_profile_id" uuid NULL,
  "edit_summary" text NULL,
  "kind" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "search_document_revision_id_document_key" UNIQUE ("id", "search_document_id"),
  CONSTRAINT "search_document_revision_ZC2zfwbpr0zU_fkey" FOREIGN KEY ("search_document_id") REFERENCES "search_document" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "search_document_revision_actor_profile_id_profile_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "search_document_revision_content_id_revision_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "revision_content" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "search_document_revision_parent_document_fkey" FOREIGN KEY ("parent_revision_id", "search_document_id") REFERENCES "search_document_revision" ("id", "search_document_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "search_document_revision_source_document_fkey" FOREIGN KEY ("source_revision_id", "search_document_id") REFERENCES "search_document_revision" ("id", "search_document_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "search_document_revision_kind_check" CHECK (kind = ANY (ARRAY['create'::text, 'update'::text, 'delete'::text, 'restore'::text])),
  CONSTRAINT "search_document_revision_source_shape_check" CHECK ((kind = 'restore'::text) = (source_revision_id IS NOT NULL))
);
-- Create index "search_document_revision_content_idx" to table: "search_document_revision"
CREATE INDEX "search_document_revision_content_idx" ON "search_document_revision" ("content_id");
-- Create index "search_document_revision_document_created_at_idx" to table: "search_document_revision"
CREATE INDEX "search_document_revision_document_created_at_idx" ON "search_document_revision" ("search_document_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Create "search_document_revision_head" table
CREATE TABLE "search_document_revision_head" (
  "search_document_id" uuid NOT NULL,
  "revision_id" uuid NOT NULL,
  PRIMARY KEY ("search_document_id"),
  CONSTRAINT "search_document_revision_head_revision_key" UNIQUE ("revision_id"),
  CONSTRAINT "search_document_revision_head_j33SFm4nAjNl_fkey" FOREIGN KEY ("search_document_id") REFERENCES "search_document" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "search_document_revision_head_revision_document_fkey" FOREIGN KEY ("revision_id", "search_document_id") REFERENCES "search_document_revision" ("id", "search_document_id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Modify "content_structure_node" table
ALTER TABLE "content_structure_node" DROP CONSTRAINT "content_structure_node_search_configuration_check", DROP CONSTRAINT "content_structure_node_target_kind_check", ADD CONSTRAINT "content_structure_node_target_kind_check" CHECK (target_kind = ANY (ARRAY['content'::text, 'none'::text, 'unit'::text, 'external'::text])), DROP CONSTRAINT "content_structure_node_target_shape_check", ADD CONSTRAINT "content_structure_node_target_shape_check" CHECK (((target_kind = ANY (ARRAY['content'::text, 'none'::text])) AND (target_unit_id IS NULL) AND (target_url IS NULL)) OR ((target_kind = 'unit'::text) AND (target_unit_id IS NOT NULL) AND (target_url IS NULL)) OR ((target_kind = 'external'::text) AND (target_unit_id IS NULL) AND (target_url ~ '^https://[^[:space:]]+$'::text) AND (char_length(target_url) <= 2000))), DROP COLUMN "target_zone_page_id", DROP COLUMN "search_configuration";
-- Create "zone_search_feature" table
CREATE TABLE "zone_search_feature" (
  "zone_id" uuid NOT NULL,
  "search_document_id" uuid NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("zone_id"),
  CONSTRAINT "zone_search_feature_document_key" UNIQUE ("search_document_id"),
  CONSTRAINT "zone_search_feature_search_document_id_search_document_id_fkey" FOREIGN KEY ("search_document_id") REFERENCES "search_document" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "zone_search_feature_zone_id_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Drop "zone_page" table
DROP TABLE "zone_page";

-- Zone Page Units are owned exclusively through a Zone's singleton page tree.
-- Keep these cross-table invariants at the database boundary for non-HTTP writers.
CREATE FUNCTION zone_pages_validate_structure() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind = 'zone.pages' AND NOT EXISTS (
    SELECT 1 FROM zone WHERE zone.id = NEW.owner_unit_id
  ) THEN
    RAISE EXCEPTION 'zone.pages owner must be a Zone Unit'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER zone_pages_structure_owner
BEFORE INSERT OR UPDATE OF owner_unit_id, kind ON content_structure
FOR EACH ROW EXECUTE FUNCTION zone_pages_validate_structure();

CREATE FUNCTION zone_pages_validate_node() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  structure_kind text;
BEGIN
  SELECT structure.kind INTO structure_kind
  FROM content_structure AS structure
  WHERE structure.id = NEW.structure_id;

  IF structure_kind <> 'zone.pages' OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.target_kind <> 'content'
    OR NOT EXISTS (
      SELECT 1 FROM unit
      WHERE unit.id = NEW.content_unit_id
        AND unit.kind = 'zone_page'
        AND unit.deleted_at IS NULL
    ) THEN
    RAISE EXCEPTION 'zone.pages nodes must contain active Zone Page Units'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM content_structure_node AS parent
    WHERE parent.id = NEW.parent_id
      AND parent.structure_id = NEW.structure_id
      AND parent.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'zone.pages parent must be active'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.parent_id IS NULL AND EXISTS (
    SELECT 1 FROM content_structure_node AS root
    WHERE root.structure_id = NEW.structure_id
      AND root.parent_id IS NULL
      AND root.deleted_at IS NULL
      AND root.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'zone.pages may have at most one active root'
      USING ERRCODE = '23505';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM content_structure_node AS other_node
    JOIN content_structure AS other_structure
      ON other_structure.id = other_node.structure_id
    WHERE other_node.content_unit_id = NEW.content_unit_id
      AND other_node.deleted_at IS NULL
      AND other_structure.kind = 'zone.pages'
      AND other_structure.deleted_at IS NULL
      AND other_node.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'Zone Page Unit may belong to only one active Zone page tree'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END
$$;

CREATE CONSTRAINT TRIGGER zone_pages_node_invariants
AFTER INSERT OR UPDATE ON content_structure_node
DEFERRABLE INITIALLY IMMEDIATE
FOR EACH ROW EXECUTE FUNCTION zone_pages_validate_node();
