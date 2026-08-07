-- atlas:txmode none

CREATE TABLE public.search_best_score (
    snapshot_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    score double precision NOT NULL,
    unit_updated_at timestamp(3) with time zone NOT NULL,
    CONSTRAINT search_best_score_pkey PRIMARY KEY (snapshot_id, unit_id),
    CONSTRAINT search_best_score_positive_check CHECK (score > 0),
    CONSTRAINT search_best_score_snapshot_fkey FOREIGN KEY (snapshot_id)
        REFERENCES public.recommendation_snapshot(id) ON DELETE CASCADE,
    CONSTRAINT search_best_score_unit_id_unit_id_fkey FOREIGN KEY (unit_id)
        REFERENCES public.unit(id) ON DELETE CASCADE
);

CREATE INDEX search_best_score_order_idx
    ON public.search_best_score (snapshot_id, score DESC, unit_updated_at DESC, unit_id DESC);

CREATE INDEX CONCURRENTLY unit_public_created_at_asc_idx
    ON public.unit (created_at ASC, id ASC)
    WHERE status = 'published'::public.unit_status
      AND visibility = 'public'::public.resource_visibility
      AND moderation_status = 'approved'::public.moderation_status
      AND deleted_at IS NULL;

CREATE INDEX CONCURRENTLY unit_public_created_at_desc_idx
    ON public.unit (created_at DESC, id DESC)
    WHERE status = 'published'::public.unit_status
      AND visibility = 'public'::public.resource_visibility
      AND moderation_status = 'approved'::public.moderation_status
      AND deleted_at IS NULL;

CREATE INDEX CONCURRENTLY unit_public_updated_at_asc_idx
    ON public.unit (updated_at ASC, id ASC)
    WHERE status = 'published'::public.unit_status
      AND visibility = 'public'::public.resource_visibility
      AND moderation_status = 'approved'::public.moderation_status
      AND deleted_at IS NULL;

CREATE INDEX CONCURRENTLY unit_public_updated_at_desc_idx
    ON public.unit (updated_at DESC, id DESC)
    WHERE status = 'published'::public.unit_status
      AND visibility = 'public'::public.resource_visibility
      AND moderation_status = 'approved'::public.moderation_status
      AND deleted_at IS NULL;

CREATE INDEX CONCURRENTLY unit_public_published_at_asc_idx
    ON public.unit (published_at ASC, id ASC)
    WHERE status = 'published'::public.unit_status
      AND visibility = 'public'::public.resource_visibility
      AND moderation_status = 'approved'::public.moderation_status
      AND deleted_at IS NULL;

CREATE INDEX CONCURRENTLY unit_public_published_at_desc_idx
    ON public.unit (published_at DESC NULLS LAST, id DESC)
    WHERE status = 'published'::public.unit_status
      AND visibility = 'public'::public.resource_visibility
      AND moderation_status = 'approved'::public.moderation_status
      AND deleted_at IS NULL;

CREATE INDEX CONCURRENTLY unit_follow_stat_count_asc_idx
    ON public.unit_follow_stat (follower_count ASC, unit_id ASC);

CREATE INDEX CONCURRENTLY unit_follow_stat_count_desc_idx
    ON public.unit_follow_stat (follower_count DESC, unit_id DESC);

ALTER TABLE public.post_reply_stat
    ADD COLUMN search_reply_count bigint DEFAULT 0 NOT NULL;

UPDATE public.post_reply_stat AS stat
SET search_reply_count = CASE
    WHEN post.kind = 'reply'::public.post_kind THEN stat.undeleted_direct_count
    ELSE stat.undeleted_descendant_count
END
FROM public.post
WHERE post.id = stat.post_id;

ALTER TABLE public.post_reply_stat
    DROP CONSTRAINT post_reply_stat_count_check,
    ADD CONSTRAINT post_reply_stat_count_check CHECK (
        undeleted_direct_count >= 0
        AND undeleted_descendant_count >= 0
        AND search_reply_count >= 0
        AND visible_direct_count >= 0
        AND visible_descendant_count >= 0
    );

CREATE FUNCTION public.set_post_reply_search_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE post_kind public.post_kind;
BEGIN
    SELECT kind INTO STRICT post_kind FROM public.post WHERE id = NEW.post_id;
    NEW.search_reply_count := CASE
        WHEN post_kind = 'reply'::public.post_kind THEN NEW.undeleted_direct_count
        ELSE NEW.undeleted_descendant_count
    END;
    RETURN NEW;
END;
$$;

CREATE TRIGGER post_reply_stat_search_count_set
    BEFORE INSERT OR UPDATE OF undeleted_direct_count, undeleted_descendant_count
    ON public.post_reply_stat
    FOR EACH ROW EXECUTE FUNCTION public.set_post_reply_search_count();

CREATE FUNCTION public.refresh_post_reply_search_count_after_kind_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE public.post_reply_stat
    SET search_reply_count = CASE
        WHEN NEW.kind = 'reply'::public.post_kind THEN undeleted_direct_count
        ELSE undeleted_descendant_count
    END
    WHERE post_id = NEW.id;
    RETURN NULL;
END;
$$;

CREATE TRIGGER post_reply_search_count_kind_refresh
    AFTER UPDATE OF kind ON public.post
    FOR EACH ROW
    WHEN (OLD.kind IS DISTINCT FROM NEW.kind)
    EXECUTE FUNCTION public.refresh_post_reply_search_count_after_kind_change();

CREATE INDEX CONCURRENTLY post_reply_stat_search_count_asc_idx
    ON public.post_reply_stat (search_reply_count ASC, post_id ASC);

CREATE INDEX CONCURRENTLY post_reply_stat_search_count_desc_idx
    ON public.post_reply_stat (search_reply_count DESC, post_id DESC);

CREATE INDEX CONCURRENTLY poll_closes_at_asc_idx
    ON public.poll (closes_at ASC NULLS LAST, id ASC);

CREATE INDEX CONCURRENTLY poll_closes_at_desc_idx
    ON public.poll (closes_at DESC NULLS LAST, id DESC);
