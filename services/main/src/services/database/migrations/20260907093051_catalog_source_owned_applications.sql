SET search_path TO public;

-- Modify "catalog_source_application" table
ALTER TABLE "catalog_source_application" ADD CONSTRAINT "catalog_source_application_previous_evidence_check" CHECK ((num_nonnulls(previous_evidence_source_record_id, previous_evidence_snapshot_id, previous_evidence_path) = 0) OR ((previous_snapshot_id IS NULL) AND (num_nonnulls(previous_evidence_source_record_id, previous_evidence_snapshot_id, previous_evidence_path) = 3) AND ((octet_length(previous_evidence_path) >= 1) AND (octet_length(previous_evidence_path) <= 512)))), ADD COLUMN "previous_evidence_source_record_id" uuid NULL, ADD COLUMN "previous_evidence_snapshot_id" uuid NULL, ADD COLUMN "previous_evidence_path" text NULL, ADD CONSTRAINT "catalog_source_application_previous_evidence_fk" FOREIGN KEY ("previous_evidence_source_record_id", "previous_evidence_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create "distribution_source_authority_application_change" table
CREATE TABLE "distribution_source_authority_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "distribution_authority_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "distribution_authority_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "distribution_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_authority_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_authority_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "distribution_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_authority_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "distribution_source_name_application_change" table
CREATE TABLE "distribution_source_name_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "distribution_name_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "distribution_name_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "distribution_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "distribution_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_name_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "distribution_source_semantic_application_change" table
CREATE TABLE "distribution_source_semantic_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "distribution_semantic_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "distribution_semantic_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "distribution_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_semantic_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_semantic_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "distribution_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_semantic_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "entity_source_authority_application_change" table
CREATE TABLE "entity_source_authority_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "entity_authority_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "entity_authority_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "entity_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_authority_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_authority_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "entity_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_authority_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "entity_source_name_application_change" table
CREATE TABLE "entity_source_name_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "entity_name_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "entity_name_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "entity_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "entity_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_name_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "entity_source_semantic_application_change" table
CREATE TABLE "entity_source_semantic_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "entity_semantic_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "entity_semantic_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "entity_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_semantic_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_semantic_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "entity_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_semantic_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "grouping_source_authority_application_change" table
CREATE TABLE "grouping_source_authority_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "grouping_authority_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "grouping_authority_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "grouping_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_authority_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_authority_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "grouping_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_authority_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "grouping_source_name_application_change" table
CREATE TABLE "grouping_source_name_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "grouping_name_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "grouping_name_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "grouping_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "grouping_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_name_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "grouping_source_semantic_application_change" table
CREATE TABLE "grouping_source_semantic_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "grouping_semantic_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "grouping_semantic_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "grouping_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_semantic_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_semantic_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "grouping_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_semantic_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create index "music_component_source_component_idx" to table: "music_component_source_occurrence"
CREATE INDEX "music_component_source_component_idx" ON "music_component_source_occurrence" ("source_record_id", "snapshot_id", "owner_id", "component", "component_key", "source_path");
-- Create "music_component_source_baseline" table
CREATE TABLE "music_component_source_baseline" (
  "source_record_id" uuid NOT NULL,
  "mapping_key" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'music',
  "owner_id" uuid NOT NULL,
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "source_history_id" uuid NOT NULL,
  "current_history_id" uuid NOT NULL,
  "absent" boolean NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  PRIMARY KEY ("source_record_id", "mapping_key", "owner_id", "component", "component_key"),
  CONSTRAINT "music_source_baseline_application_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_source_baseline_current_fk" FOREIGN KEY ("owner_id", "current_history_id") REFERENCES "music_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_source_baseline_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_source_baseline_occurrence_fk" FOREIGN KEY ("source_record_id", "snapshot_id", "owner_id", "component", "source_path") REFERENCES "music_component_source_occurrence" ("source_record_id", "snapshot_id", "owner_id", "component", "source_path") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_source_baseline_original_fk" FOREIGN KEY ("owner_id", "source_history_id") REFERENCES "music_component_revision" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_source_baseline_action_check" CHECK (action = ANY (ARRAY['apply'::text, 'withdraw'::text])),
  CONSTRAINT "music_source_baseline_owner_check" CHECK (mapping_owner = 'music'::text)
) PARTITION BY HASH ("source_record_id");
-- Create index "music_source_baseline_current_idx" to table: "music_component_source_baseline"
CREATE INDEX "music_source_baseline_current_idx" ON "music_component_source_baseline" ("owner_id", "current_history_id");
-- Create "music_source_authority_application_change" table
CREATE TABLE "music_source_authority_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "music_authority_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "music_authority_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "music_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_authority_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_authority_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "music_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_authority_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "music_source_name_application_change" table
CREATE TABLE "music_source_name_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "music_name_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "music_name_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "music_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "music_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_name_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "music_source_semantic_application_change" table
CREATE TABLE "music_source_semantic_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "music_semantic_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "music_semantic_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "music_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_semantic_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_semantic_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "music_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_semantic_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "program_source_authority_application_change" table
CREATE TABLE "program_source_authority_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "program_authority_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "program_authority_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "program_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_authority_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_authority_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "program_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_authority_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "program_source_name_application_change" table
CREATE TABLE "program_source_name_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "program_name_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "program_name_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "program_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "program_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_name_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "program_source_semantic_application_change" table
CREATE TABLE "program_source_semantic_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "program_semantic_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "program_semantic_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "program_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_semantic_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_semantic_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "program_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_semantic_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "publishing_source_authority_application_change" table
CREATE TABLE "publishing_source_authority_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "publishing_authority_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "publishing_authority_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "publishing_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_authority_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_authority_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "publishing_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_authority_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "publishing_source_name_application_change" table
CREATE TABLE "publishing_source_name_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "publishing_name_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "publishing_name_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "publishing_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "publishing_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_name_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "publishing_source_semantic_application_change" table
CREATE TABLE "publishing_source_semantic_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "publishing_semantic_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "publishing_semantic_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "publishing_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_semantic_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_semantic_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "publishing_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_semantic_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "reference_source_authority_application_change" table
CREATE TABLE "reference_source_authority_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "reference_authority_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "reference_authority_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "reference_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_authority_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_authority_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "reference_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_authority_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "reference_source_name_application_change" table
CREATE TABLE "reference_source_name_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "reference_name_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "reference_name_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "reference_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "reference_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_name_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "reference_source_semantic_application_change" table
CREATE TABLE "reference_source_semantic_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "reference_semantic_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "reference_semantic_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "reference_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_semantic_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_semantic_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "reference_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_semantic_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "software_source_authority_application_change" table
CREATE TABLE "software_source_authority_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "software_authority_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "software_authority_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "software_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_authority_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_authority_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "software_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_authority_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "software_source_context_application_change" table
CREATE TABLE "software_source_context_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "software_context_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "software_context_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "software_participation_context_revision" ("content_id", "context_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_context_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_context_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "software_participation_context_revision" ("content_id", "context_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_context_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "software_source_name_application_change" table
CREATE TABLE "software_source_name_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "software_name_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "software_name_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "software_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "software_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_name_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "software_source_participation_application_change" table
CREATE TABLE "software_source_participation_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "software_participation_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "software_participation_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "software_participation_revision" ("content_id", "participation_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_participation_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_participation_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "software_participation_revision" ("content_id", "participation_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_participation_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Create "software_source_semantic_application_change" table
CREATE TABLE "software_source_semantic_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "software_semantic_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "software_semantic_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "software_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_semantic_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_semantic_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "software_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_semantic_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");

-- These newly created native change families use the source aggregate route.
DO $$
DECLARE parent_name text; owner_name text; kind text; partition_number integer; parents text[] := ARRAY['software_source_context_application_change','software_source_participation_application_change','music_component_source_baseline'];
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['publishing','music','program','software','entity','grouping','reference','distribution'] LOOP
    FOREACH kind IN ARRAY ARRAY['semantic','name','authority'] LOOP
      parents := array_append(parents, owner_name || '_source_' || kind || '_application_change');
    END LOOP;
  END LOOP;
  FOREACH parent_name IN ARRAY parents LOOP
    FOR partition_number IN 0..63 LOOP
      EXECUTE format('CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES WITH (MODULUS 64, REMAINDER %s)', parent_name || '_p' || lpad(partition_number::text, 2, '0'), parent_name, partition_number);
    END LOOP;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_source_validate_application_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE history public.music_component_revision%ROWTYPE; application public.catalog_source_application%ROWTYPE; proposal_state text;
BEGIN
  SELECT * INTO STRICT application FROM public.catalog_source_application WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action;
  SELECT state INTO STRICT proposal_state FROM public.catalog_source_adoption_proposal WHERE source_record_id=NEW.source_record_id AND id=NEW.proposal_id;
  IF NEW.position >= application.change_count OR (NEW.action='apply' AND proposal_state <> 'pending') OR (NEW.action='withdraw' AND proposal_state <> 'applied') THEN
    RAISE EXCEPTION 'Native change must belong to its in-progress application' USING ERRCODE = '23514';
  END IF;
  IF TG_ARGV[0] = 'music' THEN
    SELECT * INTO STRICT history FROM public.music_component_revision WHERE owner_id = NEW.owner_id AND id = NEW.after_revision_id;
    IF history.component <> NEW.component OR history.component_key <> NEW.component_key THEN
      RAISE EXCEPTION 'Music application history has a different component key' USING ERRCODE = '23514';
    END IF;
    IF NEW.before_revision_id IS NOT NULL THEN
      SELECT * INTO STRICT history FROM public.music_component_revision WHERE owner_id = NEW.owner_id AND id = NEW.before_revision_id;
      IF history.component <> NEW.component OR history.component_key <> NEW.component_key OR NEW.before_revision_id >= NEW.after_revision_id THEN
        RAISE EXCEPTION 'Music application before history has a different component or order' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_source_require_application_complete()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE application public.catalog_source_application%ROWTYPE; proposal public.catalog_source_adoption_proposal%ROWTYPE;
  actual_count integer; unique_positions integer; first_position integer; last_position integer;
BEGIN
  SELECT * INTO STRICT application FROM public.catalog_source_application
    WHERE source_record_id = NEW.source_record_id AND proposal_id = NEW.proposal_id AND action = NEW.action;
  SELECT * INTO STRICT proposal FROM public.catalog_source_adoption_proposal
    WHERE source_record_id = NEW.source_record_id AND id = NEW.proposal_id;
  IF (application.action = 'apply' AND proposal.state NOT IN ('applied','withdrawn'))
    OR (application.action = 'withdraw' AND proposal.state <> 'withdrawn') THEN
    RAISE EXCEPTION 'Native application must commit its corresponding proposal decision' USING ERRCODE = '23514';
  END IF;
  SELECT count(*), count(DISTINCT position), min(position), max(position)
    INTO actual_count, unique_positions, first_position, last_position FROM (
      SELECT position FROM public.music_source_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_component_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_record_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.publishing_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.publishing_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.publishing_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.music_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.music_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.music_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.program_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.program_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.program_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.entity_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.entity_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.entity_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.grouping_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.grouping_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.grouping_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.reference_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.reference_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.reference_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.distribution_source_semantic_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.distribution_source_name_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.distribution_source_authority_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_context_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_participation_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
    ) changes;
  IF actual_count <> application.change_count OR unique_positions <> actual_count
    OR (actual_count > 0 AND (first_position <> 0 OR last_position <> actual_count - 1)) THEN
    RAISE EXCEPTION 'Native application requires a complete contiguous change manifest' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;

DO $$
DECLARE relation_name text; physical record;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['catalog_source_application','music_source_application_change','software_source_component_application_change','software_source_record_application_change','publishing_source_semantic_application_change','publishing_source_name_application_change','publishing_source_authority_application_change','music_source_semantic_application_change','music_source_name_application_change','music_source_authority_application_change','program_source_semantic_application_change','program_source_name_application_change','program_source_authority_application_change','software_source_semantic_application_change','software_source_name_application_change','software_source_authority_application_change','entity_source_semantic_application_change','entity_source_name_application_change','entity_source_authority_application_change','grouping_source_semantic_application_change','grouping_source_name_application_change','grouping_source_authority_application_change','reference_source_semantic_application_change','reference_source_name_application_change','reference_source_authority_application_change','distribution_source_semantic_application_change','distribution_source_name_application_change','distribution_source_authority_application_change','software_source_context_application_change','software_source_participation_application_change'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_application_immutable ON public.%I', relation_name);
    EXECUTE format('CREATE TRIGGER catalog_source_application_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_immutable_evidence()', relation_name);
    IF relation_name NOT IN ('catalog_source_application','music_source_application_change') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_application_change_guard ON public.%I', relation_name);
      EXECUTE format('CREATE TRIGGER catalog_source_application_change_guard BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_validate_application_change()', relation_name);
    END IF;
  END LOOP;
  FOR physical IN
    WITH RECURSIVE roots AS (
      SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('catalog_source_application','music_source_application_change','software_source_component_application_change','software_source_record_application_change','publishing_source_semantic_application_change','publishing_source_name_application_change','publishing_source_authority_application_change','music_source_semantic_application_change','music_source_name_application_change','music_source_authority_application_change','program_source_semantic_application_change','program_source_name_application_change','program_source_authority_application_change','software_source_semantic_application_change','software_source_name_application_change','software_source_authority_application_change','entity_source_semantic_application_change','entity_source_name_application_change','entity_source_authority_application_change','grouping_source_semantic_application_change','grouping_source_name_application_change','grouping_source_authority_application_change','reference_source_semantic_application_change','reference_source_name_application_change','reference_source_authority_application_change','distribution_source_semantic_application_change','distribution_source_name_application_change','distribution_source_authority_application_change','software_source_context_application_change','software_source_participation_application_change')
      UNION ALL SELECT i.inhrelid FROM pg_inherits i JOIN roots r ON r.oid=i.inhparent
    ) SELECT c.oid::regclass AS name, c.relname AS local_name FROM roots r JOIN pg_class c ON c.oid=r.oid WHERE c.relkind='r'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_application_complete ON %s', physical.name);
    IF physical.local_name LIKE 'catalog_source_application%' THEN
      EXECUTE format('CREATE CONSTRAINT TRIGGER catalog_source_application_complete AFTER INSERT ON %s DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.catalog_source_require_application_complete()', physical.name);
    END IF;
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS music_source_application_exact_component ON public.music_source_application_change;
CREATE TRIGGER music_source_application_exact_component BEFORE INSERT ON public.music_source_application_change
  FOR EACH ROW EXECUTE FUNCTION public.catalog_source_validate_application_change('music');

CREATE OR REPLACE FUNCTION public.catalog_source_guard_proposal()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Source proposal decisions are retained evidence' USING ERRCODE='23514'; END IF;
  IF (NEW.source_record_id,NEW.id,NEW.snapshot_id,NEW.mapping_key,NEW.mapping_owner,NEW.mapping_version,NEW.expected_target_revision,NEW.expected_binding_revision,NEW.expected_policy_revision,NEW.created_at)
    IS DISTINCT FROM (OLD.source_record_id,OLD.id,OLD.snapshot_id,OLD.mapping_key,OLD.mapping_owner,OLD.mapping_version,OLD.expected_target_revision,OLD.expected_binding_revision,OLD.expected_policy_revision,OLD.created_at)
    OR (NEW.proposer_auth_user_id IS DISTINCT FROM OLD.proposer_auth_user_id AND NEW.proposer_auth_user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Source proposal scope and preconditions are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.state = OLD.state THEN
    IF (NEW.decided_at,NEW.decision_reason,NEW.applied_target_revision) IS DISTINCT FROM (OLD.decided_at,OLD.decision_reason,OLD.applied_target_revision) THEN
      RAISE EXCEPTION 'Source proposal decisions are immutable without an allowed transition' USING ERRCODE='23514';
    END IF;
  ELSIF NOT ((OLD.state='pending' AND NEW.state IN ('applied','rejected','superseded')) OR (OLD.state='applied' AND NEW.state='withdrawn')) THEN
    RAISE EXCEPTION 'Source proposal transition is not allowed' USING ERRCODE='23514';
  END IF;
  IF NEW.state IN ('applied','withdrawn') AND NOT EXISTS (
    SELECT 1 FROM public.catalog_source_application WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.id
      AND action=CASE WHEN NEW.state='applied' THEN 'apply' ELSE 'withdraw' END AND after_revision=NEW.applied_target_revision
  ) THEN
    RAISE EXCEPTION 'Source proposal decision requires its exact native application' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS catalog_source_proposal_guard ON public.catalog_source_adoption_proposal;
CREATE TRIGGER catalog_source_proposal_guard BEFORE UPDATE OR DELETE ON public.catalog_source_adoption_proposal
  FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_proposal();


CREATE OR REPLACE FUNCTION public.catalog_check_music_source_baseline()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE native public.music_component_revision%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.source_record_id, OLD.mapping_key, OLD.owner_id, OLD.component, OLD.component_key)
    IS DISTINCT FROM (NEW.source_record_id, NEW.mapping_key, NEW.owner_id, NEW.component, NEW.component_key) THEN
    RAISE EXCEPTION 'Music source baseline identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.music_component_source_occurrence
    WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.snapshot_id AND owner_id=NEW.owner_id
      AND component=NEW.component AND component_key=NEW.component_key AND source_path=NEW.source_path AND history_id=NEW.source_history_id) THEN
    RAISE EXCEPTION 'Music source baseline requires exact original source support' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO STRICT native FROM public.music_component_revision WHERE owner_id=NEW.owner_id AND id=NEW.current_history_id;
  IF native.component <> NEW.component OR native.component_key <> NEW.component_key OR (native.operation='DELETE') <> NEW.absent THEN
    RAISE EXCEPTION 'Music source baseline current component differs' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.music_source_application_change change
    JOIN public.catalog_source_adoption_proposal proposal ON proposal.source_record_id=change.source_record_id AND proposal.id=change.proposal_id
    WHERE change.source_record_id=NEW.source_record_id AND change.proposal_id=NEW.proposal_id AND change.action=NEW.action
      AND proposal.mapping_key=NEW.mapping_key AND change.owner_id=NEW.owner_id AND change.component=NEW.component
      AND change.component_key=NEW.component_key AND change.after_revision_id=NEW.current_history_id) THEN
    RAISE EXCEPTION 'Music source baseline requires exact native application proof' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_source_baseline_proof ON public.music_component_source_baseline;
CREATE TRIGGER music_source_baseline_proof BEFORE INSERT OR UPDATE ON public.music_component_source_baseline
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_source_baseline();
