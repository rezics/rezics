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

-- Tag Path was an unreleased development preview. Remove its source facts and
-- projections rather than guessing semantic Expressions for legacy routes.
DROP TABLE IF EXISTS public.realm_unit_tag_path_support CASCADE;
DROP TABLE IF EXISTS public.realm_unit_tag_path_judgment_stat CASCADE;
DROP TABLE IF EXISTS public.realm_unit_tag_path_judgment CASCADE;
DROP TABLE IF EXISTS public.realm_unit_tag_path CASCADE;
DROP TABLE IF EXISTS public.realm_tag_path_vote_stat CASCADE;
DROP TABLE IF EXISTS public.realm_tag_path_vote CASCADE;
DROP TABLE IF EXISTS public.realm_tag_path CASCADE;
DROP TABLE IF EXISTS public.unit_tag_path_support CASCADE;
DROP TABLE IF EXISTS public.unit_tag_path_judgment_stat CASCADE;
DROP TABLE IF EXISTS public.unit_tag_path_judgment CASCADE;
DROP TABLE IF EXISTS public.unit_tag_path CASCADE;
DROP TABLE IF EXISTS public.tag_path_vote_stat CASCADE;
DROP TABLE IF EXISTS public.tag_path_vote CASCADE;
DROP TABLE IF EXISTS public.tag_path_merge CASCADE;
DROP TABLE IF EXISTS public.tag_path_edge CASCADE;
DROP TABLE IF EXISTS public.tag_path_member CASCADE;
DROP TABLE IF EXISTS public.tag_path CASCADE;
DROP TABLE IF EXISTS public.unit_effective_tag_vote CASCADE;

-- The Path subtype is owned by the preview. Other released Unit kinds and all
-- direct Tag assertions are outside this destructive boundary.
DELETE FROM public.unit WHERE kind = 'tag_path';

-- Preserve only released direct evidence in rebuildable effective projections.
DELETE FROM public.unit_effective_tag WHERE NOT direct;
UPDATE public.unit_effective_tag SET structure_support_count = 0 WHERE direct;

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

