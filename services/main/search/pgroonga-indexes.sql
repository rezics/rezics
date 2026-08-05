-- Canonical derived PGroonga index inventory for v1 restore/rebuild procedures.
-- Keep this file byte-for-byte equivalent to the index definitions in the v1 baseline.
CREATE INDEX unit_localization_pgroonga_metadata_idx
    ON public.unit_localization
    USING pgroonga (
        (public.current_search_metadata_v1(title, summary, description)) public.pgroonga_jsonb_full_text_search_ops_v2
    )
    WITH (
        lexicon_flags_mapping = '{"current_search_metadata_v1":["LARGE"]}',
        index_flags_mapping = '{"current_search_metadata_v1":["LARGE"]}'
    );

CREATE INDEX unit_localization_pgroonga_content_idx
    ON public.unit_localization
    USING pgroonga (
        (public.current_search_text_v1(content)) public.pgroonga_jsonb_full_text_search_ops_v2
    )
    WITH (
        lexicon_flags_mapping = '{"current_search_text_v1":["LARGE"]}',
        index_flags_mapping = '{"current_search_text_v1":["LARGE"]}'
    );
