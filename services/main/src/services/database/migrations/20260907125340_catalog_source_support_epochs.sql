SET search_path TO public;

-- The generated diff recreates this exact key with its correspondence columns.
ALTER TABLE public.music_component_source_baseline DROP CONSTRAINT music_source_baseline_occurrence_fk;

-- Create "catalog_source_proposal_dependency" table
CREATE TABLE "catalog_source_proposal_dependency" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "position" integer NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "dependency_source_record_id" uuid NOT NULL,
  "dependency_mapping_key" uuid NOT NULL,
  "dependency_binding_revision" bigint NOT NULL,
  "publishing_id" uuid NULL,
  "music_id" uuid NULL,
  "program_id" uuid NULL,
  "software_id" uuid NULL,
  "entity_id" uuid NULL,
  "grouping_id" uuid NULL,
  "reference_id" uuid NULL,
  "distribution_id" uuid NULL,
  "prepared_by_auth_user_id" uuid NULL,
  "revoked_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("source_record_id", "proposal_id", "position"),
  CONSTRAINT "catalog_source_dependency_binding_fk" FOREIGN KEY ("dependency_source_record_id", "dependency_mapping_key", "dependency_binding_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_dependency_proposal_fk" FOREIGN KEY ("source_record_id", "proposal_id") REFERENCES "catalog_source_adoption_proposal" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_dependency_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_proposal_dependency_1z7GKaZEWTOL_fkey" FOREIGN KEY ("grouping_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_proposal_dependency_BV3G21F7KNJ9_fkey" FOREIGN KEY ("music_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_proposal_dependency_HJYNAETweexh_fkey" FOREIGN KEY ("reference_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_proposal_dependency_OJlCVJiN53A6_fkey" FOREIGN KEY ("prepared_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "catalog_source_proposal_dependency_WPs3ekaB4i4T_fkey" FOREIGN KEY ("software_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_proposal_dependency_bsMn7Yaf3YjN_fkey" FOREIGN KEY ("publishing_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_proposal_dependency_gyGrDzZQEVUL_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_proposal_dependency_hugWKDFpS4pf_fkey" FOREIGN KEY ("program_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_proposal_dependency_ylgGqj206Rmp_fkey" FOREIGN KEY ("distribution_id") REFERENCES "distribution_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_dependency_path_check" CHECK (("left"(source_path, 1) = '/'::text) AND ((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512))),
  CONSTRAINT "catalog_source_dependency_position_check" CHECK (("position" >= 0) AND ("position" <= 127)),
  CONSTRAINT "catalog_source_dependency_target_check" CHECK (num_nonnulls(publishing_id, music_id, program_id, software_id, entity_id, grouping_id, reference_id, distribution_id) = 1)
) PARTITION BY HASH ("source_record_id");
-- Create index "catalog_source_dependency_binding_idx" to table: "catalog_source_proposal_dependency"
CREATE INDEX "catalog_source_dependency_binding_idx" ON "catalog_source_proposal_dependency" ("dependency_source_record_id", "dependency_mapping_key", "dependency_binding_revision", "source_record_id", "proposal_id");
-- Create index "catalog_source_dependency_preparer_idx" to table: "catalog_source_proposal_dependency"
CREATE INDEX "catalog_source_dependency_preparer_idx" ON "catalog_source_proposal_dependency" ("prepared_by_auth_user_id", "source_record_id", "proposal_id");
-- Modify "distribution_fact_support" table
ALTER TABLE "distribution_fact_support" ADD CONSTRAINT "distribution_support_identifier_revision_check" CHECK ((identifier_id IS NULL) = (identifier_revision IS NULL)), ADD CONSTRAINT "distribution_support_source_correspondence_pair" CHECK ((source_mapping_key IS NULL) = (source_correspondence_revision IS NULL)), ADD COLUMN "identifier_revision" bigint NULL, ADD COLUMN "source_mapping_key" uuid NULL, ADD COLUMN "source_correspondence_revision" bigint NULL, ADD CONSTRAINT "distribution_support_identifier_revision_fk" FOREIGN KEY ("owner_id", "identifier_id", "identifier_revision") REFERENCES "distribution_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "distribution_support_source_correspondence_fk" FOREIGN KEY ("source_record_id", "source_mapping_key", "source_correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "distribution_support_source_correspondence_idx" to table: "distribution_fact_support"
CREATE INDEX "distribution_support_source_correspondence_idx" ON "distribution_fact_support" ("source_record_id", "source_mapping_key", "source_correspondence_revision", "snapshot_id", "owner_id", "id");
-- Create "distribution_source_identifier_application_change" table
CREATE TABLE "distribution_source_identifier_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "distribution_identifier_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "distribution_identifier_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "distribution_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_identifier_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_identifier_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "distribution_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_identifier_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Modify "distribution_source_owned_baseline" table
ALTER TABLE "distribution_source_owned_baseline" DROP CONSTRAINT "distribution_source_owned_baseline_pkey", DROP CONSTRAINT "distribution_source_owned_base_mapping_fk", DROP CONSTRAINT "distribution_source_owned_base_kind", ADD CONSTRAINT "distribution_source_owned_base_kind" CHECK ((num_nonnulls(semantic_id, name_id, authority_id, identifier_id) = 1) AND (((kind = 'catalog-semantic'::text) AND (component_key = semantic_id)) OR ((kind = 'catalog-name'::text) AND (component_key = name_id)) OR ((kind = 'catalog-name-authority'::text) AND (component_key = authority_id)) OR ((kind = 'catalog-identifier'::text) AND (component_key = identifier_id)))), DROP CONSTRAINT "distribution_source_owned_base_owner", ADD CONSTRAINT "distribution_source_owned_base_owner" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])), ALTER COLUMN "mapping_owner" DROP DEFAULT, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD COLUMN "identifier_id" uuid NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "kind", "component_key"), ADD CONSTRAINT "distribution_source_owned_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "distribution_owned_base_identifier_current_fk" FOREIGN KEY ("owner_id", "identifier_id", "current_revision") REFERENCES "distribution_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "distribution_owned_base_identifier_source_fk" FOREIGN KEY ("owner_id", "identifier_id", "source_revision") REFERENCES "distribution_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "entity_fact_support" table
ALTER TABLE "entity_fact_support" ADD CONSTRAINT "entity_support_identifier_revision_check" CHECK ((identifier_id IS NULL) = (identifier_revision IS NULL)), ADD CONSTRAINT "entity_support_source_correspondence_pair" CHECK ((source_mapping_key IS NULL) = (source_correspondence_revision IS NULL)), ADD COLUMN "identifier_revision" bigint NULL, ADD COLUMN "source_mapping_key" uuid NULL, ADD COLUMN "source_correspondence_revision" bigint NULL, ADD CONSTRAINT "entity_support_identifier_revision_fk" FOREIGN KEY ("owner_id", "identifier_id", "identifier_revision") REFERENCES "entity_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "entity_support_source_correspondence_fk" FOREIGN KEY ("source_record_id", "source_mapping_key", "source_correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "entity_support_source_correspondence_idx" to table: "entity_fact_support"
CREATE INDEX "entity_support_source_correspondence_idx" ON "entity_fact_support" ("source_record_id", "source_mapping_key", "source_correspondence_revision", "snapshot_id", "owner_id", "id");
-- Modify "entity_profile_source_occurrence" table
ALTER TABLE "entity_profile_source_occurrence" DROP CONSTRAINT "entity_profile_source_occurrence_pkey", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id", "owner_id"), ADD CONSTRAINT "entity_profile_source_correspondence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create "entity_source_identifier_application_change" table
CREATE TABLE "entity_source_identifier_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "entity_identifier_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "entity_identifier_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "entity_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_identifier_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_identifier_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "entity_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_identifier_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Modify "entity_source_owned_baseline" table
ALTER TABLE "entity_source_owned_baseline" DROP CONSTRAINT "entity_source_owned_baseline_pkey", DROP CONSTRAINT "entity_source_owned_base_mapping_fk", DROP CONSTRAINT "entity_source_owned_base_kind", ADD CONSTRAINT "entity_source_owned_base_kind" CHECK ((num_nonnulls(semantic_id, name_id, authority_id, identifier_id) = 1) AND (((kind = 'catalog-semantic'::text) AND (component_key = semantic_id)) OR ((kind = 'catalog-name'::text) AND (component_key = name_id)) OR ((kind = 'catalog-name-authority'::text) AND (component_key = authority_id)) OR ((kind = 'catalog-identifier'::text) AND (component_key = identifier_id)))), DROP CONSTRAINT "entity_source_owned_base_owner", ADD CONSTRAINT "entity_source_owned_base_owner" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])), ALTER COLUMN "mapping_owner" DROP DEFAULT, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD COLUMN "identifier_id" uuid NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "kind", "component_key"), ADD CONSTRAINT "entity_source_owned_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "entity_owned_base_identifier_current_fk" FOREIGN KEY ("owner_id", "identifier_id", "current_revision") REFERENCES "entity_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "entity_owned_base_identifier_source_fk" FOREIGN KEY ("owner_id", "identifier_id", "source_revision") REFERENCES "entity_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "entity_source_profile_baseline" table
ALTER TABLE "entity_source_profile_baseline" DROP CONSTRAINT "entity_source_profile_baseline_pkey", DROP CONSTRAINT "entity_profile_baseline_mapping_fk", DROP CONSTRAINT "entity_profile_baseline_owner", ADD CONSTRAINT "entity_profile_baseline_owner" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])), ALTER COLUMN "mapping_owner" DROP DEFAULT, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id"), ADD CONSTRAINT "entity_profile_baseline_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "grouping_fact_support" table
ALTER TABLE "grouping_fact_support" ADD CONSTRAINT "grouping_support_identifier_revision_check" CHECK ((identifier_id IS NULL) = (identifier_revision IS NULL)), ADD CONSTRAINT "grouping_support_source_correspondence_pair" CHECK ((source_mapping_key IS NULL) = (source_correspondence_revision IS NULL)), ADD COLUMN "identifier_revision" bigint NULL, ADD COLUMN "source_mapping_key" uuid NULL, ADD COLUMN "source_correspondence_revision" bigint NULL, ADD CONSTRAINT "grouping_support_identifier_revision_fk" FOREIGN KEY ("owner_id", "identifier_id", "identifier_revision") REFERENCES "grouping_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "grouping_support_source_correspondence_fk" FOREIGN KEY ("source_record_id", "source_mapping_key", "source_correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "grouping_support_source_correspondence_idx" to table: "grouping_fact_support"
CREATE INDEX "grouping_support_source_correspondence_idx" ON "grouping_fact_support" ("source_record_id", "source_mapping_key", "source_correspondence_revision", "snapshot_id", "owner_id", "id");
-- Create "grouping_source_identifier_application_change" table
CREATE TABLE "grouping_source_identifier_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "grouping_identifier_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "grouping_identifier_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "grouping_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_identifier_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_identifier_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "grouping_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_identifier_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Modify "grouping_source_owned_baseline" table
ALTER TABLE "grouping_source_owned_baseline" DROP CONSTRAINT "grouping_source_owned_baseline_pkey", DROP CONSTRAINT "grouping_source_owned_base_mapping_fk", DROP CONSTRAINT "grouping_source_owned_base_kind", ADD CONSTRAINT "grouping_source_owned_base_kind" CHECK ((num_nonnulls(semantic_id, name_id, authority_id, identifier_id) = 1) AND (((kind = 'catalog-semantic'::text) AND (component_key = semantic_id)) OR ((kind = 'catalog-name'::text) AND (component_key = name_id)) OR ((kind = 'catalog-name-authority'::text) AND (component_key = authority_id)) OR ((kind = 'catalog-identifier'::text) AND (component_key = identifier_id)))), DROP CONSTRAINT "grouping_source_owned_base_owner", ADD CONSTRAINT "grouping_source_owned_base_owner" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])), ALTER COLUMN "mapping_owner" DROP DEFAULT, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD COLUMN "identifier_id" uuid NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "kind", "component_key"), ADD CONSTRAINT "grouping_source_owned_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "grouping_owned_base_identifier_current_fk" FOREIGN KEY ("owner_id", "identifier_id", "current_revision") REFERENCES "grouping_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "grouping_owned_base_identifier_source_fk" FOREIGN KEY ("owner_id", "identifier_id", "source_revision") REFERENCES "grouping_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Drop index "music_component_source_component_idx" from table: "music_component_source_occurrence"
DROP INDEX "music_component_source_component_idx";
-- Modify "music_component_source_occurrence" table
ALTER TABLE "music_component_source_occurrence" DROP CONSTRAINT "music_component_source_occurrence_pkey", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id", "owner_id", "component", "source_path"), ADD CONSTRAINT "music_component_source_correspondence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "music_component_source_component_idx" to table: "music_component_source_occurrence"
CREATE INDEX "music_component_source_component_idx" ON "music_component_source_occurrence" ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id", "owner_id", "component", "component_key", "source_path");
-- Modify "music_component_source_baseline" table
ALTER TABLE "music_component_source_baseline" DROP CONSTRAINT "music_component_source_baseline_pkey", DROP CONSTRAINT "music_source_baseline_mapping_fk", DROP CONSTRAINT "music_source_baseline_owner_check", ADD CONSTRAINT "music_source_baseline_owner_check" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])), ALTER COLUMN "mapping_owner" DROP DEFAULT, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "component", "component_key"), ADD CONSTRAINT "music_source_baseline_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "music_source_baseline_occurrence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id", "owner_id", "component", "source_path") REFERENCES "music_component_source_occurrence" ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id", "owner_id", "component", "source_path") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "music_fact_support" table
ALTER TABLE "music_fact_support" ADD CONSTRAINT "music_support_identifier_revision_check" CHECK ((identifier_id IS NULL) = (identifier_revision IS NULL)), ADD CONSTRAINT "music_support_source_correspondence_pair" CHECK ((source_mapping_key IS NULL) = (source_correspondence_revision IS NULL)), ADD COLUMN "identifier_revision" bigint NULL, ADD COLUMN "source_mapping_key" uuid NULL, ADD COLUMN "source_correspondence_revision" bigint NULL, ADD CONSTRAINT "music_support_identifier_revision_fk" FOREIGN KEY ("owner_id", "identifier_id", "identifier_revision") REFERENCES "music_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "music_support_source_correspondence_fk" FOREIGN KEY ("source_record_id", "source_mapping_key", "source_correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "music_support_source_correspondence_idx" to table: "music_fact_support"
CREATE INDEX "music_support_source_correspondence_idx" ON "music_fact_support" ("source_record_id", "source_mapping_key", "source_correspondence_revision", "snapshot_id", "owner_id", "id");
-- Create "music_source_identifier_application_change" table
CREATE TABLE "music_source_identifier_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "music_identifier_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "music_identifier_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "music_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_identifier_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_identifier_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "music_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_identifier_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Modify "music_source_owned_baseline" table
ALTER TABLE "music_source_owned_baseline" DROP CONSTRAINT "music_source_owned_baseline_pkey", DROP CONSTRAINT "music_source_owned_base_mapping_fk", DROP CONSTRAINT "music_source_owned_base_kind", ADD CONSTRAINT "music_source_owned_base_kind" CHECK ((num_nonnulls(semantic_id, name_id, authority_id, identifier_id) = 1) AND (((kind = 'catalog-semantic'::text) AND (component_key = semantic_id)) OR ((kind = 'catalog-name'::text) AND (component_key = name_id)) OR ((kind = 'catalog-name-authority'::text) AND (component_key = authority_id)) OR ((kind = 'catalog-identifier'::text) AND (component_key = identifier_id)))), DROP CONSTRAINT "music_source_owned_base_owner", ADD CONSTRAINT "music_source_owned_base_owner" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])), ALTER COLUMN "mapping_owner" DROP DEFAULT, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD COLUMN "identifier_id" uuid NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "kind", "component_key"), ADD CONSTRAINT "music_source_owned_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "music_owned_base_identifier_current_fk" FOREIGN KEY ("owner_id", "identifier_id", "current_revision") REFERENCES "music_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "music_owned_base_identifier_source_fk" FOREIGN KEY ("owner_id", "identifier_id", "source_revision") REFERENCES "music_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "program_fact_support" table
ALTER TABLE "program_fact_support" ADD CONSTRAINT "program_support_identifier_revision_check" CHECK ((identifier_id IS NULL) = (identifier_revision IS NULL)), ADD CONSTRAINT "program_support_source_correspondence_pair" CHECK ((source_mapping_key IS NULL) = (source_correspondence_revision IS NULL)), ADD COLUMN "identifier_revision" bigint NULL, ADD COLUMN "source_mapping_key" uuid NULL, ADD COLUMN "source_correspondence_revision" bigint NULL, ADD CONSTRAINT "program_support_identifier_revision_fk" FOREIGN KEY ("owner_id", "identifier_id", "identifier_revision") REFERENCES "program_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "program_support_source_correspondence_fk" FOREIGN KEY ("source_record_id", "source_mapping_key", "source_correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "program_support_source_correspondence_idx" to table: "program_fact_support"
CREATE INDEX "program_support_source_correspondence_idx" ON "program_fact_support" ("source_record_id", "source_mapping_key", "source_correspondence_revision", "snapshot_id", "owner_id", "id");
-- Create "program_source_identifier_application_change" table
CREATE TABLE "program_source_identifier_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "program_identifier_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "program_identifier_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "program_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_identifier_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_identifier_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "program_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_identifier_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Modify "program_source_owned_baseline" table
ALTER TABLE "program_source_owned_baseline" DROP CONSTRAINT "program_source_owned_baseline_pkey", DROP CONSTRAINT "program_source_owned_base_mapping_fk", DROP CONSTRAINT "program_source_owned_base_kind", ADD CONSTRAINT "program_source_owned_base_kind" CHECK ((num_nonnulls(semantic_id, name_id, authority_id, identifier_id) = 1) AND (((kind = 'catalog-semantic'::text) AND (component_key = semantic_id)) OR ((kind = 'catalog-name'::text) AND (component_key = name_id)) OR ((kind = 'catalog-name-authority'::text) AND (component_key = authority_id)) OR ((kind = 'catalog-identifier'::text) AND (component_key = identifier_id)))), DROP CONSTRAINT "program_source_owned_base_owner", ADD CONSTRAINT "program_source_owned_base_owner" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])), ALTER COLUMN "mapping_owner" DROP DEFAULT, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD COLUMN "identifier_id" uuid NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "kind", "component_key"), ADD CONSTRAINT "program_source_owned_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "program_owned_base_identifier_current_fk" FOREIGN KEY ("owner_id", "identifier_id", "current_revision") REFERENCES "program_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "program_owned_base_identifier_source_fk" FOREIGN KEY ("owner_id", "identifier_id", "source_revision") REFERENCES "program_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "publishing_fact_support" table
ALTER TABLE "publishing_fact_support" ADD CONSTRAINT "publishing_support_identifier_revision_check" CHECK ((identifier_id IS NULL) = (identifier_revision IS NULL)), ADD CONSTRAINT "publishing_support_source_correspondence_pair" CHECK ((source_mapping_key IS NULL) = (source_correspondence_revision IS NULL)), ADD COLUMN "identifier_revision" bigint NULL, ADD COLUMN "source_mapping_key" uuid NULL, ADD COLUMN "source_correspondence_revision" bigint NULL, ADD CONSTRAINT "publishing_support_identifier_revision_fk" FOREIGN KEY ("owner_id", "identifier_id", "identifier_revision") REFERENCES "publishing_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "publishing_support_source_correspondence_fk" FOREIGN KEY ("source_record_id", "source_mapping_key", "source_correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "publishing_support_source_correspondence_idx" to table: "publishing_fact_support"
CREATE INDEX "publishing_support_source_correspondence_idx" ON "publishing_fact_support" ("source_record_id", "source_mapping_key", "source_correspondence_revision", "snapshot_id", "owner_id", "id");
-- Create "publishing_source_identifier_application_change" table
CREATE TABLE "publishing_source_identifier_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "publishing_identifier_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "publishing_identifier_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "publishing_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_identifier_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_identifier_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "publishing_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_identifier_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Modify "publishing_source_owned_baseline" table
ALTER TABLE "publishing_source_owned_baseline" DROP CONSTRAINT "publishing_source_owned_baseline_pkey", DROP CONSTRAINT "publishing_source_owned_base_mapping_fk", DROP CONSTRAINT "publishing_source_owned_base_kind", ADD CONSTRAINT "publishing_source_owned_base_kind" CHECK ((num_nonnulls(semantic_id, name_id, authority_id, identifier_id) = 1) AND (((kind = 'catalog-semantic'::text) AND (component_key = semantic_id)) OR ((kind = 'catalog-name'::text) AND (component_key = name_id)) OR ((kind = 'catalog-name-authority'::text) AND (component_key = authority_id)) OR ((kind = 'catalog-identifier'::text) AND (component_key = identifier_id)))), DROP CONSTRAINT "publishing_source_owned_base_owner", ADD CONSTRAINT "publishing_source_owned_base_owner" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])), ALTER COLUMN "mapping_owner" DROP DEFAULT, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD COLUMN "identifier_id" uuid NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "kind", "component_key"), ADD CONSTRAINT "publishing_source_owned_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "publishing_owned_base_identifier_current_fk" FOREIGN KEY ("owner_id", "identifier_id", "current_revision") REFERENCES "publishing_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "publishing_owned_base_identifier_source_fk" FOREIGN KEY ("owner_id", "identifier_id", "source_revision") REFERENCES "publishing_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "reference_fact_support" table
ALTER TABLE "reference_fact_support" ADD CONSTRAINT "reference_support_identifier_revision_check" CHECK ((identifier_id IS NULL) = (identifier_revision IS NULL)), ADD CONSTRAINT "reference_support_source_correspondence_pair" CHECK ((source_mapping_key IS NULL) = (source_correspondence_revision IS NULL)), ADD COLUMN "identifier_revision" bigint NULL, ADD COLUMN "source_mapping_key" uuid NULL, ADD COLUMN "source_correspondence_revision" bigint NULL, ADD CONSTRAINT "reference_support_identifier_revision_fk" FOREIGN KEY ("owner_id", "identifier_id", "identifier_revision") REFERENCES "reference_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "reference_support_source_correspondence_fk" FOREIGN KEY ("source_record_id", "source_mapping_key", "source_correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "reference_support_source_correspondence_idx" to table: "reference_fact_support"
CREATE INDEX "reference_support_source_correspondence_idx" ON "reference_fact_support" ("source_record_id", "source_mapping_key", "source_correspondence_revision", "snapshot_id", "owner_id", "id");
-- Modify "reference_profile_source_occurrence" table
ALTER TABLE "reference_profile_source_occurrence" DROP CONSTRAINT "reference_profile_source_occurrence_pkey", ADD COLUMN "mapping_key" uuid NOT NULL, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "snapshot_id", "owner_id"), ADD CONSTRAINT "reference_profile_source_correspondence_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create "reference_source_identifier_application_change" table
CREATE TABLE "reference_source_identifier_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "reference_identifier_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "reference_identifier_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "reference_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_identifier_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_identifier_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "reference_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_identifier_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Modify "reference_source_owned_baseline" table
ALTER TABLE "reference_source_owned_baseline" DROP CONSTRAINT "reference_source_owned_baseline_pkey", DROP CONSTRAINT "reference_source_owned_base_mapping_fk", DROP CONSTRAINT "reference_source_owned_base_kind", ADD CONSTRAINT "reference_source_owned_base_kind" CHECK ((num_nonnulls(semantic_id, name_id, authority_id, identifier_id) = 1) AND (((kind = 'catalog-semantic'::text) AND (component_key = semantic_id)) OR ((kind = 'catalog-name'::text) AND (component_key = name_id)) OR ((kind = 'catalog-name-authority'::text) AND (component_key = authority_id)) OR ((kind = 'catalog-identifier'::text) AND (component_key = identifier_id)))), DROP CONSTRAINT "reference_source_owned_base_owner", ADD CONSTRAINT "reference_source_owned_base_owner" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])), ALTER COLUMN "mapping_owner" DROP DEFAULT, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD COLUMN "identifier_id" uuid NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "kind", "component_key"), ADD CONSTRAINT "reference_source_owned_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "reference_owned_base_identifier_current_fk" FOREIGN KEY ("owner_id", "identifier_id", "current_revision") REFERENCES "reference_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "reference_owned_base_identifier_source_fk" FOREIGN KEY ("owner_id", "identifier_id", "source_revision") REFERENCES "reference_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "reference_source_profile_baseline" table
ALTER TABLE "reference_source_profile_baseline" DROP CONSTRAINT "reference_source_profile_baseline_pkey", DROP CONSTRAINT "reference_profile_baseline_mapping_fk", DROP CONSTRAINT "reference_profile_baseline_owner", ADD CONSTRAINT "reference_profile_baseline_owner" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])), ALTER COLUMN "mapping_owner" DROP DEFAULT, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id"), ADD CONSTRAINT "reference_profile_baseline_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "software_fact_support" table
ALTER TABLE "software_fact_support" ADD CONSTRAINT "software_support_identifier_revision_check" CHECK ((identifier_id IS NULL) = (identifier_revision IS NULL)), ADD CONSTRAINT "software_support_source_correspondence_pair" CHECK ((source_mapping_key IS NULL) = (source_correspondence_revision IS NULL)), ADD COLUMN "identifier_revision" bigint NULL, ADD COLUMN "source_mapping_key" uuid NULL, ADD COLUMN "source_correspondence_revision" bigint NULL, ADD CONSTRAINT "software_support_identifier_revision_fk" FOREIGN KEY ("owner_id", "identifier_id", "identifier_revision") REFERENCES "software_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "software_support_source_correspondence_fk" FOREIGN KEY ("source_record_id", "source_mapping_key", "source_correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create index "software_support_source_correspondence_idx" to table: "software_fact_support"
CREATE INDEX "software_support_source_correspondence_idx" ON "software_fact_support" ("source_record_id", "source_mapping_key", "source_correspondence_revision", "snapshot_id", "owner_id", "id");
-- Modify "software_source_component_baseline" table
ALTER TABLE "software_source_component_baseline" DROP CONSTRAINT "software_source_component_baseline_pkey", DROP CONSTRAINT "software_source_component_base_mapping_fk", DROP CONSTRAINT "software_source_component_base_owner", ADD CONSTRAINT "software_source_component_base_owner" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])), ALTER COLUMN "mapping_owner" DROP DEFAULT, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "component", "component_key"), ADD CONSTRAINT "software_source_component_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "software_source_context_baseline" table
ALTER TABLE "software_source_context_baseline" DROP CONSTRAINT "software_source_context_baseline_pkey", DROP CONSTRAINT "software_source_context_base_mapping_fk", DROP CONSTRAINT "software_source_context_base_owner", ADD CONSTRAINT "software_source_context_base_owner" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])), ALTER COLUMN "mapping_owner" DROP DEFAULT, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "component_key"), ADD CONSTRAINT "software_source_context_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Create "software_source_identifier_application_change" table
CREATE TABLE "software_source_identifier_application_change" (
  "source_record_id" uuid NOT NULL,
  "proposal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "position" integer NOT NULL,
  "owner_id" uuid NOT NULL,
  "component_key" uuid NOT NULL,
  "before_revision" bigint NULL,
  "after_revision" bigint NOT NULL,
  CONSTRAINT "software_identifier_app_pk" PRIMARY KEY ("source_record_id", "proposal_id", "action", "position"),
  CONSTRAINT "software_identifier_app_after_fk" FOREIGN KEY ("owner_id", "component_key", "after_revision") REFERENCES "software_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_identifier_app_app_fk" FOREIGN KEY ("source_record_id", "proposal_id", "action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_identifier_app_before_fk" FOREIGN KEY ("owner_id", "component_key", "before_revision") REFERENCES "software_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_identifier_app_values" CHECK ((("position" >= 0) AND ("position" <= 127)) AND ((before_revision IS NULL) OR (before_revision < after_revision)))
) PARTITION BY HASH ("source_record_id");
-- Modify "software_source_owned_baseline" table
ALTER TABLE "software_source_owned_baseline" DROP CONSTRAINT "software_source_owned_baseline_pkey", DROP CONSTRAINT "software_source_owned_base_mapping_fk", DROP CONSTRAINT "software_source_owned_base_kind", ADD CONSTRAINT "software_source_owned_base_kind" CHECK ((num_nonnulls(semantic_id, name_id, authority_id, identifier_id) = 1) AND (((kind = 'catalog-semantic'::text) AND (component_key = semantic_id)) OR ((kind = 'catalog-name'::text) AND (component_key = name_id)) OR ((kind = 'catalog-name-authority'::text) AND (component_key = authority_id)) OR ((kind = 'catalog-identifier'::text) AND (component_key = identifier_id)))), DROP CONSTRAINT "software_source_owned_base_owner", ADD CONSTRAINT "software_source_owned_base_owner" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])), ALTER COLUMN "mapping_owner" DROP DEFAULT, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD COLUMN "identifier_id" uuid NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "kind", "component_key"), ADD CONSTRAINT "software_source_owned_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "software_owned_base_identifier_current_fk" FOREIGN KEY ("owner_id", "identifier_id", "current_revision") REFERENCES "software_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT, ADD CONSTRAINT "software_owned_base_identifier_source_fk" FOREIGN KEY ("owner_id", "identifier_id", "source_revision") REFERENCES "software_identifier_claim_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "software_source_participation_baseline" table
ALTER TABLE "software_source_participation_baseline" DROP CONSTRAINT "software_source_participation_baseline_pkey", DROP CONSTRAINT "software_source_participation_base_mapping_fk", DROP CONSTRAINT "software_source_participation_base_owner", ADD CONSTRAINT "software_source_participation_base_owner" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])), ALTER COLUMN "mapping_owner" DROP DEFAULT, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id", "component_key"), ADD CONSTRAINT "software_source_participation_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;
-- Modify "software_source_record_baseline" table
ALTER TABLE "software_source_record_baseline" DROP CONSTRAINT "software_source_record_baseline_pkey", DROP CONSTRAINT "software_source_record_base_mapping_fk", DROP CONSTRAINT "software_source_record_base_owner", ADD CONSTRAINT "software_source_record_base_owner" CHECK (mapping_owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text, 'distribution'::text])), ALTER COLUMN "mapping_owner" DROP DEFAULT, ADD COLUMN "correspondence_revision" bigint NOT NULL, ADD PRIMARY KEY ("source_record_id", "mapping_key", "correspondence_revision", "owner_id"), ADD CONSTRAINT "software_source_record_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "correspondence_revision") REFERENCES "catalog_source_binding_revision" ("source_record_id", "mapping_key", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT;

