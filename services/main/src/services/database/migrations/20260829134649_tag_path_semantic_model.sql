SET search_path TO public;

-- This release replaces an unused preview. Fail closed if production contains
-- any retired fact instead of silently deleting or guessing its semantics.
-- Every EXISTS stops at its first row, so the preflight stays bounded.
DO $cutover$
BEGIN
	IF EXISTS (SELECT 1 FROM public.unit_structure)
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
		OR EXISTS (SELECT 1 FROM public.unit_effective_tag_vote)
		OR EXISTS (
			SELECT 1 FROM public.unit_effective_tag
			WHERE NOT direct OR structure_support_count <> 0
		)
		OR EXISTS (SELECT 1 FROM public.unit WHERE kind IN ('structure', 'tag_path'))
	THEN
		RAISE EXCEPTION 'Tag Path cutover rejected: retired Structure, Path, or Tag-vote data exists';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM public.unit_merge_operation
		WHERE phase::text IN (
			'realm_tag_votes',
			'structure_members',
			'structure_edges_parent',
			'structure_edges_child',
			'structure_applications'
		)
	) THEN
		RAISE EXCEPTION 'Tag Path cutover rejected: a Unit merge uses a retired phase';
	END IF;
END;
$cutover$;

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

-- The released effective-vote projection is empty by the assertion above.
DROP TABLE public.unit_effective_tag_vote;

-- Existing Tags become concept vocabulary nodes before the new composite
-- foreign key is installed. Guide nodes deliberately have no Unit identity.
CREATE TABLE public.vocabulary_node (
	id uuid PRIMARY KEY DEFAULT uuidv7(),
	kind text NOT NULL,
	status text NOT NULL DEFAULT 'active',
	created_by_profile_id uuid,
	created_at timestamptz(3) NOT NULL DEFAULT now(),
	retired_at timestamptz(3)
);

INSERT INTO public.vocabulary_node(id, kind, status, created_at)
SELECT tag.id, 'concept', 'active', tag.created_at
FROM public.tag AS tag;

ALTER TABLE public.tag
	ADD COLUMN node_kind text NOT NULL DEFAULT 'concept';

