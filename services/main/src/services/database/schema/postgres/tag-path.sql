-- Immutable Tag Path definitions, bounded member projections, global judgments,
-- effective-Tag provenance, and audited manual merge governance.

CREATE OR REPLACE FUNCTION public.guard_tag_path_definition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	eligible_count integer;
	distinct_count integer;
BEGIN
	IF TG_OP <> 'INSERT' THEN
		RAISE EXCEPTION 'Tag Path definitions are immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_definition_immutable';
	END IF;

	SELECT count(DISTINCT member_id), count(*)
	INTO distinct_count, eligible_count
	FROM unnest(NEW.member_tag_ids) AS member_id
	JOIN public.tag ON tag.id = member_id
	JOIN public.unit ON unit.id = member_id
	WHERE unit.kind = 'tag'
		AND unit.status = 'published'::public.unit_status
		AND unit.visibility = 'public'::public.resource_visibility
		AND unit.moderation_status = 'approved'::public.moderation_status
		AND unit.deleted_at IS NULL;

	IF eligible_count <> cardinality(NEW.member_tag_ids)
		OR distinct_count <> cardinality(NEW.member_tag_ids) THEN
		RAISE EXCEPTION 'Every Tag Path member must be a distinct active, approved, public Tag'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_member_eligibility';
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM public.unit
		WHERE id = NEW.id AND kind = 'tag_path'
	) THEN
		RAISE EXCEPTION 'Tag Path identity must reference a tag_path Unit'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_unit_kind';
	END IF;

	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.project_tag_path_definition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	INSERT INTO public.tag_path_member(path_id, ordinal, tag_id)
	SELECT NEW.id, member.ordinality - 1, member.tag_id
	FROM unnest(NEW.member_tag_ids) WITH ORDINALITY AS member(tag_id, ordinality);

	INSERT INTO public.tag_path_edge(path_id, ordinal, parent_tag_id, child_tag_id)
	SELECT NEW.id, member.ordinality - 1, NEW.member_tag_ids[member.ordinality],
		NEW.member_tag_ids[member.ordinality + 1]
	FROM generate_series(1, cardinality(NEW.member_tag_ids) - 1) AS member(ordinality);

	INSERT INTO public.tag_path_vote_stat(path_id) VALUES (NEW.id);
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_path_projection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF pg_trigger_depth() < 2 THEN
		RAISE EXCEPTION '% is a rebuildable Tag Path projection', TG_TABLE_NAME
			USING ERRCODE = '23514', CONSTRAINT = TG_TABLE_NAME || '_projection_only';
	END IF;
	RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_path_member_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		IF OLD.kind = 'tag' AND EXISTS (
			SELECT 1 FROM public.tag_path_member WHERE tag_id = OLD.id LIMIT 1
		) THEN
			RAISE EXCEPTION 'A Tag used by a Tag Path cannot be deleted'
				USING ERRCODE = '23514', CONSTRAINT = 'tag_path_member_lifecycle';
		END IF;
		RETURN OLD;
	END IF;
	IF OLD.kind = 'tag' AND EXISTS (
		SELECT 1 FROM public.tag_path_member WHERE tag_id = OLD.id LIMIT 1
	) AND (
		NEW.kind <> 'tag'
		OR NEW.status <> 'published'::public.unit_status
		OR NEW.visibility <> 'public'::public.resource_visibility
		OR NEW.moderation_status <> 'approved'::public.moderation_status
		OR NEW.deleted_at IS NOT NULL
	) THEN
		RAISE EXCEPTION 'A Tag used by a Tag Path must remain active, approved, and public'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_member_lifecycle';
	END IF;
	RETURN NEW;
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
	INSERT INTO public.tag_path_vote_stat(path_id, score, vote_count, updated_at)
	VALUES (key_id, score_delta, count_delta, clock_timestamp())
	ON CONFLICT (path_id) DO UPDATE SET
		score = tag_path_vote_stat.score + EXCLUDED.score,
		vote_count = tag_path_vote_stat.vote_count + EXCLUDED.vote_count,
		updated_at = EXCLUDED.updated_at;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_tag_path_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_path uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.path_id ELSE NEW.path_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
	spoiler_delta bigint := 0;
	none_delta bigint := 0;
	minor_delta bigint := 0;
	major_delta bigint := 0;
	old_accepted boolean;
	new_accepted boolean;
	current_score bigint;
	current_count bigint;
