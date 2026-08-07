-- atlas:txmode none

CREATE INDEX CONCURRENTLY credit_attribution_search_source_idx
    ON public.credit_attribution (credited_unit_id, source_unit_id);

CREATE INDEX CONCURRENTLY subject_association_search_unit_idx
    ON public.subject_association (entity_id, unit_id);