DO $$ DECLARE owner_name text; partition_number integer; relation_name text;
BEGIN
  FOR partition_number IN 0..63 LOOP
    EXECUTE format('CREATE TABLE public.%I PARTITION OF public.catalog_source_proposal_dependency FOR VALUES WITH (MODULUS 64, REMAINDER %s)', 'catalog_source_proposal_dependency_p' || lpad(partition_number::text,2,'0'),partition_number);
  END LOOP;
  FOREACH owner_name IN ARRAY ARRAY['publishing','music','program','software','entity','grouping','reference','distribution'] LOOP
    relation_name := owner_name || '_source_identifier_application_change';
    FOR partition_number IN 0..63 LOOP
      EXECUTE format('CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES WITH (MODULUS 64, REMAINDER %s)', relation_name || '_p' || lpad(partition_number::text,2,'0'),relation_name,partition_number);
    END LOOP;
  END LOOP;
END $$;

-- Fixed content-label registry and direct Tag application policy.

CREATE OR REPLACE FUNCTION public.guard_tag_directly_applicable_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
	IF NOT OLD.directly_applicable OR NEW.directly_applicable THEN RETURN NEW; END IF;
	IF EXISTS (SELECT 1 FROM public.unit_tag WHERE tag_id = NEW.id)
		OR EXISTS (SELECT 1 FROM public.realm_unit_tag WHERE tag_id = NEW.id)
		OR EXISTS (SELECT 1 FROM public.account_unit_tag WHERE tag_id = NEW.id)
		OR EXISTS (SELECT 1 FROM public.realm_tag_judgment WHERE tag_id = NEW.id) THEN
		RAISE EXCEPTION 'A directly applied Tag cannot become category-only'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_directly_applicable_in_use';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_content_label_unit_merge()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
	registry_ids constant uuid[] := ARRAY[
		'019b76da-a800-7370-8000-000000000001'::uuid,
		'019b76da-a800-7370-8000-000000000002'::uuid,
		'019b76da-a800-7370-8000-000000000003'::uuid,
		'019b76da-a800-7370-8000-000000000004'::uuid
	];
