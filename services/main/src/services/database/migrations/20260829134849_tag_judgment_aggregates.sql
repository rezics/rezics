SET search_path TO public;

-- Global direct-Tag judgments and bounded Expression retrieval projections.
-- Every refresh is routed by one Unit key; no statement scans the corpus.

CREATE OR REPLACE FUNCTION public.lock_vote_hot_keys(
	target_unit_ids uuid[],
	target_tag_ids uuid[],
	target_profile_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
	hot_key record;
BEGIN
	IF target_unit_ids IS NULL OR target_tag_ids IS NULL OR target_profile_ids IS NULL
		OR cardinality(target_unit_ids) > 1024
		OR cardinality(target_unit_ids) <> cardinality(target_tag_ids)
		OR cardinality(target_unit_ids) <> cardinality(target_profile_ids)
		OR EXISTS (
			SELECT 1 FROM unnest(target_unit_ids, target_tag_ids) AS key(unit_id, tag_id)
			WHERE key.unit_id IS NULL OR key.tag_id IS NULL
		) THEN
		RAISE EXCEPTION 'Vote hot-key arrays must contain at most 1024 aligned, non-null Unit/Tag keys'
			USING ERRCODE = '22023', CONSTRAINT = 'vote_hot_key_batch_invalid';
	END IF;
	FOR hot_key IN
		SELECT DISTINCT key.unit_id, key.tag_id
		FROM unnest(target_unit_ids, target_tag_ids) AS key(unit_id, tag_id)
		ORDER BY key.unit_id, key.tag_id
	LOOP
		IF NOT pg_try_advisory_xact_lock(hashtextextended(
			hot_key.unit_id::text || ':' || hot_key.tag_id::text, 71001
		)) THEN
			RAISE EXCEPTION 'Vote aggregate key is busy'
				USING ERRCODE = '55P03', CONSTRAINT = 'vote_hot_key_busy';
		END IF;
	END LOOP;
	FOR hot_key IN
		SELECT DISTINCT key.unit_id, key.tag_id, key.profile_id
		FROM unnest(target_unit_ids, target_tag_ids, target_profile_ids)
			AS key(unit_id, tag_id, profile_id)
		WHERE key.profile_id IS NOT NULL
		ORDER BY key.unit_id, key.tag_id, key.profile_id
	LOOP
		IF NOT pg_try_advisory_xact_lock(hashtextextended(
			hot_key.unit_id::text || ':' || hot_key.tag_id::text || ':' || hot_key.profile_id::text,
			71002
		)) THEN
			RAISE EXCEPTION 'Per-Profile vote key is busy'
				USING ERRCODE = '55P03', CONSTRAINT = 'vote_hot_key_busy';
		END IF;
	END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_effective_tags(target_unit_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	PERFORM public.lock_vote_hot_key('unit_effective_tags:' || target_unit_id::text, 0);
	DELETE FROM public.unit_effective_tag WHERE unit_id = target_unit_id;
	INSERT INTO public.unit_effective_tag(
		unit_id, tag_id, direct, primary_expression_count,
		entailed_expression_count, retrieval_expression_count, updated_at
	)
	SELECT target_unit_id,
		source.tag_id,
		bool_or(source.direct),
		count(DISTINCT source.expression_id) FILTER (WHERE source.evidence_kind = 'primary'),
		count(DISTINCT source.expression_id) FILTER (WHERE source.evidence_kind = 'entailed'),
		count(DISTINCT source.expression_id) FILTER (WHERE source.evidence_kind = 'retrieval_only'),
		clock_timestamp()
	FROM (
		SELECT direct_tag.tag_id, true AS direct, NULL::uuid AS expression_id,
			NULL::text AS evidence_kind
		FROM public.unit_tag AS direct_tag
		WHERE direct_tag.unit_id = target_unit_id
		UNION ALL
		SELECT effective.tag_id, false, assertion.expression_id, effective.evidence_kind
		FROM public.unit_expression_assertion AS assertion
		JOIN public.tag_expression_effective_tag AS effective
			ON effective.expression_id = assertion.expression_id
		WHERE assertion.unit_id = target_unit_id
	) AS source
	GROUP BY source.tag_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_expression_assertion(
	target_unit_id uuid,
	target_expression_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	direct_exists boolean;
	accepted_application_count bigint;
BEGIN
	PERFORM public.lock_vote_hot_key(
		'unit_expression_assertion:' || target_unit_id::text || ':' || target_expression_id::text,
		0
	);
	SELECT EXISTS (
		SELECT 1
		FROM public.tag_expression AS expression
		JOIN public.unit_tag AS direct_tag
			ON direct_tag.unit_id = target_unit_id
			AND direct_tag.tag_id = expression.focus_tag_id
		WHERE expression.id = target_expression_id
			AND expression.expression_kind = 'simple'
			AND expression.status = 'active'
			AND expression.sealed_at IS NOT NULL
	) INTO direct_exists;
	SELECT count(*)
	INTO accepted_application_count
	FROM public.unit_tag_path_application AS application
	JOIN public.tag_path_sense AS sense ON sense.id = application.sense_id
	JOIN public.unit_tag_path_application_judgment_stat AS judgment
		ON judgment.application_id = application.id
	WHERE application.unit_id = target_unit_id
		AND sense.expression_id = target_expression_id
		AND sense.sealed_at IS NOT NULL
		AND judgment.score > 0
		AND judgment.vote_count > 0;
	IF direct_exists OR accepted_application_count > 0 THEN
		INSERT INTO public.unit_expression_assertion(
			unit_id, expression_id, direct, path_application_count, updated_at
		) VALUES (
			target_unit_id, target_expression_id, direct_exists,
			accepted_application_count, clock_timestamp()
		)
		ON CONFLICT (unit_id, expression_id) DO UPDATE SET
			direct = EXCLUDED.direct,
			path_application_count = EXCLUDED.path_application_count,
			updated_at = EXCLUDED.updated_at;
	ELSE
		DELETE FROM public.unit_expression_assertion
		WHERE unit_id = target_unit_id AND expression_id = target_expression_id;
	END IF;
	PERFORM public.refresh_unit_effective_tags(target_unit_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_expression_from_direct()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	target_unit_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	target_tag_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	target_expression_id uuid;
BEGIN
	SELECT id INTO target_expression_id
	FROM public.tag_expression
	WHERE expression_kind = 'simple' AND focus_tag_id = target_tag_id
		AND status = 'active' AND sealed_at IS NOT NULL;
	IF target_expression_id IS NULL THEN
		RAISE EXCEPTION 'A direct Tag requires its sealed simple Expression'
			USING ERRCODE = '23514', CONSTRAINT = 'unit_tag_simple_expression_required';
	END IF;
	PERFORM public.refresh_unit_expression_assertion(target_unit_id, target_expression_id);
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_tag_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_tag uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
	spoiler_delta bigint := 0;
	none_delta bigint := 0;
	minor_delta bigint := 0;
	major_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key('unit_tag_stat:' || key_unit::text || ':' || key_tag::text, 0);
	IF TG_OP <> 'INSERT' THEN
		IF OLD.fit_vote IS NOT NULL THEN
			score_delta := score_delta - OLD.fit_vote;
			count_delta := count_delta - 1;
		END IF;
		IF OLD.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta - 1;
			IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
			ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
			ELSE major_delta := major_delta - 1;
			END IF;
		END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		IF NEW.fit_vote IS NOT NULL THEN
			score_delta := score_delta + NEW.fit_vote;
			count_delta := count_delta + 1;
		END IF;
		IF NEW.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta + 1;
			IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
			ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
			ELSE major_delta := major_delta + 1;
			END IF;
		END IF;
	END IF;
	INSERT INTO public.unit_tag_judgment_stat(
		unit_id, tag_id, score, vote_count, spoiler_vote_count,
		spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at
	) VALUES (
		key_unit, key_tag, score_delta, count_delta, spoiler_delta,
		none_delta, minor_delta, major_delta, clock_timestamp()
	)
	ON CONFLICT (unit_id, tag_id) DO UPDATE SET
		score = unit_tag_judgment_stat.score + EXCLUDED.score,
		vote_count = unit_tag_judgment_stat.vote_count + EXCLUDED.vote_count,
		spoiler_vote_count = unit_tag_judgment_stat.spoiler_vote_count + EXCLUDED.spoiler_vote_count,
		spoiler_none_count = unit_tag_judgment_stat.spoiler_none_count + EXCLUDED.spoiler_none_count,
		spoiler_minor_count = unit_tag_judgment_stat.spoiler_minor_count + EXCLUDED.spoiler_minor_count,
		spoiler_major_count = unit_tag_judgment_stat.spoiler_major_count + EXCLUDED.spoiler_major_count,
		updated_at = EXCLUDED.updated_at;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_subject_association_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.association_id ELSE NEW.association_id END;
	count_delta bigint := 0;
	none_delta bigint := 0;
	minor_delta bigint := 0;
	major_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key('subject_spoiler:' || key_id::text, 0);
	IF TG_OP <> 'INSERT' THEN
		count_delta := count_delta - 1;
		IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
		ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
		ELSE major_delta := major_delta - 1;
		END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		count_delta := count_delta + 1;
		IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
		ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
		ELSE major_delta := major_delta + 1;
		END IF;
	END IF;
	INSERT INTO public.subject_association_judgment_stat(
		association_id, spoiler_vote_count, spoiler_none_count,
		spoiler_minor_count, spoiler_major_count, updated_at
	) VALUES (
		key_id, count_delta, none_delta, minor_delta, major_delta, clock_timestamp()
	)
	ON CONFLICT (association_id) DO UPDATE SET
		spoiler_vote_count = subject_association_judgment_stat.spoiler_vote_count + EXCLUDED.spoiler_vote_count,
		spoiler_none_count = subject_association_judgment_stat.spoiler_none_count + EXCLUDED.spoiler_none_count,
		spoiler_minor_count = subject_association_judgment_stat.spoiler_minor_count + EXCLUDED.spoiler_minor_count,
		spoiler_major_count = subject_association_judgment_stat.spoiler_major_count + EXCLUDED.spoiler_major_count,
		updated_at = EXCLUDED.updated_at;
	RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS unit_tag_expression_assertion_maintain ON public.unit_tag;
CREATE TRIGGER unit_tag_expression_assertion_maintain
AFTER INSERT OR DELETE ON public.unit_tag
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_expression_from_direct();

DROP TRIGGER IF EXISTS unit_tag_judgment_stat_maintain ON public.unit_tag_judgment;
CREATE TRIGGER unit_tag_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.unit_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_tag_judgment_stat();

DROP TRIGGER IF EXISTS subject_association_judgment_stat_maintain ON public.subject_association_judgment;
CREATE TRIGGER subject_association_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.subject_association_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_subject_association_judgment_stat();
