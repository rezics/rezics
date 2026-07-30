-- Create enum type "unit_ownership_claim_resolution"
CREATE TYPE "unit_ownership_claim_resolution" AS ENUM ('approved', 'rejected', 'withdrawn', 'superseded');
-- Create "unit_ownership_claim" table
CREATE TABLE "unit_ownership_claim" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "unit_id" uuid NOT NULL,
  "claimant_profile_id" uuid NOT NULL,
  "source_ownership_id" uuid NOT NULL,
  "details" text NOT NULL,
  "resolution" "unit_ownership_claim_resolution" NULL,
  "resolved_at" timestamptz(3) NULL,
  "resolved_by_profile_id" uuid NULL,
  "resulting_ownership_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "unit_ownership_claim_DCHXcYeTHQOw_fkey" FOREIGN KEY ("resulting_ownership_id") REFERENCES "unit_ownership" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_ownership_claim_claimant_profile_id_profile_id_fkey" FOREIGN KEY ("claimant_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_ownership_claim_resolved_by_profile_id_profile_id_fkey" FOREIGN KEY ("resolved_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_ownership_claim_source_ownership_id_unit_ownership_id_fkey" FOREIGN KEY ("source_ownership_id") REFERENCES "unit_ownership" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_ownership_claim_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_ownership_claim_details_length" CHECK (char_length(details) <= 2000),
  CONSTRAINT "unit_ownership_claim_details_not_blank" CHECK (btrim(details) <> ''::text),
  CONSTRAINT "unit_ownership_claim_distinct_ownership_check" CHECK ((resulting_ownership_id IS NULL) OR (resulting_ownership_id <> source_ownership_id)),
  CONSTRAINT "unit_ownership_claim_resolution_current_check" CHECK (resolution = ANY (ARRAY['approved'::unit_ownership_claim_resolution, 'rejected'::unit_ownership_claim_resolution, 'withdrawn'::unit_ownership_claim_resolution, 'superseded'::unit_ownership_claim_resolution])),
  CONSTRAINT "unit_ownership_claim_resolution_shape_check" CHECK (((resolution IS NULL) AND (resolved_at IS NULL) AND (resolved_by_profile_id IS NULL) AND (resulting_ownership_id IS NULL)) OR ((resolution = 'approved'::unit_ownership_claim_resolution) AND (resolved_at IS NOT NULL) AND (resolved_by_profile_id IS NOT NULL) AND (resulting_ownership_id IS NOT NULL)) OR ((resolution = ANY (ARRAY['rejected'::unit_ownership_claim_resolution, 'withdrawn'::unit_ownership_claim_resolution, 'superseded'::unit_ownership_claim_resolution])) AND (resolved_at IS NOT NULL) AND (resolved_by_profile_id IS NOT NULL) AND (resulting_ownership_id IS NULL)))
);
-- Create index "unit_ownership_claim_claimant_created_at_idx" to table: "unit_ownership_claim"
CREATE INDEX "unit_ownership_claim_claimant_created_at_idx" ON "unit_ownership_claim" ("claimant_profile_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
-- Create index "unit_ownership_claim_pending_created_at_idx" to table: "unit_ownership_claim"
CREATE INDEX "unit_ownership_claim_pending_created_at_idx" ON "unit_ownership_claim" ("created_at", "id") WHERE (resolution IS NULL);
-- Create index "unit_ownership_claim_pending_profile_unit_key" to table: "unit_ownership_claim"
CREATE UNIQUE INDEX "unit_ownership_claim_pending_profile_unit_key" ON "unit_ownership_claim" ("unit_id", "claimant_profile_id") WHERE (resolution IS NULL);
-- Create index "unit_ownership_claim_resulting_ownership_key" to table: "unit_ownership_claim"
CREATE UNIQUE INDEX "unit_ownership_claim_resulting_ownership_key" ON "unit_ownership_claim" ("resulting_ownership_id") WHERE (resulting_ownership_id IS NOT NULL);
-- Create index "unit_ownership_claim_source_ownership_idx" to table: "unit_ownership_claim"
CREATE INDEX "unit_ownership_claim_source_ownership_idx" ON "unit_ownership_claim" ("source_ownership_id");
-- Create index "unit_ownership_claim_unit_created_at_idx" to table: "unit_ownership_claim"
CREATE INDEX "unit_ownership_claim_unit_created_at_idx" ON "unit_ownership_claim" ("unit_id", "created_at" DESC NULLS LAST, "id" DESC NULLS LAST);