BEGIN
	IF NEW.source_unit_id = ANY(registry_ids) OR NEW.target_unit_id = ANY(registry_ids) THEN
		RAISE EXCEPTION 'Fixed content-label registry Tags cannot participate in Unit merges'
			USING ERRCODE = '23514', CONSTRAINT = 'content_label_unit_merge_rejected';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_direct_tag_application_policy()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
	content_spoiler_ids constant uuid[] := ARRAY[
		'019b76da-a800-7370-8000-000000000001'::uuid,
		'019b76da-a800-7370-8000-000000000002'::uuid,
		'019b76da-a800-7370-8000-000000000003'::uuid
	];
	nsfw_id constant uuid := '019b76da-a800-7370-8000-000000000004'::uuid;
	registry_ids constant uuid[] := content_spoiler_ids || ARRAY[nsfw_id];
	is_directly_applicable boolean;
BEGIN
	SELECT directly_applicable INTO is_directly_applicable
	FROM public.tag WHERE id = NEW.tag_id FOR SHARE;
	IF NOT NEW.tag_id = ANY(registry_ids) THEN
		IF is_directly_applicable = false THEN
			RAISE EXCEPTION 'Tag % cannot be applied directly', NEW.tag_id
				USING ERRCODE = '23514', CONSTRAINT = 'tag_directly_applicable';
		END IF;
		RETURN NEW;
	END IF;
	IF TG_TABLE_NAME = 'account_unit_tag' THEN
		RAISE EXCEPTION 'Content labels cannot be private Profile Tags'
			USING ERRCODE = '23514', CONSTRAINT = 'content_label_private_rejected';
	END IF;
	IF TG_TABLE_NAME = 'unit_tag' AND (NEW.created_by_profile_id IS NULL OR NOT NEW.pinned) THEN
		RAISE EXCEPTION 'Global content-label rows require creator attribution and pinning'
			USING ERRCODE = '23514', CONSTRAINT = 'content_label_global_contract';
	END IF;
	IF NEW.tag_id = ANY(content_spoiler_ids) AND NOT EXISTS (
		SELECT 1 FROM public.post WHERE id = NEW.unit_id
	) THEN
		RAISE EXCEPTION 'Content-spoiler labels apply only to post-kind Units'
			USING ERRCODE = '23514', CONSTRAINT = 'content_spoiler_label_post_kind';
	ELSIF NEW.tag_id = nsfw_id AND NOT EXISTS (
		SELECT 1 FROM public.unit WHERE id = NEW.unit_id
			AND status = 'published'::public.unit_status
			AND visibility = 'public'::public.resource_visibility
			AND moderation_status = 'approved'::public.moderation_status
			AND deleted_at IS NULL
			AND kind NOT IN ('slug_namespace', 'profile', 'tag', 'tag_path', 'zone', 'realm', 'realm_rule')
	) THEN
		RAISE EXCEPTION 'The NSFW display label applies only to active public content Units'
			USING ERRCODE = '23514', CONSTRAINT = 'nsfw_label_public_content';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_content_label_judgment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.tag_id = ANY(ARRAY[
		'019b76da-a800-7370-8000-000000000001'::uuid,
		'019b76da-a800-7370-8000-000000000002'::uuid,
		'019b76da-a800-7370-8000-000000000003'::uuid,
		'019b76da-a800-7370-8000-000000000004'::uuid
	]) THEN
		RAISE EXCEPTION 'Content-label applicability and spoiler judgments are not permitted'
			USING ERRCODE = '23514', CONSTRAINT = 'content_label_judgment_rejected';
	END IF;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tag_directly_applicable_transition_guard ON public.tag;
