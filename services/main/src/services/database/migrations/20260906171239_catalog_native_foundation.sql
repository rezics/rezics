SET search_path TO public;

-- Create "catalog_definition" table
CREATE TABLE "catalog_definition" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "namespace" text NOT NULL,
  "key" text NOT NULL,
  "kind" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "catalog_definition_namespace_key" UNIQUE ("namespace", "key"),
  CONSTRAINT "catalog_definition_key_check" CHECK ((length(key) >= 1) AND (length(key) <= 160)),
  CONSTRAINT "catalog_definition_kind_check" CHECK (kind = ANY (ARRAY['class'::text, 'property'::text, 'predicate'::text, 'role'::text, 'vocabulary'::text])),
  CONSTRAINT "catalog_definition_namespace_check" CHECK (namespace ~ '^[a-z][a-z0-9_.-]{0,95}$'::text)
);
-- Create "catalog_routing_control" table
CREATE TABLE "catalog_routing_control" (
  "singleton" boolean NOT NULL DEFAULT true,
  "ready" boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("singleton"),
  CONSTRAINT "catalog_routing_control_singleton_check" CHECK (singleton)
);
-- Create "catalog_unit_locator" table
CREATE TABLE "catalog_unit_locator" (
  "id" uuid NOT NULL,
  "owner" text NOT NULL,
  "generation" integer NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "catalog_unit_locator_generation_check" CHECK (generation > 0),
  CONSTRAINT "catalog_unit_locator_owner_check" CHECK (owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text]))
);
-- Create "catalog_definition_revision" table
CREATE TABLE "catalog_definition_revision" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "definition_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "value_kind" text NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "catalog_definition_revision_version_key" UNIQUE ("definition_id", "version"),
  CONSTRAINT "catalog_definition_revision_UXHhQDidUjsV_fkey" FOREIGN KEY ("definition_id") REFERENCES "catalog_definition" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_definition_revision_value_kind_check" CHECK (value_kind = ANY (ARRAY['null'::text, 'string'::text, 'number'::text, 'boolean'::text, 'object'::text, 'array'::text])),
  CONSTRAINT "catalog_definition_revision_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create "catalog_source_record" table
