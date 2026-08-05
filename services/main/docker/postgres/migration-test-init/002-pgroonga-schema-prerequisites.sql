\connect rezics_atlas_dev

-- Atlas materializes the Drizzle external schema in its development database.
-- These objects are migration-owned and excluded from schema diffing, but they
-- must exist before Atlas can create the Drizzle-declared PGroonga indexes.
CREATE EXTENSION IF NOT EXISTS pgroonga WITH SCHEMA public;

CREATE FUNCTION public.current_search_text_v1(document jsonb) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
    SELECT coalesce(
        string_agg(child ->> 'text', E'\n' ORDER BY block.ordinality, child_row.ordinality),
        ''::text
    )
    FROM jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(document) = 'object' AND document ->> '_type' = 'portable-text'
                THEN coalesce(document -> 'content', '[]'::jsonb)
            WHEN jsonb_typeof(document) = 'array' THEN document
            ELSE '[]'::jsonb
        END
    ) WITH ORDINALITY AS block(value, ordinality)
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN block.value ->> '_type' = 'block'
                THEN coalesce(block.value -> 'children', '[]'::jsonb)
            ELSE '[]'::jsonb
        END
    ) WITH ORDINALITY AS child_row(child, ordinality)
    WHERE child ->> '_type' = 'span' AND jsonb_typeof(child -> 'text') = 'string'
$$;

CREATE FUNCTION public.current_search_metadata_v1(title text, summary text, description jsonb)
RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
    SELECT coalesce(title, '') || E'\n' || coalesce(summary, '') || E'\n'
        || public.current_search_text_v1(description)
$$;