BEGIN
	PERFORM public.lock_vote_hot_key('unit_tag_path:' || key_unit::text || ':' || key_path::text, 0);
	SELECT score > 0 AND vote_count > 0, score, vote_count
	INTO old_accepted, current_score, current_count
	FROM public.unit_tag_path_judgment_stat
	WHERE unit_id = key_unit AND path_id = key_path;
	old_accepted := coalesce(old_accepted, false);
	current_score := coalesce(current_score, 0);
	current_count := coalesce(current_count, 0);

	IF TG_OP <> 'INSERT' THEN
		IF OLD.fit_vote IS NOT NULL THEN score_delta := score_delta - OLD.fit_vote; count_delta := count_delta - 1; END IF;
		IF OLD.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta - 1;
			IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
			ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
			ELSE major_delta := major_delta - 1; END IF;
		END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		IF NEW.fit_vote IS NOT NULL THEN score_delta := score_delta + NEW.fit_vote; count_delta := count_delta + 1; END IF;
		IF NEW.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta + 1;
			IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
			ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
			ELSE major_delta := major_delta + 1; END IF;
		END IF;
	END IF;

	INSERT INTO public.unit_tag_path_judgment_stat(
		unit_id, path_id, score, vote_count, spoiler_vote_count,
		spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at
	) VALUES (
		key_unit, key_path, score_delta, count_delta, spoiler_delta,
		none_delta, minor_delta, major_delta, clock_timestamp()
	) ON CONFLICT (unit_id, path_id) DO UPDATE SET
		score = unit_tag_path_judgment_stat.score + EXCLUDED.score,
		vote_count = unit_tag_path_judgment_stat.vote_count + EXCLUDED.vote_count,
		spoiler_vote_count = unit_tag_path_judgment_stat.spoiler_vote_count + EXCLUDED.spoiler_vote_count,
		spoiler_none_count = unit_tag_path_judgment_stat.spoiler_none_count + EXCLUDED.spoiler_none_count,
		spoiler_minor_count = unit_tag_path_judgment_stat.spoiler_minor_count + EXCLUDED.spoiler_minor_count,
		spoiler_major_count = unit_tag_path_judgment_stat.spoiler_major_count + EXCLUDED.spoiler_major_count,
		updated_at = EXCLUDED.updated_at;

	new_accepted := current_score + score_delta > 0 AND current_count + count_delta > 0;
	IF old_accepted <> new_accepted THEN
		UPDATE public.tag_path_vote_stat
		SET usage_count = usage_count + CASE WHEN new_accepted THEN 1 ELSE -1 END,
			updated_at = clock_timestamp()
		WHERE path_id = key_path;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_tag_path_support()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	old_unit uuid := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.unit_id END;
	old_path uuid := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.path_id END;
	old_profile uuid := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.profile_id END;
BEGIN
	IF TG_OP <> 'INSERT' THEN
		DELETE FROM public.unit_tag_path_support
		WHERE unit_id = old_unit AND path_id = old_path AND profile_id = old_profile;
	END IF;
	IF TG_OP <> 'DELETE' AND NEW.fit_vote = 1 THEN
		INSERT INTO public.unit_tag_path_support(unit_id, tag_id, profile_id, path_id)
		SELECT NEW.unit_id, member.tag_id, NEW.profile_id, NEW.path_id
		FROM public.tag_path_member AS member
		WHERE member.path_id = NEW.path_id
		ON CONFLICT DO NOTHING;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_effective_tag_from_path_support()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_tag uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	support_count bigint;
	direct_exists boolean;