CREATE TABLE "catalog_source_record" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "source" text NOT NULL,
  "object_type" text NOT NULL,
  "external_id" text NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "catalog_source_record_native_key" UNIQUE ("source", "object_type", "external_id"),
  CONSTRAINT "catalog_source_record_key_check" CHECK (((octet_length(source) >= 1) AND (octet_length(source) <= 96)) AND ((octet_length(object_type) >= 1) AND (octet_length(object_type) <= 96)) AND ((octet_length(external_id) >= 1) AND (octet_length(external_id) <= 512)))
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
);
-- Create index "catalog_source_snapshot_record_time_idx" to table: "catalog_source_snapshot"
CREATE INDEX "catalog_source_snapshot_record_time_idx" ON "catalog_source_snapshot" ("source_record_id", "observed_at", "id");
-- Create "catalog_source_mapping_claim" table
CREATE TABLE "catalog_source_mapping_claim" (
  "source_record_id" uuid NOT NULL,
  "path" text NOT NULL,
  "mapping_key" uuid NOT NULL DEFAULT uuidv7(),
  "owner" text NOT NULL,
  "observed_snapshot_id" uuid NOT NULL,
  PRIMARY KEY ("source_record_id", "path"),
  CONSTRAINT "catalog_source_mapping_claim_owner_key" UNIQUE ("mapping_key", "owner"),
  CONSTRAINT "catalog_source_mapping_claim_snapshot_fk" FOREIGN KEY ("source_record_id", "observed_snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_mapping_claim_w96e0BJghh19_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "catalog_source_mapping_claim_owner_check" CHECK (owner = ANY (ARRAY['publishing'::text, 'music'::text, 'program'::text, 'software'::text, 'entity'::text, 'grouping'::text, 'reference'::text])),
  CONSTRAINT "catalog_source_mapping_claim_path_check" CHECK ((octet_length(path) >= 1) AND (octet_length(path) <= 512))
);
-- Create index "catalog_source_mapping_claim_snapshot_idx" to table: "catalog_source_mapping_claim"
CREATE INDEX "catalog_source_mapping_claim_snapshot_idx" ON "catalog_source_mapping_claim" ("source_record_id", "observed_snapshot_id");
-- Create "entity_identity" table
CREATE TABLE "entity_identity" (
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
  CONSTRAINT "entity_identity_created_by_auth_user_id_users_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "entity_identity_moderation_check" CHECK (moderation_status = ANY (ARRAY['approved'::text, 'pending'::text, 'removed'::text])),
  CONSTRAINT "entity_identity_rating_check" CHECK (content_rating = ANY (ARRAY['general'::text, 'r15'::text, 'r18'::text, 'r18g'::text])),
  CONSTRAINT "entity_identity_revision_check" CHECK (((revision >= 1) AND (revision <= '9007199254740991'::bigint)) AND (routing_generation > 0)),
  CONSTRAINT "entity_identity_shape_check" CHECK (shape ~ '^[a-z][a-z0-9_.-]{0,95}$'::text),
  CONSTRAINT "entity_identity_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])),
  CONSTRAINT "entity_identity_visibility_check" CHECK (visibility = ANY (ARRAY['public'::text, 'unlisted'::text, 'private'::text]))
);
-- Create index "entity_identity_creator_idx" to table: "entity_identity"
CREATE INDEX "entity_identity_creator_idx" ON "entity_identity" ("created_by_auth_user_id", "id");
-- Create index "entity_identity_shape_idx" to table: "entity_identity"
CREATE INDEX "entity_identity_shape_idx" ON "entity_identity" ("shape", "id");
-- Create "entity_catalog_change" table
CREATE TABLE "entity_catalog_change" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "actor_auth_user_id" uuid NULL,
  "operation" text NOT NULL,
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "withdrawn_at" timestamptz(3) NULL,
  CONSTRAINT "entity_change_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "entity_change_version_key" UNIQUE ("owner_id", "version"),
  CONSTRAINT "entity_catalog_change_actor_auth_user_id_users_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "entity_catalog_change_owner_id_entity_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_change_operation_check" CHECK ((length(operation) >= 1) AND (length(operation) <= 96)),
  CONSTRAINT "entity_change_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create index "entity_change_actor_idx" to table: "entity_catalog_change"
CREATE INDEX "entity_change_actor_idx" ON "entity_catalog_change" ("actor_auth_user_id", "id");
-- Create "entity_catalog_relation" table
CREATE TABLE "entity_catalog_relation" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "entity_relation_owner_id_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "entity_catalog_relation_owner_id_entity_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_catalog_relation_vpIwkgs7KmFO_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_relation_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "entity_relation_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text]))
);
-- Create index "entity_relation_definition_idx" to table: "entity_catalog_relation"
CREATE INDEX "entity_relation_definition_idx" ON "entity_catalog_relation" ("definition_revision_id", "id");
-- Create index "entity_relation_owner_idx" to table: "entity_catalog_relation"
CREATE INDEX "entity_relation_owner_idx" ON "entity_catalog_relation" ("owner_id", "definition_revision_id", "id");
-- Create "entity_fact" table
CREATE TABLE "entity_fact" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "last_node_position" bigint NOT NULL DEFAULT -1,
  "sealed_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "entity_fact_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "entity_fact_VJ5GVkkOQ2jA_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_fact_owner_id_entity_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_fact_node_cursor_check" CHECK (((last_node_position >= '-1'::integer) AND (last_node_position <= '9007199254740991'::bigint)) AND ((sealed_at IS NULL) OR (last_node_position >= 0))),
  CONSTRAINT "entity_fact_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text]))
);
-- Create index "entity_fact_definition_idx" to table: "entity_fact"
CREATE INDEX "entity_fact_definition_idx" ON "entity_fact" ("definition_revision_id", "id");
-- Create index "entity_fact_owner_idx" to table: "entity_fact"
CREATE INDEX "entity_fact_owner_idx" ON "entity_fact" ("owner_id", "definition_revision_id", "id");
-- Create "entity_identifier_claim" table
CREATE TABLE "entity_identifier_claim" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "value" text NOT NULL,
  "normalized_value" text NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "entity_identifier_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "entity_identifier_claim_owner_id_entity_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_identifier_namespace_check" CHECK ((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 128)),
  CONSTRAINT "entity_identifier_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "entity_identifier_value_check" CHECK (((octet_length(normalized_value) >= 1) AND (octet_length(normalized_value) <= 512)) AND (length(value) > 0))
);
-- Create index "entity_identifier_lookup_idx" to table: "entity_identifier_claim"
CREATE INDEX "entity_identifier_lookup_idx" ON "entity_identifier_claim" ("namespace", "normalized_value", "owner_id", "id");
-- Create index "entity_identifier_owner_idx" to table: "entity_identifier_claim"
CREATE INDEX "entity_identifier_owner_idx" ON "entity_identifier_claim" ("owner_id", "id");
-- Create "entity_named_form" table
CREATE TABLE "entity_named_form" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "language_tag" text NULL,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "entity_named_form_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "entity_named_form_owner_id_entity_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_named_form_kind_check" CHECK ((length(kind) >= 1) AND (length(kind) <= 96)),
  CONSTRAINT "entity_named_form_language_check" CHECK ((language_tag IS NULL) OR ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255))),
  CONSTRAINT "entity_named_form_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "entity_named_form_value_check" CHECK (length(value) > 0)
);
-- Create index "entity_named_form_language_idx" to table: "entity_named_form"
CREATE INDEX "entity_named_form_language_idx" ON "entity_named_form" ("owner_id", "language_tag", "id");
-- Create index "entity_named_form_owner_idx" to table: "entity_named_form"
CREATE INDEX "entity_named_form_owner_idx" ON "entity_named_form" ("owner_id", "id");
-- Create "entity_fact_support" table
CREATE TABLE "entity_fact_support" (
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
  CONSTRAINT "entity_support_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "entity_fact_support_8Yl9t3RF5B7s_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_support_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "entity_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_support_identifier_fk" FOREIGN KEY ("owner_id", "identifier_id") REFERENCES "entity_identifier_claim" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_support_named_form_fk" FOREIGN KEY ("owner_id", "named_form_id") REFERENCES "entity_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_support_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "entity_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_support_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_support_source_path_check" CHECK (length(source_path) > 0),
  CONSTRAINT "entity_support_target_check" CHECK (num_nonnulls(fact_id, relation_id, named_form_id, identifier_id) = 1)
);
-- Create index "entity_support_fact_idx" to table: "entity_fact_support"
CREATE INDEX "entity_support_fact_idx" ON "entity_fact_support" ("owner_id", "fact_id", "id") WHERE (fact_id IS NOT NULL);
-- Create index "entity_support_identifier_idx" to table: "entity_fact_support"
CREATE INDEX "entity_support_identifier_idx" ON "entity_fact_support" ("owner_id", "identifier_id", "id") WHERE (identifier_id IS NOT NULL);
-- Create index "entity_support_name_idx" to table: "entity_fact_support"
CREATE INDEX "entity_support_name_idx" ON "entity_fact_support" ("owner_id", "named_form_id", "id") WHERE (named_form_id IS NOT NULL);
-- Create index "entity_support_relation_idx" to table: "entity_fact_support"
CREATE INDEX "entity_support_relation_idx" ON "entity_fact_support" ("owner_id", "relation_id", "id") WHERE (relation_id IS NOT NULL);
-- Create index "entity_support_snapshot_idx" to table: "entity_fact_support"
CREATE INDEX "entity_support_snapshot_idx" ON "entity_fact_support" ("source_record_id", "snapshot_id", "id");
-- Create "entity_fact_value_node" table
CREATE TABLE "entity_fact_value_node" (
  "owner_id" uuid NOT NULL,
  "fact_id" uuid NOT NULL,
  "position" bigint NOT NULL,
  "parent_position" bigint NULL,
  "parent_kind" text NULL,
  "member_key" text NULL,
  "kind" text NOT NULL,
  "text_value" text NULL,
  "number_value" numeric NULL,
  "boolean_value" boolean NULL,
  CONSTRAINT "entity_fact_node_position_key" PRIMARY KEY ("owner_id", "fact_id", "position"),
  CONSTRAINT "entity_fact_node_kind_key" UNIQUE ("owner_id", "fact_id", "position", "kind"),
  CONSTRAINT "entity_fact_node_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "entity_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_fact_node_parent_fk" FOREIGN KEY ("owner_id", "fact_id", "parent_position", "parent_kind") REFERENCES "entity_fact_value_node" ("owner_id", "fact_id", "position", "kind") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_fact_node_kind_check" CHECK (kind = ANY (ARRAY['null'::text, 'string'::text, 'number'::text, 'boolean'::text, 'object'::text, 'array'::text])),
  CONSTRAINT "entity_fact_node_number_check" CHECK ((number_value IS NULL) OR ((number_value)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text]))),
  CONSTRAINT "entity_fact_node_parent_check" CHECK ((("position" = 0) AND (parent_position IS NULL) AND (parent_kind IS NULL) AND (member_key IS NULL)) OR (("position" > 0) AND (parent_position IS NOT NULL) AND (parent_kind IS NOT NULL) AND (((parent_kind = 'object'::text) AND (member_key IS NOT NULL)) OR ((parent_kind = 'array'::text) AND (member_key IS NULL))))),
  CONSTRAINT "entity_fact_node_position_check" CHECK ((("position" >= 0) AND ("position" <= '9007199254740991'::bigint)) AND ((parent_position IS NULL) OR ((parent_position >= 0) AND (parent_position < "position")))),
  CONSTRAINT "entity_fact_node_value_check" CHECK (((kind = 'string'::text) AND (text_value IS NOT NULL) AND (number_value IS NULL) AND (boolean_value IS NULL)) OR ((kind = 'number'::text) AND (number_value IS NOT NULL) AND (text_value IS NULL) AND (boolean_value IS NULL)) OR ((kind = 'boolean'::text) AND (boolean_value IS NOT NULL) AND (text_value IS NULL) AND (number_value IS NULL)) OR ((kind = ANY (ARRAY['null'::text, 'object'::text, 'array'::text])) AND (text_value IS NULL) AND (number_value IS NULL) AND (boolean_value IS NULL)))
);
-- Create index "entity_fact_node_children_idx" to table: "entity_fact_value_node"
CREATE INDEX "entity_fact_node_children_idx" ON "entity_fact_value_node" ("owner_id", "fact_id", "parent_position", "position");
-- Create "software_identity" table
CREATE TABLE "software_identity" (
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
  CONSTRAINT "software_identity_created_by_auth_user_id_users_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "software_identity_moderation_check" CHECK (moderation_status = ANY (ARRAY['approved'::text, 'pending'::text, 'removed'::text])),
  CONSTRAINT "software_identity_rating_check" CHECK (content_rating = ANY (ARRAY['general'::text, 'r15'::text, 'r18'::text, 'r18g'::text])),
  CONSTRAINT "software_identity_revision_check" CHECK (((revision >= 1) AND (revision <= '9007199254740991'::bigint)) AND (routing_generation > 0)),
  CONSTRAINT "software_identity_shape_check" CHECK (shape ~ '^[a-z][a-z0-9_.-]{0,95}$'::text),
  CONSTRAINT "software_identity_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])),
  CONSTRAINT "software_identity_visibility_check" CHECK (visibility = ANY (ARRAY['public'::text, 'unlisted'::text, 'private'::text]))
);
-- Create index "software_identity_creator_idx" to table: "software_identity"
CREATE INDEX "software_identity_creator_idx" ON "software_identity" ("created_by_auth_user_id", "id");
-- Create index "software_identity_shape_idx" to table: "software_identity"
CREATE INDEX "software_identity_shape_idx" ON "software_identity" ("shape", "id");
-- Create "grouping_identity" table
CREATE TABLE "grouping_identity" (
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
  CONSTRAINT "grouping_identity_created_by_auth_user_id_users_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "grouping_identity_moderation_check" CHECK (moderation_status = ANY (ARRAY['approved'::text, 'pending'::text, 'removed'::text])),
  CONSTRAINT "grouping_identity_rating_check" CHECK (content_rating = ANY (ARRAY['general'::text, 'r15'::text, 'r18'::text, 'r18g'::text])),
  CONSTRAINT "grouping_identity_revision_check" CHECK (((revision >= 1) AND (revision <= '9007199254740991'::bigint)) AND (routing_generation > 0)),
  CONSTRAINT "grouping_identity_shape_check" CHECK (shape ~ '^[a-z][a-z0-9_.-]{0,95}$'::text),
  CONSTRAINT "grouping_identity_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])),
  CONSTRAINT "grouping_identity_visibility_check" CHECK (visibility = ANY (ARRAY['public'::text, 'unlisted'::text, 'private'::text]))
);
-- Create index "grouping_identity_creator_idx" to table: "grouping_identity"
CREATE INDEX "grouping_identity_creator_idx" ON "grouping_identity" ("created_by_auth_user_id", "id");
-- Create index "grouping_identity_shape_idx" to table: "grouping_identity"
CREATE INDEX "grouping_identity_shape_idx" ON "grouping_identity" ("shape", "id");
-- Create "reference_identity" table
CREATE TABLE "reference_identity" (
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
  CONSTRAINT "reference_identity_created_by_auth_user_id_users_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "reference_identity_moderation_check" CHECK (moderation_status = ANY (ARRAY['approved'::text, 'pending'::text, 'removed'::text])),
  CONSTRAINT "reference_identity_rating_check" CHECK (content_rating = ANY (ARRAY['general'::text, 'r15'::text, 'r18'::text, 'r18g'::text])),
  CONSTRAINT "reference_identity_revision_check" CHECK (((revision >= 1) AND (revision <= '9007199254740991'::bigint)) AND (routing_generation > 0)),
  CONSTRAINT "reference_identity_shape_check" CHECK (shape ~ '^[a-z][a-z0-9_.-]{0,95}$'::text),
  CONSTRAINT "reference_identity_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])),
  CONSTRAINT "reference_identity_visibility_check" CHECK (visibility = ANY (ARRAY['public'::text, 'unlisted'::text, 'private'::text]))
);
-- Create index "reference_identity_creator_idx" to table: "reference_identity"
CREATE INDEX "reference_identity_creator_idx" ON "reference_identity" ("created_by_auth_user_id", "id");
-- Create index "reference_identity_shape_idx" to table: "reference_identity"
CREATE INDEX "reference_identity_shape_idx" ON "reference_identity" ("shape", "id");
-- Create "music_identity" table
CREATE TABLE "music_identity" (
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
  CONSTRAINT "music_identity_created_by_auth_user_id_users_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "music_identity_moderation_check" CHECK (moderation_status = ANY (ARRAY['approved'::text, 'pending'::text, 'removed'::text])),
  CONSTRAINT "music_identity_rating_check" CHECK (content_rating = ANY (ARRAY['general'::text, 'r15'::text, 'r18'::text, 'r18g'::text])),
  CONSTRAINT "music_identity_revision_check" CHECK (((revision >= 1) AND (revision <= '9007199254740991'::bigint)) AND (routing_generation > 0)),
  CONSTRAINT "music_identity_shape_check" CHECK (shape ~ '^[a-z][a-z0-9_.-]{0,95}$'::text),
  CONSTRAINT "music_identity_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])),
  CONSTRAINT "music_identity_visibility_check" CHECK (visibility = ANY (ARRAY['public'::text, 'unlisted'::text, 'private'::text]))
);
-- Create index "music_identity_creator_idx" to table: "music_identity"
CREATE INDEX "music_identity_creator_idx" ON "music_identity" ("created_by_auth_user_id", "id");
-- Create index "music_identity_shape_idx" to table: "music_identity"
CREATE INDEX "music_identity_shape_idx" ON "music_identity" ("shape", "id");
-- Create "program_identity" table
CREATE TABLE "program_identity" (
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
  CONSTRAINT "program_identity_created_by_auth_user_id_users_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "program_identity_moderation_check" CHECK (moderation_status = ANY (ARRAY['approved'::text, 'pending'::text, 'removed'::text])),
  CONSTRAINT "program_identity_rating_check" CHECK (content_rating = ANY (ARRAY['general'::text, 'r15'::text, 'r18'::text, 'r18g'::text])),
  CONSTRAINT "program_identity_revision_check" CHECK (((revision >= 1) AND (revision <= '9007199254740991'::bigint)) AND (routing_generation > 0)),
  CONSTRAINT "program_identity_shape_check" CHECK (shape ~ '^[a-z][a-z0-9_.-]{0,95}$'::text),
  CONSTRAINT "program_identity_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])),
  CONSTRAINT "program_identity_visibility_check" CHECK (visibility = ANY (ARRAY['public'::text, 'unlisted'::text, 'private'::text]))
);
-- Create index "program_identity_creator_idx" to table: "program_identity"
CREATE INDEX "program_identity_creator_idx" ON "program_identity" ("created_by_auth_user_id", "id");
-- Create index "program_identity_shape_idx" to table: "program_identity"
CREATE INDEX "program_identity_shape_idx" ON "program_identity" ("shape", "id");
-- Create "publishing_identity" table
CREATE TABLE "publishing_identity" (
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
  CONSTRAINT "publishing_identity_created_by_auth_user_id_users_id_fkey" FOREIGN KEY ("created_by_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "publishing_identity_moderation_check" CHECK (moderation_status = ANY (ARRAY['approved'::text, 'pending'::text, 'removed'::text])),
  CONSTRAINT "publishing_identity_rating_check" CHECK (content_rating = ANY (ARRAY['general'::text, 'r15'::text, 'r18'::text, 'r18g'::text])),
  CONSTRAINT "publishing_identity_revision_check" CHECK (((revision >= 1) AND (revision <= '9007199254740991'::bigint)) AND (routing_generation > 0)),
  CONSTRAINT "publishing_identity_shape_check" CHECK (shape ~ '^[a-z][a-z0-9_.-]{0,95}$'::text),
  CONSTRAINT "publishing_identity_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])),
  CONSTRAINT "publishing_identity_visibility_check" CHECK (visibility = ANY (ARRAY['public'::text, 'unlisted'::text, 'private'::text]))
);
-- Create index "publishing_identity_creator_idx" to table: "publishing_identity"
CREATE INDEX "publishing_identity_creator_idx" ON "publishing_identity" ("created_by_auth_user_id", "id");
-- Create index "publishing_identity_shape_idx" to table: "publishing_identity"
CREATE INDEX "publishing_identity_shape_idx" ON "publishing_identity" ("shape", "id");
-- Create "entity_relation_participant" table
CREATE TABLE "entity_relation_participant" (
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
  CONSTRAINT "entity_participant_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "entity_participant_position_key" UNIQUE ("owner_id", "relation_id", "position"),
  CONSTRAINT "entity_participant_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "entity_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_relation_participant_0wIhnNE2SEfl_fkey" FOREIGN KEY ("software_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_relation_participant_RMrW6sFicj8X_fkey" FOREIGN KEY ("grouping_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_relation_participant_clLShGActaAv_fkey" FOREIGN KEY ("reference_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_relation_participant_entity_id_entity_identity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_relation_participant_music_id_music_identity_id_fkey" FOREIGN KEY ("music_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_relation_participant_program_id_program_identity_id_fkey" FOREIGN KEY ("program_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_relation_participant_vmG5fWxdy99n_fkey" FOREIGN KEY ("role_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_relation_participant_z7GtUzFYVpe3_fkey" FOREIGN KEY ("publishing_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_participant_position_check" CHECK (("position" >= 0) AND ("position" <= '9007199254740991'::bigint)),
  CONSTRAINT "entity_participant_target_check" CHECK (num_nonnulls(publishing_id, music_id, program_id, software_id, entity_id, grouping_id, reference_id) = 1)
);
-- Create index "entity_participant_entity_idx" to table: "entity_relation_participant"
CREATE INDEX "entity_participant_entity_idx" ON "entity_relation_participant" ("entity_id", "role_revision_id", "relation_id") WHERE (entity_id IS NOT NULL);
-- Create index "entity_participant_grouping_idx" to table: "entity_relation_participant"
CREATE INDEX "entity_participant_grouping_idx" ON "entity_relation_participant" ("grouping_id", "role_revision_id", "relation_id") WHERE (grouping_id IS NOT NULL);
-- Create index "entity_participant_music_idx" to table: "entity_relation_participant"
CREATE INDEX "entity_participant_music_idx" ON "entity_relation_participant" ("music_id", "role_revision_id", "relation_id") WHERE (music_id IS NOT NULL);
-- Create index "entity_participant_program_idx" to table: "entity_relation_participant"
CREATE INDEX "entity_participant_program_idx" ON "entity_relation_participant" ("program_id", "role_revision_id", "relation_id") WHERE (program_id IS NOT NULL);
-- Create index "entity_participant_publishing_idx" to table: "entity_relation_participant"
CREATE INDEX "entity_participant_publishing_idx" ON "entity_relation_participant" ("publishing_id", "role_revision_id", "relation_id") WHERE (publishing_id IS NOT NULL);
-- Create index "entity_participant_reference_idx" to table: "entity_relation_participant"
CREATE INDEX "entity_participant_reference_idx" ON "entity_relation_participant" ("reference_id", "role_revision_id", "relation_id") WHERE (reference_id IS NOT NULL);
-- Create index "entity_participant_role_idx" to table: "entity_relation_participant"
CREATE INDEX "entity_participant_role_idx" ON "entity_relation_participant" ("role_revision_id", "relation_id", "id");
-- Create index "entity_participant_software_idx" to table: "entity_relation_participant"
CREATE INDEX "entity_participant_software_idx" ON "entity_relation_participant" ("software_id", "role_revision_id", "relation_id") WHERE (software_id IS NOT NULL);
-- Create "entity_relation_scope" table
CREATE TABLE "entity_relation_scope" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "relation_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "value_fact_id" uuid NOT NULL,
  CONSTRAINT "entity_relation_scope_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "entity_relation_scope_0rUBb0WuHhMP_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_scope_fact_fk" FOREIGN KEY ("owner_id", "value_fact_id") REFERENCES "entity_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_scope_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "entity_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "entity_relation_scope_definition_idx" to table: "entity_relation_scope"
CREATE INDEX "entity_relation_scope_definition_idx" ON "entity_relation_scope" ("definition_revision_id", "id");
-- Create index "entity_relation_scope_fact_idx" to table: "entity_relation_scope"
CREATE INDEX "entity_relation_scope_fact_idx" ON "entity_relation_scope" ("owner_id", "value_fact_id");
-- Create index "entity_relation_scope_relation_idx" to table: "entity_relation_scope"
CREATE INDEX "entity_relation_scope_relation_idx" ON "entity_relation_scope" ("owner_id", "relation_id", "definition_revision_id", "id");
-- Create "entity_source_binding" table
CREATE TABLE "entity_source_binding" (
  "mapping_key" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'entity',
  "owner_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("mapping_key"),
  CONSTRAINT "entity_source_binding_claim_fk" FOREIGN KEY ("mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_source_binding_owner_id_entity_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_source_binding_owner_check" CHECK (mapping_owner = 'entity'::text)
);
-- Create index "entity_source_binding_owner_idx" to table: "entity_source_binding"
CREATE INDEX "entity_source_binding_owner_idx" ON "entity_source_binding" ("owner_id", "mapping_key");
-- Create "grouping_catalog_change" table
CREATE TABLE "grouping_catalog_change" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "actor_auth_user_id" uuid NULL,
  "operation" text NOT NULL,
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "withdrawn_at" timestamptz(3) NULL,
  CONSTRAINT "grouping_change_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "grouping_change_version_key" UNIQUE ("owner_id", "version"),
  CONSTRAINT "grouping_catalog_change_actor_auth_user_id_users_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "grouping_catalog_change_owner_id_grouping_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_change_operation_check" CHECK ((length(operation) >= 1) AND (length(operation) <= 96)),
  CONSTRAINT "grouping_change_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create index "grouping_change_actor_idx" to table: "grouping_catalog_change"
CREATE INDEX "grouping_change_actor_idx" ON "grouping_catalog_change" ("actor_auth_user_id", "id");
-- Create "grouping_catalog_relation" table
CREATE TABLE "grouping_catalog_relation" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "grouping_relation_owner_id_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "grouping_catalog_relation_ic6C3pDkSS02_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_catalog_relation_owner_id_grouping_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_relation_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "grouping_relation_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text]))
);
-- Create index "grouping_relation_definition_idx" to table: "grouping_catalog_relation"
CREATE INDEX "grouping_relation_definition_idx" ON "grouping_catalog_relation" ("definition_revision_id", "id");
-- Create index "grouping_relation_owner_idx" to table: "grouping_catalog_relation"
CREATE INDEX "grouping_relation_owner_idx" ON "grouping_catalog_relation" ("owner_id", "definition_revision_id", "id");
-- Create "grouping_class_assignment" table
CREATE TABLE "grouping_class_assignment" (
  "grouping_id" uuid NOT NULL,
  "class_revision_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("grouping_id", "class_revision_id"),
  CONSTRAINT "grouping_class_assignment_grouping_id_grouping_identity_id_fkey" FOREIGN KEY ("grouping_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_class_assignment_rmJRbYSYdi9j_fkey" FOREIGN KEY ("class_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "grouping_class_reverse_idx" to table: "grouping_class_assignment"
CREATE INDEX "grouping_class_reverse_idx" ON "grouping_class_assignment" ("class_revision_id", "grouping_id");
-- Create "grouping_fact" table
CREATE TABLE "grouping_fact" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "last_node_position" bigint NOT NULL DEFAULT -1,
  "sealed_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "grouping_fact_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "grouping_fact_owner_id_grouping_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_fact_pWTLeiFEQv1K_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_fact_node_cursor_check" CHECK (((last_node_position >= '-1'::integer) AND (last_node_position <= '9007199254740991'::bigint)) AND ((sealed_at IS NULL) OR (last_node_position >= 0))),
  CONSTRAINT "grouping_fact_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text]))
);
-- Create index "grouping_fact_definition_idx" to table: "grouping_fact"
CREATE INDEX "grouping_fact_definition_idx" ON "grouping_fact" ("definition_revision_id", "id");
-- Create index "grouping_fact_owner_idx" to table: "grouping_fact"
CREATE INDEX "grouping_fact_owner_idx" ON "grouping_fact" ("owner_id", "definition_revision_id", "id");
-- Create "grouping_identifier_claim" table
CREATE TABLE "grouping_identifier_claim" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "value" text NOT NULL,
  "normalized_value" text NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "grouping_identifier_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "grouping_identifier_claim_owner_id_grouping_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_identifier_namespace_check" CHECK ((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 128)),
  CONSTRAINT "grouping_identifier_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "grouping_identifier_value_check" CHECK (((octet_length(normalized_value) >= 1) AND (octet_length(normalized_value) <= 512)) AND (length(value) > 0))
);
-- Create index "grouping_identifier_lookup_idx" to table: "grouping_identifier_claim"
CREATE INDEX "grouping_identifier_lookup_idx" ON "grouping_identifier_claim" ("namespace", "normalized_value", "owner_id", "id");
-- Create index "grouping_identifier_owner_idx" to table: "grouping_identifier_claim"
CREATE INDEX "grouping_identifier_owner_idx" ON "grouping_identifier_claim" ("owner_id", "id");
-- Create "grouping_named_form" table
CREATE TABLE "grouping_named_form" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "language_tag" text NULL,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "grouping_named_form_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "grouping_named_form_owner_id_grouping_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_named_form_kind_check" CHECK ((length(kind) >= 1) AND (length(kind) <= 96)),
  CONSTRAINT "grouping_named_form_language_check" CHECK ((language_tag IS NULL) OR ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255))),
  CONSTRAINT "grouping_named_form_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "grouping_named_form_value_check" CHECK (length(value) > 0)
);
-- Create index "grouping_named_form_language_idx" to table: "grouping_named_form"
CREATE INDEX "grouping_named_form_language_idx" ON "grouping_named_form" ("owner_id", "language_tag", "id");
-- Create index "grouping_named_form_owner_idx" to table: "grouping_named_form"
CREATE INDEX "grouping_named_form_owner_idx" ON "grouping_named_form" ("owner_id", "id");
-- Create "grouping_fact_support" table
CREATE TABLE "grouping_fact_support" (
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
  CONSTRAINT "grouping_support_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "grouping_fact_support_xQlZC5EXSmvi_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_support_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "grouping_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_support_identifier_fk" FOREIGN KEY ("owner_id", "identifier_id") REFERENCES "grouping_identifier_claim" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_support_named_form_fk" FOREIGN KEY ("owner_id", "named_form_id") REFERENCES "grouping_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_support_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "grouping_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_support_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_support_source_path_check" CHECK (length(source_path) > 0),
  CONSTRAINT "grouping_support_target_check" CHECK (num_nonnulls(fact_id, relation_id, named_form_id, identifier_id) = 1)
);
-- Create index "grouping_support_fact_idx" to table: "grouping_fact_support"
CREATE INDEX "grouping_support_fact_idx" ON "grouping_fact_support" ("owner_id", "fact_id", "id") WHERE (fact_id IS NOT NULL);
-- Create index "grouping_support_identifier_idx" to table: "grouping_fact_support"
CREATE INDEX "grouping_support_identifier_idx" ON "grouping_fact_support" ("owner_id", "identifier_id", "id") WHERE (identifier_id IS NOT NULL);
-- Create index "grouping_support_name_idx" to table: "grouping_fact_support"
CREATE INDEX "grouping_support_name_idx" ON "grouping_fact_support" ("owner_id", "named_form_id", "id") WHERE (named_form_id IS NOT NULL);
-- Create index "grouping_support_relation_idx" to table: "grouping_fact_support"
CREATE INDEX "grouping_support_relation_idx" ON "grouping_fact_support" ("owner_id", "relation_id", "id") WHERE (relation_id IS NOT NULL);
-- Create index "grouping_support_snapshot_idx" to table: "grouping_fact_support"
CREATE INDEX "grouping_support_snapshot_idx" ON "grouping_fact_support" ("source_record_id", "snapshot_id", "id");
-- Create "grouping_fact_value_node" table
CREATE TABLE "grouping_fact_value_node" (
  "owner_id" uuid NOT NULL,
  "fact_id" uuid NOT NULL,
  "position" bigint NOT NULL,
  "parent_position" bigint NULL,
  "parent_kind" text NULL,
  "member_key" text NULL,
  "kind" text NOT NULL,
  "text_value" text NULL,
  "number_value" numeric NULL,
  "boolean_value" boolean NULL,
  CONSTRAINT "grouping_fact_node_position_key" PRIMARY KEY ("owner_id", "fact_id", "position"),
  CONSTRAINT "grouping_fact_node_kind_key" UNIQUE ("owner_id", "fact_id", "position", "kind"),
  CONSTRAINT "grouping_fact_node_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "grouping_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_fact_node_parent_fk" FOREIGN KEY ("owner_id", "fact_id", "parent_position", "parent_kind") REFERENCES "grouping_fact_value_node" ("owner_id", "fact_id", "position", "kind") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_fact_node_kind_check" CHECK (kind = ANY (ARRAY['null'::text, 'string'::text, 'number'::text, 'boolean'::text, 'object'::text, 'array'::text])),
  CONSTRAINT "grouping_fact_node_number_check" CHECK ((number_value IS NULL) OR ((number_value)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text]))),
  CONSTRAINT "grouping_fact_node_parent_check" CHECK ((("position" = 0) AND (parent_position IS NULL) AND (parent_kind IS NULL) AND (member_key IS NULL)) OR (("position" > 0) AND (parent_position IS NOT NULL) AND (parent_kind IS NOT NULL) AND (((parent_kind = 'object'::text) AND (member_key IS NOT NULL)) OR ((parent_kind = 'array'::text) AND (member_key IS NULL))))),
  CONSTRAINT "grouping_fact_node_position_check" CHECK ((("position" >= 0) AND ("position" <= '9007199254740991'::bigint)) AND ((parent_position IS NULL) OR ((parent_position >= 0) AND (parent_position < "position")))),
  CONSTRAINT "grouping_fact_node_value_check" CHECK (((kind = 'string'::text) AND (text_value IS NOT NULL) AND (number_value IS NULL) AND (boolean_value IS NULL)) OR ((kind = 'number'::text) AND (number_value IS NOT NULL) AND (text_value IS NULL) AND (boolean_value IS NULL)) OR ((kind = 'boolean'::text) AND (boolean_value IS NOT NULL) AND (text_value IS NULL) AND (number_value IS NULL)) OR ((kind = ANY (ARRAY['null'::text, 'object'::text, 'array'::text])) AND (text_value IS NULL) AND (number_value IS NULL) AND (boolean_value IS NULL)))
);
-- Create index "grouping_fact_node_children_idx" to table: "grouping_fact_value_node"
CREATE INDEX "grouping_fact_node_children_idx" ON "grouping_fact_value_node" ("owner_id", "fact_id", "parent_position", "position");
-- Create "grouping_order_profile" table
CREATE TABLE "grouping_order_profile" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "key" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "grouping_order_profile_owner_id_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "grouping_order_profile_owner_key" UNIQUE ("owner_id", "key"),
  CONSTRAINT "grouping_order_profile_owner_id_grouping_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_order_profile_key_check" CHECK ((octet_length(key) >= 1) AND (octet_length(key) <= 160))
);
-- Create "grouping_order_entry" table
CREATE TABLE "grouping_order_entry" (
  "owner_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "relation_id" uuid NOT NULL,
  "position" text NOT NULL COLLATE "C",
  "source_position" text NULL,
  PRIMARY KEY ("owner_id", "profile_id", "relation_id"),
  CONSTRAINT "grouping_order_entry_profile_owner_fk" FOREIGN KEY ("owner_id", "profile_id") REFERENCES "grouping_order_profile" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_order_entry_relation_owner_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "grouping_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_order_entry_position_check" CHECK (octet_length("position") <= 1024)
);
-- Create index "grouping_order_entry_page_idx" to table: "grouping_order_entry"
CREATE INDEX "grouping_order_entry_page_idx" ON "grouping_order_entry" ("owner_id", "profile_id", "position", "relation_id");
-- Create index "grouping_order_entry_relation_idx" to table: "grouping_order_entry"
CREATE INDEX "grouping_order_entry_relation_idx" ON "grouping_order_entry" ("owner_id", "relation_id");
-- Create "grouping_relation_participant" table
CREATE TABLE "grouping_relation_participant" (
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
  CONSTRAINT "grouping_participant_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "grouping_participant_position_key" UNIQUE ("owner_id", "relation_id", "position"),
  CONSTRAINT "grouping_participant_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "grouping_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_relation_participant_4uIbh0pfkbsL_fkey" FOREIGN KEY ("role_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_relation_participant_Aq4tehxiQjAd_fkey" FOREIGN KEY ("reference_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_relation_participant_E7JuGIfOSWsN_fkey" FOREIGN KEY ("grouping_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_relation_participant_GdJElYWOt1On_fkey" FOREIGN KEY ("program_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_relation_participant_UabBeeKRb2Q9_fkey" FOREIGN KEY ("software_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_relation_participant_entity_id_entity_identity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_relation_participant_lbJe8mtE7vnD_fkey" FOREIGN KEY ("publishing_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_relation_participant_music_id_music_identity_id_fkey" FOREIGN KEY ("music_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_participant_position_check" CHECK (("position" >= 0) AND ("position" <= '9007199254740991'::bigint)),
  CONSTRAINT "grouping_participant_target_check" CHECK (num_nonnulls(publishing_id, music_id, program_id, software_id, entity_id, grouping_id, reference_id) = 1)
);
-- Create index "grouping_participant_entity_idx" to table: "grouping_relation_participant"
CREATE INDEX "grouping_participant_entity_idx" ON "grouping_relation_participant" ("entity_id", "role_revision_id", "relation_id") WHERE (entity_id IS NOT NULL);
-- Create index "grouping_participant_grouping_idx" to table: "grouping_relation_participant"
CREATE INDEX "grouping_participant_grouping_idx" ON "grouping_relation_participant" ("grouping_id", "role_revision_id", "relation_id") WHERE (grouping_id IS NOT NULL);
-- Create index "grouping_participant_music_idx" to table: "grouping_relation_participant"
CREATE INDEX "grouping_participant_music_idx" ON "grouping_relation_participant" ("music_id", "role_revision_id", "relation_id") WHERE (music_id IS NOT NULL);
-- Create index "grouping_participant_program_idx" to table: "grouping_relation_participant"
CREATE INDEX "grouping_participant_program_idx" ON "grouping_relation_participant" ("program_id", "role_revision_id", "relation_id") WHERE (program_id IS NOT NULL);
-- Create index "grouping_participant_publishing_idx" to table: "grouping_relation_participant"
CREATE INDEX "grouping_participant_publishing_idx" ON "grouping_relation_participant" ("publishing_id", "role_revision_id", "relation_id") WHERE (publishing_id IS NOT NULL);
-- Create index "grouping_participant_reference_idx" to table: "grouping_relation_participant"
CREATE INDEX "grouping_participant_reference_idx" ON "grouping_relation_participant" ("reference_id", "role_revision_id", "relation_id") WHERE (reference_id IS NOT NULL);
-- Create index "grouping_participant_role_idx" to table: "grouping_relation_participant"
CREATE INDEX "grouping_participant_role_idx" ON "grouping_relation_participant" ("role_revision_id", "relation_id", "id");
-- Create index "grouping_participant_software_idx" to table: "grouping_relation_participant"
CREATE INDEX "grouping_participant_software_idx" ON "grouping_relation_participant" ("software_id", "role_revision_id", "relation_id") WHERE (software_id IS NOT NULL);
-- Create "grouping_relation_scope" table
CREATE TABLE "grouping_relation_scope" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "relation_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "value_fact_id" uuid NOT NULL,
  CONSTRAINT "grouping_relation_scope_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "grouping_relation_scope_oDknXHB8osSl_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_scope_fact_fk" FOREIGN KEY ("owner_id", "value_fact_id") REFERENCES "grouping_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_scope_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "grouping_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "grouping_relation_scope_definition_idx" to table: "grouping_relation_scope"
