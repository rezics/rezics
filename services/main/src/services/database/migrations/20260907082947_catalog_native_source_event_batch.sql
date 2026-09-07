SET search_path TO public;

-- Breaking fresh-target replacement of the pre-partition source contract.
-- Existing source UUIDs are not a conversion input: new source IDs are deterministic.
-- This discards exactly these source parents and their rows. CASCADE removes inbound
-- foreign keys (not their owning native/support tables); the typed diff recreates them.
-- Nonempty native support may refer to discarded source evidence and is not promised
-- convertible by this migration. Legacy/offline data migration is a separate input.
DROP TABLE
  public.catalog_source_adoption_proposal,
  public.publishing_source_binding,
  public.music_source_binding,
  public.program_source_binding,
  public.software_source_binding,
  public.entity_source_binding,
  public.grouping_source_binding,
  public.reference_source_binding,
  public.catalog_source_mapping_claim,
  public.catalog_source_snapshot,
  public.catalog_source_record
CASCADE;

-- Modify "catalog_unit_locator" table
ALTER TABLE "catalog_unit_locator" DROP CONSTRAINT "catalog_unit_locator_owner_check", ADD CONSTRAINT "catalog_unit_locator_owner_check" CHECK (owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text]));
-- Modify "entity_catalog_profile" table
ALTER TABLE "entity_catalog_profile" DROP CONSTRAINT "entity_catalog_profile_shape_check", ADD CONSTRAINT "entity_catalog_profile_shape_check" CHECK (identity_shape = ANY (ARRAY['person'::text, 'organization'::text, 'character'::text, 'label'::text, 'collective'::text, 'unresolved'::text, 'service_actor'::text])), ADD CONSTRAINT "entity_catalog_profile_gender_shape_check" CHECK ((gender_revision_id IS NULL) OR (identity_shape = ANY (ARRAY['person'::text, 'character'::text, 'unresolved'::text])));
-- Modify "entity_fact_value_node" table
ALTER TABLE "entity_fact_value_node" ADD CONSTRAINT "entity_fact_node_rule_check" CHECK ((rule_position >= 0) AND (rule_position <= 127)), ADD COLUMN "rule_position" integer NOT NULL DEFAULT 0, ADD CONSTRAINT "entity_fact_node_member_key" UNIQUE ("owner_id", "fact_id", "parent_position", "member_key");
-- Modify "grouping_fact_value_node" table
ALTER TABLE "grouping_fact_value_node" ADD CONSTRAINT "grouping_fact_node_rule_check" CHECK ((rule_position >= 0) AND (rule_position <= 127)), ADD COLUMN "rule_position" integer NOT NULL DEFAULT 0, ADD CONSTRAINT "grouping_fact_node_member_key" UNIQUE ("owner_id", "fact_id", "parent_position", "member_key");
-- Modify "grouping_order_entry" table
ALTER TABLE "grouping_order_entry" ADD CONSTRAINT "grouping_order_entry_source_position_check" CHECK ((source_position IS NULL) OR (octet_length(source_position) <= 4096));
-- Modify "music_disc_toc_offset" table
ALTER TABLE "music_disc_toc_offset" DROP CONSTRAINT "music_disc_toc_offset_check", ADD CONSTRAINT "music_disc_toc_offset_check" CHECK ((("position" >= 0) AND ("position" <= 98)) AND (("offset" >= 0) AND ("offset" <= '9007199254740991'::bigint)));
-- Modify "music_fact_value_node" table
ALTER TABLE "music_fact_value_node" ADD CONSTRAINT "music_fact_node_rule_check" CHECK ((rule_position >= 0) AND (rule_position <= 127)), ADD COLUMN "rule_position" integer NOT NULL DEFAULT 0, ADD CONSTRAINT "music_fact_node_member_key" UNIQUE ("owner_id", "fact_id", "parent_position", "member_key");
-- Modify "program_fact_value_node" table
ALTER TABLE "program_fact_value_node" ADD CONSTRAINT "program_fact_node_rule_check" CHECK ((rule_position >= 0) AND (rule_position <= 127)), ADD COLUMN "rule_position" integer NOT NULL DEFAULT 0, ADD CONSTRAINT "program_fact_node_member_key" UNIQUE ("owner_id", "fact_id", "parent_position", "member_key");
-- Modify "publishing_fact_value_node" table
ALTER TABLE "publishing_fact_value_node" ADD CONSTRAINT "publishing_fact_node_rule_check" CHECK ((rule_position >= 0) AND (rule_position <= 127)), ADD COLUMN "rule_position" integer NOT NULL DEFAULT 0, ADD CONSTRAINT "publishing_fact_node_member_key" UNIQUE ("owner_id", "fact_id", "parent_position", "member_key");
-- Modify "reference_fact_value_node" table
ALTER TABLE "reference_fact_value_node" ADD CONSTRAINT "reference_fact_node_rule_check" CHECK ((rule_position >= 0) AND (rule_position <= 127)), ADD COLUMN "rule_position" integer NOT NULL DEFAULT 0, ADD CONSTRAINT "reference_fact_node_member_key" UNIQUE ("owner_id", "fact_id", "parent_position", "member_key");
-- Modify "reference_place" table
ALTER TABLE "reference_place" ADD CONSTRAINT "reference_place_begin_check" CHECK (((date_month IS NULL) OR ((date_month >= 1) AND (date_month <= 12))) AND ((date_day IS NULL) OR ((date_day >= 1) AND (date_day <= 31))) AND ((date_month IS NULL) OR (date_day IS NULL) OR (date_day <=
CASE
    WHEN (date_month = ANY (ARRAY[4, 6, 9, 11])) THEN 30
    WHEN (date_month = 2) THEN
    CASE
        WHEN ((date_year IS NULL) OR (mod(date_year, 400) = 0) OR ((mod(date_year, 4) = 0) AND (mod(date_year, 100) <> 0))) THEN 29
        ELSE 28
    END
    ELSE 31
END))), ADD CONSTRAINT "reference_place_end_check" CHECK (((end_month IS NULL) OR ((end_month >= 1) AND (end_month <= 12))) AND ((end_day IS NULL) OR ((end_day >= 1) AND (end_day <= 31))) AND ((end_month IS NULL) OR (end_day IS NULL) OR (end_day <=
CASE
    WHEN (end_month = ANY (ARRAY[4, 6, 9, 11])) THEN 30
    WHEN (end_month = 2) THEN
    CASE
        WHEN ((end_year IS NULL) OR (mod(end_year, 400) = 0) OR ((mod(end_year, 4) = 0) AND (mod(end_year, 100) <> 0))) THEN 29
        ELSE 28
    END
    ELSE 31
END))), ADD COLUMN "date_year" integer NULL, ADD COLUMN "date_month" smallint NULL, ADD COLUMN "date_day" smallint NULL, ADD COLUMN "date_text" text NULL, ADD COLUMN "end_year" integer NULL, ADD COLUMN "end_month" smallint NULL, ADD COLUMN "end_day" smallint NULL, ADD COLUMN "end_text" text NULL, ADD COLUMN "ended" boolean NULL;
-- Modify "software_fact_value_node" table
ALTER TABLE "software_fact_value_node" ADD CONSTRAINT "software_fact_node_rule_check" CHECK ((rule_position >= 0) AND (rule_position <= 127)), ADD COLUMN "rule_position" integer NOT NULL DEFAULT 0, ADD CONSTRAINT "software_fact_node_member_key" UNIQUE ("owner_id", "fact_id", "parent_position", "member_key");
-- Modify "software_release_language" table
ALTER TABLE "software_release_language" ADD CONSTRAINT "software_release_language_title_check" CHECK (((title IS NULL) OR (octet_length(title) <= 131072)) AND ((transliterated_title IS NULL) OR (octet_length(transliterated_title) <= 131072))), ADD COLUMN "title" text NULL, ADD COLUMN "transliterated_title" text NULL;
-- Create "catalog_source_provider_budget" table
CREATE TABLE "catalog_source_provider_budget" (
  "source" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "minimum_interval_ms" integer NOT NULL DEFAULT 1100,
  "next_allowed_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("source"),
  CONSTRAINT "catalog_source_provider_budget_check" CHECK ((source = ANY (ARRAY['musicbrainz'::text, 'vndb'::text, 'bangumi'::text])) AND ((minimum_interval_ms >= 1000) AND (minimum_interval_ms <= 86400000)))
);
-- Create "catalog_source_record" table
CREATE TABLE "catalog_source_record" (
  "id" uuid NOT NULL,
  "source" text NOT NULL,
  "object_type" text NOT NULL,
  "external_id" text NOT NULL,
  "acquisition_generation" bigint NOT NULL DEFAULT 0,
  "accepted_generation" bigint NOT NULL DEFAULT 0,
  "head_snapshot_id" uuid NULL,
  "last_checked_at" timestamptz(3) NULL,
  "last_check_outcome" text NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "catalog_source_record_generation_check" CHECK (((accepted_generation >= 0) AND (accepted_generation <= acquisition_generation)) AND (acquisition_generation <= '9007199254740991'::bigint)),
  CONSTRAINT "catalog_source_record_identity_check" CHECK (replace((id)::text, '-'::text, ''::text) = OVERLAY(OVERLAY(substr(encode(sha256(convert_to(((((source || chr(10)) || object_type) || chr(10)) || external_id), 'UTF8'::name)), 'hex'::text), 1, 32) PLACING '8'::text FROM 13 FOR 1) PLACING '8'::text FROM 17 FOR 1)),
  CONSTRAINT "catalog_source_record_key_check" CHECK (((octet_length(source) >= 1) AND (octet_length(source) <= 96)) AND ((octet_length(object_type) >= 1) AND (octet_length(object_type) <= 96)) AND ((octet_length(external_id) >= 1) AND (octet_length(external_id) <= 512))),
  CONSTRAINT "catalog_source_record_namespace_check" CHECK ((source ~ '^[a-z][a-z0-9_.-]{0,95}$'::text) AND (object_type ~ '^[a-z][a-z0-9_.-]{0,95}$'::text)),
  CONSTRAINT "catalog_source_record_outcome_check" CHECK ((last_check_outcome IS NULL) OR (last_check_outcome = ANY (ARRAY['changed'::text, 'unchanged'::text, 'error'::text, 'tombstone'::text])))
) PARTITION BY HASH ("id");
-- Create "operational_consumer_checkpoint" table
CREATE TABLE "operational_consumer_checkpoint" (
  "routing_bucket" integer NOT NULL,
  "message_class" text NOT NULL,
  "consumer_key" text NOT NULL,
  "consumer_slot" integer NOT NULL,
  "routing_epoch" bigint NOT NULL,
  "stream_created_at" text NOT NULL,
  "next_sequence" bigint NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("routing_bucket", "message_class", "consumer_key"),
  CONSTRAINT "operational_checkpoint_slot_key" UNIQUE ("routing_bucket", "message_class", "consumer_slot"),
  CONSTRAINT "operational_checkpoint_bounds_check" CHECK (((consumer_slot >= 0) AND (consumer_slot <= 63)) AND ((routing_bucket >= 0) AND (routing_bucket <= 1023)) AND (message_class = ANY (ARRAY['event'::text, 'task'::text])) AND ((routing_epoch >= 1) AND (routing_epoch <= '9007199254740991'::bigint)) AND ((next_sequence >= 1) AND (next_sequence <= '9007199254740991'::bigint)) AND (state = ANY (ARRAY['active'::text, 'replay_required'::text])) AND ((octet_length(consumer_key) >= 1) AND (octet_length(consumer_key) <= 64)) AND ((octet_length(stream_created_at) >= 1) AND (octet_length(stream_created_at) <= 64)))
);
-- Create "catalog_source_snapshot" table
CREATE TABLE "catalog_source_snapshot" (
  "source_record_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "content_sha256" text NOT NULL,
  "contract_sha256" text NOT NULL,
  "payload_ref" text NOT NULL,
  "source_revision" text NULL,
  "observed_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("source_record_id", "id"),
  CONSTRAINT "catalog_source_snapshot_xs9oz7lSi2TU_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_snapshot_content_hash_check" CHECK ((content_sha256 ~ '^[a-f0-9]{64}$'::text) AND (contract_sha256 ~ '^[a-f0-9]{64}$'::text)),
  CONSTRAINT "catalog_source_snapshot_payload_ref_check" CHECK (length(payload_ref) > 0)
) PARTITION BY HASH ("source_record_id");
-- Create index "catalog_source_snapshot_record_time_idx" to table: "catalog_source_snapshot"
CREATE INDEX "catalog_source_snapshot_record_time_idx" ON "catalog_source_snapshot" ("source_record_id", "observed_at", "id");
-- Create "catalog_source_mapping_claim" table
CREATE TABLE "catalog_source_mapping_claim" (
  "source_record_id" uuid NOT NULL,
  "path" text NOT NULL,
  "mapping_key" uuid NOT NULL DEFAULT uuidv7(),
  "owner" text NOT NULL,
  "observed_snapshot_id" uuid NULL,
  "evidence_source_record_id" uuid NULL,
  "evidence_snapshot_id" uuid NULL,
  "evidence_path" text NULL,
  "binding_revision" bigint NOT NULL DEFAULT 1,
  "policy_revision" bigint NOT NULL DEFAULT 1,
  "state" text NOT NULL DEFAULT 'active',
  "baseline_target_revision" bigint NULL,
  "mapping_version" text NOT NULL DEFAULT 'source.manual.1',
  PRIMARY KEY ("source_record_id", "path"),
  CONSTRAINT "catalog_source_mapping_claim_record_key" UNIQUE ("source_record_id", "mapping_key", "owner"),
  CONSTRAINT "catalog_source_mapping_claim_snapshot_fk" FOREIGN KEY ("source_record_id", "observed_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_mapping_claim_w96e0BJghh19_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_mapping_reference_evidence_fk" FOREIGN KEY ("evidence_source_record_id", "evidence_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_mapping_claim_owner_check" CHECK (owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])),
  CONSTRAINT "catalog_source_mapping_claim_path_check" CHECK ((octet_length(path) >= 1) AND (octet_length(path) <= 512)),
  CONSTRAINT "catalog_source_mapping_evidence_check" CHECK (((observed_snapshot_id IS NOT NULL) AND (evidence_source_record_id IS NULL) AND (evidence_snapshot_id IS NULL) AND (evidence_path IS NULL)) OR ((observed_snapshot_id IS NULL) AND (evidence_source_record_id IS NOT NULL) AND (evidence_snapshot_id IS NOT NULL) AND (evidence_path IS NOT NULL) AND ((octet_length(evidence_path) >= 1) AND (octet_length(evidence_path) <= 512))))
) PARTITION BY HASH ("source_record_id");
-- Create index "catalog_source_mapping_claim_snapshot_idx" to table: "catalog_source_mapping_claim"
CREATE INDEX "catalog_source_mapping_claim_snapshot_idx" ON "catalog_source_mapping_claim" ("source_record_id", "observed_snapshot_id");
-- Create index "catalog_source_mapping_reference_evidence_idx" to table: "catalog_source_mapping_claim"
CREATE INDEX "catalog_source_mapping_reference_evidence_idx" ON "catalog_source_mapping_claim" ("evidence_source_record_id", "evidence_snapshot_id");
-- Create "catalog_source_adoption_proposal" table
CREATE TABLE "catalog_source_adoption_proposal" (
  "source_record_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "snapshot_id" uuid NOT NULL,
  "mapping_key" uuid NOT NULL,
  "mapping_owner" text NOT NULL,
  "mapping_version" text NOT NULL,
  "expected_target_revision" bigint NOT NULL,
  "expected_binding_revision" bigint NOT NULL DEFAULT 1,
  "expected_policy_revision" bigint NOT NULL DEFAULT 1,
  "decided_at" timestamptz(3) NULL,
  "decision_reason" text NULL,
  "applied_target_revision" bigint NULL,
  "proposer_auth_user_id" uuid NULL,
  "state" text NOT NULL DEFAULT 'pending',
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("source_record_id", "id"),
  CONSTRAINT "catalog_adoption_snapshot_mapping_key" UNIQUE ("source_record_id", "snapshot_id", "mapping_key", "mapping_version", "expected_binding_revision", "expected_policy_revision", "expected_target_revision"),
  CONSTRAINT "catalog_adoption_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_adoption_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_adoption_proposal_mlaSYkVG2gZM_fkey" FOREIGN KEY ("proposer_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "catalog_adoption_owner_check" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])),
  CONSTRAINT "catalog_adoption_revision_check" CHECK ((expected_target_revision >= 1) AND (expected_target_revision <= '9007199254740991'::bigint)),
  CONSTRAINT "catalog_adoption_state_check" CHECK (state = ANY (ARRAY['pending'::text, 'applied'::text, 'rejected'::text, 'superseded'::text, 'withdrawn'::text])),
  CONSTRAINT "catalog_adoption_version_check" CHECK ((octet_length(mapping_version) >= 1) AND (octet_length(mapping_version) <= 128))
) PARTITION BY HASH ("source_record_id");
-- Create index "catalog_adoption_mapping_idx" to table: "catalog_source_adoption_proposal"
CREATE INDEX "catalog_adoption_mapping_idx" ON "catalog_source_adoption_proposal" ("mapping_key", "mapping_owner", "source_record_id", "id");
-- Create index "catalog_adoption_pending_idx" to table: "catalog_source_adoption_proposal"
CREATE INDEX "catalog_adoption_pending_idx" ON "catalog_source_adoption_proposal" ("state", "created_at", "source_record_id", "id");
-- Create index "catalog_adoption_proposer_idx" to table: "catalog_source_adoption_proposal"
CREATE INDEX "catalog_adoption_proposer_idx" ON "catalog_source_adoption_proposal" ("proposer_auth_user_id", "source_record_id", "id");
-- Create "distribution_identity" table
CREATE TABLE "distribution_identity" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "shape" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "visibility" text NOT NULL DEFAULT 'private',
  "content_rating" text NOT NULL DEFAULT 'general',
  "moderation_status" text NOT NULL DEFAULT 'approved',
  "created_by_auth_user_id" uuid NULL,
  "revision" bigint NOT NULL DEFAULT 1,
  "routing_generation" integer NOT NULL DEFAULT 1,
  "deleted_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "distribution_identity_shape_key" UNIQUE ("id", "shape"),
  CONSTRAINT "distribution_identity_created_by_auth_user_id_users_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "distribution_identity_moderation_check" CHECK (moderation_status = ANY (ARRAY['approved'::text, 'pending'::text, 'removed'::text])),
  CONSTRAINT "distribution_identity_rating_check" CHECK (content_rating = ANY (ARRAY['general'::text, 'r15'::text, 'r18'::text, 'r18g'::text])),
  CONSTRAINT "distribution_identity_revision_check" CHECK (((revision >= 1) AND (revision <= '9007199254740991'::bigint)) AND (routing_generation > 0)),
  CONSTRAINT "distribution_identity_shape_check" CHECK (shape ~ '^[a-z][a-z0-9_.-]{0,95}$'::text),
  CONSTRAINT "distribution_identity_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])),
  CONSTRAINT "distribution_identity_visibility_check" CHECK (visibility = ANY (ARRAY['public'::text, 'unlisted'::text, 'private'::text]))
);
-- Create index "distribution_identity_creator_idx" to table: "distribution_identity"
CREATE INDEX "distribution_identity_creator_idx" ON "distribution_identity" ("created_by_auth_user_id", "id");
-- Create index "distribution_identity_shape_idx" to table: "distribution_identity"
CREATE INDEX "distribution_identity_shape_idx" ON "distribution_identity" ("shape", "id");
-- Create "catalog_source_binding_revision" table
CREATE TABLE "catalog_source_binding_revision" (
  "source_record_id" uuid NOT NULL,
  "mapping_key" uuid NOT NULL,
  "owner" text NOT NULL,
  "revision" bigint NOT NULL,
  "policy_revision" bigint NOT NULL,
  "state" text NOT NULL,
  "mode" text NOT NULL,
  "publishing_id" uuid NULL,
  "music_id" uuid NULL,
  "program_id" uuid NULL,
  "software_id" uuid NULL,
  "entity_id" uuid NULL,
  "grouping_id" uuid NULL,
  "reference_id" uuid NULL,
  "distribution_id" uuid NULL,
  "actor_auth_user_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "reason" text NOT NULL,
  PRIMARY KEY ("source_record_id", "mapping_key", "revision"),
  CONSTRAINT "catalog_source_binding_revision_2jUcc1wycEfS_fkey" FOREIGN KEY ("program_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_binding_revision_2mQhqHEuglvQ_fkey" FOREIGN KEY ("grouping_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_binding_revision_8oKh644L4iFM_fkey" FOREIGN KEY ("publishing_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_binding_revision_CG30VLDiSP9y_fkey" FOREIGN KEY ("distribution_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_binding_revision_JwcCibPkrfDA_fkey" FOREIGN KEY ("software_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_binding_revision_YblNfdn9aueJ_fkey" FOREIGN KEY ("source_record_id", "mapping_key", "owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_binding_revision_dddckcKLeOEO_fkey" FOREIGN KEY ("reference_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_binding_revision_music_id_music_identity_id_fkey" FOREIGN KEY ("music_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_binding_revision_pmeWBE993gjQ_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_binding_revision_vQCU3htLMKFT_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_binding_revision_target_check" CHECK ((num_nonnulls(publishing_id, music_id, program_id, software_id, entity_id, grouping_id, reference_id, distribution_id) = 1) AND (
CASE owner
    WHEN 'publishing'::text THEN publishing_id
    WHEN 'music'::text THEN music_id
    WHEN 'program'::text THEN program_id
    WHEN 'software'::text THEN software_id
    WHEN 'entity'::text THEN entity_id
    WHEN 'grouping'::text THEN grouping_id
    WHEN 'reference'::text THEN reference_id
    WHEN 'distribution'::text THEN distribution_id
    ELSE NULL::uuid
END IS NOT NULL)),
  CONSTRAINT "catalog_source_binding_revision_values_check" CHECK (((revision >= 1) AND (revision <= '9007199254740991'::bigint)) AND ((policy_revision >= 1) AND (policy_revision <= '9007199254740991'::bigint)) AND (state = ANY (ARRAY['active'::text, 'paused'::text, 'withdrawn'::text])) AND (mode = ANY (ARRAY['review'::text, 'manual'::text])) AND ((octet_length(reason) >= 1) AND (octet_length(reason) <= 2048)))
) PARTITION BY HASH ("source_record_id");
-- Create "catalog_source_check_plan" table
CREATE TABLE "catalog_source_check_plan" (
  "source_record_id" uuid NOT NULL,
  "routing_bucket" integer NOT NULL,
  "revision" bigint NOT NULL DEFAULT 1,
  "next_check_at" timestamptz(3) NOT NULL,
  "interval_seconds" integer NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "lease_until" timestamptz(3) NULL,
  PRIMARY KEY ("routing_bucket", "source_record_id"),
  CONSTRAINT "catalog_source_check_plan_5ZbYhCdkp7lo_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_check_bucket_check" CHECK (routing_bucket = (((get_byte(sha256(convert_to(('source_record:'::text || (source_record_id)::text), 'UTF8'::name)), 0) * 256) + get_byte(sha256(convert_to(('source_record:'::text || (source_record_id)::text), 'UTF8'::name)), 1)) % 1024)),
  CONSTRAINT "catalog_source_check_plan_limits" CHECK (((routing_bucket >= 0) AND (routing_bucket <= 1023)) AND ((revision >= 1) AND (revision <= '9007199254740991'::bigint)) AND ((interval_seconds >= 60) AND (interval_seconds <= 2592000)) AND (state = ANY (ARRAY['active'::text, 'paused'::text])))
) PARTITION BY HASH ("routing_bucket");
-- Create index "catalog_source_check_due_idx" to table: "catalog_source_check_plan"
CREATE INDEX "catalog_source_check_due_idx" ON "catalog_source_check_plan" ("routing_bucket", "state", "next_check_at", "source_record_id");
-- Create "catalog_source_check_receipt" table
CREATE TABLE "catalog_source_check_receipt" (
  "source_record_id" uuid NOT NULL,
  "generation" bigint NOT NULL,
  "outcome" text NOT NULL,
  "checked_at" timestamptz(3) NOT NULL DEFAULT now(),
  "reason" text NULL,
  PRIMARY KEY ("source_record_id", "generation"),
  CONSTRAINT "catalog_source_check_receipt_PEFmuf6TLRsX_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_check_receipt_values" CHECK (((generation >= 1) AND (generation <= '9007199254740991'::bigint)) AND (outcome = ANY (ARRAY['changed'::text, 'unchanged'::text, 'error'::text, 'tombstone'::text, 'superseded'::text])) AND ((reason IS NULL) OR (octet_length(reason) <= 2048)))
) PARTITION BY HASH ("source_record_id");
-- Create "catalog_source_observation_fanout" table
CREATE TABLE "catalog_source_observation_fanout" (
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "after_mapping_key" uuid NULL,
  "completed_at" timestamptz(3) NULL,
  PRIMARY KEY ("source_record_id", "snapshot_id"),
  CONSTRAINT "catalog_source_observation_fanout_BP24hJSHpM5m_fkey" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
) PARTITION BY HASH ("source_record_id");
-- Create "catalog_source_subscription" table
CREATE TABLE "catalog_source_subscription" (
  "source_record_id" uuid NOT NULL,
  "mapping_key" uuid NOT NULL,
  "owner" text NOT NULL,
  "revision" bigint NOT NULL DEFAULT 1,
  "state" text NOT NULL,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("source_record_id", "mapping_key"),
  CONSTRAINT "catalog_source_subscription_aeWInMzWpoe9_fkey" FOREIGN KEY ("source_record_id", "mapping_key", "owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_subscription_values_check" CHECK (((revision >= 1) AND (revision <= '9007199254740991'::bigint)) AND (state = ANY (ARRAY['active'::text, 'paused'::text])))
) PARTITION BY HASH ("source_record_id");
-- Create index "catalog_source_subscription_active_idx" to table: "catalog_source_subscription"
CREATE INDEX "catalog_source_subscription_active_idx" ON "catalog_source_subscription" ("source_record_id", "state", "mapping_key");
-- Create "distribution_catalog_change" table
CREATE TABLE "distribution_catalog_change" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "actor_auth_user_id" uuid NULL,
  "operation" text NOT NULL,
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "withdrawn_at" timestamptz(3) NULL,
  CONSTRAINT "distribution_change_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "distribution_change_version_key" UNIQUE ("owner_id", "version"),
  CONSTRAINT "distribution_catalog_change_YmqCK1d1bZ79_fkey" FOREIGN KEY ("owner_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_catalog_change_actor_auth_user_id_users_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "distribution_change_operation_check" CHECK ((length(operation) >= 1) AND (length(operation) <= 96)),
  CONSTRAINT "distribution_change_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create index "distribution_change_actor_idx" to table: "distribution_catalog_change"
CREATE INDEX "distribution_change_actor_idx" ON "distribution_catalog_change" ("actor_auth_user_id", "id");
-- Modify "catalog_definition_revision" table
ALTER TABLE "catalog_definition_revision" ADD CONSTRAINT "catalog_definition_revision_constraints_check" CHECK ((jsonb_typeof(constraints) = 'object'::text) AND (octet_length((constraints)::text) <= 262144)), ADD COLUMN "constraints" jsonb NOT NULL DEFAULT '{"integer": false, "nullable": false}';
-- Create "distribution_catalog_relation" table
CREATE TABLE "distribution_catalog_relation" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "semantic_id" uuid NOT NULL DEFAULT uuidv7(),
  "expected_head_version" bigint NOT NULL DEFAULT 0,
  "state" text NOT NULL DEFAULT 'active',
  "revision" bigint NOT NULL DEFAULT 1,
  "spoiler" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "distribution_relation_owner_id_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "distribution_catalog_relation_T55UMTEfNZkD_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_catalog_relation_x9jCWNrTLYqX_fkey" FOREIGN KEY ("owner_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_relation_head_version_check" CHECK ((expected_head_version >= 0) AND (expected_head_version <= '9007199254740990'::bigint)),
  CONSTRAINT "distribution_relation_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "distribution_relation_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)),
  CONSTRAINT "distribution_relation_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text]))
);
-- Create index "distribution_relation_definition_idx" to table: "distribution_catalog_relation"
CREATE INDEX "distribution_relation_definition_idx" ON "distribution_catalog_relation" ("definition_revision_id", "id");
-- Create index "distribution_relation_owner_idx" to table: "distribution_catalog_relation"
CREATE INDEX "distribution_relation_owner_idx" ON "distribution_catalog_relation" ("owner_id", "definition_revision_id", "id");
-- Create "distribution_fact" table
CREATE TABLE "distribution_fact" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "semantic_id" uuid NOT NULL DEFAULT uuidv7(),
  "expected_head_version" bigint NOT NULL DEFAULT 0,
  "state" text NOT NULL DEFAULT 'active',
  "last_node_position" bigint NOT NULL DEFAULT -1,
  "spoiler" integer NOT NULL DEFAULT 0,
  "sealed_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "distribution_fact_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "distribution_fact_QKWdZniNftPP_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_fact_owner_id_distribution_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_fact_head_version_check" CHECK ((expected_head_version >= 0) AND (expected_head_version <= '9007199254740990'::bigint)),
  CONSTRAINT "distribution_fact_node_cursor_check" CHECK (((last_node_position >= '-1'::integer) AND (last_node_position <= '9007199254740991'::bigint)) AND ((sealed_at IS NULL) OR (last_node_position >= 0))),
  CONSTRAINT "distribution_fact_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)),
  CONSTRAINT "distribution_fact_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text]))
);
-- Create index "distribution_fact_definition_idx" to table: "distribution_fact"
CREATE INDEX "distribution_fact_definition_idx" ON "distribution_fact" ("definition_revision_id", "id");
-- Create index "distribution_fact_owner_idx" to table: "distribution_fact"
CREATE INDEX "distribution_fact_owner_idx" ON "distribution_fact" ("owner_id", "definition_revision_id", "id");
-- Create "distribution_identifier_claim" table
CREATE TABLE "distribution_identifier_claim" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "namespace" text NOT NULL,
  "value" text NOT NULL,
  "normalized_value" text NOT NULL,
  "normalization_policy" text NOT NULL DEFAULT 'exact.1',
  "validation_status" text NOT NULL DEFAULT 'unvalidated',
  "issuer_entity_id" uuid NULL,
  "state" text NOT NULL DEFAULT 'active',
  CONSTRAINT "distribution_identifier_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "distribution_identifier_claim_8MFABncUGBl6_fkey" FOREIGN KEY ("issuer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_identifier_claim_SeVOmpg0b4e3_fkey" FOREIGN KEY ("owner_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_identifier_claim_SteGHHjM906i_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_identifier_namespace_check" CHECK (namespace ~ '^[a-z][a-z0-9_.:-]{0,127}$'::text),
  CONSTRAINT "distribution_identifier_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "distribution_identifier_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "distribution_identifier_validation_check" CHECK (validation_status = ANY (ARRAY['unvalidated'::text, 'valid'::text])),
  CONSTRAINT "distribution_identifier_value_check" CHECK (((octet_length(value) >= 1) AND (octet_length(value) <= 512)) AND ((octet_length(normalized_value) >= 1) AND (octet_length(normalized_value) <= 512)) AND ((octet_length(normalization_policy) >= 1) AND (octet_length(normalization_policy) <= 96)))
);
-- Create index "distribution_identifier_issuer_idx" to table: "distribution_identifier_claim"
CREATE INDEX "distribution_identifier_issuer_idx" ON "distribution_identifier_claim" ("issuer_entity_id", "id") WHERE (issuer_entity_id IS NOT NULL);
-- Create index "distribution_identifier_lookup_idx" to table: "distribution_identifier_claim"
CREATE INDEX "distribution_identifier_lookup_idx" ON "distribution_identifier_claim" ("namespace", "normalized_value", "owner_id", "id");
-- Create "distribution_named_form" table
CREATE TABLE "distribution_named_form" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "language_tag" text NULL,
  "private_use_namespace" text NULL,
  "language_policy" text NULL,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "sort_name" text NULL,
  "origin" text NOT NULL DEFAULT 'unknown',
  "translation_method" text NOT NULL DEFAULT 'unknown',
  "primary_for_language" boolean NULL,
  "scope_owner_id" uuid NULL,
  "territory" text NULL,
  "context" text NULL,
  "derivation_name_id" uuid NULL,
  "derivation_revision" bigint NULL,
  "begin" jsonb NULL,
  "end" jsonb NULL,
  "ended" boolean NULL,
  "spoiler" integer NOT NULL DEFAULT 0,
  "state" text NOT NULL DEFAULT 'active',
  CONSTRAINT "distribution_named_form_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "distribution_named_form_na2mrWBbAISs_fkey" FOREIGN KEY ("scope_owner_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_named_form_owner_id_distribution_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_named_form_recorded_by_auth_user_id_users_id_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_named_form_derivation_check" CHECK (num_nonnulls(derivation_name_id, derivation_revision) = ANY (ARRAY[0, 2])),
  CONSTRAINT "distribution_named_form_kind_check" CHECK ((octet_length(kind) >= 1) AND (octet_length(kind) <= 96)),
  CONSTRAINT "distribution_named_form_language_check" CHECK (((language_tag IS NULL) AND (language_policy IS NULL) AND (private_use_namespace IS NULL)) OR ((language_tag IS NOT NULL) AND ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255)) AND (language_policy IS NOT NULL) AND ((private_use_namespace IS NULL) OR ((octet_length(private_use_namespace) >= 1) AND (octet_length(private_use_namespace) <= 512))))),
  CONSTRAINT "distribution_named_form_method_check" CHECK (translation_method = ANY (ARRAY['human'::text, 'machine'::text, 'mixed'::text, 'unknown'::text, 'not_applicable'::text])),
  CONSTRAINT "distribution_named_form_origin_check" CHECK (origin = ANY (ARRAY['original'::text, 'translation'::text, 'transliteration'::text, 'abbreviation'::text, 'variant'::text, 'unknown'::text])),
  CONSTRAINT "distribution_named_form_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "distribution_named_form_scope_check" CHECK (((territory IS NULL) OR ((octet_length(territory) >= 1) AND (octet_length(territory) <= 96))) AND ((context IS NULL) OR ((octet_length(context) >= 1) AND (octet_length(context) <= 512)))),
  CONSTRAINT "distribution_named_form_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)),
  CONSTRAINT "distribution_named_form_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "distribution_named_form_value_check" CHECK (((octet_length(value) >= 1) AND (octet_length(value) <= 131072)) AND ((sort_name IS NULL) OR ((octet_length(sort_name) >= 1) AND (octet_length(sort_name) <= 131072))))
);
-- Create index "distribution_named_form_language_idx" to table: "distribution_named_form"
CREATE INDEX "distribution_named_form_language_idx" ON "distribution_named_form" ("owner_id", "language_tag", "id");
-- Create index "distribution_named_form_scope_idx" to table: "distribution_named_form"
CREATE INDEX "distribution_named_form_scope_idx" ON "distribution_named_form" ("scope_owner_id", "id") WHERE (scope_owner_id IS NOT NULL);
-- Create "distribution_fact_support" table
CREATE TABLE "distribution_fact_support" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "fact_id" uuid NULL,
  "relation_id" uuid NULL,
  "named_form_id" uuid NULL,
  "identifier_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "withdrawn_at" timestamptz(3) NULL,
  CONSTRAINT "distribution_support_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "distribution_fact_support_p63a12XA6iCN_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_support_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "distribution_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_support_identifier_fk" FOREIGN KEY ("owner_id", "identifier_id") REFERENCES "distribution_identifier_claim" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_support_named_form_fk" FOREIGN KEY ("owner_id", "named_form_id") REFERENCES "distribution_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_support_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "distribution_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_support_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_support_source_path_check" CHECK (length(source_path) > 0),
  CONSTRAINT "distribution_support_target_check" CHECK (num_nonnulls(fact_id, relation_id, named_form_id, identifier_id) = 1)
);
-- Create index "distribution_support_fact_idx" to table: "distribution_fact_support"
CREATE INDEX "distribution_support_fact_idx" ON "distribution_fact_support" ("owner_id", "fact_id", "id") WHERE (fact_id IS NOT NULL);
-- Create index "distribution_support_identifier_idx" to table: "distribution_fact_support"
CREATE INDEX "distribution_support_identifier_idx" ON "distribution_fact_support" ("owner_id", "identifier_id", "id") WHERE (identifier_id IS NOT NULL);
-- Create index "distribution_support_name_idx" to table: "distribution_fact_support"
CREATE INDEX "distribution_support_name_idx" ON "distribution_fact_support" ("owner_id", "named_form_id", "id") WHERE (named_form_id IS NOT NULL);
-- Create index "distribution_support_relation_idx" to table: "distribution_fact_support"
CREATE INDEX "distribution_support_relation_idx" ON "distribution_fact_support" ("owner_id", "relation_id", "id") WHERE (relation_id IS NOT NULL);
-- Create index "distribution_support_snapshot_idx" to table: "distribution_fact_support"
CREATE INDEX "distribution_support_snapshot_idx" ON "distribution_fact_support" ("source_record_id", "snapshot_id", "id");
-- Create "distribution_fact_value_node" table
CREATE TABLE "distribution_fact_value_node" (
  "owner_id" uuid NOT NULL,
  "fact_id" uuid NOT NULL,
  "position" bigint NOT NULL,
  "rule_position" integer NOT NULL DEFAULT 0,
  "parent_position" bigint NULL,
  "parent_kind" text NULL,
  "member_key" text NULL,
  "kind" text NOT NULL,
  "text_value" text NULL,
  "number_value" numeric NULL,
  "boolean_value" boolean NULL,
  CONSTRAINT "distribution_fact_node_position_key" PRIMARY KEY ("owner_id", "fact_id", "position"),
  CONSTRAINT "distribution_fact_node_kind_key" UNIQUE ("owner_id", "fact_id", "position", "kind"),
  CONSTRAINT "distribution_fact_node_member_key" UNIQUE ("owner_id", "fact_id", "parent_position", "member_key"),
  CONSTRAINT "distribution_fact_node_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "distribution_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_fact_node_parent_fk" FOREIGN KEY ("owner_id", "fact_id", "parent_position", "parent_kind") REFERENCES "distribution_fact_value_node" ("owner_id", "fact_id", "position", "kind") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_fact_node_kind_check" CHECK (kind = ANY (ARRAY['null'::text, 'string'::text, 'number'::text, 'boolean'::text, 'object'::text, 'array'::text])),
  CONSTRAINT "distribution_fact_node_number_check" CHECK ((number_value IS NULL) OR ((number_value)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text]))),
  CONSTRAINT "distribution_fact_node_parent_check" CHECK ((("position" = 0) AND (parent_position IS NULL) AND (parent_kind IS NULL) AND (member_key IS NULL)) OR (("position" > 0) AND (parent_position IS NOT NULL) AND (parent_kind IS NOT NULL) AND (((parent_kind = 'object'::text) AND (member_key IS NOT NULL)) OR ((parent_kind = 'array'::text) AND (member_key IS NULL))))),
  CONSTRAINT "distribution_fact_node_position_check" CHECK ((("position" >= 0) AND ("position" <= '9007199254740991'::bigint)) AND ((parent_position IS NULL) OR ((parent_position >= 0) AND (parent_position < "position")))),
  CONSTRAINT "distribution_fact_node_rule_check" CHECK ((rule_position >= 0) AND (rule_position <= 127)),
  CONSTRAINT "distribution_fact_node_value_check" CHECK (((kind = 'string'::text) AND (text_value IS NOT NULL) AND (number_value IS NULL) AND (boolean_value IS NULL)) OR ((kind = 'number'::text) AND (number_value IS NOT NULL) AND (text_value IS NULL) AND (boolean_value IS NULL)) OR ((kind = 'boolean'::text) AND (boolean_value IS NOT NULL) AND (text_value IS NULL) AND (number_value IS NULL)) OR ((kind = ANY (ARRAY['null'::text, 'object'::text, 'array'::text])) AND (text_value IS NULL) AND (number_value IS NULL) AND (boolean_value IS NULL)))
);
-- Create index "distribution_fact_node_children_idx" to table: "distribution_fact_value_node"
CREATE INDEX "distribution_fact_node_children_idx" ON "distribution_fact_value_node" ("owner_id", "fact_id", "parent_position", "position");
-- Create "distribution_identifier_claim_revision" table
CREATE TABLE "distribution_identifier_claim_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "namespace" text NOT NULL,
  "value" text NOT NULL,
  "normalized_value" text NOT NULL,
  "normalization_policy" text NOT NULL DEFAULT 'exact.1',
  "validation_status" text NOT NULL DEFAULT 'unvalidated',
  "issuer_entity_id" uuid NULL,
  "state" text NOT NULL DEFAULT 'active',
  CONSTRAINT "distribution_identifier_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "distribution_identifier_claim_revision_2EBp2jtoRTTG_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_identifier_claim_revision_2GunLUpwagq9_fkey" FOREIGN KEY ("owner_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_identifier_claim_revision_zOqgguP0emRs_fkey" FOREIGN KEY ("issuer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_identifier_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "distribution_identifier_claim" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create "distribution_package" table
