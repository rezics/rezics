-- Drop index "moderation_action_idempotency_key" from table: "moderation_action"
DROP INDEX "moderation_action_idempotency_key";
-- Modify "moderation_action" table
ALTER TABLE "moderation_action" ADD CONSTRAINT "moderation_action_lock_outcome_check" CHECK ((previous_locked IS NULL) = (resulting_locked IS NULL)), ADD CONSTRAINT "moderation_action_request_fingerprint_check" CHECK ((request_fingerprint IS NULL) OR (request_fingerprint ~ '^[0-9a-f]{64}$'::text)), ADD CONSTRAINT "moderation_action_single_outcome_check" CHECK ((previous_state IS NULL) OR (previous_locked IS NULL)), ADD CONSTRAINT "moderation_action_state_outcome_check" CHECK ((previous_state IS NULL) = (resulting_state IS NULL)), ADD COLUMN "previous_state" text NULL, ADD COLUMN "resulting_state" text NULL, ADD COLUMN "previous_locked" boolean NULL, ADD COLUMN "request_fingerprint" text NULL;
-- Create index "moderation_action_actor_case_idempotency_key" to table: "moderation_action"
CREATE UNIQUE INDEX "moderation_action_actor_case_idempotency_key" ON "moderation_action" ("actor_profile_id", "case_id", "idempotency_key") WHERE (idempotency_key IS NOT NULL);
