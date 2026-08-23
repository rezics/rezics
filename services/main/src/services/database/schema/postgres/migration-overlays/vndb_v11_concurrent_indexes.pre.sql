-- Build final-named replacement and cascade-route indexes while legacy writers stay live.
-- This overlay is intentionally index-only and must run outside a transaction.

CREATE INDEX CONCURRENTLY unit_tag_judgment_tag_unit_idx
	ON public.unit_tag_vote (tag_id, unit_id);
CREATE INDEX CONCURRENTLY unit_tag_judgment_profile_unit_tag_idx
	ON public.unit_tag_vote (profile_id, unit_id, tag_id);
CREATE INDEX CONCURRENTLY unit_structure_application_judgment_profile_idx
	ON public.unit_structure_application_vote (profile_id, unit_id, structure_id);
CREATE INDEX CONCURRENTLY unit_structure_application_judgment_structure_idx
	ON public.unit_structure_application_vote (structure_id, unit_id, profile_id);
CREATE INDEX CONCURRENTLY unit_structure_application_judgment_positive_structure_idx
	ON public.unit_structure_application_vote (structure_id, unit_id, profile_id)
	WHERE value = 1;
CREATE INDEX CONCURRENTLY realm_tag_judgment_profile_route_idx
	ON public.realm_tag_vote (profile_id, realm_id, unit_id, tag_id);
CREATE INDEX CONCURRENTLY realm_tag_judgment_tag_route_idx
	ON public.realm_tag_vote (tag_id, realm_id, unit_id, profile_id);
CREATE INDEX CONCURRENTLY realm_tag_judgment_stat_unit_realm_tag_idx
	ON public.realm_tag_vote_stat (unit_id, realm_id, tag_id);
CREATE INDEX CONCURRENTLY realm_tag_judgment_stat_tag_realm_unit_idx
	ON public.realm_tag_vote_stat (tag_id, realm_id, unit_id);
CREATE INDEX CONCURRENTLY realm_unit_tag_tag_route_idx
	ON public.realm_unit_tag (tag_id, realm_id, unit_id);

CREATE INDEX CONCURRENTLY unit_structure_application_correction_shard_idx
	ON public.unit_structure_application (
		structure_id,
		(pg_catalog.get_byte(pg_catalog.uuid_send(unit_id), 15)),
		unit_id
	);
CREATE INDEX CONCURRENTLY unit_structure_application_judgment_positive_correction_shard_idx
	ON public.unit_structure_application_vote (
		structure_id,
		(pg_catalog.get_byte(pg_catalog.uuid_send(unit_id), 15)),
		unit_id,
		profile_id
	) WHERE value = 1;
CREATE INDEX CONCURRENTLY unit_tag_structure_support_member_idx
	ON public.unit_tag_structure_support
		(structure_id, projection_version, tag_id, unit_id, profile_id);
CREATE INDEX CONCURRENTLY unit_tag_structure_support_application_judgment_idx
	ON public.unit_tag_structure_support
		(unit_id, structure_id, profile_id, projection_version, tag_id);
CREATE UNIQUE INDEX CONCURRENTLY unit_structure_member_projection_pkey_ccnew
	ON public.unit_structure_member (structure_id, projection_version, ordinal);
CREATE UNIQUE INDEX CONCURRENTLY unit_structure_member_projection_member_key_ccnew
	ON public.unit_structure_member (structure_id, projection_version, member_unit_id);
CREATE UNIQUE INDEX CONCURRENTLY unit_structure_edge_projection_pkey_ccnew
	ON public.unit_structure_edge (structure_id, projection_version, ordinal);
CREATE UNIQUE INDEX CONCURRENTLY unit_tag_structure_support_projection_pkey_ccnew
	ON public.unit_tag_structure_support
		(unit_id, tag_id, profile_id, structure_id, projection_version);

DROP INDEX CONCURRENTLY IF EXISTS public.unit_tag_vote_tag_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.unit_tag_vote_profile_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.unit_structure_application_vote_profile_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.realm_tag_vote_profile_idx;
DROP INDEX CONCURRENTLY IF EXISTS public.unit_tag_structure_support_structure_idx;