CREATE TRIGGER tag_directly_applicable_transition_guard
BEFORE UPDATE OF directly_applicable ON public.tag
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_directly_applicable_transition();

DROP TRIGGER IF EXISTS unit_merge_operation_content_label_guard ON public.unit_merge_operation;
CREATE TRIGGER unit_merge_operation_content_label_guard
BEFORE INSERT OR UPDATE OF source_unit_id, target_unit_id ON public.unit_merge_operation
FOR EACH ROW EXECUTE FUNCTION public.guard_content_label_unit_merge();

DROP TRIGGER IF EXISTS unit_tag_application_policy_guard ON public.unit_tag;
CREATE TRIGGER unit_tag_application_policy_guard
BEFORE INSERT OR UPDATE ON public.unit_tag
FOR EACH ROW EXECUTE FUNCTION public.guard_direct_tag_application_policy();

DROP TRIGGER IF EXISTS realm_unit_tag_application_policy_guard ON public.realm_unit_tag;
CREATE TRIGGER realm_unit_tag_application_policy_guard
BEFORE INSERT OR UPDATE ON public.realm_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.guard_direct_tag_application_policy();

DROP TRIGGER IF EXISTS account_unit_tag_application_policy_guard ON public.account_unit_tag;
CREATE TRIGGER account_unit_tag_application_policy_guard
BEFORE INSERT OR UPDATE ON public.account_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.guard_direct_tag_application_policy();

