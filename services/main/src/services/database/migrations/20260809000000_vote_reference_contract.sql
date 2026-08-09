-- A reference is either active or withdrawn. Withdrawal preserves its identity,
-- vote history, and auditability while keeping every active Unit collection
-- strictly bounded.
ALTER TABLE public.unit_alias
    ADD COLUMN withdrawn_at timestamp(3) with time zone;

ALTER TABLE public.unit_external_link
    ADD COLUMN withdrawn_at timestamp(3) with time zone;

ALTER TABLE public.unit_alias
    ADD CONSTRAINT unit_alias_withdrawn_curation_check
    CHECK (withdrawn_at IS NULL OR (NOT pinned AND "position" IS NULL)) NOT VALID;

ALTER TABLE public.unit_alias
    VALIDATE CONSTRAINT unit_alias_withdrawn_curation_check;

ALTER TABLE public.unit_external_link
    ADD CONSTRAINT unit_external_link_withdrawn_curation_check
    CHECK (withdrawn_at IS NULL OR (NOT pinned AND "position" IS NULL)) NOT VALID;

ALTER TABLE public.unit_external_link
    VALIDATE CONSTRAINT unit_external_link_withdrawn_curation_check;

-- The API performs the same bounded checks to return domain errors. These
-- triggers are the final invariant for direct writers and concurrent traffic.
CREATE FUNCTION public.enforce_unit_reference_limits() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
DECLARE
    active_count integer;
    pinned_count integer;
    reference_kind text := TG_ARGV[0];
BEGIN
    IF NEW.withdrawn_at IS NULL AND (
        TG_OP = 'INSERT' OR OLD.withdrawn_at IS NOT NULL
    ) THEN
        PERFORM pg_advisory_xact_lock(
            hashtextextended('unit-reference:' || reference_kind || ':' || NEW.unit_id::text, 0)
        );
        EXECUTE format(
            'SELECT count(*) FROM ('
            || 'SELECT 1 FROM public.%I '
            || 'WHERE unit_id = $1 AND withdrawn_at IS NULL AND id <> $2 LIMIT 128'
            || ') AS active_reference',
            TG_TABLE_NAME
        )
        INTO active_count
        USING NEW.unit_id, NEW.id;
        IF active_count >= 128 THEN
            RAISE EXCEPTION 'Unit % already has 128 active % references',
                NEW.unit_id, reference_kind
                USING ERRCODE = '23514', CONSTRAINT = 'unit_reference_active_limit';
        END IF;
    END IF;

    IF NEW.withdrawn_at IS NULL AND NEW.pinned AND (
        TG_OP = 'INSERT' OR NOT OLD.pinned OR OLD.withdrawn_at IS NOT NULL
    ) THEN
        PERFORM pg_advisory_xact_lock(
            hashtextextended('unit-reference:' || reference_kind || ':' || NEW.unit_id::text, 0)
        );
        EXECUTE format(
            'SELECT count(*) FROM ('
            || 'SELECT 1 FROM public.%I '
            || 'WHERE unit_id = $1 AND withdrawn_at IS NULL AND pinned AND id <> $2 LIMIT 16'
            || ') AS pinned_reference',
            TG_TABLE_NAME
        )
        INTO pinned_count
        USING NEW.unit_id, NEW.id;
        IF pinned_count >= 16 THEN
            RAISE EXCEPTION 'Unit % already has 16 pinned % references',
                NEW.unit_id, reference_kind
                USING ERRCODE = '23514', CONSTRAINT = 'unit_reference_pinned_limit';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER unit_alias_reference_limits
    BEFORE INSERT OR UPDATE OF withdrawn_at, pinned ON public.unit_alias
    FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_reference_limits('alias');

CREATE TRIGGER unit_external_link_reference_limits
    BEFORE INSERT OR UPDATE OF withdrawn_at, pinned ON public.unit_external_link
    FOR EACH ROW EXECUTE FUNCTION public.enforce_unit_reference_limits('external_link');

-- score/count encode positive and negative counts, so matching parity is part
-- of the persisted contract rather than an assumption made by presenters.
ALTER TABLE public.unit_alias_vote_stat
    ADD CONSTRAINT unit_alias_vote_stat_parity_check
    CHECK ((vote_count + score) % 2 = 0) NOT VALID;
ALTER TABLE public.unit_alias_vote_stat
    VALIDATE CONSTRAINT unit_alias_vote_stat_parity_check;

ALTER TABLE public.unit_external_link_vote_stat
    ADD CONSTRAINT unit_external_link_vote_stat_parity_check
    CHECK ((vote_count + score) % 2 = 0) NOT VALID;
ALTER TABLE public.unit_external_link_vote_stat
    VALIDATE CONSTRAINT unit_external_link_vote_stat_parity_check;

ALTER TABLE public.unit_tag_vote_stat
    ADD CONSTRAINT unit_tag_vote_stat_parity_check
    CHECK ((vote_count + score) % 2 = 0) NOT VALID;
