SET search_path TO public;

-- Deliberately fail with an invalid integer cast when any retired fact exists.
-- Every EXISTS stops at its first row, so the cutover check is bounded even for
-- corpus-scale relations.
SELECT CASE
	WHEN EXISTS (SELECT 1 FROM public.unit_structure)
		OR EXISTS (SELECT 1 FROM public.unit_structure_member)
		OR EXISTS (SELECT 1 FROM public.unit_structure_edge)
		OR EXISTS (SELECT 1 FROM public.unit_structure_vote)
		OR EXISTS (SELECT 1 FROM public.unit_structure_vote_stat)
		OR EXISTS (SELECT 1 FROM public.unit_structure_application)
		OR EXISTS (SELECT 1 FROM public.unit_structure_application_vote)
		OR EXISTS (SELECT 1 FROM public.unit_structure_application_vote_stat)
		OR EXISTS (SELECT 1 FROM public.unit_tag_structure_support)
		OR EXISTS (SELECT 1 FROM public.unit_tag_vote)
		OR EXISTS (SELECT 1 FROM public.unit_tag_vote_stat)
		OR EXISTS (SELECT 1 FROM public.realm_tag_vote)
		OR EXISTS (SELECT 1 FROM public.realm_tag_vote_stat)
		OR EXISTS (SELECT 1 FROM public.unit WHERE kind = 'structure')
	THEN 'Tag Path cutover rejected: legacy Structure or Tag-vote data exists'
	ELSE '1'
END::integer;

SELECT CASE
	WHEN EXISTS (
		SELECT 1
		FROM public.unit_merge_operation
		WHERE phase::text IN (
			'realm_tag_votes',
			'structure_members',
			'structure_edges_parent',
			'structure_edges_child',
			'structure_applications'
		)
	)
	THEN 'Tag Path cutover rejected: a Unit merge uses a retired phase'
	ELSE '1'
END::integer;

ALTER TABLE public.unit_merge_operation
	ALTER COLUMN phase DROP DEFAULT;
ALTER TYPE public.unit_merge_operation_phase
	RENAME TO unit_merge_operation_phase_retired_20260825;
CREATE TYPE public.unit_merge_operation_phase AS ENUM (
	'entity_measurement_preflight',
	'entity_measurement_entities',
	'entity_measurement_contexts',
	'variant_graph',
	'slug_addresses',
	'slug_scopes',
	'aliases',
	'external_links',
	'external_link_sources',
	'software_requirements',
	'software_requirement_platforms',
	'unit_reactions',
	'unit_shares',
	'unit_follows',
	'scores',
	'collection_items',
	'unit_tags',
	'realm_tag_judgments',
	'profile_unit_tags',
	'realm_pins',
	'realm_units',
	'realm_unit_tags',
	'post_subjects',
	'association_proposal_sources',
	'association_proposal_targets',
	'credit_sources',
	'credit_targets',
	'subject_sources',
	'subject_entities',
	'release_parents',
	'series_releases',
	'poll_options',
	'content_nodes_content',
	'content_nodes_target',
	'tag_path_applications',
	'progress_entries',
	'progress_snapshots',
	'notification_subjects',
	'derived_state',
	'finalize'
);
ALTER TABLE public.unit_merge_operation
	ALTER COLUMN phase TYPE public.unit_merge_operation_phase
	USING phase::text::public.unit_merge_operation_phase;
ALTER TABLE public.unit_merge_operation
	ALTER COLUMN phase SET DEFAULT 'entity_measurement_preflight'::public.unit_merge_operation_phase;
DROP TYPE public.unit_merge_operation_phase_retired_20260825;

