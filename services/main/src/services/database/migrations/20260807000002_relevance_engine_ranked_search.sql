-- atlas:txmode none

CREATE TABLE public.unit_search_document (
    unit_id uuid PRIMARY KEY,
    unit_updated_at_micros bigint NOT NULL,
    search_order_key text NOT NULL,
    text_all text,
    text_zh text,
    text_en text,
    text_ja text,
    text_ko text,
    text_de text,
    text_fr text,
    text_es text,
    CONSTRAINT unit_search_document_unit_id_unit_id_fkey
        FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE CASCADE
);

CREATE FUNCTION public.refresh_unit_search_document(p_unit_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
BEGIN
    INSERT INTO public.unit_search_document (
        unit_id,
        unit_updated_at_micros,
        search_order_key,
        text_all, text_zh, text_en, text_ja, text_ko, text_de, text_fr, text_es
    )
    SELECT candidate.id,
        (extract(epoch FROM candidate.updated_at) * 1000000)::bigint,
        lpad(((extract(epoch FROM candidate.updated_at) * 1000000)::bigint)::text, 20, '0')
            || ':' || candidate.id::text,
        nullif(concat_ws(E'\n',
            localization.metadata_zh, localization.content_zh,
            localization.metadata_en, localization.content_en,
            localization.metadata_ja, localization.content_ja,
            localization.metadata_ko, localization.content_ko,
            localization.metadata_de, localization.content_de,
            localization.metadata_fr, localization.content_fr,
            localization.metadata_es, localization.content_es,
            alias_document.aliases_all), ''),
        nullif(concat_ws(E'\n', localization.metadata_zh,
            localization.content_zh, alias_document.aliases_neutral,
            alias_document.aliases_zh), ''),
        nullif(concat_ws(E'\n', localization.metadata_en,
            localization.content_en, alias_document.aliases_neutral,
            alias_document.aliases_en), ''),
        nullif(concat_ws(E'\n', localization.metadata_ja,
            localization.content_ja, alias_document.aliases_neutral,
            alias_document.aliases_ja), ''),
        nullif(concat_ws(E'\n', localization.metadata_ko,
            localization.content_ko, alias_document.aliases_neutral,
            alias_document.aliases_ko), ''),
        nullif(concat_ws(E'\n', localization.metadata_de,
            localization.content_de, alias_document.aliases_neutral,
            alias_document.aliases_de), ''),
        nullif(concat_ws(E'\n', localization.metadata_fr,
            localization.content_fr, alias_document.aliases_neutral,
            alias_document.aliases_fr), ''),
        nullif(concat_ws(E'\n', localization.metadata_es,
            localization.content_es, alias_document.aliases_neutral,
            alias_document.aliases_es), '')
    FROM public.unit AS candidate
    LEFT JOIN LATERAL (
        SELECT
            max(public.current_search_metadata_v1(title, summary, description))
                FILTER (WHERE language = 'zh') AS metadata_zh,
            max(public.current_search_metadata_v1(title, summary, description))
                FILTER (WHERE language = 'en') AS metadata_en,
            max(public.current_search_metadata_v1(title, summary, description))
                FILTER (WHERE language = 'ja') AS metadata_ja,
            max(public.current_search_metadata_v1(title, summary, description))
                FILTER (WHERE language = 'ko') AS metadata_ko,
            max(public.current_search_metadata_v1(title, summary, description))
                FILTER (WHERE language = 'de') AS metadata_de,
            max(public.current_search_metadata_v1(title, summary, description))
                FILTER (WHERE language = 'fr') AS metadata_fr,
            max(public.current_search_metadata_v1(title, summary, description))
                FILTER (WHERE language = 'es') AS metadata_es,
            max(public.current_search_text_v1(content))
                FILTER (WHERE language = 'zh' AND content_status = 'published') AS content_zh,
            max(public.current_search_text_v1(content))
                FILTER (WHERE language = 'en' AND content_status = 'published') AS content_en,
            max(public.current_search_text_v1(content))
                FILTER (WHERE language = 'ja' AND content_status = 'published') AS content_ja,
            max(public.current_search_text_v1(content))
                FILTER (WHERE language = 'ko' AND content_status = 'published') AS content_ko,
            max(public.current_search_text_v1(content))
                FILTER (WHERE language = 'de' AND content_status = 'published') AS content_de,
            max(public.current_search_text_v1(content))
                FILTER (WHERE language = 'fr' AND content_status = 'published') AS content_fr,
            max(public.current_search_text_v1(content))
                FILTER (WHERE language = 'es' AND content_status = 'published') AS content_es
        FROM public.unit_localization
        WHERE unit_id = candidate.id
    ) AS localization ON true
    LEFT JOIN LATERAL (
        SELECT
            string_agg(search_alias.term, E'\n' ORDER BY search_alias.id) AS aliases_all,
            string_agg(search_alias.term, E'\n' ORDER BY search_alias.id)
                FILTER (WHERE search_alias.language IS NULL) AS aliases_neutral,
            string_agg(search_alias.term, E'\n' ORDER BY search_alias.id)
                FILTER (WHERE search_alias.language = 'zh') AS aliases_zh,
            string_agg(search_alias.term, E'\n' ORDER BY search_alias.id)
                FILTER (WHERE search_alias.language = 'en') AS aliases_en,
            string_agg(search_alias.term, E'\n' ORDER BY search_alias.id)
                FILTER (WHERE search_alias.language = 'ja') AS aliases_ja,
            string_agg(search_alias.term, E'\n' ORDER BY search_alias.id)
                FILTER (WHERE search_alias.language = 'ko') AS aliases_ko,
            string_agg(search_alias.term, E'\n' ORDER BY search_alias.id)
                FILTER (WHERE search_alias.language = 'de') AS aliases_de,
            string_agg(search_alias.term, E'\n' ORDER BY search_alias.id)
                FILTER (WHERE search_alias.language = 'fr') AS aliases_fr,
            string_agg(search_alias.term, E'\n' ORDER BY search_alias.id)
                FILTER (WHERE search_alias.language = 'es') AS aliases_es
        FROM public.unit_alias AS search_alias
        LEFT JOIN public.unit_alias_vote_stat AS vote_stat
            ON vote_stat.alias_id = search_alias.id
        WHERE search_alias.unit_id = candidate.id
          AND (search_alias.pinned OR coalesce(vote_stat.score, 0) >= 3)
    ) AS alias_document ON true
    WHERE candidate.id = p_unit_id
    ON CONFLICT (unit_id) DO UPDATE SET
        unit_updated_at_micros = excluded.unit_updated_at_micros,
        search_order_key = excluded.search_order_key,
        text_all = excluded.text_all,
        text_zh = excluded.text_zh,
        text_en = excluded.text_en,
        text_ja = excluded.text_ja,
        text_ko = excluded.text_ko,
        text_de = excluded.text_de,
        text_fr = excluded.text_fr,
        text_es = excluded.text_es;

    IF NOT FOUND THEN
        DELETE FROM public.unit_search_document WHERE unit_id = p_unit_id;
    END IF;
END;
$$;

CREATE FUNCTION public.refresh_unit_search_document_from_unit() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
BEGIN
    PERFORM public.refresh_unit_search_document(NEW.id);
    RETURN NULL;
END;
$$;

CREATE TRIGGER unit_search_document_from_unit
    AFTER INSERT OR UPDATE OF updated_at ON public.unit
    FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_unit();

CREATE FUNCTION public.refresh_unit_search_document_from_dependency() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        PERFORM public.refresh_unit_search_document(OLD.unit_id);
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE')
       AND (TG_OP = 'INSERT' OR NEW.unit_id IS DISTINCT FROM OLD.unit_id) THEN
        PERFORM public.refresh_unit_search_document(NEW.unit_id);
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER unit_search_document_from_localization
    AFTER INSERT OR DELETE OR UPDATE ON public.unit_localization
    FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_dependency();

CREATE TRIGGER unit_search_document_from_alias
    AFTER INSERT OR DELETE OR UPDATE ON public.unit_alias
    FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_dependency();

CREATE FUNCTION public.refresh_unit_search_document_from_alias_stat() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE
    target_alias_id uuid;
    target_unit_id uuid;
BEGIN
    target_alias_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.alias_id ELSE NEW.alias_id END;
    SELECT unit_id INTO target_unit_id
    FROM public.unit_alias
    WHERE id = target_alias_id;
    IF FOUND THEN
        PERFORM public.refresh_unit_search_document(target_unit_id);
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER unit_search_document_from_alias_stat
    AFTER INSERT OR DELETE OR UPDATE OF score ON public.unit_alias_vote_stat
    FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_alias_stat();

WITH localization_document AS MATERIALIZED (
    SELECT unit_id,
        max(public.current_search_metadata_v1(title, summary, description))
            FILTER (WHERE language = 'zh') AS metadata_zh,
        max(public.current_search_metadata_v1(title, summary, description))
            FILTER (WHERE language = 'en') AS metadata_en,
        max(public.current_search_metadata_v1(title, summary, description))
            FILTER (WHERE language = 'ja') AS metadata_ja,
        max(public.current_search_metadata_v1(title, summary, description))
            FILTER (WHERE language = 'ko') AS metadata_ko,
        max(public.current_search_metadata_v1(title, summary, description))
            FILTER (WHERE language = 'de') AS metadata_de,
        max(public.current_search_metadata_v1(title, summary, description))
            FILTER (WHERE language = 'fr') AS metadata_fr,
        max(public.current_search_metadata_v1(title, summary, description))
            FILTER (WHERE language = 'es') AS metadata_es,
        max(public.current_search_text_v1(content))
            FILTER (WHERE language = 'zh' AND content_status = 'published') AS content_zh,
        max(public.current_search_text_v1(content))
            FILTER (WHERE language = 'en' AND content_status = 'published') AS content_en,
        max(public.current_search_text_v1(content))
            FILTER (WHERE language = 'ja' AND content_status = 'published') AS content_ja,
        max(public.current_search_text_v1(content))
            FILTER (WHERE language = 'ko' AND content_status = 'published') AS content_ko,
        max(public.current_search_text_v1(content))
            FILTER (WHERE language = 'de' AND content_status = 'published') AS content_de,
        max(public.current_search_text_v1(content))
            FILTER (WHERE language = 'fr' AND content_status = 'published') AS content_fr,
        max(public.current_search_text_v1(content))
            FILTER (WHERE language = 'es' AND content_status = 'published') AS content_es
    FROM public.unit_localization
    GROUP BY unit_id
), alias_document AS MATERIALIZED (
    SELECT search_alias.unit_id,
        string_agg(search_alias.term, E'\n' ORDER BY search_alias.id) AS aliases_all,
        string_agg(search_alias.term, E'\n' ORDER BY search_alias.id)
            FILTER (WHERE search_alias.language IS NULL) AS aliases_neutral,
        string_agg(search_alias.term, E'\n' ORDER BY search_alias.id)
            FILTER (WHERE search_alias.language = 'zh') AS aliases_zh,
        string_agg(search_alias.term, E'\n' ORDER BY search_alias.id)
            FILTER (WHERE search_alias.language = 'en') AS aliases_en,
        string_agg(search_alias.term, E'\n' ORDER BY search_alias.id)
            FILTER (WHERE search_alias.language = 'ja') AS aliases_ja,
        string_agg(search_alias.term, E'\n' ORDER BY search_alias.id)
            FILTER (WHERE search_alias.language = 'ko') AS aliases_ko,
        string_agg(search_alias.term, E'\n' ORDER BY search_alias.id)
            FILTER (WHERE search_alias.language = 'de') AS aliases_de,
        string_agg(search_alias.term, E'\n' ORDER BY search_alias.id)
            FILTER (WHERE search_alias.language = 'fr') AS aliases_fr,
        string_agg(search_alias.term, E'\n' ORDER BY search_alias.id)
            FILTER (WHERE search_alias.language = 'es') AS aliases_es
    FROM public.unit_alias AS search_alias
    LEFT JOIN public.unit_alias_vote_stat AS vote_stat ON vote_stat.alias_id = search_alias.id
    WHERE search_alias.pinned OR coalesce(vote_stat.score, 0) >= 3
    GROUP BY search_alias.unit_id
)
INSERT INTO public.unit_search_document (
    unit_id,
    unit_updated_at_micros,
    search_order_key,
    text_all, text_zh, text_en, text_ja, text_ko, text_de, text_fr, text_es
)
SELECT candidate.id,
    (extract(epoch FROM candidate.updated_at) * 1000000)::bigint,
    lpad(((extract(epoch FROM candidate.updated_at) * 1000000)::bigint)::text, 20, '0')
        || ':' || candidate.id::text,
    nullif(concat_ws(E'\n',
        localization.metadata_zh, localization.content_zh,
        localization.metadata_en, localization.content_en,
        localization.metadata_ja, localization.content_ja,
        localization.metadata_ko, localization.content_ko,
        localization.metadata_de, localization.content_de,
        localization.metadata_fr, localization.content_fr,
        localization.metadata_es, localization.content_es,
        alias_document.aliases_all), ''),
    nullif(concat_ws(E'\n', localization.metadata_zh,
        localization.content_zh, alias_document.aliases_neutral,
        alias_document.aliases_zh), ''),
    nullif(concat_ws(E'\n', localization.metadata_en,
        localization.content_en, alias_document.aliases_neutral,
        alias_document.aliases_en), ''),
    nullif(concat_ws(E'\n', localization.metadata_ja,
        localization.content_ja, alias_document.aliases_neutral,
        alias_document.aliases_ja), ''),
    nullif(concat_ws(E'\n', localization.metadata_ko,
        localization.content_ko, alias_document.aliases_neutral,
        alias_document.aliases_ko), ''),
    nullif(concat_ws(E'\n', localization.metadata_de,
        localization.content_de, alias_document.aliases_neutral,
        alias_document.aliases_de), ''),
    nullif(concat_ws(E'\n', localization.metadata_fr,
        localization.content_fr, alias_document.aliases_neutral,
        alias_document.aliases_fr), ''),
    nullif(concat_ws(E'\n', localization.metadata_es,
        localization.content_es, alias_document.aliases_neutral,
        alias_document.aliases_es), '')
FROM public.unit AS candidate
LEFT JOIN localization_document AS localization ON localization.unit_id = candidate.id
LEFT JOIN alias_document ON alias_document.unit_id = candidate.id
ON CONFLICT (unit_id) DO NOTHING;

CREATE INDEX CONCURRENTLY unit_search_document_pgroonga_idx
    ON public.unit_search_document USING pgroonga (
        text_all, text_zh, text_en, text_ja, text_ko, text_de, text_fr, text_es,
        search_order_key public.pgroonga_text_term_search_ops_v2
    ) WITH (
        lexicon_flags_mapping='{"text_all":["LARGE"],"text_zh":["LARGE"],"text_en":["LARGE"],"text_ja":["LARGE"],"text_ko":["LARGE"],"text_de":["LARGE"],"text_fr":["LARGE"],"text_es":["LARGE"],"search_order_key":["LARGE"]}',
        index_flags_mapping='{"text_all":["LARGE"],"text_zh":["LARGE"],"text_en":["LARGE"],"text_ja":["LARGE"],"text_ko":["LARGE"],"text_de":["LARGE"],"text_fr":["LARGE"],"text_es":["LARGE"],"search_order_key":["LARGE"]}'
    );

CREATE FUNCTION public.search_text_candidates(
    p_query text,
    p_languages text[],
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
        WHERE candidate.status = 'published'::public.unit_status
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
    text, text[], bigint, uuid, integer, integer
) FROM PUBLIC;
