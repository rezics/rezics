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
