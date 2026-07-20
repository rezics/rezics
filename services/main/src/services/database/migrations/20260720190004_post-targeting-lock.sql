-- Modify "moderation_action" table
ALTER TABLE "moderation_action" DROP CONSTRAINT "moderation_action_lock_outcome_check", DROP CONSTRAINT "moderation_action_single_outcome_check", ADD CONSTRAINT "moderation_action_single_outcome_check" CHECK ((previous_state IS NULL) OR (previous_post_targeting_locked IS NULL)), ADD CONSTRAINT "moderation_action_post_targeting_lock_outcome_check" CHECK ((previous_post_targeting_locked IS NULL) = (resulting_post_targeting_locked IS NULL)), DROP COLUMN "resulting_locked", DROP COLUMN "previous_locked", ADD COLUMN "resulting_post_targeting_locked" boolean NULL, ADD COLUMN "previous_post_targeting_locked" boolean NULL;
-- Modify "post" table
ALTER TABLE "post" DROP COLUMN "locked";
-- Modify "post_reply" table
ALTER TABLE "post_reply" DROP COLUMN "context_realm_id";
-- Drop index "realm_unit_unit_idx" from table: "realm_unit"
DROP INDEX "realm_unit_unit_idx";
-- Modify "realm_unit" table
ALTER TABLE "realm_unit" DROP COLUMN "locked", ADD COLUMN "post_targeting_locked" boolean NOT NULL DEFAULT false;
-- Create index "realm_unit_unit_realm_idx" to table: "realm_unit"
CREATE INDEX "realm_unit_unit_realm_idx" ON "realm_unit" ("unit_id", "realm_id");
-- Modify "unit" table
ALTER TABLE "unit" ADD COLUMN "post_targeting_locked" boolean NOT NULL DEFAULT false;
