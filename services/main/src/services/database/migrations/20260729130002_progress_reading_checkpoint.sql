-- Modify "unit_access_invitation" table
ALTER TABLE "unit_access_invitation" DROP CONSTRAINT "unit_access_invitation_permissions_check", ADD CONSTRAINT "unit_access_invitation_permissions_check" CHECK ((cardinality(permissions) >= 1) AND (cardinality(permissions) <= 21));
-- Modify "unit_progress" table
ALTER TABLE "unit_progress" ADD COLUMN "current_basis" text NULL;
-- Backfill how existing materialized snapshots were derived before enforcing its shape.
UPDATE "unit_progress" SET "current_basis" = 'journal' WHERE "current_entry_id" IS NOT NULL;
ALTER TABLE "unit_progress" ADD CONSTRAINT "unit_progress_current_basis_check" CHECK ((current_basis IS NULL) OR (current_basis = ANY (ARRAY['journal'::text, 'reading'::text]))), ADD CONSTRAINT "unit_progress_current_basis_shape_check" CHECK (
CASE
    WHEN (current_basis IS NULL) THEN (current_entry_id IS NULL)
    WHEN (current_basis = 'journal'::text) THEN (current_entry_id IS NOT NULL)
    WHEN (current_basis = 'reading'::text) THEN (current_entry_id IS NULL)
    ELSE false
END);
-- Create index "unit_progress_entry_profile_unit_created_idx" to table: "unit_progress_entry"
CREATE INDEX "unit_progress_entry_profile_unit_created_idx" ON "unit_progress_entry" ("profile_id", "unit_id", "created_at" DESC NULLS LAST) WHERE (deleted_at IS NULL);
