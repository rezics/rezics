SET LOCAL search_path = public;

-- Create enum type "unit_revision_attribution_assurance"
CREATE TYPE "unit_revision_attribution_assurance" AS ENUM ('self_declared', 'credential_bound', 'server_observed');
-- Create enum type "unit_revision_contribution_role"
CREATE TYPE "unit_revision_contribution_role" AS ENUM ('creator', 'editor', 'translator', 'researcher');
-- Create enum type "unit_revision_primary_contribution_kind"
CREATE TYPE "unit_revision_primary_contribution_kind" AS ENUM ('unattributed', 'human', 'ai');
-- Modify "unit_revision" table
ALTER TABLE "unit_revision"
    ADD COLUMN "primary_contribution_kind" "unit_revision_primary_contribution_kind" NOT NULL DEFAULT 'unattributed',
    ADD COLUMN "credited_entity_id" uuid NULL,
    ADD COLUMN "credit_role" "unit_revision_contribution_role" NULL,
    ADD COLUMN "attribution_assurance" "unit_revision_attribution_assurance" NULL,
    ADD CONSTRAINT "unit_revision_credited_entity_id_entity_id_fkey"
        FOREIGN KEY ("credited_entity_id") REFERENCES "entity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT NOT VALID,
    ADD CONSTRAINT "unit_revision_primary_contribution_shape_check"
        CHECK (((primary_contribution_kind = 'ai'::unit_revision_primary_contribution_kind) AND (actor_profile_id IS NOT NULL) AND (credited_entity_id IS NOT NULL) AND (credit_role IS NOT NULL) AND (attribution_assurance IS NOT NULL)) OR ((primary_contribution_kind = ANY (ARRAY['human'::unit_revision_primary_contribution_kind, 'unattributed'::unit_revision_primary_contribution_kind])) AND (credited_entity_id IS NULL) AND (credit_role IS NULL) AND (attribution_assurance IS NULL) AND ((primary_contribution_kind = 'unattributed'::unit_revision_primary_contribution_kind) OR (actor_profile_id IS NOT NULL)))) NOT VALID;
-- Create index "unit_revision_ai_entity_created_at_idx" to table: "unit_revision"
CREATE INDEX "unit_revision_ai_entity_created_at_idx" ON "unit_revision" ("credited_entity_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE (primary_contribution_kind = 'ai'::unit_revision_primary_contribution_kind);
