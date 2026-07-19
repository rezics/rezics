-- Add value to enum type: "unit_access_subject_kind"
ALTER TYPE "unit_access_subject_kind" ADD VALUE 'system';
-- Create enum type "entity_association_kind"
CREATE TYPE "entity_association_kind" AS ENUM ('credit', 'subject');
-- Create enum type "entity_association_policy_mode"
CREATE TYPE "entity_association_policy_mode" AS ENUM ('open', 'owner_only', 'closed');
-- Modify "unit_access_binding" table
ALTER TABLE "unit_access_binding" DROP CONSTRAINT "unit_access_binding_subject_role_check", ADD CONSTRAINT "unit_access_binding_subject_role_check" CHECK (((subject_kind = ANY (ARRAY['profile'::unit_access_subject_kind, 'system'::unit_access_subject_kind])) OR (role <> 'owner'::unit_access_role)) AND ((subject_kind <> 'authenticated'::unit_access_subject_kind) OR (role = ANY (ARRAY['viewer'::unit_access_role, 'editor'::unit_access_role]))) AND ((subject_kind <> 'system'::unit_access_subject_kind) OR (role = 'owner'::unit_access_role))), DROP CONSTRAINT "unit_access_binding_subject_shape_check", ADD CONSTRAINT "unit_access_binding_subject_shape_check" CHECK (((subject_kind = 'profile'::unit_access_subject_kind) AND (profile_id IS NOT NULL) AND (realm_id IS NULL) AND (realm_relation IS NULL)) OR ((subject_kind = 'realm'::unit_access_subject_kind) AND (profile_id IS NULL) AND (realm_id IS NOT NULL) AND (realm_relation IS NOT NULL)) OR ((subject_kind = 'authenticated'::unit_access_subject_kind) AND (profile_id IS NULL) AND (realm_id IS NULL) AND (realm_relation IS NULL)) OR ((subject_kind = 'system'::unit_access_subject_kind) AND (profile_id IS NULL) AND (realm_id IS NULL) AND (realm_relation IS NULL))), ADD CONSTRAINT "unit_access_binding_owner_scope_check" CHECK ((role <> 'owner'::unit_access_role) OR (cardinality(scope) = 0));
-- Create index "unit_access_binding_active_system_scope_key" to table: "unit_access_binding"
CREATE UNIQUE INDEX "unit_access_binding_active_system_scope_key" ON "unit_access_binding" ("unit_id", "scope") WHERE ((revoked_at IS NULL) AND (subject_kind = 'system'::unit_access_subject_kind));
-- Create "entity_association_policy" table
CREATE TABLE "entity_association_policy" (
  "entity_id" uuid NOT NULL,
  "kind" "entity_association_kind" NOT NULL,
  "mode" "entity_association_policy_mode" NOT NULL DEFAULT 'open',
  "updated_by_profile_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("entity_id", "kind"),
  CONSTRAINT "entity_association_policy_entity_id_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "entity_association_policy_updated_by_profile_id_profile_id_fkey" FOREIGN KEY ("updated_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "entity_association_policy_updated_by_idx" to table: "entity_association_policy"
CREATE INDEX "entity_association_policy_updated_by_idx" ON "entity_association_policy" ("updated_by_profile_id");
-- Create "subject_association" table
CREATE TABLE "subject_association" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "unit_id" uuid NOT NULL,
  "entity_id" uuid NOT NULL,
  "role" text NOT NULL,
  "position" text NOT NULL DEFAULT 'a0' COLLATE "C",
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "subject_association_unit_entity_role_key" UNIQUE ("unit_id", "entity_id", "role"),
  CONSTRAINT "subject_association_entity_id_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "subject_association_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "subject_association_not_self_check" CHECK (unit_id <> entity_id),
  CONSTRAINT "subject_association_role_not_blank" CHECK (btrim(role) <> ''::text)
);
-- Create index "subject_association_entity_role_idx" to table: "subject_association"
CREATE INDEX "subject_association_entity_role_idx" ON "subject_association" ("entity_id", "role");
-- Create index "subject_association_unit_position_idx" to table: "subject_association"
CREATE INDEX "subject_association_unit_position_idx" ON "subject_association" ("unit_id", "position", "id");
-- Drop "subject_attribution" table
DROP TABLE "subject_attribution";
