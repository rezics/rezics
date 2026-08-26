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