DROP TRIGGER IF EXISTS unit_tag_judgment_content_label_reject ON public.unit_tag_judgment;
CREATE TRIGGER unit_tag_judgment_content_label_reject
BEFORE INSERT OR UPDATE ON public.unit_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.reject_content_label_judgment();

DROP TRIGGER IF EXISTS realm_tag_judgment_content_label_reject ON public.realm_tag_judgment;
CREATE TRIGGER realm_tag_judgment_content_label_reject
BEFORE INSERT OR UPDATE ON public.realm_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.reject_content_label_judgment();


CREATE OR REPLACE FUNCTION public.catalog_guard_source_support()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Source occurrence history cannot be deleted' USING ERRCODE = '23514';
  END IF;
  IF (to_jsonb(NEW) - 'withdrawn_at') IS DISTINCT FROM (to_jsonb(OLD) - 'withdrawn_at')
    OR (OLD.withdrawn_at IS NOT NULL AND NEW.withdrawn_at IS DISTINCT FROM OLD.withdrawn_at) THEN
    RAISE EXCEPTION 'Source occurrence target, revision, epoch and evidence are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE owner_name text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['publishing','music','program','software','entity','grouping','reference','distribution'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_support_guard ON public.%I', owner_name || '_fact_support');
    EXECUTE format('CREATE TRIGGER catalog_source_support_guard BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_source_support()', owner_name || '_fact_support');
  END LOOP;
END $$;