ALTER TABLE public.unit_tag_vote_stat
    VALIDATE CONSTRAINT unit_tag_vote_stat_parity_check;

ALTER TABLE public.unit_structure_vote_stat
    ADD CONSTRAINT unit_structure_vote_stat_parity_check
    CHECK ((vote_count + score) % 2 = 0) NOT VALID;
ALTER TABLE public.unit_structure_vote_stat
    VALIDATE CONSTRAINT unit_structure_vote_stat_parity_check;

ALTER TABLE public.unit_structure_application_vote_stat
    ADD CONSTRAINT unit_structure_application_vote_stat_parity_check
    CHECK ((vote_count + score) % 2 = 0) NOT VALID;
ALTER TABLE public.unit_structure_application_vote_stat
    VALIDATE CONSTRAINT unit_structure_application_vote_stat_parity_check;

ALTER TABLE public.realm_tag_vote_stat
    ADD CONSTRAINT realm_tag_vote_stat_parity_check
    CHECK ((vote_count + score) % 2 = 0) NOT VALID;
ALTER TABLE public.realm_tag_vote_stat
    VALIDATE CONSTRAINT realm_tag_vote_stat_parity_check;

-- An UPDATE of one vote now touches its aggregate row once instead of applying
-- a decrement followed by an increment. INSERT/DELETE semantics are unchanged.
CREATE OR REPLACE FUNCTION public.maintain_unit_alias_vote_stat() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.alias_id = NEW.alias_id THEN
        IF OLD.value <> NEW.value THEN
            UPDATE public.unit_alias_vote_stat
            SET score = score + NEW.value - OLD.value, updated_at = now()
            WHERE alias_id = NEW.alias_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'missing unit_alias_vote_stat row for update: %', NEW.alias_id
                    USING ERRCODE = '23514';
            END IF;
        END IF;
        RETURN NULL;
    END IF;

    IF TG_OP IN ('UPDATE', 'DELETE')
       AND EXISTS (SELECT 1 FROM public.unit_alias WHERE id = OLD.alias_id) THEN
        UPDATE public.unit_alias_vote_stat
        SET score = score - OLD.value, vote_count = vote_count - 1, updated_at = now()
        WHERE alias_id = OLD.alias_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'missing unit_alias_vote_stat row for decrement: %', OLD.alias_id
                USING ERRCODE = '23514';
        END IF;
        DELETE FROM public.unit_alias_vote_stat
        WHERE alias_id = OLD.alias_id AND vote_count = 0;
    END IF;

    IF TG_OP IN ('UPDATE', 'INSERT')
       AND EXISTS (SELECT 1 FROM public.unit_alias WHERE id = NEW.alias_id) THEN
        INSERT INTO public.unit_alias_vote_stat (alias_id, score, vote_count)
        VALUES (NEW.alias_id, NEW.value, 1)
        ON CONFLICT (alias_id) DO UPDATE SET
            score = unit_alias_vote_stat.score + excluded.score,
            vote_count = unit_alias_vote_stat.vote_count + 1,
            updated_at = now();
    END IF;
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_external_link_vote_stat() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path = pg_catalog, public
    AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.external_link_id = NEW.external_link_id THEN
        IF OLD.value <> NEW.value THEN
            UPDATE public.unit_external_link_vote_stat
            SET score = score + NEW.value - OLD.value, updated_at = now()
            WHERE external_link_id = NEW.external_link_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'missing unit_external_link_vote_stat row for update: %',
                    NEW.external_link_id USING ERRCODE = '23514';
            END IF;
        END IF;
        RETURN NULL;
    END IF;

    IF TG_OP IN ('UPDATE', 'DELETE') AND EXISTS (
        SELECT 1 FROM public.unit_external_link WHERE id = OLD.external_link_id
    ) THEN
        UPDATE public.unit_external_link_vote_stat
        SET score = score - OLD.value, vote_count = vote_count - 1, updated_at = now()
        WHERE external_link_id = OLD.external_link_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'missing unit_external_link_vote_stat row for decrement: %',
                OLD.external_link_id USING ERRCODE = '23514';
        END IF;
        DELETE FROM public.unit_external_link_vote_stat
        WHERE external_link_id = OLD.external_link_id AND vote_count = 0;
    END IF;

    IF TG_OP IN ('UPDATE', 'INSERT') AND EXISTS (
        SELECT 1 FROM public.unit_external_link WHERE id = NEW.external_link_id
    ) THEN
        INSERT INTO public.unit_external_link_vote_stat (external_link_id, score, vote_count)
        VALUES (NEW.external_link_id, NEW.value, 1)
        ON CONFLICT (external_link_id) DO UPDATE SET
            score = unit_external_link_vote_stat.score + excluded.score,
            vote_count = unit_external_link_vote_stat.vote_count + 1,
            updated_at = now();
    END IF;
    RETURN NULL;
END;
$$;

-- Withdrawn aliases remain auditable but no longer contribute to discovery.
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
