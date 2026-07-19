-- Create enum type "governance_reason_code"
CREATE TYPE "governance_reason_code" AS ENUM ('content_policy', 'realm_rules', 'spam', 'harassment', 'unsafe_content', 'off_topic', 'duplicate', 'account_security', 'user_request', 'appeal', 'administrative', 'other');
-- Modify "audit_event" table
ALTER TABLE "audit_event" DROP CONSTRAINT "audit_event_action_check", ADD CONSTRAINT "audit_event_action_check" CHECK ((btrim(action) <> ''::text) AND (btrim(decision_code) <> ''::text)), DROP COLUMN "reason";
-- Modify "feedback" table
ALTER TABLE "feedback" DROP CONSTRAINT "feedback_content_not_blank", DROP CONSTRAINT "feedback_resolution_check", ADD CONSTRAINT "feedback_resolution_check" CHECK (((resolved_at IS NULL) AND (resolved_by_profile_id IS NULL) AND (resolution_code IS NULL)) OR ((resolved_at IS NOT NULL) AND (resolved_by_profile_id IS NOT NULL) AND (resolution_code IS NOT NULL))), DROP COLUMN "content", DROP COLUMN "resolution", ADD COLUMN "resolution_code" "governance_reason_code" NULL;
-- Modify "governance_post_binding" table
ALTER TABLE "governance_post_binding" DROP CONSTRAINT "governance_post_binding_subject_role_key";
-- Create index "governance_post_binding_subject_role_idx" to table: "governance_post_binding"
CREATE INDEX "governance_post_binding_subject_role_idx" ON "governance_post_binding" ("subject_kind", "subject_id", "role");
-- Modify "moderation_action" table
ALTER TABLE "moderation_action" DROP CONSTRAINT "moderation_action_reason_code_check", ALTER COLUMN "reason_code" TYPE "governance_reason_code" USING "reason_code"::"governance_reason_code", DROP COLUMN "reason", DROP COLUMN "public_message";
-- Modify "moderation_case" table
ALTER TABLE "moderation_case" DROP COLUMN "reason", DROP COLUMN "safe_summary";
-- Modify "unit_access_restriction" table
ALTER TABLE "unit_access_restriction" DROP CONSTRAINT "unit_access_restriction_reason_check", DROP COLUMN "reason", ADD COLUMN "reason_code" "governance_reason_code" NOT NULL;
-- Modify "unit_protection" table
ALTER TABLE "unit_protection" DROP CONSTRAINT "unit_protection_reason_check", DROP COLUMN "reason", ADD COLUMN "reason_code" "governance_reason_code" NOT NULL;
