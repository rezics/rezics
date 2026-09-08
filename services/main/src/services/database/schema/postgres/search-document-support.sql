-- Native owner integrity and derived state. This file is the canonical forward-maintained source.
CREATE OR REPLACE FUNCTION public.current_search_text_v1(document jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO pg_catalog, public
 PARALLEL SAFE
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.current_search_metadata_v1(title text, summary text, description jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO pg_catalog, public PARALLEL SAFE
AS $function$
    SELECT coalesce(title, '') || E'\n' || coalesce(summary, '') || E'\n'
        || public.current_search_text_v1(description)
$function$;

CREATE OR REPLACE FUNCTION public.fill_unit_search_document_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 SELECT owner,shape INTO STRICT NEW.unit_owner,NEW.unit_shape FROM public.read_unit_state(NEW.unit_id);
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_post_reply_search_count_after_kind_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
    UPDATE public.post_reply_stat
    SET search_reply_count = CASE
        WHEN NEW.kind = 'reply'::public.post_kind THEN undeleted_direct_count
        ELSE undeleted_descendant_count
    END
    WHERE post_id = NEW.id;
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_unit_search_document_from_alias_stat()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
    target_alias_id uuid;
    target_unit_id uuid;
BEGIN
    IF nullif(current_setting('rezics.unit_merge_operation_id', true), '') IS NOT NULL THEN
        RETURN NULL;
    END IF;
    target_alias_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.alias_id ELSE NEW.alias_id END;
    SELECT unit_id INTO target_unit_id
    FROM public.unit_alias
    WHERE id = target_alias_id;
    IF FOUND THEN
        PERFORM public.refresh_unit_search_document(target_unit_id);
	END IF;
	RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_unit_search_document_from_dependency()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
    IF nullif(current_setting('rezics.unit_merge_operation_id', true), '') IS NOT NULL THEN
        RETURN NULL;
    END IF;
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        PERFORM public.refresh_unit_search_document(OLD.unit_id);
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE')
       AND (TG_OP = 'INSERT' OR NEW.unit_id IS DISTINCT FROM OLD.unit_id) THEN
        PERFORM public.refresh_unit_search_document(NEW.unit_id);
	END IF;
	RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_unit_search_document_from_unit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
    IF nullif(current_setting('rezics.unit_merge_operation_id', true), '') IS NOT NULL THEN
        RETURN NULL;
    END IF;
	PERFORM public.refresh_unit_search_document(NEW.id);
	RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_post_reply_search_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE post_kind public.post_kind;
BEGIN
    SELECT kind INTO STRICT post_kind FROM public.post WHERE id = NEW.post_id;
    NEW.search_reply_count := CASE
        WHEN post_kind = 'reply'::public.post_kind THEN NEW.undeleted_direct_count
        ELSE NEW.undeleted_descendant_count
    END;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS post_reply_search_count_kind_refresh ON public.post;
CREATE TRIGGER post_reply_search_count_kind_refresh AFTER UPDATE OF kind ON public.post FOR EACH ROW WHEN ((old.kind IS DISTINCT FROM new.kind)) EXECUTE FUNCTION public.refresh_post_reply_search_count_after_kind_change();

DROP TRIGGER IF EXISTS post_reply_stat_search_count_set ON public.post_reply_stat;
CREATE TRIGGER post_reply_stat_search_count_set BEFORE INSERT OR UPDATE OF undeleted_direct_count, undeleted_descendant_count ON public.post_reply_stat FOR EACH ROW EXECUTE FUNCTION public.set_post_reply_search_count();

DROP TRIGGER IF EXISTS unit_search_document_from_alias ON public.unit_alias;
CREATE TRIGGER unit_search_document_from_alias AFTER INSERT OR DELETE OR UPDATE ON public.unit_alias FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_dependency();

DROP TRIGGER IF EXISTS unit_search_document_from_alias_stat ON public.unit_alias_vote_stat;
CREATE TRIGGER unit_search_document_from_alias_stat AFTER INSERT OR DELETE OR UPDATE OF score ON public.unit_alias_vote_stat FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_alias_stat();

DROP TRIGGER IF EXISTS unit_search_document_from_localization ON public.unit_localization;
CREATE TRIGGER unit_search_document_from_localization AFTER INSERT OR DELETE OR UPDATE ON public.unit_localization FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_dependency();

DROP TRIGGER IF EXISTS unit_search_document_identity_fill ON public.unit_search_document;
CREATE TRIGGER unit_search_document_identity_fill BEFORE INSERT OR UPDATE OF unit_id ON public.unit_search_document FOR EACH ROW EXECUTE FUNCTION public.fill_unit_search_document_identity();

CREATE INDEX IF NOT EXISTS unit_localization_pgroonga_content_idx ON public.unit_localization USING pgroonga (current_search_text_v1(content)) WITH (lexicon_flags_mapping='{"current_search_text_v1":["LARGE"]}', index_flags_mapping='{"current_search_text_v1":["LARGE"]}');
CREATE INDEX IF NOT EXISTS unit_localization_pgroonga_metadata_idx ON public.unit_localization USING pgroonga (current_search_metadata_v1(title, summary, description)) WITH (lexicon_flags_mapping='{"current_search_metadata_v1":["LARGE"]}', index_flags_mapping='{"current_search_metadata_v1":["LARGE"]}');

DROP TRIGGER IF EXISTS unit_search_document_from_owner ON public.post;
CREATE TRIGGER unit_search_document_from_owner AFTER INSERT OR UPDATE ON public.post FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_unit();
DROP TRIGGER IF EXISTS unit_search_document_from_owner ON public.video;
CREATE TRIGGER unit_search_document_from_owner AFTER INSERT OR UPDATE ON public.video FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_unit();
DROP TRIGGER IF EXISTS unit_search_document_from_owner ON public.audio;
CREATE TRIGGER unit_search_document_from_owner AFTER INSERT OR UPDATE ON public.audio FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_unit();
DROP TRIGGER IF EXISTS unit_search_document_from_owner ON public.poll;
CREATE TRIGGER unit_search_document_from_owner AFTER INSERT OR UPDATE ON public.poll FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_unit();
DROP TRIGGER IF EXISTS unit_search_document_from_owner ON public.zone;
CREATE TRIGGER unit_search_document_from_owner AFTER INSERT OR UPDATE ON public.zone FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_unit();
DROP TRIGGER IF EXISTS unit_search_document_from_owner ON public.realm;
CREATE TRIGGER unit_search_document_from_owner AFTER INSERT OR UPDATE ON public.realm FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_unit();
DROP TRIGGER IF EXISTS unit_search_document_from_owner ON public.realm_rule;
CREATE TRIGGER unit_search_document_from_owner AFTER INSERT OR UPDATE ON public.realm_rule FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_unit();
DROP TRIGGER IF EXISTS unit_search_document_from_owner ON public.custom_theme;
CREATE TRIGGER unit_search_document_from_owner AFTER INSERT OR UPDATE ON public.custom_theme FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_unit();
DROP TRIGGER IF EXISTS unit_search_document_from_owner ON public.collection;
CREATE TRIGGER unit_search_document_from_owner AFTER INSERT OR UPDATE ON public.collection FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_unit();
DROP TRIGGER IF EXISTS unit_search_document_from_owner ON public.tag;
CREATE TRIGGER unit_search_document_from_owner AFTER INSERT OR UPDATE ON public.tag FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_unit();
DROP TRIGGER IF EXISTS unit_search_document_from_owner ON public.tag_path;
CREATE TRIGGER unit_search_document_from_owner AFTER INSERT OR UPDATE ON public.tag_path FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_unit();
DROP TRIGGER IF EXISTS unit_search_document_from_owner ON public.label;
CREATE TRIGGER unit_search_document_from_owner AFTER INSERT OR UPDATE ON public.label FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_search_document_from_unit();