CREATE INDEX "grouping_relation_scope_definition_idx" ON "grouping_relation_scope" ("definition_revision_id", "id");
-- Create index "grouping_relation_scope_fact_idx" to table: "grouping_relation_scope"
CREATE INDEX "grouping_relation_scope_fact_idx" ON "grouping_relation_scope" ("owner_id", "value_fact_id");
-- Create index "grouping_relation_scope_relation_idx" to table: "grouping_relation_scope"
CREATE INDEX "grouping_relation_scope_relation_idx" ON "grouping_relation_scope" ("owner_id", "relation_id", "definition_revision_id", "id");
-- Create "grouping_source_binding" table
CREATE TABLE "grouping_source_binding" (
  "mapping_key" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'grouping',
  "owner_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("mapping_key"),
  CONSTRAINT "grouping_source_binding_claim_fk" FOREIGN KEY ("mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_source_binding_owner_id_grouping_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "grouping_source_binding_owner_check" CHECK (mapping_owner = 'grouping'::text)
);
-- Create index "grouping_source_binding_owner_idx" to table: "grouping_source_binding"
CREATE INDEX "grouping_source_binding_owner_idx" ON "grouping_source_binding" ("owner_id", "mapping_key");
-- Create "music_catalog_change" table
CREATE TABLE "music_catalog_change" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "actor_auth_user_id" uuid NULL,
  "operation" text NOT NULL,
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "withdrawn_at" timestamptz(3) NULL,
  CONSTRAINT "music_change_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "music_change_version_key" UNIQUE ("owner_id", "version"),
  CONSTRAINT "music_catalog_change_actor_auth_user_id_users_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "music_catalog_change_owner_id_music_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_change_operation_check" CHECK ((length(operation) >= 1) AND (length(operation) <= 96)),
  CONSTRAINT "music_change_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create index "music_change_actor_idx" to table: "music_catalog_change"
CREATE INDEX "music_change_actor_idx" ON "music_catalog_change" ("actor_auth_user_id", "id");
-- Create "music_catalog_relation" table
CREATE TABLE "music_catalog_relation" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "music_relation_owner_id_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "music_catalog_relation_NIW9Y2E70osU_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_catalog_relation_owner_id_music_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_relation_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "music_relation_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text]))
);
-- Create index "music_relation_definition_idx" to table: "music_catalog_relation"
CREATE INDEX "music_relation_definition_idx" ON "music_catalog_relation" ("definition_revision_id", "id");
-- Create index "music_relation_owner_idx" to table: "music_catalog_relation"
CREATE INDEX "music_relation_owner_idx" ON "music_catalog_relation" ("owner_id", "definition_revision_id", "id");
-- Create "music_fact" table
CREATE TABLE "music_fact" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "last_node_position" bigint NOT NULL DEFAULT -1,
  "sealed_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "music_fact_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "music_fact_N3bNWoWGUEsu_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_fact_owner_id_music_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_fact_node_cursor_check" CHECK (((last_node_position >= '-1'::integer) AND (last_node_position <= '9007199254740991'::bigint)) AND ((sealed_at IS NULL) OR (last_node_position >= 0))),
  CONSTRAINT "music_fact_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text]))
);
-- Create index "music_fact_definition_idx" to table: "music_fact"
CREATE INDEX "music_fact_definition_idx" ON "music_fact" ("definition_revision_id", "id");
-- Create index "music_fact_owner_idx" to table: "music_fact"
CREATE INDEX "music_fact_owner_idx" ON "music_fact" ("owner_id", "definition_revision_id", "id");
-- Create "music_identifier_claim" table
CREATE TABLE "music_identifier_claim" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "value" text NOT NULL,
  "normalized_value" text NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "music_identifier_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "music_identifier_claim_owner_id_music_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_identifier_namespace_check" CHECK ((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 128)),
  CONSTRAINT "music_identifier_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "music_identifier_value_check" CHECK (((octet_length(normalized_value) >= 1) AND (octet_length(normalized_value) <= 512)) AND (length(value) > 0))
);
-- Create index "music_identifier_lookup_idx" to table: "music_identifier_claim"
CREATE INDEX "music_identifier_lookup_idx" ON "music_identifier_claim" ("namespace", "normalized_value", "owner_id", "id");
-- Create index "music_identifier_owner_idx" to table: "music_identifier_claim"
CREATE INDEX "music_identifier_owner_idx" ON "music_identifier_claim" ("owner_id", "id");
-- Create "music_named_form" table
CREATE TABLE "music_named_form" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "language_tag" text NULL,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "music_named_form_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "music_named_form_owner_id_music_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_named_form_kind_check" CHECK ((length(kind) >= 1) AND (length(kind) <= 96)),
  CONSTRAINT "music_named_form_language_check" CHECK ((language_tag IS NULL) OR ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255))),
  CONSTRAINT "music_named_form_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "music_named_form_value_check" CHECK (length(value) > 0)
);
-- Create index "music_named_form_language_idx" to table: "music_named_form"
CREATE INDEX "music_named_form_language_idx" ON "music_named_form" ("owner_id", "language_tag", "id");
-- Create index "music_named_form_owner_idx" to table: "music_named_form"
CREATE INDEX "music_named_form_owner_idx" ON "music_named_form" ("owner_id", "id");
-- Create "music_fact_support" table
CREATE TABLE "music_fact_support" (
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
  CONSTRAINT "music_support_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "music_fact_support_AqSd2T39Ysfo_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_support_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "music_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_support_identifier_fk" FOREIGN KEY ("owner_id", "identifier_id") REFERENCES "music_identifier_claim" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_support_named_form_fk" FOREIGN KEY ("owner_id", "named_form_id") REFERENCES "music_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_support_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "music_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_support_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_support_source_path_check" CHECK (length(source_path) > 0),
  CONSTRAINT "music_support_target_check" CHECK (num_nonnulls(fact_id, relation_id, named_form_id, identifier_id) = 1)
);
-- Create index "music_support_fact_idx" to table: "music_fact_support"
CREATE INDEX "music_support_fact_idx" ON "music_fact_support" ("owner_id", "fact_id", "id") WHERE (fact_id IS NOT NULL);
-- Create index "music_support_identifier_idx" to table: "music_fact_support"
CREATE INDEX "music_support_identifier_idx" ON "music_fact_support" ("owner_id", "identifier_id", "id") WHERE (identifier_id IS NOT NULL);
-- Create index "music_support_name_idx" to table: "music_fact_support"
CREATE INDEX "music_support_name_idx" ON "music_fact_support" ("owner_id", "named_form_id", "id") WHERE (named_form_id IS NOT NULL);
-- Create index "music_support_relation_idx" to table: "music_fact_support"
CREATE INDEX "music_support_relation_idx" ON "music_fact_support" ("owner_id", "relation_id", "id") WHERE (relation_id IS NOT NULL);
-- Create index "music_support_snapshot_idx" to table: "music_fact_support"
CREATE INDEX "music_support_snapshot_idx" ON "music_fact_support" ("source_record_id", "snapshot_id", "id");
-- Create "music_fact_value_node" table
CREATE TABLE "music_fact_value_node" (
  "owner_id" uuid NOT NULL,
  "fact_id" uuid NOT NULL,
  "position" bigint NOT NULL,
  "parent_position" bigint NULL,
  "parent_kind" text NULL,
  "member_key" text NULL,
  "kind" text NOT NULL,
  "text_value" text NULL,
  "number_value" numeric NULL,
  "boolean_value" boolean NULL,
  CONSTRAINT "music_fact_node_position_key" PRIMARY KEY ("owner_id", "fact_id", "position"),
  CONSTRAINT "music_fact_node_kind_key" UNIQUE ("owner_id", "fact_id", "position", "kind"),
  CONSTRAINT "music_fact_node_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "music_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_fact_node_parent_fk" FOREIGN KEY ("owner_id", "fact_id", "parent_position", "parent_kind") REFERENCES "music_fact_value_node" ("owner_id", "fact_id", "position", "kind") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_fact_node_kind_check" CHECK (kind = ANY (ARRAY['null'::text, 'string'::text, 'number'::text, 'boolean'::text, 'object'::text, 'array'::text])),
  CONSTRAINT "music_fact_node_number_check" CHECK ((number_value IS NULL) OR ((number_value)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text]))),
  CONSTRAINT "music_fact_node_parent_check" CHECK ((("position" = 0) AND (parent_position IS NULL) AND (parent_kind IS NULL) AND (member_key IS NULL)) OR (("position" > 0) AND (parent_position IS NOT NULL) AND (parent_kind IS NOT NULL) AND (((parent_kind = 'object'::text) AND (member_key IS NOT NULL)) OR ((parent_kind = 'array'::text) AND (member_key IS NULL))))),
  CONSTRAINT "music_fact_node_position_check" CHECK ((("position" >= 0) AND ("position" <= '9007199254740991'::bigint)) AND ((parent_position IS NULL) OR ((parent_position >= 0) AND (parent_position < "position")))),
  CONSTRAINT "music_fact_node_value_check" CHECK (((kind = 'string'::text) AND (text_value IS NOT NULL) AND (number_value IS NULL) AND (boolean_value IS NULL)) OR ((kind = 'number'::text) AND (number_value IS NOT NULL) AND (text_value IS NULL) AND (boolean_value IS NULL)) OR ((kind = 'boolean'::text) AND (boolean_value IS NOT NULL) AND (text_value IS NULL) AND (number_value IS NULL)) OR ((kind = ANY (ARRAY['null'::text, 'object'::text, 'array'::text])) AND (text_value IS NULL) AND (number_value IS NULL) AND (boolean_value IS NULL)))
);
-- Create index "music_fact_node_children_idx" to table: "music_fact_value_node"
CREATE INDEX "music_fact_node_children_idx" ON "music_fact_value_node" ("owner_id", "fact_id", "parent_position", "position");
-- Create "music_relation_participant" table
CREATE TABLE "music_relation_participant" (
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
  CONSTRAINT "music_participant_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "music_participant_position_key" UNIQUE ("owner_id", "relation_id", "position"),
  CONSTRAINT "music_participant_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "music_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_relation_participant_2VKpPLTpPDpX_fkey" FOREIGN KEY ("role_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_relation_participant_5Rg2FokrYd6b_fkey" FOREIGN KEY ("software_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_relation_participant_J7a9Vdxm2Wrd_fkey" FOREIGN KEY ("publishing_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_relation_participant_entity_id_entity_identity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_relation_participant_music_id_music_identity_id_fkey" FOREIGN KEY ("music_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_relation_participant_pA0wGezGit4T_fkey" FOREIGN KEY ("grouping_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_relation_participant_program_id_program_identity_id_fkey" FOREIGN KEY ("program_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_relation_participant_y9LH8wnT3zW3_fkey" FOREIGN KEY ("reference_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_participant_position_check" CHECK (("position" >= 0) AND ("position" <= '9007199254740991'::bigint)),
  CONSTRAINT "music_participant_target_check" CHECK (num_nonnulls(publishing_id, music_id, program_id, software_id, entity_id, grouping_id, reference_id) = 1)
);
-- Create index "music_participant_entity_idx" to table: "music_relation_participant"
CREATE INDEX "music_participant_entity_idx" ON "music_relation_participant" ("entity_id", "role_revision_id", "relation_id") WHERE (entity_id IS NOT NULL);
-- Create index "music_participant_grouping_idx" to table: "music_relation_participant"
CREATE INDEX "music_participant_grouping_idx" ON "music_relation_participant" ("grouping_id", "role_revision_id", "relation_id") WHERE (grouping_id IS NOT NULL);
-- Create index "music_participant_music_idx" to table: "music_relation_participant"
CREATE INDEX "music_participant_music_idx" ON "music_relation_participant" ("music_id", "role_revision_id", "relation_id") WHERE (music_id IS NOT NULL);
-- Create index "music_participant_program_idx" to table: "music_relation_participant"
CREATE INDEX "music_participant_program_idx" ON "music_relation_participant" ("program_id", "role_revision_id", "relation_id") WHERE (program_id IS NOT NULL);
-- Create index "music_participant_publishing_idx" to table: "music_relation_participant"
CREATE INDEX "music_participant_publishing_idx" ON "music_relation_participant" ("publishing_id", "role_revision_id", "relation_id") WHERE (publishing_id IS NOT NULL);
-- Create index "music_participant_reference_idx" to table: "music_relation_participant"
CREATE INDEX "music_participant_reference_idx" ON "music_relation_participant" ("reference_id", "role_revision_id", "relation_id") WHERE (reference_id IS NOT NULL);
-- Create index "music_participant_role_idx" to table: "music_relation_participant"
CREATE INDEX "music_participant_role_idx" ON "music_relation_participant" ("role_revision_id", "relation_id", "id");
-- Create index "music_participant_software_idx" to table: "music_relation_participant"
CREATE INDEX "music_participant_software_idx" ON "music_relation_participant" ("software_id", "role_revision_id", "relation_id") WHERE (software_id IS NOT NULL);
-- Create "music_relation_scope" table
CREATE TABLE "music_relation_scope" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "relation_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "value_fact_id" uuid NOT NULL,
  CONSTRAINT "music_relation_scope_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "music_relation_scope_tfJwhKO2L7ZN_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_scope_fact_fk" FOREIGN KEY ("owner_id", "value_fact_id") REFERENCES "music_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_scope_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "music_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "music_relation_scope_definition_idx" to table: "music_relation_scope"
