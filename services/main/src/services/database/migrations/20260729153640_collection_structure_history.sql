-- Modify "studio_work_relation" table
ALTER TABLE "studio_work_relation" DROP CONSTRAINT "studio_work_relation_relation_source_check", ADD CONSTRAINT "studio_work_relation_relation_source_check" CHECK (((relation = 'created'::text) AND (source = 'unit_status'::text)) OR ((relation = 'contributed'::text) AND (source = ANY (ARRAY['unit_revision'::text, 'content_structure_revision'::text, 'collection_structure_revision'::text, 'dock_revision'::text])))), DROP CONSTRAINT "studio_work_relation_source_check", ADD CONSTRAINT "studio_work_relation_source_check" CHECK (source = ANY (ARRAY['unit_status'::text, 'unit_revision'::text, 'content_structure_revision'::text, 'collection_structure_revision'::text, 'dock_revision'::text]));
-- Create "collection_structure_revision" table
CREATE TABLE "collection_structure_revision" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "collection_id" uuid NOT NULL,
  "parent_revision_id" uuid NULL,
  "source_revision_id" uuid NULL,
  "content_id" uuid NOT NULL,
  "actor_profile_id" uuid NULL,
  "edit_summary" text NULL,
  "kind" text NOT NULL,
  "minor" boolean NOT NULL DEFAULT false,
  "replay_byte_size" integer NOT NULL,
  "checkpoint_byte_size" integer NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "collection_structure_revision_id_collection_key" UNIQUE ("id", "collection_id"),
  CONSTRAINT "collection_structure_revision_FRTr4YXDyec2_fkey" FOREIGN KEY ("content_id") REFERENCES "revision_content" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "collection_structure_revision_actor_profile_id_profile_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "collection_structure_revision_collection_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "collection_structure_revision_parent_collection_fkey" FOREIGN KEY ("parent_revision_id", "collection_id") REFERENCES "collection_structure_revision" ("id", "collection_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "collection_structure_revision_source_collection_fkey" FOREIGN KEY ("source_revision_id", "collection_id") REFERENCES "collection_structure_revision" ("id", "collection_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "collection_structure_revision_checkpoint_byte_size_check" CHECK (checkpoint_byte_size >= 0),
  CONSTRAINT "collection_structure_revision_kind_check" CHECK (kind = ANY (ARRAY['create'::text, 'update'::text, 'restore'::text])),
  CONSTRAINT "collection_structure_revision_replay_byte_size_check" CHECK (replay_byte_size >= 0),
  CONSTRAINT "collection_structure_revision_source_shape_check" CHECK ((kind = 'restore'::text) = (source_revision_id IS NOT NULL))
);
-- Create index "collection_structure_revision_actor_created_at_idx" to table: "collection_structure_revision"
CREATE INDEX "collection_structure_revision_actor_created_at_idx" ON "collection_structure_revision" ("actor_profile_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Create index "collection_structure_revision_collection_created_at_idx" to table: "collection_structure_revision"
CREATE INDEX "collection_structure_revision_collection_created_at_idx" ON "collection_structure_revision" ("collection_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Create index "collection_structure_revision_content_idx" to table: "collection_structure_revision"
CREATE INDEX "collection_structure_revision_content_idx" ON "collection_structure_revision" ("content_id");
-- Create index "collection_structure_revision_parent_idx" to table: "collection_structure_revision"
CREATE INDEX "collection_structure_revision_parent_idx" ON "collection_structure_revision" ("parent_revision_id");
-- Create index "collection_structure_revision_source_idx" to table: "collection_structure_revision"
CREATE INDEX "collection_structure_revision_source_idx" ON "collection_structure_revision" ("source_revision_id");
-- Create "collection_structure_revision_head" table
CREATE TABLE "collection_structure_revision_head" (
  "collection_id" uuid NOT NULL,
  "revision_id" uuid NOT NULL,
  PRIMARY KEY ("collection_id"),
  CONSTRAINT "collection_structure_revision_head_revision_key" UNIQUE ("revision_id"),
  CONSTRAINT "collection_structure_revision_head_collection_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "collection_structure_revision_head_revision_collection_fkey" FOREIGN KEY ("revision_id", "collection_id") REFERENCES "collection_structure_revision" ("id", "collection_id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
