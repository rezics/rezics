LOCK TABLE public.tag, public.tag_path_member IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM public.tag_path_member LIMIT 1) THEN
		RAISE EXCEPTION 'Atomic Tag public-position initialization requires empty Tag Paths'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_public_position_atomic_path_empty';
	END IF;
	IF (
		SELECT count(*)
		FROM (SELECT 1 FROM public.tag LIMIT 100001) AS bounded_tag
	) > 100000 THEN
		RAISE EXCEPTION 'Atomic Tag public-position initialization supports at most 100000 existing Tags'
			USING ERRCODE = '54000', CONSTRAINT = 'tag_public_position_atomic_tag_bound';
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.tag_path_unit_is_public(
	target_status public.unit_status,
	target_visibility public.resource_visibility,
	target_moderation_status public.moderation_status,
	target_deleted_at timestamp with time zone
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
	SELECT target_status = 'published'::public.unit_status
		AND target_visibility = 'public'::public.resource_visibility
		AND target_moderation_status = 'approved'::public.moderation_status
		AND target_deleted_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.lock_tag_public_position_keys(target_tag_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	hot_key record;
BEGIN
	IF target_tag_ids IS NULL OR cardinality(target_tag_ids) < 1
		OR cardinality(target_tag_ids) > 16
		OR EXISTS (SELECT 1 FROM unnest(target_tag_ids) AS key(tag_id) WHERE tag_id IS NULL) THEN
		RAISE EXCEPTION 'Tag public-position updates require 1 to 16 non-null Tag IDs'
			USING ERRCODE = '22023', CONSTRAINT = 'tag_public_position_batch_invalid';
	END IF;
	FOR hot_key IN
		SELECT DISTINCT key.tag_id
		FROM unnest(target_tag_ids) AS key(tag_id)
		ORDER BY key.tag_id
	LOOP
		PERFORM public.lock_vote_hot_key('tag_public_position:' || hot_key.tag_id::text, 0);
	END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_public_position_stat_projection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF pg_trigger_depth() < 2 THEN
		RAISE EXCEPTION 'tag_public_position_stat is a trigger-owned read projection'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_public_position_stat_projection_only';
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_tag_public_position_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM public.tag_path_member WHERE node_id = NEW.id LIMIT 1
	) THEN
		RAISE EXCEPTION 'A Tag concept must exist before it can become a Path member'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_public_position_seed_membership';
	END IF;
	INSERT INTO public.tag_public_position_stat(tag_id) VALUES (NEW.id);
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_path_concept_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM public.tag_path_member WHERE node_id = OLD.id LIMIT 1
	) THEN
		RAISE EXCEPTION 'A Tag used by a Path cannot lose its concept marker'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_concept_lifecycle';
	END IF;
	RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_tag_public_position_stat(
	target_path_id uuid,
	count_delta bigint
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	target_tag_ids uuid[];
	projection_count integer;
BEGIN
	IF target_path_id IS NULL OR count_delta IS NULL OR count_delta NOT IN (-1, 1) THEN
		RAISE EXCEPTION 'Tag public-position deltas require one Path and a delta of -1 or 1'
			USING ERRCODE = '22023', CONSTRAINT = 'tag_public_position_delta_invalid';
	END IF;
	SELECT array_agg(member.node_id ORDER BY member.node_id)
	INTO target_tag_ids
	FROM public.tag_path_member AS member
	JOIN public.tag AS concept ON concept.id = member.node_id
	WHERE member.path_id = target_path_id;
	IF target_tag_ids IS NULL THEN RETURN; END IF;
	IF cardinality(target_tag_ids) > 16 THEN
		RAISE EXCEPTION 'A Tag Path cannot update more than 16 public-position counters'
			USING ERRCODE = '54000', CONSTRAINT = 'tag_public_position_fanout';
	END IF;

	PERFORM public.lock_tag_public_position_keys(target_tag_ids);
	PERFORM 1
	FROM public.tag_public_position_stat
	WHERE tag_id = ANY(target_tag_ids)
	ORDER BY tag_id
	FOR UPDATE;
	SELECT count(*) INTO projection_count
	FROM public.tag_public_position_stat
	WHERE tag_id = ANY(target_tag_ids);
	IF projection_count <> cardinality(target_tag_ids) THEN
		RAISE EXCEPTION 'Every Tag concept must have a public-position projection row'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_public_position_stat_dense';
	END IF;
	IF count_delta < 0 AND EXISTS (
		SELECT 1
		FROM public.tag_public_position_stat
		WHERE tag_id = ANY(target_tag_ids)
			AND public_position_count < -count_delta
	) THEN
		RAISE EXCEPTION 'Tag public-position count cannot become negative'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_public_position_stat_count_check';
	END IF;
	UPDATE public.tag_public_position_stat
	SET public_position_count = public_position_count + count_delta,
		updated_at = clock_timestamp()
	WHERE tag_id = ANY(target_tag_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_tag_path_public_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	target_path_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
	old_public boolean := public.tag_path_unit_is_public(
		OLD.status, OLD.visibility, OLD.moderation_status, OLD.deleted_at
	);
	new_public boolean := CASE WHEN TG_OP = 'DELETE' THEN false ELSE public.tag_path_unit_is_public(
		NEW.status, NEW.visibility, NEW.moderation_status, NEW.deleted_at
	) END;
	accepted boolean;
BEGIN
	IF OLD.kind <> 'tag_path' OR old_public = new_public THEN
		RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NULL END;
	END IF;
	PERFORM public.lock_vote_hot_key('tag_path_vote:' || target_path_id::text, 0);
	SELECT score > 0 AND vote_count > 0
	INTO accepted
	FROM public.tag_path_vote_stat
	WHERE path_id = target_path_id;
	IF coalesce(accepted, false) THEN
		PERFORM public.adjust_tag_public_position_stat(
			target_path_id,
			CASE WHEN new_public THEN 1 ELSE -1 END
		);
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NULL END;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_tag_path_vote_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.path_id ELSE NEW.path_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
	old_accepted boolean;
	new_accepted boolean;
	path_public boolean;
BEGIN
	PERFORM public.lock_vote_hot_key('tag_path_vote:' || key_id::text, 0);
	IF TG_OP <> 'INSERT' THEN
		score_delta := score_delta - OLD.value;
		count_delta := count_delta - 1;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		score_delta := score_delta + NEW.value;
		count_delta := count_delta + 1;
	END IF;
	SELECT score > 0 AND vote_count > 0
	INTO old_accepted
	FROM public.tag_path_vote_stat
	WHERE path_id = key_id;
	UPDATE public.tag_path_vote_stat
	SET score = score + score_delta,
		vote_count = vote_count + count_delta,
		updated_at = clock_timestamp()
	WHERE path_id = key_id
	RETURNING score > 0 AND vote_count > 0 INTO new_accepted;
	IF old_accepted IS DISTINCT FROM new_accepted THEN
		SELECT public.tag_path_unit_is_public(
			status, visibility, moderation_status, deleted_at
		)
		INTO path_public
		FROM public.unit
		WHERE id = key_id AND kind = 'tag_path';
		IF coalesce(path_public, false) THEN
			PERFORM public.adjust_tag_public_position_stat(
				key_id,
				CASE WHEN new_accepted THEN 1 ELSE -1 END
			);
		END IF;
	END IF;
	RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tag_public_position_stat_seed ON public.tag;
CREATE TRIGGER tag_public_position_stat_seed
AFTER INSERT ON public.tag
FOR EACH ROW EXECUTE FUNCTION public.seed_tag_public_position_stat();

DROP TRIGGER IF EXISTS tag_path_concept_lifecycle_guard ON public.tag;
CREATE TRIGGER tag_path_concept_lifecycle_guard
BEFORE DELETE ON public.tag
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_concept_lifecycle();

DROP TRIGGER IF EXISTS tag_public_position_stat_projection_guard ON public.tag_public_position_stat;
CREATE TRIGGER tag_public_position_stat_projection_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_public_position_stat
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_public_position_stat_projection();

DROP TRIGGER IF EXISTS tag_path_public_state_maintain ON public.unit;
CREATE TRIGGER tag_path_public_state_maintain
AFTER UPDATE OF status, visibility, moderation_status, deleted_at ON public.unit
FOR EACH ROW EXECUTE FUNCTION public.maintain_tag_path_public_state();

DROP TRIGGER IF EXISTS tag_path_public_delete_maintain ON public.unit;
CREATE TRIGGER tag_path_public_delete_maintain
BEFORE DELETE ON public.unit
FOR EACH ROW EXECUTE FUNCTION public.maintain_tag_path_public_state();

ALTER TABLE public.tag_public_position_stat
	DISABLE TRIGGER tag_public_position_stat_projection_guard;

INSERT INTO public.tag_public_position_stat(tag_id)
SELECT concept.id FROM public.tag AS concept ORDER BY concept.id;

ALTER TABLE public.tag_public_position_stat
	ENABLE TRIGGER tag_public_position_stat_projection_guard;