CREATE INDEX "music_relation_scope_definition_idx" ON "music_relation_scope" ("definition_revision_id", "id");
-- Create index "music_relation_scope_fact_idx" to table: "music_relation_scope"
CREATE INDEX "music_relation_scope_fact_idx" ON "music_relation_scope" ("owner_id", "value_fact_id");
-- Create index "music_relation_scope_relation_idx" to table: "music_relation_scope"
CREATE INDEX "music_relation_scope_relation_idx" ON "music_relation_scope" ("owner_id", "relation_id", "definition_revision_id", "id");
-- Create "music_source_binding" table
CREATE TABLE "music_source_binding" (
  "mapping_key" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'music',
  "owner_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("mapping_key"),
  CONSTRAINT "music_source_binding_claim_fk" FOREIGN KEY ("mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_source_binding_owner_id_music_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "music_source_binding_owner_check" CHECK (mapping_owner = 'music'::text)
);
-- Create index "music_source_binding_owner_idx" to table: "music_source_binding"
CREATE INDEX "music_source_binding_owner_idx" ON "music_source_binding" ("owner_id", "mapping_key");
-- Create "program_catalog_change" table
CREATE TABLE "program_catalog_change" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "actor_auth_user_id" uuid NULL,
  "operation" text NOT NULL,
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "withdrawn_at" timestamptz(3) NULL,
  CONSTRAINT "program_change_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "program_change_version_key" UNIQUE ("owner_id", "version"),
  CONSTRAINT "program_catalog_change_actor_auth_user_id_users_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "program_catalog_change_owner_id_program_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_change_operation_check" CHECK ((length(operation) >= 1) AND (length(operation) <= 96)),
  CONSTRAINT "program_change_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create index "program_change_actor_idx" to table: "program_catalog_change"
CREATE INDEX "program_change_actor_idx" ON "program_catalog_change" ("actor_auth_user_id", "id");
-- Create "program_catalog_relation" table
CREATE TABLE "program_catalog_relation" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "program_relation_owner_id_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "program_catalog_relation_QZ3DjZdHH1Zl_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_catalog_relation_owner_id_program_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_relation_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "program_relation_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text]))
);
-- Create index "program_relation_definition_idx" to table: "program_catalog_relation"
CREATE INDEX "program_relation_definition_idx" ON "program_catalog_relation" ("definition_revision_id", "id");
-- Create index "program_relation_owner_idx" to table: "program_catalog_relation"
CREATE INDEX "program_relation_owner_idx" ON "program_catalog_relation" ("owner_id", "definition_revision_id", "id");
-- Create "program_fact" table
CREATE TABLE "program_fact" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "last_node_position" bigint NOT NULL DEFAULT -1,
  "sealed_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "program_fact_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "program_fact_lxRH0iYxxCZn_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_fact_owner_id_program_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_fact_node_cursor_check" CHECK (((last_node_position >= '-1'::integer) AND (last_node_position <= '9007199254740991'::bigint)) AND ((sealed_at IS NULL) OR (last_node_position >= 0))),
  CONSTRAINT "program_fact_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text]))
);
-- Create index "program_fact_definition_idx" to table: "program_fact"
CREATE INDEX "program_fact_definition_idx" ON "program_fact" ("definition_revision_id", "id");
-- Create index "program_fact_owner_idx" to table: "program_fact"
CREATE INDEX "program_fact_owner_idx" ON "program_fact" ("owner_id", "definition_revision_id", "id");
-- Create "program_identifier_claim" table
CREATE TABLE "program_identifier_claim" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "value" text NOT NULL,
  "normalized_value" text NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "program_identifier_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "program_identifier_claim_owner_id_program_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_identifier_namespace_check" CHECK ((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 128)),
  CONSTRAINT "program_identifier_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "program_identifier_value_check" CHECK (((octet_length(normalized_value) >= 1) AND (octet_length(normalized_value) <= 512)) AND (length(value) > 0))
);
-- Create index "program_identifier_lookup_idx" to table: "program_identifier_claim"
CREATE INDEX "program_identifier_lookup_idx" ON "program_identifier_claim" ("namespace", "normalized_value", "owner_id", "id");
-- Create index "program_identifier_owner_idx" to table: "program_identifier_claim"
CREATE INDEX "program_identifier_owner_idx" ON "program_identifier_claim" ("owner_id", "id");
-- Create "program_named_form" table
CREATE TABLE "program_named_form" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "language_tag" text NULL,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "program_named_form_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "program_named_form_owner_id_program_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_named_form_kind_check" CHECK ((length(kind) >= 1) AND (length(kind) <= 96)),
  CONSTRAINT "program_named_form_language_check" CHECK ((language_tag IS NULL) OR ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255))),
  CONSTRAINT "program_named_form_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "program_named_form_value_check" CHECK (length(value) > 0)
);
-- Create index "program_named_form_language_idx" to table: "program_named_form"
CREATE INDEX "program_named_form_language_idx" ON "program_named_form" ("owner_id", "language_tag", "id");
-- Create index "program_named_form_owner_idx" to table: "program_named_form"
CREATE INDEX "program_named_form_owner_idx" ON "program_named_form" ("owner_id", "id");
-- Create "program_fact_support" table
CREATE TABLE "program_fact_support" (
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
  CONSTRAINT "program_support_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "program_fact_support_FA55Qe3cQnCx_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_support_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "program_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_support_identifier_fk" FOREIGN KEY ("owner_id", "identifier_id") REFERENCES "program_identifier_claim" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_support_named_form_fk" FOREIGN KEY ("owner_id", "named_form_id") REFERENCES "program_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_support_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "program_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_support_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_support_source_path_check" CHECK (length(source_path) > 0),
  CONSTRAINT "program_support_target_check" CHECK (num_nonnulls(fact_id, relation_id, named_form_id, identifier_id) = 1)
);
-- Create index "program_support_fact_idx" to table: "program_fact_support"
CREATE INDEX "program_support_fact_idx" ON "program_fact_support" ("owner_id", "fact_id", "id") WHERE (fact_id IS NOT NULL);
-- Create index "program_support_identifier_idx" to table: "program_fact_support"
CREATE INDEX "program_support_identifier_idx" ON "program_fact_support" ("owner_id", "identifier_id", "id") WHERE (identifier_id IS NOT NULL);
-- Create index "program_support_name_idx" to table: "program_fact_support"
CREATE INDEX "program_support_name_idx" ON "program_fact_support" ("owner_id", "named_form_id", "id") WHERE (named_form_id IS NOT NULL);
-- Create index "program_support_relation_idx" to table: "program_fact_support"
CREATE INDEX "program_support_relation_idx" ON "program_fact_support" ("owner_id", "relation_id", "id") WHERE (relation_id IS NOT NULL);
-- Create index "program_support_snapshot_idx" to table: "program_fact_support"
CREATE INDEX "program_support_snapshot_idx" ON "program_fact_support" ("source_record_id", "snapshot_id", "id");
-- Create "program_fact_value_node" table
CREATE TABLE "program_fact_value_node" (
  "owner_id" uuid NOT NULL,
  "fact_id" uuid NOT NULL,
  "position" bigint NOT NULL,
  "parent_position" bigint NULL,
  "parent_kind" text NULL,
  "member_key" text NULL,
  "kind" text NOT NULL,
  "text_value" text NULL,
  "number_value" numeric NULL,
  "boolean_value" boolean NULL,
  CONSTRAINT "program_fact_node_position_key" PRIMARY KEY ("owner_id", "fact_id", "position"),
  CONSTRAINT "program_fact_node_kind_key" UNIQUE ("owner_id", "fact_id", "position", "kind"),
  CONSTRAINT "program_fact_node_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "program_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_fact_node_parent_fk" FOREIGN KEY ("owner_id", "fact_id", "parent_position", "parent_kind") REFERENCES "program_fact_value_node" ("owner_id", "fact_id", "position", "kind") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_fact_node_kind_check" CHECK (kind = ANY (ARRAY['null'::text, 'string'::text, 'number'::text, 'boolean'::text, 'object'::text, 'array'::text])),
  CONSTRAINT "program_fact_node_number_check" CHECK ((number_value IS NULL) OR ((number_value)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text]))),
  CONSTRAINT "program_fact_node_parent_check" CHECK ((("position" = 0) AND (parent_position IS NULL) AND (parent_kind IS NULL) AND (member_key IS NULL)) OR (("position" > 0) AND (parent_position IS NOT NULL) AND (parent_kind IS NOT NULL) AND (((parent_kind = 'object'::text) AND (member_key IS NOT NULL)) OR ((parent_kind = 'array'::text) AND (member_key IS NULL))))),
  CONSTRAINT "program_fact_node_position_check" CHECK ((("position" >= 0) AND ("position" <= '9007199254740991'::bigint)) AND ((parent_position IS NULL) OR ((parent_position >= 0) AND (parent_position < "position")))),
  CONSTRAINT "program_fact_node_value_check" CHECK (((kind = 'string'::text) AND (text_value IS NOT NULL) AND (number_value IS NULL) AND (boolean_value IS NULL)) OR ((kind = 'number'::text) AND (number_value IS NOT NULL) AND (text_value IS NULL) AND (boolean_value IS NULL)) OR ((kind = 'boolean'::text) AND (boolean_value IS NOT NULL) AND (text_value IS NULL) AND (number_value IS NULL)) OR ((kind = ANY (ARRAY['null'::text, 'object'::text, 'array'::text])) AND (text_value IS NULL) AND (number_value IS NULL) AND (boolean_value IS NULL)))
);
-- Create index "program_fact_node_children_idx" to table: "program_fact_value_node"
CREATE INDEX "program_fact_node_children_idx" ON "program_fact_value_node" ("owner_id", "fact_id", "parent_position", "position");
-- Create "program_relation_participant" table
CREATE TABLE "program_relation_participant" (
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
  CONSTRAINT "program_participant_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "program_participant_position_key" UNIQUE ("owner_id", "relation_id", "position"),
  CONSTRAINT "program_participant_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "program_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_relation_participant_1zjzmq4a8dga_fkey" FOREIGN KEY ("publishing_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_relation_participant_OnYuCXzFftgg_fkey" FOREIGN KEY ("role_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_relation_participant_RradD3oBet4Y_fkey" FOREIGN KEY ("program_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_relation_participant_YpSFwqtDA0U2_fkey" FOREIGN KEY ("grouping_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_relation_participant_entity_id_entity_identity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_relation_participant_music_id_music_identity_id_fkey" FOREIGN KEY ("music_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_relation_participant_rXQRlmpxM3my_fkey" FOREIGN KEY ("software_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_relation_participant_yBVp7k7JZHs6_fkey" FOREIGN KEY ("reference_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_participant_position_check" CHECK (("position" >= 0) AND ("position" <= '9007199254740991'::bigint)),
  CONSTRAINT "program_participant_target_check" CHECK (num_nonnulls(publishing_id, music_id, program_id, software_id, entity_id, grouping_id, reference_id) = 1)
);
-- Create index "program_participant_entity_idx" to table: "program_relation_participant"
CREATE INDEX "program_participant_entity_idx" ON "program_relation_participant" ("entity_id", "role_revision_id", "relation_id") WHERE (entity_id IS NOT NULL);
-- Create index "program_participant_grouping_idx" to table: "program_relation_participant"
CREATE INDEX "program_participant_grouping_idx" ON "program_relation_participant" ("grouping_id", "role_revision_id", "relation_id") WHERE (grouping_id IS NOT NULL);
-- Create index "program_participant_music_idx" to table: "program_relation_participant"
CREATE INDEX "program_participant_music_idx" ON "program_relation_participant" ("music_id", "role_revision_id", "relation_id") WHERE (music_id IS NOT NULL);
-- Create index "program_participant_program_idx" to table: "program_relation_participant"
CREATE INDEX "program_participant_program_idx" ON "program_relation_participant" ("program_id", "role_revision_id", "relation_id") WHERE (program_id IS NOT NULL);
-- Create index "program_participant_publishing_idx" to table: "program_relation_participant"
CREATE INDEX "program_participant_publishing_idx" ON "program_relation_participant" ("publishing_id", "role_revision_id", "relation_id") WHERE (publishing_id IS NOT NULL);
-- Create index "program_participant_reference_idx" to table: "program_relation_participant"
CREATE INDEX "program_participant_reference_idx" ON "program_relation_participant" ("reference_id", "role_revision_id", "relation_id") WHERE (reference_id IS NOT NULL);
-- Create index "program_participant_role_idx" to table: "program_relation_participant"
CREATE INDEX "program_participant_role_idx" ON "program_relation_participant" ("role_revision_id", "relation_id", "id");
-- Create index "program_participant_software_idx" to table: "program_relation_participant"
CREATE INDEX "program_participant_software_idx" ON "program_relation_participant" ("software_id", "role_revision_id", "relation_id") WHERE (software_id IS NOT NULL);
-- Create "program_relation_scope" table
CREATE TABLE "program_relation_scope" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "relation_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "value_fact_id" uuid NOT NULL,
  CONSTRAINT "program_relation_scope_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "program_relation_scope_nRnMpJbk3QZc_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_scope_fact_fk" FOREIGN KEY ("owner_id", "value_fact_id") REFERENCES "program_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_scope_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "program_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "program_relation_scope_definition_idx" to table: "program_relation_scope"
