SET search_path TO public;

-- Create "distribution_source_owned_baseline" table
CREATE TABLE "distribution_source_owned_baseline" (
  "source_record_id" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'distribution',
  "mapping_key" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "source_snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "source_revision" bigint NOT NULL,
  "current_revision" bigint NOT NULL,
  "absent" boolean NOT NULL DEFAULT false,
  "last_proposal_id" uuid NOT NULL,
  "last_action" text NOT NULL,
  "kind" text NOT NULL,
  "component_key" uuid NOT NULL,
  "semantic_id" uuid NULL,
  "name_id" uuid NULL,
  "authority_id" uuid NULL,
  PRIMARY KEY ("source_record_id", "mapping_key", "owner_id", "kind", "component_key"),
  CONSTRAINT "distribution_owned_base_authority_current_fk" FOREIGN KEY ("owner_id", "authority_id", "current_revision") REFERENCES "distribution_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_owned_base_authority_source_fk" FOREIGN KEY ("owner_id", "authority_id", "source_revision") REFERENCES "distribution_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_owned_base_name_current_fk" FOREIGN KEY ("owner_id", "name_id", "current_revision") REFERENCES "distribution_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_owned_base_name_source_fk" FOREIGN KEY ("owner_id", "name_id", "source_revision") REFERENCES "distribution_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_owned_base_semantic_current_fk" FOREIGN KEY ("owner_id", "semantic_id", "current_revision") REFERENCES "distribution_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_owned_base_semantic_source_fk" FOREIGN KEY ("owner_id", "semantic_id", "source_revision") REFERENCES "distribution_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_source_owned_base_application_fk" FOREIGN KEY ("source_record_id", "last_proposal_id", "last_action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_source_owned_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_source_owned_base_snapshot_fk" FOREIGN KEY ("source_record_id", "source_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "distribution_source_owned_base_kind" CHECK ((num_nonnulls(semantic_id, name_id, authority_id) = 1) AND (((kind = 'catalog-semantic'::text) AND (component_key = semantic_id)) OR ((kind = 'catalog-name'::text) AND (component_key = name_id)) OR ((kind = 'catalog-name-authority'::text) AND (component_key = authority_id)))),
  CONSTRAINT "distribution_source_owned_base_owner" CHECK (mapping_owner = 'distribution'::text),
  CONSTRAINT "distribution_source_owned_base_values" CHECK (((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ((source_revision >= 1) AND (source_revision <= '9007199254740991'::bigint)) AND ((current_revision >= 1) AND (current_revision <= '9007199254740991'::bigint)))
) PARTITION BY HASH ("source_record_id");
-- Create "entity_source_owned_baseline" table
CREATE TABLE "entity_source_owned_baseline" (
  "source_record_id" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'entity',
  "mapping_key" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "source_snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "source_revision" bigint NOT NULL,
  "current_revision" bigint NOT NULL,
  "absent" boolean NOT NULL DEFAULT false,
  "last_proposal_id" uuid NOT NULL,
  "last_action" text NOT NULL,
  "kind" text NOT NULL,
  "component_key" uuid NOT NULL,
  "semantic_id" uuid NULL,
  "name_id" uuid NULL,
  "authority_id" uuid NULL,
  PRIMARY KEY ("source_record_id", "mapping_key", "owner_id", "kind", "component_key"),
  CONSTRAINT "entity_owned_base_authority_current_fk" FOREIGN KEY ("owner_id", "authority_id", "current_revision") REFERENCES "entity_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_owned_base_authority_source_fk" FOREIGN KEY ("owner_id", "authority_id", "source_revision") REFERENCES "entity_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_owned_base_name_current_fk" FOREIGN KEY ("owner_id", "name_id", "current_revision") REFERENCES "entity_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_owned_base_name_source_fk" FOREIGN KEY ("owner_id", "name_id", "source_revision") REFERENCES "entity_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_owned_base_semantic_current_fk" FOREIGN KEY ("owner_id", "semantic_id", "current_revision") REFERENCES "entity_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_owned_base_semantic_source_fk" FOREIGN KEY ("owner_id", "semantic_id", "source_revision") REFERENCES "entity_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_source_owned_base_application_fk" FOREIGN KEY ("source_record_id", "last_proposal_id", "last_action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_source_owned_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_source_owned_base_snapshot_fk" FOREIGN KEY ("source_record_id", "source_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_source_owned_base_kind" CHECK ((num_nonnulls(semantic_id, name_id, authority_id) = 1) AND (((kind = 'catalog-semantic'::text) AND (component_key = semantic_id)) OR ((kind = 'catalog-name'::text) AND (component_key = name_id)) OR ((kind = 'catalog-name-authority'::text) AND (component_key = authority_id)))),
  CONSTRAINT "entity_source_owned_base_owner" CHECK (mapping_owner = 'entity'::text),
  CONSTRAINT "entity_source_owned_base_values" CHECK (((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ((source_revision >= 1) AND (source_revision <= '9007199254740991'::bigint)) AND ((current_revision >= 1) AND (current_revision <= '9007199254740991'::bigint)))
) PARTITION BY HASH ("source_record_id");
-- Create "grouping_source_owned_baseline" table
CREATE TABLE "grouping_source_owned_baseline" (
  "source_record_id" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'grouping',
  "mapping_key" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "source_snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "source_revision" bigint NOT NULL,
  "current_revision" bigint NOT NULL,
  "absent" boolean NOT NULL DEFAULT false,
  "last_proposal_id" uuid NOT NULL,
  "last_action" text NOT NULL,
  "kind" text NOT NULL,
  "component_key" uuid NOT NULL,
  "semantic_id" uuid NULL,
  "name_id" uuid NULL,
  "authority_id" uuid NULL,
  PRIMARY KEY ("source_record_id", "mapping_key", "owner_id", "kind", "component_key"),
  CONSTRAINT "grouping_owned_base_authority_current_fk" FOREIGN KEY ("owner_id", "authority_id", "current_revision") REFERENCES "grouping_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_owned_base_authority_source_fk" FOREIGN KEY ("owner_id", "authority_id", "source_revision") REFERENCES "grouping_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_owned_base_name_current_fk" FOREIGN KEY ("owner_id", "name_id", "current_revision") REFERENCES "grouping_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_owned_base_name_source_fk" FOREIGN KEY ("owner_id", "name_id", "source_revision") REFERENCES "grouping_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_owned_base_semantic_current_fk" FOREIGN KEY ("owner_id", "semantic_id", "current_revision") REFERENCES "grouping_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_owned_base_semantic_source_fk" FOREIGN KEY ("owner_id", "semantic_id", "source_revision") REFERENCES "grouping_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_source_owned_base_application_fk" FOREIGN KEY ("source_record_id", "last_proposal_id", "last_action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_source_owned_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_source_owned_base_snapshot_fk" FOREIGN KEY ("source_record_id", "source_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_source_owned_base_kind" CHECK ((num_nonnulls(semantic_id, name_id, authority_id) = 1) AND (((kind = 'catalog-semantic'::text) AND (component_key = semantic_id)) OR ((kind = 'catalog-name'::text) AND (component_key = name_id)) OR ((kind = 'catalog-name-authority'::text) AND (component_key = authority_id)))),
  CONSTRAINT "grouping_source_owned_base_owner" CHECK (mapping_owner = 'grouping'::text),
  CONSTRAINT "grouping_source_owned_base_values" CHECK (((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ((source_revision >= 1) AND (source_revision <= '9007199254740991'::bigint)) AND ((current_revision >= 1) AND (current_revision <= '9007199254740991'::bigint)))
) PARTITION BY HASH ("source_record_id");
-- Create "music_source_owned_baseline" table
CREATE TABLE "music_source_owned_baseline" (
  "source_record_id" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'music',
  "mapping_key" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "source_snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "source_revision" bigint NOT NULL,
  "current_revision" bigint NOT NULL,
  "absent" boolean NOT NULL DEFAULT false,
  "last_proposal_id" uuid NOT NULL,
  "last_action" text NOT NULL,
  "kind" text NOT NULL,
  "component_key" uuid NOT NULL,
  "semantic_id" uuid NULL,
  "name_id" uuid NULL,
  "authority_id" uuid NULL,
  PRIMARY KEY ("source_record_id", "mapping_key", "owner_id", "kind", "component_key"),
  CONSTRAINT "music_owned_base_authority_current_fk" FOREIGN KEY ("owner_id", "authority_id", "current_revision") REFERENCES "music_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_owned_base_authority_source_fk" FOREIGN KEY ("owner_id", "authority_id", "source_revision") REFERENCES "music_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_owned_base_name_current_fk" FOREIGN KEY ("owner_id", "name_id", "current_revision") REFERENCES "music_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_owned_base_name_source_fk" FOREIGN KEY ("owner_id", "name_id", "source_revision") REFERENCES "music_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_owned_base_semantic_current_fk" FOREIGN KEY ("owner_id", "semantic_id", "current_revision") REFERENCES "music_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_owned_base_semantic_source_fk" FOREIGN KEY ("owner_id", "semantic_id", "source_revision") REFERENCES "music_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_source_owned_base_application_fk" FOREIGN KEY ("source_record_id", "last_proposal_id", "last_action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_source_owned_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_source_owned_base_snapshot_fk" FOREIGN KEY ("source_record_id", "source_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_source_owned_base_kind" CHECK ((num_nonnulls(semantic_id, name_id, authority_id) = 1) AND (((kind = 'catalog-semantic'::text) AND (component_key = semantic_id)) OR ((kind = 'catalog-name'::text) AND (component_key = name_id)) OR ((kind = 'catalog-name-authority'::text) AND (component_key = authority_id)))),
  CONSTRAINT "music_source_owned_base_owner" CHECK (mapping_owner = 'music'::text),
  CONSTRAINT "music_source_owned_base_values" CHECK (((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ((source_revision >= 1) AND (source_revision <= '9007199254740991'::bigint)) AND ((current_revision >= 1) AND (current_revision <= '9007199254740991'::bigint)))
) PARTITION BY HASH ("source_record_id");
-- Create "program_source_owned_baseline" table
CREATE TABLE "program_source_owned_baseline" (
  "source_record_id" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'program',
  "mapping_key" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "source_snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "source_revision" bigint NOT NULL,
  "current_revision" bigint NOT NULL,
  "absent" boolean NOT NULL DEFAULT false,
  "last_proposal_id" uuid NOT NULL,
  "last_action" text NOT NULL,
  "kind" text NOT NULL,
  "component_key" uuid NOT NULL,
  "semantic_id" uuid NULL,
  "name_id" uuid NULL,
  "authority_id" uuid NULL,
  PRIMARY KEY ("source_record_id", "mapping_key", "owner_id", "kind", "component_key"),
  CONSTRAINT "program_owned_base_authority_current_fk" FOREIGN KEY ("owner_id", "authority_id", "current_revision") REFERENCES "program_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_owned_base_authority_source_fk" FOREIGN KEY ("owner_id", "authority_id", "source_revision") REFERENCES "program_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_owned_base_name_current_fk" FOREIGN KEY ("owner_id", "name_id", "current_revision") REFERENCES "program_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_owned_base_name_source_fk" FOREIGN KEY ("owner_id", "name_id", "source_revision") REFERENCES "program_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_owned_base_semantic_current_fk" FOREIGN KEY ("owner_id", "semantic_id", "current_revision") REFERENCES "program_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_owned_base_semantic_source_fk" FOREIGN KEY ("owner_id", "semantic_id", "source_revision") REFERENCES "program_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_source_owned_base_application_fk" FOREIGN KEY ("source_record_id", "last_proposal_id", "last_action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_source_owned_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_source_owned_base_snapshot_fk" FOREIGN KEY ("source_record_id", "source_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_source_owned_base_kind" CHECK ((num_nonnulls(semantic_id, name_id, authority_id) = 1) AND (((kind = 'catalog-semantic'::text) AND (component_key = semantic_id)) OR ((kind = 'catalog-name'::text) AND (component_key = name_id)) OR ((kind = 'catalog-name-authority'::text) AND (component_key = authority_id)))),
  CONSTRAINT "program_source_owned_base_owner" CHECK (mapping_owner = 'program'::text),
  CONSTRAINT "program_source_owned_base_values" CHECK (((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ((source_revision >= 1) AND (source_revision <= '9007199254740991'::bigint)) AND ((current_revision >= 1) AND (current_revision <= '9007199254740991'::bigint)))
) PARTITION BY HASH ("source_record_id");
-- Create "publishing_source_owned_baseline" table
CREATE TABLE "publishing_source_owned_baseline" (
  "source_record_id" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'publishing',
  "mapping_key" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "source_snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "source_revision" bigint NOT NULL,
  "current_revision" bigint NOT NULL,
  "absent" boolean NOT NULL DEFAULT false,
  "last_proposal_id" uuid NOT NULL,
  "last_action" text NOT NULL,
  "kind" text NOT NULL,
  "component_key" uuid NOT NULL,
  "semantic_id" uuid NULL,
  "name_id" uuid NULL,
  "authority_id" uuid NULL,
  PRIMARY KEY ("source_record_id", "mapping_key", "owner_id", "kind", "component_key"),
  CONSTRAINT "publishing_owned_base_authority_current_fk" FOREIGN KEY ("owner_id", "authority_id", "current_revision") REFERENCES "publishing_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_owned_base_authority_source_fk" FOREIGN KEY ("owner_id", "authority_id", "source_revision") REFERENCES "publishing_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_owned_base_name_current_fk" FOREIGN KEY ("owner_id", "name_id", "current_revision") REFERENCES "publishing_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_owned_base_name_source_fk" FOREIGN KEY ("owner_id", "name_id", "source_revision") REFERENCES "publishing_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_owned_base_semantic_current_fk" FOREIGN KEY ("owner_id", "semantic_id", "current_revision") REFERENCES "publishing_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_owned_base_semantic_source_fk" FOREIGN KEY ("owner_id", "semantic_id", "source_revision") REFERENCES "publishing_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_source_owned_base_application_fk" FOREIGN KEY ("source_record_id", "last_proposal_id", "last_action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_source_owned_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_source_owned_base_snapshot_fk" FOREIGN KEY ("source_record_id", "source_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_source_owned_base_kind" CHECK ((num_nonnulls(semantic_id, name_id, authority_id) = 1) AND (((kind = 'catalog-semantic'::text) AND (component_key = semantic_id)) OR ((kind = 'catalog-name'::text) AND (component_key = name_id)) OR ((kind = 'catalog-name-authority'::text) AND (component_key = authority_id)))),
  CONSTRAINT "publishing_source_owned_base_owner" CHECK (mapping_owner = 'publishing'::text),
  CONSTRAINT "publishing_source_owned_base_values" CHECK (((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ((source_revision >= 1) AND (source_revision <= '9007199254740991'::bigint)) AND ((current_revision >= 1) AND (current_revision <= '9007199254740991'::bigint)))
) PARTITION BY HASH ("source_record_id");
-- Create "reference_source_owned_baseline" table
CREATE TABLE "reference_source_owned_baseline" (
  "source_record_id" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'reference',
  "mapping_key" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "source_snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "source_revision" bigint NOT NULL,
  "current_revision" bigint NOT NULL,
  "absent" boolean NOT NULL DEFAULT false,
  "last_proposal_id" uuid NOT NULL,
  "last_action" text NOT NULL,
  "kind" text NOT NULL,
  "component_key" uuid NOT NULL,
  "semantic_id" uuid NULL,
  "name_id" uuid NULL,
  "authority_id" uuid NULL,
  PRIMARY KEY ("source_record_id", "mapping_key", "owner_id", "kind", "component_key"),
  CONSTRAINT "reference_owned_base_authority_current_fk" FOREIGN KEY ("owner_id", "authority_id", "current_revision") REFERENCES "reference_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_owned_base_authority_source_fk" FOREIGN KEY ("owner_id", "authority_id", "source_revision") REFERENCES "reference_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_owned_base_name_current_fk" FOREIGN KEY ("owner_id", "name_id", "current_revision") REFERENCES "reference_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_owned_base_name_source_fk" FOREIGN KEY ("owner_id", "name_id", "source_revision") REFERENCES "reference_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_owned_base_semantic_current_fk" FOREIGN KEY ("owner_id", "semantic_id", "current_revision") REFERENCES "reference_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_owned_base_semantic_source_fk" FOREIGN KEY ("owner_id", "semantic_id", "source_revision") REFERENCES "reference_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_source_owned_base_application_fk" FOREIGN KEY ("source_record_id", "last_proposal_id", "last_action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_source_owned_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_source_owned_base_snapshot_fk" FOREIGN KEY ("source_record_id", "source_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_source_owned_base_kind" CHECK ((num_nonnulls(semantic_id, name_id, authority_id) = 1) AND (((kind = 'catalog-semantic'::text) AND (component_key = semantic_id)) OR ((kind = 'catalog-name'::text) AND (component_key = name_id)) OR ((kind = 'catalog-name-authority'::text) AND (component_key = authority_id)))),
  CONSTRAINT "reference_source_owned_base_owner" CHECK (mapping_owner = 'reference'::text),
  CONSTRAINT "reference_source_owned_base_values" CHECK (((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ((source_revision >= 1) AND (source_revision <= '9007199254740991'::bigint)) AND ((current_revision >= 1) AND (current_revision <= '9007199254740991'::bigint)))
) PARTITION BY HASH ("source_record_id");
-- Create "software_component_source_occurrence" table
CREATE TABLE "software_component_source_occurrence" (
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  "revision" bigint NOT NULL,
  "source_path" text NOT NULL,
  PRIMARY KEY ("source_record_id", "snapshot_id", "owner_id", "component", "component_key"),
  CONSTRAINT "software_component_source_revision_fk" FOREIGN KEY ("owner_id", "component", "component_key", "revision") REFERENCES "software_component_revision" ("release_id", "kind", "component_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_component_source_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_component_source_path_check" CHECK (((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ("left"(source_path, 1) = '/'::text))
) PARTITION BY HASH ("source_record_id");
-- Create "software_record_source_occurrence" table
CREATE TABLE "software_record_source_occurrence" (
  "source_record_id" uuid NOT NULL,
  "snapshot_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "revision" bigint NOT NULL,
  "source_path" text NOT NULL,
  PRIMARY KEY ("source_record_id", "snapshot_id", "owner_id"),
  CONSTRAINT "software_record_source_revision_fk" FOREIGN KEY ("owner_id", "revision") REFERENCES "software_record_revision" ("owner_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_record_source_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_record_source_path_check" CHECK (((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ("left"(source_path, 1) = '/'::text))
) PARTITION BY HASH ("source_record_id");
-- Create "software_source_component_baseline" table
CREATE TABLE "software_source_component_baseline" (
  "source_record_id" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'software',
  "mapping_key" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "source_snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "source_revision" bigint NOT NULL,
  "current_revision" bigint NOT NULL,
  "absent" boolean NOT NULL DEFAULT false,
  "last_proposal_id" uuid NOT NULL,
  "last_action" text NOT NULL,
  "component" text NOT NULL,
  "component_key" text NOT NULL,
  PRIMARY KEY ("source_record_id", "mapping_key", "owner_id", "component", "component_key"),
  CONSTRAINT "software_component_base_current_fk" FOREIGN KEY ("owner_id", "component", "component_key", "current_revision") REFERENCES "software_component_revision" ("release_id", "kind", "component_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_component_base_source_fk" FOREIGN KEY ("owner_id", "component", "component_key", "source_revision") REFERENCES "software_component_revision" ("release_id", "kind", "component_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_component_base_application_fk" FOREIGN KEY ("source_record_id", "last_proposal_id", "last_action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_component_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_component_base_snapshot_fk" FOREIGN KEY ("source_record_id", "source_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_component_base_owner" CHECK (mapping_owner = 'software'::text),
  CONSTRAINT "software_source_component_base_values" CHECK (((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ((source_revision >= 1) AND (source_revision <= '9007199254740991'::bigint)) AND ((current_revision >= 1) AND (current_revision <= '9007199254740991'::bigint)))
) PARTITION BY HASH ("source_record_id");
-- Create "software_source_context_baseline" table
CREATE TABLE "software_source_context_baseline" (
  "source_record_id" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'software',
  "mapping_key" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "source_snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "source_revision" bigint NOT NULL,
  "current_revision" bigint NOT NULL,
  "absent" boolean NOT NULL DEFAULT false,
  "last_proposal_id" uuid NOT NULL,
  "last_action" text NOT NULL,
  "component_key" uuid NOT NULL,
  PRIMARY KEY ("source_record_id", "mapping_key", "owner_id", "component_key"),
  CONSTRAINT "software_context_base_current_fk" FOREIGN KEY ("owner_id", "component_key", "current_revision") REFERENCES "software_participation_context_revision" ("content_id", "context_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_context_base_source_fk" FOREIGN KEY ("owner_id", "component_key", "source_revision") REFERENCES "software_participation_context_revision" ("content_id", "context_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_context_base_application_fk" FOREIGN KEY ("source_record_id", "last_proposal_id", "last_action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_context_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_context_base_snapshot_fk" FOREIGN KEY ("source_record_id", "source_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_context_base_owner" CHECK (mapping_owner = 'software'::text),
  CONSTRAINT "software_source_context_base_values" CHECK (((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ((source_revision >= 1) AND (source_revision <= '9007199254740991'::bigint)) AND ((current_revision >= 1) AND (current_revision <= '9007199254740991'::bigint)))
) PARTITION BY HASH ("source_record_id");
-- Create "software_source_owned_baseline" table
CREATE TABLE "software_source_owned_baseline" (
  "source_record_id" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'software',
  "mapping_key" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "source_snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "source_revision" bigint NOT NULL,
  "current_revision" bigint NOT NULL,
  "absent" boolean NOT NULL DEFAULT false,
  "last_proposal_id" uuid NOT NULL,
  "last_action" text NOT NULL,
  "kind" text NOT NULL,
  "component_key" uuid NOT NULL,
  "semantic_id" uuid NULL,
  "name_id" uuid NULL,
  "authority_id" uuid NULL,
  PRIMARY KEY ("source_record_id", "mapping_key", "owner_id", "kind", "component_key"),
  CONSTRAINT "software_owned_base_authority_current_fk" FOREIGN KEY ("owner_id", "authority_id", "current_revision") REFERENCES "software_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_owned_base_authority_source_fk" FOREIGN KEY ("owner_id", "authority_id", "source_revision") REFERENCES "software_name_authority_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_owned_base_name_current_fk" FOREIGN KEY ("owner_id", "name_id", "current_revision") REFERENCES "software_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_owned_base_name_source_fk" FOREIGN KEY ("owner_id", "name_id", "source_revision") REFERENCES "software_named_form_revision" ("owner_id", "id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_owned_base_semantic_current_fk" FOREIGN KEY ("owner_id", "semantic_id", "current_revision") REFERENCES "software_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_owned_base_semantic_source_fk" FOREIGN KEY ("owner_id", "semantic_id", "source_revision") REFERENCES "software_semantic_revision" ("owner_id", "semantic_id", "version") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_owned_base_application_fk" FOREIGN KEY ("source_record_id", "last_proposal_id", "last_action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_owned_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_owned_base_snapshot_fk" FOREIGN KEY ("source_record_id", "source_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_owned_base_kind" CHECK ((num_nonnulls(semantic_id, name_id, authority_id) = 1) AND (((kind = 'catalog-semantic'::text) AND (component_key = semantic_id)) OR ((kind = 'catalog-name'::text) AND (component_key = name_id)) OR ((kind = 'catalog-name-authority'::text) AND (component_key = authority_id)))),
  CONSTRAINT "software_source_owned_base_owner" CHECK (mapping_owner = 'software'::text),
  CONSTRAINT "software_source_owned_base_values" CHECK (((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ((source_revision >= 1) AND (source_revision <= '9007199254740991'::bigint)) AND ((current_revision >= 1) AND (current_revision <= '9007199254740991'::bigint)))
) PARTITION BY HASH ("source_record_id");
-- Create "software_source_participation_baseline" table
CREATE TABLE "software_source_participation_baseline" (
  "source_record_id" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'software',
  "mapping_key" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "source_snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "source_revision" bigint NOT NULL,
  "current_revision" bigint NOT NULL,
  "absent" boolean NOT NULL DEFAULT false,
  "last_proposal_id" uuid NOT NULL,
  "last_action" text NOT NULL,
  "component_key" uuid NOT NULL,
  PRIMARY KEY ("source_record_id", "mapping_key", "owner_id", "component_key"),
  CONSTRAINT "software_participation_base_current_fk" FOREIGN KEY ("owner_id", "component_key", "current_revision") REFERENCES "software_participation_revision" ("content_id", "participation_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_participation_base_source_fk" FOREIGN KEY ("owner_id", "component_key", "source_revision") REFERENCES "software_participation_revision" ("content_id", "participation_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_participation_base_application_fk" FOREIGN KEY ("source_record_id", "last_proposal_id", "last_action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_participation_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_participation_base_snapshot_fk" FOREIGN KEY ("source_record_id", "source_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_participation_base_owner" CHECK (mapping_owner = 'software'::text),
  CONSTRAINT "software_source_participation_base_values" CHECK (((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ((source_revision >= 1) AND (source_revision <= '9007199254740991'::bigint)) AND ((current_revision >= 1) AND (current_revision <= '9007199254740991'::bigint)))
) PARTITION BY HASH ("source_record_id");
-- Create "software_source_record_baseline" table
CREATE TABLE "software_source_record_baseline" (
  "source_record_id" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'software',
  "mapping_key" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "source_snapshot_id" uuid NOT NULL,
  "source_path" text NOT NULL,
  "source_revision" bigint NOT NULL,
  "current_revision" bigint NOT NULL,
  "absent" boolean NOT NULL DEFAULT false,
  "last_proposal_id" uuid NOT NULL,
  "last_action" text NOT NULL,
  PRIMARY KEY ("source_record_id", "mapping_key", "owner_id"),
  CONSTRAINT "software_record_base_current_fk" FOREIGN KEY ("owner_id", "current_revision") REFERENCES "software_record_revision" ("owner_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_record_base_source_fk" FOREIGN KEY ("owner_id", "source_revision") REFERENCES "software_record_revision" ("owner_id", "revision") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_record_base_application_fk" FOREIGN KEY ("source_record_id", "last_proposal_id", "last_action") REFERENCES "catalog_source_application" ("source_record_id", "proposal_id", "action") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_record_base_mapping_fk" FOREIGN KEY ("source_record_id", "mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("source_record_id", "mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_record_base_snapshot_fk" FOREIGN KEY ("source_record_id", "source_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_record_base_owner" CHECK (mapping_owner = 'software'::text),
  CONSTRAINT "software_source_record_base_values" CHECK (((octet_length(source_path) >= 1) AND (octet_length(source_path) <= 512)) AND ((source_revision >= 1) AND (source_revision <= '9007199254740991'::bigint)) AND ((current_revision >= 1) AND (current_revision <= '9007199254740991'::bigint)))
) PARTITION BY HASH ("source_record_id");

DO $$
DECLARE parent_name text; owner_name text; partition_number integer; parents text[] := ARRAY['software_source_record_baseline','software_source_component_baseline','software_source_context_baseline','software_source_participation_baseline','software_record_source_occurrence','software_component_source_occurrence'];
BEGIN
  FOREACH owner_name IN ARRAY ARRAY['publishing','music','program','software','entity','grouping','reference','distribution'] LOOP
    parents := array_append(parents, owner_name || '_source_owned_baseline');
  END LOOP;
  FOREACH parent_name IN ARRAY parents LOOP
    FOR partition_number IN 0..63 LOOP
      EXECUTE format('CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES WITH (MODULUS 64, REMAINDER %s)', parent_name || '_p' || lpad(partition_number::text, 2, '0'), parent_name, partition_number);
    END LOOP;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.catalog_source_guard_owned_baseline() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE matched boolean; source_matched boolean; native_head bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Source/native baselines require reviewed retention, not ad hoc deletion' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.source_record_id <> OLD.source_record_id OR NEW.mapping_key <> OLD.mapping_key OR NEW.owner_id <> OLD.owner_id OR to_jsonb(NEW)->'component_key' IS DISTINCT FROM to_jsonb(OLD)->'component_key' OR to_jsonb(NEW)->'component' IS DISTINCT FROM to_jsonb(OLD)->'component' OR to_jsonb(NEW)->'kind' IS DISTINCT FROM to_jsonb(OLD)->'kind') THEN
    RAISE EXCEPTION 'Source/native baseline identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.catalog_source_adoption_proposal WHERE source_record_id=NEW.source_record_id AND id=NEW.last_proposal_id AND mapping_key=NEW.mapping_key) THEN
    RAISE EXCEPTION 'Baseline application belongs to another mapping' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.current_revision <= OLD.current_revision THEN
    RAISE EXCEPTION 'Baseline native history must advance' USING ERRCODE = '23514';
  END IF;
  IF TG_ARGV[0] = 'owned' THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE source_record_id=$1 AND proposal_id=$2 AND action=$3 AND owner_id=$4 AND component_key=$5 AND after_revision=$6)', TG_ARGV[1] || CASE NEW.kind WHEN 'catalog-semantic' THEN '_source_semantic_application_change' WHEN 'catalog-name' THEN '_source_name_application_change' WHEN 'catalog-name-authority' THEN '_source_authority_application_change' END)
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
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE source_record_id=$1 AND snapshot_id=$2 AND owner_id=$3 AND name_id=$4 AND name_revision=$5 AND source_path=$6)', TG_ARGV[1] || '_name_source_occurrence') INTO source_matched USING NEW.source_record_id,NEW.source_snapshot_id,NEW.owner_id,NEW.component_key,NEW.source_revision,NEW.source_path;
    ELSIF NEW.kind = 'catalog-name-authority' THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE source_record_id=$1 AND snapshot_id=$2 AND owner_id=$3 AND id=$4 AND revision=$5 AND source_path=$6)', TG_ARGV[1] || '_name_authority_revision') INTO source_matched USING NEW.source_record_id,NEW.source_snapshot_id,NEW.owner_id,NEW.component_key,NEW.source_revision,NEW.source_path;
    ELSE
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I s JOIN public.%I v ON v.owner_id=s.owner_id AND v.id=s.fact_id WHERE s.source_record_id=$1 AND s.snapshot_id=$2 AND s.owner_id=$3 AND v.semantic_id=$4 AND v.expected_head_version+1=$5 AND s.source_path=$6 UNION ALL SELECT 1 FROM public.%I s JOIN public.%I v ON v.owner_id=s.owner_id AND v.id=s.relation_id WHERE s.source_record_id=$1 AND s.snapshot_id=$2 AND s.owner_id=$3 AND v.semantic_id=$4 AND v.expected_head_version+1=$5 AND s.source_path=$6)', TG_ARGV[1] || '_fact_support',TG_ARGV[1] || '_fact',TG_ARGV[1] || '_fact_support',TG_ARGV[1] || '_catalog_relation') INTO source_matched USING NEW.source_record_id,NEW.source_snapshot_id,NEW.owner_id,NEW.component_key,NEW.source_revision,NEW.source_path;
    END IF;
  ELSIF TG_ARGV[0] = 'record' THEN
    SELECT EXISTS (SELECT 1 FROM public.software_record_source_occurrence WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.source_snapshot_id AND owner_id=NEW.owner_id AND revision=NEW.source_revision AND source_path=NEW.source_path) INTO source_matched;
  ELSIF TG_ARGV[0] = 'component' THEN
    SELECT EXISTS (SELECT 1 FROM public.software_component_source_occurrence WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.source_snapshot_id AND owner_id=NEW.owner_id AND component=NEW.component AND component_key=NEW.component_key AND revision=NEW.source_revision AND source_path=NEW.source_path) INTO source_matched;
  ELSIF TG_ARGV[0] = 'context' THEN
    SELECT EXISTS (SELECT 1 FROM public.software_participation_source_occurrence WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.source_snapshot_id AND content_id=NEW.owner_id AND context_id=NEW.component_key AND context_revision=NEW.source_revision AND source_pointer=NEW.source_path) INTO source_matched;
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.software_participation_credit_source_occurrence WHERE source_record_id=NEW.source_record_id AND snapshot_id=NEW.source_snapshot_id AND content_id=NEW.owner_id AND participation_id=NEW.component_key AND participation_revision=NEW.source_revision AND source_path=NEW.source_path) INTO source_matched;
  END IF;
  IF NOT source_matched THEN RAISE EXCEPTION 'Baseline originating history is not backed by its exact source occurrence' USING ERRCODE = '23514'; END IF;
  IF TG_ARGV[0] = 'owned' THEN
    EXECUTE format('SELECT %I FROM public.%I WHERE owner_id=$1 AND %I=$2', CASE NEW.kind WHEN 'catalog-semantic' THEN 'version' ELSE 'revision' END, TG_ARGV[1] || CASE NEW.kind WHEN 'catalog-semantic' THEN '_semantic_head' WHEN 'catalog-name' THEN '_named_form' WHEN 'catalog-name-authority' THEN '_name_authority' END, CASE NEW.kind WHEN 'catalog-semantic' THEN 'semantic_id' ELSE 'id' END) INTO native_head USING NEW.owner_id,NEW.component_key;
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
    EXECUTE format('CREATE TRIGGER catalog_source_baseline_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_owned_baseline(%L,%L)', owner_name || '_source_owned_baseline', 'owned', owner_name);
  END LOOP;
  FOREACH child IN ARRAY ARRAY['record','component','context','participation'] LOOP
    EXECUTE format('CREATE TRIGGER catalog_source_baseline_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_owned_baseline(%L)', 'software_source_' || child || '_baseline', child);
  END LOOP;
  FOREACH child IN ARRAY ARRAY['software_component_source_occurrence','software_record_source_occurrence'] LOOP
    EXECUTE format('CREATE TRIGGER software_source_occurrence_immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.catalog_source_guard_immutable_evidence()', child);
  END LOOP;
END $$;
