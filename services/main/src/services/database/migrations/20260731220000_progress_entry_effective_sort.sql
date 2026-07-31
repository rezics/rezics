-- Modify "unit_progress_entry" table
ALTER TABLE "unit_progress_entry" ALTER COLUMN "affects_current" SET DEFAULT false;
-- Drop index "unit_progress_entry_profile_unit_occurred_idx" from table: "unit_progress_entry"
DROP INDEX "unit_progress_entry_profile_unit_occurred_idx";
-- Create index "unit_progress_entry_profile_unit_sort_idx" to table: "unit_progress_entry"
CREATE INDEX "unit_progress_entry_profile_unit_sort_idx" ON "unit_progress_entry" ("profile_id", "unit_id", (COALESCE(occurred_at, created_at)) DESC, "created_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE (deleted_at IS NULL);
-- Create index "unit_progress_entry_profile_unit_status_sort_idx" to table: "unit_progress_entry"
CREATE INDEX "unit_progress_entry_profile_unit_status_sort_idx" ON "unit_progress_entry" ("profile_id", "unit_id", "status", (COALESCE(occurred_at, created_at)) DESC, "created_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE (deleted_at IS NULL);