CREATE INDEX "program_relation_scope_definition_idx" ON "program_relation_scope" ("definition_revision_id", "id");
-- Create index "program_relation_scope_fact_idx" to table: "program_relation_scope"
CREATE INDEX "program_relation_scope_fact_idx" ON "program_relation_scope" ("owner_id", "value_fact_id");
-- Create index "program_relation_scope_relation_idx" to table: "program_relation_scope"
CREATE INDEX "program_relation_scope_relation_idx" ON "program_relation_scope" ("owner_id", "relation_id", "definition_revision_id", "id");
-- Create "program_source_binding" table
CREATE TABLE "program_source_binding" (
  "mapping_key" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'program',
  "owner_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("mapping_key"),
  CONSTRAINT "program_source_binding_claim_fk" FOREIGN KEY ("mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_source_binding_owner_id_program_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "program_source_binding_owner_check" CHECK (mapping_owner = 'program'::text)
);
-- Create index "program_source_binding_owner_idx" to table: "program_source_binding"
CREATE INDEX "program_source_binding_owner_idx" ON "program_source_binding" ("owner_id", "mapping_key");
-- Create "publishing_catalog_change" table
CREATE TABLE "publishing_catalog_change" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "actor_auth_user_id" uuid NULL,
  "operation" text NOT NULL,
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "withdrawn_at" timestamptz(3) NULL,
  CONSTRAINT "publishing_change_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "publishing_change_version_key" UNIQUE ("owner_id", "version"),
  CONSTRAINT "publishing_catalog_change_actor_auth_user_id_users_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "publishing_catalog_change_owner_id_publishing_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_change_operation_check" CHECK ((length(operation) >= 1) AND (length(operation) <= 96)),
  CONSTRAINT "publishing_change_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create index "publishing_change_actor_idx" to table: "publishing_catalog_change"
CREATE INDEX "publishing_change_actor_idx" ON "publishing_catalog_change" ("actor_auth_user_id", "id");
-- Create "publishing_catalog_relation" table
CREATE TABLE "publishing_catalog_relation" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "publishing_relation_owner_id_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "publishing_catalog_relation_UDB7roMXdSq1_fkey" FOREIGN KEY ("owner_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_catalog_relation_mvE8Em4IdwRi_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_relation_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "publishing_relation_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text]))
);
-- Create index "publishing_relation_definition_idx" to table: "publishing_catalog_relation"
CREATE INDEX "publishing_relation_definition_idx" ON "publishing_catalog_relation" ("definition_revision_id", "id");
-- Create index "publishing_relation_owner_idx" to table: "publishing_catalog_relation"
CREATE INDEX "publishing_relation_owner_idx" ON "publishing_catalog_relation" ("owner_id", "definition_revision_id", "id");
-- Create "publishing_fact" table
CREATE TABLE "publishing_fact" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "last_node_position" bigint NOT NULL DEFAULT -1,
  "sealed_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "publishing_fact_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "publishing_fact_HwmQVUh6OJjM_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_fact_owner_id_publishing_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_fact_node_cursor_check" CHECK (((last_node_position >= '-1'::integer) AND (last_node_position <= '9007199254740991'::bigint)) AND ((sealed_at IS NULL) OR (last_node_position >= 0))),
  CONSTRAINT "publishing_fact_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text]))
);
-- Create index "publishing_fact_definition_idx" to table: "publishing_fact"
CREATE INDEX "publishing_fact_definition_idx" ON "publishing_fact" ("definition_revision_id", "id");
-- Create index "publishing_fact_owner_idx" to table: "publishing_fact"
CREATE INDEX "publishing_fact_owner_idx" ON "publishing_fact" ("owner_id", "definition_revision_id", "id");
-- Create "publishing_identifier_claim" table
CREATE TABLE "publishing_identifier_claim" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "value" text NOT NULL,
  "normalized_value" text NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "publishing_identifier_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "publishing_identifier_claim_FrcayBthFd7L_fkey" FOREIGN KEY ("owner_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_identifier_namespace_check" CHECK ((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 128)),
  CONSTRAINT "publishing_identifier_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "publishing_identifier_value_check" CHECK (((octet_length(normalized_value) >= 1) AND (octet_length(normalized_value) <= 512)) AND (length(value) > 0))
);
-- Create index "publishing_identifier_lookup_idx" to table: "publishing_identifier_claim"
CREATE INDEX "publishing_identifier_lookup_idx" ON "publishing_identifier_claim" ("namespace", "normalized_value", "owner_id", "id");
-- Create index "publishing_identifier_owner_idx" to table: "publishing_identifier_claim"
CREATE INDEX "publishing_identifier_owner_idx" ON "publishing_identifier_claim" ("owner_id", "id");
-- Create "publishing_named_form" table
CREATE TABLE "publishing_named_form" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "language_tag" text NULL,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "publishing_named_form_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "publishing_named_form_owner_id_publishing_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_named_form_kind_check" CHECK ((length(kind) >= 1) AND (length(kind) <= 96)),
  CONSTRAINT "publishing_named_form_language_check" CHECK ((language_tag IS NULL) OR ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255))),
  CONSTRAINT "publishing_named_form_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "publishing_named_form_value_check" CHECK (length(value) > 0)
);
-- Create index "publishing_named_form_language_idx" to table: "publishing_named_form"
CREATE INDEX "publishing_named_form_language_idx" ON "publishing_named_form" ("owner_id", "language_tag", "id");
-- Create index "publishing_named_form_owner_idx" to table: "publishing_named_form"
CREATE INDEX "publishing_named_form_owner_idx" ON "publishing_named_form" ("owner_id", "id");
-- Create "publishing_fact_support" table
CREATE TABLE "publishing_fact_support" (
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
  CONSTRAINT "publishing_support_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "publishing_fact_support_n0swMpSicz3c_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_support_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "publishing_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_support_identifier_fk" FOREIGN KEY ("owner_id", "identifier_id") REFERENCES "publishing_identifier_claim" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_support_named_form_fk" FOREIGN KEY ("owner_id", "named_form_id") REFERENCES "publishing_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_support_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "publishing_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_support_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_support_source_path_check" CHECK (length(source_path) > 0),
  CONSTRAINT "publishing_support_target_check" CHECK (num_nonnulls(fact_id, relation_id, named_form_id, identifier_id) = 1)
);
-- Create index "publishing_support_fact_idx" to table: "publishing_fact_support"
CREATE INDEX "publishing_support_fact_idx" ON "publishing_fact_support" ("owner_id", "fact_id", "id") WHERE (fact_id IS NOT NULL);
-- Create index "publishing_support_identifier_idx" to table: "publishing_fact_support"
CREATE INDEX "publishing_support_identifier_idx" ON "publishing_fact_support" ("owner_id", "identifier_id", "id") WHERE (identifier_id IS NOT NULL);
-- Create index "publishing_support_name_idx" to table: "publishing_fact_support"
CREATE INDEX "publishing_support_name_idx" ON "publishing_fact_support" ("owner_id", "named_form_id", "id") WHERE (named_form_id IS NOT NULL);
-- Create index "publishing_support_relation_idx" to table: "publishing_fact_support"
CREATE INDEX "publishing_support_relation_idx" ON "publishing_fact_support" ("owner_id", "relation_id", "id") WHERE (relation_id IS NOT NULL);
-- Create index "publishing_support_snapshot_idx" to table: "publishing_fact_support"
CREATE INDEX "publishing_support_snapshot_idx" ON "publishing_fact_support" ("source_record_id", "snapshot_id", "id");
-- Create "publishing_fact_value_node" table
CREATE TABLE "publishing_fact_value_node" (
  "owner_id" uuid NOT NULL,
  "fact_id" uuid NOT NULL,
  "position" bigint NOT NULL,
  "parent_position" bigint NULL,
  "parent_kind" text NULL,
  "member_key" text NULL,
  "kind" text NOT NULL,
  "text_value" text NULL,
  "number_value" numeric NULL,
  "boolean_value" boolean NULL,
  CONSTRAINT "publishing_fact_node_position_key" PRIMARY KEY ("owner_id", "fact_id", "position"),
  CONSTRAINT "publishing_fact_node_kind_key" UNIQUE ("owner_id", "fact_id", "position", "kind"),
  CONSTRAINT "publishing_fact_node_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "publishing_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_fact_node_parent_fk" FOREIGN KEY ("owner_id", "fact_id", "parent_position", "parent_kind") REFERENCES "publishing_fact_value_node" ("owner_id", "fact_id", "position", "kind") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_fact_node_kind_check" CHECK (kind = ANY (ARRAY['null'::text, 'string'::text, 'number'::text, 'boolean'::text, 'object'::text, 'array'::text])),
  CONSTRAINT "publishing_fact_node_number_check" CHECK ((number_value IS NULL) OR ((number_value)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text]))),
  CONSTRAINT "publishing_fact_node_parent_check" CHECK ((("position" = 0) AND (parent_position IS NULL) AND (parent_kind IS NULL) AND (member_key IS NULL)) OR (("position" > 0) AND (parent_position IS NOT NULL) AND (parent_kind IS NOT NULL) AND (((parent_kind = 'object'::text) AND (member_key IS NOT NULL)) OR ((parent_kind = 'array'::text) AND (member_key IS NULL))))),
  CONSTRAINT "publishing_fact_node_position_check" CHECK ((("position" >= 0) AND ("position" <= '9007199254740991'::bigint)) AND ((parent_position IS NULL) OR ((parent_position >= 0) AND (parent_position < "position")))),
  CONSTRAINT "publishing_fact_node_value_check" CHECK (((kind = 'string'::text) AND (text_value IS NOT NULL) AND (number_value IS NULL) AND (boolean_value IS NULL)) OR ((kind = 'number'::text) AND (number_value IS NOT NULL) AND (text_value IS NULL) AND (boolean_value IS NULL)) OR ((kind = 'boolean'::text) AND (boolean_value IS NOT NULL) AND (text_value IS NULL) AND (number_value IS NULL)) OR ((kind = ANY (ARRAY['null'::text, 'object'::text, 'array'::text])) AND (text_value IS NULL) AND (number_value IS NULL) AND (boolean_value IS NULL)))
);
-- Create index "publishing_fact_node_children_idx" to table: "publishing_fact_value_node"
CREATE INDEX "publishing_fact_node_children_idx" ON "publishing_fact_value_node" ("owner_id", "fact_id", "parent_position", "position");
-- Create "publishing_relation_participant" table
CREATE TABLE "publishing_relation_participant" (
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
  CONSTRAINT "publishing_participant_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "publishing_participant_position_key" UNIQUE ("owner_id", "relation_id", "position"),
  CONSTRAINT "publishing_participant_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "publishing_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_relation_participant_0q7oSm4ehIWD_fkey" FOREIGN KEY ("publishing_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_relation_participant_5eAk6uKeseVF_fkey" FOREIGN KEY ("reference_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_relation_participant_BxzK4tONEFUr_fkey" FOREIGN KEY ("software_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_relation_participant_FtINvoIPIlk5_fkey" FOREIGN KEY ("role_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_relation_participant_UlhjYjw1q4wJ_fkey" FOREIGN KEY ("program_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_relation_participant_UodpcZDXtLMH_fkey" FOREIGN KEY ("grouping_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_relation_participant_hnC4nW8CgGAH_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_relation_participant_music_id_music_identity_id_fkey" FOREIGN KEY ("music_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_participant_position_check" CHECK (("position" >= 0) AND ("position" <= '9007199254740991'::bigint)),
  CONSTRAINT "publishing_participant_target_check" CHECK (num_nonnulls(publishing_id, music_id, program_id, software_id, entity_id, grouping_id, reference_id) = 1)
);
-- Create index "publishing_participant_entity_idx" to table: "publishing_relation_participant"
CREATE INDEX "publishing_participant_entity_idx" ON "publishing_relation_participant" ("entity_id", "role_revision_id", "relation_id") WHERE (entity_id IS NOT NULL);
-- Create index "publishing_participant_grouping_idx" to table: "publishing_relation_participant"
CREATE INDEX "publishing_participant_grouping_idx" ON "publishing_relation_participant" ("grouping_id", "role_revision_id", "relation_id") WHERE (grouping_id IS NOT NULL);
-- Create index "publishing_participant_music_idx" to table: "publishing_relation_participant"
CREATE INDEX "publishing_participant_music_idx" ON "publishing_relation_participant" ("music_id", "role_revision_id", "relation_id") WHERE (music_id IS NOT NULL);
-- Create index "publishing_participant_program_idx" to table: "publishing_relation_participant"
CREATE INDEX "publishing_participant_program_idx" ON "publishing_relation_participant" ("program_id", "role_revision_id", "relation_id") WHERE (program_id IS NOT NULL);
-- Create index "publishing_participant_publishing_idx" to table: "publishing_relation_participant"
CREATE INDEX "publishing_participant_publishing_idx" ON "publishing_relation_participant" ("publishing_id", "role_revision_id", "relation_id") WHERE (publishing_id IS NOT NULL);
-- Create index "publishing_participant_reference_idx" to table: "publishing_relation_participant"
CREATE INDEX "publishing_participant_reference_idx" ON "publishing_relation_participant" ("reference_id", "role_revision_id", "relation_id") WHERE (reference_id IS NOT NULL);
-- Create index "publishing_participant_role_idx" to table: "publishing_relation_participant"
CREATE INDEX "publishing_participant_role_idx" ON "publishing_relation_participant" ("role_revision_id", "relation_id", "id");
-- Create index "publishing_participant_software_idx" to table: "publishing_relation_participant"
CREATE INDEX "publishing_participant_software_idx" ON "publishing_relation_participant" ("software_id", "role_revision_id", "relation_id") WHERE (software_id IS NOT NULL);
-- Create "publishing_relation_scope" table
CREATE TABLE "publishing_relation_scope" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "relation_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "value_fact_id" uuid NOT NULL,
  CONSTRAINT "publishing_relation_scope_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "publishing_relation_scope_5QDFWgkOFfi7_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_scope_fact_fk" FOREIGN KEY ("owner_id", "value_fact_id") REFERENCES "publishing_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_scope_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "publishing_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "publishing_relation_scope_definition_idx" to table: "publishing_relation_scope"