CREATE TABLE "distribution_package" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'package',
  "current_revision" bigint NOT NULL DEFAULT 0,
  PRIMARY KEY ("id"),
  CONSTRAINT "distribution_package_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "distribution_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_package_revision_check" CHECK ((current_revision >= 0) AND (current_revision <= '9007199254740991'::bigint)),
  CONSTRAINT "distribution_package_shape_check" CHECK (identity_shape = 'package'::text)
);
-- Create "distribution_manifest" table
CREATE TABLE "distribution_manifest" (
  "package_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "member_count" bigint NOT NULL DEFAULT 0,
  "sealed_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "distribution_manifest_package_key" UNIQUE ("package_id", "id"),
  CONSTRAINT "distribution_manifest_package_id_distribution_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "distribution_package" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_manifest_count_check" CHECK ((member_count >= 0) AND (member_count <= '9007199254740991'::bigint))
);
-- Modify "software_content" table
ALTER TABLE "software_content" ADD CONSTRAINT "software_content_description_check" CHECK ((description IS NULL) OR (octet_length(description) <= 524288)), ADD CONSTRAINT "software_content_language_check" CHECK ((original_language_tag IS NULL) OR ((octet_length(original_language_tag) >= 1) AND (octet_length(original_language_tag) <= 255))), ADD CONSTRAINT "software_content_status_check" CHECK ((development_status IS NULL) OR (development_status = ANY (ARRAY['finished'::text, 'in_development'::text, 'cancelled'::text]))), ADD COLUMN "original_language_tag" text NULL, ADD COLUMN "development_status" text NULL, ADD COLUMN "description" text NULL;
-- Modify "software_release" table
ALTER TABLE "software_release" ADD CONSTRAINT "software_release_resolution_check" CHECK ((((resolution_kind IS NULL) AND (resolution_width IS NULL) AND (resolution_height IS NULL)) OR ((resolution_kind = 'non_standard'::text) AND (resolution_width IS NULL) AND (resolution_height IS NULL)) OR ((resolution_kind = 'pixels'::text) AND (resolution_width IS NOT NULL) AND (resolution_height IS NOT NULL) AND ((resolution_width >= 1) AND (resolution_width <= 2147483647)) AND ((resolution_height >= 1) AND (resolution_height <= 2147483647)))) IS TRUE), ADD CONSTRAINT "software_release_text_budget_check" CHECK (((engine IS NULL) OR (octet_length(engine) <= 4096)) AND ((notes IS NULL) OR (octet_length(notes) <= 524288)) AND ((gtin IS NULL) OR (octet_length(gtin) <= 128)) AND ((catalog_number IS NULL) OR (octet_length(catalog_number) <= 4096))), ADD CONSTRAINT "software_release_voicing_check" CHECK ((voicing IS NULL) OR (voicing = ANY (ARRAY['none'::text, 'erotic_only'::text, 'partial'::text, 'full'::text]))), ADD COLUMN "resolution_kind" text NULL, ADD COLUMN "resolution_width" integer NULL, ADD COLUMN "resolution_height" integer NULL, ADD COLUMN "engine" text NULL, ADD COLUMN "voicing" text NULL, ADD COLUMN "notes" text NULL, ADD COLUMN "gtin" text NULL, ADD COLUMN "catalog_number" text NULL;
-- Modify "program_episode" table
ALTER TABLE "program_episode" ADD CONSTRAINT "program_episode_disc_check" CHECK ((disc_number IS NULL) OR (disc_number >= 0)), ADD CONSTRAINT "program_episode_season_owner_check" CHECK ((season_id IS NULL) OR (program_id IS NOT NULL));
-- Create "distribution_member" table
CREATE TABLE "distribution_member" (
  "package_id" uuid NOT NULL,
  "manifest_id" uuid NOT NULL,
  "occurrence_id" uuid NOT NULL,
  "position" bigint NOT NULL,
  "original_number" text NULL,
  "quantity" bigint NULL,
  "publication_id" uuid NULL,
  "text_version_id" uuid NULL,
  "software_content_id" uuid NULL,
  "software_release_id" uuid NULL,
  "music_release_id" uuid NULL,
  "recording_id" uuid NULL,
  "program_version_id" uuid NULL,
  "episode_id" uuid NULL,
  PRIMARY KEY ("package_id", "manifest_id", "position"),
  CONSTRAINT "distribution_member_occurrence_key" UNIQUE ("package_id", "manifest_id", "occurrence_id"),
  CONSTRAINT "distribution_member_4qkxYueKomcP_fkey" FOREIGN KEY ("text_version_id") REFERENCES "publishing_text_version" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_member_9uzVjA7XT4rr_fkey" FOREIGN KEY ("software_content_id") REFERENCES "software_content" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_member_CnwBDatBpHKh_fkey" FOREIGN KEY ("software_release_id") REFERENCES "software_release" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_member_episode_id_program_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "program_episode" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_member_manifest_fk" FOREIGN KEY ("package_id", "manifest_id") REFERENCES "distribution_manifest" ("package_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_member_music_release_id_music_release_id_fkey" FOREIGN KEY ("music_release_id") REFERENCES "music_release" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_member_program_version_id_program_version_id_fkey" FOREIGN KEY ("program_version_id") REFERENCES "program_version" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_member_recording_id_music_recording_id_fkey" FOREIGN KEY ("recording_id") REFERENCES "music_recording" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_member_xUPfGTjfEgF9_fkey" FOREIGN KEY ("publication_id") REFERENCES "publishing_publication" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_member_number_check" CHECK ((original_number IS NULL) OR ((octet_length(original_number) >= 1) AND (octet_length(original_number) <= 1024))),
  CONSTRAINT "distribution_member_position_check" CHECK (("position" >= 0) AND ("position" <= '9007199254740990'::bigint)),
  CONSTRAINT "distribution_member_quantity_check" CHECK ((quantity IS NULL) OR ((quantity >= 1) AND (quantity <= '9007199254740991'::bigint))),
  CONSTRAINT "distribution_member_target_check" CHECK (num_nonnulls(publication_id, text_version_id, software_content_id, software_release_id, music_release_id, recording_id, program_version_id, episode_id) = 1)
);
-- Create index "distribution_member_target_0_idx" to table: "distribution_member"
CREATE INDEX "distribution_member_target_0_idx" ON "distribution_member" ("publication_id", "package_id", "manifest_id", "position") WHERE (publication_id IS NOT NULL);
-- Create index "distribution_member_target_1_idx" to table: "distribution_member"
CREATE INDEX "distribution_member_target_1_idx" ON "distribution_member" ("text_version_id", "package_id", "manifest_id", "position") WHERE (text_version_id IS NOT NULL);
-- Create index "distribution_member_target_2_idx" to table: "distribution_member"
CREATE INDEX "distribution_member_target_2_idx" ON "distribution_member" ("software_content_id", "package_id", "manifest_id", "position") WHERE (software_content_id IS NOT NULL);
-- Create index "distribution_member_target_3_idx" to table: "distribution_member"
CREATE INDEX "distribution_member_target_3_idx" ON "distribution_member" ("software_release_id", "package_id", "manifest_id", "position") WHERE (software_release_id IS NOT NULL);
-- Create index "distribution_member_target_4_idx" to table: "distribution_member"
CREATE INDEX "distribution_member_target_4_idx" ON "distribution_member" ("music_release_id", "package_id", "manifest_id", "position") WHERE (music_release_id IS NOT NULL);
-- Create index "distribution_member_target_5_idx" to table: "distribution_member"
CREATE INDEX "distribution_member_target_5_idx" ON "distribution_member" ("recording_id", "package_id", "manifest_id", "position") WHERE (recording_id IS NOT NULL);
-- Create index "distribution_member_target_6_idx" to table: "distribution_member"
CREATE INDEX "distribution_member_target_6_idx" ON "distribution_member" ("program_version_id", "package_id", "manifest_id", "position") WHERE (program_version_id IS NOT NULL);
-- Create index "distribution_member_target_7_idx" to table: "distribution_member"
CREATE INDEX "distribution_member_target_7_idx" ON "distribution_member" ("episode_id", "package_id", "manifest_id", "position") WHERE (episode_id IS NOT NULL);
-- Create "distribution_named_form_revision" table
CREATE TABLE "distribution_named_form_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "language_tag" text NULL,
  "private_use_namespace" text NULL,
  "language_policy" text NULL,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "sort_name" text NULL,
  "origin" text NOT NULL DEFAULT 'unknown',
  "translation_method" text NOT NULL DEFAULT 'unknown',
  "primary_for_language" boolean NULL,
  "scope_owner_id" uuid NULL,
  "territory" text NULL,
  "context" text NULL,
  "derivation_name_id" uuid NULL,
  "derivation_revision" bigint NULL,
  "begin" jsonb NULL,
  "end" jsonb NULL,
  "ended" boolean NULL,
  "spoiler" integer NOT NULL DEFAULT 0,
  "state" text NOT NULL DEFAULT 'active',
  CONSTRAINT "distribution_named_form_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "distribution_named_form_derivation_fk" FOREIGN KEY ("owner_id", "derivation_name_id", "derivation_revision") REFERENCES "distribution_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_named_form_revision_7BEv5S1LcQxT_fkey" FOREIGN KEY ("owner_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_named_form_revision_84IaFnukXpyw_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_named_form_revision_Hjfestnej9rA_fkey" FOREIGN KEY ("scope_owner_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_named_form_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "distribution_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "distribution_named_form_derivation_idx" to table: "distribution_named_form_revision"
