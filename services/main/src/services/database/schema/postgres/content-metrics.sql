-- Native owner integrity and derived state. This file is the canonical forward-maintained source.
CREATE OR REPLACE FUNCTION public.refresh_book_localized_content_metric_stat(p_book_unit_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
    DELETE FROM public.book_localized_content_metric_stat
    WHERE book_unit_id = p_book_unit_id;

    INSERT INTO public.book_localized_content_metric_stat (
        book_unit_id, language, chapter_count, word_count, character_count
    )
    SELECT p_book_unit_id, metric.language, count(*), sum(metric.word_count),
        sum(metric.character_count)
    FROM public.content_structure_node AS node
    JOIN public.content_structure AS structure
        ON structure.id = node.structure_id
        AND structure.owner_unit_id = node.owner_unit_id
    JOIN public.post AS content_post ON content_post.id = node.content_unit_id

    JOIN public.unit_localization AS localization ON localization.unit_id = node.content_unit_id
    JOIN public.unit_localization_content_metric AS metric
        ON metric.unit_id = node.content_unit_id
        AND metric.language = localization.language
    WHERE structure.owner_unit_id = p_book_unit_id
      AND structure.kind = 'book.contents'
      AND structure.deleted_at IS NULL
      AND node.deleted_at IS NULL
      AND content_post.kind = 'chapter'
      AND content_post.deleted_at IS NULL
      AND content_post.status = 'published'
      AND content_post.visibility IN ('public', 'unlisted')
      AND localization.content_status = 'published'
    GROUP BY metric.language;
END
$function$;

CREATE OR REPLACE FUNCTION public.refresh_book_metric_from_content_unit()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE
    book_id uuid;
BEGIN
    FOR book_id IN
        SELECT DISTINCT node.owner_unit_id
        FROM public.content_structure_node AS node
        JOIN public.content_structure AS structure ON structure.id = node.structure_id
        WHERE node.content_unit_id = coalesce(NEW.id, OLD.id)
          AND structure.kind = 'book.contents'
    LOOP
        PERFORM public.refresh_book_localized_content_metric_stat(book_id);
    END LOOP;
    RETURN NULL;
END
$function$;

CREATE OR REPLACE FUNCTION public.refresh_book_metric_from_localization()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
DECLARE
    book_id uuid;
    p_content_unit_id uuid := coalesce(NEW.unit_id, OLD.unit_id);
BEGIN
    FOR book_id IN
        SELECT DISTINCT node.owner_unit_id
        FROM public.content_structure_node AS node
        JOIN public.content_structure AS structure ON structure.id = node.structure_id
        WHERE node.content_unit_id = p_content_unit_id
          AND structure.kind = 'book.contents'
    LOOP
        PERFORM public.refresh_book_localized_content_metric_stat(book_id);
    END LOOP;
    RETURN NULL;
END
$function$;

CREATE OR REPLACE FUNCTION public.refresh_book_metric_from_node()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
    IF TG_OP <> 'INSERT' THEN
        PERFORM public.refresh_book_localized_content_metric_stat(OLD.owner_unit_id);
    END IF;
    IF TG_OP <> 'DELETE' AND (
        TG_OP = 'INSERT' OR NEW.owner_unit_id IS DISTINCT FROM OLD.owner_unit_id
    ) THEN
        PERFORM public.refresh_book_localized_content_metric_stat(NEW.owner_unit_id);
    END IF;
    RETURN NULL;
END
$function$;

CREATE OR REPLACE FUNCTION public.refresh_book_metric_from_structure()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO pg_catalog, public
AS $function$
BEGIN
    IF TG_OP <> 'INSERT' THEN
        PERFORM public.refresh_book_localized_content_metric_stat(OLD.owner_unit_id);
    END IF;
    IF TG_OP <> 'DELETE' AND (
        TG_OP = 'INSERT' OR NEW.owner_unit_id IS DISTINCT FROM OLD.owner_unit_id
    ) THEN
        PERFORM public.refresh_book_localized_content_metric_stat(NEW.owner_unit_id);
    END IF;
    RETURN NULL;
END
$function$;

DROP TRIGGER IF EXISTS book_localized_metric_structure_refresh ON public.content_structure;
CREATE TRIGGER book_localized_metric_structure_refresh AFTER INSERT OR DELETE OR UPDATE OF owner_unit_id, kind, deleted_at ON public.content_structure FOR EACH ROW EXECUTE FUNCTION public.refresh_book_metric_from_structure();

DROP TRIGGER IF EXISTS book_localized_metric_node_refresh ON public.content_structure_node;
CREATE TRIGGER book_localized_metric_node_refresh AFTER INSERT OR DELETE OR UPDATE OF structure_id, owner_unit_id, content_unit_id, deleted_at ON public.content_structure_node FOR EACH ROW EXECUTE FUNCTION public.refresh_book_metric_from_node();

DROP TRIGGER IF EXISTS book_localized_metric_post_refresh ON public.post;
CREATE TRIGGER book_localized_metric_post_refresh AFTER INSERT OR DELETE OR UPDATE OF kind, status, visibility, deleted_at ON public.post FOR EACH ROW EXECUTE FUNCTION public.refresh_book_metric_from_content_unit();

DROP TRIGGER IF EXISTS book_localized_metric_localization_refresh ON public.unit_localization;
CREATE TRIGGER book_localized_metric_localization_refresh AFTER INSERT OR DELETE OR UPDATE OF unit_id, language, content_status ON public.unit_localization FOR EACH ROW EXECUTE FUNCTION public.refresh_book_metric_from_localization();

DROP TRIGGER IF EXISTS book_localized_metric_content_refresh ON public.unit_localization_content_metric;
CREATE TRIGGER book_localized_metric_content_refresh AFTER INSERT OR DELETE OR UPDATE OF unit_id, language, word_count, character_count ON public.unit_localization_content_metric FOR EACH ROW EXECUTE FUNCTION public.refresh_book_metric_from_localization();
