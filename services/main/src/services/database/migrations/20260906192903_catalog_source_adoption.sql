SET search_path TO public;

-- Modify "catalog_source_mapping_claim" table
ALTER TABLE "catalog_source_mapping_claim" ADD CONSTRAINT "catalog_source_mapping_claim_record_key" UNIQUE ("source_record_id", "mapping_key", "owner");
-- Create "catalog_source_adoption_proposal" table
CREATE TABLE "catalog_source_adoption_proposal" (
  "source_record_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "snapshot_id" uuid NOT NULL,
  "mapping_key" uuid NOT NULL,
  "mapping_owner" text NOT NULL,
  "mapping_version" text NOT NULL,
  "expected_target_revision" bigint NOT NULL,
  "proposer_auth_user_id" uuid NULL,
  "state" text NOT NULL DEFAULT 'pending',
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("source_record_id", "id"),
  CONSTRAINT "catalog_adoption_snapshot_mapping_key" UNIQUE ("source_record_id", "snapshot_id", "mapping_key", "mapping_version"),
  CONSTRAINT "catalog_adoption_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_adoption_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_adoption_proposal_mlaSYkVG2gZM_fkey" FOREIGN KEY ("proposer_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "catalog_adoption_owner_check" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text])),
  CONSTRAINT "catalog_adoption_revision_check" CHECK ((expected_target_revision >= 1) AND (expected_target_revision <= '9007199254740991'::bigint)),
  CONSTRAINT "catalog_adoption_state_check" CHECK (state = ANY (ARRAY['pending'::text, 'applied'::text, 'rejected'::text, 'superseded'::text])),
  CONSTRAINT "catalog_adoption_version_check" CHECK ((octet_length(mapping_version) >= 1) AND (octet_length(mapping_version) <= 128))
);
-- Create index "catalog_adoption_mapping_idx" to table: "catalog_source_adoption_proposal"
CREATE INDEX "catalog_adoption_mapping_idx" ON "catalog_source_adoption_proposal" ("mapping_key", "mapping_owner", "source_record_id", "id");
-- Create index "catalog_adoption_pending_idx" to table: "catalog_source_adoption_proposal"
CREATE INDEX "catalog_adoption_pending_idx" ON "catalog_source_adoption_proposal" ("state", "created_at", "source_record_id", "id");
-- Create index "catalog_adoption_proposer_idx" to table: "catalog_source_adoption_proposal"
CREATE INDEX "catalog_adoption_proposer_idx" ON "catalog_source_adoption_proposal" ("proposer_auth_user_id", "source_record_id", "id");
