-- atlas:txmode none

DROP INDEX CONCURRENTLY public.unit_tag_tag_idx;
CREATE INDEX CONCURRENTLY unit_tag_tag_idx
	ON public.unit_tag (tag_id, unit_id);

CREATE INDEX CONCURRENTLY profile_unit_tag_profile_tag_idx
	ON public.profile_unit_tag (profile_id, tag_id, unit_id);

DROP INDEX CONCURRENTLY public.collection_item_unit_idx;
CREATE INDEX CONCURRENTLY collection_item_unit_idx
	ON public.collection_item (unit_id, collection_id);

DROP INDEX CONCURRENTLY public.score_realm_idx;
CREATE INDEX CONCURRENTLY score_realm_idx
	ON public.score (realm_id, unit_id);

DROP INDEX CONCURRENTLY public.post_score_score_idx;
CREATE INDEX CONCURRENTLY post_score_score_idx
	ON public.post_score (score_id, post_id);

CREATE INDEX CONCURRENTLY credit_attribution_publisher_search_source_idx
	ON public.credit_attribution (credited_unit_id, source_unit_id)
	WHERE role = 'publisher';