-- Create enum type "realm_tag_fallback_policy"
CREATE TYPE "realm_tag_fallback_policy" AS ENUM ('inherit', 'isolate');
-- Modify "profile_preference" table
ALTER TABLE "profile_preference" ADD COLUMN "always_show_spoilers" boolean NOT NULL DEFAULT false, ADD COLUMN "always_show_nsfw" boolean NOT NULL DEFAULT false;
-- Create index "realm_unit_tag_tag_route_idx" to table: "realm_unit_tag"
CREATE INDEX "realm_unit_tag_tag_route_idx" ON "realm_unit_tag" ("tag_id", "realm_id", "unit_id");
-- Modify "unit" table
ALTER TABLE "unit" DROP CONSTRAINT "unit_kind_check", ADD CONSTRAINT "unit_kind_check" CHECK (kind = ANY (ARRAY['slug_namespace'::text, 'profile'::text, 'book'::text, 'software'::text, 'media'::text, 'video'::text, 'audio'::text, 'release'::text, 'entity'::text, 'label'::text, 'tag'::text, 'tag_path'::text, 'series'::text, 'zone'::text, 'zone_page'::text, 'collection'::text, 'post'::text, 'poll'::text, 'realm'::text, 'realm_rule'::text]));
-- Modify "unit_merge_operation" table
ALTER TABLE "unit_merge_operation" ADD COLUMN "measurement_preflight_cursor_entity_id" uuid NULL;
-- Create "entity_measurement" table
CREATE TABLE "entity_measurement" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "entity_id" uuid NOT NULL,
  "context_unit_id" uuid NULL,
  "height_millimetres" integer NULL,
  "weight_grams" integer NULL,
  "bust_millimetres" integer NULL,
  "waist_millimetres" integer NULL,
  "hips_millimetres" integer NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "entity_measurement_entity_context_key" UNIQUE NULLS NOT DISTINCT ("entity_id", "context_unit_id"),
  CONSTRAINT "entity_measurement_context_unit_id_unit_id_fkey" FOREIGN KEY ("context_unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "entity_measurement_entity_id_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entity" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "entity_measurement_context_not_self_check" CHECK ((context_unit_id IS NULL) OR (context_unit_id <> entity_id)),
  CONSTRAINT "entity_measurement_positive_check" CHECK (COALESCE((height_millimetres > 0), true) AND COALESCE((weight_grams > 0), true) AND COALESCE((bust_millimetres > 0), true) AND COALESCE((waist_millimetres > 0), true) AND COALESCE((hips_millimetres > 0), true)),
  CONSTRAINT "entity_measurement_value_present_check" CHECK (num_nonnulls(height_millimetres, weight_grams, bust_millimetres, waist_millimetres, hips_millimetres) > 0)
);
-- Create index "entity_measurement_context_idx" to table: "entity_measurement"
CREATE INDEX "entity_measurement_context_idx" ON "entity_measurement" ("context_unit_id", "entity_id") WHERE (context_unit_id IS NOT NULL);
-- Create "content_pack_import" table
CREATE TABLE "content_pack_import" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "pack_id" text NOT NULL,
  "version" text NOT NULL,
  "checksum" text NOT NULL,
  "source_lock_kind" text NOT NULL,
  "manifest_snapshot" jsonb NOT NULL,
  "source_lock_snapshot" jsonb NOT NULL,
  "rights_snapshot" jsonb NOT NULL,
  "bindings_snapshot" jsonb NOT NULL,
  "importer_profile_id" uuid NOT NULL,
  "applied_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "content_pack_import_id_profile_key" UNIQUE ("id", "importer_profile_id"),
  CONSTRAINT "content_pack_import_pack_version_key" UNIQUE ("pack_id", "version"),
  CONSTRAINT "content_pack_import_importer_profile_id_profile_id_fkey" FOREIGN KEY ("importer_profile_id") REFERENCES "profile" ("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "content_pack_import_bindings_snapshot_check" CHECK (jsonb_typeof(bindings_snapshot) = 'array'::text),
  CONSTRAINT "content_pack_import_checksum_check" CHECK (checksum ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "content_pack_import_manifest_snapshot_check" CHECK ((manifest_snapshot IS NULL) OR (jsonb_typeof(manifest_snapshot) = 'object'::text)),
  CONSTRAINT "content_pack_import_pack_id_check" CHECK (pack_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62})$'::text),
  CONSTRAINT "content_pack_import_rights_snapshot_check" CHECK (jsonb_typeof(rights_snapshot) = 'array'::text),
  CONSTRAINT "content_pack_import_source_lock_kind_check" CHECK ((btrim(source_lock_kind) <> ''::text) AND ((source_lock_snapshot ->> 'kind'::text) = source_lock_kind)),
  CONSTRAINT "content_pack_import_source_lock_snapshot_check" CHECK ((source_lock_snapshot IS NULL) OR (jsonb_typeof(source_lock_snapshot) = 'object'::text)),
  CONSTRAINT "content_pack_import_version_check" CHECK ((btrim(version) <> ''::text) AND (octet_length(version) <= 512))
);
-- Create index "content_pack_import_profile_applied_idx" to table: "content_pack_import"
CREATE INDEX "content_pack_import_profile_applied_idx" ON "content_pack_import" ("importer_profile_id", "applied_at" DESC NULLS LAST, "id");
-- Create "content_pack_entity_measurement_evidence" table
CREATE TABLE "content_pack_entity_measurement_evidence" (
  "import_id" uuid NOT NULL,
  "source_fingerprint" text NOT NULL,
  "measurement_id" uuid NOT NULL,
  "entity_source_key" text NOT NULL,
  "context_unit_source_key" text NULL,
  "source_url" text NOT NULL,
  "source_observed_at" timestamptz(3) NOT NULL,
  "provenance" jsonb NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("import_id", "source_fingerprint"),
  CONSTRAINT "content_pack_entity_measurement_evidence_4ubs9odPsfqA_fkey" FOREIGN KEY ("measurement_id") REFERENCES "entity_measurement" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "content_pack_entity_measurement_evidence_NrjiMNXYM1kS_fkey" FOREIGN KEY ("import_id") REFERENCES "content_pack_import" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "content_pack_entity_measurement_evidence_fingerprint_check" CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "content_pack_entity_measurement_evidence_provenance_check" CHECK ((provenance IS NULL) OR (jsonb_typeof(provenance) = 'object'::text)),
  CONSTRAINT "content_pack_entity_measurement_evidence_source_key_check" CHECK ((btrim(entity_source_key) <> ''::text) AND ((context_unit_source_key IS NULL) OR (btrim(context_unit_source_key) <> ''::text))),
  CONSTRAINT "content_pack_entity_measurement_evidence_url_check" CHECK ((btrim(source_url) <> ''::text) AND (source_url ~ '^https?://'::text))
);
-- Create index "content_pack_entity_measurement_evidence_measurement_idx" to table: "content_pack_entity_measurement_evidence"
CREATE INDEX "content_pack_entity_measurement_evidence_measurement_idx" ON "content_pack_entity_measurement_evidence" ("measurement_id", "import_id");
-- Create "subject_association_judgment" table
CREATE TABLE "subject_association_judgment" (
  "association_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "spoiler_level" smallint NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("association_id", "profile_id"),
  CONSTRAINT "subject_association_judgment_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "subject_association_judgment_uo93BqITkQjw_fkey" FOREIGN KEY ("association_id") REFERENCES "subject_association" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "subject_association_judgment_spoiler_level_check" CHECK ((spoiler_level >= 0) AND (spoiler_level <= 2))
);
-- Create index "subject_association_judgment_profile_idx" to table: "subject_association_judgment"
CREATE INDEX "subject_association_judgment_profile_idx" ON "subject_association_judgment" ("profile_id", "association_id");
-- Create "content_pack_subject_association_evidence" table
CREATE TABLE "content_pack_subject_association_evidence" (
  "import_id" uuid NOT NULL,
  "source_fingerprint" text NOT NULL,
  "association_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "declared_association_id" uuid NOT NULL,
  "subject_source_key" text NOT NULL,
  "source_spoiler_level" smallint NOT NULL,
  "source_url" text NOT NULL,
  "source_imported_at" timestamptz(3) NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("import_id", "source_fingerprint"),
  CONSTRAINT "content_pack_subject_association_evidence_import_profile_fkey" FOREIGN KEY ("import_id", "profile_id") REFERENCES "content_pack_import" ("id", "importer_profile_id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "content_pack_subject_association_evidence_judgment_fkey" FOREIGN KEY ("association_id", "profile_id") REFERENCES "subject_association_judgment" ("association_id", "profile_id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "content_pack_subject_association_evidence_source_fingerprint_ch" CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "content_pack_subject_association_evidence_source_key_check" CHECK (btrim(subject_source_key) <> ''::text),
  CONSTRAINT "content_pack_subject_association_evidence_source_url_check" CHECK ((btrim(source_url) <> ''::text) AND (source_url ~ '^https?://'::text)),
  CONSTRAINT "content_pack_subject_association_evidence_spoiler_level_check" CHECK ((source_spoiler_level >= 0) AND (source_spoiler_level <= 2))
);
-- Create index "content_pack_subject_association_evidence_judgment_idx" to table: "content_pack_subject_association_evidence"
CREATE INDEX "content_pack_subject_association_evidence_judgment_idx" ON "content_pack_subject_association_evidence" ("association_id", "profile_id", "import_id");
-- Modify "tag" table
ALTER TABLE "tag" ADD CONSTRAINT "tag_default_spoiler_level_check" CHECK ((default_spoiler_level IS NULL) OR ((default_spoiler_level >= 0) AND (default_spoiler_level <= 2))), ADD COLUMN "directly_applicable" boolean NOT NULL DEFAULT true, ADD COLUMN "default_spoiler_level" smallint NULL;
-- Create "content_pack_tag_evidence" table
CREATE TABLE "content_pack_tag_evidence" (
  "import_id" uuid NOT NULL,
  "source_fingerprint" text NOT NULL,
  "tag_id" uuid NOT NULL,
  "tag_source_key" text NOT NULL,
  "directly_applicable" boolean NOT NULL,
  "default_spoiler_level" smallint NULL,
  "source_category" text NULL,
  "parent_source_keys" text[] NOT NULL,
  "primary_parent_source_key" text NULL,
  "source_url" text NOT NULL,
  "source_imported_at" timestamptz(3) NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("import_id", "source_fingerprint"),
  CONSTRAINT "content_pack_tag_evidence_import_fkey" FOREIGN KEY ("import_id") REFERENCES "content_pack_import" ("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "content_pack_tag_evidence_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "content_pack_tag_evidence_parent_count_check" CHECK (cardinality(parent_source_keys) <= 16),
  CONSTRAINT "content_pack_tag_evidence_parent_null_check" CHECK (array_position(parent_source_keys, NULL::text) IS NULL),
  CONSTRAINT "content_pack_tag_evidence_primary_parent_check" CHECK (((cardinality(parent_source_keys) = 0) AND (primary_parent_source_key IS NULL)) OR ((cardinality(parent_source_keys) > 0) AND (primary_parent_source_key = parent_source_keys[1]))),
  CONSTRAINT "content_pack_tag_evidence_source_category_check" CHECK ((source_category IS NULL) OR (btrim(source_category) <> ''::text)),
  CONSTRAINT "content_pack_tag_evidence_source_fingerprint_check" CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "content_pack_tag_evidence_source_key_check" CHECK (btrim(tag_source_key) <> ''::text),
  CONSTRAINT "content_pack_tag_evidence_source_url_check" CHECK ((btrim(source_url) <> ''::text) AND (source_url ~ '^https?://'::text)),
  CONSTRAINT "content_pack_tag_evidence_spoiler_check" CHECK ((default_spoiler_level IS NULL) OR ((default_spoiler_level >= 0) AND (default_spoiler_level <= 2)))
);
-- Create index "content_pack_tag_evidence_tag_idx" to table: "content_pack_tag_evidence"
CREATE INDEX "content_pack_tag_evidence_tag_idx" ON "content_pack_tag_evidence" ("tag_id", "import_id");
-- Create "tag_path" table
CREATE TABLE "tag_path" (
  "id" uuid NOT NULL,
  "member_tag_ids" uuid[] NOT NULL,
  "terminal_tag_id" uuid NOT NULL,
  "created_by_profile_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "tag_path_definition_key" UNIQUE ("member_tag_ids"),
  CONSTRAINT "tag_path_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_path_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "tag_path_terminal_tag_id_tag_id_fkey" FOREIGN KEY ("terminal_tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_path_member_count_check" CHECK ((cardinality(member_tag_ids) >= 2) AND (cardinality(member_tag_ids) <= 16)),
  CONSTRAINT "tag_path_member_null_check" CHECK (array_position(member_tag_ids, NULL::uuid) IS NULL),
  CONSTRAINT "tag_path_not_self_check" CHECK (NOT (id = ANY (member_tag_ids))),
  CONSTRAINT "tag_path_terminal_check" CHECK (terminal_tag_id = member_tag_ids[cardinality(member_tag_ids)])
);
-- Create index "tag_path_created_by_idx" to table: "tag_path"
CREATE INDEX "tag_path_created_by_idx" ON "tag_path" ("created_by_profile_id", "created_at", "id");
-- Create index "tag_path_terminal_usage_idx" to table: "tag_path"
CREATE INDEX "tag_path_terminal_usage_idx" ON "tag_path" ("terminal_tag_id", "id");
-- Create "tag_path_vote" table
CREATE TABLE "tag_path_vote" (
  "path_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "value" integer NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("path_id", "profile_id"),
  CONSTRAINT "tag_path_vote_path_id_tag_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "tag_path" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_path_vote_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_path_vote_value_check" CHECK (value = ANY (ARRAY['-1'::integer, 1]))
);
-- Create index "tag_path_vote_profile_idx" to table: "tag_path_vote"
CREATE INDEX "tag_path_vote_profile_idx" ON "tag_path_vote" ("profile_id", "path_id");
-- Create "content_pack_tag_path_definition_evidence" table
CREATE TABLE "content_pack_tag_path_definition_evidence" (
  "import_id" uuid NOT NULL,
  "source_fingerprint" text NOT NULL,
  "path_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "declared_path_id" uuid NOT NULL,
  "path_source_key" text NOT NULL,
  "member_tag_source_keys" text[] NOT NULL,
  "source_vote" integer NOT NULL,
  "source_url" text NOT NULL,
  "source_imported_at" timestamptz(3) NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("import_id", "source_fingerprint"),
  CONSTRAINT "content_pack_tag_path_definition_evidence_import_profile_fkey" FOREIGN KEY ("import_id", "profile_id") REFERENCES "content_pack_import" ("id", "importer_profile_id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "content_pack_tag_path_definition_evidence_vote_fkey" FOREIGN KEY ("path_id", "profile_id") REFERENCES "tag_path_vote" ("path_id", "profile_id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "content_pack_tag_path_definition_evidence_member_count_check" CHECK ((cardinality(member_tag_source_keys) >= 2) AND (cardinality(member_tag_source_keys) <= 16)),
  CONSTRAINT "content_pack_tag_path_definition_evidence_member_null_check" CHECK (array_position(member_tag_source_keys, NULL::text) IS NULL),
  CONSTRAINT "content_pack_tag_path_definition_evidence_source_fingerprint_ch" CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "content_pack_tag_path_definition_evidence_source_key_check" CHECK (btrim(path_source_key) <> ''::text),
  CONSTRAINT "content_pack_tag_path_definition_evidence_source_url_check" CHECK ((btrim(source_url) <> ''::text) AND (source_url ~ '^https?://'::text)),
  CONSTRAINT "content_pack_tag_path_definition_evidence_vote_check" CHECK (source_vote = 1)
);
-- Create index "content_pack_tag_path_definition_evidence_vote_idx" to table: "content_pack_tag_path_definition_evidence"
CREATE INDEX "content_pack_tag_path_definition_evidence_vote_idx" ON "content_pack_tag_path_definition_evidence" ("path_id", "profile_id", "import_id");
-- Create "unit_tag_judgment" table
CREATE TABLE "unit_tag_judgment" (
  "unit_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "fit_vote" integer NULL,
  "spoiler_level" smallint NULL,
  "fit_updated_at" timestamptz(3) NULL,
  "spoiler_updated_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id", "tag_id", "profile_id"),
  CONSTRAINT "unit_tag_judgment_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_tag_judgment_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_tag_judgment_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_tag_judgment_unit_tag_fkey" FOREIGN KEY ("unit_id", "tag_id") REFERENCES "unit_tag" ("unit_id", "tag_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_tag_judgment_fit_timestamp_check" CHECK ((fit_vote IS NULL) = (fit_updated_at IS NULL)),
  CONSTRAINT "unit_tag_judgment_fit_vote_check" CHECK ((fit_vote IS NULL) OR (fit_vote = ANY (ARRAY['-1'::integer, 1]))),
  CONSTRAINT "unit_tag_judgment_not_self_check" CHECK (unit_id <> tag_id),
  CONSTRAINT "unit_tag_judgment_sparse_check" CHECK ((fit_vote IS NOT NULL) OR (spoiler_level IS NOT NULL)),
  CONSTRAINT "unit_tag_judgment_spoiler_level_check" CHECK ((spoiler_level IS NULL) OR ((spoiler_level >= 0) AND (spoiler_level <= 2))),
  CONSTRAINT "unit_tag_judgment_spoiler_timestamp_check" CHECK ((spoiler_level IS NULL) = (spoiler_updated_at IS NULL))
);
-- Create index "unit_tag_judgment_profile_unit_tag_idx" to table: "unit_tag_judgment"
CREATE INDEX "unit_tag_judgment_profile_unit_tag_idx" ON "unit_tag_judgment" ("profile_id", "unit_id", "tag_id");
-- Create index "unit_tag_judgment_tag_unit_idx" to table: "unit_tag_judgment"
CREATE INDEX "unit_tag_judgment_tag_unit_idx" ON "unit_tag_judgment" ("tag_id", "unit_id");
-- Create "content_pack_unit_tag_evidence" table
CREATE TABLE "content_pack_unit_tag_evidence" (
  "import_id" uuid NOT NULL,
  "source_fingerprint" text NOT NULL,
  "unit_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "unit_source_key" text NOT NULL,
  "tag_source_key" text NOT NULL,
  "source_fit_vote" integer NOT NULL,
  "source_spoiler_level" smallint NULL,
  "source_url" text NOT NULL,
  "source_imported_at" timestamptz(3) NOT NULL,
  "source_aggregate" jsonb NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("import_id", "source_fingerprint"),
  CONSTRAINT "content_pack_unit_tag_evidence_import_profile_fkey" FOREIGN KEY ("import_id", "profile_id") REFERENCES "content_pack_import" ("id", "importer_profile_id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "content_pack_unit_tag_evidence_judgment_fkey" FOREIGN KEY ("unit_id", "tag_id", "profile_id") REFERENCES "unit_tag_judgment" ("unit_id", "tag_id", "profile_id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "content_pack_unit_tag_evidence_fit_vote_check" CHECK (source_fit_vote = ANY (ARRAY['-1'::integer, 1])),
  CONSTRAINT "content_pack_unit_tag_evidence_source_aggregate_check" CHECK ((source_aggregate IS NULL) OR (jsonb_typeof(source_aggregate) = 'object'::text)),
  CONSTRAINT "content_pack_unit_tag_evidence_source_fingerprint_check" CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "content_pack_unit_tag_evidence_source_keys_check" CHECK ((btrim(unit_source_key) <> ''::text) AND (btrim(tag_source_key) <> ''::text)),
  CONSTRAINT "content_pack_unit_tag_evidence_source_url_check" CHECK ((btrim(source_url) <> ''::text) AND (source_url ~ '^https?://'::text)),
  CONSTRAINT "content_pack_unit_tag_evidence_spoiler_level_check" CHECK ((source_spoiler_level IS NULL) OR ((source_spoiler_level >= 0) AND (source_spoiler_level <= 2)))
);
-- Create index "content_pack_unit_tag_evidence_judgment_idx" to table: "content_pack_unit_tag_evidence"
CREATE INDEX "content_pack_unit_tag_evidence_judgment_idx" ON "content_pack_unit_tag_evidence" ("unit_id", "tag_id", "profile_id", "import_id");
-- Create "unit_tag_path" table
CREATE TABLE "unit_tag_path" (
  "unit_id" uuid NOT NULL,
  "path_id" uuid NOT NULL,
  "created_by_profile_id" uuid NULL,
  "pinned" boolean NOT NULL DEFAULT false,
  "position" text NULL COLLATE "C",
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id", "path_id"),
  CONSTRAINT "unit_tag_path_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "unit_tag_path_path_id_tag_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "tag_path" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_tag_path_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_tag_path_not_self_check" CHECK (unit_id <> path_id),
  CONSTRAINT "unit_tag_path_position_byte_length_check" CHECK (octet_length("position") <= 1024)
);
-- Create index "unit_tag_path_path_idx" to table: "unit_tag_path"
CREATE INDEX "unit_tag_path_path_idx" ON "unit_tag_path" ("path_id", "unit_id");
-- Create index "unit_tag_path_unit_position_idx" to table: "unit_tag_path"
CREATE INDEX "unit_tag_path_unit_position_idx" ON "unit_tag_path" ("unit_id", "pinned", "position", "path_id");
-- Create "unit_tag_path_judgment" table
CREATE TABLE "unit_tag_path_judgment" (
  "unit_id" uuid NOT NULL,
  "path_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "fit_vote" integer NULL,
  "spoiler_level" smallint NULL,
  "fit_updated_at" timestamptz(3) NULL,
  "spoiler_updated_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id", "path_id", "profile_id"),
  CONSTRAINT "unit_tag_path_judgment_application_fkey" FOREIGN KEY ("unit_id", "path_id") REFERENCES "unit_tag_path" ("unit_id", "path_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_tag_path_judgment_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_tag_path_judgment_fit_timestamp_check" CHECK ((fit_vote IS NULL) = (fit_updated_at IS NULL)),
  CONSTRAINT "unit_tag_path_judgment_fit_vote_check" CHECK ((fit_vote IS NULL) OR (fit_vote = ANY (ARRAY['-1'::integer, 1]))),
  CONSTRAINT "unit_tag_path_judgment_sparse_check" CHECK ((fit_vote IS NOT NULL) OR (spoiler_level IS NOT NULL)),
  CONSTRAINT "unit_tag_path_judgment_spoiler_level_check" CHECK ((spoiler_level IS NULL) OR ((spoiler_level >= 0) AND (spoiler_level <= 2))),
  CONSTRAINT "unit_tag_path_judgment_spoiler_timestamp_check" CHECK ((spoiler_level IS NULL) = (spoiler_updated_at IS NULL))
);
-- Create index "unit_tag_path_judgment_path_idx" to table: "unit_tag_path_judgment"
CREATE INDEX "unit_tag_path_judgment_path_idx" ON "unit_tag_path_judgment" ("path_id", "unit_id", "profile_id");
-- Create index "unit_tag_path_judgment_positive_path_idx" to table: "unit_tag_path_judgment"
CREATE INDEX "unit_tag_path_judgment_positive_path_idx" ON "unit_tag_path_judgment" ("path_id", "unit_id", "profile_id") WHERE (fit_vote = 1);
-- Create index "unit_tag_path_judgment_profile_idx" to table: "unit_tag_path_judgment"
CREATE INDEX "unit_tag_path_judgment_profile_idx" ON "unit_tag_path_judgment" ("profile_id", "unit_id", "path_id");
-- Create "content_pack_unit_tag_path_evidence" table
CREATE TABLE "content_pack_unit_tag_path_evidence" (
  "import_id" uuid NOT NULL,
  "source_fingerprint" text NOT NULL,
  "unit_id" uuid NOT NULL,
  "path_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "unit_source_key" text NOT NULL,
  "path_source_key" text NOT NULL,
  "declared_path_id" uuid NOT NULL,
  "source_fit_vote" integer NOT NULL,
  "source_spoiler_level" smallint NULL,
  "source_url" text NOT NULL,
  "source_imported_at" timestamptz(3) NOT NULL,
  "source_aggregate" jsonb NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("import_id", "source_fingerprint"),
  CONSTRAINT "content_pack_unit_tag_path_evidence_import_profile_fkey" FOREIGN KEY ("import_id", "profile_id") REFERENCES "content_pack_import" ("id", "importer_profile_id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "content_pack_unit_tag_path_evidence_judgment_fkey" FOREIGN KEY ("unit_id", "path_id", "profile_id") REFERENCES "unit_tag_path_judgment" ("unit_id", "path_id", "profile_id") ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT "content_pack_unit_tag_path_evidence_fit_vote_check" CHECK (source_fit_vote = ANY (ARRAY['-1'::integer, 1])),
  CONSTRAINT "content_pack_unit_tag_path_evidence_source_aggregate_check" CHECK ((source_aggregate IS NULL) OR (jsonb_typeof(source_aggregate) = 'object'::text)),
  CONSTRAINT "content_pack_unit_tag_path_evidence_source_fingerprint_check" CHECK (source_fingerprint ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "content_pack_unit_tag_path_evidence_source_keys_check" CHECK ((btrim(unit_source_key) <> ''::text) AND (btrim(path_source_key) <> ''::text)),
  CONSTRAINT "content_pack_unit_tag_path_evidence_source_url_check" CHECK ((btrim(source_url) <> ''::text) AND (source_url ~ '^https?://'::text)),
  CONSTRAINT "content_pack_unit_tag_path_evidence_spoiler_level_check" CHECK ((source_spoiler_level IS NULL) OR ((source_spoiler_level >= 0) AND (source_spoiler_level <= 2)))
);
-- Create index "content_pack_unit_tag_path_evidence_judgment_idx" to table: "content_pack_unit_tag_path_evidence"
CREATE INDEX "content_pack_unit_tag_path_evidence_judgment_idx" ON "content_pack_unit_tag_path_evidence" ("unit_id", "path_id", "profile_id", "import_id");
-- Modify "realm_tag_context" table
ALTER TABLE "realm_tag_context" DROP CONSTRAINT "realm_tag_context_tag_id_tag_id_fkey", ADD CONSTRAINT "realm_tag_context_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE CASCADE;
-- Modify "realm" table
ALTER TABLE "realm" ADD COLUMN "tag_fit_fallback_policy" "realm_tag_fallback_policy" NOT NULL DEFAULT 'inherit', ADD COLUMN "tag_spoiler_fallback_policy" "realm_tag_fallback_policy" NOT NULL DEFAULT 'inherit';
-- Create "realm_tag_judgment" table
CREATE TABLE "realm_tag_judgment" (
  "realm_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "fit_vote" integer NULL,
  "spoiler_level" smallint NULL,
  "fit_updated_at" timestamptz(3) NULL,
  "spoiler_updated_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("realm_id", "unit_id", "tag_id", "profile_id"),
  CONSTRAINT "realm_tag_judgment_context_fkey" FOREIGN KEY ("realm_id", "tag_id") REFERENCES "realm_tag_context" ("realm_id", "tag_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_tag_judgment_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_tag_judgment_realm_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_tag_judgment_tag_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_tag_judgment_unit_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_tag_judgment_fit_timestamp_check" CHECK ((fit_vote IS NULL) = (fit_updated_at IS NULL)),
  CONSTRAINT "realm_tag_judgment_fit_vote_check" CHECK ((fit_vote IS NULL) OR (fit_vote = ANY (ARRAY['-1'::integer, 1]))),
  CONSTRAINT "realm_tag_judgment_not_self_check" CHECK (unit_id <> tag_id),
  CONSTRAINT "realm_tag_judgment_sparse_check" CHECK ((fit_vote IS NOT NULL) OR (spoiler_level IS NOT NULL)),
  CONSTRAINT "realm_tag_judgment_spoiler_level_check" CHECK ((spoiler_level IS NULL) OR ((spoiler_level >= 0) AND (spoiler_level <= 2))),
  CONSTRAINT "realm_tag_judgment_spoiler_timestamp_check" CHECK ((spoiler_level IS NULL) = (spoiler_updated_at IS NULL))
);
-- Create index "realm_tag_judgment_profile_route_idx" to table: "realm_tag_judgment"
CREATE INDEX "realm_tag_judgment_profile_route_idx" ON "realm_tag_judgment" ("profile_id", "realm_id", "unit_id", "tag_id");
-- Create index "realm_tag_judgment_realm_tag_unit_idx" to table: "realm_tag_judgment"
CREATE INDEX "realm_tag_judgment_realm_tag_unit_idx" ON "realm_tag_judgment" ("realm_id", "tag_id", "unit_id");
-- Create index "realm_tag_judgment_tag_route_idx" to table: "realm_tag_judgment"
CREATE INDEX "realm_tag_judgment_tag_route_idx" ON "realm_tag_judgment" ("tag_id", "realm_id", "unit_id", "profile_id");
-- Create index "realm_tag_judgment_unit_merge_idx" to table: "realm_tag_judgment"
CREATE INDEX "realm_tag_judgment_unit_merge_idx" ON "realm_tag_judgment" ("unit_id", "realm_id", "tag_id", "profile_id");
-- Create "realm_tag_judgment_stat" table
CREATE TABLE "realm_tag_judgment_stat" (
  "realm_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "score" bigint NOT NULL DEFAULT 0,
  "vote_count" bigint NOT NULL DEFAULT 0,
  "spoiler_vote_count" bigint NOT NULL DEFAULT 0,
  "spoiler_none_count" bigint NOT NULL DEFAULT 0,
  "spoiler_minor_count" bigint NOT NULL DEFAULT 0,
  "spoiler_major_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("realm_id", "unit_id", "tag_id"),
  CONSTRAINT "realm_tag_judgment_stat_context_fkey" FOREIGN KEY ("realm_id", "tag_id") REFERENCES "realm_tag_context" ("realm_id", "tag_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_tag_judgment_stat_realm_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_tag_judgment_stat_tag_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_tag_judgment_stat_unit_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_tag_judgment_stat_count_check" CHECK (vote_count >= 0),
  CONSTRAINT "realm_tag_judgment_stat_parity_check" CHECK (((vote_count + score) % (2)::bigint) = 0),
  CONSTRAINT "realm_tag_judgment_stat_score_check" CHECK (abs(score) <= vote_count),
  CONSTRAINT "realm_tag_judgment_stat_spoiler_count_check" CHECK (spoiler_vote_count = ((spoiler_none_count + spoiler_minor_count) + spoiler_major_count)),
  CONSTRAINT "realm_tag_judgment_stat_spoiler_nonnegative_check" CHECK ((spoiler_vote_count >= 0) AND (spoiler_none_count >= 0) AND (spoiler_minor_count >= 0) AND (spoiler_major_count >= 0))
);
-- Create index "realm_tag_judgment_stat_realm_tag_unit_idx" to table: "realm_tag_judgment_stat"
CREATE INDEX "realm_tag_judgment_stat_realm_tag_unit_idx" ON "realm_tag_judgment_stat" ("realm_id", "tag_id", "unit_id");
-- Create index "realm_tag_judgment_stat_tag_realm_unit_idx" to table: "realm_tag_judgment_stat"
CREATE INDEX "realm_tag_judgment_stat_tag_realm_unit_idx" ON "realm_tag_judgment_stat" ("tag_id", "realm_id", "unit_id");
-- Create index "realm_tag_judgment_stat_unit_realm_tag_idx" to table: "realm_tag_judgment_stat"
CREATE INDEX "realm_tag_judgment_stat_unit_realm_tag_idx" ON "realm_tag_judgment_stat" ("unit_id", "realm_id", "tag_id");
-- Create "realm_tag_path" table
CREATE TABLE "realm_tag_path" (
  "realm_id" uuid NOT NULL,
  "path_id" uuid NOT NULL,
  "created_by_profile_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("realm_id", "path_id"),
  CONSTRAINT "realm_tag_path_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_tag_path_path_id_tag_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "tag_path" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_tag_path_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "realm_tag_path_path_realm_idx" to table: "realm_tag_path"
CREATE INDEX "realm_tag_path_path_realm_idx" ON "realm_tag_path" ("path_id", "realm_id");
-- Create "realm_tag_path_vote" table
CREATE TABLE "realm_tag_path_vote" (
  "realm_id" uuid NOT NULL,
  "path_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "value" integer NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("realm_id", "path_id", "profile_id"),
  CONSTRAINT "realm_tag_path_vote_adoption_fkey" FOREIGN KEY ("realm_id", "path_id") REFERENCES "realm_tag_path" ("realm_id", "path_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_tag_path_vote_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_tag_path_vote_value_check" CHECK (value = ANY (ARRAY['-1'::integer, 1]))
);
-- Create index "realm_tag_path_vote_profile_idx" to table: "realm_tag_path_vote"
CREATE INDEX "realm_tag_path_vote_profile_idx" ON "realm_tag_path_vote" ("profile_id", "realm_id", "path_id");
-- Create "realm_tag_path_vote_stat" table
CREATE TABLE "realm_tag_path_vote_stat" (
  "realm_id" uuid NOT NULL,
  "path_id" uuid NOT NULL,
  "score" bigint NOT NULL DEFAULT 0,
  "vote_count" bigint NOT NULL DEFAULT 0,
  "usage_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("realm_id", "path_id"),
  CONSTRAINT "realm_tag_path_vote_stat_adoption_fkey" FOREIGN KEY ("realm_id", "path_id") REFERENCES "realm_tag_path" ("realm_id", "path_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_tag_path_vote_stat_count_check" CHECK (vote_count >= 0),
  CONSTRAINT "realm_tag_path_vote_stat_parity_check" CHECK (((vote_count + score) % (2)::bigint) = 0),
  CONSTRAINT "realm_tag_path_vote_stat_score_check" CHECK (abs(score) <= vote_count),
  CONSTRAINT "realm_tag_path_vote_stat_usage_count_check" CHECK (usage_count >= 0)
);
-- Create index "realm_tag_path_vote_stat_usage_idx" to table: "realm_tag_path_vote_stat"
CREATE INDEX "realm_tag_path_vote_stat_usage_idx" ON "realm_tag_path_vote_stat" ("realm_id", "usage_count" DESC NULLS LAST, "path_id");
-- Create "realm_unit_effective_tag" table
CREATE TABLE "realm_unit_effective_tag" (
  "realm_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "direct" boolean NOT NULL DEFAULT false,
  "path_support_count" bigint NOT NULL DEFAULT 0,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("realm_id", "unit_id", "tag_id"),
  CONSTRAINT "realm_unit_effective_tag_realm_unit_fkey" FOREIGN KEY ("realm_id", "unit_id") REFERENCES "realm_unit" ("realm_id", "unit_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_unit_effective_tag_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_unit_effective_tag_path_count_check" CHECK (path_support_count >= 0),
  CONSTRAINT "realm_unit_effective_tag_source_check" CHECK (direct OR (path_support_count > 0))
);
-- Create index "realm_unit_effective_tag_tag_idx" to table: "realm_unit_effective_tag"
CREATE INDEX "realm_unit_effective_tag_tag_idx" ON "realm_unit_effective_tag" ("tag_id", "realm_id", "unit_id");
-- Create "realm_unit_tag_path" table
CREATE TABLE "realm_unit_tag_path" (
  "realm_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "path_id" uuid NOT NULL,
  "created_by_profile_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("realm_id", "unit_id", "path_id"),
  CONSTRAINT "realm_unit_tag_path_adoption_fkey" FOREIGN KEY ("realm_id", "path_id") REFERENCES "realm_tag_path" ("realm_id", "path_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_unit_tag_path_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_unit_tag_path_realm_unit_fkey" FOREIGN KEY ("realm_id", "unit_id") REFERENCES "realm_unit" ("realm_id", "unit_id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "realm_unit_tag_path_path_idx" to table: "realm_unit_tag_path"
CREATE INDEX "realm_unit_tag_path_path_idx" ON "realm_unit_tag_path" ("realm_id", "path_id", "unit_id");
-- Create index "realm_unit_tag_path_unit_route_idx" to table: "realm_unit_tag_path"
CREATE INDEX "realm_unit_tag_path_unit_route_idx" ON "realm_unit_tag_path" ("unit_id", "realm_id", "path_id");
-- Create "realm_unit_tag_path_judgment" table
CREATE TABLE "realm_unit_tag_path_judgment" (
  "realm_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "path_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "fit_vote" integer NULL,
  "spoiler_level" smallint NULL,
  "fit_updated_at" timestamptz(3) NULL,
  "spoiler_updated_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("realm_id", "unit_id", "path_id", "profile_id"),
  CONSTRAINT "realm_unit_tag_path_judgment_application_fkey" FOREIGN KEY ("realm_id", "unit_id", "path_id") REFERENCES "realm_unit_tag_path" ("realm_id", "unit_id", "path_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_unit_tag_path_judgment_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_unit_tag_path_judgment_fit_timestamp_check" CHECK ((fit_vote IS NULL) = (fit_updated_at IS NULL)),
  CONSTRAINT "realm_unit_tag_path_judgment_fit_vote_check" CHECK ((fit_vote IS NULL) OR (fit_vote = ANY (ARRAY['-1'::integer, 1]))),
  CONSTRAINT "realm_unit_tag_path_judgment_sparse_check" CHECK ((fit_vote IS NOT NULL) OR (spoiler_level IS NOT NULL)),
  CONSTRAINT "realm_unit_tag_path_judgment_spoiler_level_check" CHECK ((spoiler_level IS NULL) OR ((spoiler_level >= 0) AND (spoiler_level <= 2))),
  CONSTRAINT "realm_unit_tag_path_judgment_spoiler_timestamp_check" CHECK ((spoiler_level IS NULL) = (spoiler_updated_at IS NULL))
);
-- Create index "realm_unit_tag_path_judgment_path_idx" to table: "realm_unit_tag_path_judgment"
CREATE INDEX "realm_unit_tag_path_judgment_path_idx" ON "realm_unit_tag_path_judgment" ("path_id", "realm_id", "unit_id", "profile_id");
-- Create index "realm_unit_tag_path_judgment_profile_idx" to table: "realm_unit_tag_path_judgment"
CREATE INDEX "realm_unit_tag_path_judgment_profile_idx" ON "realm_unit_tag_path_judgment" ("profile_id", "realm_id", "unit_id", "path_id");
-- Create "realm_unit_tag_path_judgment_stat" table
CREATE TABLE "realm_unit_tag_path_judgment_stat" (
  "realm_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "path_id" uuid NOT NULL,
  "score" bigint NOT NULL DEFAULT 0,
  "vote_count" bigint NOT NULL DEFAULT 0,
  "spoiler_vote_count" bigint NOT NULL DEFAULT 0,
  "spoiler_none_count" bigint NOT NULL DEFAULT 0,
  "spoiler_minor_count" bigint NOT NULL DEFAULT 0,
  "spoiler_major_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("realm_id", "unit_id", "path_id"),
  CONSTRAINT "realm_unit_tag_path_judgment_stat_application_fkey" FOREIGN KEY ("realm_id", "unit_id", "path_id") REFERENCES "realm_unit_tag_path" ("realm_id", "unit_id", "path_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_unit_tag_path_judgment_stat_count_check" CHECK (vote_count >= 0),
  CONSTRAINT "realm_unit_tag_path_judgment_stat_parity_check" CHECK (((vote_count + score) % (2)::bigint) = 0),
  CONSTRAINT "realm_unit_tag_path_judgment_stat_score_check" CHECK (abs(score) <= vote_count),
  CONSTRAINT "realm_unit_tag_path_judgment_stat_spoiler_count_check" CHECK (spoiler_vote_count = ((spoiler_none_count + spoiler_minor_count) + spoiler_major_count)),
  CONSTRAINT "realm_unit_tag_path_judgment_stat_spoiler_nonnegative_check" CHECK ((spoiler_vote_count >= 0) AND (spoiler_none_count >= 0) AND (spoiler_minor_count >= 0) AND (spoiler_major_count >= 0))
);
-- Create index "realm_unit_tag_path_judgment_stat_path_idx" to table: "realm_unit_tag_path_judgment_stat"
CREATE INDEX "realm_unit_tag_path_judgment_stat_path_idx" ON "realm_unit_tag_path_judgment_stat" ("path_id", "realm_id", "unit_id");
-- Create "tag_path_member" table
CREATE TABLE "tag_path_member" (
  "path_id" uuid NOT NULL,
  "ordinal" integer NOT NULL,
  "tag_id" uuid NOT NULL,
  PRIMARY KEY ("path_id", "ordinal"),
  CONSTRAINT "tag_path_member_path_tag_key" UNIQUE ("path_id", "tag_id"),
  CONSTRAINT "tag_path_member_path_id_tag_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "tag_path" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "tag_path_member_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_path_member_ordinal_check" CHECK (ordinal >= 0)
);
-- Create index "tag_path_member_tag_path_idx" to table: "tag_path_member"
CREATE INDEX "tag_path_member_tag_path_idx" ON "tag_path_member" ("tag_id", "path_id", "ordinal");
-- Create "realm_unit_tag_path_support" table
CREATE TABLE "realm_unit_tag_path_support" (
  "realm_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "path_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("realm_id", "unit_id", "tag_id", "profile_id", "path_id"),
  CONSTRAINT "realm_unit_tag_path_support_judgment_fkey" FOREIGN KEY ("realm_id", "unit_id", "path_id", "profile_id") REFERENCES "realm_unit_tag_path_judgment" ("realm_id", "unit_id", "path_id", "profile_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_unit_tag_path_support_member_fkey" FOREIGN KEY ("path_id", "tag_id") REFERENCES "tag_path_member" ("path_id", "tag_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_unit_tag_path_support_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "realm_unit_tag_path_support_effective_idx" to table: "realm_unit_tag_path_support"
CREATE INDEX "realm_unit_tag_path_support_effective_idx" ON "realm_unit_tag_path_support" ("realm_id", "unit_id", "tag_id", "profile_id");
-- Create index "realm_unit_tag_path_support_path_idx" to table: "realm_unit_tag_path_support"
CREATE INDEX "realm_unit_tag_path_support_path_idx" ON "realm_unit_tag_path_support" ("path_id", "realm_id", "unit_id", "tag_id");
-- Create "subject_association_judgment_stat" table
CREATE TABLE "subject_association_judgment_stat" (
  "association_id" uuid NOT NULL,
  "spoiler_vote_count" bigint NOT NULL DEFAULT 0,
  "spoiler_none_count" bigint NOT NULL DEFAULT 0,
  "spoiler_minor_count" bigint NOT NULL DEFAULT 0,
  "spoiler_major_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("association_id"),
  CONSTRAINT "subject_association_judgment_stat_9yJeuJ2l9fWh_fkey" FOREIGN KEY ("association_id") REFERENCES "subject_association" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "subject_association_judgment_stat_spoiler_count_check" CHECK (spoiler_vote_count = ((spoiler_none_count + spoiler_minor_count) + spoiler_major_count)),
  CONSTRAINT "subject_association_judgment_stat_spoiler_nonnegative_check" CHECK ((spoiler_vote_count >= 0) AND (spoiler_none_count >= 0) AND (spoiler_minor_count >= 0) AND (spoiler_major_count >= 0))
);
-- Create "tag_path_edge" table
CREATE TABLE "tag_path_edge" (
  "path_id" uuid NOT NULL,
  "ordinal" integer NOT NULL,
  "parent_tag_id" uuid NOT NULL,
  "child_tag_id" uuid NOT NULL,
  PRIMARY KEY ("path_id", "ordinal"),
  CONSTRAINT "tag_path_edge_child_tag_id_tag_id_fkey" FOREIGN KEY ("child_tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_path_edge_parent_tag_id_tag_id_fkey" FOREIGN KEY ("parent_tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_path_edge_path_id_tag_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "tag_path" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "tag_path_edge_not_self_check" CHECK (parent_tag_id <> child_tag_id),
  CONSTRAINT "tag_path_edge_ordinal_check" CHECK (ordinal >= 0)
);
-- Create index "tag_path_edge_child_idx" to table: "tag_path_edge"
CREATE INDEX "tag_path_edge_child_idx" ON "tag_path_edge" ("child_tag_id", "parent_tag_id", "path_id");
-- Create index "tag_path_edge_parent_idx" to table: "tag_path_edge"
CREATE INDEX "tag_path_edge_parent_idx" ON "tag_path_edge" ("parent_tag_id", "child_tag_id", "path_id");
-- Create "tag_path_merge" table
CREATE TABLE "tag_path_merge" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "source_path_id" uuid NOT NULL,
  "target_path_id" uuid NOT NULL,
  "status" text NOT NULL DEFAULT 'proposed',
  "reason" text NOT NULL,
  "proposal_source_kind" text NOT NULL DEFAULT 'human',
  "proposal_provenance" jsonb NULL,
  "proposed_by_profile_id" uuid NOT NULL,
  "resolved_by_profile_id" uuid NULL,
  "resolved_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "tag_path_merge_proposed_by_profile_id_profile_id_fkey" FOREIGN KEY ("proposed_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_path_merge_resolved_by_profile_id_profile_id_fkey" FOREIGN KEY ("resolved_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_path_merge_source_path_id_tag_path_id_fkey" FOREIGN KEY ("source_path_id") REFERENCES "tag_path" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_path_merge_target_path_id_tag_path_id_fkey" FOREIGN KEY ("target_path_id") REFERENCES "tag_path" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_path_merge_distinct_check" CHECK (source_path_id <> target_path_id),
  CONSTRAINT "tag_path_merge_proposal_provenance_object_check" CHECK ((proposal_provenance IS NULL) OR (jsonb_typeof(proposal_provenance) = 'object'::text)),
  CONSTRAINT "tag_path_merge_proposal_provenance_check" CHECK (((proposal_source_kind = 'human'::text) AND (proposal_provenance IS NULL)) OR ((proposal_source_kind = 'assisted'::text) AND ((proposal_provenance ->> 'kind'::text) = 'assisted'::text) AND (jsonb_typeof((proposal_provenance -> 'system'::text)) = 'string'::text) AND (btrim((proposal_provenance ->> 'system'::text)) <> ''::text) AND (jsonb_typeof((proposal_provenance -> 'runId'::text)) = 'string'::text) AND (btrim((proposal_provenance ->> 'runId'::text)) <> ''::text) AND ((NOT (proposal_provenance ? 'model'::text)) OR (jsonb_typeof((proposal_provenance -> 'model'::text)) = 'string'::text)) AND ((NOT (proposal_provenance ? 'confidence'::text)) OR ((jsonb_typeof((proposal_provenance -> 'confidence'::text)) = 'number'::text) AND (((proposal_provenance ->> 'confidence'::text))::numeric >= (0)::numeric) AND (((proposal_provenance ->> 'confidence'::text))::numeric <= (1)::numeric))))),
  CONSTRAINT "tag_path_merge_proposal_source_kind_check" CHECK (proposal_source_kind = ANY (ARRAY['human'::text, 'assisted'::text])),
  CONSTRAINT "tag_path_merge_reason_check" CHECK (btrim(reason) <> ''::text),
  CONSTRAINT "tag_path_merge_resolution_check" CHECK ((status = 'proposed'::text) = ((resolved_at IS NULL) AND (resolved_by_profile_id IS NULL))),
  CONSTRAINT "tag_path_merge_status_check" CHECK (status = ANY (ARRAY['proposed'::text, 'accepted'::text, 'rejected'::text, 'reversed'::text]))
);
-- Create index "tag_path_merge_accepted_source_idx" to table: "tag_path_merge"
CREATE UNIQUE INDEX "tag_path_merge_accepted_source_idx" ON "tag_path_merge" ("source_path_id") WHERE (status = 'accepted'::text);
-- Create index "tag_path_merge_queue_idx" to table: "tag_path_merge"
CREATE INDEX "tag_path_merge_queue_idx" ON "tag_path_merge" ("status", "created_at", "id");
-- Create index "tag_path_merge_target_status_idx" to table: "tag_path_merge"
CREATE INDEX "tag_path_merge_target_status_idx" ON "tag_path_merge" ("target_path_id", "status", "id");
-- Create "tag_path_vote_stat" table
CREATE TABLE "tag_path_vote_stat" (
  "path_id" uuid NOT NULL,
  "terminal_tag_id" uuid NOT NULL,
  "score" bigint NOT NULL DEFAULT 0,
  "vote_count" bigint NOT NULL DEFAULT 0,
  "usage_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("path_id"),
  CONSTRAINT "tag_path_vote_stat_path_id_tag_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "tag_path" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "tag_path_vote_stat_count_check" CHECK (vote_count >= 0),
  CONSTRAINT "tag_path_vote_stat_parity_check" CHECK (((vote_count + score) % (2)::bigint) = 0),
  CONSTRAINT "tag_path_vote_stat_score_check" CHECK (abs(score) <= vote_count),
  CONSTRAINT "tag_path_vote_stat_usage_count_check" CHECK (usage_count >= 0)
);
-- Create index "tag_path_vote_stat_usage_idx" to table: "tag_path_vote_stat"
CREATE INDEX "tag_path_vote_stat_usage_idx" ON "tag_path_vote_stat" ("usage_count" DESC NULLS LAST, "path_id") WHERE ((score > 0) AND (vote_count > 0));
-- Create index "tag_path_vote_stat_terminal_usage_idx" to table: "tag_path_vote_stat"
CREATE INDEX "tag_path_vote_stat_terminal_usage_idx" ON "tag_path_vote_stat" ("terminal_tag_id", "usage_count" DESC NULLS LAST, "path_id") WHERE ((score > 0) AND (vote_count > 0));
-- Modify "unit_effective_tag" table
ALTER TABLE "unit_effective_tag" DROP CONSTRAINT "unit_effective_tag_structure_count_check", DROP CONSTRAINT "unit_effective_tag_source_check", ADD CONSTRAINT "unit_effective_tag_source_check" CHECK (direct OR (path_support_count > 0)), ADD CONSTRAINT "unit_effective_tag_path_count_check" CHECK (path_support_count >= 0), DROP COLUMN "structure_support_count", ADD COLUMN "path_support_count" bigint NOT NULL DEFAULT 0;
-- Create "unit_tag_judgment_stat" table
CREATE TABLE "unit_tag_judgment_stat" (
  "unit_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "score" bigint NOT NULL DEFAULT 0,
  "vote_count" bigint NOT NULL DEFAULT 0,
  "spoiler_vote_count" bigint NOT NULL DEFAULT 0,
  "spoiler_none_count" bigint NOT NULL DEFAULT 0,
  "spoiler_minor_count" bigint NOT NULL DEFAULT 0,
  "spoiler_major_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id", "tag_id"),
  CONSTRAINT "unit_tag_judgment_stat_effective_tag_fkey" FOREIGN KEY ("unit_id", "tag_id") REFERENCES "unit_effective_tag" ("unit_id", "tag_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_tag_judgment_stat_count_check" CHECK (vote_count >= 0),
  CONSTRAINT "unit_tag_judgment_stat_parity_check" CHECK (((vote_count + score) % (2)::bigint) = 0),
  CONSTRAINT "unit_tag_judgment_stat_score_check" CHECK (abs(score) <= vote_count),
  CONSTRAINT "unit_tag_judgment_stat_spoiler_count_check" CHECK (spoiler_vote_count = ((spoiler_none_count + spoiler_minor_count) + spoiler_major_count)),
  CONSTRAINT "unit_tag_judgment_stat_spoiler_nonnegative_check" CHECK ((spoiler_vote_count >= 0) AND (spoiler_none_count >= 0) AND (spoiler_minor_count >= 0) AND (spoiler_major_count >= 0))
);
-- Create "unit_tag_path_judgment_stat" table
CREATE TABLE "unit_tag_path_judgment_stat" (
  "unit_id" uuid NOT NULL,
  "path_id" uuid NOT NULL,
  "score" bigint NOT NULL DEFAULT 0,
  "vote_count" bigint NOT NULL DEFAULT 0,
  "spoiler_vote_count" bigint NOT NULL DEFAULT 0,
  "spoiler_none_count" bigint NOT NULL DEFAULT 0,
  "spoiler_minor_count" bigint NOT NULL DEFAULT 0,
  "spoiler_major_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id", "path_id"),
  CONSTRAINT "unit_tag_path_judgment_stat_application_fkey" FOREIGN KEY ("unit_id", "path_id") REFERENCES "unit_tag_path" ("unit_id", "path_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_tag_path_judgment_stat_count_check" CHECK (vote_count >= 0),
  CONSTRAINT "unit_tag_path_judgment_stat_parity_check" CHECK (((vote_count + score) % (2)::bigint) = 0),
  CONSTRAINT "unit_tag_path_judgment_stat_score_check" CHECK (abs(score) <= vote_count),
  CONSTRAINT "unit_tag_path_judgment_stat_spoiler_count_check" CHECK (spoiler_vote_count = ((spoiler_none_count + spoiler_minor_count) + spoiler_major_count)),
  CONSTRAINT "unit_tag_path_judgment_stat_spoiler_nonnegative_check" CHECK ((spoiler_vote_count >= 0) AND (spoiler_none_count >= 0) AND (spoiler_minor_count >= 0) AND (spoiler_major_count >= 0))
);
-- Create index "unit_tag_path_judgment_stat_path_idx" to table: "unit_tag_path_judgment_stat"
CREATE INDEX "unit_tag_path_judgment_stat_path_idx" ON "unit_tag_path_judgment_stat" ("path_id", "unit_id");
-- Create "unit_tag_path_support" table
CREATE TABLE "unit_tag_path_support" (
  "unit_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "path_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id", "tag_id", "profile_id", "path_id"),
  CONSTRAINT "unit_tag_path_support_judgment_fkey" FOREIGN KEY ("unit_id", "path_id", "profile_id") REFERENCES "unit_tag_path_judgment" ("unit_id", "path_id", "profile_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_tag_path_support_member_fkey" FOREIGN KEY ("path_id", "tag_id") REFERENCES "tag_path_member" ("path_id", "tag_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_tag_path_support_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "unit_tag_path_support_effective_idx" to table: "unit_tag_path_support"
CREATE INDEX "unit_tag_path_support_effective_idx" ON "unit_tag_path_support" ("unit_id", "tag_id", "profile_id");
-- Create index "unit_tag_path_support_path_idx" to table: "unit_tag_path_support"
CREATE INDEX "unit_tag_path_support_path_idx" ON "unit_tag_path_support" ("path_id", "tag_id", "unit_id", "profile_id");
-- Drop "realm_tag_vote" table
DROP TABLE "realm_tag_vote";
-- Drop "realm_tag_vote_stat" table
DROP TABLE "realm_tag_vote_stat";
-- Replace the released direct-Tag projection trigger with the final Tag Path-aware owner.
DROP TRIGGER IF EXISTS unit_tag_effective_context_maintain ON public.unit_tag;
DROP TRIGGER IF EXISTS unit_tag_vote_stat_maintain ON public.unit_effective_tag_vote;
DROP FUNCTION IF EXISTS public.maintain_unit_tag_vote_stat();
-- Drop "unit_tag_vote" table
DROP TABLE "unit_tag_vote";
-- Drop "unit_tag_vote_stat" table
DROP TABLE "unit_tag_vote_stat";
-- Drop "unit_tag_structure_support" table
DROP TABLE "unit_tag_structure_support";
-- Drop "unit_structure_application_vote" table
DROP TABLE "unit_structure_application_vote";
-- Drop "unit_structure_application_vote_stat" table
DROP TABLE "unit_structure_application_vote_stat";
-- Drop "unit_structure_application" table
DROP TABLE "unit_structure_application";
-- Drop "unit_structure_edge" table
DROP TABLE "unit_structure_edge";
-- Drop "unit_structure_member" table
DROP TABLE "unit_structure_member";
-- Drop "unit_structure_vote" table
DROP TABLE "unit_structure_vote";
-- Drop "unit_structure_vote_stat" table
DROP TABLE "unit_structure_vote_stat";
-- Drop "unit_structure" table
DROP TABLE "unit_structure";

DROP FUNCTION IF EXISTS public.reject_conflicting_structure_application_vote();
DROP FUNCTION IF EXISTS public.reject_conflicting_direct_tag_vote();
DROP FUNCTION IF EXISTS public.protect_immutable_unit_structure();
DROP FUNCTION IF EXISTS public.project_unit_structure_definition();
DROP FUNCTION IF EXISTS public.prepare_unit_structure_definition();
DROP FUNCTION IF EXISTS public.maintain_unit_structure_vote_stat();
DROP FUNCTION IF EXISTS public.maintain_unit_structure_application_vote_stat();
DROP FUNCTION IF EXISTS public.maintain_structure_application_support();
DROP FUNCTION IF EXISTS public.maintain_effective_tag_from_structure_support();
DROP FUNCTION IF EXISTS public.refresh_unit_structure_vote_stat(uuid);
DROP FUNCTION IF EXISTS public.refresh_unit_structure_application_vote_stat(uuid, uuid);
DROP FUNCTION IF EXISTS public.lock_unit_structure_definition_key(uuid);

-- Canonical PostgreSQL owner snapshot: tag-path.sql
-- Immutable Tag Path definitions, bounded member projections, global judgments,
-- effective-Tag provenance, and audited manual merge governance.

CREATE OR REPLACE FUNCTION public.guard_tag_path_definition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	eligible_count integer;
	distinct_count integer;
BEGIN
	IF TG_OP <> 'INSERT' THEN
		RAISE EXCEPTION 'Tag Path definitions are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_definition_immutable';
	END IF;

	SELECT count(DISTINCT member_id), count(*)
	INTO distinct_count, eligible_count
	FROM unnest(NEW.member_tag_ids) AS member_id
	JOIN public.tag ON tag.id = member_id
	JOIN public.unit ON unit.id = member_id
	WHERE unit.kind = 'tag'
		AND unit.status = 'published'::public.unit_status
		AND unit.visibility = 'public'::public.resource_visibility
		AND unit.moderation_status = 'approved'::public.moderation_status
		AND unit.deleted_at IS NULL;

	IF eligible_count <> cardinality(NEW.member_tag_ids)
		OR distinct_count <> cardinality(NEW.member_tag_ids) THEN
		RAISE EXCEPTION 'Every Tag Path member must be a distinct active, approved, public Tag'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_member_eligibility';
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM public.unit
		WHERE id = NEW.id AND kind = 'tag_path'
	) THEN
		RAISE EXCEPTION 'Tag Path identity must reference a tag_path Unit'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_unit_kind';
	END IF;

	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.project_tag_path_definition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	INSERT INTO public.tag_path_member(path_id, ordinal, tag_id)
	SELECT NEW.id, member.ordinality - 1, member.tag_id
	FROM unnest(NEW.member_tag_ids) WITH ORDINALITY AS member(tag_id, ordinality);

	INSERT INTO public.tag_path_edge(path_id, ordinal, parent_tag_id, child_tag_id)
	SELECT NEW.id, member.ordinality - 1, NEW.member_tag_ids[member.ordinality],
		NEW.member_tag_ids[member.ordinality + 1]
	FROM generate_series(1, cardinality(NEW.member_tag_ids) - 1) AS member(ordinality);

	INSERT INTO public.tag_path_vote_stat(path_id, terminal_tag_id)
	VALUES (NEW.id, NEW.terminal_tag_id);
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_path_vote_stat_projection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF pg_trigger_depth() < 2 THEN
		RAISE EXCEPTION 'tag_path_vote_stat is a trigger-owned Tag Path ranking projection'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_vote_stat_projection_only';
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_path_projection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF pg_trigger_depth() < 2 THEN
		RAISE EXCEPTION '% is a rebuildable Tag Path projection', TG_TABLE_NAME
			USING ERRCODE = '23514', CONSTRAINT = TG_TABLE_NAME || '_projection_only';
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_path_member_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		IF OLD.kind = 'tag' AND EXISTS (
			SELECT 1 FROM public.tag_path_member WHERE tag_id = OLD.id LIMIT 1
		) THEN
			RAISE EXCEPTION 'A Tag used by a Tag Path cannot be deleted'
				USING ERRCODE = '23514', CONSTRAINT = 'tag_path_member_lifecycle';
		END IF;
		RETURN OLD;
	END IF;
	IF OLD.kind = 'tag' AND EXISTS (
		SELECT 1 FROM public.tag_path_member WHERE tag_id = OLD.id LIMIT 1
	) AND (
		NEW.kind <> 'tag'
		OR NEW.status <> 'published'::public.unit_status
		OR NEW.visibility <> 'public'::public.resource_visibility
		OR NEW.moderation_status <> 'approved'::public.moderation_status
		OR NEW.deleted_at IS NOT NULL
	) THEN
		RAISE EXCEPTION 'A Tag used by a Tag Path must remain active, approved, and public'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_member_lifecycle';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_tag_path_vote_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.path_id ELSE NEW.path_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key('tag_path_vote:' || key_id::text, 0);
	IF TG_OP <> 'INSERT' THEN
		score_delta := score_delta - OLD.value;
		count_delta := count_delta - 1;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		score_delta := score_delta + NEW.value;
		count_delta := count_delta + 1;
	END IF;
	INSERT INTO public.tag_path_vote_stat(
		path_id, terminal_tag_id, score, vote_count, updated_at
	)
	SELECT key_id, path.terminal_tag_id, score_delta, count_delta, clock_timestamp()
	FROM public.tag_path AS path
	WHERE path.id = key_id
	ON CONFLICT (path_id) DO UPDATE SET
		score = tag_path_vote_stat.score + EXCLUDED.score,
		vote_count = tag_path_vote_stat.vote_count + EXCLUDED.vote_count,
		updated_at = EXCLUDED.updated_at;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_tag_path_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_path uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.path_id ELSE NEW.path_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
	spoiler_delta bigint := 0;
	none_delta bigint := 0;
	minor_delta bigint := 0;
	major_delta bigint := 0;
	old_accepted boolean;
	new_accepted boolean;
	current_score bigint;
	current_count bigint;
BEGIN
	PERFORM public.lock_vote_hot_key('unit_tag_path:' || key_unit::text || ':' || key_path::text, 0);
	SELECT score > 0 AND vote_count > 0, score, vote_count
	INTO old_accepted, current_score, current_count
	FROM public.unit_tag_path_judgment_stat
	WHERE unit_id = key_unit AND path_id = key_path;
	old_accepted := coalesce(old_accepted, false);
	current_score := coalesce(current_score, 0);
	current_count := coalesce(current_count, 0);

	IF TG_OP <> 'INSERT' THEN
		IF OLD.fit_vote IS NOT NULL THEN score_delta := score_delta - OLD.fit_vote; count_delta := count_delta - 1; END IF;
		IF OLD.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta - 1;
			IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
			ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
			ELSE major_delta := major_delta - 1; END IF;
		END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		IF NEW.fit_vote IS NOT NULL THEN score_delta := score_delta + NEW.fit_vote; count_delta := count_delta + 1; END IF;
		IF NEW.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta + 1;
			IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
			ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
			ELSE major_delta := major_delta + 1; END IF;
		END IF;
	END IF;

	INSERT INTO public.unit_tag_path_judgment_stat(
		unit_id, path_id, score, vote_count, spoiler_vote_count,
		spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at
	) VALUES (
		key_unit, key_path, score_delta, count_delta, spoiler_delta,
		none_delta, minor_delta, major_delta, clock_timestamp()
	) ON CONFLICT (unit_id, path_id) DO UPDATE SET
		score = unit_tag_path_judgment_stat.score + EXCLUDED.score,
		vote_count = unit_tag_path_judgment_stat.vote_count + EXCLUDED.vote_count,
		spoiler_vote_count = unit_tag_path_judgment_stat.spoiler_vote_count + EXCLUDED.spoiler_vote_count,
		spoiler_none_count = unit_tag_path_judgment_stat.spoiler_none_count + EXCLUDED.spoiler_none_count,
		spoiler_minor_count = unit_tag_path_judgment_stat.spoiler_minor_count + EXCLUDED.spoiler_minor_count,
		spoiler_major_count = unit_tag_path_judgment_stat.spoiler_major_count + EXCLUDED.spoiler_major_count,
		updated_at = EXCLUDED.updated_at;

	new_accepted := current_score + score_delta > 0 AND current_count + count_delta > 0;
	IF old_accepted <> new_accepted THEN
		UPDATE public.tag_path_vote_stat
		SET usage_count = usage_count + CASE WHEN new_accepted THEN 1 ELSE -1 END,
			updated_at = clock_timestamp()
		WHERE path_id = key_path;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_tag_path_support()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	old_unit uuid := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.unit_id END;
	old_path uuid := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.path_id END;
	old_profile uuid := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.profile_id END;
BEGIN
	IF TG_OP <> 'INSERT' THEN
		DELETE FROM public.unit_tag_path_support
		WHERE unit_id = old_unit AND path_id = old_path AND profile_id = old_profile;
	END IF;
	IF TG_OP <> 'DELETE' AND NEW.fit_vote = 1 THEN
		INSERT INTO public.unit_tag_path_support(unit_id, tag_id, profile_id, path_id)
		SELECT NEW.unit_id, member.tag_id, NEW.profile_id, NEW.path_id
		FROM public.tag_path_member AS member
		WHERE member.path_id = NEW.path_id
		ON CONFLICT DO NOTHING;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_effective_tag_from_path_support()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_tag uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	support_count bigint;
	direct_exists boolean;
BEGIN
	PERFORM public.lock_vote_hot_key('unit_effective_tag:' || key_unit::text || ':' || key_tag::text, 0);
	SELECT count(*) INTO support_count FROM public.unit_tag_path_support
	WHERE unit_id = key_unit AND tag_id = key_tag;
	SELECT EXISTS(SELECT 1 FROM public.unit_tag WHERE unit_id = key_unit AND tag_id = key_tag)
	INTO direct_exists;
	IF direct_exists OR support_count > 0 THEN
		INSERT INTO public.unit_effective_tag(unit_id, tag_id, direct, path_support_count, updated_at)
		VALUES (key_unit, key_tag, direct_exists, support_count, clock_timestamp())
		ON CONFLICT (unit_id, tag_id) DO UPDATE SET
			direct = EXCLUDED.direct,
			path_support_count = EXCLUDED.path_support_count,
			updated_at = EXCLUDED.updated_at;
	ELSE
		DELETE FROM public.unit_effective_tag WHERE unit_id = key_unit AND tag_id = key_tag;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_unit_tag_path_judgment_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF (OLD.unit_id, OLD.path_id, OLD.profile_id) IS DISTINCT FROM
		(NEW.unit_id, NEW.path_id, NEW.profile_id) THEN
		RAISE EXCEPTION 'Unit–Tag Path judgment identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'unit_tag_path_judgment_identity_immutable';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_path_merge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Tag Path merge history is append-only'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_merge_append_only';
	END IF;
	IF TG_OP = 'UPDATE' THEN
		IF (OLD.source_path_id, OLD.target_path_id, OLD.reason, OLD.proposal_source_kind,
				OLD.proposal_provenance, OLD.proposed_by_profile_id, OLD.created_at)
			IS DISTINCT FROM
			(NEW.source_path_id, NEW.target_path_id, NEW.reason, NEW.proposal_source_kind,
				NEW.proposal_provenance, NEW.proposed_by_profile_id, NEW.created_at)
			OR NOT ((OLD.status = 'proposed' AND NEW.status IN ('accepted', 'rejected'))
				OR (OLD.status = 'accepted' AND NEW.status = 'reversed')) THEN
			RAISE EXCEPTION 'Invalid Tag Path merge transition'
				USING ERRCODE = '23514', CONSTRAINT = 'tag_path_merge_transition';
		END IF;
	END IF;
	IF NEW.status = 'accepted' AND EXISTS (
		WITH RECURSIVE chain(path_id, depth) AS (
			SELECT NEW.target_path_id, 0
			UNION ALL
			SELECT merge.target_path_id, chain.depth + 1
			FROM chain JOIN public.tag_path_merge AS merge
				ON merge.source_path_id = chain.path_id AND merge.status = 'accepted'
			WHERE chain.depth < 64
		)
		SELECT 1 FROM chain WHERE path_id = NEW.source_path_id OR depth = 64
	) THEN
		RAISE EXCEPTION 'Tag Path merges cannot form a cycle or unbounded chain'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_merge_acyclic';
	END IF;
	RETURN NEW;
END;
$$;

CREATE TRIGGER tag_path_definition_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_definition();

CREATE TRIGGER tag_path_definition_project
AFTER INSERT ON public.tag_path
FOR EACH ROW EXECUTE FUNCTION public.project_tag_path_definition();

CREATE TRIGGER tag_path_member_projection_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path_member
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_projection();

CREATE TRIGGER tag_path_edge_projection_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path_edge
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_projection();

CREATE TRIGGER tag_path_member_unit_lifecycle_guard
BEFORE UPDATE OR DELETE ON public.unit
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_member_lifecycle();

CREATE TRIGGER tag_path_vote_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.tag_path_vote
FOR EACH ROW EXECUTE FUNCTION public.maintain_tag_path_vote_stat();

CREATE TRIGGER tag_path_vote_stat_projection_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path_vote_stat
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_vote_stat_projection();

CREATE TRIGGER unit_tag_path_judgment_identity_guard
BEFORE UPDATE ON public.unit_tag_path_judgment
FOR EACH ROW EXECUTE FUNCTION public.protect_unit_tag_path_judgment_identity();

CREATE TRIGGER unit_tag_path_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.unit_tag_path_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_tag_path_judgment_stat();

CREATE TRIGGER unit_tag_path_support_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.unit_tag_path_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_tag_path_support();

CREATE TRIGGER unit_tag_path_support_effective_maintain
AFTER INSERT OR DELETE ON public.unit_tag_path_support
FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_effective_tag_from_path_support();

CREATE TRIGGER tag_path_merge_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path_merge
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_merge();

-- Canonical PostgreSQL owner snapshot: tag-judgment-aggregates.sql
-- Global direct/effective Tag judgments and subject-association spoiler totals.
-- All mutations lock and update one indexed fact key; no corpus-wide refresh is used.

CREATE OR REPLACE FUNCTION public.lock_vote_hot_keys(
	target_unit_ids uuid[],
	target_tag_ids uuid[],
	target_profile_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
	hot_key record;
BEGIN
	IF target_unit_ids IS NULL OR target_tag_ids IS NULL OR target_profile_ids IS NULL
		OR cardinality(target_unit_ids) > 1024
		OR cardinality(target_unit_ids) <> cardinality(target_tag_ids)
		OR cardinality(target_unit_ids) <> cardinality(target_profile_ids)
		OR EXISTS (
			SELECT 1 FROM unnest(target_unit_ids, target_tag_ids) AS key(unit_id, tag_id)
			WHERE key.unit_id IS NULL OR key.tag_id IS NULL
		) THEN
		RAISE EXCEPTION 'Vote hot-key arrays must contain at most 1024 aligned, non-null Unit/Tag keys'
			USING ERRCODE = '22023', CONSTRAINT = 'vote_hot_key_batch_invalid';
	END IF;
	FOR hot_key IN
		SELECT DISTINCT key.unit_id, key.tag_id
		FROM unnest(target_unit_ids, target_tag_ids) AS key(unit_id, tag_id)
		ORDER BY key.unit_id, key.tag_id
	LOOP
		IF NOT pg_try_advisory_xact_lock(hashtextextended(hot_key.unit_id::text || ':' || hot_key.tag_id::text, 71001)) THEN
			RAISE EXCEPTION 'Vote aggregate key is busy'
				USING ERRCODE = '55P03', CONSTRAINT = 'vote_hot_key_busy';
		END IF;
	END LOOP;
	FOR hot_key IN
		SELECT DISTINCT key.unit_id, key.tag_id, key.profile_id
		FROM unnest(target_unit_ids, target_tag_ids, target_profile_ids)
			AS key(unit_id, tag_id, profile_id)
		WHERE key.profile_id IS NOT NULL
		ORDER BY key.unit_id, key.tag_id, key.profile_id
	LOOP
		IF NOT pg_try_advisory_xact_lock(hashtextextended(
			hot_key.unit_id::text || ':' || hot_key.tag_id::text || ':' || hot_key.profile_id::text, 71002
		)) THEN
			RAISE EXCEPTION 'Per-Profile vote key is busy'
				USING ERRCODE = '55P03', CONSTRAINT = 'vote_hot_key_busy';
		END IF;
	END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_effective_tag_context(
	key_unit uuid,
	key_tag uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	direct_exists boolean;
	support_count bigint;
BEGIN
	PERFORM public.lock_vote_hot_key('unit_effective_tag:' || key_unit::text || ':' || key_tag::text, 0);
	SELECT EXISTS(SELECT 1 FROM public.unit_tag WHERE unit_id = key_unit AND tag_id = key_tag)
	INTO direct_exists;
	SELECT count(*) FROM public.unit_tag_path_support
	WHERE unit_id = key_unit AND tag_id = key_tag INTO support_count;
	IF direct_exists OR support_count > 0 THEN
		INSERT INTO public.unit_effective_tag(unit_id, tag_id, direct, path_support_count, updated_at)
		VALUES (key_unit, key_tag, direct_exists, support_count, clock_timestamp())
		ON CONFLICT (unit_id, tag_id) DO UPDATE SET
			direct = EXCLUDED.direct,
			path_support_count = EXCLUDED.path_support_count,
			updated_at = EXCLUDED.updated_at;
	ELSE
		DELETE FROM public.unit_effective_tag WHERE unit_id = key_unit AND tag_id = key_tag;
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_effective_tag_from_direct()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	PERFORM public.refresh_unit_effective_tag_context(
		CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END,
		CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END
	);
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_effective_tag_vote(
	target_unit_id uuid,
	target_tag_id uuid,
	target_profile_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	effective_value integer;
BEGIN
	PERFORM public.lock_vote_hot_key(
		'unit_effective_tag_vote:' || target_unit_id::text || ':' || target_tag_id::text || ':' || target_profile_id::text,
		0
	);
	SELECT judgment.fit_vote INTO effective_value
	FROM public.unit_tag_judgment AS judgment
	WHERE judgment.unit_id = target_unit_id AND judgment.tag_id = target_tag_id
		AND judgment.profile_id = target_profile_id AND judgment.fit_vote IS NOT NULL;
	IF effective_value IS NULL AND EXISTS (
		SELECT 1 FROM public.unit_tag_path_support
		WHERE unit_id = target_unit_id AND tag_id = target_tag_id AND profile_id = target_profile_id
	) THEN
		effective_value := 1;
	END IF;
	IF effective_value IS NULL THEN
		DELETE FROM public.unit_effective_tag_vote
		WHERE unit_id = target_unit_id AND tag_id = target_tag_id AND profile_id = target_profile_id;
	ELSE
		INSERT INTO public.unit_effective_tag_vote(unit_id, tag_id, profile_id, value, updated_at)
		VALUES (target_unit_id, target_tag_id, target_profile_id, effective_value, clock_timestamp())
		ON CONFLICT (unit_id, tag_id, profile_id) DO UPDATE SET
			value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_effective_tag_vote_from_direct()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	PERFORM public.refresh_unit_effective_tag_vote(
		CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END,
		CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END,
		CASE WHEN TG_OP = 'DELETE' THEN OLD.profile_id ELSE NEW.profile_id END
	);
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_effective_tag_vote_from_path()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	PERFORM public.refresh_unit_effective_tag_vote(
		CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END,
		CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END,
		CASE WHEN TG_OP = 'DELETE' THEN OLD.profile_id ELSE NEW.profile_id END
	);
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_tag_fit_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_tag uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key('unit_tag_stat:' || key_unit::text || ':' || key_tag::text, 0);
	IF TG_OP <> 'INSERT' THEN score_delta := score_delta - OLD.value; count_delta := count_delta - 1; END IF;
	IF TG_OP <> 'DELETE' THEN score_delta := score_delta + NEW.value; count_delta := count_delta + 1; END IF;
	INSERT INTO public.unit_tag_judgment_stat(unit_id, tag_id, score, vote_count, updated_at)
	VALUES (key_unit, key_tag, score_delta, count_delta, clock_timestamp())
	ON CONFLICT (unit_id, tag_id) DO UPDATE SET
		score = unit_tag_judgment_stat.score + EXCLUDED.score,
		vote_count = unit_tag_judgment_stat.vote_count + EXCLUDED.vote_count,
		updated_at = EXCLUDED.updated_at;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_tag_spoiler_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_tag uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	count_delta bigint := 0;
	none_delta bigint := 0;
	minor_delta bigint := 0;
	major_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key('unit_tag_stat:' || key_unit::text || ':' || key_tag::text, 0);
	IF TG_OP <> 'INSERT' AND OLD.spoiler_level IS NOT NULL THEN
		count_delta := count_delta - 1;
		IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
		ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
		ELSE major_delta := major_delta - 1; END IF;
	END IF;
	IF TG_OP <> 'DELETE' AND NEW.spoiler_level IS NOT NULL THEN
		count_delta := count_delta + 1;
		IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
		ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
		ELSE major_delta := major_delta + 1; END IF;
	END IF;
	INSERT INTO public.unit_tag_judgment_stat(
		unit_id, tag_id, spoiler_vote_count, spoiler_none_count,
		spoiler_minor_count, spoiler_major_count, updated_at
	) VALUES (key_unit, key_tag, count_delta, none_delta, minor_delta, major_delta, clock_timestamp())
	ON CONFLICT (unit_id, tag_id) DO UPDATE SET
		spoiler_vote_count = unit_tag_judgment_stat.spoiler_vote_count + EXCLUDED.spoiler_vote_count,
		spoiler_none_count = unit_tag_judgment_stat.spoiler_none_count + EXCLUDED.spoiler_none_count,
		spoiler_minor_count = unit_tag_judgment_stat.spoiler_minor_count + EXCLUDED.spoiler_minor_count,
		spoiler_major_count = unit_tag_judgment_stat.spoiler_major_count + EXCLUDED.spoiler_major_count,
		updated_at = EXCLUDED.updated_at;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_subject_association_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.association_id ELSE NEW.association_id END;
	count_delta bigint := 0;
	none_delta bigint := 0;
	minor_delta bigint := 0;
	major_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key('subject_spoiler:' || key_id::text, 0);
	IF TG_OP <> 'INSERT' THEN
		count_delta := count_delta - 1;
		IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
		ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
		ELSE major_delta := major_delta - 1; END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		count_delta := count_delta + 1;
		IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
		ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
		ELSE major_delta := major_delta + 1; END IF;
	END IF;
	INSERT INTO public.subject_association_judgment_stat(
		association_id, spoiler_vote_count, spoiler_none_count,
		spoiler_minor_count, spoiler_major_count, updated_at
	) VALUES (key_id, count_delta, none_delta, minor_delta, major_delta, clock_timestamp())
	ON CONFLICT (association_id) DO UPDATE SET
		spoiler_vote_count = subject_association_judgment_stat.spoiler_vote_count + EXCLUDED.spoiler_vote_count,
		spoiler_none_count = subject_association_judgment_stat.spoiler_none_count + EXCLUDED.spoiler_none_count,
		spoiler_minor_count = subject_association_judgment_stat.spoiler_minor_count + EXCLUDED.spoiler_minor_count,
		spoiler_major_count = subject_association_judgment_stat.spoiler_major_count + EXCLUDED.spoiler_major_count,
		updated_at = EXCLUDED.updated_at;
	RETURN NULL;
END;
$$;

CREATE TRIGGER unit_tag_effective_context_maintain
AFTER INSERT OR DELETE ON public.unit_tag
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_effective_tag_from_direct();

CREATE TRIGGER unit_tag_judgment_effective_vote_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.unit_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_effective_tag_vote_from_direct();

CREATE TRIGGER unit_tag_path_support_effective_vote_maintain
AFTER INSERT OR DELETE ON public.unit_tag_path_support
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_effective_tag_vote_from_path();

CREATE TRIGGER unit_effective_tag_vote_fit_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.unit_effective_tag_vote
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_tag_fit_stat();

CREATE TRIGGER unit_tag_judgment_spoiler_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.unit_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_tag_spoiler_stat();

CREATE TRIGGER subject_association_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.subject_association_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_subject_association_judgment_stat();

-- Canonical PostgreSQL owner snapshot: realm-tag-authority.sql
-- Realm-local Tag and Tag Path authority. Global and Realm votes remain separate;
-- fallback policy is resolved by readers and never merges aggregate populations.

CREATE OR REPLACE FUNCTION public.lock_vote_hot_key(lock_key text, lock_seed bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
	IF lock_key IS NULL OR lock_seed IS NULL THEN
		RAISE EXCEPTION 'Vote hot key must be non-null'
			USING ERRCODE = '22023', CONSTRAINT = 'vote_hot_key_invalid';
	END IF;
	IF NOT pg_try_advisory_xact_lock(hashtextextended(lock_key, lock_seed)) THEN
		RAISE EXCEPTION 'Vote aggregate key is busy'
			USING ERRCODE = '55P03', CONSTRAINT = 'vote_hot_key_busy';
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_realm_tag_path_vote_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_realm uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.realm_id ELSE NEW.realm_id END;
	key_path uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.path_id ELSE NEW.path_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key('realm_tag_path_vote:' || key_realm::text || ':' || key_path::text, 0);
	IF TG_OP <> 'INSERT' THEN score_delta := score_delta - OLD.value; count_delta := count_delta - 1; END IF;
	IF TG_OP <> 'DELETE' THEN score_delta := score_delta + NEW.value; count_delta := count_delta + 1; END IF;
	INSERT INTO public.realm_tag_path_vote_stat(realm_id, path_id, score, vote_count, updated_at)
	VALUES (key_realm, key_path, score_delta, count_delta, clock_timestamp())
	ON CONFLICT (realm_id, path_id) DO UPDATE SET
		score = realm_tag_path_vote_stat.score + EXCLUDED.score,
		vote_count = realm_tag_path_vote_stat.vote_count + EXCLUDED.vote_count,
		updated_at = EXCLUDED.updated_at;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_realm_unit_tag_path_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_realm uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.realm_id ELSE NEW.realm_id END;
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_path uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.path_id ELSE NEW.path_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
	spoiler_delta bigint := 0;
	none_delta bigint := 0;
	minor_delta bigint := 0;
	major_delta bigint := 0;
	old_accepted boolean;
	current_score bigint;
	current_count bigint;
	new_accepted boolean;
BEGIN
	PERFORM public.lock_vote_hot_key('realm_unit_tag_path:' || key_realm::text || ':' || key_unit::text || ':' || key_path::text, 0);
	SELECT score > 0 AND vote_count > 0, score, vote_count
	INTO old_accepted, current_score, current_count
	FROM public.realm_unit_tag_path_judgment_stat
	WHERE realm_id = key_realm AND unit_id = key_unit AND path_id = key_path;
	old_accepted := coalesce(old_accepted, false);
	current_score := coalesce(current_score, 0);
	current_count := coalesce(current_count, 0);
	IF TG_OP <> 'INSERT' THEN
		IF OLD.fit_vote IS NOT NULL THEN score_delta := score_delta - OLD.fit_vote; count_delta := count_delta - 1; END IF;
		IF OLD.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta - 1;
			IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
			ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
			ELSE major_delta := major_delta - 1; END IF;
		END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		IF NEW.fit_vote IS NOT NULL THEN score_delta := score_delta + NEW.fit_vote; count_delta := count_delta + 1; END IF;
		IF NEW.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta + 1;
			IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
			ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
			ELSE major_delta := major_delta + 1; END IF;
		END IF;
	END IF;
	INSERT INTO public.realm_unit_tag_path_judgment_stat(
		realm_id, unit_id, path_id, score, vote_count, spoiler_vote_count,
		spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at
	) VALUES (
		key_realm, key_unit, key_path, score_delta, count_delta, spoiler_delta,
		none_delta, minor_delta, major_delta, clock_timestamp()
	) ON CONFLICT (realm_id, unit_id, path_id) DO UPDATE SET
		score = realm_unit_tag_path_judgment_stat.score + EXCLUDED.score,
		vote_count = realm_unit_tag_path_judgment_stat.vote_count + EXCLUDED.vote_count,
		spoiler_vote_count = realm_unit_tag_path_judgment_stat.spoiler_vote_count + EXCLUDED.spoiler_vote_count,
		spoiler_none_count = realm_unit_tag_path_judgment_stat.spoiler_none_count + EXCLUDED.spoiler_none_count,
		spoiler_minor_count = realm_unit_tag_path_judgment_stat.spoiler_minor_count + EXCLUDED.spoiler_minor_count,
		spoiler_major_count = realm_unit_tag_path_judgment_stat.spoiler_major_count + EXCLUDED.spoiler_major_count,
		updated_at = EXCLUDED.updated_at;
	new_accepted := current_score + score_delta > 0 AND current_count + count_delta > 0;
	IF old_accepted <> new_accepted THEN
		UPDATE public.realm_tag_path_vote_stat
		SET usage_count = usage_count + CASE WHEN new_accepted THEN 1 ELSE -1 END,
			updated_at = clock_timestamp()
		WHERE realm_id = key_realm AND path_id = key_path;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_realm_unit_tag_path_support()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP <> 'INSERT' THEN
		DELETE FROM public.realm_unit_tag_path_support
		WHERE realm_id = OLD.realm_id AND unit_id = OLD.unit_id
			AND path_id = OLD.path_id AND profile_id = OLD.profile_id;
	END IF;
	IF TG_OP <> 'DELETE' AND NEW.fit_vote = 1 THEN
		INSERT INTO public.realm_unit_tag_path_support(realm_id, unit_id, tag_id, profile_id, path_id)
		SELECT NEW.realm_id, NEW.unit_id, member.tag_id, NEW.profile_id, NEW.path_id
		FROM public.tag_path_member AS member WHERE member.path_id = NEW.path_id
		ON CONFLICT DO NOTHING;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_realm_unit_effective_tag()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_realm uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.realm_id ELSE NEW.realm_id END;
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_tag uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	direct_exists boolean;
	support_count bigint;
BEGIN
	PERFORM public.lock_vote_hot_key('realm_effective_tag:' || key_realm::text || ':' || key_unit::text || ':' || key_tag::text, 0);
	SELECT EXISTS(SELECT 1 FROM public.realm_unit_tag
		WHERE realm_id = key_realm AND unit_id = key_unit AND tag_id = key_tag)
	INTO direct_exists;
	SELECT count(*) FROM public.realm_unit_tag_path_support
	WHERE realm_id = key_realm AND unit_id = key_unit AND tag_id = key_tag
	INTO support_count;
	IF direct_exists OR support_count > 0 THEN
		INSERT INTO public.realm_unit_effective_tag(realm_id, unit_id, tag_id, direct, path_support_count, updated_at)
		VALUES (key_realm, key_unit, key_tag, direct_exists, support_count, clock_timestamp())
		ON CONFLICT (realm_id, unit_id, tag_id) DO UPDATE SET
			direct = EXCLUDED.direct, path_support_count = EXCLUDED.path_support_count,
			updated_at = EXCLUDED.updated_at;
	ELSE
		DELETE FROM public.realm_unit_effective_tag
		WHERE realm_id = key_realm AND unit_id = key_unit AND tag_id = key_tag;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_realm_tag_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_realm uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.realm_id ELSE NEW.realm_id END;
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_tag uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	score_delta bigint := 0; count_delta bigint := 0; spoiler_delta bigint := 0;
	none_delta bigint := 0; minor_delta bigint := 0; major_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key('realm_tag_stat:' || key_realm::text || ':' || key_unit::text || ':' || key_tag::text, 0);
	IF TG_OP <> 'INSERT' THEN
		IF OLD.fit_vote IS NOT NULL THEN score_delta := score_delta - OLD.fit_vote; count_delta := count_delta - 1; END IF;
		IF OLD.spoiler_level IS NOT NULL THEN spoiler_delta := spoiler_delta - 1;
			IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
			ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
			ELSE major_delta := major_delta - 1; END IF; END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		IF NEW.fit_vote IS NOT NULL THEN score_delta := score_delta + NEW.fit_vote; count_delta := count_delta + 1; END IF;
		IF NEW.spoiler_level IS NOT NULL THEN spoiler_delta := spoiler_delta + 1;
			IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
			ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
			ELSE major_delta := major_delta + 1; END IF; END IF;
	END IF;
	INSERT INTO public.realm_tag_judgment_stat(
		realm_id, unit_id, tag_id, score, vote_count, spoiler_vote_count,
		spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at
	) VALUES (key_realm, key_unit, key_tag, score_delta, count_delta, spoiler_delta,
		none_delta, minor_delta, major_delta, clock_timestamp())
	ON CONFLICT (realm_id, unit_id, tag_id) DO UPDATE SET
		score = realm_tag_judgment_stat.score + EXCLUDED.score,
		vote_count = realm_tag_judgment_stat.vote_count + EXCLUDED.vote_count,
		spoiler_vote_count = realm_tag_judgment_stat.spoiler_vote_count + EXCLUDED.spoiler_vote_count,
		spoiler_none_count = realm_tag_judgment_stat.spoiler_none_count + EXCLUDED.spoiler_none_count,
		spoiler_minor_count = realm_tag_judgment_stat.spoiler_minor_count + EXCLUDED.spoiler_minor_count,
		spoiler_major_count = realm_tag_judgment_stat.spoiler_major_count + EXCLUDED.spoiler_major_count,
		updated_at = EXCLUDED.updated_at;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_realm_tag_path_judgment_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF (OLD.realm_id, OLD.unit_id, OLD.path_id, OLD.profile_id) IS DISTINCT FROM
		(NEW.realm_id, NEW.unit_id, NEW.path_id, NEW.profile_id) THEN
		RAISE EXCEPTION 'Realm Unit–Tag Path judgment identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'realm_unit_tag_path_judgment_identity_immutable';
	END IF;
	RETURN NEW;
END;
$$;

CREATE TRIGGER realm_tag_path_vote_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.realm_tag_path_vote
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_tag_path_vote_stat();

CREATE TRIGGER realm_unit_tag_path_judgment_identity_guard
BEFORE UPDATE ON public.realm_unit_tag_path_judgment
FOR EACH ROW EXECUTE FUNCTION public.protect_realm_tag_path_judgment_identity();

CREATE TRIGGER realm_unit_tag_path_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.realm_unit_tag_path_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_unit_tag_path_judgment_stat();

CREATE TRIGGER realm_unit_tag_path_support_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.realm_unit_tag_path_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_unit_tag_path_support();

CREATE TRIGGER realm_unit_tag_path_support_effective_maintain
AFTER INSERT OR DELETE ON public.realm_unit_tag_path_support
FOR EACH ROW EXECUTE FUNCTION public.refresh_realm_unit_effective_tag();

CREATE TRIGGER realm_unit_tag_effective_maintain
AFTER INSERT OR DELETE ON public.realm_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.refresh_realm_unit_effective_tag();

CREATE TRIGGER realm_tag_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.realm_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_tag_judgment_stat();

-- Canonical PostgreSQL owner snapshot: content-label-policy.sql
-- Fixed content-label registry and direct Tag application policy.

CREATE OR REPLACE FUNCTION public.guard_tag_directly_applicable_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
	IF NOT OLD.directly_applicable OR NEW.directly_applicable THEN RETURN NEW; END IF;
	IF EXISTS (SELECT 1 FROM public.unit_tag WHERE tag_id = NEW.id)
		OR EXISTS (SELECT 1 FROM public.realm_unit_tag WHERE tag_id = NEW.id)
		OR EXISTS (SELECT 1 FROM public.profile_unit_tag WHERE tag_id = NEW.id)
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
	IF TG_TABLE_NAME = 'profile_unit_tag' THEN
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

CREATE TRIGGER tag_directly_applicable_transition_guard
BEFORE UPDATE OF directly_applicable ON public.tag
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_directly_applicable_transition();

CREATE TRIGGER unit_merge_operation_content_label_guard
BEFORE INSERT OR UPDATE OF source_unit_id, target_unit_id ON public.unit_merge_operation
FOR EACH ROW EXECUTE FUNCTION public.guard_content_label_unit_merge();

CREATE TRIGGER unit_tag_application_policy_guard
BEFORE INSERT OR UPDATE ON public.unit_tag
FOR EACH ROW EXECUTE FUNCTION public.guard_direct_tag_application_policy();

CREATE TRIGGER realm_unit_tag_application_policy_guard
BEFORE INSERT OR UPDATE ON public.realm_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.guard_direct_tag_application_policy();

CREATE TRIGGER profile_unit_tag_application_policy_guard
BEFORE INSERT OR UPDATE ON public.profile_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.guard_direct_tag_application_policy();

CREATE TRIGGER unit_tag_judgment_content_label_reject
BEFORE INSERT OR UPDATE ON public.unit_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.reject_content_label_judgment();

-- Canonical PostgreSQL owner snapshot: tag-path-search.sql
-- Ordinary search callers request Tag documents. Tag Path curation requests
-- Tag Path documents explicitly through the same bounded PGroonga primitive.
CREATE OR REPLACE FUNCTION public.search_text_candidates(
    p_queries text[],
    p_languages text[],
    p_unit_kind text,
    p_after_updated_at_micros bigint,
    p_after_unit_id uuid,
    p_estimated_postings_limit integer,
    p_limit integer
) RETURNS TABLE (unit_id uuid, unit_updated_at_micros bigint, search_matched boolean)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public, pg_temp
    AS $$
DECLARE
    candidate_language text;
    candidate_column text;
    index_column text;
    keyword text;
    keyword_result jsonb;
    keyword_size bigint;
    estimated_postings bigint := 0;
    estimated_postings_limit_ceiling constant integer := 50000;
    match_columns text := '';
    search_columns text[] := ARRAY[]::text[];
    after_order_key text;
    filter_expression text := 'pgroonga_tuple_is_alive(_key)';
    command_result jsonb;
    return_code integer;
    expanded_query text;
BEGIN
    IF p_queries IS NULL
       OR cardinality(p_queries) < 1
       OR cardinality(p_queries) > 3
       OR EXISTS (
           SELECT 1
           FROM unnest(p_queries) AS query_variant(value)
           WHERE value IS NULL
              OR btrim(value) = ''
              OR char_length(value) > 512
       )
       OR coalesce((SELECT sum(char_length(value)) FROM unnest(p_queries) AS query_variant(value)), 0) > 1536 THEN
        RAISE EXCEPTION 'invalid text query variants' USING ERRCODE = '22023';
    END IF;
    IF p_languages IS NULL
       OR NOT p_languages <@ ARRAY['zh', 'en', 'ja', 'ko', 'de', 'fr', 'es']::text[] THEN
        RAISE EXCEPTION 'invalid text language boundary' USING ERRCODE = '22023';
    END IF;
    IF p_unit_kind IS NULL OR p_unit_kind NOT IN (
        'slug_namespace', 'profile', 'book', 'software', 'media', 'video', 'audio',
        'release', 'entity', 'label', 'tag', 'tag_path', 'series', 'zone',
        'zone_page', 'collection', 'post', 'poll', 'realm', 'realm_rule'
    ) THEN
        RAISE EXCEPTION 'invalid Unit kind boundary' USING ERRCODE = '22023';
    END IF;
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 4097 THEN
        RAISE EXCEPTION 'invalid text result limit' USING ERRCODE = '22023';
    END IF;
    IF p_estimated_postings_limit IS NULL
       OR p_estimated_postings_limit < 1
       OR p_estimated_postings_limit > estimated_postings_limit_ceiling THEN
        RAISE EXCEPTION 'invalid text posting budget' USING ERRCODE = '22023';
    END IF;
    IF num_nonnulls(p_after_updated_at_micros, p_after_unit_id) NOT IN (0, 2)
       OR p_after_updated_at_micros < 0 THEN
        RAISE EXCEPTION 'invalid text cursor' USING ERRCODE = '22023';
    END IF;

    SELECT string_agg(
        '(' || public.pgroonga_query_escape(value) || ')',
        ' OR ' ORDER BY ordinality
    )
    INTO expanded_query
    FROM unnest(p_queries) WITH ORDINALITY AS query_variant(value, ordinality);

    IF cardinality(p_languages) = 0 THEN
        search_columns := ARRAY['text_all'];
    ELSE
        FOREACH candidate_language IN ARRAY ARRAY['zh', 'en', 'ja', 'ko', 'de', 'fr', 'es']::text[]
        LOOP
            IF candidate_language = ANY(p_languages) THEN
                search_columns := array_append(search_columns, 'text_' || candidate_language);
            END IF;
        END LOOP;
    END IF;

    FOREACH candidate_column IN ARRAY search_columns LOOP
        match_columns := match_columns
            || CASE WHEN match_columns = '' THEN '' ELSE ' || ' END
            || candidate_column;
        index_column := public.pgroonga_index_column_name(
            'unit_search_document_pgroonga_idx', candidate_column
        );
        FOREACH keyword IN ARRAY public.pgroonga_query_extract_keywords(expanded_query)
        LOOP
            keyword_result := public.pgroonga_command('table_tokenize', ARRAY[
                'table', split_part(index_column, '.', 1),
                'string', keyword,
                'index_column', split_part(index_column, '.', 2),
                'mode', 'GET'
            ])::jsonb;
            return_code := (keyword_result #>> '{0,0}')::integer;
            IF return_code IS DISTINCT FROM 0 THEN
                RAISE EXCEPTION 'Groonga estimate command failed with code %', return_code;
            END IF;
            SELECT coalesce(sum((token.value ->> 'estimated_size')::bigint), 0)
            INTO keyword_size
            FROM jsonb_array_elements(coalesce(keyword_result #> '{1}', '[]'::jsonb)) AS token(value);
            estimated_postings := estimated_postings + keyword_size;
            EXIT WHEN estimated_postings > p_estimated_postings_limit;
        END LOOP;
        EXIT WHEN estimated_postings > p_estimated_postings_limit;
    END LOOP;

    IF estimated_postings > p_estimated_postings_limit THEN
        RETURN QUERY
        SELECT candidate.id,
            (extract(epoch FROM candidate.updated_at) * 1000000)::bigint,
            false
        FROM public.unit AS candidate
        WHERE candidate.kind = p_unit_kind
          AND candidate.status = 'published'::public.unit_status
          AND candidate.visibility = 'public'::public.resource_visibility
          AND candidate.moderation_status = 'approved'::public.moderation_status
          AND candidate.deleted_at IS NULL
          AND (p_after_unit_id IS NULL OR (candidate.updated_at, candidate.id) < (
              to_timestamp(p_after_updated_at_micros::numeric / 1000000),
              p_after_unit_id
          ))
        ORDER BY candidate.updated_at DESC, candidate.id DESC
        LIMIT p_limit;
        RETURN;
    END IF;

    filter_expression := filter_expression || ' && unit_kind == '
        || public.pgroonga_escape(p_unit_kind);
    IF p_after_unit_id IS NOT NULL THEN
        after_order_key := lpad(p_after_updated_at_micros::text, 20, '0')
            || ':' || p_after_unit_id::text;
        filter_expression := filter_expression || ' && search_order_key < '
            || public.pgroonga_escape(after_order_key);
    END IF;

    command_result := public.pgroonga_command('select', ARRAY[
        'table', public.pgroonga_table_name('unit_search_document_pgroonga_idx'),
        'command_version', '3',
        'cache', 'no',
        'match_columns', match_columns,
        'query', expanded_query,
        'filter', filter_expression,
        'sort_keys', '-search_order_key',
        'limit', p_limit::text,
        'output_columns', 'search_order_key'
    ])::jsonb;
    return_code := (command_result #>> '{header,return_code}')::integer;
    IF return_code IS DISTINCT FROM 0 THEN
        RAISE EXCEPTION 'PGroonga text command failed with code %', return_code;
    END IF;

    RETURN QUERY
    SELECT right(record.value ->> 0, 36)::uuid,
        split_part(record.value ->> 0, ':', 1)::bigint,
        true
    FROM jsonb_array_elements(
        coalesce(command_result #> '{body,records}', '[]'::jsonb)
    ) WITH ORDINALITY AS record(value, position)
    ORDER BY record.position;
END;
$$;

DROP FUNCTION IF EXISTS public.search_text_candidates(
    text, text[], text, bigint, uuid, integer, integer
);

REVOKE ALL ON FUNCTION public.search_text_candidates(
    text[], text[], text, bigint, uuid, integer, integer
) FROM PUBLIC;

-- Canonical PostgreSQL owner snapshot: entity-measurement-evidence.sql
-- Canonical Entity measurement facts are editable independently of immutable
-- content-pack provenance. Cross-row contextual cardinality stays bounded.

CREATE OR REPLACE FUNCTION public.guard_entity_measurement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP = 'UPDATE' AND (NEW.entity_id, NEW.context_unit_id)
		IS DISTINCT FROM (OLD.entity_id, OLD.context_unit_id) THEN
		RAISE EXCEPTION 'Entity measurement identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'entity_measurement_identity_immutable';
	END IF;
	IF TG_OP <> 'DELETE' AND NEW.context_unit_id IS NOT NULL THEN
		PERFORM pg_advisory_xact_lock(hashtextextended('entity_measurement:' || NEW.entity_id::text, 0));
		IF NOT EXISTS (
			SELECT 1 FROM public.entity_measurement
			WHERE entity_id = NEW.entity_id AND context_unit_id = NEW.context_unit_id
		) AND EXISTS (
			SELECT 1 FROM public.entity_measurement
			WHERE entity_id = NEW.entity_id AND context_unit_id IS NOT NULL
			OFFSET 7 LIMIT 1
		) THEN
			RAISE EXCEPTION 'An Entity may have at most eight contextual measurement sets'
				USING ERRCODE = '23514', CONSTRAINT = 'entity_measurement_context_limit';
		END IF;
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_content_pack_entity_measurement_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	RAISE EXCEPTION 'Content-pack Entity measurement evidence is append-only'
		USING ERRCODE = '23514',
			CONSTRAINT = 'content_pack_entity_measurement_evidence_immutable';
END;
$$;

CREATE TRIGGER entity_measurement_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.entity_measurement
FOR EACH ROW EXECUTE FUNCTION public.guard_entity_measurement();

CREATE TRIGGER content_pack_entity_measurement_evidence_immutable
BEFORE UPDATE OR DELETE ON public.content_pack_entity_measurement_evidence
FOR EACH ROW EXECUTE FUNCTION public.reject_content_pack_entity_measurement_evidence_mutation();

CREATE TRIGGER realm_tag_judgment_content_label_reject
BEFORE INSERT OR UPDATE ON public.realm_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.reject_content_label_judgment();

-- Reinstall the final content-pack evidence owners after the destructive Structure cutover.
-- Content-pack imports are append-only provenance. Unit merges may move only
-- the evidence pointer that identifies the surviving runtime judgment; the
-- imported payload itself remains immutable.

CREATE OR REPLACE FUNCTION public.reject_content_pack_import_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION '% history is append-only', TG_TABLE_NAME
		USING ERRCODE = '23514',
			CONSTRAINT = TG_TABLE_NAME || '_immutable';
END;
$$;

CREATE OR REPLACE FUNCTION public.require_content_pack_evidence_merge_operation(
	allowed_phases public.unit_merge_operation_phase[]
)
RETURNS public.unit_merge_operation
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	operation_id_setting text := nullif(
		current_setting('rezics.unit_merge_operation_id', true),
		''
	);
	lease_token_setting text := nullif(
		current_setting('rezics.unit_merge_lease_token', true),
		''
	);
	active_operation_id uuid;
	active_lease_token uuid;
	active_operation public.unit_merge_operation%ROWTYPE;
BEGIN
	IF operation_id_setting IS NULL OR lease_token_setting IS NULL THEN
		RAISE EXCEPTION 'Content-pack evidence may move only inside a leased Unit merge'
			USING ERRCODE = '23514',
				CONSTRAINT = 'content_pack_evidence_merge_context';
	END IF;

	BEGIN
		active_operation_id := operation_id_setting::uuid;
		active_lease_token := lease_token_setting::uuid;
	EXCEPTION
		WHEN invalid_text_representation THEN
			RAISE EXCEPTION 'Content-pack evidence Unit-merge settings must be UUIDs'
				USING ERRCODE = '23514',
					CONSTRAINT = 'content_pack_evidence_merge_context';
	END;

	SELECT operation.*
	INTO active_operation
	FROM public.unit_merge_operation AS operation
	WHERE operation.id = active_operation_id
		AND operation.state = 'processing'::public.unit_merge_operation_state
		AND operation.lease_token = active_lease_token
		AND operation.lease_expires_at > clock_timestamp();

	IF NOT FOUND OR NOT (active_operation.phase = ANY(allowed_phases)) THEN
		RAISE EXCEPTION 'Content-pack evidence Unit-merge context is not active for this phase'
			USING ERRCODE = '23514',
				CONSTRAINT = 'content_pack_evidence_merge_context';
	END IF;

	RETURN active_operation;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_content_pack_unit_tag_evidence_retarget()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	active_operation public.unit_merge_operation%ROWTYPE;
BEGIN
	active_operation := public.require_content_pack_evidence_merge_operation(
		ARRAY[
			'unit_tags'::public.unit_merge_operation_phase,
			'finalize'::public.unit_merge_operation_phase
		]
	);

	IF EXISTS (
		SELECT 1
		FROM old_evidence AS old_row
		FULL JOIN new_evidence AS new_row
			USING (import_id, source_fingerprint)
		WHERE old_row.import_id IS NULL
			OR new_row.import_id IS NULL
			OR (
				to_jsonb(old_row) - 'unit_id'
			) IS DISTINCT FROM (
				to_jsonb(new_row) - 'unit_id'
			)
	) THEN
		RAISE EXCEPTION 'Content-pack UnitTag evidence payload is immutable'
			USING ERRCODE = '23514',
				CONSTRAINT = 'content_pack_unit_tag_evidence_retarget_guard';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM old_evidence AS old_row
		JOIN new_evidence AS new_row
			USING (import_id, source_fingerprint)
		WHERE old_row.unit_id <> active_operation.source_unit_id
			OR new_row.unit_id <> active_operation.target_unit_id
			OR NOT EXISTS (
				SELECT 1
				FROM public.unit_tag_judgment AS source_judgment
				WHERE source_judgment.unit_id = old_row.unit_id
					AND source_judgment.tag_id = old_row.tag_id
					AND source_judgment.profile_id = old_row.profile_id
			)
			OR NOT EXISTS (
				SELECT 1
				FROM public.unit_tag_judgment AS target_judgment
				WHERE target_judgment.unit_id = new_row.unit_id
					AND target_judgment.tag_id = new_row.tag_id
					AND target_judgment.profile_id = new_row.profile_id
			)
	) THEN
		RAISE EXCEPTION 'Content-pack UnitTag evidence retarget does not match the active Unit merge'
			USING ERRCODE = '23514',
				CONSTRAINT = 'content_pack_unit_tag_evidence_retarget_guard';
	END IF;

	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_content_pack_unit_tag_path_evidence_retarget()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	active_operation public.unit_merge_operation%ROWTYPE;
BEGIN
	active_operation := public.require_content_pack_evidence_merge_operation(
		ARRAY[
			'tag_path_applications'::public.unit_merge_operation_phase,
			'finalize'::public.unit_merge_operation_phase
		]
	);

	IF EXISTS (
		SELECT 1
		FROM old_evidence AS old_row
		FULL JOIN new_evidence AS new_row
			USING (import_id, source_fingerprint)
		WHERE old_row.import_id IS NULL
			OR new_row.import_id IS NULL
			OR (
				to_jsonb(old_row) - 'unit_id'
			) IS DISTINCT FROM (
				to_jsonb(new_row) - 'unit_id'
			)
	) THEN
		RAISE EXCEPTION 'Content-pack Unit–Tag Path evidence payload is immutable'
			USING ERRCODE = '23514',
				CONSTRAINT = 'content_pack_unit_tag_path_evidence_retarget_guard';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM old_evidence AS old_row
		JOIN new_evidence AS new_row
			USING (import_id, source_fingerprint)
		WHERE old_row.unit_id <> active_operation.source_unit_id
			OR new_row.unit_id <> active_operation.target_unit_id
			OR NOT EXISTS (
				SELECT 1
				FROM public.unit_tag_path_judgment AS source_judgment
				WHERE source_judgment.unit_id = old_row.unit_id
					AND source_judgment.path_id = old_row.path_id
					AND source_judgment.profile_id = old_row.profile_id
			)
			OR NOT EXISTS (
				SELECT 1
				FROM public.unit_tag_path_judgment AS target_judgment
				WHERE target_judgment.unit_id = new_row.unit_id
					AND target_judgment.path_id = new_row.path_id
					AND target_judgment.profile_id = new_row.profile_id
			)
	) THEN
		RAISE EXCEPTION 'Content-pack Unit–Tag Path evidence retarget does not match the active Unit merge'
			USING ERRCODE = '23514',
				CONSTRAINT = 'content_pack_unit_tag_path_evidence_retarget_guard';
	END IF;

	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_content_pack_subject_association_evidence_retarget()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	active_operation public.unit_merge_operation%ROWTYPE;
BEGIN
	active_operation := public.require_content_pack_evidence_merge_operation(
		ARRAY[
			'subject_sources'::public.unit_merge_operation_phase,
			'subject_entities'::public.unit_merge_operation_phase,
			'finalize'::public.unit_merge_operation_phase
		]
	);

	IF EXISTS (
		SELECT 1
		FROM old_evidence AS old_row
		FULL JOIN new_evidence AS new_row
			USING (import_id, source_fingerprint)
		WHERE old_row.import_id IS NULL
			OR new_row.import_id IS NULL
			OR (
				to_jsonb(old_row) - 'association_id'
			) IS DISTINCT FROM (
				to_jsonb(new_row) - 'association_id'
			)
	) THEN
		RAISE EXCEPTION 'Content-pack Subject-association evidence payload is immutable'
			USING ERRCODE = '23514',
				CONSTRAINT = 'content_pack_subject_association_evidence_retarget_guard';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM old_evidence AS old_row
		JOIN new_evidence AS new_row
			USING (import_id, source_fingerprint)
		LEFT JOIN public.subject_association AS source_association
			ON source_association.id = old_row.association_id
		LEFT JOIN public.subject_association AS target_association
			ON target_association.id = new_row.association_id
		WHERE source_association.id IS NULL
			OR target_association.id IS NULL
			OR old_row.association_id = new_row.association_id
			OR NOT (
				(
					active_operation.phase IN (
						'subject_sources'::public.unit_merge_operation_phase,
						'finalize'::public.unit_merge_operation_phase
					)
					AND source_association.unit_id = active_operation.source_unit_id
					AND target_association.unit_id = active_operation.target_unit_id
					AND source_association.entity_id = target_association.entity_id
					AND source_association.role = target_association.role
				)
				OR (
					active_operation.phase IN (
						'subject_entities'::public.unit_merge_operation_phase,
						'finalize'::public.unit_merge_operation_phase
					)
					AND source_association.entity_id = active_operation.source_unit_id
					AND target_association.entity_id = active_operation.target_unit_id
					AND source_association.unit_id = target_association.unit_id
					AND source_association.role = target_association.role
				)
			)
			OR NOT EXISTS (
				SELECT 1
				FROM public.subject_association_judgment AS source_judgment
				WHERE source_judgment.association_id = old_row.association_id
					AND source_judgment.profile_id = old_row.profile_id
			)
			OR NOT EXISTS (
				SELECT 1
				FROM public.subject_association_judgment AS target_judgment
				WHERE target_judgment.association_id = new_row.association_id
					AND target_judgment.profile_id = new_row.profile_id
			)
	) THEN
		RAISE EXCEPTION 'Content-pack Subject-association evidence retarget does not match the active Unit merge'
			USING ERRCODE = '23514',
				CONSTRAINT = 'content_pack_subject_association_evidence_retarget_guard';
	END IF;

	RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS content_pack_import_immutable
ON public.content_pack_import;
CREATE TRIGGER content_pack_import_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.content_pack_import
FOR EACH STATEMENT
EXECUTE FUNCTION public.reject_content_pack_import_evidence_mutation();

DROP TRIGGER IF EXISTS content_pack_tag_evidence_immutable
ON public.content_pack_tag_evidence;
CREATE TRIGGER content_pack_tag_evidence_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.content_pack_tag_evidence
FOR EACH STATEMENT
EXECUTE FUNCTION public.reject_content_pack_import_evidence_mutation();

DROP TRIGGER IF EXISTS content_pack_tag_path_definition_evidence_immutable
ON public.content_pack_tag_path_definition_evidence;
CREATE TRIGGER content_pack_tag_path_definition_evidence_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.content_pack_tag_path_definition_evidence
FOR EACH STATEMENT
EXECUTE FUNCTION public.reject_content_pack_import_evidence_mutation();

DROP TRIGGER IF EXISTS content_pack_unit_tag_evidence_delete_guard
ON public.content_pack_unit_tag_evidence;
CREATE TRIGGER content_pack_unit_tag_evidence_delete_guard
BEFORE DELETE OR TRUNCATE ON public.content_pack_unit_tag_evidence
FOR EACH STATEMENT
EXECUTE FUNCTION public.reject_content_pack_import_evidence_mutation();

DROP TRIGGER IF EXISTS content_pack_unit_tag_path_evidence_delete_guard
ON public.content_pack_unit_tag_path_evidence;
CREATE TRIGGER content_pack_unit_tag_path_evidence_delete_guard
BEFORE DELETE OR TRUNCATE ON public.content_pack_unit_tag_path_evidence
FOR EACH STATEMENT
EXECUTE FUNCTION public.reject_content_pack_import_evidence_mutation();

DROP TRIGGER IF EXISTS content_pack_subject_association_evidence_delete_guard
ON public.content_pack_subject_association_evidence;
CREATE TRIGGER content_pack_subject_association_evidence_delete_guard
BEFORE DELETE OR TRUNCATE ON public.content_pack_subject_association_evidence
FOR EACH STATEMENT
EXECUTE FUNCTION public.reject_content_pack_import_evidence_mutation();

DROP TRIGGER IF EXISTS content_pack_unit_tag_evidence_retarget_guard
ON public.content_pack_unit_tag_evidence;
CREATE TRIGGER content_pack_unit_tag_evidence_retarget_guard
AFTER UPDATE ON public.content_pack_unit_tag_evidence
REFERENCING OLD TABLE AS old_evidence NEW TABLE AS new_evidence
FOR EACH STATEMENT
EXECUTE FUNCTION public.guard_content_pack_unit_tag_evidence_retarget();

DROP TRIGGER IF EXISTS content_pack_unit_tag_path_evidence_retarget_guard
ON public.content_pack_unit_tag_path_evidence;
CREATE TRIGGER content_pack_unit_tag_path_evidence_retarget_guard
AFTER UPDATE ON public.content_pack_unit_tag_path_evidence
REFERENCING OLD TABLE AS old_evidence NEW TABLE AS new_evidence
FOR EACH STATEMENT
EXECUTE FUNCTION public.guard_content_pack_unit_tag_path_evidence_retarget();

DROP TRIGGER IF EXISTS content_pack_subject_association_evidence_retarget_guard
ON public.content_pack_subject_association_evidence;
CREATE TRIGGER content_pack_subject_association_evidence_retarget_guard
AFTER UPDATE ON public.content_pack_subject_association_evidence
REFERENCING OLD TABLE AS old_evidence NEW TABLE AS new_evidence
FOR EACH STATEMENT
EXECUTE FUNCTION public.guard_content_pack_subject_association_evidence_retarget();

-- Keep the final catalog expression trees identical to the typed Drizzle contract.
ALTER TABLE public.tag_path_merge
	DROP CONSTRAINT tag_path_merge_proposal_provenance_check,
	ADD CONSTRAINT tag_path_merge_proposal_provenance_check CHECK (
		((proposal_source_kind = 'human'::text) AND (proposal_provenance IS NULL))
		OR (
			(proposal_source_kind = 'assisted'::text)
			AND ((proposal_provenance ->> 'kind'::text) = 'assisted'::text)
			AND (jsonb_typeof((proposal_provenance -> 'system'::text)) = 'string'::text)
			AND (btrim((proposal_provenance ->> 'system'::text)) <> ''::text)
			AND (jsonb_typeof((proposal_provenance -> 'runId'::text)) = 'string'::text)
			AND (btrim((proposal_provenance ->> 'runId'::text)) <> ''::text)
			AND (
				(NOT (proposal_provenance ? 'model'::text))
				OR (jsonb_typeof((proposal_provenance -> 'model'::text)) = 'string'::text)
			)
			AND (
				(NOT (proposal_provenance ? 'confidence'::text))
				OR (
					(jsonb_typeof((proposal_provenance -> 'confidence'::text)) = 'number'::text)
					AND (
						(((proposal_provenance ->> 'confidence'::text))::numeric >= (0)::numeric)
						AND (((proposal_provenance ->> 'confidence'::text))::numeric <= (1)::numeric)
					)
				)
			)
		)
	);

ALTER TABLE public.realm_tag_path_vote
	DROP CONSTRAINT realm_tag_path_vote_adoption_fkey,
	ADD CONSTRAINT realm_tag_path_vote_adoption_fkey
		FOREIGN KEY (realm_id, path_id)
		REFERENCES public.realm_tag_path(realm_id, path_id)
		ON DELETE CASCADE;

-- Reinstall the final update-first Tag Path owner.
-- Immutable Tag Path definitions, bounded member projections, global judgments,
-- effective-Tag provenance, and audited manual merge governance.

CREATE OR REPLACE FUNCTION public.guard_tag_path_definition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	eligible_count integer;
	distinct_count integer;
BEGIN
	IF TG_OP <> 'INSERT' THEN
		RAISE EXCEPTION 'Tag Path definitions are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_definition_immutable';
	END IF;

	SELECT count(DISTINCT member_id), count(*)
	INTO distinct_count, eligible_count
	FROM unnest(NEW.member_tag_ids) AS member_id
	JOIN public.tag ON tag.id = member_id
	JOIN public.unit ON unit.id = member_id
	WHERE unit.kind = 'tag'
		AND unit.status = 'published'::public.unit_status
		AND unit.visibility = 'public'::public.resource_visibility
		AND unit.moderation_status = 'approved'::public.moderation_status
		AND unit.deleted_at IS NULL;

	IF eligible_count <> cardinality(NEW.member_tag_ids)
		OR distinct_count <> cardinality(NEW.member_tag_ids) THEN
		RAISE EXCEPTION 'Every Tag Path member must be a distinct active, approved, public Tag'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_member_eligibility';
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM public.unit
		WHERE id = NEW.id AND kind = 'tag_path'
	) THEN
		RAISE EXCEPTION 'Tag Path identity must reference a tag_path Unit'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_unit_kind';
	END IF;

	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.project_tag_path_definition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	INSERT INTO public.tag_path_member(path_id, ordinal, tag_id)
	SELECT NEW.id, member.ordinality - 1, member.tag_id
	FROM unnest(NEW.member_tag_ids) WITH ORDINALITY AS member(tag_id, ordinality);

	INSERT INTO public.tag_path_edge(path_id, ordinal, parent_tag_id, child_tag_id)
	SELECT NEW.id, member.ordinality - 1, NEW.member_tag_ids[member.ordinality],
		NEW.member_tag_ids[member.ordinality + 1]
	FROM generate_series(1, cardinality(NEW.member_tag_ids) - 1) AS member(ordinality);

	INSERT INTO public.tag_path_vote_stat(path_id, terminal_tag_id)
	VALUES (NEW.id, NEW.terminal_tag_id);
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_path_vote_stat_projection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF pg_trigger_depth() < 2 THEN
		RAISE EXCEPTION 'tag_path_vote_stat is a trigger-owned Tag Path ranking projection'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_vote_stat_projection_only';
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_path_projection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF pg_trigger_depth() < 2 THEN
		RAISE EXCEPTION '% is a rebuildable Tag Path projection', TG_TABLE_NAME
			USING ERRCODE = '23514', CONSTRAINT = TG_TABLE_NAME || '_projection_only';
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_path_member_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		IF OLD.kind = 'tag' AND EXISTS (
			SELECT 1 FROM public.tag_path_member WHERE tag_id = OLD.id LIMIT 1
		) THEN
			RAISE EXCEPTION 'A Tag used by a Tag Path cannot be deleted'
				USING ERRCODE = '23514', CONSTRAINT = 'tag_path_member_lifecycle';
		END IF;
		RETURN OLD;
	END IF;
	IF OLD.kind = 'tag' AND EXISTS (
		SELECT 1 FROM public.tag_path_member WHERE tag_id = OLD.id LIMIT 1
	) AND (
		NEW.kind <> 'tag'
		OR NEW.status <> 'published'::public.unit_status
		OR NEW.visibility <> 'public'::public.resource_visibility
		OR NEW.moderation_status <> 'approved'::public.moderation_status
		OR NEW.deleted_at IS NOT NULL
	) THEN
		RAISE EXCEPTION 'A Tag used by a Tag Path must remain active, approved, and public'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_member_lifecycle';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_tag_path_vote_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.path_id ELSE NEW.path_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key('tag_path_vote:' || key_id::text, 0);
	IF TG_OP <> 'INSERT' THEN
		score_delta := score_delta - OLD.value;
		count_delta := count_delta - 1;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		score_delta := score_delta + NEW.value;
		count_delta := count_delta + 1;
	END IF;
	UPDATE public.tag_path_vote_stat
	SET score = score + score_delta,
		vote_count = vote_count + count_delta,
		updated_at = clock_timestamp()
	WHERE path_id = key_id;
	IF NOT FOUND THEN
		INSERT INTO public.tag_path_vote_stat(
			path_id, terminal_tag_id, score, vote_count, updated_at
		)
		SELECT key_id, path.terminal_tag_id, score_delta, count_delta, clock_timestamp()
		FROM public.tag_path AS path
		WHERE path.id = key_id;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_tag_path_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_path uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.path_id ELSE NEW.path_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
	spoiler_delta bigint := 0;
	none_delta bigint := 0;
	minor_delta bigint := 0;
	major_delta bigint := 0;
	old_accepted boolean;
	new_accepted boolean;
	current_score bigint;
	current_count bigint;
BEGIN
	PERFORM public.lock_vote_hot_key('unit_tag_path:' || key_unit::text || ':' || key_path::text, 0);
	SELECT score > 0 AND vote_count > 0, score, vote_count
	INTO old_accepted, current_score, current_count
	FROM public.unit_tag_path_judgment_stat
	WHERE unit_id = key_unit AND path_id = key_path;
	old_accepted := coalesce(old_accepted, false);
	current_score := coalesce(current_score, 0);
	current_count := coalesce(current_count, 0);

	IF TG_OP <> 'INSERT' THEN
		IF OLD.fit_vote IS NOT NULL THEN score_delta := score_delta - OLD.fit_vote; count_delta := count_delta - 1; END IF;
		IF OLD.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta - 1;
			IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
			ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
			ELSE major_delta := major_delta - 1; END IF;
		END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		IF NEW.fit_vote IS NOT NULL THEN score_delta := score_delta + NEW.fit_vote; count_delta := count_delta + 1; END IF;
		IF NEW.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta + 1;
			IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
			ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
			ELSE major_delta := major_delta + 1; END IF;
		END IF;
	END IF;

	UPDATE public.unit_tag_path_judgment_stat
	SET score = score + score_delta,
		vote_count = vote_count + count_delta,
		spoiler_vote_count = spoiler_vote_count + spoiler_delta,
		spoiler_none_count = spoiler_none_count + none_delta,
		spoiler_minor_count = spoiler_minor_count + minor_delta,
		spoiler_major_count = spoiler_major_count + major_delta,
		updated_at = clock_timestamp()
	WHERE unit_id = key_unit AND path_id = key_path;
	IF NOT FOUND THEN
		INSERT INTO public.unit_tag_path_judgment_stat(
			unit_id, path_id, score, vote_count, spoiler_vote_count,
			spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at
		) VALUES (
			key_unit, key_path, score_delta, count_delta, spoiler_delta,
			none_delta, minor_delta, major_delta, clock_timestamp()
		);
	END IF;

	new_accepted := current_score + score_delta > 0 AND current_count + count_delta > 0;
	IF old_accepted <> new_accepted THEN
		UPDATE public.tag_path_vote_stat
		SET usage_count = usage_count + CASE WHEN new_accepted THEN 1 ELSE -1 END,
			updated_at = clock_timestamp()
		WHERE path_id = key_path;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_tag_path_support()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	old_unit uuid := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.unit_id END;
	old_path uuid := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.path_id END;
	old_profile uuid := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.profile_id END;
BEGIN
	IF TG_OP <> 'INSERT' THEN
		DELETE FROM public.unit_tag_path_support
		WHERE unit_id = old_unit AND path_id = old_path AND profile_id = old_profile;
	END IF;
	IF TG_OP <> 'DELETE' AND NEW.fit_vote = 1 THEN
		INSERT INTO public.unit_tag_path_support(unit_id, tag_id, profile_id, path_id)
		SELECT NEW.unit_id, member.tag_id, NEW.profile_id, NEW.path_id
		FROM public.tag_path_member AS member
		WHERE member.path_id = NEW.path_id
		ON CONFLICT DO NOTHING;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_effective_tag_from_path_support()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_tag uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	support_count bigint;
	direct_exists boolean;
BEGIN
	PERFORM public.lock_vote_hot_key('unit_effective_tag:' || key_unit::text || ':' || key_tag::text, 0);
	SELECT count(*) INTO support_count FROM public.unit_tag_path_support
	WHERE unit_id = key_unit AND tag_id = key_tag;
	SELECT EXISTS(SELECT 1 FROM public.unit_tag WHERE unit_id = key_unit AND tag_id = key_tag)
	INTO direct_exists;
	IF direct_exists OR support_count > 0 THEN
		INSERT INTO public.unit_effective_tag(unit_id, tag_id, direct, path_support_count, updated_at)
		VALUES (key_unit, key_tag, direct_exists, support_count, clock_timestamp())
		ON CONFLICT (unit_id, tag_id) DO UPDATE SET
			direct = EXCLUDED.direct,
			path_support_count = EXCLUDED.path_support_count,
			updated_at = EXCLUDED.updated_at;
	ELSE
		DELETE FROM public.unit_effective_tag WHERE unit_id = key_unit AND tag_id = key_tag;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_unit_tag_path_judgment_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF (OLD.unit_id, OLD.path_id, OLD.profile_id) IS DISTINCT FROM
		(NEW.unit_id, NEW.path_id, NEW.profile_id) THEN
		RAISE EXCEPTION 'Unit–Tag Path judgment identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'unit_tag_path_judgment_identity_immutable';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_path_merge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Tag Path merge history is append-only'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_merge_append_only';
	END IF;
	IF TG_OP = 'UPDATE' THEN
		IF (OLD.source_path_id, OLD.target_path_id, OLD.reason, OLD.proposal_source_kind,
				OLD.proposal_provenance, OLD.proposed_by_profile_id, OLD.created_at)
			IS DISTINCT FROM
			(NEW.source_path_id, NEW.target_path_id, NEW.reason, NEW.proposal_source_kind,
				NEW.proposal_provenance, NEW.proposed_by_profile_id, NEW.created_at)
			OR NOT ((OLD.status = 'proposed' AND NEW.status IN ('accepted', 'rejected'))
				OR (OLD.status = 'accepted' AND NEW.status = 'reversed')) THEN
			RAISE EXCEPTION 'Invalid Tag Path merge transition'
				USING ERRCODE = '23514', CONSTRAINT = 'tag_path_merge_transition';
		END IF;
	END IF;
	IF NEW.status = 'accepted' AND EXISTS (
		WITH RECURSIVE chain(path_id, depth) AS (
			SELECT NEW.target_path_id, 0
			UNION ALL
			SELECT merge.target_path_id, chain.depth + 1
			FROM chain JOIN public.tag_path_merge AS merge
				ON merge.source_path_id = chain.path_id AND merge.status = 'accepted'
			WHERE chain.depth < 64
		)
		SELECT 1 FROM chain WHERE path_id = NEW.source_path_id OR depth = 64
	) THEN
		RAISE EXCEPTION 'Tag Path merges cannot form a cycle or unbounded chain'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_merge_acyclic';
	END IF;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tag_path_definition_guard ON public.tag_path;
CREATE TRIGGER tag_path_definition_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_definition();

DROP TRIGGER IF EXISTS tag_path_definition_project ON public.tag_path;
CREATE TRIGGER tag_path_definition_project
AFTER INSERT ON public.tag_path
FOR EACH ROW EXECUTE FUNCTION public.project_tag_path_definition();

DROP TRIGGER IF EXISTS tag_path_member_projection_guard ON public.tag_path_member;
CREATE TRIGGER tag_path_member_projection_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path_member
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_projection();

DROP TRIGGER IF EXISTS tag_path_edge_projection_guard ON public.tag_path_edge;
CREATE TRIGGER tag_path_edge_projection_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path_edge
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_projection();

DROP TRIGGER IF EXISTS tag_path_member_unit_lifecycle_guard ON public.unit;
CREATE TRIGGER tag_path_member_unit_lifecycle_guard
BEFORE UPDATE OR DELETE ON public.unit
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_member_lifecycle();

DROP TRIGGER IF EXISTS tag_path_vote_stat_maintain ON public.tag_path_vote;
CREATE TRIGGER tag_path_vote_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.tag_path_vote
FOR EACH ROW EXECUTE FUNCTION public.maintain_tag_path_vote_stat();

DROP TRIGGER IF EXISTS tag_path_vote_stat_projection_guard ON public.tag_path_vote_stat;
CREATE TRIGGER tag_path_vote_stat_projection_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path_vote_stat
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_vote_stat_projection();

DROP TRIGGER IF EXISTS unit_tag_path_judgment_identity_guard ON public.unit_tag_path_judgment;
CREATE TRIGGER unit_tag_path_judgment_identity_guard
BEFORE UPDATE ON public.unit_tag_path_judgment
FOR EACH ROW EXECUTE FUNCTION public.protect_unit_tag_path_judgment_identity();

DROP TRIGGER IF EXISTS unit_tag_path_judgment_stat_maintain ON public.unit_tag_path_judgment;
CREATE TRIGGER unit_tag_path_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.unit_tag_path_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_tag_path_judgment_stat();

DROP TRIGGER IF EXISTS unit_tag_path_support_maintain ON public.unit_tag_path_judgment;
CREATE TRIGGER unit_tag_path_support_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.unit_tag_path_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_tag_path_support();

DROP TRIGGER IF EXISTS unit_tag_path_support_effective_maintain ON public.unit_tag_path_support;
CREATE TRIGGER unit_tag_path_support_effective_maintain
AFTER INSERT OR DELETE ON public.unit_tag_path_support
FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_effective_tag_from_path_support();

DROP TRIGGER IF EXISTS tag_path_merge_guard ON public.tag_path_merge;
CREATE TRIGGER tag_path_merge_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path_merge
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_merge();

-- End canonical tag-path owner.

-- Reinstall the final update-first Tag judgment aggregate owner.
-- Global direct/effective Tag judgments and subject-association spoiler totals.
-- All mutations lock and update one indexed fact key; no corpus-wide refresh is used.

CREATE OR REPLACE FUNCTION public.lock_vote_hot_keys(
	target_unit_ids uuid[],
	target_tag_ids uuid[],
	target_profile_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
	hot_key record;
BEGIN
	IF target_unit_ids IS NULL OR target_tag_ids IS NULL OR target_profile_ids IS NULL
		OR cardinality(target_unit_ids) > 1024
		OR cardinality(target_unit_ids) <> cardinality(target_tag_ids)
		OR cardinality(target_unit_ids) <> cardinality(target_profile_ids)
		OR EXISTS (
			SELECT 1 FROM unnest(target_unit_ids, target_tag_ids) AS key(unit_id, tag_id)
			WHERE key.unit_id IS NULL OR key.tag_id IS NULL
		) THEN
		RAISE EXCEPTION 'Vote hot-key arrays must contain at most 1024 aligned, non-null Unit/Tag keys'
			USING ERRCODE = '22023', CONSTRAINT = 'vote_hot_key_batch_invalid';
	END IF;
	FOR hot_key IN
		SELECT DISTINCT key.unit_id, key.tag_id
		FROM unnest(target_unit_ids, target_tag_ids) AS key(unit_id, tag_id)
		ORDER BY key.unit_id, key.tag_id
	LOOP
		IF NOT pg_try_advisory_xact_lock(hashtextextended(hot_key.unit_id::text || ':' || hot_key.tag_id::text, 71001)) THEN
			RAISE EXCEPTION 'Vote aggregate key is busy'
				USING ERRCODE = '55P03', CONSTRAINT = 'vote_hot_key_busy';
		END IF;
	END LOOP;
	FOR hot_key IN
		SELECT DISTINCT key.unit_id, key.tag_id, key.profile_id
		FROM unnest(target_unit_ids, target_tag_ids, target_profile_ids)
			AS key(unit_id, tag_id, profile_id)
		WHERE key.profile_id IS NOT NULL
		ORDER BY key.unit_id, key.tag_id, key.profile_id
	LOOP
		IF NOT pg_try_advisory_xact_lock(hashtextextended(
			hot_key.unit_id::text || ':' || hot_key.tag_id::text || ':' || hot_key.profile_id::text, 71002
		)) THEN
			RAISE EXCEPTION 'Per-Profile vote key is busy'
				USING ERRCODE = '55P03', CONSTRAINT = 'vote_hot_key_busy';
		END IF;
	END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_effective_tag_context(
	key_unit uuid,
	key_tag uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	direct_exists boolean;
	support_count bigint;
BEGIN
	PERFORM public.lock_vote_hot_key('unit_effective_tag:' || key_unit::text || ':' || key_tag::text, 0);
	SELECT EXISTS(SELECT 1 FROM public.unit_tag WHERE unit_id = key_unit AND tag_id = key_tag)
	INTO direct_exists;
	SELECT count(*) FROM public.unit_tag_path_support
	WHERE unit_id = key_unit AND tag_id = key_tag INTO support_count;
	IF direct_exists OR support_count > 0 THEN
		INSERT INTO public.unit_effective_tag(unit_id, tag_id, direct, path_support_count, updated_at)
		VALUES (key_unit, key_tag, direct_exists, support_count, clock_timestamp())
		ON CONFLICT (unit_id, tag_id) DO UPDATE SET
			direct = EXCLUDED.direct,
			path_support_count = EXCLUDED.path_support_count,
			updated_at = EXCLUDED.updated_at;
	ELSE
		DELETE FROM public.unit_effective_tag WHERE unit_id = key_unit AND tag_id = key_tag;
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_effective_tag_from_direct()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	PERFORM public.refresh_unit_effective_tag_context(
		CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END,
		CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END
	);
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_effective_tag_vote(
	target_unit_id uuid,
	target_tag_id uuid,
	target_profile_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	effective_value integer;
BEGIN
	PERFORM public.lock_vote_hot_key(
		'unit_effective_tag_vote:' || target_unit_id::text || ':' || target_tag_id::text || ':' || target_profile_id::text,
		0
	);
	SELECT judgment.fit_vote INTO effective_value
	FROM public.unit_tag_judgment AS judgment
	WHERE judgment.unit_id = target_unit_id AND judgment.tag_id = target_tag_id
		AND judgment.profile_id = target_profile_id AND judgment.fit_vote IS NOT NULL;
	IF effective_value IS NULL AND EXISTS (
		SELECT 1 FROM public.unit_tag_path_support
		WHERE unit_id = target_unit_id AND tag_id = target_tag_id AND profile_id = target_profile_id
	) THEN
		effective_value := 1;
	END IF;
	IF effective_value IS NULL THEN
		DELETE FROM public.unit_effective_tag_vote
		WHERE unit_id = target_unit_id AND tag_id = target_tag_id AND profile_id = target_profile_id;
	ELSE
		INSERT INTO public.unit_effective_tag_vote(unit_id, tag_id, profile_id, value, updated_at)
		VALUES (target_unit_id, target_tag_id, target_profile_id, effective_value, clock_timestamp())
		ON CONFLICT (unit_id, tag_id, profile_id) DO UPDATE SET
			value = EXCLUDED.value, updated_at = EXCLUDED.updated_at;
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_effective_tag_vote_from_direct()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	PERFORM public.refresh_unit_effective_tag_vote(
		CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END,
		CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END,
		CASE WHEN TG_OP = 'DELETE' THEN OLD.profile_id ELSE NEW.profile_id END
	);
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_effective_tag_vote_from_path()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	PERFORM public.refresh_unit_effective_tag_vote(
		CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END,
		CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END,
		CASE WHEN TG_OP = 'DELETE' THEN OLD.profile_id ELSE NEW.profile_id END
	);
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_tag_fit_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_tag uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key('unit_tag_stat:' || key_unit::text || ':' || key_tag::text, 0);
	IF TG_OP <> 'INSERT' THEN score_delta := score_delta - OLD.value; count_delta := count_delta - 1; END IF;
	IF TG_OP <> 'DELETE' THEN score_delta := score_delta + NEW.value; count_delta := count_delta + 1; END IF;
	UPDATE public.unit_tag_judgment_stat
	SET score = score + score_delta,
		vote_count = vote_count + count_delta,
		updated_at = clock_timestamp()
	WHERE unit_id = key_unit AND tag_id = key_tag;
	IF NOT FOUND THEN
		INSERT INTO public.unit_tag_judgment_stat(unit_id, tag_id, score, vote_count, updated_at)
		VALUES (key_unit, key_tag, score_delta, count_delta, clock_timestamp());
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_tag_spoiler_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_tag uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	count_delta bigint := 0;
	none_delta bigint := 0;
	minor_delta bigint := 0;
	major_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key('unit_tag_stat:' || key_unit::text || ':' || key_tag::text, 0);
	IF TG_OP <> 'INSERT' AND OLD.spoiler_level IS NOT NULL THEN
		count_delta := count_delta - 1;
		IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
		ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
		ELSE major_delta := major_delta - 1; END IF;
	END IF;
	IF TG_OP <> 'DELETE' AND NEW.spoiler_level IS NOT NULL THEN
		count_delta := count_delta + 1;
		IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
		ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
		ELSE major_delta := major_delta + 1; END IF;
	END IF;
	UPDATE public.unit_tag_judgment_stat
	SET spoiler_vote_count = spoiler_vote_count + count_delta,
		spoiler_none_count = spoiler_none_count + none_delta,
		spoiler_minor_count = spoiler_minor_count + minor_delta,
		spoiler_major_count = spoiler_major_count + major_delta,
		updated_at = clock_timestamp()
	WHERE unit_id = key_unit AND tag_id = key_tag;
	IF NOT FOUND THEN
		INSERT INTO public.unit_tag_judgment_stat(
			unit_id, tag_id, spoiler_vote_count, spoiler_none_count,
			spoiler_minor_count, spoiler_major_count, updated_at
		) VALUES (
			key_unit, key_tag, count_delta, none_delta, minor_delta, major_delta, clock_timestamp()
		);
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_subject_association_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.association_id ELSE NEW.association_id END;
	count_delta bigint := 0;
	none_delta bigint := 0;
	minor_delta bigint := 0;
	major_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key('subject_spoiler:' || key_id::text, 0);
	IF TG_OP <> 'INSERT' THEN
		count_delta := count_delta - 1;
		IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
		ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
		ELSE major_delta := major_delta - 1; END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		count_delta := count_delta + 1;
		IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
		ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
		ELSE major_delta := major_delta + 1; END IF;
	END IF;
	UPDATE public.subject_association_judgment_stat
	SET spoiler_vote_count = spoiler_vote_count + count_delta,
		spoiler_none_count = spoiler_none_count + none_delta,
		spoiler_minor_count = spoiler_minor_count + minor_delta,
		spoiler_major_count = spoiler_major_count + major_delta,
		updated_at = clock_timestamp()
	WHERE association_id = key_id;
	IF NOT FOUND THEN
		INSERT INTO public.subject_association_judgment_stat(
			association_id, spoiler_vote_count, spoiler_none_count,
			spoiler_minor_count, spoiler_major_count, updated_at
		) VALUES (key_id, count_delta, none_delta, minor_delta, major_delta, clock_timestamp());
	END IF;
	RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS unit_tag_effective_context_maintain ON public.unit_tag;
CREATE TRIGGER unit_tag_effective_context_maintain
AFTER INSERT OR DELETE ON public.unit_tag
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_effective_tag_from_direct();

DROP TRIGGER IF EXISTS unit_tag_judgment_effective_vote_maintain ON public.unit_tag_judgment;
CREATE TRIGGER unit_tag_judgment_effective_vote_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.unit_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_effective_tag_vote_from_direct();

DROP TRIGGER IF EXISTS unit_tag_path_support_effective_vote_maintain ON public.unit_tag_path_support;
CREATE TRIGGER unit_tag_path_support_effective_vote_maintain
AFTER INSERT OR DELETE ON public.unit_tag_path_support
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_effective_tag_vote_from_path();

DROP TRIGGER IF EXISTS unit_effective_tag_vote_fit_stat_maintain ON public.unit_effective_tag_vote;
CREATE TRIGGER unit_effective_tag_vote_fit_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.unit_effective_tag_vote
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_tag_fit_stat();

DROP TRIGGER IF EXISTS unit_tag_judgment_spoiler_stat_maintain ON public.unit_tag_judgment;
CREATE TRIGGER unit_tag_judgment_spoiler_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.unit_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_tag_spoiler_stat();

DROP TRIGGER IF EXISTS subject_association_judgment_stat_maintain ON public.subject_association_judgment;
CREATE TRIGGER subject_association_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.subject_association_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_subject_association_judgment_stat();

-- End canonical tag-judgment aggregate owner.

-- Reinstall the final update-first Realm Tag authority owner.
-- Realm-local Tag and Tag Path authority. Global and Realm votes remain separate;
-- fallback policy is resolved by readers and never merges aggregate populations.

CREATE OR REPLACE FUNCTION public.lock_vote_hot_key(lock_key text, lock_seed bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
	IF lock_key IS NULL OR lock_seed IS NULL THEN
		RAISE EXCEPTION 'Vote hot key must be non-null'
			USING ERRCODE = '22023', CONSTRAINT = 'vote_hot_key_invalid';
	END IF;
	IF NOT pg_try_advisory_xact_lock(hashtextextended(lock_key, lock_seed)) THEN
		RAISE EXCEPTION 'Vote aggregate key is busy'
			USING ERRCODE = '55P03', CONSTRAINT = 'vote_hot_key_busy';
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_realm_tag_path_vote_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_realm uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.realm_id ELSE NEW.realm_id END;
	key_path uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.path_id ELSE NEW.path_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key('realm_tag_path_vote:' || key_realm::text || ':' || key_path::text, 0);
	IF TG_OP <> 'INSERT' THEN score_delta := score_delta - OLD.value; count_delta := count_delta - 1; END IF;
	IF TG_OP <> 'DELETE' THEN score_delta := score_delta + NEW.value; count_delta := count_delta + 1; END IF;
	UPDATE public.realm_tag_path_vote_stat
	SET score = score + score_delta,
		vote_count = vote_count + count_delta,
		updated_at = clock_timestamp()
	WHERE realm_id = key_realm AND path_id = key_path;
	IF NOT FOUND THEN
		INSERT INTO public.realm_tag_path_vote_stat(realm_id, path_id, score, vote_count, updated_at)
		VALUES (key_realm, key_path, score_delta, count_delta, clock_timestamp());
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_realm_unit_tag_path_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_realm uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.realm_id ELSE NEW.realm_id END;
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_path uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.path_id ELSE NEW.path_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
	spoiler_delta bigint := 0;
	none_delta bigint := 0;
	minor_delta bigint := 0;
	major_delta bigint := 0;
	old_accepted boolean;
	current_score bigint;
	current_count bigint;
	new_accepted boolean;
BEGIN
	PERFORM public.lock_vote_hot_key('realm_unit_tag_path:' || key_realm::text || ':' || key_unit::text || ':' || key_path::text, 0);
	SELECT score > 0 AND vote_count > 0, score, vote_count
	INTO old_accepted, current_score, current_count
	FROM public.realm_unit_tag_path_judgment_stat
	WHERE realm_id = key_realm AND unit_id = key_unit AND path_id = key_path;
	old_accepted := coalesce(old_accepted, false);
	current_score := coalesce(current_score, 0);
	current_count := coalesce(current_count, 0);
	IF TG_OP <> 'INSERT' THEN
		IF OLD.fit_vote IS NOT NULL THEN score_delta := score_delta - OLD.fit_vote; count_delta := count_delta - 1; END IF;
		IF OLD.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta - 1;
			IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
			ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
			ELSE major_delta := major_delta - 1; END IF;
		END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		IF NEW.fit_vote IS NOT NULL THEN score_delta := score_delta + NEW.fit_vote; count_delta := count_delta + 1; END IF;
		IF NEW.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta + 1;
			IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
			ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
			ELSE major_delta := major_delta + 1; END IF;
		END IF;
	END IF;
	UPDATE public.realm_unit_tag_path_judgment_stat
	SET score = score + score_delta,
		vote_count = vote_count + count_delta,
		spoiler_vote_count = spoiler_vote_count + spoiler_delta,
		spoiler_none_count = spoiler_none_count + none_delta,
		spoiler_minor_count = spoiler_minor_count + minor_delta,
		spoiler_major_count = spoiler_major_count + major_delta,
		updated_at = clock_timestamp()
	WHERE realm_id = key_realm AND unit_id = key_unit AND path_id = key_path;
	IF NOT FOUND THEN
		INSERT INTO public.realm_unit_tag_path_judgment_stat(
			realm_id, unit_id, path_id, score, vote_count, spoiler_vote_count,
			spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at
		) VALUES (
			key_realm, key_unit, key_path, score_delta, count_delta, spoiler_delta,
			none_delta, minor_delta, major_delta, clock_timestamp()
		);
	END IF;
	new_accepted := current_score + score_delta > 0 AND current_count + count_delta > 0;
	IF old_accepted <> new_accepted THEN
		UPDATE public.realm_tag_path_vote_stat
		SET usage_count = usage_count + CASE WHEN new_accepted THEN 1 ELSE -1 END,
			updated_at = clock_timestamp()
		WHERE realm_id = key_realm AND path_id = key_path;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_realm_unit_tag_path_support()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP <> 'INSERT' THEN
		DELETE FROM public.realm_unit_tag_path_support
		WHERE realm_id = OLD.realm_id AND unit_id = OLD.unit_id
			AND path_id = OLD.path_id AND profile_id = OLD.profile_id;
	END IF;
	IF TG_OP <> 'DELETE' AND NEW.fit_vote = 1 THEN
		INSERT INTO public.realm_unit_tag_path_support(realm_id, unit_id, tag_id, profile_id, path_id)
		SELECT NEW.realm_id, NEW.unit_id, member.tag_id, NEW.profile_id, NEW.path_id
		FROM public.tag_path_member AS member WHERE member.path_id = NEW.path_id
		ON CONFLICT DO NOTHING;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_realm_unit_effective_tag()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_realm uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.realm_id ELSE NEW.realm_id END;
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_tag uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	direct_exists boolean;
	support_count bigint;
BEGIN
	PERFORM public.lock_vote_hot_key('realm_effective_tag:' || key_realm::text || ':' || key_unit::text || ':' || key_tag::text, 0);
	SELECT EXISTS(SELECT 1 FROM public.realm_unit_tag
		WHERE realm_id = key_realm AND unit_id = key_unit AND tag_id = key_tag)
	INTO direct_exists;
	SELECT count(*) FROM public.realm_unit_tag_path_support
	WHERE realm_id = key_realm AND unit_id = key_unit AND tag_id = key_tag
	INTO support_count;
	IF direct_exists OR support_count > 0 THEN
		INSERT INTO public.realm_unit_effective_tag(realm_id, unit_id, tag_id, direct, path_support_count, updated_at)
		VALUES (key_realm, key_unit, key_tag, direct_exists, support_count, clock_timestamp())
		ON CONFLICT (realm_id, unit_id, tag_id) DO UPDATE SET
			direct = EXCLUDED.direct, path_support_count = EXCLUDED.path_support_count,
			updated_at = EXCLUDED.updated_at;
	ELSE
		DELETE FROM public.realm_unit_effective_tag
		WHERE realm_id = key_realm AND unit_id = key_unit AND tag_id = key_tag;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_realm_tag_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_realm uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.realm_id ELSE NEW.realm_id END;
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_tag uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	score_delta bigint := 0; count_delta bigint := 0; spoiler_delta bigint := 0;
	none_delta bigint := 0; minor_delta bigint := 0; major_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key('realm_tag_stat:' || key_realm::text || ':' || key_unit::text || ':' || key_tag::text, 0);
	IF TG_OP <> 'INSERT' THEN
		IF OLD.fit_vote IS NOT NULL THEN score_delta := score_delta - OLD.fit_vote; count_delta := count_delta - 1; END IF;
		IF OLD.spoiler_level IS NOT NULL THEN spoiler_delta := spoiler_delta - 1;
			IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
			ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
			ELSE major_delta := major_delta - 1; END IF; END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		IF NEW.fit_vote IS NOT NULL THEN score_delta := score_delta + NEW.fit_vote; count_delta := count_delta + 1; END IF;
		IF NEW.spoiler_level IS NOT NULL THEN spoiler_delta := spoiler_delta + 1;
			IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
			ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
			ELSE major_delta := major_delta + 1; END IF; END IF;
	END IF;
	UPDATE public.realm_tag_judgment_stat
	SET score = score + score_delta,
		vote_count = vote_count + count_delta,
		spoiler_vote_count = spoiler_vote_count + spoiler_delta,
		spoiler_none_count = spoiler_none_count + none_delta,
		spoiler_minor_count = spoiler_minor_count + minor_delta,
		spoiler_major_count = spoiler_major_count + major_delta,
		updated_at = clock_timestamp()
	WHERE realm_id = key_realm AND unit_id = key_unit AND tag_id = key_tag;
	IF NOT FOUND THEN
		INSERT INTO public.realm_tag_judgment_stat(
			realm_id, unit_id, tag_id, score, vote_count, spoiler_vote_count,
			spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at
		) VALUES (
			key_realm, key_unit, key_tag, score_delta, count_delta, spoiler_delta,
			none_delta, minor_delta, major_delta, clock_timestamp()
		);
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_realm_tag_path_judgment_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF (OLD.realm_id, OLD.unit_id, OLD.path_id, OLD.profile_id) IS DISTINCT FROM
		(NEW.realm_id, NEW.unit_id, NEW.path_id, NEW.profile_id) THEN
		RAISE EXCEPTION 'Realm Unit–Tag Path judgment identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'realm_unit_tag_path_judgment_identity_immutable';
	END IF;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS realm_tag_path_vote_stat_maintain ON public.realm_tag_path_vote;
CREATE TRIGGER realm_tag_path_vote_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.realm_tag_path_vote
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_tag_path_vote_stat();

DROP TRIGGER IF EXISTS realm_unit_tag_path_judgment_identity_guard ON public.realm_unit_tag_path_judgment;
CREATE TRIGGER realm_unit_tag_path_judgment_identity_guard
BEFORE UPDATE ON public.realm_unit_tag_path_judgment
FOR EACH ROW EXECUTE FUNCTION public.protect_realm_tag_path_judgment_identity();

DROP TRIGGER IF EXISTS realm_unit_tag_path_judgment_stat_maintain ON public.realm_unit_tag_path_judgment;
CREATE TRIGGER realm_unit_tag_path_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.realm_unit_tag_path_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_unit_tag_path_judgment_stat();

DROP TRIGGER IF EXISTS realm_unit_tag_path_support_maintain ON public.realm_unit_tag_path_judgment;
CREATE TRIGGER realm_unit_tag_path_support_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.realm_unit_tag_path_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_unit_tag_path_support();

DROP TRIGGER IF EXISTS realm_unit_tag_path_support_effective_maintain ON public.realm_unit_tag_path_support;
CREATE TRIGGER realm_unit_tag_path_support_effective_maintain
AFTER INSERT OR DELETE ON public.realm_unit_tag_path_support
FOR EACH ROW EXECUTE FUNCTION public.refresh_realm_unit_effective_tag();

DROP TRIGGER IF EXISTS realm_unit_tag_effective_maintain ON public.realm_unit_tag;
CREATE TRIGGER realm_unit_tag_effective_maintain
AFTER INSERT OR DELETE ON public.realm_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.refresh_realm_unit_effective_tag();

DROP TRIGGER IF EXISTS realm_tag_judgment_stat_maintain ON public.realm_tag_judgment;
CREATE TRIGGER realm_tag_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.realm_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_tag_judgment_stat();

-- End canonical Realm Tag authority owner.