-- Remove obsolete preview/effective-fan-out routines. Canonical SQL later in
-- this migration installs only the semantic-model routines.
DROP FUNCTION IF EXISTS public.guard_tag_path_member_lifecycle() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_realm_unit_tag_path_judgment_stat() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_realm_unit_tag_path_support() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_unit_effective_tag_from_direct() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_unit_effective_tag_vote_from_direct() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_unit_effective_tag_vote_from_path() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_unit_tag_fit_stat() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_unit_tag_path_judgment_stat() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_unit_tag_path_support() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_unit_tag_spoiler_stat() CASCADE;
DROP FUNCTION IF EXISTS public.protect_realm_tag_path_judgment_identity() CASCADE;
DROP FUNCTION IF EXISTS public.protect_unit_tag_path_judgment_identity() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_realm_unit_effective_tag() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_unit_effective_tag_context(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.refresh_unit_effective_tag_from_path_support() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_unit_effective_tag_vote(uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.lock_unit_effective_tag_key(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.lock_unit_effective_tag_vote_key(uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.maintain_effective_tag_from_direct_context() CASCADE;
DROP FUNCTION IF EXISTS public.maintain_effective_tag_from_direct_vote() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_unit_effective_tag(uuid, uuid) CASCADE;

-- Create enum type "realm_tag_fallback_policy"
CREATE TYPE "realm_tag_fallback_policy" AS ENUM ('inherit', 'isolate');
-- Modify "profile_preference" table
ALTER TABLE "profile_preference" ADD COLUMN "always_show_spoilers" boolean NOT NULL DEFAULT false, ADD COLUMN "always_show_nsfw" boolean NOT NULL DEFAULT false;
-- Create index "realm_unit_tag_tag_route_idx" to table: "realm_unit_tag"
CREATE INDEX "realm_unit_tag_tag_route_idx" ON "realm_unit_tag" ("tag_id", "realm_id", "unit_id");
-- Modify "unit" table
ALTER TABLE "unit" DROP CONSTRAINT "unit_kind_check", ADD CONSTRAINT "unit_kind_check" CHECK (kind = ANY (ARRAY['slug_namespace'::text, 'profile'::text, 'book'::text, 'software'::text, 'media'::text, 'video'::text, 'audio'::text, 'release'::text, 'entity'::text, 'label'::text, 'tag'::text, 'tag_path'::text, 'series'::text, 'zone'::text, 'zone_page'::text, 'custom_theme'::text, 'collection'::text, 'post'::text, 'poll'::text, 'realm'::text, 'realm_rule'::text]));
-- Modify "vocabulary_node" table
ALTER TABLE "vocabulary_node" ADD CONSTRAINT "vocabulary_node_kind_check" CHECK (kind = ANY (ARRAY['concept'::text, 'guide'::text])), ADD CONSTRAINT "vocabulary_node_retirement_check" CHECK (((status = 'active'::text) AND (retired_at IS NULL)) OR ((status = 'retired'::text) AND (retired_at IS NOT NULL))), ADD CONSTRAINT "vocabulary_node_status_check" CHECK (status = ANY (ARRAY['active'::text, 'retired'::text])), ADD CONSTRAINT "vocabulary_node_id_kind_key" UNIQUE ("id", "kind"), ADD CONSTRAINT "vocabulary_node_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE SET NULL;
-- Create index "vocabulary_node_kind_status_idx" to table: "vocabulary_node"
CREATE INDEX "vocabulary_node_kind_status_idx" ON "vocabulary_node" ("kind", "status", "id");
-- Create "guide_node" table
CREATE TABLE "guide_node" (
  "id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "guide_node_id_vocabulary_node_id_fkey" FOREIGN KEY ("id") REFERENCES "vocabulary_node" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create "guide_node_localization" table
CREATE TABLE "guide_node_localization" (
  "node_id" uuid NOT NULL,
  "language" text NOT NULL,
  "title" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("node_id", "language"),
  CONSTRAINT "guide_node_localization_node_id_guide_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "guide_node" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "guide_node_localization_language_check" CHECK (language = ANY (ARRAY['zh'::text, 'en'::text, 'ja'::text, 'ko'::text, 'de'::text, 'fr'::text, 'es'::text])),
  CONSTRAINT "guide_node_localization_title_check" CHECK ((btrim(title) <> ''::text) AND (octet_length(title) <= 512))
);
-- Create index "guide_node_localization_language_node_idx" to table: "guide_node_localization"
CREATE INDEX "guide_node_localization_language_node_idx" ON "guide_node_localization" ("language", "node_id");
-- Modify "tag" table
ALTER TABLE "tag" ADD CONSTRAINT "tag_default_spoiler_level_check" CHECK ((default_spoiler_level IS NULL) OR ((default_spoiler_level >= 0) AND (default_spoiler_level <= 2))), ADD CONSTRAINT "tag_node_kind_check" CHECK (node_kind = 'concept'::text), ADD COLUMN "directly_applicable" boolean NOT NULL DEFAULT true, ADD COLUMN "default_spoiler_level" smallint NULL, ADD CONSTRAINT "tag_vocabulary_node_fkey" FOREIGN KEY ("id", "node_kind") REFERENCES "vocabulary_node" ("id", "kind") ON UPDATE NO ACTION ON DELETE CASCADE;
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
-- Create "tag_path" table
CREATE TABLE "tag_path" (
  "id" uuid NOT NULL,
  "member_node_ids" uuid[] NOT NULL,
  "relation_ids" uuid[] NOT NULL,
  "structural_identity_hash" text NOT NULL,
  "terminal_node_id" uuid NOT NULL,
  "created_by_profile_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "tag_path_structural_identity_hash_key" UNIQUE ("structural_identity_hash"),
  CONSTRAINT "tag_path_structure_key" UNIQUE ("member_node_ids", "relation_ids"),
  CONSTRAINT "tag_path_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_path_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "tag_path_terminal_node_id_vocabulary_node_id_fkey" FOREIGN KEY ("terminal_node_id") REFERENCES "vocabulary_node" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_path_member_count_check" CHECK ((cardinality(member_node_ids) >= 2) AND (cardinality(member_node_ids) <= 16)),
  CONSTRAINT "tag_path_member_null_check" CHECK (array_position(member_node_ids, NULL::uuid) IS NULL),
  CONSTRAINT "tag_path_not_self_check" CHECK (NOT (id = ANY (member_node_ids))),
  CONSTRAINT "tag_path_relation_count_check" CHECK (cardinality(relation_ids) = (cardinality(member_node_ids) - 1)),
  CONSTRAINT "tag_path_relation_null_check" CHECK (array_position(relation_ids, NULL::uuid) IS NULL),
  CONSTRAINT "tag_path_structural_identity_hash_check" CHECK (structural_identity_hash ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "tag_path_terminal_check" CHECK (terminal_node_id = member_node_ids[cardinality(member_node_ids)])
);
-- Create index "tag_path_created_by_idx" to table: "tag_path"
CREATE INDEX "tag_path_created_by_idx" ON "tag_path" ("created_by_profile_id", "created_at", "id");
-- Create index "tag_path_terminal_usage_idx" to table: "tag_path"
CREATE INDEX "tag_path_terminal_usage_idx" ON "tag_path" ("terminal_node_id", "id");
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
-- Create "tag_expression" table
CREATE TABLE "tag_expression" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "expression_kind" text NOT NULL,
  "canonical_claim_key" text NOT NULL,
  "focus_tag_id" uuid NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "created_by_profile_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "sealed_at" timestamptz(3) NULL,
  "retired_at" timestamptz(3) NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "tag_expression_claim_key" UNIQUE ("canonical_claim_key"),
  CONSTRAINT "tag_expression_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "tag_expression_focus_tag_id_tag_id_fkey" FOREIGN KEY ("focus_tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_expression_claim_key_check" CHECK ((btrim(canonical_claim_key) <> ''::text) AND (octet_length(canonical_claim_key) <= 2048)),
  CONSTRAINT "tag_expression_kind_check" CHECK (expression_kind = ANY (ARRAY['simple'::text, 'facet_value'::text, 'relation'::text])),
  CONSTRAINT "tag_expression_retirement_check" CHECK (((status = 'active'::text) AND (retired_at IS NULL)) OR ((status = 'retired'::text) AND (retired_at IS NOT NULL))),
  CONSTRAINT "tag_expression_status_check" CHECK (status = ANY (ARRAY['active'::text, 'retired'::text]))
);
-- Create index "tag_expression_focus_status_idx" to table: "tag_expression"
CREATE INDEX "tag_expression_focus_status_idx" ON "tag_expression" ("focus_tag_id", "status", "expression_kind", "id");
-- Create index "tag_expression_simple_focus_key" to table: "tag_expression"
CREATE UNIQUE INDEX "tag_expression_simple_focus_key" ON "tag_expression" ("focus_tag_id") WHERE (expression_kind = 'simple'::text);
-- Create "tag_path_sense" table
CREATE TABLE "tag_path_sense" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "path_id" uuid NOT NULL,
  "expression_id" uuid NOT NULL,
  "scope" text NOT NULL DEFAULT 'global',
  "realm_id" uuid NULL,
  "binding_signature" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "provenance" jsonb NULL,
  "created_by_profile_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "sealed_at" timestamptz(3) NULL,
  "retired_at" timestamptz(3) NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "tag_path_sense_id_path_key" UNIQUE ("id", "path_id"),
  CONSTRAINT "tag_path_sense_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_path_sense_expression_id_tag_expression_id_fkey" FOREIGN KEY ("expression_id") REFERENCES "tag_expression" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_path_sense_path_id_tag_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "tag_path" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_path_sense_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_path_sense_authority_check" CHECK (((scope = 'global'::text) AND (realm_id IS NULL)) OR ((scope = 'realm'::text) AND (realm_id IS NOT NULL))),
  CONSTRAINT "tag_path_sense_binding_signature_check" CHECK ((btrim(binding_signature) <> ''::text) AND (octet_length(binding_signature) <= 2048)),
  CONSTRAINT "tag_path_sense_provenance_object_check" CHECK ((provenance IS NULL) OR (jsonb_typeof(provenance) = 'object'::text)),
  CONSTRAINT "tag_path_sense_retirement_check" CHECK (((status = 'active'::text) AND (retired_at IS NULL)) OR ((status = 'retired'::text) AND (retired_at IS NOT NULL))),
  CONSTRAINT "tag_path_sense_scope_check" CHECK (scope = ANY (ARRAY['global'::text, 'realm'::text])),
  CONSTRAINT "tag_path_sense_status_check" CHECK (status = ANY (ARRAY['active'::text, 'retired'::text]))
);
-- Create index "tag_path_sense_expression_route_idx" to table: "tag_path_sense"
CREATE INDEX "tag_path_sense_expression_route_idx" ON "tag_path_sense" ("expression_id", "status", "id");
-- Create index "tag_path_sense_global_identity_key" to table: "tag_path_sense"
CREATE UNIQUE INDEX "tag_path_sense_global_identity_key" ON "tag_path_sense" ("path_id", "expression_id", "binding_signature") WHERE (scope = 'global'::text);
-- Create index "tag_path_sense_path_route_idx" to table: "tag_path_sense"
CREATE INDEX "tag_path_sense_path_route_idx" ON "tag_path_sense" ("path_id", "status", "id");
-- Create index "tag_path_sense_realm_identity_key" to table: "tag_path_sense"
CREATE UNIQUE INDEX "tag_path_sense_realm_identity_key" ON "tag_path_sense" ("realm_id", "path_id", "expression_id", "binding_signature") WHERE (scope = 'realm'::text);
-- Create index "tag_path_sense_realm_route_idx" to table: "tag_path_sense"
CREATE INDEX "tag_path_sense_realm_route_idx" ON "tag_path_sense" ("realm_id", "status", "path_id", "id");
-- Create "realm_tag_path_sense" table
CREATE TABLE "realm_tag_path_sense" (
  "realm_id" uuid NOT NULL,
  "sense_id" uuid NOT NULL,
  "path_id" uuid NOT NULL,
  "created_by_profile_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("realm_id", "sense_id"),
  CONSTRAINT "realm_tag_path_sense_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_tag_path_sense_definition_fkey" FOREIGN KEY ("sense_id", "path_id") REFERENCES "tag_path_sense" ("id", "path_id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_tag_path_sense_path_adoption_fkey" FOREIGN KEY ("realm_id", "path_id") REFERENCES "realm_tag_path" ("realm_id", "path_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_tag_path_sense_realm_id_realm_id_fkey" FOREIGN KEY ("realm_id") REFERENCES "realm" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "realm_tag_path_sense_path_idx" to table: "realm_tag_path_sense"
CREATE INDEX "realm_tag_path_sense_path_idx" ON "realm_tag_path_sense" ("path_id", "realm_id", "sense_id");
-- Create index "realm_tag_path_sense_sense_idx" to table: "realm_tag_path_sense"
CREATE INDEX "realm_tag_path_sense_sense_idx" ON "realm_tag_path_sense" ("sense_id", "realm_id");
-- Create "realm_tag_path_vote" table
CREATE TABLE "realm_tag_path_vote" (
  "realm_id" uuid NOT NULL,
  "path_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "value" integer NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("realm_id", "path_id", "profile_id"),
  CONSTRAINT "realm_tag_path_vote_adoption_fkey" FOREIGN KEY ("realm_id", "path_id") REFERENCES "realm_tag_path" ("realm_id", "path_id") ON UPDATE NO ACTION ON DELETE CASCADE,
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
  "primary_expression_count" bigint NOT NULL DEFAULT 0,
  "entailed_expression_count" bigint NOT NULL DEFAULT 0,
  "retrieval_expression_count" bigint NOT NULL DEFAULT 0,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("realm_id", "unit_id", "tag_id"),
  CONSTRAINT "realm_unit_effective_tag_realm_unit_fkey" FOREIGN KEY ("realm_id", "unit_id") REFERENCES "realm_unit" ("realm_id", "unit_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_unit_effective_tag_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_unit_effective_tag_count_check" CHECK ((primary_expression_count >= 0) AND (entailed_expression_count >= 0) AND (retrieval_expression_count >= 0)),
  CONSTRAINT "realm_unit_effective_tag_source_check" CHECK (direct OR (primary_expression_count > 0) OR (entailed_expression_count > 0) OR (retrieval_expression_count > 0))
);
-- Create index "realm_unit_effective_tag_tag_idx" to table: "realm_unit_effective_tag"
CREATE INDEX "realm_unit_effective_tag_tag_idx" ON "realm_unit_effective_tag" ("tag_id", "realm_id", "unit_id");
-- Create index "realm_unit_effective_tag_unit_route_idx" to table: "realm_unit_effective_tag"
CREATE INDEX "realm_unit_effective_tag_unit_route_idx" ON "realm_unit_effective_tag" ("unit_id", "realm_id", "tag_id");
-- Create "realm_unit_expression_assertion" table
CREATE TABLE "realm_unit_expression_assertion" (
  "realm_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "expression_id" uuid NOT NULL,
  "direct" boolean NOT NULL DEFAULT false,
  "path_application_count" bigint NOT NULL DEFAULT 0,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("realm_id", "unit_id", "expression_id"),
  CONSTRAINT "realm_unit_expression_assertion_GxDH2EF54kVP_fkey" FOREIGN KEY ("expression_id") REFERENCES "tag_expression" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_unit_expression_assertion_realm_unit_fkey" FOREIGN KEY ("realm_id", "unit_id") REFERENCES "realm_unit" ("realm_id", "unit_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_unit_expression_assertion_path_count_check" CHECK (path_application_count >= 0),
  CONSTRAINT "realm_unit_expression_assertion_source_check" CHECK (direct OR (path_application_count > 0))
);
-- Create index "realm_unit_expression_assertion_expression_idx" to table: "realm_unit_expression_assertion"
CREATE INDEX "realm_unit_expression_assertion_expression_idx" ON "realm_unit_expression_assertion" ("expression_id", "realm_id", "unit_id");
-- Create index "realm_unit_expression_assertion_unit_route_idx" to table: "realm_unit_expression_assertion"
CREATE INDEX "realm_unit_expression_assertion_unit_route_idx" ON "realm_unit_expression_assertion" ("unit_id", "realm_id", "expression_id");
-- Create "realm_unit_tag_path_application" table
CREATE TABLE "realm_unit_tag_path_application" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "realm_id" uuid NOT NULL,
  "unit_id" uuid NOT NULL,
  "sense_id" uuid NOT NULL,
  "created_by_profile_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "realm_unit_tag_path_application_authority_key" UNIQUE ("realm_id", "unit_id", "sense_id"),
  CONSTRAINT "realm_unit_tag_path_application_qDMxreMGiMF3_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_unit_tag_path_application_realm_unit_fkey" FOREIGN KEY ("realm_id", "unit_id") REFERENCES "realm_unit" ("realm_id", "unit_id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_unit_tag_path_application_sense_adoption_fkey" FOREIGN KEY ("realm_id", "sense_id") REFERENCES "realm_tag_path_sense" ("realm_id", "sense_id") ON UPDATE NO ACTION ON DELETE RESTRICT
);
-- Create index "realm_unit_tag_path_application_sense_idx" to table: "realm_unit_tag_path_application"
CREATE INDEX "realm_unit_tag_path_application_sense_idx" ON "realm_unit_tag_path_application" ("realm_id", "sense_id", "unit_id", "id");
-- Create index "realm_unit_tag_path_application_unit_route_idx" to table: "realm_unit_tag_path_application"
CREATE INDEX "realm_unit_tag_path_application_unit_route_idx" ON "realm_unit_tag_path_application" ("unit_id", "realm_id", "sense_id", "id");
-- Create "realm_unit_tag_path_application_judgment" table
CREATE TABLE "realm_unit_tag_path_application_judgment" (
  "application_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "fit_vote" integer NULL,
  "spoiler_level" smallint NULL,
  "fit_updated_at" timestamptz(3) NULL,
  "spoiler_updated_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("application_id", "profile_id"),
  CONSTRAINT "realm_unit_tag_path_application_judgment_GE7QUeiiaNZD_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "realm_unit_tag_path_application_judgment_SSiFcqaa0YFj_fkey" FOREIGN KEY ("application_id") REFERENCES "realm_unit_tag_path_application" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_unit_tag_path_application_judgment_fit_timestamp_check" CHECK ((fit_vote IS NULL) = (fit_updated_at IS NULL)),
  CONSTRAINT "realm_unit_tag_path_application_judgment_fit_vote_check" CHECK ((fit_vote IS NULL) OR (fit_vote = ANY (ARRAY['-1'::integer, 1]))),
  CONSTRAINT "realm_unit_tag_path_application_judgment_sparse_check" CHECK ((fit_vote IS NOT NULL) OR (spoiler_level IS NOT NULL)),
  CONSTRAINT "realm_unit_tag_path_application_judgment_spoiler_level_check" CHECK ((spoiler_level IS NULL) OR ((spoiler_level >= 0) AND (spoiler_level <= 2))),
  CONSTRAINT "realm_unit_tag_path_application_judgment_spoiler_timestamp_chec" CHECK ((spoiler_level IS NULL) = (spoiler_updated_at IS NULL))
);
-- Create index "realm_unit_tag_path_application_judgment_positive_idx" to table: "realm_unit_tag_path_application_judgment"
CREATE INDEX "realm_unit_tag_path_application_judgment_positive_idx" ON "realm_unit_tag_path_application_judgment" ("application_id", "profile_id") WHERE (fit_vote = 1);
-- Create index "realm_unit_tag_path_application_judgment_profile_idx" to table: "realm_unit_tag_path_application_judgment"
CREATE INDEX "realm_unit_tag_path_application_judgment_profile_idx" ON "realm_unit_tag_path_application_judgment" ("profile_id", "application_id");
-- Create "realm_unit_tag_path_application_judgment_stat" table
CREATE TABLE "realm_unit_tag_path_application_judgment_stat" (
  "application_id" uuid NOT NULL,
  "score" bigint NOT NULL DEFAULT 0,
  "vote_count" bigint NOT NULL DEFAULT 0,
  "spoiler_vote_count" bigint NOT NULL DEFAULT 0,
  "spoiler_none_count" bigint NOT NULL DEFAULT 0,
  "spoiler_minor_count" bigint NOT NULL DEFAULT 0,
  "spoiler_major_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("application_id"),
  CONSTRAINT "a3jDMW3K6BQw_fkey" FOREIGN KEY ("application_id") REFERENCES "realm_unit_tag_path_application" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "realm_unit_tag_path_application_judgment_stat_count_check" CHECK (vote_count >= 0),
  CONSTRAINT "realm_unit_tag_path_application_judgment_stat_parity_check" CHECK (((vote_count + score) % (2)::bigint) = 0),
  CONSTRAINT "realm_unit_tag_path_application_judgment_stat_score_check" CHECK (abs(score) <= vote_count),
  CONSTRAINT "realm_unit_tag_path_application_judgment_stat_spoiler_count_che" CHECK (spoiler_vote_count = ((spoiler_none_count + spoiler_minor_count) + spoiler_major_count)),
  CONSTRAINT "realm_unit_tag_path_application_judgment_stat_spoiler_nonnegati" CHECK ((spoiler_vote_count >= 0) AND (spoiler_none_count >= 0) AND (spoiler_minor_count >= 0) AND (spoiler_major_count >= 0))
);
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
-- Create "tag_expression_argument" table
CREATE TABLE "tag_expression_argument" (
  "expression_id" uuid NOT NULL,
  "role" text NOT NULL,
  "ordinal" integer NOT NULL DEFAULT 0,
  "tag_id" uuid NOT NULL,
  PRIMARY KEY ("expression_id", "role", "ordinal"),
  CONSTRAINT "tag_expression_argument_role_tag_key" UNIQUE ("expression_id", "role", "tag_id"),
  CONSTRAINT "tag_expression_argument_expression_id_tag_expression_id_fkey" FOREIGN KEY ("expression_id") REFERENCES "tag_expression" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "tag_expression_argument_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_expression_argument_ordinal_check" CHECK (ordinal >= 0),
  CONSTRAINT "tag_expression_argument_role_check" CHECK (role = ANY (ARRAY['predicate'::text, 'slot'::text, 'value'::text, 'focus'::text, 'qualifier'::text]))
);
-- Create index "tag_expression_argument_tag_idx" to table: "tag_expression_argument"
CREATE INDEX "tag_expression_argument_tag_idx" ON "tag_expression_argument" ("tag_id", "expression_id", "role");
-- Create "tag_expression_effective_tag" table
CREATE TABLE "tag_expression_effective_tag" (
  "expression_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "evidence_kind" text NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("expression_id", "tag_id", "evidence_kind"),
  CONSTRAINT "tag_expression_effective_tag_dgsGY56nN7QZ_fkey" FOREIGN KEY ("expression_id") REFERENCES "tag_expression" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "tag_expression_effective_tag_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_expression_effective_tag_kind_check" CHECK (evidence_kind = ANY (ARRAY['primary'::text, 'entailed'::text, 'retrieval_only'::text]))
);
-- Create index "tag_expression_effective_tag_tag_idx" to table: "tag_expression_effective_tag"
CREATE INDEX "tag_expression_effective_tag_tag_idx" ON "tag_expression_effective_tag" ("tag_id", "evidence_kind", "expression_id");
-- Create "tag_expression_presentation_revision" table
CREATE TABLE "tag_expression_presentation_revision" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "expression_id" uuid NOT NULL,
  "revision" integer NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'active',
  "created_by_profile_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "sealed_at" timestamptz(3) NULL,
  "retired_at" timestamptz(3) NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "tag_expression_presentation_revision_key" UNIQUE ("expression_id", "revision"),
  CONSTRAINT "tag_expression_presentation_revision_8tm4v6dm9WVJ_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "tag_expression_presentation_revision_wjcWOwR4oQub_fkey" FOREIGN KEY ("expression_id") REFERENCES "tag_expression" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "tag_expression_presentation_retirement_check" CHECK (((status = 'active'::text) AND (retired_at IS NULL)) OR ((status = 'retired'::text) AND (retired_at IS NOT NULL))),
  CONSTRAINT "tag_expression_presentation_revision_check" CHECK (revision >= 1),
  CONSTRAINT "tag_expression_presentation_status_check" CHECK (status = ANY (ARRAY['active'::text, 'retired'::text]))
);
-- Create index "tag_expression_presentation_active_key" to table: "tag_expression_presentation_revision"
CREATE UNIQUE INDEX "tag_expression_presentation_active_key" ON "tag_expression_presentation_revision" ("expression_id") WHERE (status = 'active'::text);
-- Create index "tag_expression_presentation_expression_idx" to table: "tag_expression_presentation_revision"
CREATE INDEX "tag_expression_presentation_expression_idx" ON "tag_expression_presentation_revision" ("expression_id", "status", "revision");
-- Create "tag_expression_group_key" table
CREATE TABLE "tag_expression_group_key" (
  "presentation_revision_id" uuid NOT NULL,
  "tag_id" uuid NOT NULL,
  "semantic_role" text NOT NULL,
  PRIMARY KEY ("presentation_revision_id"),
  CONSTRAINT "tag_expression_group_key_CEDpoKSBf22Z_fkey" FOREIGN KEY ("presentation_revision_id") REFERENCES "tag_expression_presentation_revision" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "tag_expression_group_key_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_expression_group_key_role_check" CHECK (semantic_role = ANY (ARRAY['predicate'::text, 'slot'::text, 'value'::text, 'focus'::text, 'qualifier'::text]))
);
-- Create index "tag_expression_group_key_tag_idx" to table: "tag_expression_group_key"
CREATE INDEX "tag_expression_group_key_tag_idx" ON "tag_expression_group_key" ("tag_id", "presentation_revision_id");
-- Create "tag_expression_inference_rule" table
CREATE TABLE "tag_expression_inference_rule" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "source_expression_id" uuid NOT NULL,
  "target_tag_id" uuid NULL,
  "target_expression_id" uuid NULL,
  "inference_kind" text NOT NULL,
  "revision" integer NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'active',
  "provenance" jsonb NULL,
  "created_by_profile_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "retired_at" timestamptz(3) NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "tag_expression_inference_rule_11rhxVbO5m2d_fkey" FOREIGN KEY ("target_expression_id") REFERENCES "tag_expression" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_expression_inference_rule_ceJs4fI4KzGn_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "tag_expression_inference_rule_sAA3JphYnPh9_fkey" FOREIGN KEY ("source_expression_id") REFERENCES "tag_expression" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "tag_expression_inference_rule_target_tag_id_tag_id_fkey" FOREIGN KEY ("target_tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_expression_inference_rule_kind_check" CHECK (inference_kind = ANY (ARRAY['entailed'::text, 'retrieval_only'::text])),
  CONSTRAINT "tag_expression_inference_rule_not_self_check" CHECK ((target_expression_id IS NULL) OR (source_expression_id <> target_expression_id)),
  CONSTRAINT "tag_expression_inference_rule_provenance_object_check" CHECK ((provenance IS NULL) OR (jsonb_typeof(provenance) = 'object'::text)),
  CONSTRAINT "tag_expression_inference_rule_retirement_check" CHECK (((status = 'active'::text) AND (retired_at IS NULL)) OR ((status = 'retired'::text) AND (retired_at IS NOT NULL))),
  CONSTRAINT "tag_expression_inference_rule_revision_check" CHECK (revision >= 1),
  CONSTRAINT "tag_expression_inference_rule_status_check" CHECK (status = ANY (ARRAY['active'::text, 'retired'::text])),
  CONSTRAINT "tag_expression_inference_rule_target_check" CHECK (num_nonnulls(target_tag_id, target_expression_id) = 1)
);
-- Create index "tag_expression_inference_rule_active_expression_key" to table: "tag_expression_inference_rule"
CREATE UNIQUE INDEX "tag_expression_inference_rule_active_expression_key" ON "tag_expression_inference_rule" ("source_expression_id", "target_expression_id", "inference_kind") WHERE ((status = 'active'::text) AND (target_expression_id IS NOT NULL));
-- Create index "tag_expression_inference_rule_active_tag_key" to table: "tag_expression_inference_rule"
CREATE UNIQUE INDEX "tag_expression_inference_rule_active_tag_key" ON "tag_expression_inference_rule" ("source_expression_id", "target_tag_id", "inference_kind") WHERE ((status = 'active'::text) AND (target_tag_id IS NOT NULL));
-- Create index "tag_expression_inference_rule_expression_revision_key" to table: "tag_expression_inference_rule"
CREATE UNIQUE INDEX "tag_expression_inference_rule_expression_revision_key" ON "tag_expression_inference_rule" ("source_expression_id", "target_expression_id", "inference_kind", "revision") WHERE (target_expression_id IS NOT NULL);
-- Create index "tag_expression_inference_rule_source_idx" to table: "tag_expression_inference_rule"
CREATE INDEX "tag_expression_inference_rule_source_idx" ON "tag_expression_inference_rule" ("source_expression_id", "status", "inference_kind", "id");
-- Create index "tag_expression_inference_rule_tag_revision_key" to table: "tag_expression_inference_rule"
CREATE UNIQUE INDEX "tag_expression_inference_rule_tag_revision_key" ON "tag_expression_inference_rule" ("source_expression_id", "target_tag_id", "inference_kind", "revision") WHERE (target_tag_id IS NOT NULL);
-- Create index "tag_expression_inference_rule_target_expression_idx" to table: "tag_expression_inference_rule"
CREATE INDEX "tag_expression_inference_rule_target_expression_idx" ON "tag_expression_inference_rule" ("target_expression_id", "status", "id");
-- Create index "tag_expression_inference_rule_target_tag_idx" to table: "tag_expression_inference_rule"
CREATE INDEX "tag_expression_inference_rule_target_tag_idx" ON "tag_expression_inference_rule" ("target_tag_id", "status", "id");
-- Create "tag_expression_label_component" table
CREATE TABLE "tag_expression_label_component" (
  "presentation_revision_id" uuid NOT NULL,
  "ordinal" integer NOT NULL,
  "tag_id" uuid NOT NULL,
  "semantic_role" text NOT NULL,
  "component_kind" text NOT NULL DEFAULT 'required',
  PRIMARY KEY ("presentation_revision_id", "ordinal"),
  CONSTRAINT "tag_expression_label_component_semantic_key" UNIQUE ("presentation_revision_id", "tag_id", "semantic_role", "component_kind"),
  CONSTRAINT "tag_expression_label_component_llDnvCNRpOTA_fkey" FOREIGN KEY ("presentation_revision_id") REFERENCES "tag_expression_presentation_revision" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "tag_expression_label_component_tag_id_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tag" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_expression_label_component_kind_check" CHECK (component_kind = ANY (ARRAY['required'::text, 'fallback'::text])),
  CONSTRAINT "tag_expression_label_component_ordinal_check" CHECK (ordinal >= 0),
  CONSTRAINT "tag_expression_label_component_role_check" CHECK (semantic_role = ANY (ARRAY['predicate'::text, 'slot'::text, 'value'::text, 'focus'::text, 'qualifier'::text]))
);
-- Create index "tag_expression_label_component_tag_idx" to table: "tag_expression_label_component"
CREATE INDEX "tag_expression_label_component_tag_idx" ON "tag_expression_label_component" ("tag_id", "presentation_revision_id");
-- Create "tag_expression_projection_rebuild" table
CREATE TABLE "tag_expression_projection_rebuild" (
  "expression_id" uuid NOT NULL,
  "global_cursor_unit_id" uuid NULL,
  "global_complete" boolean NOT NULL DEFAULT false,
  "realm_cursor_realm_id" uuid NULL,
  "realm_cursor_unit_id" uuid NULL,
  "realm_complete" boolean NOT NULL DEFAULT false,
  "attempt_count" integer NOT NULL DEFAULT 0,
  "available_at" timestamptz(3) NOT NULL DEFAULT now(),
  "last_error_message" text NULL,
  "requested_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("expression_id"),
  CONSTRAINT "tag_expression_projection_rebuild_wI8F4kdKOrA4_fkey" FOREIGN KEY ("expression_id") REFERENCES "tag_expression" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "tag_expression_projection_rebuild_attempt_check" CHECK (attempt_count >= 0),
  CONSTRAINT "tag_expression_projection_rebuild_incomplete_check" CHECK (NOT (global_complete AND realm_complete)),
  CONSTRAINT "tag_expression_projection_rebuild_realm_cursor_check" CHECK ((realm_cursor_realm_id IS NULL) = (realm_cursor_unit_id IS NULL))
);
-- Create index "tag_expression_projection_rebuild_claim_idx" to table: "tag_expression_projection_rebuild"
CREATE INDEX "tag_expression_projection_rebuild_claim_idx" ON "tag_expression_projection_rebuild" ("available_at", "requested_at", "expression_id");
-- Create "tag_relation" table
CREATE TABLE "tag_relation" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "parent_node_id" uuid NOT NULL,
  "child_node_id" uuid NOT NULL,
  "relation_kind" text NOT NULL,
  "revision" integer NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'active',
  "provenance" jsonb NULL,
  "created_by_profile_id" uuid NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "retired_at" timestamptz(3) NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "tag_relation_revision_key" UNIQUE ("parent_node_id", "child_node_id", "relation_kind", "revision"),
  CONSTRAINT "tag_relation_child_node_id_vocabulary_node_id_fkey" FOREIGN KEY ("child_node_id") REFERENCES "vocabulary_node" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_relation_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "tag_relation_parent_node_id_vocabulary_node_id_fkey" FOREIGN KEY ("parent_node_id") REFERENCES "vocabulary_node" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_relation_distinct_check" CHECK (parent_node_id <> child_node_id),
  CONSTRAINT "tag_relation_kind_check" CHECK (relation_kind = ANY (ARRAY['generic'::text, 'partitive'::text, 'instance'::text, 'organizational'::text, 'facet_value'::text])),
  CONSTRAINT "tag_relation_provenance_object_check" CHECK ((provenance IS NULL) OR (jsonb_typeof(provenance) = 'object'::text)),
  CONSTRAINT "tag_relation_retirement_check" CHECK (((status = 'active'::text) AND (retired_at IS NULL)) OR ((status = 'retired'::text) AND (retired_at IS NOT NULL))),
  CONSTRAINT "tag_relation_revision_check" CHECK (revision >= 1),
  CONSTRAINT "tag_relation_status_check" CHECK (status = ANY (ARRAY['active'::text, 'retired'::text]))
);
-- Create index "tag_relation_active_key" to table: "tag_relation"
CREATE UNIQUE INDEX "tag_relation_active_key" ON "tag_relation" ("parent_node_id", "child_node_id", "relation_kind") WHERE (status = 'active'::text);
-- Create index "tag_relation_child_route_idx" to table: "tag_relation"
CREATE INDEX "tag_relation_child_route_idx" ON "tag_relation" ("child_node_id", "status", "relation_kind", "parent_node_id", "id");
-- Create index "tag_relation_parent_route_idx" to table: "tag_relation"
CREATE INDEX "tag_relation_parent_route_idx" ON "tag_relation" ("parent_node_id", "status", "relation_kind", "child_node_id", "id");
-- Create "tag_path_member" table
CREATE TABLE "tag_path_member" (
  "path_id" uuid NOT NULL,
  "ordinal" integer NOT NULL,
  "node_id" uuid NOT NULL,
  "incoming_relation_id" uuid NULL,
  PRIMARY KEY ("path_id", "ordinal"),
  CONSTRAINT "tag_path_member_path_node_key" UNIQUE ("path_id", "node_id"),
  CONSTRAINT "tag_path_member_incoming_relation_id_tag_relation_id_fkey" FOREIGN KEY ("incoming_relation_id") REFERENCES "tag_relation" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_path_member_node_id_vocabulary_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "vocabulary_node" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "tag_path_member_path_id_tag_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "tag_path" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "tag_path_member_incoming_relation_check" CHECK (((ordinal = 0) AND (incoming_relation_id IS NULL)) OR ((ordinal > 0) AND (incoming_relation_id IS NOT NULL))),
  CONSTRAINT "tag_path_member_ordinal_check" CHECK (ordinal >= 0)
);
-- Create index "tag_path_member_node_path_idx" to table: "tag_path_member"
CREATE INDEX "tag_path_member_node_path_idx" ON "tag_path_member" ("node_id", "path_id", "ordinal");
-- Create index "tag_path_member_relation_idx" to table: "tag_path_member"
CREATE INDEX "tag_path_member_relation_idx" ON "tag_path_member" ("incoming_relation_id", "path_id", "ordinal");
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
  CONSTRAINT "tag_path_merge_proposal_provenance_check" CHECK (((proposal_source_kind = 'human'::text) AND (proposal_provenance IS NULL)) OR ((proposal_source_kind = 'assisted'::text) AND ((proposal_provenance ->> 'kind'::text) = 'assisted'::text) AND (jsonb_typeof((proposal_provenance -> 'system'::text)) = 'string'::text) AND (btrim((proposal_provenance ->> 'system'::text)) <> ''::text) AND (jsonb_typeof((proposal_provenance -> 'runId'::text)) = 'string'::text) AND (btrim((proposal_provenance ->> 'runId'::text)) <> ''::text) AND ((NOT (proposal_provenance ? 'model'::text)) OR (jsonb_typeof((proposal_provenance -> 'model'::text)) = 'string'::text)) AND ((NOT (proposal_provenance ? 'confidence'::text)) OR ((jsonb_typeof((proposal_provenance -> 'confidence'::text)) = 'number'::text) AND ((((proposal_provenance ->> 'confidence'::text))::numeric >= (0)::numeric) AND (((proposal_provenance ->> 'confidence'::text))::numeric <= (1)::numeric)))))),
  CONSTRAINT "tag_path_merge_proposal_provenance_object_check" CHECK ((proposal_provenance IS NULL) OR (jsonb_typeof(proposal_provenance) = 'object'::text)),
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
-- Create "tag_path_sense_binding" table
CREATE TABLE "tag_path_sense_binding" (
  "sense_id" uuid NOT NULL,
  "member_ordinal" integer NOT NULL,
  "argument_role" text NOT NULL,
  "argument_ordinal" integer NOT NULL DEFAULT 0,
  PRIMARY KEY ("sense_id", "member_ordinal", "argument_role", "argument_ordinal"),
  CONSTRAINT "tag_path_sense_binding_argument_key" UNIQUE ("sense_id", "argument_role", "argument_ordinal"),
  CONSTRAINT "tag_path_sense_binding_sense_id_tag_path_sense_id_fkey" FOREIGN KEY ("sense_id") REFERENCES "tag_path_sense" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "tag_path_sense_binding_argument_ordinal_check" CHECK (argument_ordinal >= 0),
  CONSTRAINT "tag_path_sense_binding_member_ordinal_check" CHECK (member_ordinal >= 0),
  CONSTRAINT "tag_path_sense_binding_role_check" CHECK (argument_role = ANY (ARRAY['predicate'::text, 'slot'::text, 'value'::text, 'focus'::text, 'qualifier'::text]))
);
-- Create index "tag_path_sense_binding_member_idx" to table: "tag_path_sense_binding"
CREATE INDEX "tag_path_sense_binding_member_idx" ON "tag_path_sense_binding" ("member_ordinal", "sense_id", "argument_role");
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
-- Create "tag_path_vote_stat" table
CREATE TABLE "tag_path_vote_stat" (
  "path_id" uuid NOT NULL,
  "terminal_node_id" uuid NOT NULL,
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
-- Create index "tag_path_vote_stat_terminal_usage_idx" to table: "tag_path_vote_stat"
CREATE INDEX "tag_path_vote_stat_terminal_usage_idx" ON "tag_path_vote_stat" ("terminal_node_id", "usage_count" DESC NULLS LAST, "path_id") WHERE ((score > 0) AND (vote_count > 0));
-- Create index "tag_path_vote_stat_usage_idx" to table: "tag_path_vote_stat"
CREATE INDEX "tag_path_vote_stat_usage_idx" ON "tag_path_vote_stat" ("usage_count" DESC NULLS LAST, "path_id") WHERE ((score > 0) AND (vote_count > 0));
-- Create "unit_expression_assertion" table
CREATE TABLE "unit_expression_assertion" (
  "unit_id" uuid NOT NULL,
  "expression_id" uuid NOT NULL,
  "direct" boolean NOT NULL DEFAULT false,
  "path_application_count" bigint NOT NULL DEFAULT 0,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("unit_id", "expression_id"),
  CONSTRAINT "unit_expression_assertion_expression_id_tag_expression_id_fkey" FOREIGN KEY ("expression_id") REFERENCES "tag_expression" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_expression_assertion_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_expression_assertion_path_count_check" CHECK (path_application_count >= 0),
  CONSTRAINT "unit_expression_assertion_source_check" CHECK (direct OR (path_application_count > 0))
);
-- Create index "unit_expression_assertion_expression_idx" to table: "unit_expression_assertion"
CREATE INDEX "unit_expression_assertion_expression_idx" ON "unit_expression_assertion" ("expression_id", "unit_id");
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
-- Modify "unit_effective_tag" table
ALTER TABLE "unit_effective_tag" DROP CONSTRAINT "unit_effective_tag_structure_count_check", DROP CONSTRAINT "unit_effective_tag_source_check", ADD CONSTRAINT "unit_effective_tag_source_check" CHECK (direct OR (primary_expression_count > 0) OR (entailed_expression_count > 0) OR (retrieval_expression_count > 0)), ADD CONSTRAINT "unit_effective_tag_count_check" CHECK ((primary_expression_count >= 0) AND (entailed_expression_count >= 0) AND (retrieval_expression_count >= 0)), DROP COLUMN "structure_support_count", ADD COLUMN "primary_expression_count" bigint NOT NULL DEFAULT 0, ADD COLUMN "entailed_expression_count" bigint NOT NULL DEFAULT 0, ADD COLUMN "retrieval_expression_count" bigint NOT NULL DEFAULT 0;
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
-- Create "unit_tag_path_application" table
CREATE TABLE "unit_tag_path_application" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "unit_id" uuid NOT NULL,
  "sense_id" uuid NOT NULL,
  "created_by_profile_id" uuid NULL,
  "pinned" boolean NOT NULL DEFAULT false,
  "position" text NULL COLLATE "C",
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "unit_tag_path_application_unit_sense_key" UNIQUE ("unit_id", "sense_id"),
  CONSTRAINT "unit_tag_path_application_created_by_profile_id_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE SET NULL,
  CONSTRAINT "unit_tag_path_application_sense_id_tag_path_sense_id_fkey" FOREIGN KEY ("sense_id") REFERENCES "tag_path_sense" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_tag_path_application_unit_id_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_tag_path_application_pinned_position_check" CHECK ((pinned AND ("position" IS NOT NULL)) OR ((NOT pinned) AND ("position" IS NULL))),
  CONSTRAINT "unit_tag_path_application_position_byte_length_check" CHECK (octet_length("position") <= 1024)
);
-- Create index "unit_tag_path_application_sense_idx" to table: "unit_tag_path_application"
CREATE INDEX "unit_tag_path_application_sense_idx" ON "unit_tag_path_application" ("sense_id", "unit_id", "id");
-- Create index "unit_tag_path_application_unit_position_idx" to table: "unit_tag_path_application"
CREATE INDEX "unit_tag_path_application_unit_position_idx" ON "unit_tag_path_application" ("unit_id", "pinned", "position", "id");
-- Create "unit_tag_path_application_judgment" table
CREATE TABLE "unit_tag_path_application_judgment" (
  "application_id" uuid NOT NULL,
  "profile_id" uuid NOT NULL,
  "fit_vote" integer NULL,
  "spoiler_level" smallint NULL,
  "fit_updated_at" timestamptz(3) NULL,
  "spoiler_updated_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("application_id", "profile_id"),
  CONSTRAINT "unit_tag_path_application_judgment_DBkK2znxXfkd_fkey" FOREIGN KEY ("application_id") REFERENCES "unit_tag_path_application" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_tag_path_application_judgment_profile_id_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "unit_tag_path_application_judgment_fit_timestamp_check" CHECK ((fit_vote IS NULL) = (fit_updated_at IS NULL)),
  CONSTRAINT "unit_tag_path_application_judgment_fit_vote_check" CHECK ((fit_vote IS NULL) OR (fit_vote = ANY (ARRAY['-1'::integer, 1]))),
  CONSTRAINT "unit_tag_path_application_judgment_sparse_check" CHECK ((fit_vote IS NOT NULL) OR (spoiler_level IS NOT NULL)),
  CONSTRAINT "unit_tag_path_application_judgment_spoiler_level_check" CHECK ((spoiler_level IS NULL) OR ((spoiler_level >= 0) AND (spoiler_level <= 2))),
  CONSTRAINT "unit_tag_path_application_judgment_spoiler_timestamp_check" CHECK ((spoiler_level IS NULL) = (spoiler_updated_at IS NULL))
);
-- Create index "unit_tag_path_application_judgment_positive_idx" to table: "unit_tag_path_application_judgment"
CREATE INDEX "unit_tag_path_application_judgment_positive_idx" ON "unit_tag_path_application_judgment" ("application_id", "profile_id") WHERE (fit_vote = 1);
-- Create index "unit_tag_path_application_judgment_profile_idx" to table: "unit_tag_path_application_judgment"
CREATE INDEX "unit_tag_path_application_judgment_profile_idx" ON "unit_tag_path_application_judgment" ("profile_id", "application_id");
-- Create "unit_tag_path_application_judgment_stat" table
CREATE TABLE "unit_tag_path_application_judgment_stat" (
  "application_id" uuid NOT NULL,
  "score" bigint NOT NULL DEFAULT 0,
  "vote_count" bigint NOT NULL DEFAULT 0,
  "spoiler_vote_count" bigint NOT NULL DEFAULT 0,
  "spoiler_none_count" bigint NOT NULL DEFAULT 0,
  "spoiler_minor_count" bigint NOT NULL DEFAULT 0,
  "spoiler_major_count" bigint NOT NULL DEFAULT 0,
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("application_id"),
  CONSTRAINT "unit_tag_path_application_judgment_stat_4jzMb85ww3mI_fkey" FOREIGN KEY ("application_id") REFERENCES "unit_tag_path_application" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "unit_tag_path_application_judgment_stat_count_check" CHECK (vote_count >= 0),
  CONSTRAINT "unit_tag_path_application_judgment_stat_parity_check" CHECK (((vote_count + score) % (2)::bigint) = 0),
  CONSTRAINT "unit_tag_path_application_judgment_stat_score_check" CHECK (abs(score) <= vote_count),
  CONSTRAINT "unit_tag_path_application_judgment_stat_spoiler_count_check" CHECK (spoiler_vote_count = ((spoiler_none_count + spoiler_minor_count) + spoiler_major_count)),
  CONSTRAINT "unit_tag_path_application_judgment_stat_spoiler_nonnegative_che" CHECK ((spoiler_vote_count >= 0) AND (spoiler_none_count >= 0) AND (spoiler_minor_count >= 0) AND (spoiler_major_count >= 0))
);
-- Drop "realm_tag_vote" table
DROP TABLE "realm_tag_vote";
-- Drop "realm_tag_vote_stat" table
DROP TABLE "realm_tag_vote_stat";
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

-- Realm-local authority is preserved in every source fact and projection key.

CREATE OR REPLACE FUNCTION public.lock_vote_hot_key(lock_key text, lock_seed bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
	IF NOT pg_try_advisory_xact_lock(hashtextextended(lock_key, lock_seed)) THEN
		RAISE EXCEPTION 'Vote aggregate key is busy'
			USING ERRCODE = '55P03', CONSTRAINT = 'vote_hot_key_busy';
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_realm_tag_judgment_keys(
	target_realm_ids uuid[],
	target_unit_ids uuid[],
	target_tag_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
	hot_key record;
BEGIN
	IF target_realm_ids IS NULL OR target_unit_ids IS NULL OR target_tag_ids IS NULL
		OR cardinality(target_realm_ids) > 1024
		OR cardinality(target_realm_ids) <> cardinality(target_unit_ids)
		OR cardinality(target_realm_ids) <> cardinality(target_tag_ids)
		OR EXISTS (
			SELECT 1
			FROM unnest(target_realm_ids, target_unit_ids, target_tag_ids)
				AS key(realm_id, unit_id, tag_id)
			WHERE key.realm_id IS NULL OR key.unit_id IS NULL OR key.tag_id IS NULL
		) THEN
		RAISE EXCEPTION 'Realm Tag judgment hot-key arrays must contain at most 1024 aligned keys'
			USING ERRCODE = '22023', CONSTRAINT = 'realm_tag_judgment_hot_key_batch_invalid';
	END IF;
	FOR hot_key IN
		SELECT DISTINCT key.realm_id, key.unit_id, key.tag_id
		FROM unnest(target_realm_ids, target_unit_ids, target_tag_ids)
			AS key(realm_id, unit_id, tag_id)
		ORDER BY key.realm_id, key.unit_id, key.tag_id
	LOOP
		PERFORM public.lock_vote_hot_key(
			'realm_tag_stat:' || hot_key.realm_id::text || ':' || hot_key.unit_id::text || ':' || hot_key.tag_id::text,
			0
		);
	END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_realm_unit_effective_tags(
	target_realm_id uuid,
	target_unit_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	PERFORM public.lock_vote_hot_key(
		'realm_effective_tags:' || target_realm_id::text || ':' || target_unit_id::text,
		0
	);
	DELETE FROM public.realm_unit_effective_tag
	WHERE realm_id = target_realm_id AND unit_id = target_unit_id;
	INSERT INTO public.realm_unit_effective_tag(
		realm_id, unit_id, tag_id, direct, primary_expression_count,
		entailed_expression_count, retrieval_expression_count, updated_at
	)
	SELECT target_realm_id,
		target_unit_id,
		source.tag_id,
		bool_or(source.direct),
		count(DISTINCT source.expression_id) FILTER (WHERE source.evidence_kind = 'primary'),
		count(DISTINCT source.expression_id) FILTER (WHERE source.evidence_kind = 'entailed'),
		count(DISTINCT source.expression_id) FILTER (WHERE source.evidence_kind = 'retrieval_only'),
		clock_timestamp()
	FROM (
		SELECT direct_tag.tag_id, true AS direct, NULL::uuid AS expression_id,
			NULL::text AS evidence_kind
		FROM public.realm_unit_tag AS direct_tag
		WHERE direct_tag.realm_id = target_realm_id AND direct_tag.unit_id = target_unit_id
		UNION ALL
		SELECT effective.tag_id, false, assertion.expression_id, effective.evidence_kind
		FROM public.realm_unit_expression_assertion AS assertion
		JOIN public.tag_expression_effective_tag AS effective
			ON effective.expression_id = assertion.expression_id
		WHERE assertion.realm_id = target_realm_id AND assertion.unit_id = target_unit_id
	) AS source
	GROUP BY source.tag_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_realm_unit_expression_assertion(
	target_realm_id uuid,
	target_unit_id uuid,
	target_expression_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	direct_exists boolean;
	accepted_application_count bigint;
BEGIN
	PERFORM public.lock_vote_hot_key(
		'realm_expression_assertion:' || target_realm_id::text || ':' || target_unit_id::text || ':' || target_expression_id::text,
		0
	);
	SELECT EXISTS (
		SELECT 1
		FROM public.tag_expression AS expression
		JOIN public.realm_unit_tag AS direct_tag
			ON direct_tag.realm_id = target_realm_id
			AND direct_tag.unit_id = target_unit_id
			AND direct_tag.tag_id = expression.focus_tag_id
		WHERE expression.id = target_expression_id
			AND expression.expression_kind = 'simple'
			AND expression.status = 'active'
			AND expression.sealed_at IS NOT NULL
	) INTO direct_exists;
	SELECT count(*)
	INTO accepted_application_count
	FROM public.realm_unit_tag_path_application AS application
	JOIN public.tag_path_sense AS sense ON sense.id = application.sense_id
	JOIN public.realm_unit_tag_path_application_judgment_stat AS judgment
		ON judgment.application_id = application.id
	WHERE application.realm_id = target_realm_id
		AND application.unit_id = target_unit_id
		AND sense.expression_id = target_expression_id
		AND sense.sealed_at IS NOT NULL
		AND judgment.score > 0
		AND judgment.vote_count > 0;
	IF direct_exists OR accepted_application_count > 0 THEN
		INSERT INTO public.realm_unit_expression_assertion(
			realm_id, unit_id, expression_id, direct, path_application_count, updated_at
		) VALUES (
			target_realm_id, target_unit_id, target_expression_id,
			direct_exists, accepted_application_count, clock_timestamp()
		)
		ON CONFLICT (realm_id, unit_id, expression_id) DO UPDATE SET
			direct = EXCLUDED.direct,
			path_application_count = EXCLUDED.path_application_count,
			updated_at = EXCLUDED.updated_at;
	ELSE
		DELETE FROM public.realm_unit_expression_assertion
		WHERE realm_id = target_realm_id AND unit_id = target_unit_id
			AND expression_id = target_expression_id;
	END IF;
	PERFORM public.refresh_realm_unit_effective_tags(target_realm_id, target_unit_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_realm_expression_from_direct()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	target_realm_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.realm_id ELSE NEW.realm_id END;
	target_unit_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	target_tag_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	target_expression_id uuid;
BEGIN
	SELECT id INTO target_expression_id
	FROM public.tag_expression
	WHERE expression_kind = 'simple' AND focus_tag_id = target_tag_id
		AND status = 'active' AND sealed_at IS NOT NULL;
	IF target_expression_id IS NULL THEN
		RAISE EXCEPTION 'A direct Realm Tag requires its sealed simple Expression'
			USING ERRCODE = '23514', CONSTRAINT = 'realm_unit_tag_simple_expression_required';
	END IF;
	PERFORM public.refresh_realm_unit_expression_assertion(
		target_realm_id, target_unit_id, target_expression_id
	);
	RETURN NULL;
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
	PERFORM public.lock_vote_hot_key('realm_path_vote:' || key_realm::text || ':' || key_path::text, 0);
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

CREATE OR REPLACE FUNCTION public.maintain_realm_tag_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_realm uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.realm_id ELSE NEW.realm_id END;
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_tag uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
	spoiler_delta bigint := 0;
	none_delta bigint := 0;
	minor_delta bigint := 0;
	major_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key(
		'realm_tag_stat:' || key_realm::text || ':' || key_unit::text || ':' || key_tag::text, 0
	);
	IF TG_OP <> 'INSERT' THEN
		IF OLD.fit_vote IS NOT NULL THEN score_delta := score_delta - OLD.fit_vote; count_delta := count_delta - 1; END IF;
		IF OLD.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta - 1;
			IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
			ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
			ELSE major_delta := major_delta - 1;
			END IF;
		END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		IF NEW.fit_vote IS NOT NULL THEN score_delta := score_delta + NEW.fit_vote; count_delta := count_delta + 1; END IF;
		IF NEW.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta + 1;
			IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
			ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
			ELSE major_delta := major_delta + 1;
			END IF;
		END IF;
	END IF;
	INSERT INTO public.realm_tag_judgment_stat(
		realm_id, unit_id, tag_id, score, vote_count, spoiler_vote_count,
		spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at
	) VALUES (
		key_realm, key_unit, key_tag, score_delta, count_delta, spoiler_delta,
		none_delta, minor_delta, major_delta, clock_timestamp()
	)
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

CREATE OR REPLACE FUNCTION public.guard_realm_tag_path_sense_adoption()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM public.tag_path_sense AS sense
		WHERE sense.id = NEW.sense_id AND sense.path_id = NEW.path_id
			AND sense.status = 'active' AND sense.sealed_at IS NOT NULL
			AND (sense.scope = 'global' OR (sense.scope = 'realm' AND sense.realm_id = NEW.realm_id))
	) THEN
		RAISE EXCEPTION 'Realm Sense adoption must preserve the Sense authority and Path identity'
			USING ERRCODE = '23514', CONSTRAINT = 'realm_tag_path_sense_authority';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_realm_unit_tag_path_application()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'UPDATE' AND (OLD.id, OLD.realm_id, OLD.unit_id, OLD.sense_id,
		OLD.created_by_profile_id, OLD.created_at) IS DISTINCT FROM
		(NEW.id, NEW.realm_id, NEW.unit_id, NEW.sense_id,
		NEW.created_by_profile_id, NEW.created_at) THEN
		RAISE EXCEPTION 'Realm Path Application identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'realm_unit_tag_path_application_identity_immutable';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_realm_application_expression()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	target_realm_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.realm_id ELSE NEW.realm_id END;
	target_unit_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	target_sense_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.sense_id ELSE NEW.sense_id END;
	target_expression_id uuid;
BEGIN
	SELECT expression_id INTO target_expression_id FROM public.tag_path_sense WHERE id = target_sense_id;
	IF target_expression_id IS NOT NULL THEN
		PERFORM public.refresh_realm_unit_expression_assertion(
			target_realm_id, target_unit_id, target_expression_id
		);
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_realm_unit_tag_path_application_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_application uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.application_id ELSE NEW.application_id END;
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
	target_realm_id uuid;
	target_unit_id uuid;
	target_expression_id uuid;
	target_path_id uuid;
BEGIN
	PERFORM public.lock_vote_hot_key('realm_path_application:' || key_application::text, 0);
	SELECT score, vote_count, score > 0 AND vote_count > 0
	INTO current_score, current_count, old_accepted
	FROM public.realm_unit_tag_path_application_judgment_stat
	WHERE application_id = key_application;
	current_score := coalesce(current_score, 0);
	current_count := coalesce(current_count, 0);
	old_accepted := coalesce(old_accepted, false);
	IF TG_OP <> 'INSERT' THEN
		IF OLD.fit_vote IS NOT NULL THEN score_delta := score_delta - OLD.fit_vote; count_delta := count_delta - 1; END IF;
		IF OLD.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta - 1;
			IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
			ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
			ELSE major_delta := major_delta - 1;
			END IF;
		END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		IF NEW.fit_vote IS NOT NULL THEN score_delta := score_delta + NEW.fit_vote; count_delta := count_delta + 1; END IF;
		IF NEW.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta + 1;
			IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
			ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
			ELSE major_delta := major_delta + 1;
			END IF;
		END IF;
	END IF;
	INSERT INTO public.realm_unit_tag_path_application_judgment_stat(
		application_id, score, vote_count, spoiler_vote_count,
		spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at
	) VALUES (
		key_application, score_delta, count_delta, spoiler_delta,
		none_delta, minor_delta, major_delta, clock_timestamp()
	)
	ON CONFLICT (application_id) DO UPDATE SET
		score = realm_unit_tag_path_application_judgment_stat.score + EXCLUDED.score,
		vote_count = realm_unit_tag_path_application_judgment_stat.vote_count + EXCLUDED.vote_count,
		spoiler_vote_count = realm_unit_tag_path_application_judgment_stat.spoiler_vote_count + EXCLUDED.spoiler_vote_count,
		spoiler_none_count = realm_unit_tag_path_application_judgment_stat.spoiler_none_count + EXCLUDED.spoiler_none_count,
		spoiler_minor_count = realm_unit_tag_path_application_judgment_stat.spoiler_minor_count + EXCLUDED.spoiler_minor_count,
		spoiler_major_count = realm_unit_tag_path_application_judgment_stat.spoiler_major_count + EXCLUDED.spoiler_major_count,
		updated_at = EXCLUDED.updated_at;
	new_accepted := current_score + score_delta > 0 AND current_count + count_delta > 0;
	IF old_accepted <> new_accepted THEN
		SELECT application.realm_id, application.unit_id, sense.expression_id, sense.path_id
		INTO target_realm_id, target_unit_id, target_expression_id, target_path_id
		FROM public.realm_unit_tag_path_application AS application
		JOIN public.tag_path_sense AS sense ON sense.id = application.sense_id
		WHERE application.id = key_application;
		IF target_path_id IS NOT NULL THEN
			INSERT INTO public.realm_tag_path_vote_stat(
				realm_id, path_id, usage_count, updated_at
			) VALUES (
				target_realm_id, target_path_id,
				CASE WHEN new_accepted THEN 1 ELSE -1 END, clock_timestamp()
			)
			ON CONFLICT (realm_id, path_id) DO UPDATE SET
				usage_count = realm_tag_path_vote_stat.usage_count + EXCLUDED.usage_count,
				updated_at = EXCLUDED.updated_at;
			PERFORM public.refresh_realm_unit_expression_assertion(
				target_realm_id, target_unit_id, target_expression_id
			);
		END IF;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_realm_tag_path_application_judgment_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF (OLD.application_id, OLD.profile_id) IS DISTINCT FROM (NEW.application_id, NEW.profile_id) THEN
		RAISE EXCEPTION 'Realm Application judgment identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'realm_tag_path_application_judgment_identity_immutable';
	END IF;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS realm_tag_path_vote_stat_maintain ON public.realm_tag_path_vote;
CREATE TRIGGER realm_tag_path_vote_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.realm_tag_path_vote
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_tag_path_vote_stat();

DROP TRIGGER IF EXISTS realm_unit_tag_expression_assertion_maintain ON public.realm_unit_tag;
CREATE TRIGGER realm_unit_tag_expression_assertion_maintain
AFTER INSERT OR DELETE ON public.realm_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_expression_from_direct();

DROP TRIGGER IF EXISTS realm_tag_judgment_stat_maintain ON public.realm_tag_judgment;
CREATE TRIGGER realm_tag_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.realm_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_tag_judgment_stat();

DROP TRIGGER IF EXISTS realm_tag_path_sense_adoption_guard ON public.realm_tag_path_sense;
CREATE TRIGGER realm_tag_path_sense_adoption_guard
BEFORE INSERT OR UPDATE ON public.realm_tag_path_sense
FOR EACH ROW EXECUTE FUNCTION public.guard_realm_tag_path_sense_adoption();

DROP TRIGGER IF EXISTS realm_unit_tag_path_application_guard ON public.realm_unit_tag_path_application;
CREATE TRIGGER realm_unit_tag_path_application_guard
BEFORE UPDATE ON public.realm_unit_tag_path_application
FOR EACH ROW EXECUTE FUNCTION public.guard_realm_unit_tag_path_application();

DROP TRIGGER IF EXISTS realm_unit_tag_path_application_expression_maintain ON public.realm_unit_tag_path_application;
CREATE TRIGGER realm_unit_tag_path_application_expression_maintain
AFTER INSERT OR DELETE ON public.realm_unit_tag_path_application
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_application_expression();

DROP TRIGGER IF EXISTS realm_unit_tag_path_application_judgment_identity_guard ON public.realm_unit_tag_path_application_judgment;
CREATE TRIGGER realm_unit_tag_path_application_judgment_identity_guard
BEFORE UPDATE ON public.realm_unit_tag_path_application_judgment
FOR EACH ROW EXECUTE FUNCTION public.protect_realm_tag_path_application_judgment_identity();

DROP TRIGGER IF EXISTS realm_unit_tag_path_application_judgment_stat_maintain ON public.realm_unit_tag_path_application_judgment;
CREATE TRIGGER realm_unit_tag_path_application_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.realm_unit_tag_path_application_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_unit_tag_path_application_judgment_stat();


-- Global direct-Tag judgments and bounded Expression retrieval projections.
-- Every refresh is routed by one Unit key; no statement scans the corpus.

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
		IF NOT pg_try_advisory_xact_lock(hashtextextended(
			hot_key.unit_id::text || ':' || hot_key.tag_id::text, 71001
		)) THEN
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
			hot_key.unit_id::text || ':' || hot_key.tag_id::text || ':' || hot_key.profile_id::text,
			71002
		)) THEN
			RAISE EXCEPTION 'Per-Profile vote key is busy'
				USING ERRCODE = '55P03', CONSTRAINT = 'vote_hot_key_busy';
		END IF;
	END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_effective_tags(target_unit_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	PERFORM public.lock_vote_hot_key('unit_effective_tags:' || target_unit_id::text, 0);
	DELETE FROM public.unit_effective_tag WHERE unit_id = target_unit_id;
	INSERT INTO public.unit_effective_tag(
		unit_id, tag_id, direct, primary_expression_count,
		entailed_expression_count, retrieval_expression_count, updated_at
	)
	SELECT target_unit_id,
		source.tag_id,
		bool_or(source.direct),
		count(DISTINCT source.expression_id) FILTER (WHERE source.evidence_kind = 'primary'),
		count(DISTINCT source.expression_id) FILTER (WHERE source.evidence_kind = 'entailed'),
		count(DISTINCT source.expression_id) FILTER (WHERE source.evidence_kind = 'retrieval_only'),
		clock_timestamp()
	FROM (
		SELECT direct_tag.tag_id, true AS direct, NULL::uuid AS expression_id,
			NULL::text AS evidence_kind
		FROM public.unit_tag AS direct_tag
		WHERE direct_tag.unit_id = target_unit_id
		UNION ALL
		SELECT effective.tag_id, false, assertion.expression_id, effective.evidence_kind
		FROM public.unit_expression_assertion AS assertion
		JOIN public.tag_expression_effective_tag AS effective
			ON effective.expression_id = assertion.expression_id
		WHERE assertion.unit_id = target_unit_id
	) AS source
	GROUP BY source.tag_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_expression_assertion(
	target_unit_id uuid,
	target_expression_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	direct_exists boolean;
	accepted_application_count bigint;
BEGIN
	PERFORM public.lock_vote_hot_key(
		'unit_expression_assertion:' || target_unit_id::text || ':' || target_expression_id::text,
		0
	);
	SELECT EXISTS (
		SELECT 1
		FROM public.tag_expression AS expression
		JOIN public.unit_tag AS direct_tag
			ON direct_tag.unit_id = target_unit_id
			AND direct_tag.tag_id = expression.focus_tag_id
		WHERE expression.id = target_expression_id
			AND expression.expression_kind = 'simple'
			AND expression.status = 'active'
			AND expression.sealed_at IS NOT NULL
	) INTO direct_exists;
	SELECT count(*)
	INTO accepted_application_count
	FROM public.unit_tag_path_application AS application
	JOIN public.tag_path_sense AS sense ON sense.id = application.sense_id
	JOIN public.unit_tag_path_application_judgment_stat AS judgment
		ON judgment.application_id = application.id
	WHERE application.unit_id = target_unit_id
		AND sense.expression_id = target_expression_id
		AND sense.sealed_at IS NOT NULL
		AND judgment.score > 0
		AND judgment.vote_count > 0;
	IF direct_exists OR accepted_application_count > 0 THEN
		INSERT INTO public.unit_expression_assertion(
			unit_id, expression_id, direct, path_application_count, updated_at
		) VALUES (
			target_unit_id, target_expression_id, direct_exists,
			accepted_application_count, clock_timestamp()
		)
		ON CONFLICT (unit_id, expression_id) DO UPDATE SET
			direct = EXCLUDED.direct,
			path_application_count = EXCLUDED.path_application_count,
			updated_at = EXCLUDED.updated_at;
	ELSE
		DELETE FROM public.unit_expression_assertion
		WHERE unit_id = target_unit_id AND expression_id = target_expression_id;
	END IF;
	PERFORM public.refresh_unit_effective_tags(target_unit_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_expression_from_direct()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	target_unit_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	target_tag_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	target_expression_id uuid;
BEGIN
	SELECT id INTO target_expression_id
	FROM public.tag_expression
	WHERE expression_kind = 'simple' AND focus_tag_id = target_tag_id
		AND status = 'active' AND sealed_at IS NOT NULL;
	IF target_expression_id IS NULL THEN
		RAISE EXCEPTION 'A direct Tag requires its sealed simple Expression'
			USING ERRCODE = '23514', CONSTRAINT = 'unit_tag_simple_expression_required';
	END IF;
	PERFORM public.refresh_unit_expression_assertion(target_unit_id, target_expression_id);
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_tag_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_tag uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
	spoiler_delta bigint := 0;
	none_delta bigint := 0;
	minor_delta bigint := 0;
	major_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key('unit_tag_stat:' || key_unit::text || ':' || key_tag::text, 0);
	IF TG_OP <> 'INSERT' THEN
		IF OLD.fit_vote IS NOT NULL THEN
			score_delta := score_delta - OLD.fit_vote;
			count_delta := count_delta - 1;
		END IF;
		IF OLD.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta - 1;
			IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
			ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
			ELSE major_delta := major_delta - 1;
			END IF;
		END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		IF NEW.fit_vote IS NOT NULL THEN
			score_delta := score_delta + NEW.fit_vote;
			count_delta := count_delta + 1;
		END IF;
		IF NEW.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta + 1;
			IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
			ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
			ELSE major_delta := major_delta + 1;
			END IF;
		END IF;
	END IF;
	INSERT INTO public.unit_tag_judgment_stat(
		unit_id, tag_id, score, vote_count, spoiler_vote_count,
		spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at
	) VALUES (
		key_unit, key_tag, score_delta, count_delta, spoiler_delta,
		none_delta, minor_delta, major_delta, clock_timestamp()
	)
	ON CONFLICT (unit_id, tag_id) DO UPDATE SET
		score = unit_tag_judgment_stat.score + EXCLUDED.score,
		vote_count = unit_tag_judgment_stat.vote_count + EXCLUDED.vote_count,
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
		ELSE major_delta := major_delta - 1;
		END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		count_delta := count_delta + 1;
		IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
		ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
		ELSE major_delta := major_delta + 1;
		END IF;
	END IF;
	INSERT INTO public.subject_association_judgment_stat(
		association_id, spoiler_vote_count, spoiler_none_count,
		spoiler_minor_count, spoiler_major_count, updated_at
	) VALUES (
		key_id, count_delta, none_delta, minor_delta, major_delta, clock_timestamp()
	)
	ON CONFLICT (association_id) DO UPDATE SET
		spoiler_vote_count = subject_association_judgment_stat.spoiler_vote_count + EXCLUDED.spoiler_vote_count,
		spoiler_none_count = subject_association_judgment_stat.spoiler_none_count + EXCLUDED.spoiler_none_count,
		spoiler_minor_count = subject_association_judgment_stat.spoiler_minor_count + EXCLUDED.spoiler_minor_count,
		spoiler_major_count = subject_association_judgment_stat.spoiler_major_count + EXCLUDED.spoiler_major_count,
		updated_at = EXCLUDED.updated_at;
	RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS unit_tag_expression_assertion_maintain ON public.unit_tag;
CREATE TRIGGER unit_tag_expression_assertion_maintain
AFTER INSERT OR DELETE ON public.unit_tag
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_expression_from_direct();

DROP TRIGGER IF EXISTS unit_tag_judgment_stat_maintain ON public.unit_tag_judgment;
CREATE TRIGGER unit_tag_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.unit_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_tag_judgment_stat();

DROP TRIGGER IF EXISTS subject_association_judgment_stat_maintain ON public.subject_association_judgment;
CREATE TRIGGER subject_association_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.subject_association_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_subject_association_judgment_stat();


-- Structural Tag Paths, immutable semantic definitions, global Applications,
-- and definition-scale inference closure. Path length never drives Unit fan-out.

CREATE OR REPLACE FUNCTION public.guard_tag_path_definition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	member_count integer;
	valid_relation_count integer;
BEGIN
	IF TG_OP <> 'INSERT' THEN
		RAISE EXCEPTION 'Tag Path definitions are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_definition_immutable';
	END IF;
	IF NOT EXISTS (
		SELECT 1 FROM public.unit WHERE id = NEW.id AND kind = 'tag_path'
	) THEN
		RAISE EXCEPTION 'Tag Path identity must reference a tag_path Unit'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_unit_kind';
	END IF;
	SELECT count(DISTINCT node.id)
	INTO member_count
	FROM unnest(NEW.member_node_ids) AS member(node_id)
	JOIN public.vocabulary_node AS node ON node.id = member.node_id
	WHERE node.status = 'active';
	IF member_count <> cardinality(NEW.member_node_ids) THEN
		RAISE EXCEPTION 'Every Path member must be a distinct active vocabulary node'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_member_eligibility';
	END IF;
	SELECT count(*)
	INTO valid_relation_count
	FROM generate_subscripts(NEW.relation_ids, 1) AS position(ordinal)
	JOIN public.tag_relation AS relation
		ON relation.id = NEW.relation_ids[position.ordinal]
		AND relation.parent_node_id = NEW.member_node_ids[position.ordinal]
		AND relation.child_node_id = NEW.member_node_ids[position.ordinal + 1]
		AND relation.status = 'active';
	IF valid_relation_count <> cardinality(NEW.relation_ids) THEN
		RAISE EXCEPTION 'Every Path edge must reference the active typed relation between adjacent nodes'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_relation_adjacency';
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
	INSERT INTO public.tag_path_member(path_id, ordinal, node_id, incoming_relation_id)
	SELECT NEW.id,
		member.ordinality - 1,
		member.node_id,
		CASE WHEN member.ordinality = 1 THEN NULL
			ELSE NEW.relation_ids[member.ordinality - 1]
		END
	FROM unnest(NEW.member_node_ids) WITH ORDINALITY AS member(node_id, ordinality);
	INSERT INTO public.tag_path_vote_stat(path_id, terminal_node_id)
	VALUES (NEW.id, NEW.terminal_node_id);
	RETURN NULL;
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

CREATE OR REPLACE FUNCTION public.guard_tag_path_vote_stat_projection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF pg_trigger_depth() < 2 THEN
		RAISE EXCEPTION 'tag_path_vote_stat is a trigger-owned ranking projection'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_vote_stat_projection_only';
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_vocabulary_node_path_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM public.tag_path_member WHERE node_id = OLD.id LIMIT 1
	) AND (TG_OP = 'DELETE' OR NEW.status <> 'active' OR NEW.kind <> OLD.kind) THEN
		RAISE EXCEPTION 'A vocabulary node used by a Path cannot be deleted, retired, or retyped'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_member_lifecycle';
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_relation_path_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM public.tag_path_member WHERE incoming_relation_id = OLD.id LIMIT 1
	) AND (
		TG_OP = 'DELETE' OR NEW.status <> 'active'
		OR (NEW.parent_node_id, NEW.child_node_id, NEW.relation_kind, NEW.revision)
			IS DISTINCT FROM
			(OLD.parent_node_id, OLD.child_node_id, OLD.relation_kind, OLD.revision)
	) THEN
		RAISE EXCEPTION 'A typed relation used by a Path is immutable and active'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_relation_lifecycle';
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_relation_graph()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	replaced_relation_id uuid := CASE WHEN TG_OP = 'UPDATE' THEN OLD.id ELSE NULL END;
BEGIN
	IF NEW.status <> 'active' THEN RETURN NEW; END IF;
	-- Relation writes are definition-scale and rare. Serializing them closes the
	-- write-skew window in which two concurrent inverse edges could both pass a
	-- read-only cycle check.
	PERFORM pg_advisory_xact_lock(hashtextextended('tag-relation-graph'::text, 0));
	IF EXISTS (
		WITH RECURSIVE descendant(node_id) AS (
			SELECT NEW.child_node_id
			UNION
			SELECT relation.child_node_id
			FROM descendant
			JOIN public.tag_relation AS relation
				ON relation.parent_node_id = descendant.node_id
			WHERE relation.status = 'active'
				AND (replaced_relation_id IS NULL OR relation.id <> replaced_relation_id)
		)
		SELECT 1 FROM descendant WHERE node_id = NEW.parent_node_id
	) THEN
		RAISE EXCEPTION 'Tag relation would create a vocabulary cycle'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_relation_cycle';
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
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_expression_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Tag Expression history is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_immutable';
	END IF;
	IF (
		OLD.id, OLD.expression_kind, OLD.canonical_claim_key, OLD.focus_tag_id,
		OLD.created_by_profile_id, OLD.created_at
	) IS DISTINCT FROM (
		NEW.id, NEW.expression_kind, NEW.canonical_claim_key, NEW.focus_tag_id,
		NEW.created_by_profile_id, NEW.created_at
	) THEN
		RAISE EXCEPTION 'Tag Expression semantics are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_semantics_immutable';
	END IF;
	IF OLD.sealed_at IS NULL AND NEW.sealed_at IS NOT NULL
		AND OLD.status = NEW.status AND OLD.retired_at IS NOT DISTINCT FROM NEW.retired_at THEN
		RETURN NEW;
	END IF;
	IF OLD.sealed_at IS NOT NULL AND NEW.sealed_at = OLD.sealed_at
		AND OLD.status = 'active' AND NEW.status = 'retired'
		AND OLD.retired_at IS NULL AND NEW.retired_at IS NOT NULL THEN
		RETURN NEW;
	END IF;
	RAISE EXCEPTION 'Invalid Tag Expression lifecycle transition'
		USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_lifecycle';
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_expression_argument_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP <> 'INSERT' OR EXISTS (
		SELECT 1 FROM public.tag_expression
		WHERE id = NEW.expression_id AND sealed_at IS NOT NULL
	) THEN
		RAISE EXCEPTION 'Sealed Tag Expression arguments are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_argument_immutable';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_expression_presentation_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Tag Expression presentation history is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_presentation_immutable';
	END IF;
	IF (
		OLD.id, OLD.expression_id, OLD.revision, OLD.created_by_profile_id, OLD.created_at
	) IS DISTINCT FROM (
		NEW.id, NEW.expression_id, NEW.revision, NEW.created_by_profile_id, NEW.created_at
	) THEN
		RAISE EXCEPTION 'Presentation revision identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_presentation_identity_immutable';
	END IF;
	IF OLD.sealed_at IS NULL AND NEW.sealed_at IS NOT NULL
		AND OLD.status = NEW.status AND OLD.retired_at IS NOT DISTINCT FROM NEW.retired_at THEN
		RETURN NEW;
	END IF;
	IF OLD.sealed_at IS NOT NULL AND NEW.sealed_at = OLD.sealed_at
		AND OLD.status = 'active' AND NEW.status = 'retired'
		AND OLD.retired_at IS NULL AND NEW.retired_at IS NOT NULL THEN
		RETURN NEW;
	END IF;
	RAISE EXCEPTION 'Invalid presentation revision lifecycle transition'
		USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_presentation_lifecycle';
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_expression_presentation_component_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	presentation_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.presentation_revision_id
		ELSE NEW.presentation_revision_id END;
BEGIN
	IF TG_OP <> 'INSERT' OR EXISTS (
		SELECT 1 FROM public.tag_expression_presentation_revision
		WHERE id = presentation_id AND sealed_at IS NOT NULL
	) THEN
		RAISE EXCEPTION 'Sealed presentation components are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_presentation_component_immutable';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_tag_expression_projection_rebuild(
	target_expression_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
	-- Do not create definition-only queue noise. Both probes use the inverse
	-- Expression indexes and stop after the first asserting authority key.
	IF NOT EXISTS (
		SELECT 1 FROM public.unit_expression_assertion
		WHERE expression_id = target_expression_id LIMIT 1
	) AND NOT EXISTS (
		SELECT 1 FROM public.realm_unit_expression_assertion
		WHERE expression_id = target_expression_id LIMIT 1
	) THEN
		RETURN;
	END IF;
	INSERT INTO public.tag_expression_projection_rebuild(
		expression_id, global_cursor_unit_id, global_complete,
		realm_cursor_realm_id, realm_cursor_unit_id, realm_complete,
		attempt_count, available_at, last_error_message, requested_at, updated_at
	) VALUES (
		target_expression_id, NULL, false, NULL, NULL, false,
		0, clock_timestamp(), NULL, clock_timestamp(), clock_timestamp()
	)
	ON CONFLICT (expression_id) DO UPDATE SET
		global_cursor_unit_id = NULL,
		global_complete = false,
		realm_cursor_realm_id = NULL,
		realm_cursor_unit_id = NULL,
		realm_complete = false,
		attempt_count = 0,
		available_at = EXCLUDED.available_at,
		last_error_message = NULL,
		requested_at = EXCLUDED.requested_at,
		updated_at = EXCLUDED.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_tag_expression_effective_tags(
	target_expression_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
	effective_tag_count integer;
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM public.tag_expression
		WHERE id = $1 AND sealed_at IS NOT NULL
	) THEN
		RAISE EXCEPTION 'Cannot build inference closure for an unsealed Expression'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_unsealed';
	END IF;
	DELETE FROM public.tag_expression_effective_tag
	WHERE expression_id = $1;
	IF EXISTS (
		SELECT 1 FROM public.tag_expression
		WHERE id = $1 AND status = 'retired'
	) THEN
		PERFORM public.enqueue_tag_expression_projection_rebuild($1);
		RETURN;
	END IF;
	INSERT INTO public.tag_expression_effective_tag(expression_id, tag_id, evidence_kind)
	WITH RECURSIVE reachable(expression_id, evidence_kind, trail, depth) AS (
		SELECT rule.target_expression_id,
			rule.inference_kind,
			ARRAY[$1, rule.target_expression_id],
			1
		FROM public.tag_expression_inference_rule AS rule
		WHERE rule.source_expression_id = $1
			AND rule.target_expression_id IS NOT NULL
			AND rule.status = 'active'
		UNION ALL
		SELECT rule.target_expression_id,
			CASE WHEN reachable.evidence_kind = 'retrieval_only'
				OR rule.inference_kind = 'retrieval_only'
				THEN 'retrieval_only' ELSE 'entailed' END,
			reachable.trail || rule.target_expression_id,
			reachable.depth + 1
		FROM reachable
		JOIN public.tag_expression_inference_rule AS rule
			ON rule.source_expression_id = reachable.expression_id
		WHERE rule.target_expression_id IS NOT NULL
			AND rule.status = 'active'
			AND reachable.depth < 64
			AND NOT rule.target_expression_id = ANY(reachable.trail)
	), candidates(tag_id, evidence_kind) AS (
		SELECT expression.focus_tag_id, 'primary'::text
		FROM public.tag_expression AS expression
		WHERE expression.id = $1
		UNION ALL
		SELECT rule.target_tag_id, rule.inference_kind
		FROM public.tag_expression_inference_rule AS rule
		WHERE rule.source_expression_id = $1
			AND rule.target_tag_id IS NOT NULL AND rule.status = 'active'
		UNION ALL
		SELECT expression.focus_tag_id, reachable.evidence_kind
		FROM reachable
		JOIN public.tag_expression AS expression ON expression.id = reachable.expression_id
		WHERE expression.status = 'active' AND expression.sealed_at IS NOT NULL
		UNION ALL
		SELECT rule.target_tag_id,
			CASE WHEN reachable.evidence_kind = 'retrieval_only'
				OR rule.inference_kind = 'retrieval_only'
				THEN 'retrieval_only' ELSE 'entailed' END
		FROM reachable
		JOIN public.tag_expression_inference_rule AS rule
			ON rule.source_expression_id = reachable.expression_id
		WHERE rule.target_tag_id IS NOT NULL AND rule.status = 'active'
	), strongest AS (
		SELECT DISTINCT ON (tag_id) tag_id, evidence_kind
		FROM candidates
		WHERE tag_id IS NOT NULL
		ORDER BY tag_id,
			CASE evidence_kind WHEN 'primary' THEN 0 WHEN 'entailed' THEN 1 ELSE 2 END
	)
	SELECT $1, tag_id, evidence_kind FROM strongest
	LIMIT 257;
	GET DIAGNOSTICS effective_tag_count = ROW_COUNT;
	IF effective_tag_count > 256 THEN
		RAISE EXCEPTION 'Expression inference closure exceeds 256 Effective Tags'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_effective_tag_limit';
	END IF;
	PERFORM public.enqueue_tag_expression_projection_rebuild($1);
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_tag_expression_inference_closure()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	changed_expression_id uuid;
	impacted_expression_id uuid;
BEGIN
	-- OLD and NEW are polymorphic records. PostgreSQL resolves every field used by
	-- one expression against the firing table, including unreachable CASE arms,
	-- so table-specific fields must only be touched in separate statements.
	IF TG_TABLE_NAME = 'tag_expression' THEN
		IF TG_OP = 'DELETE' THEN
			changed_expression_id := OLD.id;
		ELSE
			changed_expression_id := NEW.id;
			IF NEW.sealed_at IS NULL THEN RETURN NULL; END IF;
		END IF;
	ELSIF TG_TABLE_NAME = 'tag_expression_inference_rule' THEN
		IF TG_OP = 'DELETE' THEN
			changed_expression_id := OLD.source_expression_id;
		ELSE
			changed_expression_id := NEW.source_expression_id;
		END IF;
	ELSE
		RAISE EXCEPTION 'Unsupported inference closure trigger source: %', TG_TABLE_NAME
			USING ERRCODE = '55000';
	END IF;
	FOR impacted_expression_id IN
		WITH RECURSIVE impacted(expression_id, trail, depth) AS (
			SELECT changed_expression_id, ARRAY[changed_expression_id], 0
			UNION ALL
			SELECT rule.source_expression_id,
				impacted.trail || rule.source_expression_id,
				impacted.depth + 1
			FROM impacted
			JOIN public.tag_expression_inference_rule AS rule
				ON rule.target_expression_id = impacted.expression_id
			WHERE rule.status = 'active' AND impacted.depth < 64
				AND NOT rule.source_expression_id = ANY(impacted.trail)
		)
		SELECT DISTINCT expression_id FROM impacted ORDER BY expression_id
	LOOP
		IF EXISTS (
			SELECT 1 FROM public.tag_expression
			WHERE id = impacted_expression_id AND sealed_at IS NOT NULL
		) THEN
			PERFORM public.rebuild_tag_expression_effective_tags(impacted_expression_id);
		END IF;
	END LOOP;
	RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_tag_expression_projection_rebuild(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rebuild_tag_expression_effective_tags(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.guard_tag_expression_inference_graph()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	replaced_rule_id uuid := CASE WHEN TG_OP = 'UPDATE' THEN OLD.id ELSE NULL END;
	active_rule_count integer;
	ancestor_count integer;
	descendant_count integer;
	would_cycle boolean;
BEGIN
	IF NEW.status <> 'active' THEN RETURN NEW; END IF;
	-- Definition writes are rare. Serialize graph changes so concurrent inverse
	-- rules cannot both pass the cycle or fan-out checks under snapshot isolation.
	PERFORM pg_advisory_xact_lock(hashtextextended('tag-expression-inference-graph'::text, 0));
	SELECT count(*) INTO active_rule_count
	FROM (
		SELECT 1
		FROM public.tag_expression_inference_rule AS rule
		WHERE rule.source_expression_id = NEW.source_expression_id
			AND rule.status = 'active'
			AND (replaced_rule_id IS NULL OR rule.id <> replaced_rule_id)
		LIMIT 16
	) AS active_rule;
	IF active_rule_count >= 16 THEN
		RAISE EXCEPTION 'Expression has reached the 16 active inference-rule limit'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_inference_rule_limit';
	END IF;
	IF NEW.target_expression_id IS NULL THEN RETURN NEW; END IF;
	WITH RECURSIVE descendant(expression_id) AS (
			SELECT NEW.target_expression_id
			UNION
			SELECT rule.target_expression_id
			FROM descendant
			JOIN public.tag_expression_inference_rule AS rule
				ON rule.source_expression_id = descendant.expression_id
			WHERE rule.status = 'active'
				AND rule.target_expression_id IS NOT NULL
				AND (replaced_rule_id IS NULL OR rule.id <> replaced_rule_id)
		)
	SELECT count(*), coalesce(bool_or(expression_id = NEW.source_expression_id), false)
	INTO descendant_count, would_cycle
	FROM (SELECT expression_id FROM descendant LIMIT 65) AS bounded_descendant;
	IF would_cycle THEN
		RAISE EXCEPTION 'Inference rule would create an Expression cycle'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_inference_cycle';
	END IF;
	IF descendant_count > 64 THEN
		RAISE EXCEPTION 'Expression inference reach exceeds 64 downstream Expressions'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_inference_descendant_limit';
	END IF;
	WITH RECURSIVE ancestor(expression_id) AS (
		SELECT NEW.source_expression_id
		UNION
		SELECT rule.source_expression_id
		FROM ancestor
		JOIN public.tag_expression_inference_rule AS rule
			ON rule.target_expression_id = ancestor.expression_id
		WHERE rule.status = 'active'
			AND (replaced_rule_id IS NULL OR rule.id <> replaced_rule_id)
	)
	SELECT count(*) INTO ancestor_count
	FROM (SELECT expression_id FROM ancestor LIMIT 65) AS bounded_ancestor;
	IF ancestor_count > 64 THEN
		RAISE EXCEPTION 'Expression inference reach exceeds 64 upstream Expressions'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_inference_ancestor_limit';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_expression_inference_rule_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Inference-rule revision history is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_inference_rule_immutable';
	END IF;
	IF (
		OLD.id, OLD.source_expression_id, OLD.target_tag_id, OLD.target_expression_id,
		OLD.inference_kind, OLD.revision, OLD.provenance, OLD.created_by_profile_id, OLD.created_at
	) IS DISTINCT FROM (
		NEW.id, NEW.source_expression_id, NEW.target_tag_id, NEW.target_expression_id,
		NEW.inference_kind, NEW.revision, NEW.provenance, NEW.created_by_profile_id, NEW.created_at
	) OR NOT (
		OLD.status = 'active' AND NEW.status = 'retired'
		AND OLD.retired_at IS NULL AND NEW.retired_at IS NOT NULL
	) THEN
		RAISE EXCEPTION 'Inference rules can only transition from active to retired'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_expression_inference_rule_lifecycle';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_path_sense_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	valid_binding_count integer;
	stored_binding_count integer;
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Path Sense history is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_sense_immutable';
	END IF;
	IF (
		OLD.id, OLD.path_id, OLD.expression_id, OLD.scope, OLD.realm_id,
		OLD.binding_signature, OLD.provenance, OLD.created_by_profile_id, OLD.created_at
	) IS DISTINCT FROM (
		NEW.id, NEW.path_id, NEW.expression_id, NEW.scope, NEW.realm_id,
		NEW.binding_signature, NEW.provenance, NEW.created_by_profile_id, NEW.created_at
	) THEN
		RAISE EXCEPTION 'Path Sense semantics are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_sense_semantics_immutable';
	END IF;
	IF OLD.sealed_at IS NULL AND NEW.sealed_at IS NOT NULL
		AND OLD.status = NEW.status AND OLD.retired_at IS NOT DISTINCT FROM NEW.retired_at THEN
		SELECT count(*) INTO stored_binding_count
		FROM public.tag_path_sense_binding WHERE sense_id = NEW.id;
		SELECT count(*) INTO valid_binding_count
		FROM public.tag_path_sense_binding AS binding
		JOIN public.tag_path_member AS member
			ON member.path_id = NEW.path_id AND member.ordinal = binding.member_ordinal
		JOIN public.tag_expression_argument AS argument
			ON argument.expression_id = NEW.expression_id
			AND argument.role = binding.argument_role
			AND argument.ordinal = binding.argument_ordinal
			AND argument.tag_id = member.node_id
		WHERE binding.sense_id = NEW.id;
		IF stored_binding_count = 0 OR valid_binding_count <> stored_binding_count THEN
			RAISE EXCEPTION 'Every Path Sense binding must match a Path concept and Expression argument'
				USING ERRCODE = '23514', CONSTRAINT = 'tag_path_sense_binding_invalid';
		END IF;
		RETURN NEW;
	END IF;
	IF OLD.sealed_at IS NOT NULL AND NEW.sealed_at = OLD.sealed_at
		AND OLD.status = 'active' AND NEW.status = 'retired'
		AND OLD.retired_at IS NULL AND NEW.retired_at IS NOT NULL THEN
		RETURN NEW;
	END IF;
	RAISE EXCEPTION 'Invalid Path Sense lifecycle transition'
		USING ERRCODE = '23514', CONSTRAINT = 'tag_path_sense_lifecycle';
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_path_sense_binding_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP <> 'INSERT' OR EXISTS (
		SELECT 1 FROM public.tag_path_sense WHERE id = NEW.sense_id AND sealed_at IS NOT NULL
	) THEN
		RAISE EXCEPTION 'Sealed Path Sense bindings are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_sense_binding_immutable';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_unit_tag_path_application()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP = 'INSERT' AND NOT EXISTS (
		SELECT 1 FROM public.tag_path_sense
		WHERE id = NEW.sense_id AND scope = 'global' AND status = 'active' AND sealed_at IS NOT NULL
	) THEN
		RAISE EXCEPTION 'A global Application requires an active sealed global Path Sense'
			USING ERRCODE = '23514', CONSTRAINT = 'unit_tag_path_application_sense_scope';
	END IF;
	IF TG_OP = 'UPDATE' AND (OLD.id, OLD.unit_id, OLD.sense_id, OLD.created_by_profile_id, OLD.created_at)
		IS DISTINCT FROM
		(NEW.id, NEW.unit_id, NEW.sense_id, NEW.created_by_profile_id, NEW.created_at) THEN
		RAISE EXCEPTION 'Path Application identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'unit_tag_path_application_identity_immutable';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_application_expression()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	target_unit_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	target_sense_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.sense_id ELSE NEW.sense_id END;
	target_expression_id uuid;
BEGIN
	SELECT expression_id INTO target_expression_id
	FROM public.tag_path_sense WHERE id = target_sense_id;
	IF target_expression_id IS NOT NULL THEN
		PERFORM public.refresh_unit_expression_assertion(target_unit_id, target_expression_id);
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_tag_path_application_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_application uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.application_id ELSE NEW.application_id END;
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
	target_unit_id uuid;
	target_expression_id uuid;
	target_path_id uuid;
BEGIN
	PERFORM public.lock_vote_hot_key('unit_path_application:' || key_application::text, 0);
	SELECT score, vote_count, score > 0 AND vote_count > 0
	INTO current_score, current_count, old_accepted
	FROM public.unit_tag_path_application_judgment_stat
	WHERE application_id = key_application;
	current_score := coalesce(current_score, 0);
	current_count := coalesce(current_count, 0);
	old_accepted := coalesce(old_accepted, false);
	IF TG_OP <> 'INSERT' THEN
		IF OLD.fit_vote IS NOT NULL THEN
			score_delta := score_delta - OLD.fit_vote; count_delta := count_delta - 1;
		END IF;
		IF OLD.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta - 1;
			IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
			ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
			ELSE major_delta := major_delta - 1;
			END IF;
		END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		IF NEW.fit_vote IS NOT NULL THEN
			score_delta := score_delta + NEW.fit_vote; count_delta := count_delta + 1;
		END IF;
		IF NEW.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta + 1;
			IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
			ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
			ELSE major_delta := major_delta + 1;
			END IF;
		END IF;
	END IF;
	INSERT INTO public.unit_tag_path_application_judgment_stat(
		application_id, score, vote_count, spoiler_vote_count,
		spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at
	) VALUES (
		key_application, score_delta, count_delta, spoiler_delta,
		none_delta, minor_delta, major_delta, clock_timestamp()
	)
	ON CONFLICT (application_id) DO UPDATE SET
		score = unit_tag_path_application_judgment_stat.score + EXCLUDED.score,
		vote_count = unit_tag_path_application_judgment_stat.vote_count + EXCLUDED.vote_count,
		spoiler_vote_count = unit_tag_path_application_judgment_stat.spoiler_vote_count + EXCLUDED.spoiler_vote_count,
		spoiler_none_count = unit_tag_path_application_judgment_stat.spoiler_none_count + EXCLUDED.spoiler_none_count,
		spoiler_minor_count = unit_tag_path_application_judgment_stat.spoiler_minor_count + EXCLUDED.spoiler_minor_count,
		spoiler_major_count = unit_tag_path_application_judgment_stat.spoiler_major_count + EXCLUDED.spoiler_major_count,
		updated_at = EXCLUDED.updated_at;
	new_accepted := current_score + score_delta > 0 AND current_count + count_delta > 0;
	IF old_accepted <> new_accepted THEN
		SELECT application.unit_id, sense.expression_id, sense.path_id
		INTO target_unit_id, target_expression_id, target_path_id
		FROM public.unit_tag_path_application AS application
		JOIN public.tag_path_sense AS sense ON sense.id = application.sense_id
		WHERE application.id = key_application;
		IF target_path_id IS NOT NULL THEN
			UPDATE public.tag_path_vote_stat
			SET usage_count = usage_count + CASE WHEN new_accepted THEN 1 ELSE -1 END,
				updated_at = clock_timestamp()
			WHERE path_id = target_path_id;
			PERFORM public.refresh_unit_expression_assertion(target_unit_id, target_expression_id);
		END IF;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_unit_tag_path_application_judgment_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF (OLD.application_id, OLD.profile_id) IS DISTINCT FROM (NEW.application_id, NEW.profile_id) THEN
		RAISE EXCEPTION 'Application judgment identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'unit_tag_path_application_judgment_identity_immutable';
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
	IF TG_OP = 'UPDATE' AND (
		(OLD.source_path_id, OLD.target_path_id, OLD.reason, OLD.proposal_source_kind,
			OLD.proposal_provenance, OLD.proposed_by_profile_id, OLD.created_at)
		IS DISTINCT FROM
		(NEW.source_path_id, NEW.target_path_id, NEW.reason, NEW.proposal_source_kind,
			NEW.proposal_provenance, NEW.proposed_by_profile_id, NEW.created_at)
		OR NOT (
			(OLD.status = 'proposed' AND NEW.status IN ('accepted', 'rejected'))
			OR (OLD.status = 'accepted' AND NEW.status = 'reversed')
		)
	) THEN
		RAISE EXCEPTION 'Invalid Tag Path merge transition'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_merge_transition';
	END IF;
	IF NEW.status = 'accepted' AND EXISTS (
		WITH RECURSIVE chain(path_id, trail, depth) AS (
			SELECT NEW.target_path_id, ARRAY[NEW.target_path_id], 0
			UNION ALL
			SELECT merge.target_path_id, chain.trail || merge.target_path_id, chain.depth + 1
			FROM chain
			JOIN public.tag_path_merge AS merge
				ON merge.source_path_id = chain.path_id AND merge.status = 'accepted'
			WHERE chain.depth < 64 AND NOT merge.target_path_id = ANY(chain.trail)
		)
		SELECT 1 FROM chain WHERE path_id = NEW.source_path_id
	) THEN
		RAISE EXCEPTION 'Tag Path merge would create a cycle'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_merge_cycle';
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

DROP TRIGGER IF EXISTS vocabulary_node_path_lifecycle_guard ON public.vocabulary_node;
CREATE TRIGGER vocabulary_node_path_lifecycle_guard
BEFORE UPDATE OR DELETE ON public.vocabulary_node
FOR EACH ROW EXECUTE FUNCTION public.guard_vocabulary_node_path_lifecycle();

DROP TRIGGER IF EXISTS tag_relation_path_lifecycle_guard ON public.tag_relation;
CREATE TRIGGER tag_relation_path_lifecycle_guard
BEFORE UPDATE OR DELETE ON public.tag_relation
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_relation_path_lifecycle();

DROP TRIGGER IF EXISTS tag_relation_graph_guard ON public.tag_relation;
CREATE TRIGGER tag_relation_graph_guard
BEFORE INSERT OR UPDATE ON public.tag_relation
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_relation_graph();

DROP TRIGGER IF EXISTS tag_path_vote_stat_maintain ON public.tag_path_vote;
CREATE TRIGGER tag_path_vote_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.tag_path_vote
FOR EACH ROW EXECUTE FUNCTION public.maintain_tag_path_vote_stat();

DROP TRIGGER IF EXISTS tag_path_vote_stat_projection_guard ON public.tag_path_vote_stat;
CREATE TRIGGER tag_path_vote_stat_projection_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path_vote_stat
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_vote_stat_projection();

DROP TRIGGER IF EXISTS tag_expression_mutation_guard ON public.tag_expression;
CREATE TRIGGER tag_expression_mutation_guard
BEFORE UPDATE OR DELETE ON public.tag_expression
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_expression_mutation();

DROP TRIGGER IF EXISTS tag_expression_argument_mutation_guard ON public.tag_expression_argument;
CREATE TRIGGER tag_expression_argument_mutation_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_expression_argument
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_expression_argument_mutation();

DROP TRIGGER IF EXISTS tag_expression_presentation_mutation_guard ON public.tag_expression_presentation_revision;
CREATE TRIGGER tag_expression_presentation_mutation_guard
BEFORE UPDATE OR DELETE ON public.tag_expression_presentation_revision
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_expression_presentation_mutation();

DROP TRIGGER IF EXISTS tag_expression_label_component_mutation_guard ON public.tag_expression_label_component;
CREATE TRIGGER tag_expression_label_component_mutation_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_expression_label_component
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_expression_presentation_component_mutation();

DROP TRIGGER IF EXISTS tag_expression_group_key_mutation_guard ON public.tag_expression_group_key;
CREATE TRIGGER tag_expression_group_key_mutation_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_expression_group_key
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_expression_presentation_component_mutation();

DROP TRIGGER IF EXISTS tag_expression_closure_from_definition ON public.tag_expression;
CREATE TRIGGER tag_expression_closure_from_definition
AFTER UPDATE OF sealed_at, status ON public.tag_expression
FOR EACH ROW EXECUTE FUNCTION public.maintain_tag_expression_inference_closure();

DROP TRIGGER IF EXISTS tag_expression_inference_rule_mutation_guard ON public.tag_expression_inference_rule;
CREATE TRIGGER tag_expression_inference_rule_mutation_guard
BEFORE UPDATE OR DELETE ON public.tag_expression_inference_rule
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_expression_inference_rule_mutation();

DROP TRIGGER IF EXISTS tag_expression_inference_graph_guard ON public.tag_expression_inference_rule;
CREATE TRIGGER tag_expression_inference_graph_guard
BEFORE INSERT OR UPDATE ON public.tag_expression_inference_rule
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_expression_inference_graph();

DROP TRIGGER IF EXISTS tag_expression_closure_from_rule ON public.tag_expression_inference_rule;
CREATE TRIGGER tag_expression_closure_from_rule
AFTER INSERT OR UPDATE OR DELETE ON public.tag_expression_inference_rule
FOR EACH ROW EXECUTE FUNCTION public.maintain_tag_expression_inference_closure();

DROP TRIGGER IF EXISTS tag_path_sense_mutation_guard ON public.tag_path_sense;
CREATE TRIGGER tag_path_sense_mutation_guard
BEFORE UPDATE OR DELETE ON public.tag_path_sense
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_sense_mutation();

DROP TRIGGER IF EXISTS tag_path_sense_binding_mutation_guard ON public.tag_path_sense_binding;
CREATE TRIGGER tag_path_sense_binding_mutation_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path_sense_binding
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_sense_binding_mutation();

DROP TRIGGER IF EXISTS unit_tag_path_application_guard ON public.unit_tag_path_application;
CREATE TRIGGER unit_tag_path_application_guard
BEFORE INSERT OR UPDATE ON public.unit_tag_path_application
FOR EACH ROW EXECUTE FUNCTION public.guard_unit_tag_path_application();

DROP TRIGGER IF EXISTS unit_tag_path_application_expression_maintain ON public.unit_tag_path_application;
CREATE TRIGGER unit_tag_path_application_expression_maintain
AFTER INSERT OR DELETE ON public.unit_tag_path_application
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_application_expression();

DROP TRIGGER IF EXISTS unit_tag_path_application_judgment_identity_guard ON public.unit_tag_path_application_judgment;
CREATE TRIGGER unit_tag_path_application_judgment_identity_guard
BEFORE UPDATE ON public.unit_tag_path_application_judgment
FOR EACH ROW EXECUTE FUNCTION public.protect_unit_tag_path_application_judgment_identity();

DROP TRIGGER IF EXISTS unit_tag_path_application_judgment_stat_maintain ON public.unit_tag_path_application_judgment;
CREATE TRIGGER unit_tag_path_application_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.unit_tag_path_application_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_tag_path_application_judgment_stat();

DROP TRIGGER IF EXISTS tag_path_merge_guard ON public.tag_path_merge;
CREATE TRIGGER tag_path_merge_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path_merge
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_merge();


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

DROP TRIGGER IF EXISTS profile_unit_tag_application_policy_guard ON public.profile_unit_tag;
CREATE TRIGGER profile_unit_tag_application_policy_guard
BEFORE INSERT OR UPDATE ON public.profile_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.guard_direct_tag_application_policy();

DROP TRIGGER IF EXISTS unit_tag_judgment_content_label_reject ON public.unit_tag_judgment;
CREATE TRIGGER unit_tag_judgment_content_label_reject
BEFORE INSERT OR UPDATE ON public.unit_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.reject_content_label_judgment();

DROP TRIGGER IF EXISTS realm_tag_judgment_content_label_reject ON public.realm_tag_judgment;
CREATE TRIGGER realm_tag_judgment_content_label_reject
BEFORE INSERT OR UPDATE ON public.realm_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.reject_content_label_judgment();


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

-- Every released Tag has a sealed simple Expression. The claim key is semantic
-- data; localized titles continue to be resolved from Tag localizations.
INSERT INTO public.tag_expression(
	expression_kind, canonical_claim_key, focus_tag_id, created_at
)
SELECT 'simple', 'tag:' || tag.id::text, tag.id, tag.created_at
FROM public.tag AS tag;

INSERT INTO public.tag_expression_argument(expression_id, role, ordinal, tag_id)
SELECT expression.id, 'focus', 0, expression.focus_tag_id
FROM public.tag_expression AS expression
WHERE expression.expression_kind = 'simple';

UPDATE public.tag_expression
SET sealed_at = COALESCE(sealed_at, created_at)
WHERE expression_kind = 'simple' AND sealed_at IS NULL;

INSERT INTO public.tag_expression_presentation_revision(
	expression_id, revision, created_at
)
SELECT expression.id, 1, expression.created_at
FROM public.tag_expression AS expression
WHERE expression.expression_kind = 'simple';

INSERT INTO public.tag_expression_label_component(
	presentation_revision_id, ordinal, tag_id, semantic_role, component_kind
)
SELECT presentation.id, 0, expression.focus_tag_id, 'focus', 'required'
FROM public.tag_expression_presentation_revision AS presentation
JOIN public.tag_expression AS expression ON expression.id = presentation.expression_id
WHERE expression.expression_kind = 'simple'
	AND presentation.revision = 1;

UPDATE public.tag_expression_presentation_revision AS presentation
SET sealed_at = COALESCE(presentation.sealed_at, presentation.created_at)
FROM public.tag_expression AS expression
WHERE expression.id = presentation.expression_id
	AND expression.expression_kind = 'simple'
	AND presentation.sealed_at IS NULL;

-- Populate direct assertion projections set-wise from their released sources.
INSERT INTO public.unit_expression_assertion(
	unit_id, expression_id, direct, path_application_count, created_at, updated_at
)
SELECT direct_tag.unit_id, expression.id, true, 0,
	direct_tag.created_at, direct_tag.updated_at
FROM public.unit_tag AS direct_tag
JOIN public.tag_expression AS expression
	ON expression.expression_kind = 'simple'
	AND expression.focus_tag_id = direct_tag.tag_id;

INSERT INTO public.realm_unit_expression_assertion(
	realm_id, unit_id, expression_id, direct, path_application_count,
	created_at, updated_at
)
SELECT direct_tag.realm_id, direct_tag.unit_id, expression.id, true, 0,
	direct_tag.created_at, direct_tag.updated_at
FROM public.realm_unit_tag AS direct_tag
JOIN public.tag_expression AS expression
	ON expression.expression_kind = 'simple'
	AND expression.focus_tag_id = direct_tag.tag_id;

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

-- The cutover seeded assertions after the canonical closure functions were
-- installed. Rebuild each definition-scale closure once so asserted Expressions
-- enter the bounded, restartable Unit/Realm projection queue.
SELECT public.rebuild_tag_expression_effective_tags(expression.id)
FROM public.tag_expression AS expression
WHERE expression.status = 'active' AND expression.sealed_at IS NOT NULL
ORDER BY expression.id;