CREATE OR REPLACE FUNCTION public.catalog_source_guard_dependency()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE proposal public.catalog_source_adoption_proposal%ROWTYPE; binding public.catalog_source_binding_revision%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Source dependency evidence is retained' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-'revoked_at'-'prepared_by_auth_user_id') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at'-'prepared_by_auth_user_id')
      OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at)
      OR (NEW.prepared_by_auth_user_id IS DISTINCT FROM OLD.prepared_by_auth_user_id AND NEW.prepared_by_auth_user_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Source dependency target and evidence are immutable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO STRICT proposal FROM public.catalog_source_adoption_proposal WHERE source_record_id=NEW.source_record_id AND id=NEW.proposal_id FOR SHARE;
  IF proposal.state<>'pending' OR proposal.snapshot_id<>NEW.snapshot_id THEN RAISE EXCEPTION 'Dependency must be prepared for its pending proposal exact snapshot' USING ERRCODE='23514'; END IF;
  SELECT * INTO STRICT binding FROM public.catalog_source_binding_revision WHERE source_record_id=NEW.dependency_source_record_id AND mapping_key=NEW.dependency_mapping_key AND revision=NEW.dependency_binding_revision;
  IF (NEW.publishing_id,NEW.music_id,NEW.program_id,NEW.software_id,NEW.entity_id,NEW.grouping_id,NEW.reference_id,NEW.distribution_id)
    IS DISTINCT FROM (binding.publishing_id,binding.music_id,binding.program_id,binding.software_id,binding.entity_id,binding.grouping_id,binding.reference_id,binding.distribution_id) THEN
    RAISE EXCEPTION 'Dependency target must match its exact source binding' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS catalog_source_dependency_guard ON public.catalog_source_proposal_dependency;
CREATE TRIGGER catalog_source_dependency_guard BEFORE INSERT OR UPDATE OR DELETE ON public.catalog_source_proposal_dependency
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_dependency();


CREATE OR REPLACE FUNCTION public.catalog_source_guard_binding_correspondence()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE previous public.catalog_source_binding_revision%ROWTYPE; anchor public.catalog_source_binding_revision%ROWTYPE; same_meaning boolean;
BEGIN
  IF NEW.revision=1 THEN
    IF NEW.correspondence_revision<>1 THEN RAISE EXCEPTION 'Initial source correspondence must anchor itself' USING ERRCODE='23514'; END IF;
  ELSE
    SELECT * INTO previous FROM public.catalog_source_binding_revision WHERE source_record_id=NEW.source_record_id AND mapping_key=NEW.mapping_key AND revision=NEW.revision-1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Source binding revisions must be contiguous' USING ERRCODE='23514'; END IF;
    same_meaning := (NEW.owner,NEW.mapping_version,NEW.publishing_id,NEW.music_id,NEW.program_id,NEW.software_id,NEW.entity_id,NEW.grouping_id,NEW.reference_id,NEW.distribution_id)
      IS NOT DISTINCT FROM (previous.owner,previous.mapping_version,previous.publishing_id,previous.music_id,previous.program_id,previous.software_id,previous.entity_id,previous.grouping_id,previous.reference_id,previous.distribution_id);
    IF NEW.correspondence_revision <> (CASE WHEN same_meaning THEN previous.correspondence_revision ELSE NEW.revision END) THEN
      RAISE EXCEPTION 'Correspondence changes only with native target or mapping meaning' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.correspondence_revision<>NEW.revision THEN
    SELECT * INTO anchor FROM public.catalog_source_binding_revision WHERE source_record_id=NEW.source_record_id AND mapping_key=NEW.mapping_key AND revision=NEW.correspondence_revision;
    IF NOT FOUND OR anchor.correspondence_revision<>anchor.revision OR
      (NEW.owner,NEW.mapping_version,NEW.publishing_id,NEW.music_id,NEW.program_id,NEW.software_id,NEW.entity_id,NEW.grouping_id,NEW.reference_id,NEW.distribution_id)
      IS DISTINCT FROM (anchor.owner,anchor.mapping_version,anchor.publishing_id,anchor.music_id,anchor.program_id,anchor.software_id,anchor.entity_id,anchor.grouping_id,anchor.reference_id,anchor.distribution_id) THEN
      RAISE EXCEPTION 'Correspondence requires the exact self-anchored target and mapping meaning' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS catalog_source_binding_correspondence_guard ON public.catalog_source_binding_revision;
CREATE TRIGGER catalog_source_binding_correspondence_guard BEFORE INSERT ON public.catalog_source_binding_revision
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_binding_correspondence();

CREATE OR REPLACE FUNCTION public.catalog_source_guard_child_correspondence()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE anchor public.catalog_source_binding_revision%ROWTYPE; source_mapping uuid; source_epoch bigint;
BEGIN
  IF TG_ARGV[0]='source-support' THEN
    source_mapping := NEW.source_mapping_key; source_epoch := NEW.source_correspondence_revision;
    IF source_mapping IS NULL AND source_epoch IS NULL THEN RETURN NEW; END IF;
  ELSE
    source_mapping := NEW.mapping_key; source_epoch := NEW.correspondence_revision;
  END IF;
  SELECT * INTO anchor FROM public.catalog_source_binding_revision WHERE source_record_id=NEW.source_record_id AND mapping_key=source_mapping AND revision=source_epoch;
  IF NOT FOUND OR anchor.correspondence_revision<>anchor.revision THEN RAISE EXCEPTION 'Source child correspondence requires its exact epoch anchor' USING ERRCODE='23514'; END IF;
  IF TG_ARGV[0]='software-context' THEN
    IF anchor.owner<>'software' OR anchor.software_id IS DISTINCT FROM NEW.content_id THEN
      RAISE EXCEPTION 'Source context correspondence must target its exact software content' USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_ARGV[0]='software-owner' THEN
    IF anchor.owner<>'software' OR anchor.software_id IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Source scalar or component correspondence must target its exact software owner' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS software_context_correspondence_guard ON public.software_participation_source_occurrence;
CREATE TRIGGER software_context_correspondence_guard BEFORE INSERT ON public.software_participation_source_occurrence
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence('software-context');
DROP TRIGGER IF EXISTS software_credit_correspondence_guard ON public.software_participation_credit_source_occurrence;
CREATE TRIGGER software_credit_correspondence_guard BEFORE INSERT ON public.software_participation_credit_source_occurrence
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence('software-context');
DROP TRIGGER IF EXISTS software_record_correspondence_guard ON public.software_record_source_occurrence;
CREATE TRIGGER software_record_correspondence_guard BEFORE INSERT ON public.software_record_source_occurrence
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence('software-owner');
DROP TRIGGER IF EXISTS software_component_correspondence_guard ON public.software_component_source_occurrence;
CREATE TRIGGER software_component_correspondence_guard BEFORE INSERT ON public.software_component_source_occurrence
FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence('software-owner');
DO $$ DECLARE owner_name text; family text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['publishing','music','program','software','entity','grouping','reference','distribution'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_support_correspondence_guard ON public.%I',owner_name || '_fact_support');
    EXECUTE format('CREATE TRIGGER catalog_support_correspondence_guard BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence(%L)',owner_name || '_fact_support','source-support');
    FOREACH family IN ARRAY ARRAY['name_source_binding','name_source_occurrence'] LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS catalog_name_correspondence_guard ON public.%I',owner_name || '_' || family);
      EXECUTE format('CREATE TRIGGER catalog_name_correspondence_guard BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence(%L)',owner_name || '_' || family,'name');
    END LOOP;
  END LOOP;
  FOREACH owner_name IN ARRAY ARRAY['entity','reference'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_profile_correspondence_guard ON public.%I',owner_name || '_profile_source_occurrence');
    EXECUTE format('CREATE TRIGGER catalog_profile_correspondence_guard BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_child_correspondence(%L)',owner_name || '_profile_source_occurrence','profile');
  END LOOP;
END $$;


CREATE OR REPLACE FUNCTION public.catalog_source_validate_application_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE history public.music_component_revision%ROWTYPE; application public.catalog_source_application%ROWTYPE; proposal_state text; after_sequence bigint;
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
    after_sequence := history.component_sequence;
    IF NEW.before_revision_id IS NOT NULL THEN
      SELECT * INTO STRICT history FROM public.music_component_revision WHERE owner_id = NEW.owner_id AND id = NEW.before_revision_id;
      IF history.component <> NEW.component OR history.component_key <> NEW.component_key OR history.component_sequence >= after_sequence THEN
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
  IF application.mapping_key <> proposal.mapping_key THEN RAISE EXCEPTION 'Native application must retain the exact proposal mapping' USING ERRCODE='23514'; END IF;
  IF application.previous_correspondence_revision IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.catalog_source_binding_revision b WHERE b.source_record_id=application.source_record_id AND b.mapping_key=application.mapping_key AND b.revision=application.previous_correspondence_revision AND b.correspondence_revision=b.revision
  ) THEN RAISE EXCEPTION 'Previous native source correspondence must reference an epoch anchor' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.catalog_source_binding_revision b WHERE b.source_record_id=proposal.source_record_id AND b.mapping_key=proposal.mapping_key AND b.revision=proposal.expected_binding_revision AND
    application.previous_snapshot_id IS NOT DISTINCT FROM CASE WHEN application.previous_correspondence_revision=b.correspondence_revision THEN application.previous_observed_snapshot_id ELSE NULL END
  ) THEN RAISE EXCEPTION 'Effective previous source snapshot must match the proposal correspondence epoch' USING ERRCODE='23514'; END IF;
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
      UNION ALL SELECT position FROM public.entity_source_profile_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.reference_source_profile_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.publishing_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.music_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.program_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.software_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.entity_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.grouping_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.reference_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
      UNION ALL SELECT position FROM public.distribution_source_identifier_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.proposal_id AND action=NEW.action
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
  FOREACH relation_name IN ARRAY ARRAY['catalog_source_application','music_source_application_change','software_source_component_application_change','software_source_record_application_change','publishing_source_semantic_application_change','publishing_source_name_application_change','publishing_source_authority_application_change','publishing_source_identifier_application_change','music_source_semantic_application_change','music_source_name_application_change','music_source_authority_application_change','music_source_identifier_application_change','program_source_semantic_application_change','program_source_name_application_change','program_source_authority_application_change','program_source_identifier_application_change','software_source_semantic_application_change','software_source_name_application_change','software_source_authority_application_change','software_source_identifier_application_change','entity_source_semantic_application_change','entity_source_name_application_change','entity_source_authority_application_change','entity_source_identifier_application_change','grouping_source_semantic_application_change','grouping_source_name_application_change','grouping_source_authority_application_change','grouping_source_identifier_application_change','reference_source_semantic_application_change','reference_source_name_application_change','reference_source_authority_application_change','reference_source_identifier_application_change','distribution_source_semantic_application_change','distribution_source_name_application_change','distribution_source_authority_application_change','distribution_source_identifier_application_change','software_source_context_application_change','software_source_participation_application_change','entity_source_profile_application_change','reference_source_profile_application_change'] LOOP
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
      WHERE n.nspname='public' AND c.relname IN ('catalog_source_application','music_source_application_change','software_source_component_application_change','software_source_record_application_change','publishing_source_semantic_application_change','publishing_source_name_application_change','publishing_source_authority_application_change','publishing_source_identifier_application_change','music_source_semantic_application_change','music_source_name_application_change','music_source_authority_application_change','music_source_identifier_application_change','program_source_semantic_application_change','program_source_name_application_change','program_source_authority_application_change','program_source_identifier_application_change','software_source_semantic_application_change','software_source_name_application_change','software_source_authority_application_change','software_source_identifier_application_change','entity_source_semantic_application_change','entity_source_name_application_change','entity_source_authority_application_change','entity_source_identifier_application_change','grouping_source_semantic_application_change','grouping_source_name_application_change','grouping_source_authority_application_change','grouping_source_identifier_application_change','reference_source_semantic_application_change','reference_source_name_application_change','reference_source_authority_application_change','reference_source_identifier_application_change','distribution_source_semantic_application_change','distribution_source_name_application_change','distribution_source_authority_application_change','distribution_source_identifier_application_change','software_source_context_application_change','software_source_participation_application_change','entity_source_profile_application_change','reference_source_profile_application_change')
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


CREATE OR REPLACE FUNCTION public.catalog_source_guard_owned_baseline() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE matched boolean; source_matched boolean; native_head bigint; source_epoch bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Source/native baselines require reviewed retention, not ad hoc deletion' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.source_record_id <> OLD.source_record_id OR NEW.mapping_key <> OLD.mapping_key OR NEW.correspondence_revision <> OLD.correspondence_revision OR NEW.owner_id <> OLD.owner_id OR to_jsonb(NEW)->'component_key' IS DISTINCT FROM to_jsonb(OLD)->'component_key' OR to_jsonb(NEW)->'component' IS DISTINCT FROM to_jsonb(OLD)->'component' OR to_jsonb(NEW)->'kind' IS DISTINCT FROM to_jsonb(OLD)->'kind') THEN
    RAISE EXCEPTION 'Source/native baseline identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.catalog_source_adoption_proposal WHERE source_record_id=NEW.source_record_id AND id=NEW.last_proposal_id AND mapping_key=NEW.mapping_key) THEN
    RAISE EXCEPTION 'Baseline application belongs to another mapping' USING ERRCODE = '23514';
  END IF;
  SELECT r.correspondence_revision INTO STRICT source_epoch
  FROM public.catalog_source_adoption_proposal p JOIN public.catalog_source_binding_revision r
    ON r.source_record_id=p.source_record_id AND r.mapping_key=p.mapping_key AND r.revision=p.expected_binding_revision
  WHERE p.source_record_id=NEW.source_record_id AND p.id=NEW.last_proposal_id;
  IF source_epoch <> NEW.correspondence_revision OR NOT EXISTS (
    SELECT 1 FROM public.catalog_source_binding_revision WHERE source_record_id=NEW.source_record_id
      AND mapping_key=NEW.mapping_key AND revision=NEW.correspondence_revision AND owner=NEW.mapping_owner
  ) THEN RAISE EXCEPTION 'Baseline requires the proposal exact owner correspondence epoch' USING ERRCODE='23514'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.current_revision <= OLD.current_revision THEN
    RAISE EXCEPTION 'Baseline native history must advance' USING ERRCODE = '23514';
  END IF;
  IF TG_ARGV[0] = 'owned' THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE source_record_id=$1 AND proposal_id=$2 AND action=$3 AND owner_id=$4 AND component_key=$5 AND after_revision=$6)', TG_ARGV[1] || CASE NEW.kind WHEN 'catalog-semantic' THEN '_source_semantic_application_change' WHEN 'catalog-name' THEN '_source_name_application_change' WHEN 'catalog-name-authority' THEN '_source_authority_application_change' WHEN 'catalog-identifier' THEN '_source_identifier_application_change' END)
      INTO matched USING NEW.source_record_id, NEW.last_proposal_id, NEW.last_action, NEW.owner_id, NEW.component_key, NEW.current_revision;
  ELSIF TG_ARGV[0] = 'record' THEN
    SELECT EXISTS (SELECT 1 FROM public.software_source_record_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.last_proposal_id AND action=NEW.last_action AND owner_id=NEW.owner_id AND after_revision=NEW.current_revision) INTO matched;
  ELSIF TG_ARGV[0] = 'component' THEN
    SELECT EXISTS (SELECT 1 FROM public.software_source_component_application_change WHERE source_record_id=NEW.source_record_id AND proposal_id=NEW.last_proposal_id AND action=NEW.last_action AND owner_id=NEW.owner_id AND component=NEW.component AND component_key=NEW.component_key AND after_revision=NEW.current_revision) INTO matched;
  ELSE
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE source_record_id=$1 AND proposal_id=$2 AND action=$3 AND owner_id=$4 AND component_key=$5 AND after_revision=$6)', 'software_source_' || TG_ARGV[0] || '_application_change')
      INTO matched USING NEW.source_record_id, NEW.last_proposal_id, NEW.last_action, NEW.owner_id, NEW.component_key, NEW.current_revision;
  END IF;
  IF NOT matched THEN RAISE EXCEPTION 'Baseline current head is not backed by its exact native application' USING ERRCODE = '23514'; END IF;
  IF TG_ARGV[0] = 'owned' THEN
    IF NEW.kind = 'catalog-name' THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE source_record_id=$1 AND snapshot_id=$2 AND owner_id=$3 AND name_id=$4 AND name_revision=$5 AND source_path=$6 AND mapping_key=$7 AND correspondence_revision=$8)', TG_ARGV[1] || '_name_source_occurrence') INTO source_matched USING NEW.source_record_id,NEW.source_snapshot_id,NEW.owner_id,NEW.component_key,NEW.source_revision,NEW.source_path,NEW.mapping_key,source_epoch;
    ELSIF NEW.kind = 'catalog-identifier' THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE source_record_id=$1 AND snapshot_id=$2 AND owner_id=$3 AND identifier_id=$4 AND identifier_revision=$5 AND source_path=$6 AND source_mapping_key=$7 AND source_correspondence_revision=$8)', TG_ARGV[1] || '_fact_support') INTO source_matched USING NEW.source_record_id,NEW.source_snapshot_id,NEW.owner_id,NEW.component_key,NEW.source_revision,NEW.source_path,NEW.mapping_key,source_epoch;
    ELSIF NEW.kind = 'catalog-name-authority' THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE source_record_id=$1 AND snapshot_id=$2 AND owner_id=$3 AND id=$4 AND revision=$5 AND source_path=$6)', TG_ARGV[1] || '_name_authority_revision') INTO source_matched USING NEW.source_record_id,NEW.source_snapshot_id,NEW.owner_id,NEW.component_key,NEW.source_revision,NEW.source_path;
    ELSE
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I s JOIN public.%I v ON v.owner_id=s.owner_id AND v.id=s.fact_id WHERE s.source_record_id=$1 AND s.snapshot_id=$2 AND s.owner_id=$3 AND v.semantic_id=$4 AND v.expected_head_version+1=$5 AND s.source_path=$6 AND s.source_mapping_key=$7 AND s.source_correspondence_revision=$8 UNION ALL SELECT 1 FROM public.%I s JOIN public.%I v ON v.owner_id=s.owner_id AND v.id=s.relation_id WHERE s.source_record_id=$1 AND s.snapshot_id=$2 AND s.owner_id=$3 AND v.semantic_id=$4 AND v.expected_head_version+1=$5 AND s.source_path=$6 AND s.source_mapping_key=$7 AND s.source_correspondence_revision=$8)', TG_ARGV[1] || '_fact_support',TG_ARGV[1] || '_fact',TG_ARGV[1] || '_fact_support',TG_ARGV[1] || '_catalog_relation') INTO source_matched USING NEW.source_record_id,NEW.source_snapshot_id,NEW.owner_id,NEW.component_key,NEW.source_revision,NEW.source_path,NEW.mapping_key,source_epoch;
    END IF;
  ELSIF TG_ARGV[0] = 'record' THEN
    SELECT EXISTS (SELECT 1 FROM public.software_record_source_occurrence WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.source_snapshot_id AND owner_id=NEW.owner_id AND revision=NEW.source_revision AND source_path=NEW.source_path AND mapping_key=NEW.mapping_key AND correspondence_revision=source_epoch) INTO source_matched;
  ELSIF TG_ARGV[0] = 'component' THEN
    SELECT EXISTS (SELECT 1 FROM public.software_component_source_occurrence WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.source_snapshot_id AND owner_id=NEW.owner_id AND component=NEW.component AND component_key=NEW.component_key AND revision=NEW.source_revision AND source_path=NEW.source_path AND mapping_key=NEW.mapping_key AND correspondence_revision=source_epoch) INTO source_matched;
  ELSIF TG_ARGV[0] = 'context' THEN
    SELECT EXISTS (SELECT 1 FROM public.software_participation_source_occurrence WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.source_snapshot_id AND content_id=NEW.owner_id AND context_id=NEW.component_key AND context_revision=NEW.source_revision AND source_pointer=NEW.source_path AND mapping_key=NEW.mapping_key AND correspondence_revision=source_epoch) INTO source_matched;
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.software_participation_credit_source_occurrence WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.source_snapshot_id AND content_id=NEW.owner_id AND participation_id=NEW.component_key AND participation_revision=NEW.source_revision AND source_path=NEW.source_path AND mapping_key=NEW.mapping_key AND correspondence_revision=source_epoch) INTO source_matched;
  END IF;
  IF NOT source_matched THEN RAISE EXCEPTION 'Baseline originating history is not backed by its exact source occurrence' USING ERRCODE = '23514'; END IF;
  IF TG_ARGV[0] = 'owned' THEN
    EXECUTE format('SELECT %I FROM public.%I WHERE owner_id=$1 AND %I=$2', CASE NEW.kind WHEN 'catalog-semantic' THEN 'version' ELSE 'revision' END, TG_ARGV[1] || CASE NEW.kind WHEN 'catalog-semantic' THEN '_semantic_head' WHEN 'catalog-name' THEN '_named_form' WHEN 'catalog-name-authority' THEN '_name_authority' WHEN 'catalog-identifier' THEN '_identifier_claim' END, CASE NEW.kind WHEN 'catalog-semantic' THEN 'semantic_id' ELSE 'id' END) INTO native_head USING NEW.owner_id,NEW.component_key;
  ELSIF TG_ARGV[0] = 'component' THEN
    SELECT revision INTO native_head FROM public.software_component_revision WHERE release_id=NEW.owner_id AND kind=NEW.component AND component_id=NEW.component_key ORDER BY revision DESC LIMIT 1;
  ELSIF TG_ARGV[0] = 'record' THEN
    SELECT revision INTO native_head FROM public.software_record_revision WHERE owner_id=NEW.owner_id ORDER BY revision DESC LIMIT 1;
  ELSE
    EXECUTE format('SELECT current_revision FROM public.%I WHERE content_id=$1 AND id=$2', CASE TG_ARGV[0] WHEN 'context' THEN 'software_participation_context' ELSE 'software_participation' END) INTO native_head USING NEW.owner_id,NEW.component_key;
  END IF;
  IF native_head IS DISTINCT FROM NEW.current_revision THEN RAISE EXCEPTION 'Baseline native history is no longer current' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