CREATE INDEX "publishing_relation_scope_definition_idx" ON "publishing_relation_scope" ("definition_revision_id", "id");
-- Create index "publishing_relation_scope_fact_idx" to table: "publishing_relation_scope"
CREATE INDEX "publishing_relation_scope_fact_idx" ON "publishing_relation_scope" ("owner_id", "value_fact_id");
-- Create index "publishing_relation_scope_relation_idx" to table: "publishing_relation_scope"
CREATE INDEX "publishing_relation_scope_relation_idx" ON "publishing_relation_scope" ("owner_id", "relation_id", "definition_revision_id", "id");
-- Create "publishing_source_binding" table
CREATE TABLE "publishing_source_binding" (
  "mapping_key" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'publishing',
  "owner_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("mapping_key"),
  CONSTRAINT "publishing_source_binding_claim_fk" FOREIGN KEY ("mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_source_binding_owner_id_publishing_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "publishing_source_binding_owner_check" CHECK (mapping_owner = 'publishing'::text)
);
-- Create index "publishing_source_binding_owner_idx" to table: "publishing_source_binding"
CREATE INDEX "publishing_source_binding_owner_idx" ON "publishing_source_binding" ("owner_id", "mapping_key");
-- Create "reference_catalog_change" table
CREATE TABLE "reference_catalog_change" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "actor_auth_user_id" uuid NULL,
  "operation" text NOT NULL,
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "withdrawn_at" timestamptz(3) NULL,
  CONSTRAINT "reference_change_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "reference_change_version_key" UNIQUE ("owner_id", "version"),
  CONSTRAINT "reference_catalog_change_actor_auth_user_id_users_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "reference_catalog_change_owner_id_reference_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_change_operation_check" CHECK ((length(operation) >= 1) AND (length(operation) <= 96)),
  CONSTRAINT "reference_change_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create index "reference_change_actor_idx" to table: "reference_catalog_change"
CREATE INDEX "reference_change_actor_idx" ON "reference_catalog_change" ("actor_auth_user_id", "id");
-- Create "reference_catalog_relation" table
CREATE TABLE "reference_catalog_relation" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "reference_relation_owner_id_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "reference_catalog_relation_owner_id_reference_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_catalog_relation_ylEwhULxN16e_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_relation_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "reference_relation_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text]))
);
-- Create index "reference_relation_definition_idx" to table: "reference_catalog_relation"
CREATE INDEX "reference_relation_definition_idx" ON "reference_catalog_relation" ("definition_revision_id", "id");
-- Create index "reference_relation_owner_idx" to table: "reference_catalog_relation"
CREATE INDEX "reference_relation_owner_idx" ON "reference_catalog_relation" ("owner_id", "definition_revision_id", "id");
-- Create "reference_fact" table
CREATE TABLE "reference_fact" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "last_node_position" bigint NOT NULL DEFAULT -1,
  "sealed_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "reference_fact_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "reference_fact_blFmAXKBLnyQ_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_fact_owner_id_reference_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_fact_node_cursor_check" CHECK (((last_node_position >= '-1'::integer) AND (last_node_position <= '9007199254740991'::bigint)) AND ((sealed_at IS NULL) OR (last_node_position >= 0))),
  CONSTRAINT "reference_fact_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text]))
);
-- Create index "reference_fact_definition_idx" to table: "reference_fact"
CREATE INDEX "reference_fact_definition_idx" ON "reference_fact" ("definition_revision_id", "id");
-- Create index "reference_fact_owner_idx" to table: "reference_fact"
CREATE INDEX "reference_fact_owner_idx" ON "reference_fact" ("owner_id", "definition_revision_id", "id");
-- Create "reference_identifier_claim" table
CREATE TABLE "reference_identifier_claim" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "value" text NOT NULL,
  "normalized_value" text NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "reference_identifier_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "reference_identifier_claim_owner_id_reference_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_identifier_namespace_check" CHECK ((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 128)),
  CONSTRAINT "reference_identifier_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "reference_identifier_value_check" CHECK (((octet_length(normalized_value) >= 1) AND (octet_length(normalized_value) <= 512)) AND (length(value) > 0))
);
-- Create index "reference_identifier_lookup_idx" to table: "reference_identifier_claim"
CREATE INDEX "reference_identifier_lookup_idx" ON "reference_identifier_claim" ("namespace", "normalized_value", "owner_id", "id");
-- Create index "reference_identifier_owner_idx" to table: "reference_identifier_claim"
CREATE INDEX "reference_identifier_owner_idx" ON "reference_identifier_claim" ("owner_id", "id");
-- Create "reference_named_form" table
CREATE TABLE "reference_named_form" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "language_tag" text NULL,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "reference_named_form_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "reference_named_form_owner_id_reference_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_named_form_kind_check" CHECK ((length(kind) >= 1) AND (length(kind) <= 96)),
  CONSTRAINT "reference_named_form_language_check" CHECK ((language_tag IS NULL) OR ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255))),
  CONSTRAINT "reference_named_form_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "reference_named_form_value_check" CHECK (length(value) > 0)
);
-- Create index "reference_named_form_language_idx" to table: "reference_named_form"
CREATE INDEX "reference_named_form_language_idx" ON "reference_named_form" ("owner_id", "language_tag", "id");
-- Create index "reference_named_form_owner_idx" to table: "reference_named_form"
CREATE INDEX "reference_named_form_owner_idx" ON "reference_named_form" ("owner_id", "id");
-- Create "reference_fact_support" table
CREATE TABLE "reference_fact_support" (
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
  CONSTRAINT "reference_support_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "reference_fact_support_VKNEVQ9Sm5OU_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_support_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "reference_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_support_identifier_fk" FOREIGN KEY ("owner_id", "identifier_id") REFERENCES "reference_identifier_claim" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_support_named_form_fk" FOREIGN KEY ("owner_id", "named_form_id") REFERENCES "reference_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_support_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "reference_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_support_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_support_source_path_check" CHECK (length(source_path) > 0),
  CONSTRAINT "reference_support_target_check" CHECK (num_nonnulls(fact_id, relation_id, named_form_id, identifier_id) = 1)
);
-- Create index "reference_support_fact_idx" to table: "reference_fact_support"
CREATE INDEX "reference_support_fact_idx" ON "reference_fact_support" ("owner_id", "fact_id", "id") WHERE (fact_id IS NOT NULL);
-- Create index "reference_support_identifier_idx" to table: "reference_fact_support"
CREATE INDEX "reference_support_identifier_idx" ON "reference_fact_support" ("owner_id", "identifier_id", "id") WHERE (identifier_id IS NOT NULL);
-- Create index "reference_support_name_idx" to table: "reference_fact_support"
CREATE INDEX "reference_support_name_idx" ON "reference_fact_support" ("owner_id", "named_form_id", "id") WHERE (named_form_id IS NOT NULL);
-- Create index "reference_support_relation_idx" to table: "reference_fact_support"
CREATE INDEX "reference_support_relation_idx" ON "reference_fact_support" ("owner_id", "relation_id", "id") WHERE (relation_id IS NOT NULL);
-- Create index "reference_support_snapshot_idx" to table: "reference_fact_support"
CREATE INDEX "reference_support_snapshot_idx" ON "reference_fact_support" ("source_record_id", "snapshot_id", "id");
-- Create "reference_fact_value_node" table
CREATE TABLE "reference_fact_value_node" (
  "owner_id" uuid NOT NULL,
  "fact_id" uuid NOT NULL,
  "position" bigint NOT NULL,
  "parent_position" bigint NULL,
  "parent_kind" text NULL,
  "member_key" text NULL,
  "kind" text NOT NULL,
  "text_value" text NULL,
  "number_value" numeric NULL,
  "boolean_value" boolean NULL,
  CONSTRAINT "reference_fact_node_position_key" PRIMARY KEY ("owner_id", "fact_id", "position"),
  CONSTRAINT "reference_fact_node_kind_key" UNIQUE ("owner_id", "fact_id", "position", "kind"),
  CONSTRAINT "reference_fact_node_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "reference_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_fact_node_parent_fk" FOREIGN KEY ("owner_id", "fact_id", "parent_position", "parent_kind") REFERENCES "reference_fact_value_node" ("owner_id", "fact_id", "position", "kind") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_fact_node_kind_check" CHECK (kind = ANY (ARRAY['null'::text, 'string'::text, 'number'::text, 'boolean'::text, 'object'::text, 'array'::text])),
  CONSTRAINT "reference_fact_node_number_check" CHECK ((number_value IS NULL) OR ((number_value)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text]))),
  CONSTRAINT "reference_fact_node_parent_check" CHECK ((("position" = 0) AND (parent_position IS NULL) AND (parent_kind IS NULL) AND (member_key IS NULL)) OR (("position" > 0) AND (parent_position IS NOT NULL) AND (parent_kind IS NOT NULL) AND (((parent_kind = 'object'::text) AND (member_key IS NOT NULL)) OR ((parent_kind = 'array'::text) AND (member_key IS NULL))))),
  CONSTRAINT "reference_fact_node_position_check" CHECK ((("position" >= 0) AND ("position" <= '9007199254740991'::bigint)) AND ((parent_position IS NULL) OR ((parent_position >= 0) AND (parent_position < "position")))),
  CONSTRAINT "reference_fact_node_value_check" CHECK (((kind = 'string'::text) AND (text_value IS NOT NULL) AND (number_value IS NULL) AND (boolean_value IS NULL)) OR ((kind = 'number'::text) AND (number_value IS NOT NULL) AND (text_value IS NULL) AND (boolean_value IS NULL)) OR ((kind = 'boolean'::text) AND (boolean_value IS NOT NULL) AND (text_value IS NULL) AND (number_value IS NULL)) OR ((kind = ANY (ARRAY['null'::text, 'object'::text, 'array'::text])) AND (text_value IS NULL) AND (number_value IS NULL) AND (boolean_value IS NULL)))
);
-- Create index "reference_fact_node_children_idx" to table: "reference_fact_value_node"
CREATE INDEX "reference_fact_node_children_idx" ON "reference_fact_value_node" ("owner_id", "fact_id", "parent_position", "position");
-- Create "reference_relation_participant" table
CREATE TABLE "reference_relation_participant" (
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
  CONSTRAINT "reference_participant_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "reference_participant_position_key" UNIQUE ("owner_id", "relation_id", "position"),
  CONSTRAINT "reference_participant_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "reference_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_relation_participant_0HUOxCc9khEd_fkey" FOREIGN KEY ("software_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_relation_participant_5K1ua6pPHp8b_fkey" FOREIGN KEY ("program_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_relation_participant_71F4wdtZiGgR_fkey" FOREIGN KEY ("publishing_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_relation_participant_8hOYzZBNBB1D_fkey" FOREIGN KEY ("reference_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_relation_participant_QfLCUlIN8EEH_fkey" FOREIGN KEY ("role_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_relation_participant_Z9NQ5UhcCy2p_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_relation_participant_iBTdSPFbQPGp_fkey" FOREIGN KEY ("grouping_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_relation_participant_music_id_music_identity_id_fkey" FOREIGN KEY ("music_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_participant_position_check" CHECK (("position" >= 0) AND ("position" <= '9007199254740991'::bigint)),
  CONSTRAINT "reference_participant_target_check" CHECK (num_nonnulls(publishing_id, music_id, program_id, software_id, entity_id, grouping_id, reference_id) = 1)
);
-- Create index "reference_participant_entity_idx" to table: "reference_relation_participant"
CREATE INDEX "reference_participant_entity_idx" ON "reference_relation_participant" ("entity_id", "role_revision_id", "relation_id") WHERE (entity_id IS NOT NULL);
-- Create index "reference_participant_grouping_idx" to table: "reference_relation_participant"
CREATE INDEX "reference_participant_grouping_idx" ON "reference_relation_participant" ("grouping_id", "role_revision_id", "relation_id") WHERE (grouping_id IS NOT NULL);
-- Create index "reference_participant_music_idx" to table: "reference_relation_participant"
CREATE INDEX "reference_participant_music_idx" ON "reference_relation_participant" ("music_id", "role_revision_id", "relation_id") WHERE (music_id IS NOT NULL);
-- Create index "reference_participant_program_idx" to table: "reference_relation_participant"
CREATE INDEX "reference_participant_program_idx" ON "reference_relation_participant" ("program_id", "role_revision_id", "relation_id") WHERE (program_id IS NOT NULL);
-- Create index "reference_participant_publishing_idx" to table: "reference_relation_participant"
CREATE INDEX "reference_participant_publishing_idx" ON "reference_relation_participant" ("publishing_id", "role_revision_id", "relation_id") WHERE (publishing_id IS NOT NULL);
-- Create index "reference_participant_reference_idx" to table: "reference_relation_participant"
CREATE INDEX "reference_participant_reference_idx" ON "reference_relation_participant" ("reference_id", "role_revision_id", "relation_id") WHERE (reference_id IS NOT NULL);
-- Create index "reference_participant_role_idx" to table: "reference_relation_participant"
CREATE INDEX "reference_participant_role_idx" ON "reference_relation_participant" ("role_revision_id", "relation_id", "id");
-- Create index "reference_participant_software_idx" to table: "reference_relation_participant"
CREATE INDEX "reference_participant_software_idx" ON "reference_relation_participant" ("software_id", "role_revision_id", "relation_id") WHERE (software_id IS NOT NULL);
-- Create "reference_relation_scope" table
CREATE TABLE "reference_relation_scope" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "relation_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "value_fact_id" uuid NOT NULL,
  CONSTRAINT "reference_relation_scope_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "reference_relation_scope_3CqtpgSRNxwt_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_scope_fact_fk" FOREIGN KEY ("owner_id", "value_fact_id") REFERENCES "reference_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_scope_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "reference_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "reference_relation_scope_definition_idx" to table: "reference_relation_scope"
