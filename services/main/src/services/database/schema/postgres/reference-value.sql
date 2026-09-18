DROP TRIGGER IF EXISTS reference_value_immutable ON public.reference_value;
CREATE TRIGGER reference_value_immutable
BEFORE UPDATE OR DELETE ON public.reference_value
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_history_mutation();

-- Internal projection only: resolving a reference grants no access to its target.
-- VOLATILE observes references admitted by the calling statement, including data-modifying CTEs.
CREATE OR REPLACE FUNCTION public.reference_value_native_id(value_id uuid)
RETURNS uuid LANGUAGE sql VOLATILE STRICT SET search_path = pg_catalog, public AS $$
  SELECT coalesce(target_publishing_id, target_music_id, target_program_id,
    target_software_id, target_entity_id, target_grouping_id, target_reference_id,
    target_distribution_id, target_video_id, target_audio_id, target_post_id,
    target_poll_id, target_zone_id, target_realm_id, target_realm_rule_id,
    target_custom_theme_id, target_collection_id, target_tag_id, target_tag_path_id,
    target_label_id, target_description_id, target_wiki_id, target_indexed_media_id,
    target_vocabulary_term_id, target_semantic_relation_id)
  FROM public.reference_value WHERE id = value_id
$$;