CREATE INDEX "distribution_named_form_derivation_idx" ON "distribution_named_form_revision" ("owner_id", "derivation_name_id", "derivation_revision") WHERE (derivation_name_id IS NOT NULL);
-- Create "distribution_name_authority" table
CREATE TABLE "distribution_name_authority" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "claim" text NOT NULL,
  "review_state" text NOT NULL,
  "authorizer_entity_id" uuid NULL,
  "role" text NOT NULL,
  "territory" text NULL,
  "channel" text NULL,
  "context" text NULL,
  "valid_from" timestamptz(3) NULL,
  "valid_until" timestamptz(3) NULL,
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "review_source_record_id" uuid NULL,
  "review_snapshot_id" uuid NULL,
  "review_source_path" text NULL,
  "state" text NOT NULL,
  CONSTRAINT "distribution_name_authority_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "distribution_name_authority_D3fxtGVqGkPB_fkey" FOREIGN KEY ("authorizer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_authority_IRHnwRmbzWph_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_authority_evidence_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_authority_review_fk" FOREIGN KEY ("review_source_record_id", "review_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_authority_target_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "distribution_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_authority_wdzcMAB7Wshq_fkey" FOREIGN KEY ("owner_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_authority_claim_check" CHECK (claim = ANY (ARRAY['official'::text, 'unofficial'::text, 'unknown'::text])),
  CONSTRAINT "distribution_name_authority_proof_check" CHECK (((review_state <> 'verified'::text) OR ((authorizer_entity_id IS NOT NULL) AND (review_snapshot_id IS NOT NULL))) AND (num_nonnulls(review_source_record_id, review_snapshot_id, review_source_path) = ANY (ARRAY[0, 3]))),
  CONSTRAINT "distribution_name_authority_review_check" CHECK (review_state = ANY (ARRAY['source_claim'::text, 'pending'::text, 'verified'::text, 'rejected'::text])),
  CONSTRAINT "distribution_name_authority_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "distribution_name_authority_scope_check" CHECK (((octet_length(role) >= 1) AND (octet_length(role) <= 96)) AND ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 4096)) AND ((review_source_path IS NULL) OR ((octet_length(review_source_path) >= 1) AND (octet_length(review_source_path) <= 4096))) AND ((territory IS NULL) OR ((octet_length(territory) >= 1) AND (octet_length(territory) <= 96))) AND ((channel IS NULL) OR ((octet_length(channel) >= 1) AND (octet_length(channel) <= 96))) AND ((context IS NULL) OR ((octet_length(context) >= 1) AND (octet_length(context) <= 512)))),
  CONSTRAINT "distribution_name_authority_state_check" CHECK (state = ANY (ARRAY['active'::text, 'withdrawn'::text])),
  CONSTRAINT "distribution_name_authority_time_check" CHECK ((valid_from IS NULL) OR (valid_until IS NULL) OR (valid_until > valid_from))
);
-- Create index "distribution_name_authority_authorizer_idx" to table: "distribution_name_authority"
CREATE INDEX "distribution_name_authority_authorizer_idx" ON "distribution_name_authority" ("authorizer_entity_id", "owner_id", "id") WHERE (authorizer_entity_id IS NOT NULL);
-- Create index "distribution_name_authority_evidence_idx" to table: "distribution_name_authority"
CREATE INDEX "distribution_name_authority_evidence_idx" ON "distribution_name_authority" ("source_record_id", "snapshot_id", "id");
-- Create index "distribution_name_authority_review_idx" to table: "distribution_name_authority"
CREATE INDEX "distribution_name_authority_review_idx" ON "distribution_name_authority" ("review_source_record_id", "review_snapshot_id", "id") WHERE (review_source_record_id IS NOT NULL);
-- Create index "distribution_name_authority_target_idx" to table: "distribution_name_authority"
CREATE INDEX "distribution_name_authority_target_idx" ON "distribution_name_authority" ("owner_id", "name_id", "name_revision", "id");
-- Create "distribution_name_authority_revision" table
CREATE TABLE "distribution_name_authority_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "claim" text NOT NULL,
  "review_state" text NOT NULL,
  "authorizer_entity_id" uuid NULL,
  "role" text NOT NULL,
  "territory" text NULL,
  "channel" text NULL,
  "context" text NULL,
  "valid_from" timestamptz(3) NULL,
  "valid_until" timestamptz(3) NULL,
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "review_source_record_id" uuid NULL,
  "review_snapshot_id" uuid NULL,
  "review_source_path" text NULL,
  "state" text NOT NULL,
  CONSTRAINT "distribution_name_authority_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "distribution_name_authority_history_evidence_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_authority_history_review_fk" FOREIGN KEY ("review_source_record_id", "review_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_authority_history_target_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "distribution_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_authority_revision_ZgNk7nYkXNjX_fkey" FOREIGN KEY ("authorizer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_authority_revision_f7f48W2AvWKa_fkey" FOREIGN KEY ("owner_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_authority_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "distribution_name_authority" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_authority_revision_kmVZWXkvMW3f_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create "distribution_name_source_binding" table
CREATE TABLE "distribution_name_source_binding" (
  "owner_id" uuid NOT NULL,
  "source_record_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "local_key" text NOT NULL,
  "name_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "distribution_name_source_binding_key" PRIMARY KEY ("source_record_id", "namespace", "local_key"),
  CONSTRAINT "distribution_name_source_binding_owner_key" UNIQUE ("owner_id", "source_record_id", "namespace", "local_key", "name_id"),
  CONSTRAINT "distribution_name_source_binding_name_fk" FOREIGN KEY ("owner_id", "name_id") REFERENCES "distribution_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_source_binding_pT0CR8kXes66_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_source_binding_value_check" CHECK (((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 96)) AND ((octet_length(local_key) >= 1) AND (octet_length(local_key) <= 512)))
);
-- Create index "distribution_name_source_binding_owner_idx" to table: "distribution_name_source_binding"
CREATE INDEX "distribution_name_source_binding_owner_idx" ON "distribution_name_source_binding" ("owner_id", "name_id");
-- Create "distribution_name_source_occurrence" table
CREATE TABLE "distribution_name_source_occurrence" (
  "owner_id" uuid NOT NULL,
  "source_record_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "local_key" text NOT NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "distribution_name_source_occurrence_key" PRIMARY KEY ("source_record_id", "namespace", "local_key", "snapshot_id"),
  CONSTRAINT "distribution_name_source_occurrence_binding_fk" FOREIGN KEY ("owner_id", "source_record_id", "namespace", "local_key", "name_id") REFERENCES "distribution_name_source_binding" ("owner_id", "source_record_id", "namespace", "local_key", "name_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_source_occurrence_name_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "distribution_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_source_occurrence_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_source_occurrence_path_check" CHECK ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 4096))
);
-- Create index "distribution_name_source_occurrence_name_idx" to table: "distribution_name_source_occurrence"
CREATE INDEX "distribution_name_source_occurrence_name_idx" ON "distribution_name_source_occurrence" ("owner_id", "name_id", "name_revision");
-- Create index "distribution_name_source_occurrence_snapshot_idx" to table: "distribution_name_source_occurrence"
CREATE INDEX "distribution_name_source_occurrence_snapshot_idx" ON "distribution_name_source_occurrence" ("source_record_id", "snapshot_id");
-- Create "distribution_relation_participant" table
CREATE TABLE "distribution_relation_participant" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "relation_id" uuid NOT NULL,
  "role_revision_id" uuid NOT NULL,
  "position" bigint NOT NULL,
  "credited_as" text NULL,
  "publishing_id" uuid NULL,
  "music_id" uuid NULL,
  "program_id" uuid NULL,
  "software_id" uuid NULL,
  "entity_id" uuid NULL,
  "grouping_id" uuid NULL,
  "reference_id" uuid NULL,
  "distribution_id" uuid NULL,
  CONSTRAINT "distribution_participant_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "distribution_participant_position_key" UNIQUE ("owner_id", "relation_id", "position"),
  CONSTRAINT "distribution_participant_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "distribution_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_relation_participant_6CQ34xM7Rzd4_fkey" FOREIGN KEY ("publishing_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_relation_participant_JljS2VXf5nCU_fkey" FOREIGN KEY ("program_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_relation_participant_SoV87BwICe4i_fkey" FOREIGN KEY ("grouping_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_relation_participant_TtUlpIICH2Po_fkey" FOREIGN KEY ("software_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_relation_participant_WwQCwXU9V8aM_fkey" FOREIGN KEY ("distribution_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_relation_participant_aDn86LSyDarA_fkey" FOREIGN KEY ("music_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_relation_participant_d5eQHGLOiFmG_fkey" FOREIGN KEY ("reference_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_relation_participant_iSaVXPnUSlIE_fkey" FOREIGN KEY ("role_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_relation_participant_u7mGVMwIPVoi_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_participant_position_check" CHECK (("position" >= 0) AND ("position" <= '9007199254740991'::bigint)),
  CONSTRAINT "distribution_participant_target_check" CHECK (num_nonnulls(publishing_id, music_id, program_id, software_id, entity_id, grouping_id, reference_id, distribution_id) = 1)
);
-- Create index "distribution_participant_distribution_idx" to table: "distribution_relation_participant"
CREATE INDEX "distribution_participant_distribution_idx" ON "distribution_relation_participant" ("distribution_id", "role_revision_id", "relation_id") WHERE (distribution_id IS NOT NULL);
-- Create index "distribution_participant_entity_idx" to table: "distribution_relation_participant"
CREATE INDEX "distribution_participant_entity_idx" ON "distribution_relation_participant" ("entity_id", "role_revision_id", "relation_id") WHERE (entity_id IS NOT NULL);
-- Create index "distribution_participant_grouping_idx" to table: "distribution_relation_participant"
CREATE INDEX "distribution_participant_grouping_idx" ON "distribution_relation_participant" ("grouping_id", "role_revision_id", "relation_id") WHERE (grouping_id IS NOT NULL);
-- Create index "distribution_participant_music_idx" to table: "distribution_relation_participant"
CREATE INDEX "distribution_participant_music_idx" ON "distribution_relation_participant" ("music_id", "role_revision_id", "relation_id") WHERE (music_id IS NOT NULL);
-- Create index "distribution_participant_program_idx" to table: "distribution_relation_participant"
CREATE INDEX "distribution_participant_program_idx" ON "distribution_relation_participant" ("program_id", "role_revision_id", "relation_id") WHERE (program_id IS NOT NULL);
-- Create index "distribution_participant_publishing_idx" to table: "distribution_relation_participant"
CREATE INDEX "distribution_participant_publishing_idx" ON "distribution_relation_participant" ("publishing_id", "role_revision_id", "relation_id") WHERE (publishing_id IS NOT NULL);
-- Create index "distribution_participant_reference_idx" to table: "distribution_relation_participant"
CREATE INDEX "distribution_participant_reference_idx" ON "distribution_relation_participant" ("reference_id", "role_revision_id", "relation_id") WHERE (reference_id IS NOT NULL);
-- Create index "distribution_participant_role_idx" to table: "distribution_relation_participant"
CREATE INDEX "distribution_participant_role_idx" ON "distribution_relation_participant" ("role_revision_id", "relation_id", "id");
-- Create index "distribution_participant_software_idx" to table: "distribution_relation_participant"
CREATE INDEX "distribution_participant_software_idx" ON "distribution_relation_participant" ("software_id", "role_revision_id", "relation_id") WHERE (software_id IS NOT NULL);
-- Create "distribution_relation_scope" table
CREATE TABLE "distribution_relation_scope" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "relation_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "value_fact_id" uuid NOT NULL,
  CONSTRAINT "distribution_relation_scope_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "distribution_relation_scope_1b776Pgly4zg_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_scope_fact_fk" FOREIGN KEY ("owner_id", "value_fact_id") REFERENCES "distribution_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_scope_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "distribution_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "distribution_relation_scope_definition_idx" to table: "distribution_relation_scope"
CREATE INDEX "distribution_relation_scope_definition_idx" ON "distribution_relation_scope" ("definition_revision_id", "id");
-- Create index "distribution_relation_scope_fact_idx" to table: "distribution_relation_scope"
CREATE INDEX "distribution_relation_scope_fact_idx" ON "distribution_relation_scope" ("owner_id", "value_fact_id");
-- Create index "distribution_relation_scope_relation_idx" to table: "distribution_relation_scope"
CREATE INDEX "distribution_relation_scope_relation_idx" ON "distribution_relation_scope" ("owner_id", "relation_id", "definition_revision_id", "id");
-- Create "distribution_revision" table
CREATE TABLE "distribution_revision" (
  "package_id" uuid NOT NULL,
  "revision" bigint NOT NULL,
  "manifest_id" uuid NOT NULL,
  "label" text NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "created_by_auth_user_id" uuid NULL,
  PRIMARY KEY ("package_id", "revision"),
  CONSTRAINT "distribution_revision_created_by_auth_user_id_users_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "distribution_revision_manifest_fk" FOREIGN KEY ("package_id", "manifest_id") REFERENCES "distribution_manifest" ("package_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_revision_package_id_distribution_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "distribution_package" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_revision_label_check" CHECK ((label IS NULL) OR ((octet_length(label) >= 1) AND (octet_length(label) <= 4096))),
  CONSTRAINT "distribution_revision_number_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint))
);
-- Create index "distribution_revision_manifest_idx" to table: "distribution_revision"
CREATE INDEX "distribution_revision_manifest_idx" ON "distribution_revision" ("package_id", "manifest_id", "revision");
-- Create "distribution_semantic_revision" table
CREATE TABLE "distribution_semantic_revision" (
  "owner_id" uuid NOT NULL,
  "semantic_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "fact_id" uuid NULL,
  "relation_id" uuid NULL,
  "state" text NOT NULL DEFAULT 'active',
  "actor_auth_user_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "distribution_semantic_revision_key" PRIMARY KEY ("owner_id", "semantic_id", "version"),
  CONSTRAINT "distribution_semantic_revision_ACgQDcHLGrGh_fkey" FOREIGN KEY ("owner_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_semantic_revision_actor_auth_user_id_users_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "distribution_semantic_revision_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "distribution_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_semantic_revision_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "distribution_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_semantic_revision_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "distribution_semantic_revision_target_check" CHECK (num_nonnulls(fact_id, relation_id) = 1),
  CONSTRAINT "distribution_semantic_revision_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create index "distribution_semantic_revision_fact_idx" to table: "distribution_semantic_revision"
CREATE INDEX "distribution_semantic_revision_fact_idx" ON "distribution_semantic_revision" ("owner_id", "fact_id");
-- Create index "distribution_semantic_revision_relation_idx" to table: "distribution_semantic_revision"
CREATE INDEX "distribution_semantic_revision_relation_idx" ON "distribution_semantic_revision" ("owner_id", "relation_id");
-- Create "distribution_semantic_head" table
CREATE TABLE "distribution_semantic_head" (
  "owner_id" uuid NOT NULL,
  "semantic_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  CONSTRAINT "distribution_semantic_head_key" PRIMARY KEY ("owner_id", "semantic_id"),
  CONSTRAINT "distribution_semantic_head_revision_fk" FOREIGN KEY ("owner_id", "semantic_id", "version") REFERENCES "distribution_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create "distribution_source_binding" table
CREATE TABLE "distribution_source_binding" (
  "source_record_id" uuid NOT NULL,
  "mapping_key" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'distribution',
  "owner_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("source_record_id", "mapping_key"),
  CONSTRAINT "distribution_source_binding_aCh7B1pWKvxU_fkey" FOREIGN KEY ("owner_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_source_binding_claim_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_source_binding_owner_check" CHECK (mapping_owner = 'distribution'::text)
) PARTITION BY HASH ("source_record_id");
-- Create index "distribution_source_binding_owner_idx" to table: "distribution_source_binding"
CREATE INDEX "distribution_source_binding_owner_idx" ON "distribution_source_binding" ("owner_id", "mapping_key");
-- Create "entity_catalog_profile_revision" table
CREATE TABLE "entity_catalog_profile_revision" (
  "owner_id" uuid NOT NULL,
  "revision" bigint NOT NULL,
  "snapshot" jsonb NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("owner_id", "revision"),
  CONSTRAINT "entity_catalog_profile_revision_s8MpzVJZUkXQ_fkey" FOREIGN KEY ("owner_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_catalog_profile_revision_number_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "entity_catalog_profile_revision_snapshot_check" CHECK ((jsonb_typeof(snapshot) = 'object'::text) AND (octet_length((snapshot)::text) <= 32768))
);
-- Modify "entity_fact_support" table
ALTER TABLE "entity_fact_support" ADD CONSTRAINT "entity_fact_support_8Yl9t3RF5B7s_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "entity_support_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop index "entity_identifier_owner_idx" from table: "entity_identifier_claim"
DROP INDEX "entity_identifier_owner_idx";
-- Modify "entity_identifier_claim" table
ALTER TABLE "entity_identifier_claim" DROP CONSTRAINT "entity_identifier_namespace_check", ADD CONSTRAINT "entity_identifier_namespace_check" CHECK (namespace ~ '^[a-z][a-z0-9_.:-]{0,127}$'::text), DROP CONSTRAINT "entity_identifier_value_check", ADD CONSTRAINT "entity_identifier_value_check" CHECK (((octet_length(value) >= 1) AND (octet_length(value) <= 512)) AND ((octet_length(normalized_value) >= 1) AND (octet_length(normalized_value) <= 512)) AND ((octet_length(normalization_policy) >= 1) AND (octet_length(normalization_policy) <= 96))), ADD CONSTRAINT "entity_identifier_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)), ADD CONSTRAINT "entity_identifier_validation_check" CHECK (validation_status = ANY (ARRAY['unvalidated'::text, 'valid'::text])), ADD COLUMN "revision" bigint NOT NULL DEFAULT 1, ADD COLUMN "recorded_at" timestamptz(3) NOT NULL DEFAULT now(), ADD COLUMN "recorded_by_auth_user_id" uuid NULL, ADD COLUMN "normalization_policy" text NOT NULL DEFAULT 'exact.1', ADD COLUMN "validation_status" text NOT NULL DEFAULT 'unvalidated', ADD COLUMN "issuer_entity_id" uuid NULL, ADD CONSTRAINT "entity_identifier_claim_gCa6yhN7D7Bb_fkey" FOREIGN KEY ("issuer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "entity_identifier_claim_recorded_by_auth_user_id_users_id_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "entity_identifier_issuer_idx" to table: "entity_identifier_claim"
CREATE INDEX "entity_identifier_issuer_idx" ON "entity_identifier_claim" ("issuer_entity_id", "id") WHERE (issuer_entity_id IS NOT NULL);
-- Create "entity_identifier_claim_revision" table
CREATE TABLE "entity_identifier_claim_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "namespace" text NOT NULL,
  "value" text NOT NULL,
  "normalized_value" text NOT NULL,
  "normalization_policy" text NOT NULL DEFAULT 'exact.1',
  "validation_status" text NOT NULL DEFAULT 'unvalidated',
  "issuer_entity_id" uuid NULL,
  "state" text NOT NULL DEFAULT 'active',
  CONSTRAINT "entity_identifier_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "entity_identifier_claim_revision_KjM04uODuJq7_fkey" FOREIGN KEY ("owner_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_identifier_claim_revision_QXX8OWY5QIdv_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_identifier_claim_revision_os9Kul6n575B_fkey" FOREIGN KEY ("issuer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_identifier_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "entity_identifier_claim" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Drop index "entity_named_form_owner_idx" from table: "entity_named_form"
DROP INDEX "entity_named_form_owner_idx";
-- Modify "entity_named_form" table
ALTER TABLE "entity_named_form" DROP CONSTRAINT "entity_named_form_kind_check", ADD CONSTRAINT "entity_named_form_kind_check" CHECK ((octet_length(kind) >= 1) AND (octet_length(kind) <= 96)), DROP CONSTRAINT "entity_named_form_language_check", ADD CONSTRAINT "entity_named_form_language_check" CHECK (((language_tag IS NULL) AND (language_policy IS NULL) AND (private_use_namespace IS NULL)) OR ((language_tag IS NOT NULL) AND ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255)) AND (language_policy IS NOT NULL) AND ((private_use_namespace IS NULL) OR ((octet_length(private_use_namespace) >= 1) AND (octet_length(private_use_namespace) <= 512))))), DROP CONSTRAINT "entity_named_form_value_check", ADD CONSTRAINT "entity_named_form_value_check" CHECK (((octet_length(value) >= 1) AND (octet_length(value) <= 131072)) AND ((sort_name IS NULL) OR ((octet_length(sort_name) >= 1) AND (octet_length(sort_name) <= 131072)))), ADD CONSTRAINT "entity_named_form_derivation_check" CHECK (num_nonnulls(derivation_name_id, derivation_revision) = ANY (ARRAY[0, 2])), ADD CONSTRAINT "entity_named_form_method_check" CHECK (translation_method = ANY (ARRAY['human'::text, 'machine'::text, 'mixed'::text, 'unknown'::text, 'not_applicable'::text])), ADD CONSTRAINT "entity_named_form_origin_check" CHECK (origin = ANY (ARRAY['original'::text, 'translation'::text, 'transliteration'::text, 'abbreviation'::text, 'variant'::text, 'unknown'::text])), ADD CONSTRAINT "entity_named_form_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)), ADD CONSTRAINT "entity_named_form_scope_check" CHECK (((territory IS NULL) OR ((octet_length(territory) >= 1) AND (octet_length(territory) <= 96))) AND ((context IS NULL) OR ((octet_length(context) >= 1) AND (octet_length(context) <= 512)))), ADD CONSTRAINT "entity_named_form_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "revision" bigint NOT NULL DEFAULT 1, ADD COLUMN "recorded_at" timestamptz(3) NOT NULL DEFAULT now(), ADD COLUMN "recorded_by_auth_user_id" uuid NULL, ADD COLUMN "private_use_namespace" text NULL, ADD COLUMN "language_policy" text NULL, ADD COLUMN "sort_name" text NULL, ADD COLUMN "origin" text NOT NULL DEFAULT 'unknown', ADD COLUMN "translation_method" text NOT NULL DEFAULT 'unknown', ADD COLUMN "primary_for_language" boolean NULL, ADD COLUMN "scope_owner_id" uuid NULL, ADD COLUMN "territory" text NULL, ADD COLUMN "context" text NULL, ADD COLUMN "derivation_name_id" uuid NULL, ADD COLUMN "derivation_revision" bigint NULL, ADD COLUMN "begin" jsonb NULL, ADD COLUMN "end" jsonb NULL, ADD COLUMN "ended" boolean NULL, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0, ADD CONSTRAINT "entity_named_form_recorded_by_auth_user_id_users_id_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "entity_named_form_scope_owner_id_entity_identity_id_fkey" FOREIGN KEY ("scope_owner_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "entity_named_form_scope_idx" to table: "entity_named_form"
CREATE INDEX "entity_named_form_scope_idx" ON "entity_named_form" ("scope_owner_id", "id") WHERE (scope_owner_id IS NOT NULL);
-- Create "entity_named_form_revision" table
CREATE TABLE "entity_named_form_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "language_tag" text NULL,
  "private_use_namespace" text NULL,
  "language_policy" text NULL,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "sort_name" text NULL,
  "origin" text NOT NULL DEFAULT 'unknown',
  "translation_method" text NOT NULL DEFAULT 'unknown',
  "primary_for_language" boolean NULL,
  "scope_owner_id" uuid NULL,
  "territory" text NULL,
  "context" text NULL,
  "derivation_name_id" uuid NULL,
  "derivation_revision" bigint NULL,
  "begin" jsonb NULL,
  "end" jsonb NULL,
  "ended" boolean NULL,
  "spoiler" integer NOT NULL DEFAULT 0,
  "state" text NOT NULL DEFAULT 'active',
  CONSTRAINT "entity_named_form_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "entity_named_form_derivation_fk" FOREIGN KEY ("owner_id", "derivation_name_id", "derivation_revision") REFERENCES "entity_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_named_form_revision_5wsmKe1mBu4R_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_named_form_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "entity_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_named_form_revision_owner_id_entity_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_named_form_revision_wZnglyjTQR3m_fkey" FOREIGN KEY ("scope_owner_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "entity_named_form_derivation_idx" to table: "entity_named_form_revision"
CREATE INDEX "entity_named_form_derivation_idx" ON "entity_named_form_revision" ("owner_id", "derivation_name_id", "derivation_revision") WHERE (derivation_name_id IS NOT NULL);
-- Create "entity_name_authority" table
CREATE TABLE "entity_name_authority" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "claim" text NOT NULL,
  "review_state" text NOT NULL,
  "authorizer_entity_id" uuid NULL,
  "role" text NOT NULL,
  "territory" text NULL,
  "channel" text NULL,
  "context" text NULL,
  "valid_from" timestamptz(3) NULL,
  "valid_until" timestamptz(3) NULL,
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "review_source_record_id" uuid NULL,
  "review_snapshot_id" uuid NULL,
  "review_source_path" text NULL,
  "state" text NOT NULL,
  CONSTRAINT "entity_name_authority_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "entity_name_authority_Uk8XZb9gLQjG_fkey" FOREIGN KEY ("authorizer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_authority_evidence_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_authority_owner_id_entity_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_authority_recorded_by_auth_user_id_users_id_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_authority_review_fk" FOREIGN KEY ("review_source_record_id", "review_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_authority_target_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "entity_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_authority_claim_check" CHECK (claim = ANY (ARRAY['official'::text, 'unofficial'::text, 'unknown'::text])),
  CONSTRAINT "entity_name_authority_proof_check" CHECK (((review_state <> 'verified'::text) OR ((authorizer_entity_id IS NOT NULL) AND (review_snapshot_id IS NOT NULL))) AND (num_nonnulls(review_source_record_id, review_snapshot_id, review_source_path) = ANY (ARRAY[0, 3]))),
  CONSTRAINT "entity_name_authority_review_check" CHECK (review_state = ANY (ARRAY['source_claim'::text, 'pending'::text, 'verified'::text, 'rejected'::text])),
  CONSTRAINT "entity_name_authority_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "entity_name_authority_scope_check" CHECK (((octet_length(role) >= 1) AND (octet_length(role) <= 96)) AND ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 4096)) AND ((review_source_path IS NULL) OR ((octet_length(review_source_path) >= 1) AND (octet_length(review_source_path) <= 4096))) AND ((territory IS NULL) OR ((octet_length(territory) >= 1) AND (octet_length(territory) <= 96))) AND ((channel IS NULL) OR ((octet_length(channel) >= 1) AND (octet_length(channel) <= 96))) AND ((context IS NULL) OR ((octet_length(context) >= 1) AND (octet_length(context) <= 512)))),
  CONSTRAINT "entity_name_authority_state_check" CHECK (state = ANY (ARRAY['active'::text, 'withdrawn'::text])),
  CONSTRAINT "entity_name_authority_time_check" CHECK ((valid_from IS NULL) OR (valid_until IS NULL) OR (valid_until > valid_from))
);
-- Create index "entity_name_authority_authorizer_idx" to table: "entity_name_authority"
CREATE INDEX "entity_name_authority_authorizer_idx" ON "entity_name_authority" ("authorizer_entity_id", "owner_id", "id") WHERE (authorizer_entity_id IS NOT NULL);
-- Create index "entity_name_authority_evidence_idx" to table: "entity_name_authority"
CREATE INDEX "entity_name_authority_evidence_idx" ON "entity_name_authority" ("source_record_id", "snapshot_id", "id");
-- Create index "entity_name_authority_review_idx" to table: "entity_name_authority"
CREATE INDEX "entity_name_authority_review_idx" ON "entity_name_authority" ("review_source_record_id", "review_snapshot_id", "id") WHERE (review_source_record_id IS NOT NULL);
-- Create index "entity_name_authority_target_idx" to table: "entity_name_authority"
CREATE INDEX "entity_name_authority_target_idx" ON "entity_name_authority" ("owner_id", "name_id", "name_revision", "id");
-- Create "entity_name_authority_revision" table
CREATE TABLE "entity_name_authority_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "claim" text NOT NULL,
  "review_state" text NOT NULL,
  "authorizer_entity_id" uuid NULL,
  "role" text NOT NULL,
  "territory" text NULL,
  "channel" text NULL,
  "context" text NULL,
  "valid_from" timestamptz(3) NULL,
  "valid_until" timestamptz(3) NULL,
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "review_source_record_id" uuid NULL,
  "review_snapshot_id" uuid NULL,
  "review_source_path" text NULL,
  "state" text NOT NULL,
  CONSTRAINT "entity_name_authority_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "entity_name_authority_history_evidence_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_authority_history_review_fk" FOREIGN KEY ("review_source_record_id", "review_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_authority_history_target_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "entity_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_authority_revision_UvQhpLmwofG6_fkey" FOREIGN KEY ("authorizer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_authority_revision_ZPiz9rXfYYNg_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_authority_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "entity_name_authority" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_authority_revision_owner_id_entity_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create "entity_name_source_binding" table
CREATE TABLE "entity_name_source_binding" (
  "owner_id" uuid NOT NULL,
  "source_record_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "local_key" text NOT NULL,
  "name_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "entity_name_source_binding_key" PRIMARY KEY ("source_record_id", "namespace", "local_key"),
  CONSTRAINT "entity_name_source_binding_owner_key" UNIQUE ("owner_id", "source_record_id", "namespace", "local_key", "name_id"),
  CONSTRAINT "entity_name_source_binding_Fdf3eaCWh78b_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_source_binding_name_fk" FOREIGN KEY ("owner_id", "name_id") REFERENCES "entity_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_source_binding_value_check" CHECK (((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 96)) AND ((octet_length(local_key) >= 1) AND (octet_length(local_key) <= 512)))
);
-- Create index "entity_name_source_binding_owner_idx" to table: "entity_name_source_binding"
CREATE INDEX "entity_name_source_binding_owner_idx" ON "entity_name_source_binding" ("owner_id", "name_id");
-- Create "entity_name_source_occurrence" table
CREATE TABLE "entity_name_source_occurrence" (
  "owner_id" uuid NOT NULL,
  "source_record_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "local_key" text NOT NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "entity_name_source_occurrence_key" PRIMARY KEY ("source_record_id", "namespace", "local_key", "snapshot_id"),
  CONSTRAINT "entity_name_source_occurrence_binding_fk" FOREIGN KEY ("owner_id", "source_record_id", "namespace", "local_key", "name_id") REFERENCES "entity_name_source_binding" ("owner_id", "source_record_id", "namespace", "local_key", "name_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_source_occurrence_name_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "entity_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_source_occurrence_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_source_occurrence_path_check" CHECK ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 4096))
);
-- Create index "entity_name_source_occurrence_name_idx" to table: "entity_name_source_occurrence"
CREATE INDEX "entity_name_source_occurrence_name_idx" ON "entity_name_source_occurrence" ("owner_id", "name_id", "name_revision");
-- Create index "entity_name_source_occurrence_snapshot_idx" to table: "entity_name_source_occurrence"
CREATE INDEX "entity_name_source_occurrence_snapshot_idx" ON "entity_name_source_occurrence" ("source_record_id", "snapshot_id");
-- Modify "entity_relation_participant" table
ALTER TABLE "entity_relation_participant" DROP CONSTRAINT "entity_participant_target_check", ADD CONSTRAINT "entity_participant_target_check" CHECK (num_nonnulls(publishing_id, music_id, program_id, software_id, entity_id, grouping_id, reference_id, distribution_id) = 1), ADD COLUMN "distribution_id" uuid NULL, ADD CONSTRAINT "entity_relation_participant_1q17xuHE9SnT_fkey" FOREIGN KEY ("distribution_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "entity_participant_distribution_idx" to table: "entity_relation_participant"
CREATE INDEX "entity_participant_distribution_idx" ON "entity_relation_participant" ("distribution_id", "role_revision_id", "relation_id") WHERE (distribution_id IS NOT NULL);
-- Modify "entity_fact" table
ALTER TABLE "entity_fact" ADD CONSTRAINT "entity_fact_head_version_check" CHECK ((expected_head_version >= 0) AND (expected_head_version <= '9007199254740990'::bigint)), ADD CONSTRAINT "entity_fact_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "semantic_id" uuid NOT NULL DEFAULT uuidv7(), ADD COLUMN "expected_head_version" bigint NOT NULL DEFAULT 0, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0;
-- Modify "entity_catalog_relation" table
ALTER TABLE "entity_catalog_relation" ADD CONSTRAINT "entity_relation_head_version_check" CHECK ((expected_head_version >= 0) AND (expected_head_version <= '9007199254740990'::bigint)), ADD CONSTRAINT "entity_relation_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "semantic_id" uuid NOT NULL DEFAULT uuidv7(), ADD COLUMN "expected_head_version" bigint NOT NULL DEFAULT 0, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0;
-- Create "entity_semantic_revision" table
CREATE TABLE "entity_semantic_revision" (
  "owner_id" uuid NOT NULL,
  "semantic_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "fact_id" uuid NULL,
  "relation_id" uuid NULL,
  "state" text NOT NULL DEFAULT 'active',
  "actor_auth_user_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "entity_semantic_revision_key" PRIMARY KEY ("owner_id", "semantic_id", "version"),
  CONSTRAINT "entity_semantic_revision_actor_auth_user_id_users_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "entity_semantic_revision_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "entity_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_semantic_revision_owner_id_entity_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_semantic_revision_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "entity_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_semantic_revision_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "entity_semantic_revision_target_check" CHECK (num_nonnulls(fact_id, relation_id) = 1),
  CONSTRAINT "entity_semantic_revision_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create index "entity_semantic_revision_fact_idx" to table: "entity_semantic_revision"
CREATE INDEX "entity_semantic_revision_fact_idx" ON "entity_semantic_revision" ("owner_id", "fact_id");
-- Create index "entity_semantic_revision_relation_idx" to table: "entity_semantic_revision"
CREATE INDEX "entity_semantic_revision_relation_idx" ON "entity_semantic_revision" ("owner_id", "relation_id");
-- Create "entity_semantic_head" table
CREATE TABLE "entity_semantic_head" (
  "owner_id" uuid NOT NULL,
  "semantic_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  CONSTRAINT "entity_semantic_head_key" PRIMARY KEY ("owner_id", "semantic_id"),
  CONSTRAINT "entity_semantic_head_revision_fk" FOREIGN KEY ("owner_id", "semantic_id", "version") REFERENCES "entity_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create "entity_source_binding" table
CREATE TABLE "entity_source_binding" (
  "source_record_id" uuid NOT NULL,
  "mapping_key" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'entity',
  "owner_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("source_record_id", "mapping_key"),
  CONSTRAINT "entity_source_binding_claim_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_source_binding_owner_id_entity_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_source_binding_owner_check" CHECK (mapping_owner = 'entity'::text)
) PARTITION BY HASH ("source_record_id");
-- Create index "entity_source_binding_owner_idx" to table: "entity_source_binding"
CREATE INDEX "entity_source_binding_owner_idx" ON "entity_source_binding" ("owner_id", "mapping_key");
-- Create "grouping_command_revision" table
CREATE TABLE "grouping_command_revision" (
  "owner_id" uuid NOT NULL,
  "revision" bigint NOT NULL,
  "snapshot" jsonb NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("owner_id", "revision"),
  CONSTRAINT "grouping_command_revision_owner_id_grouping_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_command_revision_number_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "grouping_command_revision_snapshot_check" CHECK ((jsonb_typeof(snapshot) = 'object'::text) AND (octet_length((snapshot)::text) <= 32768))
);
-- Modify "grouping_fact_support" table
ALTER TABLE "grouping_fact_support" ADD CONSTRAINT "grouping_fact_support_xQlZC5EXSmvi_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "grouping_support_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop index "grouping_identifier_owner_idx" from table: "grouping_identifier_claim"
DROP INDEX "grouping_identifier_owner_idx";
-- Modify "grouping_identifier_claim" table
ALTER TABLE "grouping_identifier_claim" DROP CONSTRAINT "grouping_identifier_namespace_check", ADD CONSTRAINT "grouping_identifier_namespace_check" CHECK (namespace ~ '^[a-z][a-z0-9_.:-]{0,127}$'::text), DROP CONSTRAINT "grouping_identifier_value_check", ADD CONSTRAINT "grouping_identifier_value_check" CHECK (((octet_length(value) >= 1) AND (octet_length(value) <= 512)) AND ((octet_length(normalized_value) >= 1) AND (octet_length(normalized_value) <= 512)) AND ((octet_length(normalization_policy) >= 1) AND (octet_length(normalization_policy) <= 96))), ADD CONSTRAINT "grouping_identifier_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)), ADD CONSTRAINT "grouping_identifier_validation_check" CHECK (validation_status = ANY (ARRAY['unvalidated'::text, 'valid'::text])), ADD COLUMN "revision" bigint NOT NULL DEFAULT 1, ADD COLUMN "recorded_at" timestamptz(3) NOT NULL DEFAULT now(), ADD COLUMN "recorded_by_auth_user_id" uuid NULL, ADD COLUMN "normalization_policy" text NOT NULL DEFAULT 'exact.1', ADD COLUMN "validation_status" text NOT NULL DEFAULT 'unvalidated', ADD COLUMN "issuer_entity_id" uuid NULL, ADD CONSTRAINT "grouping_identifier_claim_Hc78GDpxNRUN_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "grouping_identifier_claim_N1QTk3Z2ITh5_fkey" FOREIGN KEY ("issuer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "grouping_identifier_issuer_idx" to table: "grouping_identifier_claim"
CREATE INDEX "grouping_identifier_issuer_idx" ON "grouping_identifier_claim" ("issuer_entity_id", "id") WHERE (issuer_entity_id IS NOT NULL);
-- Create "grouping_identifier_claim_revision" table
CREATE TABLE "grouping_identifier_claim_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "namespace" text NOT NULL,
  "value" text NOT NULL,
  "normalized_value" text NOT NULL,
  "normalization_policy" text NOT NULL DEFAULT 'exact.1',
  "validation_status" text NOT NULL DEFAULT 'unvalidated',
  "issuer_entity_id" uuid NULL,
  "state" text NOT NULL DEFAULT 'active',
  CONSTRAINT "grouping_identifier_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "grouping_identifier_claim_revision_4mfE7zIGIDyX_fkey" FOREIGN KEY ("owner_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_identifier_claim_revision_KiwGjE3msVxd_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_identifier_claim_revision_VHJgw365VOt3_fkey" FOREIGN KEY ("issuer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_identifier_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "grouping_identifier_claim" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Drop index "grouping_named_form_owner_idx" from table: "grouping_named_form"
DROP INDEX "grouping_named_form_owner_idx";
-- Modify "grouping_named_form" table
ALTER TABLE "grouping_named_form" DROP CONSTRAINT "grouping_named_form_kind_check", ADD CONSTRAINT "grouping_named_form_kind_check" CHECK ((octet_length(kind) >= 1) AND (octet_length(kind) <= 96)), DROP CONSTRAINT "grouping_named_form_language_check", ADD CONSTRAINT "grouping_named_form_language_check" CHECK (((language_tag IS NULL) AND (language_policy IS NULL) AND (private_use_namespace IS NULL)) OR ((language_tag IS NOT NULL) AND ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255)) AND (language_policy IS NOT NULL) AND ((private_use_namespace IS NULL) OR ((octet_length(private_use_namespace) >= 1) AND (octet_length(private_use_namespace) <= 512))))), DROP CONSTRAINT "grouping_named_form_value_check", ADD CONSTRAINT "grouping_named_form_value_check" CHECK (((octet_length(value) >= 1) AND (octet_length(value) <= 131072)) AND ((sort_name IS NULL) OR ((octet_length(sort_name) >= 1) AND (octet_length(sort_name) <= 131072)))), ADD CONSTRAINT "grouping_named_form_derivation_check" CHECK (num_nonnulls(derivation_name_id, derivation_revision) = ANY (ARRAY[0, 2])), ADD CONSTRAINT "grouping_named_form_method_check" CHECK (translation_method = ANY (ARRAY['human'::text, 'machine'::text, 'mixed'::text, 'unknown'::text, 'not_applicable'::text])), ADD CONSTRAINT "grouping_named_form_origin_check" CHECK (origin = ANY (ARRAY['original'::text, 'translation'::text, 'transliteration'::text, 'abbreviation'::text, 'variant'::text, 'unknown'::text])), ADD CONSTRAINT "grouping_named_form_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)), ADD CONSTRAINT "grouping_named_form_scope_check" CHECK (((territory IS NULL) OR ((octet_length(territory) >= 1) AND (octet_length(territory) <= 96))) AND ((context IS NULL) OR ((octet_length(context) >= 1) AND (octet_length(context) <= 512)))), ADD CONSTRAINT "grouping_named_form_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "revision" bigint NOT NULL DEFAULT 1, ADD COLUMN "recorded_at" timestamptz(3) NOT NULL DEFAULT now(), ADD COLUMN "recorded_by_auth_user_id" uuid NULL, ADD COLUMN "private_use_namespace" text NULL, ADD COLUMN "language_policy" text NULL, ADD COLUMN "sort_name" text NULL, ADD COLUMN "origin" text NOT NULL DEFAULT 'unknown', ADD COLUMN "translation_method" text NOT NULL DEFAULT 'unknown', ADD COLUMN "primary_for_language" boolean NULL, ADD COLUMN "scope_owner_id" uuid NULL, ADD COLUMN "territory" text NULL, ADD COLUMN "context" text NULL, ADD COLUMN "derivation_name_id" uuid NULL, ADD COLUMN "derivation_revision" bigint NULL, ADD COLUMN "begin" jsonb NULL, ADD COLUMN "end" jsonb NULL, ADD COLUMN "ended" boolean NULL, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0, ADD CONSTRAINT "grouping_named_form_recorded_by_auth_user_id_users_id_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "grouping_named_form_scope_owner_id_grouping_identity_id_fkey" FOREIGN KEY ("scope_owner_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "grouping_named_form_scope_idx" to table: "grouping_named_form"
CREATE INDEX "grouping_named_form_scope_idx" ON "grouping_named_form" ("scope_owner_id", "id") WHERE (scope_owner_id IS NOT NULL);
-- Create "grouping_named_form_revision" table
CREATE TABLE "grouping_named_form_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "language_tag" text NULL,
  "private_use_namespace" text NULL,
  "language_policy" text NULL,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "sort_name" text NULL,
  "origin" text NOT NULL DEFAULT 'unknown',
  "translation_method" text NOT NULL DEFAULT 'unknown',
  "primary_for_language" boolean NULL,
  "scope_owner_id" uuid NULL,
  "territory" text NULL,
  "context" text NULL,
  "derivation_name_id" uuid NULL,
  "derivation_revision" bigint NULL,
  "begin" jsonb NULL,
  "end" jsonb NULL,
  "ended" boolean NULL,
  "spoiler" integer NOT NULL DEFAULT 0,
  "state" text NOT NULL DEFAULT 'active',
  CONSTRAINT "grouping_named_form_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "grouping_named_form_derivation_fk" FOREIGN KEY ("owner_id", "derivation_name_id", "derivation_revision") REFERENCES "grouping_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_named_form_revision_b9u0TlaL2sty_fkey" FOREIGN KEY ("scope_owner_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_named_form_revision_fxcwffdrxjQX_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_named_form_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "grouping_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_named_form_revision_owner_id_grouping_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "grouping_named_form_derivation_idx" to table: "grouping_named_form_revision"
CREATE INDEX "grouping_named_form_derivation_idx" ON "grouping_named_form_revision" ("owner_id", "derivation_name_id", "derivation_revision") WHERE (derivation_name_id IS NOT NULL);
-- Create "grouping_name_authority" table
CREATE TABLE "grouping_name_authority" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "claim" text NOT NULL,
  "review_state" text NOT NULL,
  "authorizer_entity_id" uuid NULL,
  "role" text NOT NULL,
  "territory" text NULL,
  "channel" text NULL,
  "context" text NULL,
  "valid_from" timestamptz(3) NULL,
  "valid_until" timestamptz(3) NULL,
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "review_source_record_id" uuid NULL,
  "review_snapshot_id" uuid NULL,
  "review_source_path" text NULL,
  "state" text NOT NULL,
  CONSTRAINT "grouping_name_authority_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "grouping_name_authority_SGhMK6paQTpA_fkey" FOREIGN KEY ("authorizer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_authority_evidence_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_authority_owner_id_grouping_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_authority_recorded_by_auth_user_id_users_id_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_authority_review_fk" FOREIGN KEY ("review_source_record_id", "review_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_authority_target_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "grouping_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_authority_claim_check" CHECK (claim = ANY (ARRAY['official'::text, 'unofficial'::text, 'unknown'::text])),
  CONSTRAINT "grouping_name_authority_proof_check" CHECK (((review_state <> 'verified'::text) OR ((authorizer_entity_id IS NOT NULL) AND (review_snapshot_id IS NOT NULL))) AND (num_nonnulls(review_source_record_id, review_snapshot_id, review_source_path) = ANY (ARRAY[0, 3]))),
  CONSTRAINT "grouping_name_authority_review_check" CHECK (review_state = ANY (ARRAY['source_claim'::text, 'pending'::text, 'verified'::text, 'rejected'::text])),
  CONSTRAINT "grouping_name_authority_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "grouping_name_authority_scope_check" CHECK (((octet_length(role) >= 1) AND (octet_length(role) <= 96)) AND ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 4096)) AND ((review_source_path IS NULL) OR ((octet_length(review_source_path) >= 1) AND (octet_length(review_source_path) <= 4096))) AND ((territory IS NULL) OR ((octet_length(territory) >= 1) AND (octet_length(territory) <= 96))) AND ((channel IS NULL) OR ((octet_length(channel) >= 1) AND (octet_length(channel) <= 96))) AND ((context IS NULL) OR ((octet_length(context) >= 1) AND (octet_length(context) <= 512)))),
  CONSTRAINT "grouping_name_authority_state_check" CHECK (state = ANY (ARRAY['active'::text, 'withdrawn'::text])),
  CONSTRAINT "grouping_name_authority_time_check" CHECK ((valid_from IS NULL) OR (valid_until IS NULL) OR (valid_until > valid_from))
);
-- Create index "grouping_name_authority_authorizer_idx" to table: "grouping_name_authority"
CREATE INDEX "grouping_name_authority_authorizer_idx" ON "grouping_name_authority" ("authorizer_entity_id", "owner_id", "id") WHERE (authorizer_entity_id IS NOT NULL);
-- Create index "grouping_name_authority_evidence_idx" to table: "grouping_name_authority"
CREATE INDEX "grouping_name_authority_evidence_idx" ON "grouping_name_authority" ("source_record_id", "snapshot_id", "id");
-- Create index "grouping_name_authority_review_idx" to table: "grouping_name_authority"
CREATE INDEX "grouping_name_authority_review_idx" ON "grouping_name_authority" ("review_source_record_id", "review_snapshot_id", "id") WHERE (review_source_record_id IS NOT NULL);
-- Create index "grouping_name_authority_target_idx" to table: "grouping_name_authority"
CREATE INDEX "grouping_name_authority_target_idx" ON "grouping_name_authority" ("owner_id", "name_id", "name_revision", "id");
-- Create "grouping_name_authority_revision" table
CREATE TABLE "grouping_name_authority_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "claim" text NOT NULL,
  "review_state" text NOT NULL,
  "authorizer_entity_id" uuid NULL,
  "role" text NOT NULL,
  "territory" text NULL,
  "channel" text NULL,
  "context" text NULL,
  "valid_from" timestamptz(3) NULL,
  "valid_until" timestamptz(3) NULL,
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "review_source_record_id" uuid NULL,
  "review_snapshot_id" uuid NULL,
  "review_source_path" text NULL,
  "state" text NOT NULL,
  CONSTRAINT "grouping_name_authority_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "grouping_name_authority_history_evidence_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_authority_history_review_fk" FOREIGN KEY ("review_source_record_id", "review_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_authority_history_target_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "grouping_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_authority_revision_bccD5x9t1XBC_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_authority_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "grouping_name_authority" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_authority_revision_qHF2aONQ1W9y_fkey" FOREIGN KEY ("authorizer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_authority_revision_qz5NRieigBeY_fkey" FOREIGN KEY ("owner_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create "grouping_name_source_binding" table
CREATE TABLE "grouping_name_source_binding" (
  "owner_id" uuid NOT NULL,
  "source_record_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "local_key" text NOT NULL,
  "name_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "grouping_name_source_binding_key" PRIMARY KEY ("source_record_id", "namespace", "local_key"),
  CONSTRAINT "grouping_name_source_binding_owner_key" UNIQUE ("owner_id", "source_record_id", "namespace", "local_key", "name_id"),
  CONSTRAINT "grouping_name_source_binding_eYXgXtCADHo5_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_source_binding_name_fk" FOREIGN KEY ("owner_id", "name_id") REFERENCES "grouping_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_source_binding_value_check" CHECK (((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 96)) AND ((octet_length(local_key) >= 1) AND (octet_length(local_key) <= 512)))
);
-- Create index "grouping_name_source_binding_owner_idx" to table: "grouping_name_source_binding"
CREATE INDEX "grouping_name_source_binding_owner_idx" ON "grouping_name_source_binding" ("owner_id", "name_id");
-- Create "grouping_name_source_occurrence" table
CREATE TABLE "grouping_name_source_occurrence" (
  "owner_id" uuid NOT NULL,
  "source_record_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "local_key" text NOT NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "grouping_name_source_occurrence_key" PRIMARY KEY ("source_record_id", "namespace", "local_key", "snapshot_id"),
  CONSTRAINT "grouping_name_source_occurrence_binding_fk" FOREIGN KEY ("owner_id", "source_record_id", "namespace", "local_key", "name_id") REFERENCES "grouping_name_source_binding" ("owner_id", "source_record_id", "namespace", "local_key", "name_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_source_occurrence_name_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "grouping_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_source_occurrence_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_source_occurrence_path_check" CHECK ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 4096))
);
-- Create index "grouping_name_source_occurrence_name_idx" to table: "grouping_name_source_occurrence"
CREATE INDEX "grouping_name_source_occurrence_name_idx" ON "grouping_name_source_occurrence" ("owner_id", "name_id", "name_revision");
-- Create index "grouping_name_source_occurrence_snapshot_idx" to table: "grouping_name_source_occurrence"
CREATE INDEX "grouping_name_source_occurrence_snapshot_idx" ON "grouping_name_source_occurrence" ("source_record_id", "snapshot_id");
-- Modify "grouping_relation_participant" table
ALTER TABLE "grouping_relation_participant" DROP CONSTRAINT "grouping_participant_target_check", ADD CONSTRAINT "grouping_participant_target_check" CHECK (num_nonnulls(publishing_id, music_id, program_id, software_id, entity_id, grouping_id, reference_id, distribution_id) = 1), ADD COLUMN "distribution_id" uuid NULL, ADD CONSTRAINT "grouping_relation_participant_jMOCs2UMIA8z_fkey" FOREIGN KEY ("distribution_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "grouping_participant_distribution_idx" to table: "grouping_relation_participant"
CREATE INDEX "grouping_participant_distribution_idx" ON "grouping_relation_participant" ("distribution_id", "role_revision_id", "relation_id") WHERE (distribution_id IS NOT NULL);
-- Modify "grouping_fact" table
ALTER TABLE "grouping_fact" ADD CONSTRAINT "grouping_fact_head_version_check" CHECK ((expected_head_version >= 0) AND (expected_head_version <= '9007199254740990'::bigint)), ADD CONSTRAINT "grouping_fact_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "semantic_id" uuid NOT NULL DEFAULT uuidv7(), ADD COLUMN "expected_head_version" bigint NOT NULL DEFAULT 0, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0;
-- Modify "grouping_catalog_relation" table
ALTER TABLE "grouping_catalog_relation" ADD CONSTRAINT "grouping_relation_head_version_check" CHECK ((expected_head_version >= 0) AND (expected_head_version <= '9007199254740990'::bigint)), ADD CONSTRAINT "grouping_relation_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "semantic_id" uuid NOT NULL DEFAULT uuidv7(), ADD COLUMN "expected_head_version" bigint NOT NULL DEFAULT 0, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0;
-- Create "grouping_semantic_revision" table
CREATE TABLE "grouping_semantic_revision" (
  "owner_id" uuid NOT NULL,
  "semantic_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "fact_id" uuid NULL,
  "relation_id" uuid NULL,
  "state" text NOT NULL DEFAULT 'active',
  "actor_auth_user_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "grouping_semantic_revision_key" PRIMARY KEY ("owner_id", "semantic_id", "version"),
  CONSTRAINT "grouping_semantic_revision_actor_auth_user_id_users_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "grouping_semantic_revision_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "grouping_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_semantic_revision_owner_id_grouping_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_semantic_revision_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "grouping_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_semantic_revision_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "grouping_semantic_revision_target_check" CHECK (num_nonnulls(fact_id, relation_id) = 1),
  CONSTRAINT "grouping_semantic_revision_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create index "grouping_semantic_revision_fact_idx" to table: "grouping_semantic_revision"
CREATE INDEX "grouping_semantic_revision_fact_idx" ON "grouping_semantic_revision" ("owner_id", "fact_id");
-- Create index "grouping_semantic_revision_relation_idx" to table: "grouping_semantic_revision"
CREATE INDEX "grouping_semantic_revision_relation_idx" ON "grouping_semantic_revision" ("owner_id", "relation_id");
-- Create "grouping_semantic_head" table
CREATE TABLE "grouping_semantic_head" (
  "owner_id" uuid NOT NULL,
  "semantic_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  CONSTRAINT "grouping_semantic_head_key" PRIMARY KEY ("owner_id", "semantic_id"),
  CONSTRAINT "grouping_semantic_head_revision_fk" FOREIGN KEY ("owner_id", "semantic_id", "version") REFERENCES "grouping_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create "grouping_source_binding" table
CREATE TABLE "grouping_source_binding" (
  "source_record_id" uuid NOT NULL,
  "mapping_key" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'grouping',
  "owner_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("source_record_id", "mapping_key"),
  CONSTRAINT "grouping_source_binding_claim_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_source_binding_owner_id_grouping_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_source_binding_owner_check" CHECK (mapping_owner = 'grouping'::text)
) PARTITION BY HASH ("source_record_id");
-- Create index "grouping_source_binding_owner_idx" to table: "grouping_source_binding"
CREATE INDEX "grouping_source_binding_owner_idx" ON "grouping_source_binding" ("owner_id", "mapping_key");
-- Create "music_release_candidate" table
CREATE TABLE "music_release_candidate" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'release_candidate',
  "credited_artist_text" text NULL,
  "barcode" text NULL,
  "comment" text NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "music_release_candidate_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "music_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_release_candidate_shape_check" CHECK (identity_shape = 'release_candidate'::text)
);
-- Modify "music_disc_toc" table
ALTER TABLE "music_disc_toc" DROP CONSTRAINT "music_disc_toc_count_check", ADD CONSTRAINT "music_disc_toc_count_check" CHECK (((track_count >= 1) AND (track_count <= 99)) AND ((leadout_offset >= 0) AND (leadout_offset <= '9007199254740991'::bigint)));
-- Create "music_candidate_toc" table
CREATE TABLE "music_candidate_toc" (
  "candidate_id" uuid NOT NULL,
  "toc_id" uuid NOT NULL,
  PRIMARY KEY ("candidate_id", "toc_id"),
  CONSTRAINT "music_candidate_toc_qT4n7cXd9aFO_fkey" FOREIGN KEY ("candidate_id") REFERENCES "music_release_candidate" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_candidate_toc_toc_id_music_disc_toc_id_fkey" FOREIGN KEY ("toc_id") REFERENCES "music_disc_toc" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "music_candidate_toc_reverse_idx" to table: "music_candidate_toc"
CREATE INDEX "music_candidate_toc_reverse_idx" ON "music_candidate_toc" ("toc_id", "candidate_id");
-- Create "music_candidate_track" table
CREATE TABLE "music_candidate_track" (
  "candidate_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "position" bigint NOT NULL,
  "name" text NOT NULL,
  "credited_artist_text" text NULL,
  PRIMARY KEY ("candidate_id", "id"),
  CONSTRAINT "music_candidate_track_position_key" UNIQUE ("candidate_id", "position"),
  CONSTRAINT "music_candidate_track_rKX3KSY4PekT_fkey" FOREIGN KEY ("candidate_id") REFERENCES "music_release_candidate" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_candidate_track_position_check" CHECK (("position" >= 0) AND ("position" <= '9007199254740991'::bigint))
);
-- Create "music_component_revision" table
CREATE TABLE "music_component_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  "owner_revision" bigint NOT NULL,
  "operation" text NOT NULL,
  "value" jsonb NOT NULL,
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "music_component_revision_owner_id_music_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_component_revision_operation_check" CHECK (operation = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])),
  CONSTRAINT "music_component_revision_value_check" CHECK ((jsonb_typeof(value) = 'object'::text) AND ((octet_length(component_key) >= 1) AND (octet_length(component_key) <= 512)) AND (owner_revision > 0))
);
-- Create index "music_component_revision_lookup_idx" to table: "music_component_revision"
CREATE INDEX "music_component_revision_lookup_idx" ON "music_component_revision" ("owner_id", "component", "component_key", "id");
-- Modify "music_fact_support" table
ALTER TABLE "music_fact_support" ADD CONSTRAINT "music_fact_support_AqSd2T39Ysfo_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "music_support_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop index "music_identifier_owner_idx" from table: "music_identifier_claim"
DROP INDEX "music_identifier_owner_idx";
-- Modify "music_identifier_claim" table
ALTER TABLE "music_identifier_claim" DROP CONSTRAINT "music_identifier_namespace_check", ADD CONSTRAINT "music_identifier_namespace_check" CHECK (namespace ~ '^[a-z][a-z0-9_.:-]{0,127}$'::text), DROP CONSTRAINT "music_identifier_value_check", ADD CONSTRAINT "music_identifier_value_check" CHECK (((octet_length(value) >= 1) AND (octet_length(value) <= 512)) AND ((octet_length(normalized_value) >= 1) AND (octet_length(normalized_value) <= 512)) AND ((octet_length(normalization_policy) >= 1) AND (octet_length(normalization_policy) <= 96))), ADD CONSTRAINT "music_identifier_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)), ADD CONSTRAINT "music_identifier_validation_check" CHECK (validation_status = ANY (ARRAY['unvalidated'::text, 'valid'::text])), ADD COLUMN "revision" bigint NOT NULL DEFAULT 1, ADD COLUMN "recorded_at" timestamptz(3) NOT NULL DEFAULT now(), ADD COLUMN "recorded_by_auth_user_id" uuid NULL, ADD COLUMN "normalization_policy" text NOT NULL DEFAULT 'exact.1', ADD COLUMN "validation_status" text NOT NULL DEFAULT 'unvalidated', ADD COLUMN "issuer_entity_id" uuid NULL, ADD CONSTRAINT "music_identifier_claim_issuer_entity_id_entity_identity_id_fkey" FOREIGN KEY ("issuer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "music_identifier_claim_recorded_by_auth_user_id_users_id_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "music_identifier_issuer_idx" to table: "music_identifier_claim"
CREATE INDEX "music_identifier_issuer_idx" ON "music_identifier_claim" ("issuer_entity_id", "id") WHERE (issuer_entity_id IS NOT NULL);
-- Create "music_identifier_claim_revision" table
CREATE TABLE "music_identifier_claim_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "namespace" text NOT NULL,
  "value" text NOT NULL,
  "normalized_value" text NOT NULL,
  "normalization_policy" text NOT NULL DEFAULT 'exact.1',
  "validation_status" text NOT NULL DEFAULT 'unvalidated',
  "issuer_entity_id" uuid NULL,
  "state" text NOT NULL DEFAULT 'active',
  CONSTRAINT "music_identifier_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "music_identifier_claim_revision_6jfogWSUqwmn_fkey" FOREIGN KEY ("issuer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_identifier_claim_revision_ZPqQO5MU6mx3_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_identifier_claim_revision_owner_id_music_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_identifier_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "music_identifier_claim" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create "music_medium_attribute_policy" table
CREATE TABLE "music_medium_attribute_policy" (
  "definition_revision_id" uuid NOT NULL,
  "value_mode" text NOT NULL,
  PRIMARY KEY ("definition_revision_id"),
  CONSTRAINT "music_medium_attribute_policy_r6OybfgFkN7N_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_medium_attribute_policy_mode_check" CHECK (value_mode = ANY (ARRAY['text'::text, 'vocabulary'::text]))
);
-- Create "music_medium_attribute" table
CREATE TABLE "music_medium_attribute" (
  "release_id" uuid NOT NULL,
  "medium_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "definition_revision_id" uuid NOT NULL,
  "value_revision_id" uuid NULL,
  "text_value" text NULL,
  PRIMARY KEY ("release_id", "medium_id", "id"),
  CONSTRAINT "music_medium_attribute_aA86uVnQTx0A_fkey" FOREIGN KEY ("value_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_medium_attribute_medium_fk" FOREIGN KEY ("release_id", "medium_id") REFERENCES "music_medium" ("release_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_medium_attribute_policy_fk" FOREIGN KEY ("definition_revision_id") REFERENCES "music_medium_attribute_policy" ("definition_revision_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_medium_attribute_tamAydfV3tyI_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_medium_attribute_value_check" CHECK ((value_revision_id IS NOT NULL) <> (text_value IS NOT NULL))
);
-- Create index "music_medium_attribute_definition_idx" to table: "music_medium_attribute"
CREATE INDEX "music_medium_attribute_definition_idx" ON "music_medium_attribute" ("definition_revision_id", "release_id", "medium_id", "id");
-- Create index "music_medium_attribute_value_idx" to table: "music_medium_attribute"
CREATE INDEX "music_medium_attribute_value_idx" ON "music_medium_attribute" ("value_revision_id", "release_id", "medium_id", "id");
-- Create "music_medium_attribute_allowed_format" table
CREATE TABLE "music_medium_attribute_allowed_format" (
  "definition_revision_id" uuid NOT NULL,
  "format_revision_id" uuid NOT NULL,
  PRIMARY KEY ("definition_revision_id", "format_revision_id"),
  CONSTRAINT "music_medium_attribute_allowed_format_J4E73emQHb8H_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "music_medium_attribute_policy" ("definition_revision_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_medium_attribute_allowed_format_SNFv7H9E2cmX_fkey" FOREIGN KEY ("format_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create "music_medium_attribute_allowed_value_format" table
CREATE TABLE "music_medium_attribute_allowed_value_format" (
  "definition_revision_id" uuid NOT NULL,
  "value_revision_id" uuid NOT NULL,
  "format_revision_id" uuid NOT NULL,
  PRIMARY KEY ("definition_revision_id", "value_revision_id", "format_revision_id"),
  CONSTRAINT "music_medium_attribute_allowed_value_format_policy_fk" FOREIGN KEY ("definition_revision_id", "format_revision_id") REFERENCES "music_medium_attribute_allowed_format" ("definition_revision_id", "format_revision_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_medium_attribute_allowed_value_format_uZvz5oeDFpNh_fkey" FOREIGN KEY ("value_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Drop index "music_named_form_owner_idx" from table: "music_named_form"
DROP INDEX "music_named_form_owner_idx";
-- Modify "music_named_form" table
ALTER TABLE "music_named_form" DROP CONSTRAINT "music_named_form_kind_check", ADD CONSTRAINT "music_named_form_kind_check" CHECK ((octet_length(kind) >= 1) AND (octet_length(kind) <= 96)), DROP CONSTRAINT "music_named_form_language_check", ADD CONSTRAINT "music_named_form_language_check" CHECK (((language_tag IS NULL) AND (language_policy IS NULL) AND (private_use_namespace IS NULL)) OR ((language_tag IS NOT NULL) AND ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255)) AND (language_policy IS NOT NULL) AND ((private_use_namespace IS NULL) OR ((octet_length(private_use_namespace) >= 1) AND (octet_length(private_use_namespace) <= 512))))), DROP CONSTRAINT "music_named_form_value_check", ADD CONSTRAINT "music_named_form_value_check" CHECK (((octet_length(value) >= 1) AND (octet_length(value) <= 131072)) AND ((sort_name IS NULL) OR ((octet_length(sort_name) >= 1) AND (octet_length(sort_name) <= 131072)))), ADD CONSTRAINT "music_named_form_derivation_check" CHECK (num_nonnulls(derivation_name_id, derivation_revision) = ANY (ARRAY[0, 2])), ADD CONSTRAINT "music_named_form_method_check" CHECK (translation_method = ANY (ARRAY['human'::text, 'machine'::text, 'mixed'::text, 'unknown'::text, 'not_applicable'::text])), ADD CONSTRAINT "music_named_form_origin_check" CHECK (origin = ANY (ARRAY['original'::text, 'translation'::text, 'transliteration'::text, 'abbreviation'::text, 'variant'::text, 'unknown'::text])), ADD CONSTRAINT "music_named_form_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)), ADD CONSTRAINT "music_named_form_scope_check" CHECK (((territory IS NULL) OR ((octet_length(territory) >= 1) AND (octet_length(territory) <= 96))) AND ((context IS NULL) OR ((octet_length(context) >= 1) AND (octet_length(context) <= 512)))), ADD CONSTRAINT "music_named_form_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "revision" bigint NOT NULL DEFAULT 1, ADD COLUMN "recorded_at" timestamptz(3) NOT NULL DEFAULT now(), ADD COLUMN "recorded_by_auth_user_id" uuid NULL, ADD COLUMN "private_use_namespace" text NULL, ADD COLUMN "language_policy" text NULL, ADD COLUMN "sort_name" text NULL, ADD COLUMN "origin" text NOT NULL DEFAULT 'unknown', ADD COLUMN "translation_method" text NOT NULL DEFAULT 'unknown', ADD COLUMN "primary_for_language" boolean NULL, ADD COLUMN "scope_owner_id" uuid NULL, ADD COLUMN "territory" text NULL, ADD COLUMN "context" text NULL, ADD COLUMN "derivation_name_id" uuid NULL, ADD COLUMN "derivation_revision" bigint NULL, ADD COLUMN "begin" jsonb NULL, ADD COLUMN "end" jsonb NULL, ADD COLUMN "ended" boolean NULL, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0, ADD CONSTRAINT "music_named_form_recorded_by_auth_user_id_users_id_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "music_named_form_scope_owner_id_music_identity_id_fkey" FOREIGN KEY ("scope_owner_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "music_named_form_scope_idx" to table: "music_named_form"
CREATE INDEX "music_named_form_scope_idx" ON "music_named_form" ("scope_owner_id", "id") WHERE (scope_owner_id IS NOT NULL);
-- Create "music_named_form_revision" table
CREATE TABLE "music_named_form_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "language_tag" text NULL,
  "private_use_namespace" text NULL,
  "language_policy" text NULL,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "sort_name" text NULL,
  "origin" text NOT NULL DEFAULT 'unknown',
  "translation_method" text NOT NULL DEFAULT 'unknown',
  "primary_for_language" boolean NULL,
  "scope_owner_id" uuid NULL,
  "territory" text NULL,
  "context" text NULL,
  "derivation_name_id" uuid NULL,
  "derivation_revision" bigint NULL,
  "begin" jsonb NULL,
  "end" jsonb NULL,
  "ended" boolean NULL,
  "spoiler" integer NOT NULL DEFAULT 0,
  "state" text NOT NULL DEFAULT 'active',
  CONSTRAINT "music_named_form_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "music_named_form_derivation_fk" FOREIGN KEY ("owner_id", "derivation_name_id", "derivation_revision") REFERENCES "music_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_named_form_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "music_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_named_form_revision_owner_id_music_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_named_form_revision_r0BY5ybx1oBz_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_named_form_revision_scope_owner_id_music_identity_id_fkey" FOREIGN KEY ("scope_owner_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "music_named_form_derivation_idx" to table: "music_named_form_revision"
CREATE INDEX "music_named_form_derivation_idx" ON "music_named_form_revision" ("owner_id", "derivation_name_id", "derivation_revision") WHERE (derivation_name_id IS NOT NULL);
-- Create "music_name_authority" table
CREATE TABLE "music_name_authority" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "claim" text NOT NULL,
  "review_state" text NOT NULL,
  "authorizer_entity_id" uuid NULL,
  "role" text NOT NULL,
  "territory" text NULL,
  "channel" text NULL,
  "context" text NULL,
  "valid_from" timestamptz(3) NULL,
  "valid_until" timestamptz(3) NULL,
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "review_source_record_id" uuid NULL,
  "review_snapshot_id" uuid NULL,
  "review_source_path" text NULL,
  "state" text NOT NULL,
  CONSTRAINT "music_name_authority_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "music_name_authority_2epU70cQNynO_fkey" FOREIGN KEY ("authorizer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_authority_evidence_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_authority_owner_id_music_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_authority_recorded_by_auth_user_id_users_id_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_authority_review_fk" FOREIGN KEY ("review_source_record_id", "review_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_authority_target_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "music_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_authority_claim_check" CHECK (claim = ANY (ARRAY['official'::text, 'unofficial'::text, 'unknown'::text])),
  CONSTRAINT "music_name_authority_proof_check" CHECK (((review_state <> 'verified'::text) OR ((authorizer_entity_id IS NOT NULL) AND (review_snapshot_id IS NOT NULL))) AND (num_nonnulls(review_source_record_id, review_snapshot_id, review_source_path) = ANY (ARRAY[0, 3]))),
  CONSTRAINT "music_name_authority_review_check" CHECK (review_state = ANY (ARRAY['source_claim'::text, 'pending'::text, 'verified'::text, 'rejected'::text])),
  CONSTRAINT "music_name_authority_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "music_name_authority_scope_check" CHECK (((octet_length(role) >= 1) AND (octet_length(role) <= 96)) AND ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 4096)) AND ((review_source_path IS NULL) OR ((octet_length(review_source_path) >= 1) AND (octet_length(review_source_path) <= 4096))) AND ((territory IS NULL) OR ((octet_length(territory) >= 1) AND (octet_length(territory) <= 96))) AND ((channel IS NULL) OR ((octet_length(channel) >= 1) AND (octet_length(channel) <= 96))) AND ((context IS NULL) OR ((octet_length(context) >= 1) AND (octet_length(context) <= 512)))),
  CONSTRAINT "music_name_authority_state_check" CHECK (state = ANY (ARRAY['active'::text, 'withdrawn'::text])),
  CONSTRAINT "music_name_authority_time_check" CHECK ((valid_from IS NULL) OR (valid_until IS NULL) OR (valid_until > valid_from))
);
-- Create index "music_name_authority_authorizer_idx" to table: "music_name_authority"
CREATE INDEX "music_name_authority_authorizer_idx" ON "music_name_authority" ("authorizer_entity_id", "owner_id", "id") WHERE (authorizer_entity_id IS NOT NULL);
-- Create index "music_name_authority_evidence_idx" to table: "music_name_authority"
CREATE INDEX "music_name_authority_evidence_idx" ON "music_name_authority" ("source_record_id", "snapshot_id", "id");
-- Create index "music_name_authority_review_idx" to table: "music_name_authority"
CREATE INDEX "music_name_authority_review_idx" ON "music_name_authority" ("review_source_record_id", "review_snapshot_id", "id") WHERE (review_source_record_id IS NOT NULL);
-- Create index "music_name_authority_target_idx" to table: "music_name_authority"
CREATE INDEX "music_name_authority_target_idx" ON "music_name_authority" ("owner_id", "name_id", "name_revision", "id");
-- Create "music_name_authority_revision" table
CREATE TABLE "music_name_authority_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "claim" text NOT NULL,
  "review_state" text NOT NULL,
  "authorizer_entity_id" uuid NULL,
  "role" text NOT NULL,
  "territory" text NULL,
  "channel" text NULL,
  "context" text NULL,
  "valid_from" timestamptz(3) NULL,
  "valid_until" timestamptz(3) NULL,
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "review_source_record_id" uuid NULL,
  "review_snapshot_id" uuid NULL,
  "review_source_path" text NULL,
  "state" text NOT NULL,
  CONSTRAINT "music_name_authority_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "music_name_authority_history_evidence_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_authority_history_review_fk" FOREIGN KEY ("review_source_record_id", "review_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_authority_history_target_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "music_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_authority_revision_3vnKhIYApeEK_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_authority_revision_EQ4uK6JR5PeS_fkey" FOREIGN KEY ("authorizer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_authority_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "music_name_authority" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_authority_revision_owner_id_music_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create "music_name_source_binding" table
CREATE TABLE "music_name_source_binding" (
  "owner_id" uuid NOT NULL,
  "source_record_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "local_key" text NOT NULL,
  "name_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "music_name_source_binding_key" PRIMARY KEY ("source_record_id", "namespace", "local_key"),
  CONSTRAINT "music_name_source_binding_owner_key" UNIQUE ("owner_id", "source_record_id", "namespace", "local_key", "name_id"),
  CONSTRAINT "music_name_source_binding_name_fk" FOREIGN KEY ("owner_id", "name_id") REFERENCES "music_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_source_binding_wmtwOzi5CrGj_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_source_binding_value_check" CHECK (((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 96)) AND ((octet_length(local_key) >= 1) AND (octet_length(local_key) <= 512)))
);
-- Create index "music_name_source_binding_owner_idx" to table: "music_name_source_binding"
CREATE INDEX "music_name_source_binding_owner_idx" ON "music_name_source_binding" ("owner_id", "name_id");
-- Create "music_name_source_occurrence" table
CREATE TABLE "music_name_source_occurrence" (
  "owner_id" uuid NOT NULL,
  "source_record_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "local_key" text NOT NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "music_name_source_occurrence_key" PRIMARY KEY ("source_record_id", "namespace", "local_key", "snapshot_id"),
  CONSTRAINT "music_name_source_occurrence_binding_fk" FOREIGN KEY ("owner_id", "source_record_id", "namespace", "local_key", "name_id") REFERENCES "music_name_source_binding" ("owner_id", "source_record_id", "namespace", "local_key", "name_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_source_occurrence_name_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "music_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_source_occurrence_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_source_occurrence_path_check" CHECK ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 4096))
);
-- Create index "music_name_source_occurrence_name_idx" to table: "music_name_source_occurrence"
CREATE INDEX "music_name_source_occurrence_name_idx" ON "music_name_source_occurrence" ("owner_id", "name_id", "name_revision");
-- Create index "music_name_source_occurrence_snapshot_idx" to table: "music_name_source_occurrence"
CREATE INDEX "music_name_source_occurrence_snapshot_idx" ON "music_name_source_occurrence" ("source_record_id", "snapshot_id");
-- Modify "music_relation_participant" table
ALTER TABLE "music_relation_participant" DROP CONSTRAINT "music_participant_target_check", ADD CONSTRAINT "music_participant_target_check" CHECK (num_nonnulls(publishing_id, music_id, program_id, software_id, entity_id, grouping_id, reference_id, distribution_id) = 1), ADD COLUMN "distribution_id" uuid NULL, ADD CONSTRAINT "music_relation_participant_T0ur2YeFxD6l_fkey" FOREIGN KEY ("distribution_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "music_participant_distribution_idx" to table: "music_relation_participant"
CREATE INDEX "music_participant_distribution_idx" ON "music_relation_participant" ("distribution_id", "role_revision_id", "relation_id") WHERE (distribution_id IS NOT NULL);
-- Modify "music_fact" table
ALTER TABLE "music_fact" ADD CONSTRAINT "music_fact_head_version_check" CHECK ((expected_head_version >= 0) AND (expected_head_version <= '9007199254740990'::bigint)), ADD CONSTRAINT "music_fact_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "semantic_id" uuid NOT NULL DEFAULT uuidv7(), ADD COLUMN "expected_head_version" bigint NOT NULL DEFAULT 0, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0;
-- Modify "music_catalog_relation" table
ALTER TABLE "music_catalog_relation" ADD CONSTRAINT "music_relation_head_version_check" CHECK ((expected_head_version >= 0) AND (expected_head_version <= '9007199254740990'::bigint)), ADD CONSTRAINT "music_relation_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "semantic_id" uuid NOT NULL DEFAULT uuidv7(), ADD COLUMN "expected_head_version" bigint NOT NULL DEFAULT 0, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0;
-- Create "music_semantic_revision" table
CREATE TABLE "music_semantic_revision" (
  "owner_id" uuid NOT NULL,
  "semantic_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "fact_id" uuid NULL,
  "relation_id" uuid NULL,
  "state" text NOT NULL DEFAULT 'active',
  "actor_auth_user_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "music_semantic_revision_key" PRIMARY KEY ("owner_id", "semantic_id", "version"),
  CONSTRAINT "music_semantic_revision_actor_auth_user_id_users_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "music_semantic_revision_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "music_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_semantic_revision_owner_id_music_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_semantic_revision_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "music_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_semantic_revision_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "music_semantic_revision_target_check" CHECK (num_nonnulls(fact_id, relation_id) = 1),
  CONSTRAINT "music_semantic_revision_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create index "music_semantic_revision_fact_idx" to table: "music_semantic_revision"
CREATE INDEX "music_semantic_revision_fact_idx" ON "music_semantic_revision" ("owner_id", "fact_id");
-- Create index "music_semantic_revision_relation_idx" to table: "music_semantic_revision"
CREATE INDEX "music_semantic_revision_relation_idx" ON "music_semantic_revision" ("owner_id", "relation_id");
-- Create "music_semantic_head" table
CREATE TABLE "music_semantic_head" (
  "owner_id" uuid NOT NULL,
  "semantic_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  CONSTRAINT "music_semantic_head_key" PRIMARY KEY ("owner_id", "semantic_id"),
  CONSTRAINT "music_semantic_head_revision_fk" FOREIGN KEY ("owner_id", "semantic_id", "version") REFERENCES "music_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create "music_source_binding" table
CREATE TABLE "music_source_binding" (
  "source_record_id" uuid NOT NULL,
  "mapping_key" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'music',
  "owner_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("source_record_id", "mapping_key"),
  CONSTRAINT "music_source_binding_claim_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_source_binding_owner_id_music_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_source_binding_owner_check" CHECK (mapping_owner = 'music'::text)
) PARTITION BY HASH ("source_record_id");
-- Create index "music_source_binding_owner_idx" to table: "music_source_binding"
CREATE INDEX "music_source_binding_owner_idx" ON "music_source_binding" ("owner_id", "mapping_key");
-- Create "operational_relay_pending" table
CREATE TABLE "operational_relay_pending" (
  "routing_bucket" integer NOT NULL,
  "message_id" uuid NOT NULL,
  "message_class" text NOT NULL,
  "routing_epoch" bigint NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("routing_bucket", "message_id"),
  CONSTRAINT "operational_relay_pending_outbox_fk" FOREIGN KEY ("routing_bucket", "message_id") REFERENCES "operational_outbox" ("routing_bucket", "message_id") ON UPDATE NO ACTION ON DELETE RESTRICT
) PARTITION BY RANGE ("routing_bucket");
-- Create index "operational_relay_pending_pick_idx" to table: "operational_relay_pending"
CREATE INDEX "operational_relay_pending_pick_idx" ON "operational_relay_pending" ("routing_bucket", "message_class", "routing_epoch", "created_at", "message_id");
-- Modify "program_fact_support" table
ALTER TABLE "program_fact_support" ADD CONSTRAINT "program_fact_support_FA55Qe3cQnCx_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "program_support_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop index "program_identifier_owner_idx" from table: "program_identifier_claim"
DROP INDEX "program_identifier_owner_idx";
-- Modify "program_identifier_claim" table
ALTER TABLE "program_identifier_claim" DROP CONSTRAINT "program_identifier_namespace_check", ADD CONSTRAINT "program_identifier_namespace_check" CHECK (namespace ~ '^[a-z][a-z0-9_.:-]{0,127}$'::text), DROP CONSTRAINT "program_identifier_value_check", ADD CONSTRAINT "program_identifier_value_check" CHECK (((octet_length(value) >= 1) AND (octet_length(value) <= 512)) AND ((octet_length(normalized_value) >= 1) AND (octet_length(normalized_value) <= 512)) AND ((octet_length(normalization_policy) >= 1) AND (octet_length(normalization_policy) <= 96))), ADD CONSTRAINT "program_identifier_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)), ADD CONSTRAINT "program_identifier_validation_check" CHECK (validation_status = ANY (ARRAY['unvalidated'::text, 'valid'::text])), ADD COLUMN "revision" bigint NOT NULL DEFAULT 1, ADD COLUMN "recorded_at" timestamptz(3) NOT NULL DEFAULT now(), ADD COLUMN "recorded_by_auth_user_id" uuid NULL, ADD COLUMN "normalization_policy" text NOT NULL DEFAULT 'exact.1', ADD COLUMN "validation_status" text NOT NULL DEFAULT 'unvalidated', ADD COLUMN "issuer_entity_id" uuid NULL, ADD CONSTRAINT "program_identifier_claim_cCDBj8aBv920_fkey" FOREIGN KEY ("issuer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "program_identifier_claim_recorded_by_auth_user_id_users_id_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "program_identifier_issuer_idx" to table: "program_identifier_claim"
CREATE INDEX "program_identifier_issuer_idx" ON "program_identifier_claim" ("issuer_entity_id", "id") WHERE (issuer_entity_id IS NOT NULL);
-- Create "program_identifier_claim_revision" table
CREATE TABLE "program_identifier_claim_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "namespace" text NOT NULL,
  "value" text NOT NULL,
  "normalized_value" text NOT NULL,
  "normalization_policy" text NOT NULL DEFAULT 'exact.1',
  "validation_status" text NOT NULL DEFAULT 'unvalidated',
  "issuer_entity_id" uuid NULL,
  "state" text NOT NULL DEFAULT 'active',
  CONSTRAINT "program_identifier_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "program_identifier_claim_revision_Hs94Lq8DMwzX_fkey" FOREIGN KEY ("owner_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_identifier_claim_revision_U4kJVXCOqI2e_fkey" FOREIGN KEY ("issuer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_identifier_claim_revision_hfyxyky57rN6_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_identifier_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "program_identifier_claim" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Drop index "program_named_form_owner_idx" from table: "program_named_form"
DROP INDEX "program_named_form_owner_idx";
-- Modify "program_named_form" table
ALTER TABLE "program_named_form" DROP CONSTRAINT "program_named_form_kind_check", ADD CONSTRAINT "program_named_form_kind_check" CHECK ((octet_length(kind) >= 1) AND (octet_length(kind) <= 96)), DROP CONSTRAINT "program_named_form_language_check", ADD CONSTRAINT "program_named_form_language_check" CHECK (((language_tag IS NULL) AND (language_policy IS NULL) AND (private_use_namespace IS NULL)) OR ((language_tag IS NOT NULL) AND ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255)) AND (language_policy IS NOT NULL) AND ((private_use_namespace IS NULL) OR ((octet_length(private_use_namespace) >= 1) AND (octet_length(private_use_namespace) <= 512))))), DROP CONSTRAINT "program_named_form_value_check", ADD CONSTRAINT "program_named_form_value_check" CHECK (((octet_length(value) >= 1) AND (octet_length(value) <= 131072)) AND ((sort_name IS NULL) OR ((octet_length(sort_name) >= 1) AND (octet_length(sort_name) <= 131072)))), ADD CONSTRAINT "program_named_form_derivation_check" CHECK (num_nonnulls(derivation_name_id, derivation_revision) = ANY (ARRAY[0, 2])), ADD CONSTRAINT "program_named_form_method_check" CHECK (translation_method = ANY (ARRAY['human'::text, 'machine'::text, 'mixed'::text, 'unknown'::text, 'not_applicable'::text])), ADD CONSTRAINT "program_named_form_origin_check" CHECK (origin = ANY (ARRAY['original'::text, 'translation'::text, 'transliteration'::text, 'abbreviation'::text, 'variant'::text, 'unknown'::text])), ADD CONSTRAINT "program_named_form_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)), ADD CONSTRAINT "program_named_form_scope_check" CHECK (((territory IS NULL) OR ((octet_length(territory) >= 1) AND (octet_length(territory) <= 96))) AND ((context IS NULL) OR ((octet_length(context) >= 1) AND (octet_length(context) <= 512)))), ADD CONSTRAINT "program_named_form_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "revision" bigint NOT NULL DEFAULT 1, ADD COLUMN "recorded_at" timestamptz(3) NOT NULL DEFAULT now(), ADD COLUMN "recorded_by_auth_user_id" uuid NULL, ADD COLUMN "private_use_namespace" text NULL, ADD COLUMN "language_policy" text NULL, ADD COLUMN "sort_name" text NULL, ADD COLUMN "origin" text NOT NULL DEFAULT 'unknown', ADD COLUMN "translation_method" text NOT NULL DEFAULT 'unknown', ADD COLUMN "primary_for_language" boolean NULL, ADD COLUMN "scope_owner_id" uuid NULL, ADD COLUMN "territory" text NULL, ADD COLUMN "context" text NULL, ADD COLUMN "derivation_name_id" uuid NULL, ADD COLUMN "derivation_revision" bigint NULL, ADD COLUMN "begin" jsonb NULL, ADD COLUMN "end" jsonb NULL, ADD COLUMN "ended" boolean NULL, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0, ADD CONSTRAINT "program_named_form_recorded_by_auth_user_id_users_id_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "program_named_form_scope_owner_id_program_identity_id_fkey" FOREIGN KEY ("scope_owner_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "program_named_form_scope_idx" to table: "program_named_form"
CREATE INDEX "program_named_form_scope_idx" ON "program_named_form" ("scope_owner_id", "id") WHERE (scope_owner_id IS NOT NULL);
-- Create "program_named_form_revision" table
CREATE TABLE "program_named_form_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "language_tag" text NULL,
  "private_use_namespace" text NULL,
  "language_policy" text NULL,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "sort_name" text NULL,
  "origin" text NOT NULL DEFAULT 'unknown',
  "translation_method" text NOT NULL DEFAULT 'unknown',
  "primary_for_language" boolean NULL,
  "scope_owner_id" uuid NULL,
  "territory" text NULL,
  "context" text NULL,
  "derivation_name_id" uuid NULL,
  "derivation_revision" bigint NULL,
  "begin" jsonb NULL,
  "end" jsonb NULL,
  "ended" boolean NULL,
  "spoiler" integer NOT NULL DEFAULT 0,
  "state" text NOT NULL DEFAULT 'active',
  CONSTRAINT "program_named_form_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "program_named_form_derivation_fk" FOREIGN KEY ("owner_id", "derivation_name_id", "derivation_revision") REFERENCES "program_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_named_form_revision_IKfrvUlp6moU_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_named_form_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "program_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_named_form_revision_j0ZZlpRCH37M_fkey" FOREIGN KEY ("scope_owner_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_named_form_revision_owner_id_program_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "program_named_form_derivation_idx" to table: "program_named_form_revision"
CREATE INDEX "program_named_form_derivation_idx" ON "program_named_form_revision" ("owner_id", "derivation_name_id", "derivation_revision") WHERE (derivation_name_id IS NOT NULL);
-- Create "program_name_authority" table
CREATE TABLE "program_name_authority" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "claim" text NOT NULL,
  "review_state" text NOT NULL,
  "authorizer_entity_id" uuid NULL,
  "role" text NOT NULL,
  "territory" text NULL,
  "channel" text NULL,
  "context" text NULL,
  "valid_from" timestamptz(3) NULL,
  "valid_until" timestamptz(3) NULL,
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "review_source_record_id" uuid NULL,
  "review_snapshot_id" uuid NULL,
  "review_source_path" text NULL,
  "state" text NOT NULL,
  CONSTRAINT "program_name_authority_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "program_name_authority_9dFhis6pXn4v_fkey" FOREIGN KEY ("authorizer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_authority_evidence_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_authority_owner_id_program_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_authority_recorded_by_auth_user_id_users_id_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_authority_review_fk" FOREIGN KEY ("review_source_record_id", "review_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_authority_target_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "program_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_authority_claim_check" CHECK (claim = ANY (ARRAY['official'::text, 'unofficial'::text, 'unknown'::text])),
  CONSTRAINT "program_name_authority_proof_check" CHECK (((review_state <> 'verified'::text) OR ((authorizer_entity_id IS NOT NULL) AND (review_snapshot_id IS NOT NULL))) AND (num_nonnulls(review_source_record_id, review_snapshot_id, review_source_path) = ANY (ARRAY[0, 3]))),
  CONSTRAINT "program_name_authority_review_check" CHECK (review_state = ANY (ARRAY['source_claim'::text, 'pending'::text, 'verified'::text, 'rejected'::text])),
  CONSTRAINT "program_name_authority_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "program_name_authority_scope_check" CHECK (((octet_length(role) >= 1) AND (octet_length(role) <= 96)) AND ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 4096)) AND ((review_source_path IS NULL) OR ((octet_length(review_source_path) >= 1) AND (octet_length(review_source_path) <= 4096))) AND ((territory IS NULL) OR ((octet_length(territory) >= 1) AND (octet_length(territory) <= 96))) AND ((channel IS NULL) OR ((octet_length(channel) >= 1) AND (octet_length(channel) <= 96))) AND ((context IS NULL) OR ((octet_length(context) >= 1) AND (octet_length(context) <= 512)))),
  CONSTRAINT "program_name_authority_state_check" CHECK (state = ANY (ARRAY['active'::text, 'withdrawn'::text])),
  CONSTRAINT "program_name_authority_time_check" CHECK ((valid_from IS NULL) OR (valid_until IS NULL) OR (valid_until > valid_from))
);
-- Create index "program_name_authority_authorizer_idx" to table: "program_name_authority"
CREATE INDEX "program_name_authority_authorizer_idx" ON "program_name_authority" ("authorizer_entity_id", "owner_id", "id") WHERE (authorizer_entity_id IS NOT NULL);
-- Create index "program_name_authority_evidence_idx" to table: "program_name_authority"
CREATE INDEX "program_name_authority_evidence_idx" ON "program_name_authority" ("source_record_id", "snapshot_id", "id");
-- Create index "program_name_authority_review_idx" to table: "program_name_authority"
CREATE INDEX "program_name_authority_review_idx" ON "program_name_authority" ("review_source_record_id", "review_snapshot_id", "id") WHERE (review_source_record_id IS NOT NULL);
-- Create index "program_name_authority_target_idx" to table: "program_name_authority"
CREATE INDEX "program_name_authority_target_idx" ON "program_name_authority" ("owner_id", "name_id", "name_revision", "id");
-- Create "program_name_authority_revision" table
CREATE TABLE "program_name_authority_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "claim" text NOT NULL,
  "review_state" text NOT NULL,
  "authorizer_entity_id" uuid NULL,
  "role" text NOT NULL,
  "territory" text NULL,
  "channel" text NULL,
  "context" text NULL,
  "valid_from" timestamptz(3) NULL,
  "valid_until" timestamptz(3) NULL,
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "review_source_record_id" uuid NULL,
  "review_snapshot_id" uuid NULL,
  "review_source_path" text NULL,
  "state" text NOT NULL,
  CONSTRAINT "program_name_authority_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "program_name_authority_history_evidence_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_authority_history_review_fk" FOREIGN KEY ("review_source_record_id", "review_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_authority_history_target_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "program_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_authority_revision_QQS34OPKbCmh_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_authority_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "program_name_authority" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_authority_revision_jdGT1pqLN3eJ_fkey" FOREIGN KEY ("authorizer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_authority_revision_zYzV0HdKvxCa_fkey" FOREIGN KEY ("owner_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create "program_name_source_binding" table
CREATE TABLE "program_name_source_binding" (
  "owner_id" uuid NOT NULL,
  "source_record_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "local_key" text NOT NULL,
  "name_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "program_name_source_binding_key" PRIMARY KEY ("source_record_id", "namespace", "local_key"),
  CONSTRAINT "program_name_source_binding_owner_key" UNIQUE ("owner_id", "source_record_id", "namespace", "local_key", "name_id"),
  CONSTRAINT "program_name_source_binding_ejRL70sTGKf0_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_source_binding_name_fk" FOREIGN KEY ("owner_id", "name_id") REFERENCES "program_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_source_binding_value_check" CHECK (((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 96)) AND ((octet_length(local_key) >= 1) AND (octet_length(local_key) <= 512)))
);
-- Create index "program_name_source_binding_owner_idx" to table: "program_name_source_binding"
CREATE INDEX "program_name_source_binding_owner_idx" ON "program_name_source_binding" ("owner_id", "name_id");
-- Create "program_name_source_occurrence" table
CREATE TABLE "program_name_source_occurrence" (
  "owner_id" uuid NOT NULL,
  "source_record_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "local_key" text NOT NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "program_name_source_occurrence_key" PRIMARY KEY ("source_record_id", "namespace", "local_key", "snapshot_id"),
  CONSTRAINT "program_name_source_occurrence_binding_fk" FOREIGN KEY ("owner_id", "source_record_id", "namespace", "local_key", "name_id") REFERENCES "program_name_source_binding" ("owner_id", "source_record_id", "namespace", "local_key", "name_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_source_occurrence_name_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "program_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_source_occurrence_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_source_occurrence_path_check" CHECK ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 4096))
);
-- Create index "program_name_source_occurrence_name_idx" to table: "program_name_source_occurrence"
CREATE INDEX "program_name_source_occurrence_name_idx" ON "program_name_source_occurrence" ("owner_id", "name_id", "name_revision");
-- Create index "program_name_source_occurrence_snapshot_idx" to table: "program_name_source_occurrence"
CREATE INDEX "program_name_source_occurrence_snapshot_idx" ON "program_name_source_occurrence" ("source_record_id", "snapshot_id");
-- Modify "program_relation_participant" table
ALTER TABLE "program_relation_participant" DROP CONSTRAINT "program_participant_target_check", ADD CONSTRAINT "program_participant_target_check" CHECK (num_nonnulls(publishing_id, music_id, program_id, software_id, entity_id, grouping_id, reference_id, distribution_id) = 1), ADD COLUMN "distribution_id" uuid NULL, ADD CONSTRAINT "program_relation_participant_deXrDaupv8FC_fkey" FOREIGN KEY ("distribution_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "program_participant_distribution_idx" to table: "program_relation_participant"
CREATE INDEX "program_participant_distribution_idx" ON "program_relation_participant" ("distribution_id", "role_revision_id", "relation_id") WHERE (distribution_id IS NOT NULL);
-- Modify "program_fact" table
ALTER TABLE "program_fact" ADD CONSTRAINT "program_fact_head_version_check" CHECK ((expected_head_version >= 0) AND (expected_head_version <= '9007199254740990'::bigint)), ADD CONSTRAINT "program_fact_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "semantic_id" uuid NOT NULL DEFAULT uuidv7(), ADD COLUMN "expected_head_version" bigint NOT NULL DEFAULT 0, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0;
-- Modify "program_catalog_relation" table
ALTER TABLE "program_catalog_relation" ADD CONSTRAINT "program_relation_head_version_check" CHECK ((expected_head_version >= 0) AND (expected_head_version <= '9007199254740990'::bigint)), ADD CONSTRAINT "program_relation_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "semantic_id" uuid NOT NULL DEFAULT uuidv7(), ADD COLUMN "expected_head_version" bigint NOT NULL DEFAULT 0, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0;
-- Create "program_semantic_revision" table
CREATE TABLE "program_semantic_revision" (
  "owner_id" uuid NOT NULL,
  "semantic_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "fact_id" uuid NULL,
  "relation_id" uuid NULL,
  "state" text NOT NULL DEFAULT 'active',
  "actor_auth_user_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "program_semantic_revision_key" PRIMARY KEY ("owner_id", "semantic_id", "version"),
  CONSTRAINT "program_semantic_revision_actor_auth_user_id_users_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "program_semantic_revision_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "program_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_semantic_revision_owner_id_program_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_semantic_revision_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "program_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_semantic_revision_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "program_semantic_revision_target_check" CHECK (num_nonnulls(fact_id, relation_id) = 1),
  CONSTRAINT "program_semantic_revision_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create index "program_semantic_revision_fact_idx" to table: "program_semantic_revision"
CREATE INDEX "program_semantic_revision_fact_idx" ON "program_semantic_revision" ("owner_id", "fact_id");
-- Create index "program_semantic_revision_relation_idx" to table: "program_semantic_revision"
CREATE INDEX "program_semantic_revision_relation_idx" ON "program_semantic_revision" ("owner_id", "relation_id");
-- Create "program_semantic_head" table
CREATE TABLE "program_semantic_head" (
  "owner_id" uuid NOT NULL,
  "semantic_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  CONSTRAINT "program_semantic_head_key" PRIMARY KEY ("owner_id", "semantic_id"),
  CONSTRAINT "program_semantic_head_revision_fk" FOREIGN KEY ("owner_id", "semantic_id", "version") REFERENCES "program_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create "program_source_binding" table
CREATE TABLE "program_source_binding" (
  "source_record_id" uuid NOT NULL,
  "mapping_key" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'program',
  "owner_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("source_record_id", "mapping_key"),
  CONSTRAINT "program_source_binding_claim_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_source_binding_owner_id_program_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_source_binding_owner_check" CHECK (mapping_owner = 'program'::text)
) PARTITION BY HASH ("source_record_id");
-- Create index "program_source_binding_owner_idx" to table: "program_source_binding"
CREATE INDEX "program_source_binding_owner_idx" ON "program_source_binding" ("owner_id", "mapping_key");
-- Modify "publishing_fact_support" table
ALTER TABLE "publishing_fact_support" ADD CONSTRAINT "publishing_fact_support_n0swMpSicz3c_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "publishing_support_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop index "publishing_identifier_owner_idx" from table: "publishing_identifier_claim"
DROP INDEX "publishing_identifier_owner_idx";
-- Modify "publishing_identifier_claim" table
ALTER TABLE "publishing_identifier_claim" DROP CONSTRAINT "publishing_identifier_namespace_check", ADD CONSTRAINT "publishing_identifier_namespace_check" CHECK (namespace ~ '^[a-z][a-z0-9_.:-]{0,127}$'::text), DROP CONSTRAINT "publishing_identifier_value_check", ADD CONSTRAINT "publishing_identifier_value_check" CHECK (((octet_length(value) >= 1) AND (octet_length(value) <= 512)) AND ((octet_length(normalized_value) >= 1) AND (octet_length(normalized_value) <= 512)) AND ((octet_length(normalization_policy) >= 1) AND (octet_length(normalization_policy) <= 96))), ADD CONSTRAINT "publishing_identifier_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)), ADD CONSTRAINT "publishing_identifier_validation_check" CHECK (validation_status = ANY (ARRAY['unvalidated'::text, 'valid'::text])), ADD COLUMN "revision" bigint NOT NULL DEFAULT 1, ADD COLUMN "recorded_at" timestamptz(3) NOT NULL DEFAULT now(), ADD COLUMN "recorded_by_auth_user_id" uuid NULL, ADD COLUMN "normalization_policy" text NOT NULL DEFAULT 'exact.1', ADD COLUMN "validation_status" text NOT NULL DEFAULT 'unvalidated', ADD COLUMN "issuer_entity_id" uuid NULL, ADD CONSTRAINT "publishing_identifier_claim_1TuBFze2CHmH_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "publishing_identifier_claim_mXmw2txU5igd_fkey" FOREIGN KEY ("issuer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "publishing_identifier_issuer_idx" to table: "publishing_identifier_claim"
CREATE INDEX "publishing_identifier_issuer_idx" ON "publishing_identifier_claim" ("issuer_entity_id", "id") WHERE (issuer_entity_id IS NOT NULL);
-- Create "publishing_identifier_claim_revision" table
CREATE TABLE "publishing_identifier_claim_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "namespace" text NOT NULL,
  "value" text NOT NULL,
  "normalized_value" text NOT NULL,
  "normalization_policy" text NOT NULL DEFAULT 'exact.1',
  "validation_status" text NOT NULL DEFAULT 'unvalidated',
  "issuer_entity_id" uuid NULL,
  "state" text NOT NULL DEFAULT 'active',
  CONSTRAINT "publishing_identifier_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "publishing_identifier_claim_revision_DoJe5FcmPH0F_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_identifier_claim_revision_E2Ox2qDGycFp_fkey" FOREIGN KEY ("owner_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_identifier_claim_revision_qfRk4k2gyvtB_fkey" FOREIGN KEY ("issuer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_identifier_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "publishing_identifier_claim" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Drop index "publishing_named_form_owner_idx" from table: "publishing_named_form"
DROP INDEX "publishing_named_form_owner_idx";
-- Modify "publishing_named_form" table
ALTER TABLE "publishing_named_form" DROP CONSTRAINT "publishing_named_form_kind_check", ADD CONSTRAINT "publishing_named_form_kind_check" CHECK ((octet_length(kind) >= 1) AND (octet_length(kind) <= 96)), DROP CONSTRAINT "publishing_named_form_language_check", ADD CONSTRAINT "publishing_named_form_language_check" CHECK (((language_tag IS NULL) AND (language_policy IS NULL) AND (private_use_namespace IS NULL)) OR ((language_tag IS NOT NULL) AND ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255)) AND (language_policy IS NOT NULL) AND ((private_use_namespace IS NULL) OR ((octet_length(private_use_namespace) >= 1) AND (octet_length(private_use_namespace) <= 512))))), DROP CONSTRAINT "publishing_named_form_value_check", ADD CONSTRAINT "publishing_named_form_value_check" CHECK (((octet_length(value) >= 1) AND (octet_length(value) <= 131072)) AND ((sort_name IS NULL) OR ((octet_length(sort_name) >= 1) AND (octet_length(sort_name) <= 131072)))), ADD CONSTRAINT "publishing_named_form_derivation_check" CHECK (num_nonnulls(derivation_name_id, derivation_revision) = ANY (ARRAY[0, 2])), ADD CONSTRAINT "publishing_named_form_method_check" CHECK (translation_method = ANY (ARRAY['human'::text, 'machine'::text, 'mixed'::text, 'unknown'::text, 'not_applicable'::text])), ADD CONSTRAINT "publishing_named_form_origin_check" CHECK (origin = ANY (ARRAY['original'::text, 'translation'::text, 'transliteration'::text, 'abbreviation'::text, 'variant'::text, 'unknown'::text])), ADD CONSTRAINT "publishing_named_form_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)), ADD CONSTRAINT "publishing_named_form_scope_check" CHECK (((territory IS NULL) OR ((octet_length(territory) >= 1) AND (octet_length(territory) <= 96))) AND ((context IS NULL) OR ((octet_length(context) >= 1) AND (octet_length(context) <= 512)))), ADD CONSTRAINT "publishing_named_form_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "revision" bigint NOT NULL DEFAULT 1, ADD COLUMN "recorded_at" timestamptz(3) NOT NULL DEFAULT now(), ADD COLUMN "recorded_by_auth_user_id" uuid NULL, ADD COLUMN "private_use_namespace" text NULL, ADD COLUMN "language_policy" text NULL, ADD COLUMN "sort_name" text NULL, ADD COLUMN "origin" text NOT NULL DEFAULT 'unknown', ADD COLUMN "translation_method" text NOT NULL DEFAULT 'unknown', ADD COLUMN "primary_for_language" boolean NULL, ADD COLUMN "scope_owner_id" uuid NULL, ADD COLUMN "territory" text NULL, ADD COLUMN "context" text NULL, ADD COLUMN "derivation_name_id" uuid NULL, ADD COLUMN "derivation_revision" bigint NULL, ADD COLUMN "begin" jsonb NULL, ADD COLUMN "end" jsonb NULL, ADD COLUMN "ended" boolean NULL, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0, ADD CONSTRAINT "publishing_named_form_recorded_by_auth_user_id_users_id_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "publishing_named_form_zVLnoqJA3o9w_fkey" FOREIGN KEY ("scope_owner_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "publishing_named_form_scope_idx" to table: "publishing_named_form"
CREATE INDEX "publishing_named_form_scope_idx" ON "publishing_named_form" ("scope_owner_id", "id") WHERE (scope_owner_id IS NOT NULL);
-- Create "publishing_named_form_revision" table
CREATE TABLE "publishing_named_form_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "language_tag" text NULL,
  "private_use_namespace" text NULL,
  "language_policy" text NULL,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "sort_name" text NULL,
  "origin" text NOT NULL DEFAULT 'unknown',
  "translation_method" text NOT NULL DEFAULT 'unknown',
  "primary_for_language" boolean NULL,
  "scope_owner_id" uuid NULL,
  "territory" text NULL,
  "context" text NULL,
  "derivation_name_id" uuid NULL,
  "derivation_revision" bigint NULL,
  "begin" jsonb NULL,
  "end" jsonb NULL,
  "ended" boolean NULL,
  "spoiler" integer NOT NULL DEFAULT 0,
  "state" text NOT NULL DEFAULT 'active',
  CONSTRAINT "publishing_named_form_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "publishing_named_form_derivation_fk" FOREIGN KEY ("owner_id", "derivation_name_id", "derivation_revision") REFERENCES "publishing_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_named_form_revision_ApPI0c72kLJJ_fkey" FOREIGN KEY ("owner_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_named_form_revision_RgeWImY6PtrL_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_named_form_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "publishing_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_named_form_revision_syKb7lnozSRK_fkey" FOREIGN KEY ("scope_owner_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "publishing_named_form_derivation_idx" to table: "publishing_named_form_revision"
CREATE INDEX "publishing_named_form_derivation_idx" ON "publishing_named_form_revision" ("owner_id", "derivation_name_id", "derivation_revision") WHERE (derivation_name_id IS NOT NULL);
-- Create "publishing_name_authority" table
CREATE TABLE "publishing_name_authority" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "claim" text NOT NULL,
  "review_state" text NOT NULL,
  "authorizer_entity_id" uuid NULL,
  "role" text NOT NULL,
  "territory" text NULL,
  "channel" text NULL,
  "context" text NULL,
  "valid_from" timestamptz(3) NULL,
  "valid_until" timestamptz(3) NULL,
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "review_source_record_id" uuid NULL,
  "review_snapshot_id" uuid NULL,
  "review_source_path" text NULL,
  "state" text NOT NULL,
  CONSTRAINT "publishing_name_authority_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "publishing_name_authority_eNPs7YbZpsSU_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_authority_evidence_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_authority_owner_id_publishing_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_authority_rRPoMbscDvmI_fkey" FOREIGN KEY ("authorizer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_authority_review_fk" FOREIGN KEY ("review_source_record_id", "review_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_authority_target_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "publishing_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_authority_claim_check" CHECK (claim = ANY (ARRAY['official'::text, 'unofficial'::text, 'unknown'::text])),
  CONSTRAINT "publishing_name_authority_proof_check" CHECK (((review_state <> 'verified'::text) OR ((authorizer_entity_id IS NOT NULL) AND (review_snapshot_id IS NOT NULL))) AND (num_nonnulls(review_source_record_id, review_snapshot_id, review_source_path) = ANY (ARRAY[0, 3]))),
  CONSTRAINT "publishing_name_authority_review_check" CHECK (review_state = ANY (ARRAY['source_claim'::text, 'pending'::text, 'verified'::text, 'rejected'::text])),
  CONSTRAINT "publishing_name_authority_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "publishing_name_authority_scope_check" CHECK (((octet_length(role) >= 1) AND (octet_length(role) <= 96)) AND ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 4096)) AND ((review_source_path IS NULL) OR ((octet_length(review_source_path) >= 1) AND (octet_length(review_source_path) <= 4096))) AND ((territory IS NULL) OR ((octet_length(territory) >= 1) AND (octet_length(territory) <= 96))) AND ((channel IS NULL) OR ((octet_length(channel) >= 1) AND (octet_length(channel) <= 96))) AND ((context IS NULL) OR ((octet_length(context) >= 1) AND (octet_length(context) <= 512)))),
  CONSTRAINT "publishing_name_authority_state_check" CHECK (state = ANY (ARRAY['active'::text, 'withdrawn'::text])),
  CONSTRAINT "publishing_name_authority_time_check" CHECK ((valid_from IS NULL) OR (valid_until IS NULL) OR (valid_until > valid_from))
);
-- Create index "publishing_name_authority_authorizer_idx" to table: "publishing_name_authority"
CREATE INDEX "publishing_name_authority_authorizer_idx" ON "publishing_name_authority" ("authorizer_entity_id", "owner_id", "id") WHERE (authorizer_entity_id IS NOT NULL);
-- Create index "publishing_name_authority_evidence_idx" to table: "publishing_name_authority"
CREATE INDEX "publishing_name_authority_evidence_idx" ON "publishing_name_authority" ("source_record_id", "snapshot_id", "id");
-- Create index "publishing_name_authority_review_idx" to table: "publishing_name_authority"
CREATE INDEX "publishing_name_authority_review_idx" ON "publishing_name_authority" ("review_source_record_id", "review_snapshot_id", "id") WHERE (review_source_record_id IS NOT NULL);
-- Create index "publishing_name_authority_target_idx" to table: "publishing_name_authority"
CREATE INDEX "publishing_name_authority_target_idx" ON "publishing_name_authority" ("owner_id", "name_id", "name_revision", "id");
-- Create "publishing_name_authority_revision" table
CREATE TABLE "publishing_name_authority_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "claim" text NOT NULL,
  "review_state" text NOT NULL,
  "authorizer_entity_id" uuid NULL,
  "role" text NOT NULL,
  "territory" text NULL,
  "channel" text NULL,
  "context" text NULL,
  "valid_from" timestamptz(3) NULL,
  "valid_until" timestamptz(3) NULL,
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "review_source_record_id" uuid NULL,
  "review_snapshot_id" uuid NULL,
  "review_source_path" text NULL,
  "state" text NOT NULL,
  CONSTRAINT "publishing_name_authority_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "publishing_name_authority_history_evidence_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_authority_history_review_fk" FOREIGN KEY ("review_source_record_id", "review_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_authority_history_target_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "publishing_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_authority_revision_Sa9wbGTQ0I06_fkey" FOREIGN KEY ("authorizer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_authority_revision_hUeZKYPO4wvk_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_authority_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "publishing_name_authority" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_authority_revision_vaHnIaY8AfXG_fkey" FOREIGN KEY ("owner_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create "publishing_name_source_binding" table
CREATE TABLE "publishing_name_source_binding" (
  "owner_id" uuid NOT NULL,
  "source_record_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "local_key" text NOT NULL,
  "name_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "publishing_name_source_binding_key" PRIMARY KEY ("source_record_id", "namespace", "local_key"),
  CONSTRAINT "publishing_name_source_binding_owner_key" UNIQUE ("owner_id", "source_record_id", "namespace", "local_key", "name_id"),
  CONSTRAINT "publishing_name_source_binding_PHtmJ2hwRJpd_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_source_binding_name_fk" FOREIGN KEY ("owner_id", "name_id") REFERENCES "publishing_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_source_binding_value_check" CHECK (((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 96)) AND ((octet_length(local_key) >= 1) AND (octet_length(local_key) <= 512)))
);
-- Create index "publishing_name_source_binding_owner_idx" to table: "publishing_name_source_binding"
CREATE INDEX "publishing_name_source_binding_owner_idx" ON "publishing_name_source_binding" ("owner_id", "name_id");
-- Create "publishing_name_source_occurrence" table
CREATE TABLE "publishing_name_source_occurrence" (
  "owner_id" uuid NOT NULL,
  "source_record_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "local_key" text NOT NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "publishing_name_source_occurrence_key" PRIMARY KEY ("source_record_id", "namespace", "local_key", "snapshot_id"),
  CONSTRAINT "publishing_name_source_occurrence_binding_fk" FOREIGN KEY ("owner_id", "source_record_id", "namespace", "local_key", "name_id") REFERENCES "publishing_name_source_binding" ("owner_id", "source_record_id", "namespace", "local_key", "name_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_source_occurrence_name_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "publishing_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_source_occurrence_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_source_occurrence_path_check" CHECK ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 4096))
);
-- Create index "publishing_name_source_occurrence_name_idx" to table: "publishing_name_source_occurrence"
CREATE INDEX "publishing_name_source_occurrence_name_idx" ON "publishing_name_source_occurrence" ("owner_id", "name_id", "name_revision");
-- Create index "publishing_name_source_occurrence_snapshot_idx" to table: "publishing_name_source_occurrence"
CREATE INDEX "publishing_name_source_occurrence_snapshot_idx" ON "publishing_name_source_occurrence" ("source_record_id", "snapshot_id");
-- Modify "publishing_relation_participant" table
ALTER TABLE "publishing_relation_participant" DROP CONSTRAINT "publishing_participant_target_check", ADD CONSTRAINT "publishing_participant_target_check" CHECK (num_nonnulls(publishing_id, music_id, program_id, software_id, entity_id, grouping_id, reference_id, distribution_id) = 1), ADD COLUMN "distribution_id" uuid NULL, ADD CONSTRAINT "publishing_relation_participant_uHq8I3CM6fqp_fkey" FOREIGN KEY ("distribution_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "publishing_participant_distribution_idx" to table: "publishing_relation_participant"
CREATE INDEX "publishing_participant_distribution_idx" ON "publishing_relation_participant" ("distribution_id", "role_revision_id", "relation_id") WHERE (distribution_id IS NOT NULL);
-- Modify "publishing_fact" table
ALTER TABLE "publishing_fact" ADD CONSTRAINT "publishing_fact_head_version_check" CHECK ((expected_head_version >= 0) AND (expected_head_version <= '9007199254740990'::bigint)), ADD CONSTRAINT "publishing_fact_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "semantic_id" uuid NOT NULL DEFAULT uuidv7(), ADD COLUMN "expected_head_version" bigint NOT NULL DEFAULT 0, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0;
-- Modify "publishing_catalog_relation" table
ALTER TABLE "publishing_catalog_relation" ADD CONSTRAINT "publishing_relation_head_version_check" CHECK ((expected_head_version >= 0) AND (expected_head_version <= '9007199254740990'::bigint)), ADD CONSTRAINT "publishing_relation_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "semantic_id" uuid NOT NULL DEFAULT uuidv7(), ADD COLUMN "expected_head_version" bigint NOT NULL DEFAULT 0, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0;
-- Create "publishing_semantic_revision" table
CREATE TABLE "publishing_semantic_revision" (
  "owner_id" uuid NOT NULL,
  "semantic_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "fact_id" uuid NULL,
  "relation_id" uuid NULL,
  "state" text NOT NULL DEFAULT 'active',
  "actor_auth_user_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "publishing_semantic_revision_key" PRIMARY KEY ("owner_id", "semantic_id", "version"),
  CONSTRAINT "publishing_semantic_revision_actor_auth_user_id_users_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "publishing_semantic_revision_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "publishing_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_semantic_revision_gTy4c8gQ5jgD_fkey" FOREIGN KEY ("owner_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_semantic_revision_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "publishing_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_semantic_revision_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "publishing_semantic_revision_target_check" CHECK (num_nonnulls(fact_id, relation_id) = 1),
  CONSTRAINT "publishing_semantic_revision_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create index "publishing_semantic_revision_fact_idx" to table: "publishing_semantic_revision"
CREATE INDEX "publishing_semantic_revision_fact_idx" ON "publishing_semantic_revision" ("owner_id", "fact_id");
-- Create index "publishing_semantic_revision_relation_idx" to table: "publishing_semantic_revision"
CREATE INDEX "publishing_semantic_revision_relation_idx" ON "publishing_semantic_revision" ("owner_id", "relation_id");
-- Create "publishing_semantic_head" table
CREATE TABLE "publishing_semantic_head" (
  "owner_id" uuid NOT NULL,
  "semantic_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  CONSTRAINT "publishing_semantic_head_key" PRIMARY KEY ("owner_id", "semantic_id"),
  CONSTRAINT "publishing_semantic_head_revision_fk" FOREIGN KEY ("owner_id", "semantic_id", "version") REFERENCES "publishing_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create "publishing_source_binding" table
CREATE TABLE "publishing_source_binding" (
  "source_record_id" uuid NOT NULL,
  "mapping_key" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'publishing',
  "owner_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("source_record_id", "mapping_key"),
  CONSTRAINT "publishing_source_binding_claim_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_source_binding_owner_id_publishing_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_source_binding_owner_check" CHECK (mapping_owner = 'publishing'::text)
) PARTITION BY HASH ("source_record_id");
-- Create index "publishing_source_binding_owner_idx" to table: "publishing_source_binding"
CREATE INDEX "publishing_source_binding_owner_idx" ON "publishing_source_binding" ("owner_id", "mapping_key");
-- Create "reference_catalog_profile_revision" table
CREATE TABLE "reference_catalog_profile_revision" (
  "owner_id" uuid NOT NULL,
  "revision" bigint NOT NULL,
  "snapshot" jsonb NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("owner_id", "revision"),
  CONSTRAINT "reference_catalog_profile_revision_4jwqXvjeOtCW_fkey" FOREIGN KEY ("owner_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_catalog_profile_revision_number_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "reference_catalog_profile_revision_snapshot_check" CHECK ((jsonb_typeof(snapshot) = 'object'::text) AND (octet_length((snapshot)::text) <= 131072))
);
-- Create "reference_concept" table
CREATE TABLE "reference_concept" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'concept',
  "type_revision_id" uuid NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "reference_concept_Qsoxue4GnYZh_fkey" FOREIGN KEY ("type_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_concept_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "reference_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_concept_shape_check" CHECK (identity_shape = 'concept'::text)
);
-- Create index "reference_concept_type_idx" to table: "reference_concept"
CREATE INDEX "reference_concept_type_idx" ON "reference_concept" ("type_revision_id", "id");
-- Modify "reference_fact_support" table
ALTER TABLE "reference_fact_support" ADD CONSTRAINT "reference_fact_support_VKNEVQ9Sm5OU_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "reference_support_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop index "reference_identifier_owner_idx" from table: "reference_identifier_claim"
DROP INDEX "reference_identifier_owner_idx";
-- Modify "reference_identifier_claim" table
ALTER TABLE "reference_identifier_claim" DROP CONSTRAINT "reference_identifier_namespace_check", ADD CONSTRAINT "reference_identifier_namespace_check" CHECK (namespace ~ '^[a-z][a-z0-9_.:-]{0,127}$'::text), DROP CONSTRAINT "reference_identifier_value_check", ADD CONSTRAINT "reference_identifier_value_check" CHECK (((octet_length(value) >= 1) AND (octet_length(value) <= 512)) AND ((octet_length(normalized_value) >= 1) AND (octet_length(normalized_value) <= 512)) AND ((octet_length(normalization_policy) >= 1) AND (octet_length(normalization_policy) <= 96))), ADD CONSTRAINT "reference_identifier_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)), ADD CONSTRAINT "reference_identifier_validation_check" CHECK (validation_status = ANY (ARRAY['unvalidated'::text, 'valid'::text])), ADD COLUMN "revision" bigint NOT NULL DEFAULT 1, ADD COLUMN "recorded_at" timestamptz(3) NOT NULL DEFAULT now(), ADD COLUMN "recorded_by_auth_user_id" uuid NULL, ADD COLUMN "normalization_policy" text NOT NULL DEFAULT 'exact.1', ADD COLUMN "validation_status" text NOT NULL DEFAULT 'unvalidated', ADD COLUMN "issuer_entity_id" uuid NULL, ADD CONSTRAINT "reference_identifier_claim_UAdhwpk1g6FN_fkey" FOREIGN KEY ("issuer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "reference_identifier_claim_Vm6pOGYAvWCp_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "reference_identifier_issuer_idx" to table: "reference_identifier_claim"
CREATE INDEX "reference_identifier_issuer_idx" ON "reference_identifier_claim" ("issuer_entity_id", "id") WHERE (issuer_entity_id IS NOT NULL);
-- Create "reference_identifier_claim_revision" table
CREATE TABLE "reference_identifier_claim_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "namespace" text NOT NULL,
  "value" text NOT NULL,
  "normalized_value" text NOT NULL,
  "normalization_policy" text NOT NULL DEFAULT 'exact.1',
  "validation_status" text NOT NULL DEFAULT 'unvalidated',
  "issuer_entity_id" uuid NULL,
  "state" text NOT NULL DEFAULT 'active',
  CONSTRAINT "reference_identifier_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "reference_identifier_claim_revision_knH6LElLiZU5_fkey" FOREIGN KEY ("issuer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_identifier_claim_revision_pwhcv5U1grTN_fkey" FOREIGN KEY ("owner_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_identifier_claim_revision_zPWaaf0TC2sD_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_identifier_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "reference_identifier_claim" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Drop index "reference_named_form_owner_idx" from table: "reference_named_form"
DROP INDEX "reference_named_form_owner_idx";
-- Modify "reference_named_form" table
ALTER TABLE "reference_named_form" DROP CONSTRAINT "reference_named_form_kind_check", ADD CONSTRAINT "reference_named_form_kind_check" CHECK ((octet_length(kind) >= 1) AND (octet_length(kind) <= 96)), DROP CONSTRAINT "reference_named_form_language_check", ADD CONSTRAINT "reference_named_form_language_check" CHECK (((language_tag IS NULL) AND (language_policy IS NULL) AND (private_use_namespace IS NULL)) OR ((language_tag IS NOT NULL) AND ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255)) AND (language_policy IS NOT NULL) AND ((private_use_namespace IS NULL) OR ((octet_length(private_use_namespace) >= 1) AND (octet_length(private_use_namespace) <= 512))))), DROP CONSTRAINT "reference_named_form_value_check", ADD CONSTRAINT "reference_named_form_value_check" CHECK (((octet_length(value) >= 1) AND (octet_length(value) <= 131072)) AND ((sort_name IS NULL) OR ((octet_length(sort_name) >= 1) AND (octet_length(sort_name) <= 131072)))), ADD CONSTRAINT "reference_named_form_derivation_check" CHECK (num_nonnulls(derivation_name_id, derivation_revision) = ANY (ARRAY[0, 2])), ADD CONSTRAINT "reference_named_form_method_check" CHECK (translation_method = ANY (ARRAY['human'::text, 'machine'::text, 'mixed'::text, 'unknown'::text, 'not_applicable'::text])), ADD CONSTRAINT "reference_named_form_origin_check" CHECK (origin = ANY (ARRAY['original'::text, 'translation'::text, 'transliteration'::text, 'abbreviation'::text, 'variant'::text, 'unknown'::text])), ADD CONSTRAINT "reference_named_form_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)), ADD CONSTRAINT "reference_named_form_scope_check" CHECK (((territory IS NULL) OR ((octet_length(territory) >= 1) AND (octet_length(territory) <= 96))) AND ((context IS NULL) OR ((octet_length(context) >= 1) AND (octet_length(context) <= 512)))), ADD CONSTRAINT "reference_named_form_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "revision" bigint NOT NULL DEFAULT 1, ADD COLUMN "recorded_at" timestamptz(3) NOT NULL DEFAULT now(), ADD COLUMN "recorded_by_auth_user_id" uuid NULL, ADD COLUMN "private_use_namespace" text NULL, ADD COLUMN "language_policy" text NULL, ADD COLUMN "sort_name" text NULL, ADD COLUMN "origin" text NOT NULL DEFAULT 'unknown', ADD COLUMN "translation_method" text NOT NULL DEFAULT 'unknown', ADD COLUMN "primary_for_language" boolean NULL, ADD COLUMN "scope_owner_id" uuid NULL, ADD COLUMN "territory" text NULL, ADD COLUMN "context" text NULL, ADD COLUMN "derivation_name_id" uuid NULL, ADD COLUMN "derivation_revision" bigint NULL, ADD COLUMN "begin" jsonb NULL, ADD COLUMN "end" jsonb NULL, ADD COLUMN "ended" boolean NULL, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0, ADD CONSTRAINT "reference_named_form_recorded_by_auth_user_id_users_id_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "reference_named_form_scope_owner_id_reference_identity_id_fkey" FOREIGN KEY ("scope_owner_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "reference_named_form_scope_idx" to table: "reference_named_form"
CREATE INDEX "reference_named_form_scope_idx" ON "reference_named_form" ("scope_owner_id", "id") WHERE (scope_owner_id IS NOT NULL);
-- Create "reference_named_form_revision" table
CREATE TABLE "reference_named_form_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "language_tag" text NULL,
  "private_use_namespace" text NULL,
  "language_policy" text NULL,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "sort_name" text NULL,
  "origin" text NOT NULL DEFAULT 'unknown',
  "translation_method" text NOT NULL DEFAULT 'unknown',
  "primary_for_language" boolean NULL,
  "scope_owner_id" uuid NULL,
  "territory" text NULL,
  "context" text NULL,
  "derivation_name_id" uuid NULL,
  "derivation_revision" bigint NULL,
  "begin" jsonb NULL,
  "end" jsonb NULL,
  "ended" boolean NULL,
  "spoiler" integer NOT NULL DEFAULT 0,
  "state" text NOT NULL DEFAULT 'active',
  CONSTRAINT "reference_named_form_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "reference_named_form_derivation_fk" FOREIGN KEY ("owner_id", "derivation_name_id", "derivation_revision") REFERENCES "reference_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_named_form_revision_V8JxHd7epNRB_fkey" FOREIGN KEY ("owner_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_named_form_revision_dByFkETIcYhq_fkey" FOREIGN KEY ("scope_owner_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_named_form_revision_hnHyp0DemPkX_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_named_form_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "reference_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "reference_named_form_derivation_idx" to table: "reference_named_form_revision"
CREATE INDEX "reference_named_form_derivation_idx" ON "reference_named_form_revision" ("owner_id", "derivation_name_id", "derivation_revision") WHERE (derivation_name_id IS NOT NULL);
-- Create "reference_name_authority" table
CREATE TABLE "reference_name_authority" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "claim" text NOT NULL,
  "review_state" text NOT NULL,
  "authorizer_entity_id" uuid NULL,
  "role" text NOT NULL,
  "territory" text NULL,
  "channel" text NULL,
  "context" text NULL,
  "valid_from" timestamptz(3) NULL,
  "valid_until" timestamptz(3) NULL,
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "review_source_record_id" uuid NULL,
  "review_snapshot_id" uuid NULL,
  "review_source_path" text NULL,
  "state" text NOT NULL,
  CONSTRAINT "reference_name_authority_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "reference_name_authority_K9cEMtEY6dWi_fkey" FOREIGN KEY ("authorizer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_authority_evidence_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_authority_owner_id_reference_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_authority_recorded_by_auth_user_id_users_id_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_authority_review_fk" FOREIGN KEY ("review_source_record_id", "review_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_authority_target_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "reference_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_authority_claim_check" CHECK (claim = ANY (ARRAY['official'::text, 'unofficial'::text, 'unknown'::text])),
  CONSTRAINT "reference_name_authority_proof_check" CHECK (((review_state <> 'verified'::text) OR ((authorizer_entity_id IS NOT NULL) AND (review_snapshot_id IS NOT NULL))) AND (num_nonnulls(review_source_record_id, review_snapshot_id, review_source_path) = ANY (ARRAY[0, 3]))),
  CONSTRAINT "reference_name_authority_review_check" CHECK (review_state = ANY (ARRAY['source_claim'::text, 'pending'::text, 'verified'::text, 'rejected'::text])),
  CONSTRAINT "reference_name_authority_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "reference_name_authority_scope_check" CHECK (((octet_length(role) >= 1) AND (octet_length(role) <= 96)) AND ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 4096)) AND ((review_source_path IS NULL) OR ((octet_length(review_source_path) >= 1) AND (octet_length(review_source_path) <= 4096))) AND ((territory IS NULL) OR ((octet_length(territory) >= 1) AND (octet_length(territory) <= 96))) AND ((channel IS NULL) OR ((octet_length(channel) >= 1) AND (octet_length(channel) <= 96))) AND ((context IS NULL) OR ((octet_length(context) >= 1) AND (octet_length(context) <= 512)))),
  CONSTRAINT "reference_name_authority_state_check" CHECK (state = ANY (ARRAY['active'::text, 'withdrawn'::text])),
  CONSTRAINT "reference_name_authority_time_check" CHECK ((valid_from IS NULL) OR (valid_until IS NULL) OR (valid_until > valid_from))
);
-- Create index "reference_name_authority_authorizer_idx" to table: "reference_name_authority"
CREATE INDEX "reference_name_authority_authorizer_idx" ON "reference_name_authority" ("authorizer_entity_id", "owner_id", "id") WHERE (authorizer_entity_id IS NOT NULL);
-- Create index "reference_name_authority_evidence_idx" to table: "reference_name_authority"
CREATE INDEX "reference_name_authority_evidence_idx" ON "reference_name_authority" ("source_record_id", "snapshot_id", "id");
-- Create index "reference_name_authority_review_idx" to table: "reference_name_authority"
CREATE INDEX "reference_name_authority_review_idx" ON "reference_name_authority" ("review_source_record_id", "review_snapshot_id", "id") WHERE (review_source_record_id IS NOT NULL);
-- Create index "reference_name_authority_target_idx" to table: "reference_name_authority"
CREATE INDEX "reference_name_authority_target_idx" ON "reference_name_authority" ("owner_id", "name_id", "name_revision", "id");
-- Create "reference_name_authority_revision" table
CREATE TABLE "reference_name_authority_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "claim" text NOT NULL,
  "review_state" text NOT NULL,
  "authorizer_entity_id" uuid NULL,
  "role" text NOT NULL,
  "territory" text NULL,
  "channel" text NULL,
  "context" text NULL,
  "valid_from" timestamptz(3) NULL,
  "valid_until" timestamptz(3) NULL,
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "review_source_record_id" uuid NULL,
  "review_snapshot_id" uuid NULL,
  "review_source_path" text NULL,
  "state" text NOT NULL,
  CONSTRAINT "reference_name_authority_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "reference_name_authority_history_evidence_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_authority_history_review_fk" FOREIGN KEY ("review_source_record_id", "review_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_authority_history_target_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "reference_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_authority_revision_Pk4QCqKaxzeA_fkey" FOREIGN KEY ("authorizer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_authority_revision_c3n2g2rKu3wU_fkey" FOREIGN KEY ("owner_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_authority_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "reference_name_authority" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_authority_revision_zqNp6levyOe0_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create "reference_name_source_binding" table
CREATE TABLE "reference_name_source_binding" (
  "owner_id" uuid NOT NULL,
  "source_record_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "local_key" text NOT NULL,
  "name_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "reference_name_source_binding_key" PRIMARY KEY ("source_record_id", "namespace", "local_key"),
  CONSTRAINT "reference_name_source_binding_owner_key" UNIQUE ("owner_id", "source_record_id", "namespace", "local_key", "name_id"),
  CONSTRAINT "reference_name_source_binding_O6Fudk80OWEN_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_source_binding_name_fk" FOREIGN KEY ("owner_id", "name_id") REFERENCES "reference_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_source_binding_value_check" CHECK (((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 96)) AND ((octet_length(local_key) >= 1) AND (octet_length(local_key) <= 512)))
);
-- Create index "reference_name_source_binding_owner_idx" to table: "reference_name_source_binding"
CREATE INDEX "reference_name_source_binding_owner_idx" ON "reference_name_source_binding" ("owner_id", "name_id");
-- Create "reference_name_source_occurrence" table
CREATE TABLE "reference_name_source_occurrence" (
  "owner_id" uuid NOT NULL,
  "source_record_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "local_key" text NOT NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "reference_name_source_occurrence_key" PRIMARY KEY ("source_record_id", "namespace", "local_key", "snapshot_id"),
  CONSTRAINT "reference_name_source_occurrence_binding_fk" FOREIGN KEY ("owner_id", "source_record_id", "namespace", "local_key", "name_id") REFERENCES "reference_name_source_binding" ("owner_id", "source_record_id", "namespace", "local_key", "name_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_source_occurrence_name_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "reference_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_source_occurrence_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_source_occurrence_path_check" CHECK ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 4096))
);
-- Create index "reference_name_source_occurrence_name_idx" to table: "reference_name_source_occurrence"
CREATE INDEX "reference_name_source_occurrence_name_idx" ON "reference_name_source_occurrence" ("owner_id", "name_id", "name_revision");
-- Create index "reference_name_source_occurrence_snapshot_idx" to table: "reference_name_source_occurrence"
CREATE INDEX "reference_name_source_occurrence_snapshot_idx" ON "reference_name_source_occurrence" ("source_record_id", "snapshot_id");
-- Modify "reference_relation_participant" table
ALTER TABLE "reference_relation_participant" DROP CONSTRAINT "reference_participant_target_check", ADD CONSTRAINT "reference_participant_target_check" CHECK (num_nonnulls(publishing_id, music_id, program_id, software_id, entity_id, grouping_id, reference_id, distribution_id) = 1), ADD COLUMN "distribution_id" uuid NULL, ADD CONSTRAINT "reference_relation_participant_UJgRluGkZKor_fkey" FOREIGN KEY ("distribution_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "reference_participant_distribution_idx" to table: "reference_relation_participant"
CREATE INDEX "reference_participant_distribution_idx" ON "reference_relation_participant" ("distribution_id", "role_revision_id", "relation_id") WHERE (distribution_id IS NOT NULL);
-- Modify "reference_fact" table
ALTER TABLE "reference_fact" ADD CONSTRAINT "reference_fact_head_version_check" CHECK ((expected_head_version >= 0) AND (expected_head_version <= '9007199254740990'::bigint)), ADD CONSTRAINT "reference_fact_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "semantic_id" uuid NOT NULL DEFAULT uuidv7(), ADD COLUMN "expected_head_version" bigint NOT NULL DEFAULT 0, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0;
-- Modify "reference_catalog_relation" table
ALTER TABLE "reference_catalog_relation" ADD CONSTRAINT "reference_relation_head_version_check" CHECK ((expected_head_version >= 0) AND (expected_head_version <= '9007199254740990'::bigint)), ADD CONSTRAINT "reference_relation_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "semantic_id" uuid NOT NULL DEFAULT uuidv7(), ADD COLUMN "expected_head_version" bigint NOT NULL DEFAULT 0, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0;
-- Create "reference_semantic_revision" table
CREATE TABLE "reference_semantic_revision" (
  "owner_id" uuid NOT NULL,
  "semantic_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "fact_id" uuid NULL,
  "relation_id" uuid NULL,
  "state" text NOT NULL DEFAULT 'active',
  "actor_auth_user_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "reference_semantic_revision_key" PRIMARY KEY ("owner_id", "semantic_id", "version"),
  CONSTRAINT "reference_semantic_revision_actor_auth_user_id_users_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "reference_semantic_revision_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "reference_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_semantic_revision_owner_id_reference_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_semantic_revision_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "reference_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_semantic_revision_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "reference_semantic_revision_target_check" CHECK (num_nonnulls(fact_id, relation_id) = 1),
  CONSTRAINT "reference_semantic_revision_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create index "reference_semantic_revision_fact_idx" to table: "reference_semantic_revision"
CREATE INDEX "reference_semantic_revision_fact_idx" ON "reference_semantic_revision" ("owner_id", "fact_id");
-- Create index "reference_semantic_revision_relation_idx" to table: "reference_semantic_revision"
CREATE INDEX "reference_semantic_revision_relation_idx" ON "reference_semantic_revision" ("owner_id", "relation_id");
-- Create "reference_semantic_head" table
CREATE TABLE "reference_semantic_head" (
  "owner_id" uuid NOT NULL,
  "semantic_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  CONSTRAINT "reference_semantic_head_key" PRIMARY KEY ("owner_id", "semantic_id"),
  CONSTRAINT "reference_semantic_head_revision_fk" FOREIGN KEY ("owner_id", "semantic_id", "version") REFERENCES "reference_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create "reference_source_binding" table
CREATE TABLE "reference_source_binding" (
  "source_record_id" uuid NOT NULL,
  "mapping_key" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'reference',
  "owner_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("source_record_id", "mapping_key"),
  CONSTRAINT "reference_source_binding_claim_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_source_binding_owner_id_reference_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_source_binding_owner_check" CHECK (mapping_owner = 'reference'::text)
) PARTITION BY HASH ("source_record_id");
-- Create index "reference_source_binding_owner_idx" to table: "reference_source_binding"
CREATE INDEX "reference_source_binding_owner_idx" ON "reference_source_binding" ("owner_id", "mapping_key");
-- Create "reference_web_resource" table
CREATE TABLE "reference_web_resource" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'web_resource',
  "url" text NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "reference_web_resource_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "reference_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_web_resource_shape_check" CHECK (identity_shape = 'web_resource'::text),
  CONSTRAINT "reference_web_resource_url_check" CHECK (((octet_length(url) >= 1) AND (octet_length(url) <= 8192)) AND (url ~ '^[A-Za-z][A-Za-z0-9+.-]*:'::text))
);
-- Create "software_component_revision" table
CREATE TABLE "software_component_revision" (
  "release_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "component_id" text NOT NULL,
  "revision" bigint NOT NULL,
  "operation" text NOT NULL,
  "value" jsonb NOT NULL,
  PRIMARY KEY ("release_id", "kind", "component_id", "revision"),
  CONSTRAINT "software_component_revision_release_id_software_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "software_release" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_component_revision_check" CHECK (((revision >= 1) AND (revision <= '9007199254740991'::bigint)) AND (kind = ANY (ARRAY['content'::text, 'platform'::text, 'medium'::text, 'language'::text, 'event'::text, 'patch_target'::text, 'animation'::text])) AND ((octet_length(component_id) >= 1) AND (octet_length(component_id) <= 96)) AND (operation = ANY (ARRAY['put'::text, 'remove'::text])) AND (jsonb_typeof(value) = 'object'::text) AND (octet_length((value)::text) <= 524288))
);
-- Modify "software_fact_support" table
ALTER TABLE "software_fact_support" ADD CONSTRAINT "software_fact_support_xQlZBrNEaSVK_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "software_support_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop index "software_identifier_owner_idx" from table: "software_identifier_claim"
DROP INDEX "software_identifier_owner_idx";
-- Modify "software_identifier_claim" table
ALTER TABLE "software_identifier_claim" DROP CONSTRAINT "software_identifier_namespace_check", ADD CONSTRAINT "software_identifier_namespace_check" CHECK (namespace ~ '^[a-z][a-z0-9_.:-]{0,127}$'::text), DROP CONSTRAINT "software_identifier_value_check", ADD CONSTRAINT "software_identifier_value_check" CHECK (((octet_length(value) >= 1) AND (octet_length(value) <= 512)) AND ((octet_length(normalized_value) >= 1) AND (octet_length(normalized_value) <= 512)) AND ((octet_length(normalization_policy) >= 1) AND (octet_length(normalization_policy) <= 96))), ADD CONSTRAINT "software_identifier_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)), ADD CONSTRAINT "software_identifier_validation_check" CHECK (validation_status = ANY (ARRAY['unvalidated'::text, 'valid'::text])), ADD COLUMN "revision" bigint NOT NULL DEFAULT 1, ADD COLUMN "recorded_at" timestamptz(3) NOT NULL DEFAULT now(), ADD COLUMN "recorded_by_auth_user_id" uuid NULL, ADD COLUMN "normalization_policy" text NOT NULL DEFAULT 'exact.1', ADD COLUMN "validation_status" text NOT NULL DEFAULT 'unvalidated', ADD COLUMN "issuer_entity_id" uuid NULL, ADD CONSTRAINT "software_identifier_claim_Hc78FZye6olf_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "software_identifier_claim_N1QTjq7J1pHx_fkey" FOREIGN KEY ("issuer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "software_identifier_issuer_idx" to table: "software_identifier_claim"
CREATE INDEX "software_identifier_issuer_idx" ON "software_identifier_claim" ("issuer_entity_id", "id") WHERE (issuer_entity_id IS NOT NULL);
-- Create "software_identifier_claim_revision" table
CREATE TABLE "software_identifier_claim_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "namespace" text NOT NULL,
  "value" text NOT NULL,
  "normalized_value" text NOT NULL,
  "normalization_policy" text NOT NULL DEFAULT 'exact.1',
  "validation_status" text NOT NULL DEFAULT 'unvalidated',
  "issuer_entity_id" uuid NULL,
  "state" text NOT NULL DEFAULT 'active',
  CONSTRAINT "software_identifier_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "software_identifier_claim_revision_5ZVMAfY2NpKz_fkey" FOREIGN KEY ("owner_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_identifier_claim_revision_KiwGj0c2LrXF_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_identifier_claim_revision_VHJgvpeMekTv_fkey" FOREIGN KEY ("issuer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_identifier_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "software_identifier_claim" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Drop index "software_named_form_owner_idx" from table: "software_named_form"
DROP INDEX "software_named_form_owner_idx";
-- Modify "software_named_form" table
ALTER TABLE "software_named_form" DROP CONSTRAINT "software_named_form_kind_check", ADD CONSTRAINT "software_named_form_kind_check" CHECK ((octet_length(kind) >= 1) AND (octet_length(kind) <= 96)), DROP CONSTRAINT "software_named_form_language_check", ADD CONSTRAINT "software_named_form_language_check" CHECK (((language_tag IS NULL) AND (language_policy IS NULL) AND (private_use_namespace IS NULL)) OR ((language_tag IS NOT NULL) AND ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255)) AND (language_policy IS NOT NULL) AND ((private_use_namespace IS NULL) OR ((octet_length(private_use_namespace) >= 1) AND (octet_length(private_use_namespace) <= 512))))), DROP CONSTRAINT "software_named_form_value_check", ADD CONSTRAINT "software_named_form_value_check" CHECK (((octet_length(value) >= 1) AND (octet_length(value) <= 131072)) AND ((sort_name IS NULL) OR ((octet_length(sort_name) >= 1) AND (octet_length(sort_name) <= 131072)))), ADD CONSTRAINT "software_named_form_derivation_check" CHECK (num_nonnulls(derivation_name_id, derivation_revision) = ANY (ARRAY[0, 2])), ADD CONSTRAINT "software_named_form_method_check" CHECK (translation_method = ANY (ARRAY['human'::text, 'machine'::text, 'mixed'::text, 'unknown'::text, 'not_applicable'::text])), ADD CONSTRAINT "software_named_form_origin_check" CHECK (origin = ANY (ARRAY['original'::text, 'translation'::text, 'transliteration'::text, 'abbreviation'::text, 'variant'::text, 'unknown'::text])), ADD CONSTRAINT "software_named_form_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)), ADD CONSTRAINT "software_named_form_scope_check" CHECK (((territory IS NULL) OR ((octet_length(territory) >= 1) AND (octet_length(territory) <= 96))) AND ((context IS NULL) OR ((octet_length(context) >= 1) AND (octet_length(context) <= 512)))), ADD CONSTRAINT "software_named_form_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "revision" bigint NOT NULL DEFAULT 1, ADD COLUMN "recorded_at" timestamptz(3) NOT NULL DEFAULT now(), ADD COLUMN "recorded_by_auth_user_id" uuid NULL, ADD COLUMN "private_use_namespace" text NULL, ADD COLUMN "language_policy" text NULL, ADD COLUMN "sort_name" text NULL, ADD COLUMN "origin" text NOT NULL DEFAULT 'unknown', ADD COLUMN "translation_method" text NOT NULL DEFAULT 'unknown', ADD COLUMN "primary_for_language" boolean NULL, ADD COLUMN "scope_owner_id" uuid NULL, ADD COLUMN "territory" text NULL, ADD COLUMN "context" text NULL, ADD COLUMN "derivation_name_id" uuid NULL, ADD COLUMN "derivation_revision" bigint NULL, ADD COLUMN "begin" jsonb NULL, ADD COLUMN "end" jsonb NULL, ADD COLUMN "ended" boolean NULL, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0, ADD CONSTRAINT "software_named_form_recorded_by_auth_user_id_users_id_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "software_named_form_scope_owner_id_software_identity_id_fkey" FOREIGN KEY ("scope_owner_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "software_named_form_scope_idx" to table: "software_named_form"
CREATE INDEX "software_named_form_scope_idx" ON "software_named_form" ("scope_owner_id", "id") WHERE (scope_owner_id IS NOT NULL);
-- Create "software_named_form_revision" table
CREATE TABLE "software_named_form_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "language_tag" text NULL,
  "private_use_namespace" text NULL,
  "language_policy" text NULL,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "sort_name" text NULL,
  "origin" text NOT NULL DEFAULT 'unknown',
  "translation_method" text NOT NULL DEFAULT 'unknown',
  "primary_for_language" boolean NULL,
  "scope_owner_id" uuid NULL,
  "territory" text NULL,
  "context" text NULL,
  "derivation_name_id" uuid NULL,
  "derivation_revision" bigint NULL,
  "begin" jsonb NULL,
  "end" jsonb NULL,
  "ended" boolean NULL,
  "spoiler" integer NOT NULL DEFAULT 0,
  "state" text NOT NULL DEFAULT 'active',
  CONSTRAINT "software_named_form_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "software_named_form_derivation_fk" FOREIGN KEY ("owner_id", "derivation_name_id", "derivation_revision") REFERENCES "software_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_named_form_revision_cNa9m1q77eFa_fkey" FOREIGN KEY ("scope_owner_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_named_form_revision_fxcweBm7PQhp_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_named_form_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "software_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_named_form_revision_owner_id_software_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "software_named_form_derivation_idx" to table: "software_named_form_revision"
CREATE INDEX "software_named_form_derivation_idx" ON "software_named_form_revision" ("owner_id", "derivation_name_id", "derivation_revision") WHERE (derivation_name_id IS NOT NULL);
-- Create "software_name_authority" table
CREATE TABLE "software_name_authority" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "claim" text NOT NULL,
  "review_state" text NOT NULL,
  "authorizer_entity_id" uuid NULL,
  "role" text NOT NULL,
  "territory" text NULL,
  "channel" text NULL,
  "context" text NULL,
  "valid_from" timestamptz(3) NULL,
  "valid_until" timestamptz(3) NULL,
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "review_source_record_id" uuid NULL,
  "review_snapshot_id" uuid NULL,
  "review_source_path" text NULL,
  "state" text NOT NULL,
  CONSTRAINT "software_name_authority_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "software_name_authority_SGhMJsxR9pQ2_fkey" FOREIGN KEY ("authorizer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_authority_evidence_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_authority_owner_id_software_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_authority_recorded_by_auth_user_id_users_id_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_authority_review_fk" FOREIGN KEY ("review_source_record_id", "review_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_authority_target_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "software_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_authority_claim_check" CHECK (claim = ANY (ARRAY['official'::text, 'unofficial'::text, 'unknown'::text])),
  CONSTRAINT "software_name_authority_proof_check" CHECK (((review_state <> 'verified'::text) OR ((authorizer_entity_id IS NOT NULL) AND (review_snapshot_id IS NOT NULL))) AND (num_nonnulls(review_source_record_id, review_snapshot_id, review_source_path) = ANY (ARRAY[0, 3]))),
  CONSTRAINT "software_name_authority_review_check" CHECK (review_state = ANY (ARRAY['source_claim'::text, 'pending'::text, 'verified'::text, 'rejected'::text])),
  CONSTRAINT "software_name_authority_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "software_name_authority_scope_check" CHECK (((octet_length(role) >= 1) AND (octet_length(role) <= 96)) AND ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 4096)) AND ((review_source_path IS NULL) OR ((octet_length(review_source_path) >= 1) AND (octet_length(review_source_path) <= 4096))) AND ((territory IS NULL) OR ((octet_length(territory) >= 1) AND (octet_length(territory) <= 96))) AND ((channel IS NULL) OR ((octet_length(channel) >= 1) AND (octet_length(channel) <= 96))) AND ((context IS NULL) OR ((octet_length(context) >= 1) AND (octet_length(context) <= 512)))),
  CONSTRAINT "software_name_authority_state_check" CHECK (state = ANY (ARRAY['active'::text, 'withdrawn'::text])),
  CONSTRAINT "software_name_authority_time_check" CHECK ((valid_from IS NULL) OR (valid_until IS NULL) OR (valid_until > valid_from))
);
-- Create index "software_name_authority_authorizer_idx" to table: "software_name_authority"
CREATE INDEX "software_name_authority_authorizer_idx" ON "software_name_authority" ("authorizer_entity_id", "owner_id", "id") WHERE (authorizer_entity_id IS NOT NULL);
-- Create index "software_name_authority_evidence_idx" to table: "software_name_authority"
CREATE INDEX "software_name_authority_evidence_idx" ON "software_name_authority" ("source_record_id", "snapshot_id", "id");
-- Create index "software_name_authority_review_idx" to table: "software_name_authority"
CREATE INDEX "software_name_authority_review_idx" ON "software_name_authority" ("review_source_record_id", "review_snapshot_id", "id") WHERE (review_source_record_id IS NOT NULL);
-- Create index "software_name_authority_target_idx" to table: "software_name_authority"
CREATE INDEX "software_name_authority_target_idx" ON "software_name_authority" ("owner_id", "name_id", "name_revision", "id");
-- Create "software_name_authority_revision" table
CREATE TABLE "software_name_authority_revision" (
  "owner_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "recorded_by_auth_user_id" uuid NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "claim" text NOT NULL,
  "review_state" text NOT NULL,
  "authorizer_entity_id" uuid NULL,
  "role" text NOT NULL,
  "territory" text NULL,
  "channel" text NULL,
  "context" text NULL,
  "valid_from" timestamptz(3) NULL,
  "valid_until" timestamptz(3) NULL,
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "review_source_record_id" uuid NULL,
  "review_snapshot_id" uuid NULL,
  "review_source_path" text NULL,
  "state" text NOT NULL,
  CONSTRAINT "software_name_authority_revision_key" PRIMARY KEY ("owner_id", "id", "revision"),
  CONSTRAINT "software_name_authority_history_evidence_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_authority_history_review_fk" FOREIGN KEY ("review_source_record_id", "review_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_authority_history_target_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "software_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_authority_revision_DFZDBS9l0oMk_fkey" FOREIGN KEY ("owner_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_authority_revision_bccD4Ti9ku24_fkey" FOREIGN KEY ("recorded_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_authority_revision_identity_fk" FOREIGN KEY ("owner_id", "id") REFERENCES "software_name_authority" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_authority_revision_qHF2aaWwksA0_fkey" FOREIGN KEY ("authorizer_entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create "software_name_source_binding" table
CREATE TABLE "software_name_source_binding" (
  "owner_id" uuid NOT NULL,
  "source_record_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "local_key" text NOT NULL,
  "name_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "software_name_source_binding_key" PRIMARY KEY ("source_record_id", "namespace", "local_key"),
  CONSTRAINT "software_name_source_binding_owner_key" UNIQUE ("owner_id", "source_record_id", "namespace", "local_key", "name_id"),
  CONSTRAINT "software_name_source_binding_eYXgWPLgWdOx_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_source_binding_name_fk" FOREIGN KEY ("owner_id", "name_id") REFERENCES "software_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_source_binding_value_check" CHECK (((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 96)) AND ((octet_length(local_key) >= 1) AND (octet_length(local_key) <= 512)))
);
-- Create index "software_name_source_binding_owner_idx" to table: "software_name_source_binding"
CREATE INDEX "software_name_source_binding_owner_idx" ON "software_name_source_binding" ("owner_id", "name_id");
-- Create "software_name_source_occurrence" table
CREATE TABLE "software_name_source_occurrence" (
  "owner_id" uuid NOT NULL,
  "source_record_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "local_key" text NOT NULL,
  "name_id" uuid NOT NULL,
  "name_revision" bigint NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "software_name_source_occurrence_key" PRIMARY KEY ("source_record_id", "namespace", "local_key", "snapshot_id"),
  CONSTRAINT "software_name_source_occurrence_binding_fk" FOREIGN KEY ("owner_id", "source_record_id", "namespace", "local_key", "name_id") REFERENCES "software_name_source_binding" ("owner_id", "source_record_id", "namespace", "local_key", "name_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_source_occurrence_name_fk" FOREIGN KEY ("owner_id", "name_id", "name_revision") REFERENCES "software_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_source_occurrence_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_source_occurrence_path_check" CHECK ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 4096))
);
-- Create index "software_name_source_occurrence_name_idx" to table: "software_name_source_occurrence"
CREATE INDEX "software_name_source_occurrence_name_idx" ON "software_name_source_occurrence" ("owner_id", "name_id", "name_revision");
-- Create index "software_name_source_occurrence_snapshot_idx" to table: "software_name_source_occurrence"
CREATE INDEX "software_name_source_occurrence_snapshot_idx" ON "software_name_source_occurrence" ("source_record_id", "snapshot_id");
-- Modify "software_participation_source_occurrence" table
ALTER TABLE "software_participation_source_occurrence" ADD CONSTRAINT "software_context_occurrence_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create "software_patch_target" table
CREATE TABLE "software_patch_target" (
  "release_id" uuid NOT NULL,
  "base_release_id" uuid NOT NULL,
  "compatibility" text NULL,
  PRIMARY KEY ("release_id", "base_release_id"),
  CONSTRAINT "software_patch_target_base_release_id_software_release_id_fkey" FOREIGN KEY ("base_release_id") REFERENCES "software_release" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_patch_target_release_id_software_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "software_release" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_patch_compatibility_check" CHECK ((compatibility IS NULL) OR (octet_length(compatibility) <= 16384)),
  CONSTRAINT "software_patch_not_self_check" CHECK (release_id <> base_release_id)
);
-- Create index "software_patch_target_reverse_idx" to table: "software_patch_target"
CREATE INDEX "software_patch_target_reverse_idx" ON "software_patch_target" ("base_release_id", "release_id");
-- Create "software_record_revision" table
CREATE TABLE "software_record_revision" (
  "owner_id" uuid NOT NULL,
  "revision" bigint NOT NULL,
  "shape" text NOT NULL,
  "value" jsonb NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("owner_id", "revision"),
  CONSTRAINT "software_record_revision_owner_id_software_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_record_revision_check" CHECK (((revision >= 1) AND (revision <= '9007199254740991'::bigint)) AND (shape = ANY (ARRAY['content'::text, 'version'::text, 'release'::text])) AND (jsonb_typeof(value) = 'object'::text) AND (octet_length((value)::text) <= 1048576))
);
-- Modify "software_relation_participant" table
ALTER TABLE "software_relation_participant" DROP CONSTRAINT "software_participant_target_check", ADD CONSTRAINT "software_participant_target_check" CHECK (num_nonnulls(publishing_id, music_id, program_id, software_id, entity_id, grouping_id, reference_id, distribution_id) = 1), ADD COLUMN "distribution_id" uuid NULL, ADD CONSTRAINT "software_relation_participant_jMOCrp3t16z1_fkey" FOREIGN KEY ("distribution_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "software_participant_distribution_idx" to table: "software_relation_participant"
CREATE INDEX "software_participant_distribution_idx" ON "software_relation_participant" ("distribution_id", "role_revision_id", "relation_id") WHERE (distribution_id IS NOT NULL);
-- Create "software_release_animation" table
CREATE TABLE "software_release_animation" (
  "release_id" uuid NOT NULL,
  "context" text NOT NULL,
  "state" text NOT NULL,
  "hand_drawn" boolean NOT NULL DEFAULT false,
  "vectorial" boolean NOT NULL DEFAULT false,
  "three_dimensional" boolean NOT NULL DEFAULT false,
  "live_action" boolean NOT NULL DEFAULT false,
  "frequency" text NOT NULL DEFAULT 'unknown',
  PRIMARY KEY ("release_id", "context"),
  CONSTRAINT "software_release_animation_release_id_software_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "software_release" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_animation_context_check" CHECK (context = ANY (ARRAY['story_sprite'::text, 'story_scene'::text, 'cutscene'::text, 'erotic_sprite'::text, 'erotic_scene'::text])),
  CONSTRAINT "software_animation_cutscene_check" CHECK ((context <> 'cutscene'::text) OR ((state <> 'none'::text) AND (frequency = 'unknown'::text))),
  CONSTRAINT "software_animation_state_check" CHECK ((state = ANY (ARRAY['unknown'::text, 'none'::text, 'not_applicable'::text, 'animated'::text])) AND (frequency = ANY (ARRAY['unknown'::text, 'some'::text, 'all'::text]))),
  CONSTRAINT "software_animation_technique_check" CHECK (((state = 'animated'::text) AND (hand_drawn OR vectorial OR three_dimensional OR live_action)) OR ((state <> 'animated'::text) AND (NOT (hand_drawn OR vectorial OR three_dimensional OR live_action)) AND (frequency = 'unknown'::text)))
);
-- Create "software_version" table
CREATE TABLE "software_version" (
  "id" uuid NOT NULL,
  "identity_shape" text NOT NULL DEFAULT 'version',
  "content_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "version_label" text NULL,
  "language_tag" text NULL,
  "distinguishing_evidence" text NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "software_version_content_id_unique" UNIQUE ("content_id", "id"),
  CONSTRAINT "software_version_content_id_software_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "software_content" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_version_identity_fk" FOREIGN KEY ("id", "identity_shape") REFERENCES "software_identity" ("id", "shape") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_version_evidence_check" CHECK ((octet_length(distinguishing_evidence) >= 1) AND (octet_length(distinguishing_evidence) <= 16384)),
  CONSTRAINT "software_version_kind_check" CHECK (kind = ANY (ARRAY['revision'::text, 'translation'::text, 'localization'::text, 'port'::text, 'variant'::text])),
  CONSTRAINT "software_version_label_check" CHECK ((version_label IS NULL) OR ((octet_length(version_label) >= 1) AND (octet_length(version_label) <= 4096))),
  CONSTRAINT "software_version_language_check" CHECK ((language_tag IS NULL) OR ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255))),
  CONSTRAINT "software_version_shape_check" CHECK (identity_shape = 'version'::text)
);
-- Modify "software_release_content" table
ALTER TABLE "software_release_content" ADD COLUMN "version_id" uuid NULL, ADD CONSTRAINT "software_release_content_version_fk" FOREIGN KEY ("content_id", "version_id") REFERENCES "software_version" ("content_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "software_release_content_version_idx" to table: "software_release_content"
CREATE INDEX "software_release_content_version_idx" ON "software_release_content" ("content_id", "version_id", "release_id", "id");
-- Modify "reference_area" table
ALTER TABLE "reference_area" ADD CONSTRAINT "reference_area_begin_check" CHECK (((date_month IS NULL) OR ((date_month >= 1) AND (date_month <= 12))) AND ((date_day IS NULL) OR ((date_day >= 1) AND (date_day <= 31))) AND ((date_month IS NULL) OR (date_day IS NULL) OR (date_day <=
CASE
    WHEN (date_month = ANY (ARRAY[4, 6, 9, 11])) THEN 30
    WHEN (date_month = 2) THEN
    CASE
        WHEN ((date_year IS NULL) OR (mod(date_year, 400) = 0) OR ((mod(date_year, 4) = 0) AND (mod(date_year, 100) <> 0))) THEN 29
        ELSE 28
    END
    ELSE 31
END))), ADD CONSTRAINT "reference_area_end_check" CHECK (((end_month IS NULL) OR ((end_month >= 1) AND (end_month <= 12))) AND ((end_day IS NULL) OR ((end_day >= 1) AND (end_day <= 31))) AND ((end_month IS NULL) OR (end_day IS NULL) OR (end_day <=
CASE
    WHEN (end_month = ANY (ARRAY[4, 6, 9, 11])) THEN 30
    WHEN (end_month = 2) THEN
    CASE
        WHEN ((end_year IS NULL) OR (mod(end_year, 400) = 0) OR ((mod(end_year, 4) = 0) AND (mod(end_year, 100) <> 0))) THEN 29
        ELSE 28
    END
    ELSE 31
END))), ADD COLUMN "date_year" integer NULL, ADD COLUMN "date_month" smallint NULL, ADD COLUMN "date_day" smallint NULL, ADD COLUMN "date_text" text NULL, ADD COLUMN "end_year" integer NULL, ADD COLUMN "end_month" smallint NULL, ADD COLUMN "end_day" smallint NULL, ADD COLUMN "end_text" text NULL, ADD COLUMN "ended" boolean NULL;
-- Create "software_release_event" table
CREATE TABLE "software_release_event" (
  "release_id" uuid NOT NULL,
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "area_id" uuid NULL,
  "date_year" integer NULL,
  "date_month" smallint NULL,
  "date_day" smallint NULL,
  "date_text" text NULL,
  PRIMARY KEY ("release_id", "id"),
  CONSTRAINT "software_release_event_area_id_reference_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "reference_area" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_release_event_release_id_software_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "software_release" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_release_event_date_check" CHECK (((date_month IS NULL) OR ((date_month >= 1) AND (date_month <= 12))) AND ((date_day IS NULL) OR ((date_day >= 1) AND (date_day <= 31))) AND ((date_month IS NULL) OR (date_day IS NULL) OR (date_day <=
CASE
    WHEN (date_month = ANY (ARRAY[4, 6, 9, 11])) THEN 30
    WHEN (date_month = 2) THEN
    CASE
        WHEN ((date_year IS NULL) OR (mod(date_year, 400) = 0) OR ((mod(date_year, 4) = 0) AND (mod(date_year, 100) <> 0))) THEN 29
        ELSE 28
    END
    ELSE 31
END)))
);
-- Create index "software_release_event_area_idx" to table: "software_release_event"
CREATE INDEX "software_release_event_area_idx" ON "software_release_event" ("area_id", "release_id", "id");
-- Modify "software_fact" table
ALTER TABLE "software_fact" ADD CONSTRAINT "software_fact_head_version_check" CHECK ((expected_head_version >= 0) AND (expected_head_version <= '9007199254740990'::bigint)), ADD CONSTRAINT "software_fact_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "semantic_id" uuid NOT NULL DEFAULT uuidv7(), ADD COLUMN "expected_head_version" bigint NOT NULL DEFAULT 0, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0;
-- Modify "software_catalog_relation" table
ALTER TABLE "software_catalog_relation" ADD CONSTRAINT "software_relation_head_version_check" CHECK ((expected_head_version >= 0) AND (expected_head_version <= '9007199254740990'::bigint)), ADD CONSTRAINT "software_relation_spoiler_check" CHECK ((spoiler >= 0) AND (spoiler <= 2)), ADD COLUMN "semantic_id" uuid NOT NULL DEFAULT uuidv7(), ADD COLUMN "expected_head_version" bigint NOT NULL DEFAULT 0, ADD COLUMN "spoiler" integer NOT NULL DEFAULT 0;
-- Create "software_semantic_revision" table
CREATE TABLE "software_semantic_revision" (
  "owner_id" uuid NOT NULL,
  "semantic_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "fact_id" uuid NULL,
  "relation_id" uuid NULL,
  "state" text NOT NULL DEFAULT 'active',
  "actor_auth_user_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "software_semantic_revision_key" PRIMARY KEY ("owner_id", "semantic_id", "version"),
  CONSTRAINT "software_semantic_revision_actor_auth_user_id_users_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "software_semantic_revision_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "software_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_semantic_revision_owner_id_software_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_semantic_revision_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "software_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_semantic_revision_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "software_semantic_revision_target_check" CHECK (num_nonnulls(fact_id, relation_id) = 1),
  CONSTRAINT "software_semantic_revision_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create index "software_semantic_revision_fact_idx" to table: "software_semantic_revision"
CREATE INDEX "software_semantic_revision_fact_idx" ON "software_semantic_revision" ("owner_id", "fact_id");
-- Create index "software_semantic_revision_relation_idx" to table: "software_semantic_revision"
CREATE INDEX "software_semantic_revision_relation_idx" ON "software_semantic_revision" ("owner_id", "relation_id");
-- Create "software_semantic_head" table
CREATE TABLE "software_semantic_head" (
  "owner_id" uuid NOT NULL,
  "semantic_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  CONSTRAINT "software_semantic_head_key" PRIMARY KEY ("owner_id", "semantic_id"),
  CONSTRAINT "software_semantic_head_revision_fk" FOREIGN KEY ("owner_id", "semantic_id", "version") REFERENCES "software_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create "software_source_binding" table
CREATE TABLE "software_source_binding" (
  "source_record_id" uuid NOT NULL,
  "mapping_key" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'software',
  "owner_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("source_record_id", "mapping_key"),
  CONSTRAINT "software_source_binding_claim_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_binding_owner_id_software_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_binding_owner_check" CHECK (mapping_owner = 'software'::text)
) PARTITION BY HASH ("source_record_id");
-- Create index "software_source_binding_owner_idx" to table: "software_source_binding"
CREATE INDEX "software_source_binding_owner_idx" ON "software_source_binding" ("owner_id", "mapping_key");

-- Atlas Community omits physical children from its parent-table schema diff.
-- Create source leaves before canonical deferred constraint triggers are installed.
DO $$
DECLARE owner_table text; partition_number integer;
BEGIN
  FOREACH owner_table IN ARRAY ARRAY[
    'catalog_source_record', 'catalog_source_snapshot', 'catalog_source_mapping_claim',
    'catalog_source_binding_revision', 'catalog_source_check_receipt', 'catalog_source_adoption_proposal',
    'catalog_source_subscription', 'catalog_source_observation_fanout', 'catalog_source_check_plan',
    'publishing_source_binding', 'music_source_binding', 'program_source_binding',
    'software_source_binding', 'entity_source_binding', 'grouping_source_binding', 'reference_source_binding',
    'distribution_source_binding'
  ] LOOP
    FOR partition_number IN 0..63 LOOP
      EXECUTE format('CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES WITH (MODULUS 64, REMAINDER %s)',
        owner_table || '_p' || lpad(partition_number::text, 2, '0'), owner_table, partition_number);
    END LOOP;
  END LOOP;
  FOR partition_number IN 0..63 LOOP
    EXECUTE format('CREATE TABLE public.%I PARTITION OF public.operational_relay_pending FOR VALUES FROM (%s) TO (%s)',
      'operational_relay_pending_p' || lpad(partition_number::text, 2, '0'),
      partition_number * 16, (partition_number + 1) * 16);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_publish_identity_route()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE affected integer; legacy_exists boolean; routing_ready boolean;
BEGIN
  SELECT ready INTO routing_ready FROM public.catalog_routing_control WHERE singleton FOR SHARE;
  IF routing_ready IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Catalog identity routing is fenced for repair'
      USING ERRCODE = '55000';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('catalog-identity:' || NEW.id::text, 0));
  IF TG_OP = 'UPDATE' AND (NEW.id <> OLD.id OR NEW.routing_generation < OLD.routing_generation) THEN
    RAISE EXCEPTION 'Catalog identity or routing generation cannot move backwards'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_identity_immutable_id';
  END IF;
  -- Transitional collision fence. P11 removes it with the legacy INSERT guard.
  IF TG_OP = 'INSERT' AND to_regclass('public.unit') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS(SELECT 1 FROM public.unit WHERE id = $1)' INTO legacy_exists USING NEW.id;
    IF legacy_exists THEN
      RAISE EXCEPTION 'Catalog ID is still owned by the legacy identity store'
        USING ERRCODE = '23505', CONSTRAINT = 'catalog_identity_owner_conflict';
    END IF;
  END IF;
  INSERT INTO public.catalog_unit_locator(id, owner, generation)
    VALUES (NEW.id, TG_ARGV[0], NEW.routing_generation)
    ON CONFLICT (id) DO UPDATE SET generation = EXCLUDED.generation
      WHERE catalog_unit_locator.owner = EXCLUDED.owner
        AND catalog_unit_locator.generation <= EXCLUDED.generation;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'Catalog ID already belongs to another owner or routing generation'
      USING ERRCODE = '23505', CONSTRAINT = 'catalog_identity_owner_conflict';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_legacy_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('catalog-identity:' || NEW.id::text, 0));
  IF EXISTS(SELECT 1 FROM public.catalog_unit_locator WHERE id = NEW.id) THEN
    RAISE EXCEPTION 'Legacy insert conflicts with a native catalog identity'
      USING ERRCODE = '23505', CONSTRAINT = 'catalog_identity_owner_conflict';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_remove_identity_route()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  DELETE FROM public.catalog_unit_locator
    WHERE id = OLD.id AND owner = TG_ARGV[0] AND generation = OLD.routing_generation;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_require_definition_kind()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE actual_kind text; definition_revision uuid;
BEGIN
  definition_revision := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
  IF definition_revision IS NULL AND coalesce(TG_ARGV[2], '') = 'optional' THEN
    RETURN NEW;
  END IF;
  SELECT d.kind INTO actual_kind
    FROM public.catalog_definition_revision AS r
    JOIN public.catalog_definition AS d ON d.id = r.definition_id
    WHERE r.id = definition_revision;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Catalog definition revision does not exist'
      USING ERRCODE = '23503', CONSTRAINT = 'catalog_definition_revision_exists';
  END IF;
  IF actual_kind <> TG_ARGV[1] THEN
    RAISE EXCEPTION 'Catalog definition kind does not match its use'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_definition_kind_matches_use';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_definition_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE actual_kind text;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Catalog definition meanings are immutable; append a new revision'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_definition_revision_immutable';
  END IF;
  SELECT kind INTO actual_kind FROM public.catalog_definition WHERE id = NEW.definition_id;
  IF (actual_kind = 'property') <> (NEW.value_kind IS NOT NULL) THEN
    RAISE EXCEPTION 'Only a property definition has a scalar or structured value kind'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_definition_revision_value_kind';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_definition_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Catalog definition identity is immutable'
    USING ERRCODE = '23514', CONSTRAINT = 'catalog_definition_identity_immutable';
END;
$$;

DROP TRIGGER IF EXISTS catalog_definition_identity_guard ON public.catalog_definition;
CREATE TRIGGER catalog_definition_identity_guard
BEFORE UPDATE OR DELETE ON public.catalog_definition
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_definition_identity();

DROP TRIGGER IF EXISTS catalog_definition_revision_guard ON public.catalog_definition_revision;
CREATE TRIGGER catalog_definition_revision_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.catalog_definition_revision
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_definition_revision();

DROP TRIGGER IF EXISTS grouping_class_definition_guard ON public.grouping_class_assignment;
CREATE TRIGGER grouping_class_definition_guard
BEFORE INSERT OR UPDATE ON public.grouping_class_assignment
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('class_revision_id', 'class');

DROP TRIGGER IF EXISTS catalog_legacy_identity_guard ON public.unit;
CREATE TRIGGER catalog_legacy_identity_guard
BEFORE INSERT ON public.unit
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_legacy_identity();

DROP TRIGGER IF EXISTS publishing_identity_route_publish ON public.publishing_identity;
CREATE TRIGGER publishing_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.publishing_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('publishing');

DROP TRIGGER IF EXISTS publishing_identity_route_remove ON public.publishing_identity;
CREATE TRIGGER publishing_identity_route_remove
AFTER DELETE ON public.publishing_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('publishing');

DROP TRIGGER IF EXISTS publishing_fact_definition_guard ON public.publishing_fact;
CREATE TRIGGER publishing_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.publishing_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS publishing_catalog_relation_definition_guard ON public.publishing_catalog_relation;
CREATE TRIGGER publishing_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.publishing_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

DROP TRIGGER IF EXISTS publishing_relation_participant_definition_guard ON public.publishing_relation_participant;
CREATE TRIGGER publishing_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.publishing_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

DROP TRIGGER IF EXISTS publishing_relation_scope_definition_guard ON public.publishing_relation_scope;
CREATE TRIGGER publishing_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.publishing_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS music_identity_route_publish ON public.music_identity;
CREATE TRIGGER music_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.music_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('music');

DROP TRIGGER IF EXISTS music_identity_route_remove ON public.music_identity;
CREATE TRIGGER music_identity_route_remove
AFTER DELETE ON public.music_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('music');

DROP TRIGGER IF EXISTS music_fact_definition_guard ON public.music_fact;
CREATE TRIGGER music_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.music_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS music_catalog_relation_definition_guard ON public.music_catalog_relation;
CREATE TRIGGER music_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.music_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

DROP TRIGGER IF EXISTS music_relation_participant_definition_guard ON public.music_relation_participant;
CREATE TRIGGER music_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.music_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

DROP TRIGGER IF EXISTS music_relation_scope_definition_guard ON public.music_relation_scope;
CREATE TRIGGER music_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.music_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS program_identity_route_publish ON public.program_identity;
CREATE TRIGGER program_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.program_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('program');

DROP TRIGGER IF EXISTS program_identity_route_remove ON public.program_identity;
CREATE TRIGGER program_identity_route_remove
AFTER DELETE ON public.program_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('program');

DROP TRIGGER IF EXISTS program_fact_definition_guard ON public.program_fact;
CREATE TRIGGER program_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.program_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS program_catalog_relation_definition_guard ON public.program_catalog_relation;
CREATE TRIGGER program_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.program_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

DROP TRIGGER IF EXISTS program_relation_participant_definition_guard ON public.program_relation_participant;
CREATE TRIGGER program_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.program_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

DROP TRIGGER IF EXISTS program_relation_scope_definition_guard ON public.program_relation_scope;
CREATE TRIGGER program_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.program_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS software_identity_route_publish ON public.software_identity;
CREATE TRIGGER software_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.software_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('software');

DROP TRIGGER IF EXISTS software_identity_route_remove ON public.software_identity;
CREATE TRIGGER software_identity_route_remove
AFTER DELETE ON public.software_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('software');

DROP TRIGGER IF EXISTS software_fact_definition_guard ON public.software_fact;
CREATE TRIGGER software_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.software_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS software_catalog_relation_definition_guard ON public.software_catalog_relation;
CREATE TRIGGER software_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.software_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

DROP TRIGGER IF EXISTS software_relation_participant_definition_guard ON public.software_relation_participant;
CREATE TRIGGER software_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.software_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

DROP TRIGGER IF EXISTS software_relation_scope_definition_guard ON public.software_relation_scope;
CREATE TRIGGER software_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.software_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS entity_identity_route_publish ON public.entity_identity;
CREATE TRIGGER entity_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.entity_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('entity');

DROP TRIGGER IF EXISTS entity_identity_route_remove ON public.entity_identity;
CREATE TRIGGER entity_identity_route_remove
AFTER DELETE ON public.entity_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('entity');

DROP TRIGGER IF EXISTS entity_fact_definition_guard ON public.entity_fact;
CREATE TRIGGER entity_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.entity_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS entity_catalog_relation_definition_guard ON public.entity_catalog_relation;
CREATE TRIGGER entity_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.entity_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

DROP TRIGGER IF EXISTS entity_relation_participant_definition_guard ON public.entity_relation_participant;
CREATE TRIGGER entity_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.entity_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

DROP TRIGGER IF EXISTS entity_relation_scope_definition_guard ON public.entity_relation_scope;
CREATE TRIGGER entity_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.entity_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS grouping_identity_route_publish ON public.grouping_identity;
CREATE TRIGGER grouping_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.grouping_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('grouping');

DROP TRIGGER IF EXISTS grouping_identity_route_remove ON public.grouping_identity;
CREATE TRIGGER grouping_identity_route_remove
AFTER DELETE ON public.grouping_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('grouping');

DROP TRIGGER IF EXISTS grouping_fact_definition_guard ON public.grouping_fact;
CREATE TRIGGER grouping_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.grouping_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS grouping_catalog_relation_definition_guard ON public.grouping_catalog_relation;
CREATE TRIGGER grouping_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.grouping_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

DROP TRIGGER IF EXISTS grouping_relation_participant_definition_guard ON public.grouping_relation_participant;
CREATE TRIGGER grouping_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.grouping_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

DROP TRIGGER IF EXISTS grouping_relation_scope_definition_guard ON public.grouping_relation_scope;
CREATE TRIGGER grouping_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.grouping_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS reference_identity_route_publish ON public.reference_identity;
CREATE TRIGGER reference_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.reference_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('reference');

DROP TRIGGER IF EXISTS reference_identity_route_remove ON public.reference_identity;
CREATE TRIGGER reference_identity_route_remove
AFTER DELETE ON public.reference_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('reference');

DROP TRIGGER IF EXISTS reference_fact_definition_guard ON public.reference_fact;
CREATE TRIGGER reference_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.reference_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS reference_catalog_relation_definition_guard ON public.reference_catalog_relation;
CREATE TRIGGER reference_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.reference_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

DROP TRIGGER IF EXISTS reference_relation_participant_definition_guard ON public.reference_relation_participant;
CREATE TRIGGER reference_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.reference_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

DROP TRIGGER IF EXISTS reference_relation_scope_definition_guard ON public.reference_relation_scope;
CREATE TRIGGER reference_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.reference_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

CREATE OR REPLACE FUNCTION public.catalog_guard_fact_value()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE target_owner uuid; target_fact uuid; fact_state text; sealed_time timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Fact value nodes are append-only'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_fact_value_immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN target_owner := OLD.owner_id; target_fact := OLD.fact_id;
  ELSE target_owner := NEW.owner_id; target_fact := NEW.fact_id; END IF;
  CASE TG_ARGV[0]
    WHEN 'publishing' THEN SELECT state, sealed_at INTO fact_state, sealed_time FROM public.publishing_fact WHERE owner_id = target_owner AND id = target_fact FOR SHARE;
    WHEN 'music' THEN SELECT state, sealed_at INTO fact_state, sealed_time FROM public.music_fact WHERE owner_id = target_owner AND id = target_fact FOR SHARE;
    WHEN 'program' THEN SELECT state, sealed_at INTO fact_state, sealed_time FROM public.program_fact WHERE owner_id = target_owner AND id = target_fact FOR SHARE;
    WHEN 'software' THEN SELECT state, sealed_at INTO fact_state, sealed_time FROM public.software_fact WHERE owner_id = target_owner AND id = target_fact FOR SHARE;
    WHEN 'entity' THEN SELECT state, sealed_at INTO fact_state, sealed_time FROM public.entity_fact WHERE owner_id = target_owner AND id = target_fact FOR SHARE;
    WHEN 'grouping' THEN SELECT state, sealed_at INTO fact_state, sealed_time FROM public.grouping_fact WHERE owner_id = target_owner AND id = target_fact FOR SHARE;
    WHEN 'reference' THEN SELECT state, sealed_at INTO fact_state, sealed_time FROM public.reference_fact WHERE owner_id = target_owner AND id = target_fact FOR SHARE;
    WHEN 'distribution' THEN SELECT state, sealed_at INTO fact_state, sealed_time FROM public.distribution_fact WHERE owner_id = target_owner AND id = target_fact FOR SHARE;
    ELSE RAISE EXCEPTION 'Unregistered catalog owner';
  END CASE;
  IF fact_state IS NULL THEN
    RAISE EXCEPTION 'Fact value owner does not exist' USING ERRCODE = '23503';
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF fact_state <> 'withdrawn' THEN
      RAISE EXCEPTION 'Withdraw a fact before erasing its value'
        USING ERRCODE = '23514', CONSTRAINT = 'catalog_fact_value_immutable';
    END IF;
    RETURN OLD;
  END IF;
  IF sealed_time IS NOT NULL OR fact_state <> 'active' THEN
    RAISE EXCEPTION 'Fact is sealed or no longer accepts value nodes'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_fact_value_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_fact_header()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE root_kind text; expected_kind text; last_position bigint;
BEGIN
  IF NEW.id <> OLD.id OR NEW.owner_id <> OLD.owner_id OR NEW.definition_revision_id <> OLD.definition_revision_id THEN
    RAISE EXCEPTION 'Fact identity and definition revision are immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_fact_identity_immutable';
  END IF;
  IF OLD.sealed_at IS NOT NULL THEN
    IF NEW.sealed_at IS DISTINCT FROM OLD.sealed_at OR NEW.last_node_position <> OLD.last_node_position THEN
      RAISE EXCEPTION 'Sealed fact value cannot be reopened'
        USING ERRCODE = '23514', CONSTRAINT = 'catalog_fact_value_immutable';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.sealed_at IS NULL THEN RETURN NEW; END IF;
  IF NEW.state <> 'active' THEN
    RAISE EXCEPTION 'Only an active draft fact can be sealed' USING ERRCODE = '23514';
  END IF;
  CASE TG_ARGV[0]
    WHEN 'publishing' THEN
      SELECT kind INTO root_kind FROM public.publishing_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id AND position = 0;
      SELECT position INTO last_position FROM public.publishing_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id ORDER BY position DESC LIMIT 1;
    WHEN 'music' THEN
      SELECT kind INTO root_kind FROM public.music_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id AND position = 0;
      SELECT position INTO last_position FROM public.music_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id ORDER BY position DESC LIMIT 1;
    WHEN 'program' THEN
      SELECT kind INTO root_kind FROM public.program_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id AND position = 0;
      SELECT position INTO last_position FROM public.program_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id ORDER BY position DESC LIMIT 1;
    WHEN 'software' THEN
      SELECT kind INTO root_kind FROM public.software_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id AND position = 0;
      SELECT position INTO last_position FROM public.software_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id ORDER BY position DESC LIMIT 1;
    WHEN 'entity' THEN
      SELECT kind INTO root_kind FROM public.entity_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id AND position = 0;
      SELECT position INTO last_position FROM public.entity_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id ORDER BY position DESC LIMIT 1;
    WHEN 'grouping' THEN
      SELECT kind INTO root_kind FROM public.grouping_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id AND position = 0;
      SELECT position INTO last_position FROM public.grouping_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id ORDER BY position DESC LIMIT 1;
    WHEN 'reference' THEN
      SELECT kind INTO root_kind FROM public.reference_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id AND position = 0;
      SELECT position INTO last_position FROM public.reference_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id ORDER BY position DESC LIMIT 1;
    WHEN 'distribution' THEN
      SELECT kind INTO root_kind FROM public.distribution_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id AND position = 0;
      SELECT position INTO last_position FROM public.distribution_fact_value_node WHERE owner_id = NEW.owner_id AND fact_id = NEW.id ORDER BY position DESC LIMIT 1;
    ELSE RAISE EXCEPTION 'Unregistered catalog owner';
  END CASE;
  SELECT value_kind INTO expected_kind FROM public.catalog_definition_revision WHERE id = NEW.definition_revision_id;
  IF root_kind IS NULL OR last_position IS DISTINCT FROM NEW.last_node_position
      OR (root_kind <> 'null' AND root_kind <> expected_kind) THEN
    RAISE EXCEPTION 'Fact prefix or root type does not match the declared value'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_fact_seal_integrity';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_source_snapshot()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Source snapshot evidence is immutable'
    USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_snapshot_immutable';
END;
$$;

DROP TRIGGER IF EXISTS publishing_fact_value_node_value_guard ON public.publishing_fact_value_node;
CREATE TRIGGER publishing_fact_value_node_value_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.publishing_fact_value_node
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_value('publishing');

DROP TRIGGER IF EXISTS publishing_fact_value_guard ON public.publishing_fact;
CREATE TRIGGER publishing_fact_value_guard
BEFORE UPDATE ON public.publishing_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_header('publishing');

DROP TRIGGER IF EXISTS music_fact_value_node_value_guard ON public.music_fact_value_node;
CREATE TRIGGER music_fact_value_node_value_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.music_fact_value_node
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_value('music');

DROP TRIGGER IF EXISTS music_fact_value_guard ON public.music_fact;
CREATE TRIGGER music_fact_value_guard
BEFORE UPDATE ON public.music_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_header('music');

DROP TRIGGER IF EXISTS program_fact_value_node_value_guard ON public.program_fact_value_node;
CREATE TRIGGER program_fact_value_node_value_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.program_fact_value_node
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_value('program');

DROP TRIGGER IF EXISTS program_fact_value_guard ON public.program_fact;
CREATE TRIGGER program_fact_value_guard
BEFORE UPDATE ON public.program_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_header('program');

DROP TRIGGER IF EXISTS software_fact_value_node_value_guard ON public.software_fact_value_node;
CREATE TRIGGER software_fact_value_node_value_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.software_fact_value_node
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_value('software');

DROP TRIGGER IF EXISTS software_fact_value_guard ON public.software_fact;
CREATE TRIGGER software_fact_value_guard
BEFORE UPDATE ON public.software_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_header('software');

DROP TRIGGER IF EXISTS entity_fact_value_node_value_guard ON public.entity_fact_value_node;
CREATE TRIGGER entity_fact_value_node_value_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.entity_fact_value_node
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_value('entity');

DROP TRIGGER IF EXISTS entity_fact_value_guard ON public.entity_fact;
CREATE TRIGGER entity_fact_value_guard
BEFORE UPDATE ON public.entity_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_header('entity');

DROP TRIGGER IF EXISTS grouping_fact_value_node_value_guard ON public.grouping_fact_value_node;
CREATE TRIGGER grouping_fact_value_node_value_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.grouping_fact_value_node
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_value('grouping');

DROP TRIGGER IF EXISTS grouping_fact_value_guard ON public.grouping_fact;
CREATE TRIGGER grouping_fact_value_guard
BEFORE UPDATE ON public.grouping_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_header('grouping');

DROP TRIGGER IF EXISTS reference_fact_value_node_value_guard ON public.reference_fact_value_node;
CREATE TRIGGER reference_fact_value_node_value_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.reference_fact_value_node
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_value('reference');

DROP TRIGGER IF EXISTS reference_fact_value_guard ON public.reference_fact;
CREATE TRIGGER reference_fact_value_guard
BEFORE UPDATE ON public.reference_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_header('reference');

DROP TRIGGER IF EXISTS catalog_source_snapshot_immutable ON public.catalog_source_snapshot;

DROP TRIGGER IF EXISTS distribution_identity_route_publish ON public.distribution_identity;
CREATE TRIGGER distribution_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.distribution_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('distribution');

DROP TRIGGER IF EXISTS distribution_identity_route_remove ON public.distribution_identity;
CREATE TRIGGER distribution_identity_route_remove
AFTER DELETE ON public.distribution_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('distribution');

DROP TRIGGER IF EXISTS distribution_fact_definition_guard ON public.distribution_fact;
CREATE TRIGGER distribution_fact_definition_guard BEFORE INSERT OR UPDATE ON public.distribution_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS distribution_catalog_relation_definition_guard ON public.distribution_catalog_relation;
CREATE TRIGGER distribution_catalog_relation_definition_guard BEFORE INSERT OR UPDATE ON public.distribution_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

DROP TRIGGER IF EXISTS distribution_relation_participant_definition_guard ON public.distribution_relation_participant;
CREATE TRIGGER distribution_relation_participant_definition_guard BEFORE INSERT OR UPDATE ON public.distribution_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

DROP TRIGGER IF EXISTS distribution_relation_scope_definition_guard ON public.distribution_relation_scope;
CREATE TRIGGER distribution_relation_scope_definition_guard BEFORE INSERT OR UPDATE ON public.distribution_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

DROP TRIGGER IF EXISTS distribution_fact_value_node_value_guard ON public.distribution_fact_value_node;
CREATE TRIGGER distribution_fact_value_node_value_guard BEFORE INSERT OR UPDATE OR DELETE ON public.distribution_fact_value_node
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_value('distribution');

DROP TRIGGER IF EXISTS distribution_fact_value_guard ON public.distribution_fact;
CREATE TRIGGER distribution_fact_value_guard BEFORE UPDATE ON public.distribution_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_fact_header('distribution');

CREATE TRIGGER catalog_source_snapshot_immutable
BEFORE UPDATE ON public.catalog_source_snapshot
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_source_snapshot();


CREATE OR REPLACE FUNCTION public.catalog_guard_distribution_member()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE sealed_time timestamptz;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Distribution occurrences are immutable; stage a replacement manifest' USING ERRCODE = '23514';
  END IF;
  SELECT sealed_at INTO sealed_time FROM public.distribution_manifest
    WHERE package_id = NEW.package_id AND id = NEW.manifest_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Distribution manifest is missing' USING ERRCODE = '23503'; END IF;
  IF sealed_time IS NOT NULL THEN
    RAISE EXCEPTION 'Distribution append requires an unsealed manifest' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_count_distribution_members()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE batch record; prefix bigint;
BEGIN
  FOR batch IN SELECT package_id, manifest_id, count(*) AS members, min(position) AS first_position, max(position) AS last_position
    FROM inserted_distribution_members GROUP BY package_id, manifest_id ORDER BY package_id, manifest_id LOOP
    SELECT member_count INTO prefix FROM public.distribution_manifest WHERE package_id = batch.package_id AND id = batch.manifest_id FOR UPDATE;
    IF batch.first_position <> prefix OR batch.last_position <> prefix + batch.members - 1 THEN
      RAISE EXCEPTION 'Distribution append must be a complete consecutive prefix' USING ERRCODE = '23514';
    END IF;
    UPDATE public.distribution_manifest SET member_count = member_count + batch.members WHERE package_id = batch.package_id AND id = batch.manifest_id;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_distribution_manifest()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.member_count <> 0 OR NEW.sealed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Distribution manifests start empty and unsealed' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Distribution manifests are retained for history' USING ERRCODE = '23514'; END IF;
  IF NEW.id <> OLD.id OR NEW.package_id <> OLD.package_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Distribution manifest identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.member_count <> OLD.member_count AND pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'Distribution prefix is maintained only by occurrence insertion' USING ERRCODE = '23514';
  END IF;
  IF OLD.sealed_at IS NOT NULL AND (NEW.sealed_at IS DISTINCT FROM OLD.sealed_at OR NEW.member_count <> OLD.member_count) THEN
    RAISE EXCEPTION 'Sealed distribution manifests are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_distribution_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE head bigint; sealed_time timestamptz;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Distribution revisions are immutable' USING ERRCODE = '23514'; END IF;
  SELECT current_revision INTO head FROM public.distribution_package WHERE id = NEW.package_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Distribution package is missing' USING ERRCODE = '23503'; END IF;
  IF NEW.revision <> head + 1 THEN RAISE EXCEPTION 'Distribution revision must follow current head' USING ERRCODE = '23514'; END IF;
  SELECT sealed_at INTO sealed_time FROM public.distribution_manifest WHERE package_id = NEW.package_id AND id = NEW.manifest_id FOR SHARE;
  IF NOT FOUND OR sealed_time IS NULL THEN RAISE EXCEPTION 'Distribution revision requires sealed manifest' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_require_distribution_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE package_key uuid; head bigint;
BEGIN
  IF TG_TABLE_NAME = 'distribution_package' THEN package_key := NEW.id; ELSE package_key := NEW.package_id; END IF;
  SELECT current_revision INTO head FROM public.distribution_package WHERE id = package_key;
  IF TG_TABLE_NAME = 'distribution_revision' THEN
    IF head < NEW.revision THEN RAISE EXCEPTION 'Distribution revision must be published atomically' USING ERRCODE = '23514'; END IF;
  END IF;
  IF head > 0 AND NOT EXISTS (SELECT 1 FROM public.distribution_revision WHERE package_id = package_key AND revision = head) THEN
    RAISE EXCEPTION 'Distribution current revision is missing' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_distribution_package()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.current_revision <> 0 THEN RAISE EXCEPTION 'Distribution package starts at revision zero' USING ERRCODE = '23514'; END IF;
  ELSIF NEW.id <> OLD.id OR NEW.identity_shape <> OLD.identity_shape OR NEW.current_revision <> OLD.current_revision + 1 THEN
    RAISE EXCEPTION 'Distribution head can advance by exactly one revision' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS distribution_member_guard ON public.distribution_member;
CREATE TRIGGER distribution_member_guard BEFORE INSERT OR UPDATE OR DELETE ON public.distribution_member FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_distribution_member();
DROP TRIGGER IF EXISTS distribution_member_count ON public.distribution_member;
CREATE TRIGGER distribution_member_count AFTER INSERT ON public.distribution_member REFERENCING NEW TABLE AS inserted_distribution_members FOR EACH STATEMENT EXECUTE FUNCTION public.catalog_count_distribution_members();
DROP TRIGGER IF EXISTS distribution_manifest_guard ON public.distribution_manifest;
CREATE TRIGGER distribution_manifest_guard BEFORE INSERT OR UPDATE OR DELETE ON public.distribution_manifest FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_distribution_manifest();
DROP TRIGGER IF EXISTS distribution_revision_guard ON public.distribution_revision;
CREATE TRIGGER distribution_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON public.distribution_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_distribution_revision();
DROP TRIGGER IF EXISTS distribution_package_guard ON public.distribution_package;
CREATE TRIGGER distribution_package_guard BEFORE INSERT OR UPDATE ON public.distribution_package FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_distribution_package();
DROP TRIGGER IF EXISTS distribution_package_head ON public.distribution_package;
CREATE CONSTRAINT TRIGGER distribution_package_head AFTER INSERT OR UPDATE ON public.distribution_package DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_distribution_head();
DROP TRIGGER IF EXISTS distribution_revision_head ON public.distribution_revision;
CREATE CONSTRAINT TRIGGER distribution_revision_head AFTER INSERT ON public.distribution_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_distribution_head();


CREATE OR REPLACE FUNCTION public.catalog_record_music_component()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE body jsonb; owner_key uuid; native_revision bigint; component_key text; i integer;
BEGIN
  body := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  owner_key := (body ->> TG_ARGV[0])::uuid;
  IF TG_OP = 'UPDATE' THEN
    FOR i IN 0..TG_NARGS - 1 LOOP
      IF (to_jsonb(OLD) -> TG_ARGV[i]) IS DISTINCT FROM (body -> TG_ARGV[i]) THEN
        RAISE EXCEPTION 'Native music component identity and ownership are immutable'
          USING ERRCODE = '23514', CONSTRAINT = 'music_component_identity_immutable';
      END IF;
    END LOOP;
  END IF;
  SELECT revision INTO STRICT native_revision FROM public.music_identity WHERE id = owner_key;
  component_key := '';
  FOR i IN 1..TG_NARGS - 1 LOOP
    component_key := component_key || CASE WHEN i = 1 THEN '' ELSE '/' END || (body ->> TG_ARGV[i]);
  END LOOP;
  INSERT INTO public.music_component_revision(owner_id, component, component_key, owner_revision, operation, value)
    VALUES (owner_key, TG_TABLE_NAME, component_key, native_revision, TG_OP, body);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_guard_music_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Native music revisions and sealed TOCs are immutable'
    USING ERRCODE = '23514', CONSTRAINT = 'music_native_revision_immutable';
END $$;

CREATE TRIGGER music_component_revision_immutable BEFORE UPDATE OR DELETE ON public.music_component_revision
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_history();
CREATE TRIGGER music_disc_toc_immutable BEFORE UPDATE OR DELETE ON public.music_disc_toc
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_history();
CREATE TRIGGER music_disc_toc_offset_immutable BEFORE UPDATE OR DELETE ON public.music_disc_toc_offset
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_history();

CREATE OR REPLACE FUNCTION public.catalog_guard_music_toc_offset_append()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM 1 FROM public.music_disc_toc WHERE id = NEW.toc_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.music_medium_toc WHERE toc_id = NEW.toc_id)
    OR EXISTS(SELECT 1 FROM public.music_candidate_toc WHERE toc_id = NEW.toc_id) THEN
    RAISE EXCEPTION 'Attached TOC offsets are sealed' USING ERRCODE = '23514', CONSTRAINT = 'music_toc_offset_sealed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER music_disc_toc_offset_sealed BEFORE INSERT ON public.music_disc_toc_offset
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_toc_offset_append();

CREATE OR REPLACE FUNCTION public.catalog_check_music_toc_attachment()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE expected_count integer; leadout bigint; actual_count bigint; valid boolean;
BEGIN
  SELECT track_count, leadout_offset INTO STRICT expected_count, leadout
    FROM public.music_disc_toc WHERE id = NEW.toc_id FOR UPDATE;
  SELECT count(*), coalesce(bool_and(position = ordinal - 1 AND track_offset < leadout
    AND (previous_offset IS NULL OR previous_offset < track_offset)), false)
    INTO actual_count, valid
    FROM (SELECT position, "offset" AS track_offset, row_number() OVER (ORDER BY position) ordinal,
      lag("offset") OVER (ORDER BY position) previous_offset
      FROM public.music_disc_toc_offset WHERE toc_id = NEW.toc_id ORDER BY position LIMIT 100) offsets;
  IF actual_count <> expected_count OR NOT valid THEN
    RAISE EXCEPTION 'Disc TOC must have the declared contiguous increasing offsets before attachment'
      USING ERRCODE = '23514', CONSTRAINT = 'music_disc_toc_complete';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER music_medium_toc_complete BEFORE INSERT OR UPDATE ON public.music_medium_toc
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_toc_attachment();
CREATE TRIGGER music_candidate_toc_complete BEFORE INSERT OR UPDATE ON public.music_candidate_toc
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_toc_attachment();

DO $$
DECLARE row record;
BEGIN
  FOR row IN SELECT * FROM (VALUES
    ('music_work','id','id'), ('music_recording','id','id'),
    ('music_release_group','id','id'), ('music_release','id','id'),
    ('music_release_candidate','id','id'),
    ('music_medium','release_id','id'), ('music_track_occurrence','release_id','id'),
    ('music_release_label','release_id','id'), ('music_release_event','release_id','id'),
    ('music_release_presentation','release_id','id'), ('music_medium_presentation','release_id','id'),
    ('music_candidate_track','candidate_id','id'), ('music_work_language','work_id','language_tag'),
    ('music_release_group_secondary_type','release_group_id','type_revision_id')
  ) items(table_name, owner_column, key_column) LOOP
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component(%L,%L)',
      row.table_name || '_record_revision', row.table_name, row.owner_column, row.key_column);
  END LOOP;
END $$;

CREATE TRIGGER music_medium_attribute_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_medium_attribute
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('release_id','medium_id','id');
CREATE TRIGGER music_track_presentation_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_track_presentation
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('release_id','medium_presentation_id','track_id');
CREATE TRIGGER music_medium_toc_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_medium_toc
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('release_id','medium_id','toc_id');
CREATE TRIGGER music_candidate_toc_record_revision AFTER INSERT OR UPDATE OR DELETE ON public.music_candidate_toc
  FOR EACH ROW EXECUTE FUNCTION public.catalog_record_music_component('candidate_id','toc_id');


CREATE OR REPLACE FUNCTION public.catalog_valid_name_date(value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public AS $$
DECLARE y integer; m integer; d integer; maximum integer;
BEGIN
 IF value IS NULL THEN RETURN TRUE; END IF;
 IF jsonb_typeof(value) <> 'object' THEN RETURN FALSE; END IF;
 IF NOT value ?& ARRAY['year','month','day'] OR
    (SELECT count(*) FROM jsonb_object_keys(value)) <> 3 THEN RETURN FALSE; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_each(value) item WHERE item.value <> 'null'::jsonb AND
    (jsonb_typeof(item.value) <> 'number' OR NOT pg_input_is_valid(item.value::text, 'integer'))) THEN RETURN FALSE; END IF;
 y := (value->>'year')::integer; m := (value->>'month')::integer; d := (value->>'day')::integer;
 IF (m IS NOT NULL AND m NOT BETWEEN 1 AND 12) OR (d IS NOT NULL AND d NOT BETWEEN 1 AND 31) THEN RETURN FALSE; END IF;
 IF m IS NULL OR d IS NULL THEN RETURN TRUE; END IF;
 maximum := CASE WHEN m = 2 THEN CASE WHEN y IS NULL OR y % 400 = 0 OR (y % 4 = 0 AND y % 100 <> 0) THEN 29 ELSE 28 END WHEN m IN (4,6,9,11) THEN 30 ELSE 31 END;
 RETURN d <= maximum;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_named_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN
  RAISE EXCEPTION 'Named facts retain identity and revision history' USING ERRCODE = '23514';
 END IF;
 IF TG_TABLE_NAME LIKE '%\_named_form' ESCAPE '\' THEN
  IF NOT public.catalog_valid_name_date(NEW."begin") OR NOT public.catalog_valid_name_date(NEW."end") THEN
   RAISE EXCEPTION 'Named-form dates must preserve valid known calendar components' USING ERRCODE = '23514';
  END IF;
 END IF;
 IF (TG_OP = 'INSERT' AND NEW.revision <> 1) OR
    (TG_OP = 'UPDATE' AND (NEW.owner_id <> OLD.owner_id OR NEW.id <> OLD.id OR NEW.created_at <> OLD.created_at OR NEW.revision <> OLD.revision + 1)) THEN
  RAISE EXCEPTION 'Named fact identity is immutable and revisions must advance by one' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_snapshot_named_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 -- ALTER TABLE preserves old physical column order; history must match names, not positions.
 EXECUTE format('INSERT INTO public.%I SELECT (jsonb_populate_record(NULL::public.%I, to_jsonb($1))).*',
   TG_TABLE_NAME || '_revision', TG_TABLE_NAME || '_revision') USING NEW;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_named_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE head_value jsonb;
BEGIN
 IF TG_OP <> 'INSERT' THEN
  RAISE EXCEPTION 'Named fact revision history is immutable' USING ERRCODE = '23514';
 END IF;
 EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE owner_id = $1 AND id = $2', TG_ARGV[0])
 INTO head_value USING NEW.owner_id, NEW.id;
 IF head_value IS DISTINCT FROM to_jsonb(NEW) THEN
  RAISE EXCEPTION 'History must be the exact complete current revision' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_name_source_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 RAISE EXCEPTION 'Named-form source bindings and observations are immutable' USING ERRCODE = '23514';
END;
$$;

DO $$
DECLARE owner text; suffix text; head_name text;
BEGIN
 FOREACH owner IN ARRAY ARRAY['publishing','music','program','software','entity','grouping','reference','distribution'] LOOP
  FOREACH suffix IN ARRAY ARRAY['named_form','identifier_claim','name_authority'] LOOP
   head_name := owner || '_' || suffix;
   EXECUTE format('DROP TRIGGER IF EXISTS catalog_named_head_guard ON public.%I', head_name);
   EXECUTE format('CREATE TRIGGER catalog_named_head_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_named_head()', head_name);
   EXECUTE format('DROP TRIGGER IF EXISTS catalog_named_head_snapshot ON public.%I', head_name);
   EXECUTE format('CREATE TRIGGER catalog_named_head_snapshot AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_snapshot_named_head()', head_name);
   EXECUTE format('DROP TRIGGER IF EXISTS catalog_named_history_guard ON public.%I', head_name || '_revision');
   EXECUTE format('CREATE TRIGGER catalog_named_history_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_named_history(%L)', head_name || '_revision', head_name);
  END LOOP;
  FOREACH suffix IN ARRAY ARRAY['name_source_binding','name_source_occurrence'] LOOP
   head_name := owner || '_' || suffix;
   EXECUTE format('DROP TRIGGER IF EXISTS catalog_name_source_guard ON public.%I', head_name);
   EXECUTE format('CREATE TRIGGER catalog_name_source_guard BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_name_source_identity()', head_name);
  END LOOP;
 END LOOP;
END;
$$;


CREATE OR REPLACE FUNCTION public.catalog_guard_semantic_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 RAISE EXCEPTION 'Semantic revisions and their participants are immutable' USING ERRCODE='23514', CONSTRAINT='catalog_semantic_revision_immutable';
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_governed_value()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE definition jsonb; expected_kind text; rule jsonb; parent_rule integer; vocabulary jsonb;
BEGIN
 EXECUTE format('SELECT d.constraints,d.value_kind FROM public.%I f JOIN public.catalog_definition_revision d ON d.id=f.definition_revision_id WHERE f.owner_id=$1 AND f.id=$2',TG_ARGV[0]||'_fact') INTO definition,expected_kind USING NEW.owner_id,NEW.fact_id;
 IF definition ? 'rules' THEN
  rule:=definition->'rules'->NEW.rule_position;
  IF rule IS NULL OR (rule->>'position')::integer <> NEW.rule_position THEN RAISE EXCEPTION 'Unknown value rule' USING ERRCODE='23514'; END IF;
  expected_kind:=rule->>'kind';
  IF NEW.position=0 THEN
   IF NEW.rule_position<>0 THEN RAISE EXCEPTION 'Invalid root rule' USING ERRCODE='23514'; END IF;
  ELSE
   EXECUTE format('SELECT rule_position FROM public.%I WHERE owner_id=$1 AND fact_id=$2 AND position=$3',TG_ARGV[0]||'_fact_value_node') INTO parent_rule USING NEW.owner_id,NEW.fact_id,NEW.parent_position;
   IF parent_rule IS NULL OR (rule->>'parent')::integer IS DISTINCT FROM parent_rule OR rule->>'memberKey' IS DISTINCT FROM NEW.member_key THEN RAISE EXCEPTION 'Undeclared value member' USING ERRCODE='23514'; END IF;
  END IF;
 ELSE
  rule:=definition;
  IF NEW.position<>0 THEN RAISE EXCEPTION 'Scalar definition cannot accept descendants' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.kind='null' AND coalesce((rule->>'nullable')::boolean,false) THEN RETURN NEW; END IF;
 IF NEW.kind IS DISTINCT FROM expected_kind THEN RAISE EXCEPTION 'Wrong governed value type' USING ERRCODE='23514'; END IF;
 IF NEW.kind='number' AND ((rule ? 'minimum' AND NEW.number_value<(rule->>'minimum')::numeric) OR (rule ? 'maximum' AND NEW.number_value>(rule->>'maximum')::numeric) OR (coalesce((rule->>'integer')::boolean,false) AND (trunc(NEW.number_value)<>NEW.number_value OR abs(NEW.number_value)>9007199254740991))) THEN RAISE EXCEPTION 'Governed numeric bound violated' USING ERRCODE='23514'; END IF;
 IF NEW.kind='string' AND ((rule ? 'minLength' AND length(NEW.text_value)<(rule->>'minLength')::integer) OR (rule ? 'maxLength' AND length(NEW.text_value)>(rule->>'maxLength')::integer)) THEN RAISE EXCEPTION 'Governed text bound violated' USING ERRCODE='23514'; END IF;
 IF rule ? 'allowedValues' AND NOT (rule->'allowedValues' @> jsonb_build_array(CASE NEW.kind WHEN 'string' THEN to_jsonb(NEW.text_value) WHEN 'number' THEN to_jsonb(NEW.number_value) WHEN 'boolean' THEN to_jsonb(NEW.boolean_value) ELSE 'null'::jsonb END)) THEN RAISE EXCEPTION 'Value is not a governed member' USING ERRCODE='23514'; END IF;
 IF rule ? 'vocabularyRevisionId' THEN
  SELECT constraints INTO vocabulary FROM public.catalog_definition_revision WHERE id=(rule->>'vocabularyRevisionId')::uuid;
  IF NEW.kind<>'string' OR NOT (coalesce(vocabulary->'memberRevisionIds','[]'::jsonb) ? NEW.text_value) THEN RAISE EXCEPTION 'Value is not in the exact vocabulary revision' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_sealed_semantic()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE published boolean;
BEGIN
 IF TG_ARGV[1]='fact' THEN
  IF OLD.sealed_at IS NOT NULL AND (TG_OP='DELETE' OR NEW IS DISTINCT FROM OLD) THEN RAISE EXCEPTION 'Sealed facts are immutable' USING ERRCODE='23514', CONSTRAINT='catalog_fact_value_immutable'; END IF;
  IF TG_OP='UPDATE' AND (NEW.semantic_id<>OLD.semantic_id OR NEW.expected_head_version<>OLD.expected_head_version OR NEW.spoiler<>OLD.spoiler) THEN RAISE EXCEPTION 'Staged fact identity is immutable' USING ERRCODE='23514', CONSTRAINT='catalog_fact_identity_immutable'; END IF;
  RETURN NEW;
 END IF;
 EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE owner_id=$1 AND relation_id=$2)',TG_ARGV[0]||'_semantic_revision') INTO published USING NEW.owner_id,NEW.relation_id;
 IF published THEN RAISE EXCEPTION 'Published relation cannot gain participants or qualifiers' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_guard_semantic_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE current_version bigint; target record; predicate jsonb; role jsonb; participant record; target_owner text; target_id uuid; target_shape text; role_count integer; total integer;
BEGIN
 EXECUTE format('SELECT id FROM public.%I WHERE id=$1 FOR UPDATE',TG_ARGV[0]||'_identity') USING NEW.owner_id;
 EXECUTE format('SELECT version FROM public.%I WHERE owner_id=$1 AND semantic_id=$2 FOR UPDATE',TG_ARGV[0]||'_semantic_head') INTO current_version USING NEW.owner_id,NEW.semantic_id;
 IF NEW.version<>coalesce(current_version,0)+1 THEN RAISE EXCEPTION 'Semantic head version conflict' USING ERRCODE='40001'; END IF;
 IF NEW.fact_id IS NOT NULL THEN
  EXECUTE format('SELECT semantic_id,sealed_at FROM public.%I WHERE owner_id=$1 AND id=$2',TG_ARGV[0]||'_fact') INTO target USING NEW.owner_id,NEW.fact_id;
  IF target.semantic_id IS DISTINCT FROM NEW.semantic_id OR target.sealed_at IS NULL THEN RAISE EXCEPTION 'Unsealed or wrong semantic fact' USING ERRCODE='23514'; END IF;
 ELSE
  EXECUTE format('SELECT r.semantic_id,d.constraints FROM public.%I r JOIN public.catalog_definition_revision d ON d.id=r.definition_revision_id WHERE r.owner_id=$1 AND r.id=$2',TG_ARGV[0]||'_catalog_relation') INTO target USING NEW.owner_id,NEW.relation_id;
  IF target.semantic_id IS DISTINCT FROM NEW.semantic_id THEN RAISE EXCEPTION 'Wrong semantic relation' USING ERRCODE='23514'; END IF;
  predicate:=target.constraints;
  IF jsonb_array_length(coalesce(predicate->'roles','[]'::jsonb))=0 THEN RAISE EXCEPTION 'Predicate roles missing' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM public.%I WHERE owner_id=$1 AND relation_id=$2 LIMIT 129) p',TG_ARGV[0]||'_relation_participant') INTO total USING NEW.owner_id,NEW.relation_id;
  IF total>128 THEN RAISE EXCEPTION 'Relation participant budget exceeded' USING ERRCODE='23514'; END IF;
  FOR role IN SELECT value FROM jsonb_array_elements(predicate->'roles') LOOP
   EXECUTE format('SELECT count(*) FROM public.%I WHERE owner_id=$1 AND relation_id=$2 AND role_revision_id=$3',TG_ARGV[0]||'_relation_participant') INTO role_count USING NEW.owner_id,NEW.relation_id,(role->>'roleRevisionId')::uuid;
   IF role_count<(role->>'min')::integer OR role_count>(role->>'max')::integer THEN RAISE EXCEPTION 'Predicate cardinality violated' USING ERRCODE='23514'; END IF;
  END LOOP;
  FOR participant IN EXECUTE format('SELECT to_jsonb(p) AS data FROM public.%I p WHERE owner_id=$1 AND relation_id=$2 LIMIT 129',TG_ARGV[0]||'_relation_participant') USING NEW.owner_id,NEW.relation_id LOOP
   SELECT value INTO role FROM jsonb_array_elements(predicate->'roles') WHERE value->>'roleRevisionId'=participant.data->>'role_revision_id';
   IF role IS NULL THEN RAISE EXCEPTION 'Undeclared predicate role' USING ERRCODE='23514'; END IF;
   FOREACH target_owner IN ARRAY ARRAY['publishing','music','program','software','entity','grouping','reference','distribution'] LOOP
    target_id:=(participant.data->>(target_owner||'_id'))::uuid;
    IF target_id IS NOT NULL THEN
     EXECUTE format('SELECT shape FROM public.%I WHERE id=$1',target_owner||'_identity') INTO target_shape USING target_id;
     IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(role->'targets') t WHERE t->>'owner'=target_owner AND t->'shapes' ? target_shape) THEN RAISE EXCEPTION 'Predicate target shape violated' USING ERRCODE='23514'; END IF;
    END IF;
   END LOOP;
  END LOOP;
  EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM public.%I WHERE owner_id=$1 AND relation_id=$2 LIMIT 65) q',TG_ARGV[0]||'_relation_scope') INTO total USING NEW.owner_id,NEW.relation_id;
  IF total>64 THEN RAISE EXCEPTION 'Relation qualifier budget exceeded' USING ERRCODE='23514'; END IF;
  FOR target IN EXECUTE format('SELECT q.definition_revision_id,f.definition_revision_id AS fact_definition,f.sealed_at FROM public.%I q JOIN public.%I f ON f.owner_id=q.owner_id AND f.id=q.value_fact_id WHERE q.owner_id=$1 AND q.relation_id=$2 LIMIT 65',TG_ARGV[0]||'_relation_scope',TG_ARGV[0]||'_fact') USING NEW.owner_id,NEW.relation_id LOOP
   IF NOT (coalesce(predicate->'qualifierRevisionIds','[]'::jsonb) ? target.definition_revision_id::text) OR target.fact_definition<>target.definition_revision_id OR target.sealed_at IS NULL THEN RAISE EXCEPTION 'Undeclared or unsealed relation qualifier' USING ERRCODE='23514'; END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_require_semantic_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE current_version bigint;
BEGIN
 EXECUTE format('SELECT version FROM public.%I WHERE owner_id=$1 AND semantic_id=$2',TG_ARGV[0]||'_semantic_head') INTO current_version USING NEW.owner_id,NEW.semantic_id;
 IF current_version IS NULL OR current_version<NEW.version THEN RAISE EXCEPTION 'Immutable semantic revision must publish an atomic head' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS publishing_semantic_revision_immutable ON public.publishing_semantic_revision;
CREATE TRIGGER publishing_semantic_revision_immutable BEFORE UPDATE OR DELETE ON public.publishing_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS publishing_catalog_relation_immutable ON public.publishing_catalog_relation;
CREATE TRIGGER publishing_catalog_relation_immutable BEFORE UPDATE OR DELETE ON public.publishing_catalog_relation FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS publishing_relation_participant_immutable ON public.publishing_relation_participant;
CREATE TRIGGER publishing_relation_participant_immutable BEFORE UPDATE OR DELETE ON public.publishing_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS publishing_relation_scope_immutable ON public.publishing_relation_scope;
CREATE TRIGGER publishing_relation_scope_immutable BEFORE UPDATE OR DELETE ON public.publishing_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS publishing_fact_value_node_governance ON public.publishing_fact_value_node;
CREATE TRIGGER publishing_fact_value_node_governance BEFORE INSERT ON public.publishing_fact_value_node FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_governed_value('publishing');

DROP TRIGGER IF EXISTS publishing_fact_sealed_semantic ON public.publishing_fact;
CREATE TRIGGER publishing_fact_sealed_semantic BEFORE UPDATE OR DELETE ON public.publishing_fact FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('publishing','fact');

DROP TRIGGER IF EXISTS publishing_relation_participant_sealed_semantic ON public.publishing_relation_participant;
CREATE TRIGGER publishing_relation_participant_sealed_semantic BEFORE INSERT ON public.publishing_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('publishing','relation');

DROP TRIGGER IF EXISTS publishing_relation_scope_sealed_semantic ON public.publishing_relation_scope;
CREATE TRIGGER publishing_relation_scope_sealed_semantic BEFORE INSERT ON public.publishing_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('publishing','relation');

DROP TRIGGER IF EXISTS publishing_semantic_revision_governance ON public.publishing_semantic_revision;
CREATE TRIGGER publishing_semantic_revision_governance BEFORE INSERT ON public.publishing_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_revision('publishing');

DROP TRIGGER IF EXISTS publishing_semantic_revision_head ON public.publishing_semantic_revision;
CREATE CONSTRAINT TRIGGER publishing_semantic_revision_head AFTER INSERT ON public.publishing_semantic_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_semantic_head('publishing');

DROP TRIGGER IF EXISTS music_semantic_revision_immutable ON public.music_semantic_revision;
CREATE TRIGGER music_semantic_revision_immutable BEFORE UPDATE OR DELETE ON public.music_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS music_catalog_relation_immutable ON public.music_catalog_relation;
CREATE TRIGGER music_catalog_relation_immutable BEFORE UPDATE OR DELETE ON public.music_catalog_relation FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS music_relation_participant_immutable ON public.music_relation_participant;
CREATE TRIGGER music_relation_participant_immutable BEFORE UPDATE OR DELETE ON public.music_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS music_relation_scope_immutable ON public.music_relation_scope;
CREATE TRIGGER music_relation_scope_immutable BEFORE UPDATE OR DELETE ON public.music_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS music_fact_value_node_governance ON public.music_fact_value_node;
CREATE TRIGGER music_fact_value_node_governance BEFORE INSERT ON public.music_fact_value_node FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_governed_value('music');

DROP TRIGGER IF EXISTS music_fact_sealed_semantic ON public.music_fact;
CREATE TRIGGER music_fact_sealed_semantic BEFORE UPDATE OR DELETE ON public.music_fact FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('music','fact');

DROP TRIGGER IF EXISTS music_relation_participant_sealed_semantic ON public.music_relation_participant;
CREATE TRIGGER music_relation_participant_sealed_semantic BEFORE INSERT ON public.music_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('music','relation');

DROP TRIGGER IF EXISTS music_relation_scope_sealed_semantic ON public.music_relation_scope;
CREATE TRIGGER music_relation_scope_sealed_semantic BEFORE INSERT ON public.music_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('music','relation');

DROP TRIGGER IF EXISTS music_semantic_revision_governance ON public.music_semantic_revision;
CREATE TRIGGER music_semantic_revision_governance BEFORE INSERT ON public.music_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_revision('music');

DROP TRIGGER IF EXISTS music_semantic_revision_head ON public.music_semantic_revision;
CREATE CONSTRAINT TRIGGER music_semantic_revision_head AFTER INSERT ON public.music_semantic_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_semantic_head('music');

DROP TRIGGER IF EXISTS program_semantic_revision_immutable ON public.program_semantic_revision;
CREATE TRIGGER program_semantic_revision_immutable BEFORE UPDATE OR DELETE ON public.program_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS program_catalog_relation_immutable ON public.program_catalog_relation;
CREATE TRIGGER program_catalog_relation_immutable BEFORE UPDATE OR DELETE ON public.program_catalog_relation FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS program_relation_participant_immutable ON public.program_relation_participant;
CREATE TRIGGER program_relation_participant_immutable BEFORE UPDATE OR DELETE ON public.program_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS program_relation_scope_immutable ON public.program_relation_scope;
CREATE TRIGGER program_relation_scope_immutable BEFORE UPDATE OR DELETE ON public.program_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS program_fact_value_node_governance ON public.program_fact_value_node;
CREATE TRIGGER program_fact_value_node_governance BEFORE INSERT ON public.program_fact_value_node FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_governed_value('program');

DROP TRIGGER IF EXISTS program_fact_sealed_semantic ON public.program_fact;
CREATE TRIGGER program_fact_sealed_semantic BEFORE UPDATE OR DELETE ON public.program_fact FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('program','fact');

DROP TRIGGER IF EXISTS program_relation_participant_sealed_semantic ON public.program_relation_participant;
CREATE TRIGGER program_relation_participant_sealed_semantic BEFORE INSERT ON public.program_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('program','relation');

DROP TRIGGER IF EXISTS program_relation_scope_sealed_semantic ON public.program_relation_scope;
CREATE TRIGGER program_relation_scope_sealed_semantic BEFORE INSERT ON public.program_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('program','relation');

DROP TRIGGER IF EXISTS program_semantic_revision_governance ON public.program_semantic_revision;
CREATE TRIGGER program_semantic_revision_governance BEFORE INSERT ON public.program_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_revision('program');

DROP TRIGGER IF EXISTS program_semantic_revision_head ON public.program_semantic_revision;
CREATE CONSTRAINT TRIGGER program_semantic_revision_head AFTER INSERT ON public.program_semantic_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_semantic_head('program');

DROP TRIGGER IF EXISTS software_semantic_revision_immutable ON public.software_semantic_revision;
CREATE TRIGGER software_semantic_revision_immutable BEFORE UPDATE OR DELETE ON public.software_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS software_catalog_relation_immutable ON public.software_catalog_relation;
CREATE TRIGGER software_catalog_relation_immutable BEFORE UPDATE OR DELETE ON public.software_catalog_relation FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS software_relation_participant_immutable ON public.software_relation_participant;
CREATE TRIGGER software_relation_participant_immutable BEFORE UPDATE OR DELETE ON public.software_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS software_relation_scope_immutable ON public.software_relation_scope;
CREATE TRIGGER software_relation_scope_immutable BEFORE UPDATE OR DELETE ON public.software_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS software_fact_value_node_governance ON public.software_fact_value_node;
CREATE TRIGGER software_fact_value_node_governance BEFORE INSERT ON public.software_fact_value_node FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_governed_value('software');

DROP TRIGGER IF EXISTS software_fact_sealed_semantic ON public.software_fact;
CREATE TRIGGER software_fact_sealed_semantic BEFORE UPDATE OR DELETE ON public.software_fact FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('software','fact');

DROP TRIGGER IF EXISTS software_relation_participant_sealed_semantic ON public.software_relation_participant;
CREATE TRIGGER software_relation_participant_sealed_semantic BEFORE INSERT ON public.software_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('software','relation');

DROP TRIGGER IF EXISTS software_relation_scope_sealed_semantic ON public.software_relation_scope;
CREATE TRIGGER software_relation_scope_sealed_semantic BEFORE INSERT ON public.software_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('software','relation');

DROP TRIGGER IF EXISTS software_semantic_revision_governance ON public.software_semantic_revision;
CREATE TRIGGER software_semantic_revision_governance BEFORE INSERT ON public.software_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_revision('software');

DROP TRIGGER IF EXISTS software_semantic_revision_head ON public.software_semantic_revision;
CREATE CONSTRAINT TRIGGER software_semantic_revision_head AFTER INSERT ON public.software_semantic_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_semantic_head('software');

DROP TRIGGER IF EXISTS entity_semantic_revision_immutable ON public.entity_semantic_revision;
CREATE TRIGGER entity_semantic_revision_immutable BEFORE UPDATE OR DELETE ON public.entity_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS entity_catalog_relation_immutable ON public.entity_catalog_relation;
CREATE TRIGGER entity_catalog_relation_immutable BEFORE UPDATE OR DELETE ON public.entity_catalog_relation FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS entity_relation_participant_immutable ON public.entity_relation_participant;
CREATE TRIGGER entity_relation_participant_immutable BEFORE UPDATE OR DELETE ON public.entity_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS entity_relation_scope_immutable ON public.entity_relation_scope;
CREATE TRIGGER entity_relation_scope_immutable BEFORE UPDATE OR DELETE ON public.entity_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS entity_fact_value_node_governance ON public.entity_fact_value_node;
CREATE TRIGGER entity_fact_value_node_governance BEFORE INSERT ON public.entity_fact_value_node FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_governed_value('entity');

DROP TRIGGER IF EXISTS entity_fact_sealed_semantic ON public.entity_fact;
CREATE TRIGGER entity_fact_sealed_semantic BEFORE UPDATE OR DELETE ON public.entity_fact FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('entity','fact');

DROP TRIGGER IF EXISTS entity_relation_participant_sealed_semantic ON public.entity_relation_participant;
CREATE TRIGGER entity_relation_participant_sealed_semantic BEFORE INSERT ON public.entity_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('entity','relation');

DROP TRIGGER IF EXISTS entity_relation_scope_sealed_semantic ON public.entity_relation_scope;
CREATE TRIGGER entity_relation_scope_sealed_semantic BEFORE INSERT ON public.entity_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('entity','relation');

DROP TRIGGER IF EXISTS entity_semantic_revision_governance ON public.entity_semantic_revision;
CREATE TRIGGER entity_semantic_revision_governance BEFORE INSERT ON public.entity_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_revision('entity');

DROP TRIGGER IF EXISTS entity_semantic_revision_head ON public.entity_semantic_revision;
CREATE CONSTRAINT TRIGGER entity_semantic_revision_head AFTER INSERT ON public.entity_semantic_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_semantic_head('entity');

DROP TRIGGER IF EXISTS grouping_semantic_revision_immutable ON public.grouping_semantic_revision;
CREATE TRIGGER grouping_semantic_revision_immutable BEFORE UPDATE OR DELETE ON public.grouping_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS grouping_catalog_relation_immutable ON public.grouping_catalog_relation;
CREATE TRIGGER grouping_catalog_relation_immutable BEFORE UPDATE OR DELETE ON public.grouping_catalog_relation FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS grouping_relation_participant_immutable ON public.grouping_relation_participant;
CREATE TRIGGER grouping_relation_participant_immutable BEFORE UPDATE OR DELETE ON public.grouping_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS grouping_relation_scope_immutable ON public.grouping_relation_scope;
CREATE TRIGGER grouping_relation_scope_immutable BEFORE UPDATE OR DELETE ON public.grouping_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS grouping_fact_value_node_governance ON public.grouping_fact_value_node;
CREATE TRIGGER grouping_fact_value_node_governance BEFORE INSERT ON public.grouping_fact_value_node FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_governed_value('grouping');

DROP TRIGGER IF EXISTS grouping_fact_sealed_semantic ON public.grouping_fact;
CREATE TRIGGER grouping_fact_sealed_semantic BEFORE UPDATE OR DELETE ON public.grouping_fact FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('grouping','fact');

DROP TRIGGER IF EXISTS grouping_relation_participant_sealed_semantic ON public.grouping_relation_participant;
CREATE TRIGGER grouping_relation_participant_sealed_semantic BEFORE INSERT ON public.grouping_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('grouping','relation');

DROP TRIGGER IF EXISTS grouping_relation_scope_sealed_semantic ON public.grouping_relation_scope;
CREATE TRIGGER grouping_relation_scope_sealed_semantic BEFORE INSERT ON public.grouping_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('grouping','relation');

DROP TRIGGER IF EXISTS grouping_semantic_revision_governance ON public.grouping_semantic_revision;
CREATE TRIGGER grouping_semantic_revision_governance BEFORE INSERT ON public.grouping_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_revision('grouping');

DROP TRIGGER IF EXISTS grouping_semantic_revision_head ON public.grouping_semantic_revision;
CREATE CONSTRAINT TRIGGER grouping_semantic_revision_head AFTER INSERT ON public.grouping_semantic_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_semantic_head('grouping');

DROP TRIGGER IF EXISTS reference_semantic_revision_immutable ON public.reference_semantic_revision;
CREATE TRIGGER reference_semantic_revision_immutable BEFORE UPDATE OR DELETE ON public.reference_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS reference_catalog_relation_immutable ON public.reference_catalog_relation;
CREATE TRIGGER reference_catalog_relation_immutable BEFORE UPDATE OR DELETE ON public.reference_catalog_relation FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS reference_relation_participant_immutable ON public.reference_relation_participant;
CREATE TRIGGER reference_relation_participant_immutable BEFORE UPDATE OR DELETE ON public.reference_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS reference_relation_scope_immutable ON public.reference_relation_scope;
CREATE TRIGGER reference_relation_scope_immutable BEFORE UPDATE OR DELETE ON public.reference_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS reference_fact_value_node_governance ON public.reference_fact_value_node;
CREATE TRIGGER reference_fact_value_node_governance BEFORE INSERT ON public.reference_fact_value_node FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_governed_value('reference');

DROP TRIGGER IF EXISTS reference_fact_sealed_semantic ON public.reference_fact;
CREATE TRIGGER reference_fact_sealed_semantic BEFORE UPDATE OR DELETE ON public.reference_fact FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('reference','fact');

DROP TRIGGER IF EXISTS reference_relation_participant_sealed_semantic ON public.reference_relation_participant;
CREATE TRIGGER reference_relation_participant_sealed_semantic BEFORE INSERT ON public.reference_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('reference','relation');

DROP TRIGGER IF EXISTS reference_relation_scope_sealed_semantic ON public.reference_relation_scope;
CREATE TRIGGER reference_relation_scope_sealed_semantic BEFORE INSERT ON public.reference_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('reference','relation');

DROP TRIGGER IF EXISTS reference_semantic_revision_governance ON public.reference_semantic_revision;
CREATE TRIGGER reference_semantic_revision_governance BEFORE INSERT ON public.reference_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_revision('reference');

DROP TRIGGER IF EXISTS reference_semantic_revision_head ON public.reference_semantic_revision;
CREATE CONSTRAINT TRIGGER reference_semantic_revision_head AFTER INSERT ON public.reference_semantic_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_semantic_head('reference');

DROP TRIGGER IF EXISTS distribution_semantic_revision_immutable ON public.distribution_semantic_revision;
CREATE TRIGGER distribution_semantic_revision_immutable BEFORE UPDATE OR DELETE ON public.distribution_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS distribution_catalog_relation_immutable ON public.distribution_catalog_relation;
CREATE TRIGGER distribution_catalog_relation_immutable BEFORE UPDATE OR DELETE ON public.distribution_catalog_relation FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS distribution_relation_participant_immutable ON public.distribution_relation_participant;
CREATE TRIGGER distribution_relation_participant_immutable BEFORE UPDATE OR DELETE ON public.distribution_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS distribution_relation_scope_immutable ON public.distribution_relation_scope;
CREATE TRIGGER distribution_relation_scope_immutable BEFORE UPDATE OR DELETE ON public.distribution_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_immutable();

DROP TRIGGER IF EXISTS distribution_fact_value_node_governance ON public.distribution_fact_value_node;
CREATE TRIGGER distribution_fact_value_node_governance BEFORE INSERT ON public.distribution_fact_value_node FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_governed_value('distribution');

DROP TRIGGER IF EXISTS distribution_fact_sealed_semantic ON public.distribution_fact;
CREATE TRIGGER distribution_fact_sealed_semantic BEFORE UPDATE OR DELETE ON public.distribution_fact FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('distribution','fact');

DROP TRIGGER IF EXISTS distribution_relation_participant_sealed_semantic ON public.distribution_relation_participant;
CREATE TRIGGER distribution_relation_participant_sealed_semantic BEFORE INSERT ON public.distribution_relation_participant FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('distribution','relation');

DROP TRIGGER IF EXISTS distribution_relation_scope_sealed_semantic ON public.distribution_relation_scope;
CREATE TRIGGER distribution_relation_scope_sealed_semantic BEFORE INSERT ON public.distribution_relation_scope FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_sealed_semantic('distribution','relation');

DROP TRIGGER IF EXISTS distribution_semantic_revision_governance ON public.distribution_semantic_revision;
CREATE TRIGGER distribution_semantic_revision_governance BEFORE INSERT ON public.distribution_semantic_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_revision('distribution');

DROP TRIGGER IF EXISTS distribution_semantic_revision_head ON public.distribution_semantic_revision;
CREATE CONSTRAINT TRIGGER distribution_semantic_revision_head AFTER INSERT ON public.distribution_semantic_revision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_require_semantic_head('distribution');
CREATE OR REPLACE FUNCTION public.catalog_guard_semantic_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND (NEW.owner_id<>OLD.owner_id OR NEW.semantic_id<>OLD.semantic_id OR NEW.version<>OLD.version+1)) OR (TG_OP='INSERT' AND NEW.version<>1) THEN RAISE EXCEPTION 'Semantic head must advance one immutable revision' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS publishing_semantic_head_governance ON public.publishing_semantic_head;
CREATE TRIGGER publishing_semantic_head_governance BEFORE INSERT OR UPDATE OR DELETE ON public.publishing_semantic_head FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_head();

DROP TRIGGER IF EXISTS music_semantic_head_governance ON public.music_semantic_head;
CREATE TRIGGER music_semantic_head_governance BEFORE INSERT OR UPDATE OR DELETE ON public.music_semantic_head FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_head();

DROP TRIGGER IF EXISTS program_semantic_head_governance ON public.program_semantic_head;
CREATE TRIGGER program_semantic_head_governance BEFORE INSERT OR UPDATE OR DELETE ON public.program_semantic_head FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_head();

DROP TRIGGER IF EXISTS software_semantic_head_governance ON public.software_semantic_head;
CREATE TRIGGER software_semantic_head_governance BEFORE INSERT OR UPDATE OR DELETE ON public.software_semantic_head FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_head();

DROP TRIGGER IF EXISTS entity_semantic_head_governance ON public.entity_semantic_head;
CREATE TRIGGER entity_semantic_head_governance BEFORE INSERT OR UPDATE OR DELETE ON public.entity_semantic_head FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_head();

DROP TRIGGER IF EXISTS grouping_semantic_head_governance ON public.grouping_semantic_head;
CREATE TRIGGER grouping_semantic_head_governance BEFORE INSERT OR UPDATE OR DELETE ON public.grouping_semantic_head FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_head();

DROP TRIGGER IF EXISTS reference_semantic_head_governance ON public.reference_semantic_head;
CREATE TRIGGER reference_semantic_head_governance BEFORE INSERT OR UPDATE OR DELETE ON public.reference_semantic_head FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_head();

DROP TRIGGER IF EXISTS distribution_semantic_head_governance ON public.distribution_semantic_head;
CREATE TRIGGER distribution_semantic_head_governance BEFORE INSERT OR UPDATE OR DELETE ON public.distribution_semantic_head FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_semantic_head();

CREATE OR REPLACE FUNCTION public.catalog_guard_definition_constraints()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE kind text; rule jsonb; role jsonb; reference_id text; reference_kind text; rule_position integer:=0; parent_rule jsonb;
BEGIN
 SELECT d.kind INTO kind FROM public.catalog_definition d WHERE d.id=NEW.definition_id;
 IF kind='predicate' AND (jsonb_typeof(NEW.constraints->'roles') IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.constraints->'roles') NOT BETWEEN 1 AND 32) THEN RAISE EXCEPTION 'Predicate needs bounded roles' USING ERRCODE='23514'; END IF;
 IF NEW.value_kind IN ('object','array') AND (jsonb_typeof(NEW.constraints->'rules') IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.constraints->'rules') NOT BETWEEN 1 AND 128) THEN RAISE EXCEPTION 'Structured property needs bounded grammar' USING ERRCODE='23514'; END IF;
 FOR rule IN SELECT value FROM jsonb_array_elements(coalesce(NEW.constraints->'rules','[]'::jsonb)) LOOP
  IF (rule->>'position')::integer IS DISTINCT FROM rule_position OR (rule_position=0 AND (rule->>'parent' IS NOT NULL OR rule->>'memberKey' IS NOT NULL OR rule->>'kind'<>NEW.value_kind)) OR (rule_position>0 AND ((rule->>'parent')::integer IS NULL OR (rule->>'parent')::integer NOT BETWEEN 0 AND rule_position-1)) THEN RAISE EXCEPTION 'Invalid governed grammar order' USING ERRCODE='23514'; END IF;
  IF rule_position>0 THEN
   parent_rule:=NEW.constraints->'rules'->((rule->>'parent')::integer);
   IF parent_rule->>'kind' NOT IN ('object','array') OR (parent_rule->>'kind'='array')<>(rule->>'memberKey' IS NULL) THEN RAISE EXCEPTION 'Governed grammar parent mismatch' USING ERRCODE='23514'; END IF;
  END IF;
  rule_position:=rule_position+1;
 END LOOP;
 FOR role IN SELECT value FROM jsonb_array_elements(coalesce(NEW.constraints->'roles','[]'::jsonb)) LOOP
  SELECT d.kind INTO reference_kind FROM public.catalog_definition_revision r JOIN public.catalog_definition d ON d.id=r.definition_id WHERE r.id=(role->>'roleRevisionId')::uuid;
  IF reference_kind IS DISTINCT FROM 'role' OR role->>'min' IS NULL OR role->>'max' IS NULL OR (role->>'min')::integer NOT BETWEEN 0 AND 128 OR (role->>'max')::integer NOT BETWEEN 1 AND 128 OR (role->>'min')::integer>(role->>'max')::integer THEN RAISE EXCEPTION 'Invalid governed predicate role' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR reference_id IN SELECT value FROM jsonb_array_elements_text(coalesce(NEW.constraints->'qualifierRevisionIds','[]'::jsonb)) LOOP
  SELECT d.kind INTO reference_kind FROM public.catalog_definition_revision r JOIN public.catalog_definition d ON d.id=r.definition_id WHERE r.id=reference_id::uuid;
  IF reference_kind IS DISTINCT FROM 'property' THEN RAISE EXCEPTION 'Qualifier must name a property revision' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR reference_id IN SELECT value FROM jsonb_array_elements_text(coalesce(NEW.constraints->'memberRevisionIds','[]'::jsonb)) LOOP
  SELECT d.kind INTO reference_kind FROM public.catalog_definition_revision r JOIN public.catalog_definition d ON d.id=r.definition_id WHERE r.id=reference_id::uuid;
  IF reference_kind IS NULL OR reference_kind NOT IN ('class','vocabulary') THEN RAISE EXCEPTION 'Vocabulary member must exist as a governed meaning' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR reference_id IN SELECT v FROM (SELECT NEW.constraints->>'vocabularyRevisionId' AS v UNION SELECT value->>'vocabularyRevisionId' FROM jsonb_array_elements(coalesce(NEW.constraints->'rules','[]'::jsonb))) q WHERE v IS NOT NULL LOOP
  SELECT d.kind INTO reference_kind FROM public.catalog_definition_revision r JOIN public.catalog_definition d ON d.id=r.definition_id WHERE r.id=reference_id::uuid;
  IF reference_kind IS DISTINCT FROM 'vocabulary' THEN RAISE EXCEPTION 'Vocabulary reference must name a vocabulary revision' USING ERRCODE='23514'; END IF;
 END LOOP;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS catalog_definition_revision_governance ON public.catalog_definition_revision;
CREATE TRIGGER catalog_definition_revision_governance BEFORE INSERT ON public.catalog_definition_revision FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_definition_constraints();


-- Software state is constrained in native columns before its immutable history is captured.
CREATE OR REPLACE FUNCTION public.capture_software_record_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE owner_revision bigint;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.identity_shape IS DISTINCT FROM OLD.identity_shape OR (TG_TABLE_NAME = 'software_version' AND to_jsonb(NEW)->'content_id' IS DISTINCT FROM to_jsonb(OLD)->'content_id')) THEN
    RAISE EXCEPTION 'software identity and content ownership are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;
  SELECT revision INTO STRICT owner_revision FROM public.software_identity WHERE id = NEW.id FOR UPDATE;
  INSERT INTO public.software_record_revision(owner_id, revision, shape, value)
  VALUES (NEW.id, owner_revision, NEW.identity_shape, to_jsonb(NEW));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.reject_software_revision_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'software history is written only by native capture triggers' USING ERRCODE = '23514';
END $$;

DROP TRIGGER IF EXISTS software_content_history ON public.software_content;
CREATE TRIGGER software_content_history AFTER INSERT OR UPDATE ON public.software_content
FOR EACH ROW EXECUTE FUNCTION public.capture_software_record_revision();
DROP TRIGGER IF EXISTS software_version_history ON public.software_version;
CREATE TRIGGER software_version_history AFTER INSERT OR UPDATE ON public.software_version
FOR EACH ROW EXECUTE FUNCTION public.capture_software_record_revision();
DROP TRIGGER IF EXISTS software_release_history ON public.software_release;
CREATE TRIGGER software_release_history AFTER INSERT OR UPDATE ON public.software_release
FOR EACH ROW EXECUTE FUNCTION public.capture_software_record_revision();
DROP TRIGGER IF EXISTS software_record_revision_immutable ON public.software_record_revision;
CREATE TRIGGER software_record_revision_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.software_record_revision
FOR EACH ROW EXECUTE FUNCTION public.reject_software_revision_mutation();

CREATE OR REPLACE FUNCTION public.capture_software_component_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v jsonb; owner_revision bigint; component_id text;
BEGIN
  IF TG_OP = 'UPDATE' AND to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;
  v := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  component_id := v ->> TG_ARGV[1];
  SELECT revision INTO STRICT owner_revision FROM public.software_identity WHERE id = (v ->> 'release_id')::uuid FOR UPDATE;
  INSERT INTO public.software_component_revision(release_id, kind, component_id, revision, operation, value)
  VALUES ((v ->> 'release_id')::uuid, TG_ARGV[0], component_id, owner_revision, CASE WHEN TG_OP = 'DELETE' THEN 'remove' ELSE 'put' END, v);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

DROP TRIGGER IF EXISTS software_component_revision_immutable ON public.software_component_revision;
CREATE TRIGGER software_component_revision_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.software_component_revision
FOR EACH ROW EXECUTE FUNCTION public.reject_software_revision_mutation();
DO $$
DECLARE entry text[];
BEGIN
  FOREACH entry SLICE 1 IN ARRAY ARRAY[
    ['software_release_content','content','id'], ['software_release_platform','platform','platform_revision_id'],
    ['software_release_medium','medium','id'], ['software_release_language','language','id'],
    ['software_release_event','event','id'], ['software_patch_target','patch_target','base_release_id'],
    ['software_release_animation','animation','context']
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS software_component_history ON public.%I', entry[1]);
    EXECUTE format('CREATE TRIGGER software_component_history AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.capture_software_component_revision(%L,%L)', entry[1], entry[2], entry[3]);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_software_patch_target() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'software_patch_target' THEN
    IF NOT EXISTS (SELECT 1 FROM public.software_release WHERE id = NEW.release_id AND is_patch IS TRUE FOR SHARE) THEN
      RAISE EXCEPTION 'only a patch can declare applicable base releases' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.is_patch IS DISTINCT FROM TRUE AND EXISTS (SELECT 1 FROM public.software_patch_target WHERE release_id = NEW.id LIMIT 1) THEN
    RAISE EXCEPTION 'release with patch targets must remain a patch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS software_patch_target_kind ON public.software_patch_target;
CREATE TRIGGER software_patch_target_kind BEFORE INSERT OR UPDATE ON public.software_patch_target
FOR EACH ROW EXECUTE FUNCTION public.enforce_software_patch_target();
DROP TRIGGER IF EXISTS software_release_patch_kind ON public.software_release;
CREATE TRIGGER software_release_patch_kind BEFORE UPDATE OF is_patch ON public.software_release
FOR EACH ROW EXECUTE FUNCTION public.enforce_software_patch_target();


CREATE OR REPLACE FUNCTION public.catalog_source_guard_record()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND
    (NEW.id <> OLD.id OR NEW.source <> OLD.source OR NEW.object_type <> OLD.object_type OR
     NEW.external_id <> OLD.external_id OR NEW.acquisition_generation < OLD.acquisition_generation OR
     NEW.accepted_generation < OLD.accepted_generation)) THEN
    RAISE EXCEPTION 'Source natural identity is immutable and acquisition generations cannot regress'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_identity_immutable';
  END IF;
  IF NEW.head_snapshot_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.catalog_source_snapshot WHERE source_record_id = NEW.id AND id = NEW.head_snapshot_id
  ) THEN
    RAISE EXCEPTION 'Source head must reference its own immutable snapshot'
      USING ERRCODE = '23503', CONSTRAINT = 'catalog_source_exact_head';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_source_guard_immutable_evidence()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'Source snapshots, binding revisions and completed check receipts are immutable'
    USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_evidence_immutable';
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_source_guard_mapping()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND
    (NEW.source_record_id <> OLD.source_record_id OR NEW.path <> OLD.path OR
     NEW.mapping_key <> OLD.mapping_key OR NEW.owner <> OLD.owner OR
     NEW.binding_revision < OLD.binding_revision OR NEW.binding_revision > OLD.binding_revision + 1 OR
     NEW.policy_revision < OLD.policy_revision OR
     ((NEW.state <> OLD.state OR NEW.policy_revision <> OLD.policy_revision) AND NEW.binding_revision <> OLD.binding_revision + 1))) THEN
    RAISE EXCEPTION 'Source mapping identity is immutable and authority edits require the next revision'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_mapping_transition';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_source_require_binding_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE claim public.catalog_source_mapping_claim%ROWTYPE; binding_row public.catalog_source_binding_revision%ROWTYPE; native_target uuid;
BEGIN
  SELECT * INTO claim FROM public.catalog_source_mapping_claim
    WHERE source_record_id = NEW.source_record_id AND mapping_key = NEW.mapping_key;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF to_jsonb(NEW) ? 'revision' AND (to_jsonb(NEW)->>'revision')::bigint > claim.binding_revision THEN
    RAISE EXCEPTION 'An appended source binding revision must be published in its transaction'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_binding_revision_published';
  END IF;
  SELECT r.* INTO binding_row FROM public.catalog_source_binding_revision r
    WHERE r.source_record_id = claim.source_record_id AND r.mapping_key = claim.mapping_key AND r.revision = claim.binding_revision;
  IF NOT FOUND OR binding_row.owner <> claim.owner OR binding_row.policy_revision <> claim.policy_revision OR binding_row.state <> claim.state THEN
    RAISE EXCEPTION 'Source mapping must commit its exact immutable binding and policy revision'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_binding_head_required';
  END IF;
  EXECUTE format('SELECT owner_id FROM public.%I WHERE source_record_id = $1 AND mapping_key = $2', claim.owner || '_source_binding')
    INTO native_target USING claim.source_record_id, claim.mapping_key;
  IF native_target IS NULL OR native_target IS DISTINCT FROM (to_jsonb(binding_row)->>(claim.owner || '_id'))::uuid THEN
    RAISE EXCEPTION 'Source binding target must equal its committed revision target'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_source_binding_exact_target';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS catalog_source_record_guard ON public.catalog_source_record;
CREATE TRIGGER catalog_source_record_guard BEFORE INSERT OR UPDATE OR DELETE ON public.catalog_source_record
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_record();
DROP TRIGGER IF EXISTS catalog_source_mapping_guard ON public.catalog_source_mapping_claim;
CREATE TRIGGER catalog_source_mapping_guard BEFORE UPDATE OR DELETE ON public.catalog_source_mapping_claim
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_mapping();

DO $$
DECLARE relation_name text; physical record;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['catalog_source_snapshot', 'catalog_source_binding_revision', 'catalog_source_check_receipt'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_evidence_guard ON public.%I', relation_name);
    EXECUTE format('CREATE TRIGGER catalog_source_evidence_guard BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_immutable_evidence()', relation_name);
  END LOOP;
  -- Constraint triggers are installed on concrete leaves, including an unpartitioned fresh target.
  FOR physical IN
    WITH RECURSIVE roots AS (
      SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('catalog_source_mapping_claim','catalog_source_binding_revision','publishing_source_binding','music_source_binding','program_source_binding','software_source_binding','entity_source_binding','grouping_source_binding','reference_source_binding','distribution_source_binding')
      UNION ALL SELECT i.inhrelid FROM pg_inherits i JOIN roots r ON r.oid=i.inhparent
    ) SELECT c.oid::regclass AS name FROM roots r JOIN pg_class c ON c.oid=r.oid WHERE c.relkind='r'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_binding_head_required ON %s', physical.name);
    EXECUTE format('CREATE CONSTRAINT TRIGGER catalog_source_binding_head_required AFTER INSERT OR UPDATE ON %s DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_source_require_binding_head()', physical.name);
  END LOOP;
END;
$$;


CREATE OR REPLACE FUNCTION public.catalog_guard_supporting_revision()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE owner_revision bigint;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Supporting catalog history is append-only'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_supporting_history_immutable';
  END IF;
  EXECUTE format('SELECT revision FROM public.%I WHERE id = $1', TG_ARGV[0])
    INTO owner_revision USING NEW.owner_id;
  IF owner_revision IS DISTINCT FROM NEW.revision THEN
    RAISE EXCEPTION 'Supporting catalog revision must match its current owner revision'
      USING ERRCODE = '23514', CONSTRAINT = 'catalog_supporting_revision_head_check';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entity_catalog_profile_revision_guard ON public.entity_catalog_profile_revision;
CREATE TRIGGER entity_catalog_profile_revision_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.entity_catalog_profile_revision
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_revision('entity_identity');

DROP TRIGGER IF EXISTS reference_catalog_profile_revision_guard ON public.reference_catalog_profile_revision;
CREATE TRIGGER reference_catalog_profile_revision_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.reference_catalog_profile_revision
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_revision('reference_identity');

DROP TRIGGER IF EXISTS grouping_command_revision_guard ON public.grouping_command_revision;
CREATE TRIGGER grouping_command_revision_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.grouping_command_revision
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_revision('grouping_identity');

CREATE OR REPLACE FUNCTION public.catalog_guard_supporting_classification()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE field_name text; revision_id uuid; definition_kind text;
BEGIN
  FOREACH field_name IN ARRAY TG_ARGV LOOP
    revision_id := (to_jsonb(NEW) ->> field_name)::uuid;
    IF revision_id IS NULL THEN CONTINUE; END IF;
    SELECT d.kind INTO definition_kind FROM public.catalog_definition_revision r
      JOIN public.catalog_definition d ON d.id = r.definition_id WHERE r.id = revision_id;
    IF definition_kind IS NULL OR
       (field_name = 'class_revision_id' AND definition_kind <> 'class') OR
       (field_name = 'gender_revision_id' AND definition_kind <> 'vocabulary') OR
       (field_name = 'type_revision_id' AND definition_kind NOT IN ('class', 'vocabulary')) THEN
      RAISE EXCEPTION 'Supporting catalog classification has an incompatible definition kind'
        USING ERRCODE = '23514', CONSTRAINT = 'catalog_supporting_classification_kind_check';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entity_catalog_profile_classification_guard ON public.entity_catalog_profile;
CREATE TRIGGER entity_catalog_profile_classification_guard BEFORE INSERT OR UPDATE ON public.entity_catalog_profile
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_classification('type_revision_id', 'gender_revision_id');
DROP TRIGGER IF EXISTS reference_area_classification_guard ON public.reference_area;
CREATE TRIGGER reference_area_classification_guard BEFORE INSERT OR UPDATE ON public.reference_area
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_classification('type_revision_id');
DROP TRIGGER IF EXISTS reference_place_classification_guard ON public.reference_place;
CREATE TRIGGER reference_place_classification_guard BEFORE INSERT OR UPDATE ON public.reference_place
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_classification('type_revision_id');
DROP TRIGGER IF EXISTS reference_event_classification_guard ON public.reference_event;
CREATE TRIGGER reference_event_classification_guard BEFORE INSERT OR UPDATE ON public.reference_event
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_classification('type_revision_id');
DROP TRIGGER IF EXISTS reference_instrument_classification_guard ON public.reference_instrument;
CREATE TRIGGER reference_instrument_classification_guard BEFORE INSERT OR UPDATE ON public.reference_instrument
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_classification('type_revision_id');
DROP TRIGGER IF EXISTS reference_concept_classification_guard ON public.reference_concept;
CREATE TRIGGER reference_concept_classification_guard BEFORE INSERT OR UPDATE ON public.reference_concept
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_classification('type_revision_id');
DROP TRIGGER IF EXISTS grouping_class_assignment_classification_guard ON public.grouping_class_assignment;
CREATE TRIGGER grouping_class_assignment_classification_guard BEFORE INSERT OR UPDATE ON public.grouping_class_assignment
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_supporting_classification('class_revision_id');


CREATE OR REPLACE FUNCTION public.operational_enqueue_relay()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.operational_relay_pending(routing_bucket,message_id,message_class,routing_epoch,created_at)
  VALUES(NEW.routing_bucket,NEW.message_id,NEW.message_class,NEW.routing_epoch,NEW.created_at);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS operational_outbox_relay ON public.operational_outbox;
CREATE TRIGGER operational_outbox_relay AFTER INSERT ON public.operational_outbox
FOR EACH ROW EXECUTE FUNCTION public.operational_enqueue_relay();