CREATE INDEX "reference_relation_scope_definition_idx" ON "reference_relation_scope" ("definition_revision_id", "id");
-- Create index "reference_relation_scope_fact_idx" to table: "reference_relation_scope"
CREATE INDEX "reference_relation_scope_fact_idx" ON "reference_relation_scope" ("owner_id", "value_fact_id");
-- Create index "reference_relation_scope_relation_idx" to table: "reference_relation_scope"
CREATE INDEX "reference_relation_scope_relation_idx" ON "reference_relation_scope" ("owner_id", "relation_id", "definition_revision_id", "id");
-- Create "reference_source_binding" table
CREATE TABLE "reference_source_binding" (
  "mapping_key" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'reference',
  "owner_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("mapping_key"),
  CONSTRAINT "reference_source_binding_claim_fk" FOREIGN KEY ("mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_source_binding_owner_id_reference_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "reference_source_binding_owner_check" CHECK (mapping_owner = 'reference'::text)
);
-- Create index "reference_source_binding_owner_idx" to table: "reference_source_binding"
CREATE INDEX "reference_source_binding_owner_idx" ON "reference_source_binding" ("owner_id", "mapping_key");
-- Create "software_catalog_change" table
CREATE TABLE "software_catalog_change" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "version" bigint NOT NULL,
  "actor_auth_user_id" uuid NULL,
  "operation" text NOT NULL,
  "recorded_at" timestamptz(3) NOT NULL DEFAULT now(),
  "withdrawn_at" timestamptz(3) NULL,
  CONSTRAINT "software_change_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "software_change_version_key" UNIQUE ("owner_id", "version"),
  CONSTRAINT "software_catalog_change_actor_auth_user_id_users_id_fkey" FOREIGN KEY ("actor_auth_user_id") REFERENCES "users" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "software_catalog_change_owner_id_software_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_change_operation_check" CHECK ((length(operation) >= 1) AND (length(operation) <= 96)),
  CONSTRAINT "software_change_version_check" CHECK ((version >= 1) AND (version <= '9007199254740991'::bigint))
);
-- Create index "software_change_actor_idx" to table: "software_catalog_change"
CREATE INDEX "software_change_actor_idx" ON "software_catalog_change" ("actor_auth_user_id", "id");
-- Create "software_catalog_relation" table
CREATE TABLE "software_catalog_relation" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "revision" bigint NOT NULL DEFAULT 1,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "software_relation_owner_id_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "software_catalog_relation_ic6C2LM1boqu_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_catalog_relation_owner_id_software_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_relation_revision_check" CHECK ((revision >= 1) AND (revision <= '9007199254740991'::bigint)),
  CONSTRAINT "software_relation_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text]))
);
-- Create index "software_relation_definition_idx" to table: "software_catalog_relation"
CREATE INDEX "software_relation_definition_idx" ON "software_catalog_relation" ("definition_revision_id", "id");
-- Create index "software_relation_owner_idx" to table: "software_catalog_relation"
CREATE INDEX "software_relation_owner_idx" ON "software_catalog_relation" ("owner_id", "definition_revision_id", "id");
-- Create "software_fact" table
CREATE TABLE "software_fact" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "last_node_position" bigint NOT NULL DEFAULT -1,
  "sealed_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "software_fact_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "software_fact_owner_id_software_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_fact_pWTLdEOl91sc_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_fact_node_cursor_check" CHECK (((last_node_position >= '-1'::integer) AND (last_node_position <= '9007199254740991'::bigint)) AND ((sealed_at IS NULL) OR (last_node_position >= 0))),
  CONSTRAINT "software_fact_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text]))
);
-- Create index "software_fact_definition_idx" to table: "software_fact"
CREATE INDEX "software_fact_definition_idx" ON "software_fact" ("definition_revision_id", "id");
-- Create index "software_fact_owner_idx" to table: "software_fact"
CREATE INDEX "software_fact_owner_idx" ON "software_fact" ("owner_id", "definition_revision_id", "id");
-- Create "software_identifier_claim" table
CREATE TABLE "software_identifier_claim" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "namespace" text NOT NULL,
  "value" text NOT NULL,
  "normalized_value" text NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "software_identifier_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "software_identifier_claim_owner_id_software_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_identifier_namespace_check" CHECK ((octet_length(namespace) >= 1) AND (octet_length(namespace) <= 128)),
  CONSTRAINT "software_identifier_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "software_identifier_value_check" CHECK (((octet_length(normalized_value) >= 1) AND (octet_length(normalized_value) <= 512)) AND (length(value) > 0))
);
-- Create index "software_identifier_lookup_idx" to table: "software_identifier_claim"
CREATE INDEX "software_identifier_lookup_idx" ON "software_identifier_claim" ("namespace", "normalized_value", "owner_id", "id");
-- Create index "software_identifier_owner_idx" to table: "software_identifier_claim"
CREATE INDEX "software_identifier_owner_idx" ON "software_identifier_claim" ("owner_id", "id");
-- Create "software_named_form" table
CREATE TABLE "software_named_form" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "language_tag" text NULL,
  "kind" text NOT NULL,
  "value" text NOT NULL,
  "state" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT "software_named_form_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "software_named_form_owner_id_software_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_named_form_kind_check" CHECK ((length(kind) >= 1) AND (length(kind) <= 96)),
  CONSTRAINT "software_named_form_language_check" CHECK ((language_tag IS NULL) OR ((octet_length(language_tag) >= 1) AND (octet_length(language_tag) <= 255))),
  CONSTRAINT "software_named_form_state_check" CHECK (state = ANY (ARRAY['active'::text, 'disputed'::text, 'withdrawn'::text, 'superseded'::text])),
  CONSTRAINT "software_named_form_value_check" CHECK (length(value) > 0)
);
-- Create index "software_named_form_language_idx" to table: "software_named_form"
CREATE INDEX "software_named_form_language_idx" ON "software_named_form" ("owner_id", "language_tag", "id");
-- Create index "software_named_form_owner_idx" to table: "software_named_form"
CREATE INDEX "software_named_form_owner_idx" ON "software_named_form" ("owner_id", "id");
-- Create "software_fact_support" table
CREATE TABLE "software_fact_support" (
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
  CONSTRAINT "software_support_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "software_fact_support_xQlZBrNEaSVK_fkey" FOREIGN KEY ("source_record_id") REFERENCES "catalog_source_record" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_support_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "software_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_support_identifier_fk" FOREIGN KEY ("owner_id", "identifier_id") REFERENCES "software_identifier_claim" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_support_named_form_fk" FOREIGN KEY ("owner_id", "named_form_id") REFERENCES "software_named_form" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_support_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "software_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_support_snapshot_fk" FOREIGN KEY ("source_record_id", "snapshot_id") REFERENCES "catalog_source_snapshot" ("source_record_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_support_source_path_check" CHECK (length(source_path) > 0),
  CONSTRAINT "software_support_target_check" CHECK (num_nonnulls(fact_id, relation_id, named_form_id, identifier_id) = 1)
);
-- Create index "software_support_fact_idx" to table: "software_fact_support"
CREATE INDEX "software_support_fact_idx" ON "software_fact_support" ("owner_id", "fact_id", "id") WHERE (fact_id IS NOT NULL);
-- Create index "software_support_identifier_idx" to table: "software_fact_support"
CREATE INDEX "software_support_identifier_idx" ON "software_fact_support" ("owner_id", "identifier_id", "id") WHERE (identifier_id IS NOT NULL);
-- Create index "software_support_name_idx" to table: "software_fact_support"
CREATE INDEX "software_support_name_idx" ON "software_fact_support" ("owner_id", "named_form_id", "id") WHERE (named_form_id IS NOT NULL);
-- Create index "software_support_relation_idx" to table: "software_fact_support"
CREATE INDEX "software_support_relation_idx" ON "software_fact_support" ("owner_id", "relation_id", "id") WHERE (relation_id IS NOT NULL);
-- Create index "software_support_snapshot_idx" to table: "software_fact_support"
CREATE INDEX "software_support_snapshot_idx" ON "software_fact_support" ("source_record_id", "snapshot_id", "id");
-- Create "software_fact_value_node" table
CREATE TABLE "software_fact_value_node" (
  "owner_id" uuid NOT NULL,
  "fact_id" uuid NOT NULL,
  "position" bigint NOT NULL,
  "parent_position" bigint NULL,
  "parent_kind" text NULL,
  "member_key" text NULL,
  "kind" text NOT NULL,
  "text_value" text NULL,
  "number_value" numeric NULL,
  "boolean_value" boolean NULL,
  CONSTRAINT "software_fact_node_position_key" PRIMARY KEY ("owner_id", "fact_id", "position"),
  CONSTRAINT "software_fact_node_kind_key" UNIQUE ("owner_id", "fact_id", "position", "kind"),
  CONSTRAINT "software_fact_node_fact_fk" FOREIGN KEY ("owner_id", "fact_id") REFERENCES "software_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_fact_node_parent_fk" FOREIGN KEY ("owner_id", "fact_id", "parent_position", "parent_kind") REFERENCES "software_fact_value_node" ("owner_id", "fact_id", "position", "kind") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_fact_node_kind_check" CHECK (kind = ANY (ARRAY['null'::text, 'string'::text, 'number'::text, 'boolean'::text, 'object'::text, 'array'::text])),
  CONSTRAINT "software_fact_node_number_check" CHECK ((number_value IS NULL) OR ((number_value)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text]))),
  CONSTRAINT "software_fact_node_parent_check" CHECK ((("position" = 0) AND (parent_position IS NULL) AND (parent_kind IS NULL) AND (member_key IS NULL)) OR (("position" > 0) AND (parent_position IS NOT NULL) AND (parent_kind IS NOT NULL) AND (((parent_kind = 'object'::text) AND (member_key IS NOT NULL)) OR ((parent_kind = 'array'::text) AND (member_key IS NULL))))),
  CONSTRAINT "software_fact_node_position_check" CHECK ((("position" >= 0) AND ("position" <= '9007199254740991'::bigint)) AND ((parent_position IS NULL) OR ((parent_position >= 0) AND (parent_position < "position")))),
  CONSTRAINT "software_fact_node_value_check" CHECK (((kind = 'string'::text) AND (text_value IS NOT NULL) AND (number_value IS NULL) AND (boolean_value IS NULL)) OR ((kind = 'number'::text) AND (number_value IS NOT NULL) AND (text_value IS NULL) AND (boolean_value IS NULL)) OR ((kind = 'boolean'::text) AND (boolean_value IS NOT NULL) AND (text_value IS NULL) AND (number_value IS NULL)) OR ((kind = ANY (ARRAY['null'::text, 'object'::text, 'array'::text])) AND (text_value IS NULL) AND (number_value IS NULL) AND (boolean_value IS NULL)))
);
-- Create index "software_fact_node_children_idx" to table: "software_fact_value_node"
CREATE INDEX "software_fact_node_children_idx" ON "software_fact_value_node" ("owner_id", "fact_id", "parent_position", "position");
-- Create "software_relation_participant" table
CREATE TABLE "software_relation_participant" (
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
  CONSTRAINT "software_participant_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "software_participant_position_key" UNIQUE ("owner_id", "relation_id", "position"),
  CONSTRAINT "software_participant_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "software_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_relation_participant_4uIbgmxVCHTd_fkey" FOREIGN KEY ("role_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_relation_participant_Aq4tdDFZ8Q0F_fkey" FOREIGN KEY ("reference_id") REFERENCES "reference_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_relation_participant_E7JuG4ovbsTf_fkey" FOREIGN KEY ("grouping_id") REFERENCES "grouping_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_relation_participant_GdJEll5uLyeP_fkey" FOREIGN KEY ("program_id") REFERENCES "program_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_relation_participant_UabBdATxtzgB_fkey" FOREIGN KEY ("software_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_relation_participant_entity_id_entity_identity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_relation_participant_lbJe7ICkq1O5_fkey" FOREIGN KEY ("publishing_id") REFERENCES "publishing_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_relation_participant_music_id_music_identity_id_fkey" FOREIGN KEY ("music_id") REFERENCES "music_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_participant_position_check" CHECK (("position" >= 0) AND ("position" <= '9007199254740991'::bigint)),
  CONSTRAINT "software_participant_target_check" CHECK (num_nonnulls(publishing_id, music_id, program_id, software_id, entity_id, grouping_id, reference_id) = 1)
);
-- Create index "software_participant_entity_idx" to table: "software_relation_participant"
CREATE INDEX "software_participant_entity_idx" ON "software_relation_participant" ("entity_id", "role_revision_id", "relation_id") WHERE (entity_id IS NOT NULL);
-- Create index "software_participant_grouping_idx" to table: "software_relation_participant"
CREATE INDEX "software_participant_grouping_idx" ON "software_relation_participant" ("grouping_id", "role_revision_id", "relation_id") WHERE (grouping_id IS NOT NULL);
-- Create index "software_participant_music_idx" to table: "software_relation_participant"
CREATE INDEX "software_participant_music_idx" ON "software_relation_participant" ("music_id", "role_revision_id", "relation_id") WHERE (music_id IS NOT NULL);
-- Create index "software_participant_program_idx" to table: "software_relation_participant"
CREATE INDEX "software_participant_program_idx" ON "software_relation_participant" ("program_id", "role_revision_id", "relation_id") WHERE (program_id IS NOT NULL);
-- Create index "software_participant_publishing_idx" to table: "software_relation_participant"
CREATE INDEX "software_participant_publishing_idx" ON "software_relation_participant" ("publishing_id", "role_revision_id", "relation_id") WHERE (publishing_id IS NOT NULL);
-- Create index "software_participant_reference_idx" to table: "software_relation_participant"
CREATE INDEX "software_participant_reference_idx" ON "software_relation_participant" ("reference_id", "role_revision_id", "relation_id") WHERE (reference_id IS NOT NULL);
-- Create index "software_participant_role_idx" to table: "software_relation_participant"
CREATE INDEX "software_participant_role_idx" ON "software_relation_participant" ("role_revision_id", "relation_id", "id");
-- Create index "software_participant_software_idx" to table: "software_relation_participant"
CREATE INDEX "software_participant_software_idx" ON "software_relation_participant" ("software_id", "role_revision_id", "relation_id") WHERE (software_id IS NOT NULL);
-- Create "software_relation_scope" table
CREATE TABLE "software_relation_scope" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "owner_id" uuid NOT NULL,
  "relation_id" uuid NOT NULL,
  "definition_revision_id" uuid NOT NULL,
  "value_fact_id" uuid NOT NULL,
  CONSTRAINT "software_relation_scope_identity_key" PRIMARY KEY ("owner_id", "id"),
  CONSTRAINT "software_relation_scope_oDknX3JOGZiN_fkey" FOREIGN KEY ("definition_revision_id") REFERENCES "catalog_definition_revision" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_scope_fact_fk" FOREIGN KEY ("owner_id", "value_fact_id") REFERENCES "software_fact" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_scope_relation_fk" FOREIGN KEY ("owner_id", "relation_id") REFERENCES "software_catalog_relation" ("owner_id", "id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "software_relation_scope_definition_idx" to table: "software_relation_scope"
CREATE INDEX "software_relation_scope_definition_idx" ON "software_relation_scope" ("definition_revision_id", "id");
-- Create index "software_relation_scope_fact_idx" to table: "software_relation_scope"
CREATE INDEX "software_relation_scope_fact_idx" ON "software_relation_scope" ("owner_id", "value_fact_id");
-- Create index "software_relation_scope_relation_idx" to table: "software_relation_scope"
CREATE INDEX "software_relation_scope_relation_idx" ON "software_relation_scope" ("owner_id", "relation_id", "definition_revision_id", "id");
-- Create "software_source_binding" table
CREATE TABLE "software_source_binding" (
  "mapping_key" uuid NOT NULL,
  "mapping_owner" text NOT NULL DEFAULT 'software',
  "owner_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("mapping_key"),
  CONSTRAINT "software_source_binding_claim_fk" FOREIGN KEY ("mapping_key", "mapping_owner") REFERENCES "catalog_source_mapping_claim" ("mapping_key", "owner") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_binding_owner_id_software_identity_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "software_identity" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "software_source_binding_owner_check" CHECK (mapping_owner = 'software'::text)
);
-- Create index "software_source_binding_owner_idx" to table: "software_source_binding"
CREATE INDEX "software_source_binding_owner_idx" ON "software_source_binding" ("owner_id", "mapping_key");

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

CREATE TRIGGER catalog_definition_identity_guard
BEFORE UPDATE OR DELETE ON public.catalog_definition
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_definition_identity();

CREATE TRIGGER catalog_definition_revision_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.catalog_definition_revision
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_definition_revision();

CREATE TRIGGER grouping_class_definition_guard
BEFORE INSERT OR UPDATE ON public.grouping_class_assignment
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('class_revision_id', 'class');

CREATE TRIGGER catalog_legacy_identity_guard
BEFORE INSERT ON public.unit
FOR EACH ROW EXECUTE FUNCTION public.catalog_guard_legacy_identity();

CREATE TRIGGER publishing_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.publishing_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('publishing');

CREATE TRIGGER publishing_identity_route_remove
AFTER DELETE ON public.publishing_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('publishing');

CREATE TRIGGER publishing_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.publishing_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

CREATE TRIGGER publishing_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.publishing_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

CREATE TRIGGER publishing_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.publishing_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

CREATE TRIGGER publishing_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.publishing_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

CREATE TRIGGER music_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.music_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('music');

CREATE TRIGGER music_identity_route_remove
AFTER DELETE ON public.music_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('music');

CREATE TRIGGER music_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.music_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

CREATE TRIGGER music_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.music_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

CREATE TRIGGER music_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.music_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

CREATE TRIGGER music_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.music_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

CREATE TRIGGER program_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.program_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('program');

CREATE TRIGGER program_identity_route_remove
AFTER DELETE ON public.program_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('program');

CREATE TRIGGER program_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.program_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

CREATE TRIGGER program_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.program_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

CREATE TRIGGER program_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.program_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

CREATE TRIGGER program_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.program_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

CREATE TRIGGER software_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.software_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('software');

CREATE TRIGGER software_identity_route_remove
AFTER DELETE ON public.software_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('software');

CREATE TRIGGER software_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.software_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

CREATE TRIGGER software_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.software_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

CREATE TRIGGER software_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.software_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

CREATE TRIGGER software_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.software_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

CREATE TRIGGER entity_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.entity_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('entity');

CREATE TRIGGER entity_identity_route_remove
AFTER DELETE ON public.entity_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('entity');

CREATE TRIGGER entity_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.entity_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

CREATE TRIGGER entity_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.entity_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

CREATE TRIGGER entity_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.entity_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

CREATE TRIGGER entity_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.entity_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

CREATE TRIGGER grouping_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.grouping_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('grouping');

CREATE TRIGGER grouping_identity_route_remove
AFTER DELETE ON public.grouping_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('grouping');

CREATE TRIGGER grouping_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.grouping_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

CREATE TRIGGER grouping_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.grouping_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

CREATE TRIGGER grouping_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.grouping_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

CREATE TRIGGER grouping_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.grouping_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

CREATE TRIGGER reference_identity_route_publish
AFTER INSERT OR UPDATE OF id, routing_generation ON public.reference_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_publish_identity_route('reference');

CREATE TRIGGER reference_identity_route_remove
AFTER DELETE ON public.reference_identity
FOR EACH ROW EXECUTE FUNCTION public.catalog_remove_identity_route('reference');

CREATE TRIGGER reference_fact_definition_guard
BEFORE INSERT OR UPDATE ON public.reference_fact
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

CREATE TRIGGER reference_catalog_relation_definition_guard
BEFORE INSERT OR UPDATE ON public.reference_catalog_relation
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'predicate');

CREATE TRIGGER reference_relation_participant_definition_guard
BEFORE INSERT OR UPDATE ON public.reference_relation_participant
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('role_revision_id', 'role');

CREATE TRIGGER reference_relation_scope_definition_guard
BEFORE INSERT OR UPDATE ON public.reference_relation_scope
FOR EACH ROW EXECUTE FUNCTION public.catalog_require_definition_kind('definition_revision_id', 'property');

-- These owner tables are introduced empty by this migration. The locator is a
-- derived index and admission starts only after its control row is installed.
INSERT INTO public.catalog_routing_control(singleton, ready) VALUES (true, true);