DO $$
DECLARE owner_name text; child text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['publishing','music','program','software','entity','grouping','reference','distribution'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_baseline_guard ON public.%I', owner_name || '_source_owned_baseline');
    EXECUTE format('CREATE TRIGGER catalog_source_baseline_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_owned_baseline(%L,%L)', owner_name || '_source_owned_baseline', 'owned', owner_name);
  END LOOP;
  FOREACH child IN ARRAY ARRAY['record','component','context','participation'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_source_baseline_guard ON public.%I', 'software_source_' || child || '_baseline');
    EXECUTE format('CREATE TRIGGER catalog_source_baseline_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_owned_baseline(%L)', 'software_source_' || child || '_baseline', child);
  END LOOP;
  FOREACH child IN ARRAY ARRAY['software_component_source_occurrence','software_record_source_occurrence'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS software_source_occurrence_immutable ON public.%I', child);
    EXECUTE format('CREATE TRIGGER software_source_occurrence_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_immutable_evidence()', child);
  END LOOP;
END $$;


CREATE OR REPLACE FUNCTION public.catalog_validate_profile_source()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE valid boolean;
BEGIN
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE owner_id=$1 AND revision=$2 AND NOT removed)',TG_ARGV[0] || '_catalog_profile_revision') INTO valid USING NEW.owner_id,NEW.revision;
  IF NOT valid THEN RAISE EXCEPTION 'Profile source occurrence requires exact present native history' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_validate_profile_baseline()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE valid boolean; current_revision bigint;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Profile source baselines are retained correspondence' USING ERRCODE='23514'; END IF;
  IF TG_OP='UPDATE' AND (OLD.source_record_id,OLD.mapping_key,OLD.correspondence_revision,OLD.mapping_owner,OLD.owner_id) IS DISTINCT FROM (NEW.source_record_id,NEW.mapping_key,NEW.correspondence_revision,NEW.mapping_owner,NEW.owner_id) THEN
    RAISE EXCEPTION 'Profile source baseline identity is immutable' USING ERRCODE='23514';
  END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE source_record_id=$1 AND snapshot_id=$2 AND owner_id=$3 AND source_path=$4 AND revision=$5 AND mapping_key=$6 AND correspondence_revision=$7)',TG_ARGV[0] || '_profile_source_occurrence') INTO valid USING NEW.source_record_id,NEW.source_snapshot_id,NEW.owner_id,NEW.source_path,NEW.source_revision,NEW.mapping_key,NEW.correspondence_revision;
  IF NOT valid THEN RAISE EXCEPTION 'Profile baseline requires exact immutable source occurrence' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT revision FROM public.%I WHERE owner_id=$1 ORDER BY revision DESC LIMIT 1',TG_ARGV[0] || '_catalog_profile_revision') INTO current_revision USING NEW.owner_id;
  IF current_revision IS DISTINCT FROM NEW.current_revision THEN RAISE EXCEPTION 'Profile baseline must identify the current native profile head' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I c JOIN public.catalog_source_adoption_proposal p ON p.source_record_id=c.source_record_id AND p.id=c.proposal_id WHERE c.source_record_id=$1 AND c.proposal_id=$2 AND c.action=$3 AND c.owner_id=$4 AND c.after_revision=$5 AND p.mapping_key=$6)',TG_ARGV[0] || '_source_profile_application_change') INTO valid USING NEW.source_record_id,NEW.last_proposal_id,NEW.last_action,NEW.owner_id,NEW.current_revision,NEW.mapping_key;
  IF NOT valid THEN RAISE EXCEPTION 'Profile baseline requires its exact native application' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.catalog_source_adoption_proposal p
    JOIN public.catalog_source_binding_revision r ON r.source_record_id=p.source_record_id AND r.mapping_key=p.mapping_key AND r.revision=p.expected_binding_revision
    WHERE p.source_record_id=NEW.source_record_id AND p.id=NEW.last_proposal_id AND r.correspondence_revision=NEW.correspondence_revision AND r.owner=NEW.mapping_owner)
  THEN RAISE EXCEPTION 'Profile baseline requires its proposal owner correspondence epoch' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

