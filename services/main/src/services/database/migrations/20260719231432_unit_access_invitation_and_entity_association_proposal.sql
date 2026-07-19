-- Add value to enum type: "unit_permission"
ALTER TYPE "unit_permission" ADD VALUE 'unit.association.manage' AFTER 'unit.access.manage';
-- Create enum type "entity_association_proposal_direction"
CREATE TYPE "entity_association_proposal_direction" AS ENUM ('request', 'invitation');
-- Create enum type "entity_association_proposal_resolution"
CREATE TYPE "entity_association_proposal_resolution" AS ENUM ('accepted', 'declined', 'cancelled');
-- Create enum type "unit_access_invitation_resolution"
CREATE TYPE "unit_access_invitation_resolution" AS ENUM ('accepted', 'declined', 'cancelled');
-- Create "entity_association_proposal" table
CREATE TABLE "entity_association_proposal" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "source_unit_id" uuid NOT NULL,
  "target_entity_id" uuid NOT NULL,
  "kind" "entity_association_kind" NOT NULL,
  "role" text NOT NULL,
  "direction" "entity_association_proposal_direction" NOT NULL,
  "created_by_profile_id" uuid NOT NULL,
  "expires_at" timestamptz(3) NOT NULL,
  "resolution" "entity_association_proposal_resolution" NULL,
  "resolved_at" timestamptz(3) NULL,
  "resolved_by_profile_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "entity_association_proposal_QnKvbbF3bXlN_fkey" FOREIGN KEY ("resolved_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_association_proposal_ncDq83oJKy7B_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_association_proposal_source_unit_id_unit_id_fkey" FOREIGN KEY ("source_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "entity_association_proposal_target_entity_id_entity_id_fkey" FOREIGN KEY ("target_entity_id") REFERENCES "entity" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "entity_association_proposal_expiry_check" CHECK (expires_at > created_at),
  CONSTRAINT "entity_association_proposal_not_self_check" CHECK (source_unit_id <> target_entity_id),
  CONSTRAINT "entity_association_proposal_resolution_shape_check" CHECK (((resolution IS NULL) AND (resolved_at IS NULL) AND (resolved_by_profile_id IS NULL)) OR ((resolution IS NOT NULL) AND (resolved_at IS NOT NULL) AND (resolved_by_profile_id IS NOT NULL))),
  CONSTRAINT "entity_association_proposal_role_not_blank" CHECK (btrim(role) <> ''::text)
);
-- Create index "entity_association_proposal_created_by_idx" to table: "entity_association_proposal"
CREATE INDEX "entity_association_proposal_created_by_idx" ON "entity_association_proposal" ("created_by_profile_id");
-- Create index "entity_association_proposal_resolved_by_idx" to table: "entity_association_proposal"
CREATE INDEX "entity_association_proposal_resolved_by_idx" ON "entity_association_proposal" ("resolved_by_profile_id");
-- Create index "entity_association_proposal_source_unresolved_idx" to table: "entity_association_proposal"
CREATE INDEX "entity_association_proposal_source_unresolved_idx" ON "entity_association_proposal" ("source_unit_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE (resolution IS NULL);
-- Create index "entity_association_proposal_target_unresolved_idx" to table: "entity_association_proposal"
CREATE INDEX "entity_association_proposal_target_unresolved_idx" ON "entity_association_proposal" ("target_entity_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE (resolution IS NULL);
-- Create "unit_access_invitation" table
CREATE TABLE "unit_access_invitation" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "unit_id" uuid NOT NULL,
  "invited_profile_id" uuid NOT NULL,
  "role" "unit_access_role" NOT NULL,
  "scope" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "invited_by_profile_id" uuid NOT NULL,
  "expires_at" timestamptz(3) NOT NULL,
  "access_expires_at" timestamptz(3) NULL,
  "resolution" "unit_access_invitation_resolution" NULL,
  "resolved_at" timestamptz(3) NULL,
  "resolved_by_profile_id" uuid NULL,
  "accepted_binding_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "unit_access_invitation_gah6S6DqDKkr_fkey" FOREIGN KEY ("accepted_binding_id") REFERENCES "unit_access_binding" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_access_invitation_invited_by_profile_id_profile_id_fkey" FOREIGN KEY ("invited_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_access_invitation_invited_profile_id_profile_id_fkey" FOREIGN KEY ("invited_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_access_invitation_resolved_by_profile_id_profile_id_fkey" FOREIGN KEY ("resolved_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_access_invitation_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_access_invitation_expiry_check" CHECK ((expires_at > created_at) AND ((access_expires_at IS NULL) OR (access_expires_at > created_at))),
  CONSTRAINT "unit_access_invitation_profiles_differ_check" CHECK (invited_profile_id <> invited_by_profile_id),
  CONSTRAINT "unit_access_invitation_resolution_shape_check" CHECK (((resolution IS NULL) AND (resolved_at IS NULL) AND (resolved_by_profile_id IS NULL) AND (accepted_binding_id IS NULL)) OR ((resolution = 'accepted'::unit_access_invitation_resolution) AND (resolved_at IS NOT NULL) AND (resolved_by_profile_id IS NOT NULL) AND (accepted_binding_id IS NOT NULL)) OR ((resolution = ANY (ARRAY['declined'::unit_access_invitation_resolution, 'cancelled'::unit_access_invitation_resolution])) AND (resolved_at IS NOT NULL) AND (resolved_by_profile_id IS NOT NULL) AND (accepted_binding_id IS NULL))),
  CONSTRAINT "unit_access_invitation_role_check" CHECK (role <> 'owner'::unit_access_role),
  CONSTRAINT "unit_access_invitation_scope_check" CHECK ((cardinality(scope) <= 8) AND ((cardinality(scope) = 0) OR (array_to_string(scope, '/'::text) ~ '^[a-z0-9][a-z0-9-]*(/[a-z0-9][a-z0-9-]*)*$'::text)))
);
-- Create index "unit_access_invitation_accepted_binding_key" to table: "unit_access_invitation"
CREATE UNIQUE INDEX "unit_access_invitation_accepted_binding_key" ON "unit_access_invitation" ("accepted_binding_id") WHERE (accepted_binding_id IS NOT NULL);
-- Create index "unit_access_invitation_invited_by_idx" to table: "unit_access_invitation"
CREATE INDEX "unit_access_invitation_invited_by_idx" ON "unit_access_invitation" ("invited_by_profile_id");
-- Create index "unit_access_invitation_profile_unresolved_idx" to table: "unit_access_invitation"
CREATE INDEX "unit_access_invitation_profile_unresolved_idx" ON "unit_access_invitation" ("invited_profile_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE (resolution IS NULL);
-- Create index "unit_access_invitation_resolved_by_idx" to table: "unit_access_invitation"
CREATE INDEX "unit_access_invitation_resolved_by_idx" ON "unit_access_invitation" ("resolved_by_profile_id");
-- Create index "unit_access_invitation_unit_unresolved_idx" to table: "unit_access_invitation"
CREATE INDEX "unit_access_invitation_unit_unresolved_idx" ON "unit_access_invitation" ("unit_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST) WHERE (resolution IS NULL);
