-- Canonical current definitions for Book Chapter occurrence progress.
--
-- Only explicit Chapter occurrences contribute. Book and Label occurrences are
-- structural or navigational; the database never traverses a referenced Book.

CREATE OR REPLACE FUNCTION public.apply_book_chapter_delta(
    p_book_unit_id uuid,
    p_node_id uuid,
    p_all_delta bigint,
    p_public_delta bigint
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    IF p_all_delta = 0 AND p_public_delta = 0 THEN
        RETURN;
    END IF;

    IF p_all_delta < 0 OR p_public_delta < 0 THEN
        UPDATE public.book_chapter_stat SET
            all_count = all_count + p_all_delta,
            public_count = public_count + p_public_delta,
            updated_at = now()
        WHERE book_unit_id = p_book_unit_id;

        UPDATE public.book_chapter_progress_stat AS stat SET
            all_completed_count = stat.all_completed_count + p_all_delta,
            public_completed_count = stat.public_completed_count + p_public_delta,
            updated_at = now()
        FROM public.content_structure_node_progress AS progress
        WHERE progress.node_id = p_node_id
          AND stat.profile_id = progress.profile_id
          AND stat.book_unit_id = p_book_unit_id;
    ELSE
        UPDATE public.book_chapter_stat SET
            all_count = all_count + p_all_delta,
            public_count = public_count + p_public_delta,
            updated_at = now()
        WHERE book_unit_id = p_book_unit_id;
        IF NOT FOUND THEN
            INSERT INTO public.book_chapter_stat (book_unit_id, all_count, public_count)
            VALUES (p_book_unit_id, p_all_delta, p_public_delta);
        END IF;

        UPDATE public.book_chapter_progress_stat AS stat SET
            all_completed_count = stat.all_completed_count + p_all_delta,
            public_completed_count = stat.public_completed_count + p_public_delta,
            updated_at = now()
        FROM public.content_structure_node_progress AS progress
        WHERE progress.node_id = p_node_id
          AND stat.profile_id = progress.profile_id
          AND stat.book_unit_id = p_book_unit_id;

        INSERT INTO public.book_chapter_progress_stat (
            profile_id, book_unit_id, all_completed_count, public_completed_count
        )
        SELECT progress.profile_id, p_book_unit_id, p_all_delta, p_public_delta
        FROM public.content_structure_node_progress AS progress
        WHERE progress.node_id = p_node_id
          AND NOT EXISTS (
              SELECT 1 FROM public.book_chapter_progress_stat AS existing
              WHERE existing.profile_id = progress.profile_id
                AND existing.book_unit_id = p_book_unit_id
          );
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.book_chapter_node_scope(
    p_structure_id uuid,
    p_content_unit_id uuid,
    p_node_deleted_at timestamp with time zone
) RETURNS TABLE(book_unit_id uuid, all_eligible boolean, public_eligible boolean)
LANGUAGE sql STABLE
AS $$
SELECT
    structure.owner_unit_id,
    structure.kind = 'book.contents'
        AND structure.deleted_at IS NULL
        AND p_node_deleted_at IS NULL
        AND content_unit.kind = 'post'
        AND content_unit.deleted_at IS NULL
        AND content_post.kind = 'chapter' AS all_eligible,
    structure.kind = 'book.contents'
        AND structure.deleted_at IS NULL
        AND p_node_deleted_at IS NULL
        AND content_unit.kind = 'post'
        AND content_unit.deleted_at IS NULL
        AND content_post.kind = 'chapter'
        AND content_unit.status = 'published'
        AND content_unit.visibility IN ('public', 'unlisted') AS public_eligible
FROM public.content_structure AS structure
JOIN public.unit AS content_unit ON content_unit.id = p_content_unit_id
LEFT JOIN public.post AS content_post ON content_post.id = content_unit.id
WHERE structure.id = p_structure_id
$$;

CREATE OR REPLACE FUNCTION public.maintain_book_chapter_from_node() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_scope record;
    new_scope record;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        SELECT * INTO old_scope FROM public.book_chapter_node_scope(
            OLD.structure_id, OLD.content_unit_id, OLD.deleted_at
        );
        IF old_scope.all_eligible THEN
            PERFORM public.apply_book_chapter_delta(
                old_scope.book_unit_id,
                OLD.id,
                -1,
                CASE WHEN old_scope.public_eligible THEN -1 ELSE 0 END
            );
        END IF;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        SELECT * INTO new_scope FROM public.book_chapter_node_scope(
            NEW.structure_id, NEW.content_unit_id, NEW.deleted_at
        );
        IF new_scope.all_eligible THEN
            PERFORM public.apply_book_chapter_delta(
                new_scope.book_unit_id,
                NEW.id,
                1,
                CASE WHEN new_scope.public_eligible THEN 1 ELSE 0 END
            );
        END IF;
    END IF;
    RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.maintain_book_chapter_from_post() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    occurrence record;
    content_unit public.unit%ROWTYPE;
    old_chapter boolean := TG_OP <> 'INSERT' AND OLD.kind = 'chapter';
    new_chapter boolean := TG_OP <> 'DELETE' AND NEW.kind = 'chapter';
    common_active boolean;
BEGIN
    SELECT * INTO content_unit FROM public.unit WHERE id = coalesce(NEW.id, OLD.id);
    FOR occurrence IN
        SELECT node.id, node.deleted_at, structure.owner_unit_id,
               structure.kind, structure.deleted_at AS structure_deleted_at
        FROM public.content_structure_node AS node
        JOIN public.content_structure AS structure ON structure.id = node.structure_id
        WHERE node.content_unit_id = coalesce(NEW.id, OLD.id)
    LOOP
        common_active := occurrence.kind = 'book.contents'
            AND occurrence.structure_deleted_at IS NULL
            AND occurrence.deleted_at IS NULL
            AND content_unit.kind = 'post'
            AND content_unit.deleted_at IS NULL;
        PERFORM public.apply_book_chapter_delta(
            occurrence.owner_unit_id,
            occurrence.id,
            (CASE WHEN common_active AND new_chapter THEN 1 ELSE 0 END)
                - (CASE WHEN common_active AND old_chapter THEN 1 ELSE 0 END),
            (CASE WHEN common_active AND new_chapter AND content_unit.status = 'published'
                    AND content_unit.visibility IN ('public', 'unlisted') THEN 1 ELSE 0 END)
                - (CASE WHEN common_active AND old_chapter AND content_unit.status = 'published'
                    AND content_unit.visibility IN ('public', 'unlisted') THEN 1 ELSE 0 END)
        );
    END LOOP;
    RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.maintain_book_chapter_from_progress() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    scope record;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        SELECT chapter_scope.* INTO scope
        FROM public.content_structure_node AS node
        CROSS JOIN LATERAL public.book_chapter_node_scope(
            node.structure_id, node.content_unit_id, node.deleted_at
        ) AS chapter_scope
        WHERE node.id = OLD.node_id;
        IF scope.all_eligible THEN
            UPDATE public.book_chapter_progress_stat SET
                all_completed_count = all_completed_count - 1,
                public_completed_count = public_completed_count
                    - CASE WHEN scope.public_eligible THEN 1 ELSE 0 END,
                updated_at = now()
            WHERE profile_id = OLD.profile_id AND book_unit_id = scope.book_unit_id;
        END IF;
    END IF;
    IF TG_OP <> 'DELETE' THEN
        SELECT chapter_scope.* INTO scope
        FROM public.content_structure_node AS node
        CROSS JOIN LATERAL public.book_chapter_node_scope(
            node.structure_id, node.content_unit_id, node.deleted_at
        ) AS chapter_scope
        WHERE node.id = NEW.node_id;
        IF scope.all_eligible THEN
            INSERT INTO public.book_chapter_progress_stat (
                profile_id, book_unit_id, all_completed_count, public_completed_count
            ) VALUES (
                NEW.profile_id,
                scope.book_unit_id,
                1,
                CASE WHEN scope.public_eligible THEN 1 ELSE 0 END
            )
            ON CONFLICT (profile_id, book_unit_id) DO UPDATE SET
                all_completed_count = public.book_chapter_progress_stat.all_completed_count + 1,
                public_completed_count = public.book_chapter_progress_stat.public_completed_count
                    + EXCLUDED.public_completed_count,
                updated_at = now();
        END IF;
    END IF;
    RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.maintain_book_chapter_from_structure() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    occurrence record;
    old_active boolean := TG_OP <> 'INSERT'
        AND OLD.kind = 'book.contents' AND OLD.deleted_at IS NULL;
    new_active boolean := TG_OP <> 'DELETE'
        AND NEW.kind = 'book.contents' AND NEW.deleted_at IS NULL;
BEGIN
    IF old_active = new_active THEN
        RETURN NULL;
    END IF;
    FOR occurrence IN
        SELECT node.id, node.owner_unit_id, content_unit.status, content_unit.visibility
        FROM public.content_structure_node AS node
        JOIN public.unit AS content_unit ON content_unit.id = node.content_unit_id
        JOIN public.post AS content_post ON content_post.id = content_unit.id
        WHERE node.structure_id = coalesce(NEW.id, OLD.id)
          AND node.deleted_at IS NULL
          AND content_unit.kind = 'post'
          AND content_unit.deleted_at IS NULL
          AND content_post.kind = 'chapter'
    LOOP
        PERFORM public.apply_book_chapter_delta(
            occurrence.owner_unit_id,
            occurrence.id,
            (CASE WHEN new_active THEN 1 ELSE 0 END)
                - (CASE WHEN old_active THEN 1 ELSE 0 END),
            (CASE WHEN new_active AND occurrence.status = 'published'
                    AND occurrence.visibility IN ('public', 'unlisted') THEN 1 ELSE 0 END)
                - (CASE WHEN old_active AND occurrence.status = 'published'
                    AND occurrence.visibility IN ('public', 'unlisted') THEN 1 ELSE 0 END)
        );
    END LOOP;
    RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.maintain_book_chapter_from_unit() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    occurrence record;
    is_chapter boolean;
    old_all boolean;
    old_public boolean;
    new_all boolean;
    new_public boolean;
BEGIN
    SELECT kind = 'chapter' INTO is_chapter FROM public.post WHERE id = NEW.id;
    IF NOT coalesce(is_chapter, false) THEN
        RETURN NULL;
    END IF;
    FOR occurrence IN
        SELECT node.id, node.deleted_at, structure.owner_unit_id,
               structure.kind, structure.deleted_at AS structure_deleted_at
        FROM public.content_structure_node AS node
        JOIN public.content_structure AS structure ON structure.id = node.structure_id
        WHERE node.content_unit_id = NEW.id
    LOOP
        old_all := occurrence.kind = 'book.contents'
            AND occurrence.structure_deleted_at IS NULL
            AND occurrence.deleted_at IS NULL
            AND OLD.kind = 'post' AND OLD.deleted_at IS NULL;
        new_all := occurrence.kind = 'book.contents'
            AND occurrence.structure_deleted_at IS NULL
            AND occurrence.deleted_at IS NULL
            AND NEW.kind = 'post' AND NEW.deleted_at IS NULL;
        old_public := old_all AND OLD.status = 'published'
            AND OLD.visibility IN ('public', 'unlisted');
        new_public := new_all AND NEW.status = 'published'
            AND NEW.visibility IN ('public', 'unlisted');
        PERFORM public.apply_book_chapter_delta(
            occurrence.owner_unit_id,
            occurrence.id,
            (CASE WHEN new_all THEN 1 ELSE 0 END) - (CASE WHEN old_all THEN 1 ELSE 0 END),
            (CASE WHEN new_public THEN 1 ELSE 0 END)
                - (CASE WHEN old_public THEN 1 ELSE 0 END)
        );
    END LOOP;
    RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS book_chapter_node_stat_maintain ON public.content_structure_node;
CREATE TRIGGER book_chapter_node_stat_maintain
AFTER INSERT OR DELETE OR UPDATE OF structure_id, content_unit_id, deleted_at
ON public.content_structure_node
FOR EACH ROW EXECUTE FUNCTION public.maintain_book_chapter_from_node();

DROP TRIGGER IF EXISTS book_chapter_post_stat_maintain ON public.post;
CREATE TRIGGER book_chapter_post_stat_maintain
AFTER INSERT OR DELETE OR UPDATE OF kind
ON public.post
FOR EACH ROW EXECUTE FUNCTION public.maintain_book_chapter_from_post();

DROP TRIGGER IF EXISTS book_chapter_progress_stat_maintain
ON public.content_structure_node_progress;
CREATE TRIGGER book_chapter_progress_stat_maintain
AFTER INSERT OR DELETE OR UPDATE OF profile_id, node_id
ON public.content_structure_node_progress
FOR EACH ROW EXECUTE FUNCTION public.maintain_book_chapter_from_progress();

DROP TRIGGER IF EXISTS book_chapter_structure_stat_maintain ON public.content_structure;
CREATE TRIGGER book_chapter_structure_stat_maintain
AFTER INSERT OR DELETE OR UPDATE OF kind, deleted_at
ON public.content_structure
FOR EACH ROW EXECUTE FUNCTION public.maintain_book_chapter_from_structure();

DROP TRIGGER IF EXISTS book_chapter_unit_stat_maintain ON public.unit;
CREATE TRIGGER book_chapter_unit_stat_maintain
AFTER UPDATE OF kind, status, visibility, deleted_at
ON public.unit
FOR EACH ROW EXECUTE FUNCTION public.maintain_book_chapter_from_unit();
