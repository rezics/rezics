-- Generalize public credit attribution from Entity-only targets to Unit targets while
-- preserving existing attribution and proposal rows.
ALTER TABLE "credit_attribution" RENAME COLUMN "unit_id" TO "source_unit_id";
ALTER TABLE "credit_attribution" RENAME COLUMN "entity_id" TO "credited_unit_id";
ALTER TABLE "credit_attribution"
  DROP CONSTRAINT "credit_attribution_unit_entity_role_key",
  DROP CONSTRAINT "credit_attribution_unit_id_unit_id_fkey",
  DROP CONSTRAINT "credit_attribution_entity_id_entity_id_fkey",
  DROP CONSTRAINT "credit_attribution_not_self_check",
  ADD CONSTRAINT "credit_attribution_source_credited_role_key" UNIQUE ("source_unit_id", "credited_unit_id", "role"),
  ADD CONSTRAINT "credit_attribution_source_unit_id_unit_id_fkey" FOREIGN KEY ("source_unit_id") REFERENCES "unit" ("id") ON DELETE CASCADE,
  ADD CONSTRAINT "credit_attribution_credited_unit_id_unit_id_fkey" FOREIGN KEY ("credited_unit_id") REFERENCES "unit" ("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "credit_attribution_not_self_check" CHECK ("source_unit_id" <> "credited_unit_id");
DROP INDEX "credit_attribution_entity_role_idx";
DROP INDEX "credit_attribution_unit_position_idx";
CREATE INDEX "credit_attribution_credited_unit_role_idx" ON "credit_attribution" ("credited_unit_id", "role");
CREATE INDEX "credit_attribution_source_position_idx" ON "credit_attribution" ("source_unit_id", "position", "id");

ALTER TYPE "entity_association_kind" RENAME TO "association_kind";
ALTER TYPE "entity_association_proposal_direction" RENAME TO "association_proposal_direction";
ALTER TYPE "entity_association_proposal_resolution" RENAME TO "association_proposal_resolution";
ALTER TABLE "entity_association_proposal" RENAME TO "unit_association_proposal";
ALTER TABLE "unit_association_proposal" RENAME COLUMN "target_entity_id" TO "target_unit_id";
ALTER TABLE "unit_association_proposal"
	DROP CONSTRAINT "entity_association_proposal_target_entity_id_entity_id_fkey",
	DROP CONSTRAINT "entity_association_proposal_not_self_check",
	ADD CONSTRAINT "unit_association_proposal_target_unit_id_unit_id_fkey" FOREIGN KEY ("target_unit_id") REFERENCES "unit" ("id") ON DELETE CASCADE,
	ADD CONSTRAINT "unit_association_proposal_not_self_check" CHECK ("source_unit_id" <> "target_unit_id");
DROP INDEX "entity_association_proposal_target_unresolved_idx";
ALTER INDEX "entity_association_proposal_source_unresolved_idx" RENAME TO "unit_association_proposal_source_unresolved_idx";
ALTER INDEX "entity_association_proposal_created_by_idx" RENAME TO "unit_association_proposal_created_by_idx";
ALTER INDEX "entity_association_proposal_resolved_by_idx" RENAME TO "unit_association_proposal_resolved_by_idx";
ALTER TABLE "unit_association_proposal" RENAME CONSTRAINT "entity_association_proposal_role_not_blank" TO "unit_association_proposal_role_not_blank";
ALTER TABLE "unit_association_proposal" RENAME CONSTRAINT "entity_association_proposal_expiry_check" TO "unit_association_proposal_expiry_check";
ALTER TABLE "unit_association_proposal" RENAME CONSTRAINT "entity_association_proposal_resolution_shape_check" TO "unit_association_proposal_resolution_shape_check";
ALTER TABLE "unit_association_proposal" RENAME CONSTRAINT "entity_association_proposal_source_unit_id_unit_id_fkey" TO "unit_association_proposal_source_unit_id_unit_id_fkey";
ALTER TABLE "unit_association_proposal" RENAME CONSTRAINT "entity_association_proposal_pkey" TO "unit_association_proposal_pkey";
ALTER TABLE "unit_association_proposal"
	DROP CONSTRAINT "entity_association_proposal_QnKvbbF3bXlN_fkey",
	DROP CONSTRAINT "entity_association_proposal_ncDq83oJKy7B_fkey",
	ADD CONSTRAINT "unit_association_proposal_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON DELETE RESTRICT,
	ADD CONSTRAINT "unit_association_proposal_xg3ooPLi5GS2_fkey" FOREIGN KEY ("resolved_by_profile_id") REFERENCES "profile" ("id") ON DELETE RESTRICT;
CREATE INDEX "unit_association_proposal_target_unresolved_idx" ON "unit_association_proposal" ("target_unit_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE "resolution" IS NULL;

-- Attribution changes now affect the current search document; publication provenance
-- remains auditable but no longer supplies display identity.
DROP TRIGGER "search_projection_touch_unit_status_event_insert" ON "unit_status_event";
DROP TRIGGER "search_projection_touch_unit_status_event_update" ON "unit_status_event";
DROP TRIGGER "search_projection_touch_unit_status_event_delete" ON "unit_status_event";
DROP TRIGGER "search_projection_touch_collection_insert" ON "collection";
DROP TRIGGER "search_projection_touch_collection_update" ON "collection";
DROP TRIGGER "search_projection_touch_collection_delete" ON "collection";
DROP TRIGGER "search_projection_touch_profile_insert" ON "profile";
DROP TRIGGER "search_projection_touch_profile_update" ON "profile";
DROP TRIGGER "search_projection_touch_profile_delete" ON "profile";
CREATE TRIGGER "search_projection_touch_credit_attribution_insert"
AFTER INSERT ON "credit_attribution"
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION search_touch_current_statement('source_unit_id');
CREATE TRIGGER "search_projection_touch_credit_attribution_update"
AFTER UPDATE ON "credit_attribution"
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION search_touch_current_statement('source_unit_id');
CREATE TRIGGER "search_projection_touch_credit_attribution_delete"
AFTER DELETE ON "credit_attribution"
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION search_touch_current_statement('source_unit_id');
