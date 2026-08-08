-- atlas:txmode none

ALTER TABLE public.search_best_score RENAME TO unit_best_score;
ALTER TABLE public.unit_best_score
    RENAME CONSTRAINT search_best_score_pkey TO unit_best_score_pkey;
ALTER TABLE public.unit_best_score
    RENAME CONSTRAINT search_best_score_positive_check TO unit_best_score_positive_check;
ALTER TABLE public.unit_best_score
    RENAME CONSTRAINT search_best_score_snapshot_fkey TO unit_best_score_snapshot_fkey;
ALTER INDEX public.search_best_score_order_idx RENAME TO unit_best_score_order_idx;

ALTER TABLE public.unit_best_score ADD COLUMN unit_kind text;
UPDATE public.unit_best_score AS score
SET unit_kind = candidate.kind
FROM public.unit AS candidate
WHERE candidate.id = score.unit_id;
ALTER TABLE public.unit_best_score ALTER COLUMN unit_kind SET NOT NULL;
ALTER TABLE public.unit_best_score
    DROP CONSTRAINT search_best_score_unit_id_unit_id_fkey;
ALTER TABLE public.unit_best_score
    ADD CONSTRAINT unit_best_score_unit_fkey
    FOREIGN KEY (unit_id, unit_kind) REFERENCES public.unit(id, kind)
    ON DELETE CASCADE NOT VALID;
ALTER TABLE public.unit_best_score VALIDATE CONSTRAINT unit_best_score_unit_fkey;

CREATE INDEX CONCURRENTLY unit_best_score_kind_order_idx
    ON public.unit_best_score (
        snapshot_id, unit_kind, score DESC, unit_updated_at DESC, unit_id DESC
    );

CREATE INDEX CONCURRENTLY unit_public_kind_created_at_desc_idx
    ON public.unit (kind, created_at DESC, id DESC)
    WHERE status = 'published'::public.unit_status
      AND visibility = 'public'::public.resource_visibility
      AND moderation_status = 'approved'::public.moderation_status
      AND deleted_at IS NULL;

CREATE INDEX CONCURRENTLY unit_public_kind_updated_at_desc_idx
    ON public.unit (kind, updated_at DESC, id DESC)
    WHERE status = 'published'::public.unit_status
      AND visibility = 'public'::public.resource_visibility
      AND moderation_status = 'approved'::public.moderation_status
      AND deleted_at IS NULL;

ALTER TABLE public.unit_search_document ADD COLUMN unit_kind text;
UPDATE public.unit_search_document AS document
SET unit_kind = candidate.kind
FROM public.unit AS candidate
WHERE candidate.id = document.unit_id;
ALTER TABLE public.unit_search_document ALTER COLUMN unit_kind SET NOT NULL;

CREATE FUNCTION public.fill_unit_search_document_kind() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
BEGIN
    IF NEW.unit_kind IS NULL
       OR (TG_OP = 'UPDATE' AND NEW.unit_id IS DISTINCT FROM OLD.unit_id) THEN
        SELECT kind INTO STRICT NEW.unit_kind
        FROM public.unit
        WHERE id = NEW.unit_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER unit_search_document_kind_fill
    BEFORE INSERT OR UPDATE OF unit_id ON public.unit_search_document
    FOR EACH ROW EXECUTE FUNCTION public.fill_unit_search_document_kind();

CREATE OR REPLACE FUNCTION public.refresh_unit_search_document_from_unit() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
BEGIN
    PERFORM public.refresh_unit_search_document(NEW.id);
    UPDATE public.unit_search_document
    SET unit_kind = NEW.kind
    WHERE unit_id = NEW.id AND unit_kind IS DISTINCT FROM NEW.kind;
    RETURN NULL;
END;
$$;

DROP TRIGGER unit_search_document_from_unit ON public.unit;
CREATE TRIGGER unit_search_document_from_unit
    AFTER INSERT OR UPDATE OF kind, updated_at ON public.unit
    FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_unit();

DROP INDEX CONCURRENTLY public.unit_search_document_pgroonga_idx;
CREATE INDEX CONCURRENTLY unit_search_document_pgroonga_idx
    ON public.unit_search_document USING pgroonga (
        unit_kind public.pgroonga_text_term_search_ops_v2,
        text_all, text_zh, text_en, text_ja, text_ko, text_de, text_fr, text_es,
        search_order_key public.pgroonga_text_term_search_ops_v2
    ) WITH (
        lexicon_flags_mapping='{"unit_kind":["LARGE"],"text_all":["LARGE"],"text_zh":["LARGE"],"text_en":["LARGE"],"text_ja":["LARGE"],"text_ko":["LARGE"],"text_de":["LARGE"],"text_fr":["LARGE"],"text_es":["LARGE"],"search_order_key":["LARGE"]}',
        index_flags_mapping='{"unit_kind":["LARGE"],"text_all":["LARGE"],"text_zh":["LARGE"],"text_en":["LARGE"],"text_ja":["LARGE"],"text_ko":["LARGE"],"text_de":["LARGE"],"text_fr":["LARGE"],"text_es":["LARGE"],"search_order_key":["LARGE"]}'
    );

CREATE FUNCTION public.search_text_candidates(
    p_query text,
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
BEGIN
    IF p_query IS NULL OR btrim(p_query) = '' OR char_length(p_query) > 512 THEN
        RAISE EXCEPTION 'invalid text query' USING ERRCODE = '22023';
    END IF;
    IF p_languages IS NULL
       OR NOT p_languages <@ ARRAY['zh', 'en', 'ja', 'ko', 'de', 'fr', 'es']::text[] THEN
        RAISE EXCEPTION 'invalid text language boundary' USING ERRCODE = '22023';
    END IF;
    IF p_unit_kind IS NULL OR p_unit_kind NOT IN (
        'slug_namespace', 'profile', 'book', 'software', 'media', 'video', 'audio',
        'release', 'entity', 'label', 'tag', 'structure', 'series', 'zone',
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
        FOREACH keyword IN ARRAY public.pgroonga_query_extract_keywords(
            public.pgroonga_query_escape(p_query)
        ) LOOP
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
        'query', public.pgroonga_query_escape(p_query),
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

REVOKE ALL ON FUNCTION public.search_text_candidates(
    text, text[], text, bigint, uuid, integer, integer
) FROM PUBLIC;
DROP FUNCTION public.search_text_candidates(text, text[], bigint, uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.apply_recommendation_profile_signal(
    p_profile_id uuid,
    p_unit_id uuid,
    p_occurred_at timestamp with time zone,
    p_kind text,
    p_count_delta bigint,
    p_weight_delta double precision
) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN;
END;
$$;

DROP TABLE public.recommendation_unit_edge;
DROP TABLE public.recommendation_profile_interest;
DROP TABLE public.recommendation_profile_signal_hourly;
DROP TABLE public.recommendation_unit_stat;
