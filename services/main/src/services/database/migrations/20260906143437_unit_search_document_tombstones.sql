SET search_path TO public;

-- Retired identities have no live search projection. The empty upsert removes its old document.
CREATE OR REPLACE FUNCTION public.refresh_unit_search_document(p_unit_id uuid) RETURNS void
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
          AND search_alias.withdrawn_at IS NULL
          AND (search_alias.pinned OR coalesce(vote_stat.score, 0) >= 3)
    ) AS alias_document ON true
    WHERE candidate.id = p_unit_id
      AND candidate.deleted_at IS NULL
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