-- Add value to enum type: "platform_capability"
ALTER TYPE "platform_capability" ADD VALUE 'platform.zone_theme.review' AFTER 'platform.development_preview.access';
-- Add value to enum type: "platform_capability"
ALTER TYPE "platform_capability" ADD VALUE 'platform.zone_theme.kill' AFTER 'platform.zone_theme.review';
-- Add value to enum type: "unit_permission"
ALTER TYPE "unit_permission" ADD VALUE 'zone.pages.manage' AFTER 'unit.realm-publication.manage';
-- Add value to enum type: "unit_permission"
ALTER TYPE "unit_permission" ADD VALUE 'zone.theme.manage' AFTER 'zone.pages.manage';
-- Create enum type "realm_tag_fallback_policy"
CREATE TYPE "realm_tag_fallback_policy" AS ENUM ('inherit', 'isolate');
-- Create index "book_release_status_id_idx" to table: "book"
CREATE INDEX "book_release_status_id_idx" ON "book" ("release_status", "id");
-- Modify "profile_preference" table
ALTER TABLE "profile_preference" ADD COLUMN "custom_zone_themes_enabled" boolean NOT NULL DEFAULT true, ADD COLUMN "always_show_spoilers" boolean NOT NULL DEFAULT false, ADD COLUMN "always_show_nsfw" boolean NOT NULL DEFAULT false;
-- Create index "realm_unit_tag_tag_route_idx" to table: "realm_unit_tag"
CREATE INDEX "realm_unit_tag_tag_route_idx" ON "realm_unit_tag" ("tag_id", "realm_id", "unit_id");
-- Modify "unit" table
ALTER TABLE "unit" DROP CONSTRAINT "unit_kind_check", ADD CONSTRAINT "unit_kind_check" CHECK (kind = ANY (ARRAY['slug_namespace'::text, 'profile'::text, 'book'::text, 'software'::text, 'media'::text, 'video'::text, 'audio'::text, 'release'::text, 'entity'::text, 'label'::text, 'tag'::text, 'tag_path'::text, 'series'::text, 'zone'::text, 'zone_page'::text, 'zone_theme'::text, 'collection'::text, 'post'::text, 'poll'::text, 'realm'::text, 'realm_rule'::text]));
-- Modify "unit_access_invitation" table
ALTER TABLE "unit_access_invitation" DROP CONSTRAINT "unit_access_invitation_permissions_check", ADD CONSTRAINT "unit_access_invitation_permissions_check" CHECK (((cardinality(permissions) >= 1) AND (cardinality(permissions) <= 28)) AND (array_position(permissions, 'unit.ownership.transfer'::unit_permission) IS NULL) AND (array_position(permissions, 'unit.delete'::unit_permission) IS NULL));
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
-- Create "zone_theme" table
CREATE TABLE "zone_theme" (
  "id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "zone_theme_id_unit_id_fkey" FOREIGN KEY ("id") REFERENCES "unit" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create "zone_theme_revision" table
CREATE TABLE "zone_theme_revision" (
  "id" uuid NOT NULL DEFAULT uuidv7(),
  "theme_unit_id" uuid NOT NULL,
  "contract_version" text NOT NULL,
  "source_css" text NOT NULL,
  "transformed_css" text NOT NULL,
  "sha256" text NOT NULL,
  "state" text NOT NULL DEFAULT 'pending_automated',
  "automated_review" jsonb NOT NULL,
  "render_review" jsonb NULL,
  "ai_review" jsonb NULL,
  "submitted_by_profile_id" uuid NOT NULL,
  "human_reviewed_by_profile_id" uuid NULL,
  "human_reviewed_at" timestamptz(3) NULL,
  "decision_reason" text NULL,
  "killed_by_profile_id" uuid NULL,
  "killed_at" timestamptz(3) NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  "updated_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("id"),
  CONSTRAINT "zone_theme_revision_CE0z2L81XT9c_fkey" FOREIGN KEY ("human_reviewed_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "zone_theme_revision_killed_by_profile_id_profile_id_fkey" FOREIGN KEY ("killed_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "zone_theme_revision_submitted_by_profile_id_profile_id_fkey" FOREIGN KEY ("submitted_by_profile_id") REFERENCES "profile" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "zone_theme_revision_theme_unit_id_zone_theme_id_fkey" FOREIGN KEY ("theme_unit_id") REFERENCES "zone_theme" ("id") ON UPDATE NO ACTION ON DELETE CASCADE,
  CONSTRAINT "zone_theme_revision_ai_review_json_object_check" CHECK ((ai_review IS NULL) OR (jsonb_typeof(ai_review) = 'object'::text)),
  CONSTRAINT "zone_theme_revision_human_review_shape_check" CHECK ((human_reviewed_at IS NULL) = (human_reviewed_by_profile_id IS NULL)),
  CONSTRAINT "zone_theme_revision_kill_shape_check" CHECK ((killed_at IS NULL) = (killed_by_profile_id IS NULL)),
  CONSTRAINT "zone_theme_revision_render_review_json_object_check" CHECK ((render_review IS NULL) OR (jsonb_typeof(render_review) = 'object'::text)),
  CONSTRAINT "zone_theme_revision_sha256_check" CHECK (sha256 ~ '^[0-9a-f]{64}$'::text),
  CONSTRAINT "zone_theme_revision_source_size_check" CHECK (octet_length(source_css) <= 65536),
  CONSTRAINT "zone_theme_revision_state_check" CHECK (state = ANY (ARRAY['pending_automated'::text, 'pending_human'::text, 'approved'::text, 'rejected'::text, 'killed'::text, 'revalidation_required'::text])),
  CONSTRAINT "zone_theme_revision_transformed_size_check" CHECK (octet_length(transformed_css) <= 65536)
);
-- Create index "zone_theme_revision_approved_contract_id_idx" to table: "zone_theme_revision"
CREATE INDEX "zone_theme_revision_approved_contract_id_idx" ON "zone_theme_revision" ("contract_version", "id") WHERE (state = 'approved'::text);
-- Create index "zone_theme_revision_review_queue_idx" to table: "zone_theme_revision"
CREATE INDEX "zone_theme_revision_review_queue_idx" ON "zone_theme_revision" ("id") WHERE (state = ANY (ARRAY['pending_automated'::text, 'pending_human'::text, 'revalidation_required'::text]));
-- Create index "zone_theme_revision_theme_id_idx" to table: "zone_theme_revision"
CREATE INDEX "zone_theme_revision_theme_id_idx" ON "zone_theme_revision" ("theme_unit_id", "id");
-- Create "zone_theme_revision_asset" table
CREATE TABLE "zone_theme_revision_asset" (
  "revision_id" uuid NOT NULL,
  "asset_id" uuid NOT NULL,
  "created_at" timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY ("revision_id", "asset_id"),
  CONSTRAINT "zone_theme_revision_asset_asset_id_image_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "image_asset" ("id") ON UPDATE NO ACTION ON DELETE RESTRICT,
  CONSTRAINT "zone_theme_revision_asset_qw0FLvzGu7k2_fkey" FOREIGN KEY ("revision_id") REFERENCES "zone_theme_revision" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);
-- Create index "zone_theme_revision_asset_asset_idx" to table: "zone_theme_revision_asset"
CREATE INDEX "zone_theme_revision_asset_asset_idx" ON "zone_theme_revision_asset" ("asset_id", "revision_id");
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

-- Every released Tag has a sealed simple Expression. The claim key is semantic
-- data; localized titles continue to be resolved from Tag localizations.
INSERT INTO public.tag_expression(
	expression_kind, canonical_claim_key, focus_tag_id, created_at
)
SELECT 'simple', 'tag:' || tag.id::text, tag.id, tag.created_at
FROM public.tag AS tag
ON CONFLICT (canonical_claim_key) DO NOTHING;

INSERT INTO public.tag_expression_argument(expression_id, role, ordinal, tag_id)
SELECT expression.id, 'focus', 0, expression.focus_tag_id
FROM public.tag_expression AS expression
WHERE expression.expression_kind = 'simple'
ON CONFLICT DO NOTHING;

UPDATE public.tag_expression
SET sealed_at = COALESCE(sealed_at, created_at)
WHERE expression_kind = 'simple' AND sealed_at IS NULL;

INSERT INTO public.tag_expression_presentation_revision(
	expression_id, revision, created_at
)
SELECT expression.id, 1, expression.created_at
FROM public.tag_expression AS expression
WHERE expression.expression_kind = 'simple'
	AND NOT EXISTS (
		SELECT 1
		FROM public.tag_expression_presentation_revision AS presentation
		WHERE presentation.expression_id = expression.id
	);

INSERT INTO public.tag_expression_label_component(
	presentation_revision_id, ordinal, tag_id, semantic_role, component_kind
)
SELECT presentation.id, 0, expression.focus_tag_id, 'focus', 'required'
FROM public.tag_expression_presentation_revision AS presentation
JOIN public.tag_expression AS expression ON expression.id = presentation.expression_id
WHERE expression.expression_kind = 'simple'
	AND presentation.revision = 1
ON CONFLICT DO NOTHING;

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
	AND expression.focus_tag_id = direct_tag.tag_id
ON CONFLICT (unit_id, expression_id) DO UPDATE SET
	direct = true,
	updated_at = GREATEST(
		public.unit_expression_assertion.updated_at,
		EXCLUDED.updated_at
	);

INSERT INTO public.realm_unit_expression_assertion(
	realm_id, unit_id, expression_id, direct, path_application_count,
	created_at, updated_at
)
SELECT direct_tag.realm_id, direct_tag.unit_id, expression.id, true, 0,
	direct_tag.created_at, direct_tag.updated_at
FROM public.realm_unit_tag AS direct_tag
JOIN public.tag_expression AS expression
	ON expression.expression_kind = 'simple'
	AND expression.focus_tag_id = direct_tag.tag_id
ON CONFLICT (realm_id, unit_id, expression_id) DO UPDATE SET
	direct = true,
	updated_at = GREATEST(
		public.realm_unit_expression_assertion.updated_at,
		EXCLUDED.updated_at
	);

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
