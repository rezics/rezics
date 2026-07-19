-- Add value to enum type: "moderation_action_kind"
ALTER TYPE "moderation_action_kind" ADD VALUE 'hide' AFTER 'approve';
-- Add value to enum type: "post_kind"
ALTER TYPE "post_kind" ADD VALUE 'governance_note';
-- Create enum type "governance_note_role"
CREATE TYPE "governance_note_role" AS ENUM ('evidence', 'internal_note', 'public_notice');
-- Create enum type "governance_note_subject_kind"
CREATE TYPE "governance_note_subject_kind" AS ENUM ('feedback', 'moderation_case', 'moderation_action', 'unit_access_restriction', 'unit_protection', 'realm_unit_status_event');
-- Create "governance_post_binding" table
CREATE TABLE "governance_post_binding" (
  "post_id" uuid NOT NULL,
  "revision_id" uuid NOT NULL,
  "subject_kind" "governance_note_subject_kind" NOT NULL,
  "subject_id" uuid NOT NULL,
  "role" "governance_note_role" NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("post_id"),
  CONSTRAINT "governance_post_binding_subject_role_key" UNIQUE ("subject_kind", "subject_id", "role"),
  CONSTRAINT "governance_post_binding_post_id_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "governance_post_binding_revision_post_fkey" FOREIGN KEY ("revision_id", "post_id") REFERENCES "unit_revision" ("id", "unit_id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "governance_post_binding_subject_idx" to table: "governance_post_binding"
CREATE INDEX "governance_post_binding_subject_idx" ON "governance_post_binding" ("subject_kind", "subject_id");
-- Modify "realm_unit_status_event" table
ALTER TABLE "realm_unit_status_event" DROP CONSTRAINT "realm_unit_status_event_realm_unit_fkey", ADD COLUMN "moderation_action_id" uuid NULL, ADD CONSTRAINT "realm_unit_status_event_action_key" UNIQUE ("moderation_action_id"), ADD CONSTRAINT "realm_unit_status_event_moderation_action_fkey" FOREIGN KEY ("moderation_action_id") REFERENCES "moderation_action" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "realm_unit_status_event_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "realm_unit_status_event_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
