-- atlas:txmode none

CREATE INDEX CONCURRENTLY IF NOT EXISTS content_structure_node_structure_id_idx
  ON public.content_structure_node (structure_id, id)
  WHERE deleted_at IS NULL;
