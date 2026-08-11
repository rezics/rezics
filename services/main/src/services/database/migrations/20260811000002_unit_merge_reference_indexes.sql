-- atlas:txmode none

-- Every worker lookup begins with the selective source key. Add this index
-- without blocking writes on the corpus-scale progress relation.
CREATE INDEX CONCURRENTLY IF NOT EXISTS unit_progress_entry_unit_id_merge_idx
    ON public.unit_progress_entry (unit_id, id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS content_structure_node_content_unit_merge_idx
    ON public.content_structure_node (content_unit_id, id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS realm_tag_vote_unit_merge_idx
    ON public.realm_tag_vote (unit_id, realm_id, tag_id, profile_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS realm_unit_tag_unit_merge_idx
    ON public.realm_unit_tag (unit_id, realm_id, tag_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS studio_work_relation_resource_merge_idx
    ON public.studio_work_relation (resource_unit_id, id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS studio_work_relation_authorization_merge_idx
    ON public.studio_work_relation (authorization_unit_id, id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS studio_resource_visit_resource_merge_idx
    ON public.studio_resource_visit (resource_unit_id, profile_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS unit_best_score_unit_merge_idx
    ON public.unit_best_score (unit_id, snapshot_id);