DO $$ DECLARE owner_name text;
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['entity','reference'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_profile_source_immutable ON public.%I',owner_name || '_profile_source_occurrence');
    EXECUTE format('CREATE TRIGGER catalog_profile_source_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_immutable_evidence()',owner_name || '_profile_source_occurrence');
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_profile_source_exact ON public.%I',owner_name || '_profile_source_occurrence');
    EXECUTE format('CREATE TRIGGER catalog_profile_source_exact BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_validate_profile_source(%L)',owner_name || '_profile_source_occurrence',owner_name);
    EXECUTE format('DROP TRIGGER IF EXISTS catalog_profile_baseline_exact ON public.%I',owner_name || '_source_profile_baseline');
    EXECUTE format('CREATE TRIGGER catalog_profile_baseline_exact BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_validate_profile_baseline(%L)',owner_name || '_source_profile_baseline',owner_name);
  END LOOP;
END $$;


CREATE OR REPLACE FUNCTION public.catalog_guard_music_component_head()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP='DELETE' OR pg_trigger_depth()<2 THEN
    RAISE EXCEPTION 'Music component heads are maintained by native history capture' USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' AND NEW.component_sequence<>1 THEN
    RAISE EXCEPTION 'Music component history must start at sequence one' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND ((OLD.owner_id,OLD.component,OLD.component_key) IS DISTINCT FROM (NEW.owner_id,NEW.component,NEW.component_key)
    OR NEW.component_sequence<>OLD.component_sequence+1) THEN
    RAISE EXCEPTION 'Music component sequence must advance exactly once' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.music_component_revision WHERE owner_id=NEW.owner_id AND id=NEW.history_id
    AND component=NEW.component AND component_key=NEW.component_key AND component_sequence=NEW.component_sequence) THEN
    RAISE EXCEPTION 'Music component head requires its exact immutable revision' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_component_head_maintained ON public.music_component_head;
CREATE TRIGGER music_component_head_maintained BEFORE INSERT OR UPDATE OR DELETE ON public.music_component_head
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_component_head();

CREATE OR REPLACE FUNCTION public.catalog_guard_music_revision_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF pg_trigger_depth()<2 THEN
    RAISE EXCEPTION 'Music history is captured from native rows, not caller-supplied snapshots' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_component_revision_capture_only ON public.music_component_revision;
CREATE TRIGGER music_component_revision_capture_only BEFORE INSERT ON public.music_component_revision
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_revision_insert();

CREATE OR REPLACE FUNCTION public.catalog_check_music_source_baseline()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE native public.music_component_revision%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.source_record_id, OLD.mapping_key, OLD.correspondence_revision, OLD.owner_id, OLD.component, OLD.component_key)
    IS DISTINCT FROM (NEW.source_record_id, NEW.mapping_key, NEW.correspondence_revision, NEW.owner_id, NEW.component, NEW.component_key) THEN
    RAISE EXCEPTION 'Music source baseline identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.music_component_source_occurrence
    WHERE source_record_id=NEW.source_record_id AND mapping_key=NEW.mapping_key AND correspondence_revision=NEW.correspondence_revision AND snapshot_id=NEW.snapshot_id AND owner_id=NEW.owner_id
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
  IF NOT EXISTS (SELECT 1 FROM public.catalog_source_adoption_proposal p
    JOIN public.catalog_source_binding_revision r ON r.source_record_id=p.source_record_id AND r.mapping_key=p.mapping_key AND r.revision=p.expected_binding_revision
    WHERE p.source_record_id=NEW.source_record_id AND p.id=NEW.proposal_id AND r.correspondence_revision=NEW.correspondence_revision AND r.owner=NEW.mapping_owner)
  THEN RAISE EXCEPTION 'Music baseline requires its proposal owner correspondence epoch' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_source_baseline_proof ON public.music_component_source_baseline;
CREATE TRIGGER music_source_baseline_proof BEFORE INSERT OR UPDATE ON public.music_component_source_baseline
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_source_baseline();

-- Shared alternate text/credit values are replaced through exact occurrence revisions.
DROP TRIGGER IF EXISTS music_alternative_track_immutable ON public.music_alternative_track;
CREATE TRIGGER music_alternative_track_immutable BEFORE UPDATE OR DELETE ON public.music_alternative_track
  FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_music_history();

CREATE OR REPLACE FUNCTION public.catalog_check_music_definition_scope()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE revision_id uuid; policy jsonb;
BEGIN
  revision_id := (to_jsonb(NEW)->>TG_ARGV[0])::uuid;
  IF revision_id IS NULL THEN RETURN NEW; END IF;
  SELECT revision.constraints INTO policy FROM public.catalog_definition_revision revision
    JOIN public.catalog_definition definition ON definition.id=revision.definition_id
    WHERE revision.id=revision_id AND definition.kind='vocabulary';
  IF policy IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(policy->'targets','[]'::jsonb)) target
    WHERE target->>'owner'='music' AND coalesce(target->'shapes','[]'::jsonb) ? TG_ARGV[1])
    OR NOT (coalesce(policy->'slots','[]'::jsonb) ? TG_ARGV[2]) THEN
    RAISE EXCEPTION 'Music vocabulary is outside its governed native target or slot'
      USING ERRCODE='23514', CONSTRAINT='music_definition_target_scope';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS music_release_status_scope ON public.music_release;
CREATE TRIGGER music_release_status_scope BEFORE INSERT OR UPDATE ON public.music_release
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('status_revision_id','release','music_release.status_revision_id');
DROP TRIGGER IF EXISTS music_release_packaging_scope ON public.music_release;
CREATE TRIGGER music_release_packaging_scope BEFORE INSERT OR UPDATE ON public.music_release
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('packaging_revision_id','release','music_release.packaging_revision_id');
DROP TRIGGER IF EXISTS music_medium_format_scope ON public.music_medium;
CREATE TRIGGER music_medium_format_scope BEFORE INSERT OR UPDATE ON public.music_medium
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('format_revision_id','release','music_medium.format_revision_id');
DROP TRIGGER IF EXISTS music_work_type_scope ON public.music_work;
CREATE TRIGGER music_work_type_scope BEFORE INSERT OR UPDATE ON public.music_work
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('type_revision_id','work','music_work.type_revision_id');
DROP TRIGGER IF EXISTS music_release_group_primary_scope ON public.music_release_group;
CREATE TRIGGER music_release_group_primary_scope BEFORE INSERT OR UPDATE ON public.music_release_group
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('primary_type_revision_id','release_group','music_release_group.primary_type_revision_id');
DROP TRIGGER IF EXISTS music_release_group_secondary_scope ON public.music_release_group_secondary_type;
CREATE TRIGGER music_release_group_secondary_scope BEFORE INSERT OR UPDATE ON public.music_release_group_secondary_type
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('type_revision_id','release_group','music_release_group_secondary_type.type_revision_id');
DROP TRIGGER IF EXISTS music_release_presentation_type_scope ON public.music_release_presentation;
CREATE TRIGGER music_release_presentation_type_scope BEFORE INSERT OR UPDATE ON public.music_release_presentation
  FOR EACH ROW EXECUTE FUNCTION public.catalog_check_music_definition_scope('type_revision_id','release','music_release_presentation.type_revision_id');
