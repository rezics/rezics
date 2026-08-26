-- Ordinary search callers request Tag documents. Tag Path curation requests
-- Tag Path documents explicitly through the same bounded PGroonga primitive.
CREATE OR REPLACE FUNCTION public.search_text_candidates(
    p_queries text[],
    p_languages text[],
    p_unit_kind text,
    p_after_updated_at_micros bigint,
    p_after_unit_id uuid,
    p_estimated_postings_limit integer,
    p_limit integer
) RETURNS TABLE (unit_id uuid, unit_updated_at_micros bigint, search_matched boolean)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public, pg_temp
    AS $$
DECLARE
    candidate_language text;
    candidate_column text;
    index_column text;
    keyword text;
    keyword_result jsonb;
    keyword_size bigint;
    estimated_postings bigint := 0;
    estimated_postings_limit_ceiling constant integer := 50000;
    match_columns text := '';
    search_columns text[] := ARRAY[]::text[];
    after_order_key text;
    filter_expression text := 'pgroonga_tuple_is_alive(_key)';
    command_result jsonb;
    return_code integer;
    expanded_query text;
BEGIN
    IF p_queries IS NULL
       OR cardinality(p_queries) < 1
       OR cardinality(p_queries) > 3
       OR EXISTS (
           SELECT 1
           FROM unnest(p_queries) AS query_variant(value)
           WHERE value IS NULL
              OR btrim(value) = ''
              OR char_length(value) > 512
       )
       OR coalesce((SELECT sum(char_length(value)) FROM unnest(p_queries) AS query_variant(value)), 0) > 1536 THEN
        RAISE EXCEPTION 'invalid text query variants' USING ERRCODE = '22023';
    END IF;
    IF p_languages IS NULL
       OR NOT p_languages <@ ARRAY['zh', 'en', 'ja', 'ko', 'de', 'fr', 'es']::text[] THEN
        RAISE EXCEPTION 'invalid text language boundary' USING ERRCODE = '22023';
    END IF;
    IF p_unit_kind IS NULL OR p_unit_kind NOT IN (
        'slug_namespace', 'profile', 'book', 'software', 'media', 'video', 'audio',
        'release', 'entity', 'label', 'tag', 'tag_path', 'series', 'zone',
        'zone_page', 'collection', 'post', 'poll', 'realm', 'realm_rule'
    ) THEN
        RAISE EXCEPTION 'invalid Unit kind boundary' USING ERRCODE = '22023';
    END IF;
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 4097 THEN
        RAISE EXCEPTION 'invalid text result limit' USING ERRCODE = '22023';
    END IF;
    IF p_estimated_postings_limit IS NULL
       OR p_estimated_postings_limit < 1
       OR p_estimated_postings_limit > estimated_postings_limit_ceiling THEN
        RAISE EXCEPTION 'invalid text posting budget' USING ERRCODE = '22023';
    END IF;
    IF num_nonnulls(p_after_updated_at_micros, p_after_unit_id) NOT IN (0, 2)
       OR p_after_updated_at_micros < 0 THEN
        RAISE EXCEPTION 'invalid text cursor' USING ERRCODE = '22023';
    END IF;

    SELECT string_agg(
        '(' || public.pgroonga_query_escape(value) || ')',
        ' OR ' ORDER BY ordinality
    )
    INTO expanded_query
    FROM unnest(p_queries) WITH ORDINALITY AS query_variant(value, ordinality);

    IF cardinality(p_languages) = 0 THEN
        search_columns := ARRAY['text_all'];
    ELSE
        FOREACH candidate_language IN ARRAY ARRAY['zh', 'en', 'ja', 'ko', 'de', 'fr', 'es']::text[]
        LOOP
            IF candidate_language = ANY(p_languages) THEN
                search_columns := array_append(search_columns, 'text_' || candidate_language);
            END IF;
        END LOOP;
    END IF;

    FOREACH candidate_column IN ARRAY search_columns LOOP
        match_columns := match_columns
            || CASE WHEN match_columns = '' THEN '' ELSE ' || ' END
            || candidate_column;
        index_column := public.pgroonga_index_column_name(
            'unit_search_document_pgroonga_idx', candidate_column
        );
        FOREACH keyword IN ARRAY public.pgroonga_query_extract_keywords(expanded_query)
        LOOP
            keyword_result := public.pgroonga_command('table_tokenize', ARRAY[
                'table', split_part(index_column, '.', 1),
                'string', keyword,
                'index_column', split_part(index_column, '.', 2),
                'mode', 'GET'
            ])::jsonb;
            return_code := (keyword_result #>> '{0,0}')::integer;
            IF return_code IS DISTINCT FROM 0 THEN
                RAISE EXCEPTION 'Groonga estimate command failed with code %', return_code;
            END IF;
            SELECT coalesce(sum((token.value ->> 'estimated_size')::bigint), 0)
            INTO keyword_size
            FROM jsonb_array_elements(coalesce(keyword_result #> '{1}', '[]'::jsonb)) AS token(value);
            estimated_postings := estimated_postings + keyword_size;
            EXIT WHEN estimated_postings > p_estimated_postings_limit;
        END LOOP;
        EXIT WHEN estimated_postings > p_estimated_postings_limit;
    END LOOP;

    IF estimated_postings > p_estimated_postings_limit THEN
        RETURN QUERY
        SELECT candidate.id,
            (extract(epoch FROM candidate.updated_at) * 1000000)::bigint,
            false
        FROM public.unit AS candidate
        WHERE candidate.kind = p_unit_kind
          AND candidate.status = 'published'::public.unit_status
          AND candidate.visibility = 'public'::public.resource_visibility
          AND candidate.moderation_status = 'approved'::public.moderation_status
          AND candidate.deleted_at IS NULL
          AND (p_after_unit_id IS NULL OR (candidate.updated_at, candidate.id) < (
              to_timestamp(p_after_updated_at_micros::numeric / 1000000),
              p_after_unit_id
          ))
        ORDER BY candidate.updated_at DESC, candidate.id DESC
        LIMIT p_limit;
        RETURN;
    END IF;

    filter_expression := filter_expression || ' && unit_kind == '
        || public.pgroonga_escape(p_unit_kind);
    IF p_after_unit_id IS NOT NULL THEN
        after_order_key := lpad(p_after_updated_at_micros::text, 20, '0')
            || ':' || p_after_unit_id::text;
        filter_expression := filter_expression || ' && search_order_key < '
            || public.pgroonga_escape(after_order_key);
    END IF;

    command_result := public.pgroonga_command('select', ARRAY[
        'table', public.pgroonga_table_name('unit_search_document_pgroonga_idx'),
        'command_version', '3',
        'cache', 'no',
        'match_columns', match_columns,
        'query', expanded_query,
        'filter', filter_expression,
        'sort_keys', '-search_order_key',
        'limit', p_limit::text,
        'output_columns', 'search_order_key'
    ])::jsonb;
    return_code := (command_result #>> '{header,return_code}')::integer;
    IF return_code IS DISTINCT FROM 0 THEN
        RAISE EXCEPTION 'PGroonga text command failed with code %', return_code;
    END IF;

    RETURN QUERY
    SELECT right(record.value ->> 0, 36)::uuid,
        split_part(record.value ->> 0, ':', 1)::bigint,
        true
    FROM jsonb_array_elements(
        coalesce(command_result #> '{body,records}', '[]'::jsonb)
    ) WITH ORDINALITY AS record(value, position)
    ORDER BY record.position;
END;
$$;

DROP FUNCTION IF EXISTS public.search_text_candidates(
    text, text[], text, bigint, uuid, integer, integer
);

REVOKE ALL ON FUNCTION public.search_text_candidates(
    text[], text[], text, bigint, uuid, integer, integer
) FROM PUBLIC;