BEGIN
	PERFORM public.lock_vote_hot_key('unit_effective_tag:' || key_unit::text || ':' || key_tag::text, 0);
	SELECT count(*) INTO support_count FROM public.unit_tag_path_support
	WHERE unit_id = key_unit AND tag_id = key_tag;
	SELECT EXISTS(SELECT 1 FROM public.unit_tag WHERE unit_id = key_unit AND tag_id = key_tag)
	INTO direct_exists;
	IF direct_exists OR support_count > 0 THEN
		INSERT INTO public.unit_effective_tag(unit_id, tag_id, direct, path_support_count, updated_at)
		VALUES (key_unit, key_tag, direct_exists, support_count, clock_timestamp())
		ON CONFLICT (unit_id, tag_id) DO UPDATE SET
			direct = EXCLUDED.direct,
			path_support_count = EXCLUDED.path_support_count,
			updated_at = EXCLUDED.updated_at;
	ELSE
		DELETE FROM public.unit_effective_tag WHERE unit_id = key_unit AND tag_id = key_tag;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_unit_tag_path_judgment_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF (OLD.unit_id, OLD.path_id, OLD.profile_id) IS DISTINCT FROM
		(NEW.unit_id, NEW.path_id, NEW.profile_id) THEN
		RAISE EXCEPTION 'Unit–Tag Path judgment identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'unit_tag_path_judgment_identity_immutable';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_path_merge()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'Tag Path merge history is append-only'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_merge_append_only';
	END IF;
	IF TG_OP = 'UPDATE' THEN
		IF (OLD.source_path_id, OLD.target_path_id, OLD.reason, OLD.proposal_source_kind,
				OLD.proposal_provenance, OLD.proposed_by_profile_id, OLD.created_at)
			IS DISTINCT FROM
			(NEW.source_path_id, NEW.target_path_id, NEW.reason, NEW.proposal_source_kind,
				NEW.proposal_provenance, NEW.proposed_by_profile_id, NEW.created_at)
			OR NOT ((OLD.status = 'proposed' AND NEW.status IN ('accepted', 'rejected'))
				OR (OLD.status = 'accepted' AND NEW.status = 'reversed')) THEN
			RAISE EXCEPTION 'Invalid Tag Path merge transition'
				USING ERRCODE = '23514', CONSTRAINT = 'tag_path_merge_transition';
		END IF;
	END IF;
	IF NEW.status = 'accepted' AND EXISTS (
		WITH RECURSIVE chain(path_id, depth) AS (
			SELECT NEW.target_path_id, 0
			UNION ALL
			SELECT merge.target_path_id, chain.depth + 1
			FROM chain JOIN public.tag_path_merge AS merge
				ON merge.source_path_id = chain.path_id AND merge.status = 'accepted'
			WHERE chain.depth < 64
		)
		SELECT 1 FROM chain WHERE path_id = NEW.source_path_id OR depth = 64
	) THEN
		RAISE EXCEPTION 'Tag Path merges cannot form a cycle or unbounded chain'
			USING ERRCODE = '23514', CONSTRAINT = 'tag_path_merge_acyclic';
	END IF;
	RETURN NEW;
END;
$$;

CREATE TRIGGER tag_path_definition_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_definition();

CREATE TRIGGER tag_path_definition_project
AFTER INSERT ON public.tag_path
FOR EACH ROW EXECUTE FUNCTION public.project_tag_path_definition();

CREATE TRIGGER tag_path_member_projection_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path_member
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_projection();

CREATE TRIGGER tag_path_edge_projection_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path_edge
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_projection();

CREATE TRIGGER tag_path_member_unit_lifecycle_guard
BEFORE UPDATE OR DELETE ON public.unit
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_member_lifecycle();

CREATE TRIGGER tag_path_vote_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.tag_path_vote
FOR EACH ROW EXECUTE FUNCTION public.maintain_tag_path_vote_stat();

CREATE TRIGGER unit_tag_path_judgment_identity_guard
BEFORE UPDATE ON public.unit_tag_path_judgment
FOR EACH ROW EXECUTE FUNCTION public.protect_unit_tag_path_judgment_identity();

CREATE TRIGGER unit_tag_path_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.unit_tag_path_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_tag_path_judgment_stat();

CREATE TRIGGER unit_tag_path_support_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.unit_tag_path_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_tag_path_support();

CREATE TRIGGER unit_tag_path_support_effective_maintain
AFTER INSERT OR DELETE ON public.unit_tag_path_support
FOR EACH ROW EXECUTE FUNCTION public.refresh_unit_effective_tag_from_path_support();

CREATE TRIGGER tag_path_merge_guard
BEFORE INSERT OR UPDATE OR DELETE ON public.tag_path_merge
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_path_merge();
