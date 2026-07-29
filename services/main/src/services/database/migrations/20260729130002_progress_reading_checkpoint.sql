-- Modify "unit_access_invitation" table
ALTER TABLE "unit_access_invitation" DROP CONSTRAINT "unit_access_invitation_permissions_check", ADD CONSTRAINT "unit_access_invitation_permissions_check" CHECK ((cardinality(permissions) >= 1) AND (cardinality(permissions) <= 21));
-- Modify "unit_progress" table
ALTER TABLE "unit_progress" ADD COLUMN "current_source_kind" text NULL;
-- Backfill the source of existing materialized journal snapshots before enforcing its shape.
UPDATE "unit_progress" SET "current_source_kind" = 'journal' WHERE "current_entry_id" IS NOT NULL;
ALTER TABLE "unit_progress" ADD CONSTRAINT "unit_progress_current_source_kind_check" CHECK ((current_source_kind IS NULL) OR (current_source_kind = ANY (ARRAY['journal'::text, 'reading'::text]))), ADD CONSTRAINT "unit_progress_current_source_shape_check" CHECK (
CASE
    WHEN (current_source_kind IS NULL) THEN (current_entry_id IS NULL)
    WHEN (current_source_kind = 'journal'::text) THEN (current_entry_id IS NOT NULL)
    WHEN (current_source_kind = 'reading'::text) THEN (current_entry_id IS NULL)
    ELSE false
END);
-- Create index "unit_progress_entry_profile_unit_rezics_created_idx" to table: "unit_progress_entry"
CREATE INDEX "unit_progress_entry_profile_unit_rezics_created_idx" ON "unit_progress_entry" ("profile_id", "unit_id", "created_at" DESC NULLS LAST) WHERE ((deleted_at IS NULL) AND (source_kind = 'rezics'::text));
