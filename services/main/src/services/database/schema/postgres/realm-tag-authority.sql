-- Realm-local authority is preserved in every source fact and projection key.

CREATE OR REPLACE FUNCTION public.lock_vote_hot_key(lock_key text, lock_seed bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
	IF NOT pg_try_advisory_xact_lock(hashtextextended(lock_key, lock_seed)) THEN
		RAISE EXCEPTION 'Vote aggregate key is busy'
			USING ERRCODE = '55P03', CONSTRAINT = 'vote_hot_key_busy';
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_realm_tag_judgment_keys(
	target_realm_ids uuid[],
	target_unit_ids uuid[],
	target_tag_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
	hot_key record;
BEGIN
	IF target_realm_ids IS NULL OR target_unit_ids IS NULL OR target_tag_ids IS NULL
		OR cardinality(target_realm_ids) > 1024
		OR cardinality(target_realm_ids) <> cardinality(target_unit_ids)
		OR cardinality(target_realm_ids) <> cardinality(target_tag_ids)
		OR EXISTS (
			SELECT 1
			FROM unnest(target_realm_ids, target_unit_ids, target_tag_ids)
				AS key(realm_id, unit_id, tag_id)
			WHERE key.realm_id IS NULL OR key.unit_id IS NULL OR key.tag_id IS NULL
		) THEN
		RAISE EXCEPTION 'Realm Tag judgment hot-key arrays must contain at most 1024 aligned keys'
			USING ERRCODE = '22023', CONSTRAINT = 'realm_tag_judgment_hot_key_batch_invalid';
	END IF;
	FOR hot_key IN
		SELECT DISTINCT key.realm_id, key.unit_id, key.tag_id
		FROM unnest(target_realm_ids, target_unit_ids, target_tag_ids)
			AS key(realm_id, unit_id, tag_id)
		ORDER BY key.realm_id, key.unit_id, key.tag_id
	LOOP
		PERFORM public.lock_vote_hot_key(
			'realm_tag_stat:' || hot_key.realm_id::text || ':' || hot_key.unit_id::text || ':' || hot_key.tag_id::text,
			0
		);
	END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_realm_unit_effective_tags(
	target_realm_id uuid,
	target_unit_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	PERFORM public.lock_vote_hot_key(
		'realm_effective_tags:' || target_realm_id::text || ':' || target_unit_id::text,
		0
	);
	DELETE FROM public.realm_unit_effective_tag
	WHERE realm_id = target_realm_id AND unit_id = target_unit_id;
	INSERT INTO public.realm_unit_effective_tag(
		realm_id, unit_id, tag_id, direct, primary_expression_count,
		entailed_expression_count, retrieval_expression_count, updated_at
	)
	SELECT target_realm_id,
		target_unit_id,
		source.tag_id,
		bool_or(source.direct),
		count(DISTINCT source.expression_id) FILTER (WHERE source.evidence_kind = 'primary'),
		count(DISTINCT source.expression_id) FILTER (WHERE source.evidence_kind = 'entailed'),
		count(DISTINCT source.expression_id) FILTER (WHERE source.evidence_kind = 'retrieval_only'),
		clock_timestamp()
	FROM (
		SELECT direct_tag.tag_id, true AS direct, NULL::uuid AS expression_id,
			NULL::text AS evidence_kind
		FROM public.realm_unit_tag AS direct_tag
		WHERE direct_tag.realm_id = target_realm_id AND direct_tag.unit_id = target_unit_id
		UNION ALL
		SELECT effective.tag_id, false, assertion.expression_id, effective.evidence_kind
		FROM public.realm_unit_expression_assertion AS assertion
		JOIN public.tag_expression_effective_tag AS effective
			ON effective.expression_id = assertion.expression_id
		WHERE assertion.realm_id = target_realm_id AND assertion.unit_id = target_unit_id
	) AS source
	GROUP BY source.tag_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_realm_unit_expression_assertion(
	target_realm_id uuid,
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
		'realm_expression_assertion:' || target_realm_id::text || ':' || target_unit_id::text || ':' || target_expression_id::text,
		0
	);
	SELECT EXISTS (
		SELECT 1
		FROM public.tag_expression AS expression
		JOIN public.realm_unit_tag AS direct_tag
			ON direct_tag.realm_id = target_realm_id
			AND direct_tag.unit_id = target_unit_id
			AND direct_tag.tag_id = expression.focus_tag_id
		WHERE expression.id = target_expression_id
			AND expression.expression_kind = 'simple'
			AND expression.status = 'active'
			AND expression.sealed_at IS NOT NULL
	) INTO direct_exists;
	SELECT count(*)
	INTO accepted_application_count
	FROM public.realm_unit_tag_path_application AS application
	JOIN public.tag_path_sense AS sense ON sense.id = application.sense_id
	JOIN public.realm_unit_tag_path_application_judgment_stat AS judgment
		ON judgment.application_id = application.id
	WHERE application.realm_id = target_realm_id
		AND application.unit_id = target_unit_id
		AND sense.expression_id = target_expression_id
		AND sense.sealed_at IS NOT NULL
		AND judgment.score > 0
		AND judgment.vote_count > 0;
	IF direct_exists OR accepted_application_count > 0 THEN
		INSERT INTO public.realm_unit_expression_assertion(
			realm_id, unit_id, expression_id, direct, path_application_count, updated_at
		) VALUES (
			target_realm_id, target_unit_id, target_expression_id,
			direct_exists, accepted_application_count, clock_timestamp()
		)
		ON CONFLICT (realm_id, unit_id, expression_id) DO UPDATE SET
			direct = EXCLUDED.direct,
			path_application_count = EXCLUDED.path_application_count,
			updated_at = EXCLUDED.updated_at;
	ELSE
		DELETE FROM public.realm_unit_expression_assertion
		WHERE realm_id = target_realm_id AND unit_id = target_unit_id
			AND expression_id = target_expression_id;
	END IF;
	PERFORM public.refresh_realm_unit_effective_tags(target_realm_id, target_unit_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_realm_expression_from_direct()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	target_realm_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.realm_id ELSE NEW.realm_id END;
	target_unit_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	target_tag_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	target_expression_id uuid;
BEGIN
	SELECT id INTO target_expression_id
	FROM public.tag_expression
	WHERE expression_kind = 'simple' AND focus_tag_id = target_tag_id
		AND status = 'active' AND sealed_at IS NOT NULL;
	IF target_expression_id IS NULL THEN
		RAISE EXCEPTION 'A direct Realm Tag requires its sealed simple Expression'
			USING ERRCODE = '23514', CONSTRAINT = 'realm_unit_tag_simple_expression_required';
	END IF;
	PERFORM public.refresh_realm_unit_expression_assertion(
		target_realm_id, target_unit_id, target_expression_id
	);
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_realm_tag_path_vote_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_realm uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.realm_id ELSE NEW.realm_id END;
	key_path uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.path_id ELSE NEW.path_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key('realm_path_vote:' || key_realm::text || ':' || key_path::text, 0);
	IF TG_OP <> 'INSERT' THEN score_delta := score_delta - OLD.value; count_delta := count_delta - 1; END IF;
	IF TG_OP <> 'DELETE' THEN score_delta := score_delta + NEW.value; count_delta := count_delta + 1; END IF;
	INSERT INTO public.realm_tag_path_vote_stat(realm_id, path_id, score, vote_count, updated_at)
	VALUES (key_realm, key_path, score_delta, count_delta, clock_timestamp())
	ON CONFLICT (realm_id, path_id) DO UPDATE SET
		score = realm_tag_path_vote_stat.score + EXCLUDED.score,
		vote_count = realm_tag_path_vote_stat.vote_count + EXCLUDED.vote_count,
		updated_at = EXCLUDED.updated_at;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_realm_tag_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_realm uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.realm_id ELSE NEW.realm_id END;
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_tag uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
	spoiler_delta bigint := 0;
	none_delta bigint := 0;
	minor_delta bigint := 0;
	major_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key(
		'realm_tag_stat:' || key_realm::text || ':' || key_unit::text || ':' || key_tag::text, 0
	);
	IF TG_OP <> 'INSERT' THEN
		IF OLD.fit_vote IS NOT NULL THEN score_delta := score_delta - OLD.fit_vote; count_delta := count_delta - 1; END IF;
		IF OLD.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta - 1;
			IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
			ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
			ELSE major_delta := major_delta - 1;
			END IF;
		END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		IF NEW.fit_vote IS NOT NULL THEN score_delta := score_delta + NEW.fit_vote; count_delta := count_delta + 1; END IF;
		IF NEW.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta + 1;
			IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
			ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
			ELSE major_delta := major_delta + 1;
			END IF;
		END IF;
	END IF;
	INSERT INTO public.realm_tag_judgment_stat(
		realm_id, unit_id, tag_id, score, vote_count, spoiler_vote_count,
		spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at
	) VALUES (
		key_realm, key_unit, key_tag, score_delta, count_delta, spoiler_delta,
		none_delta, minor_delta, major_delta, clock_timestamp()
	)
	ON CONFLICT (realm_id, unit_id, tag_id) DO UPDATE SET
		score = realm_tag_judgment_stat.score + EXCLUDED.score,
		vote_count = realm_tag_judgment_stat.vote_count + EXCLUDED.vote_count,
		spoiler_vote_count = realm_tag_judgment_stat.spoiler_vote_count + EXCLUDED.spoiler_vote_count,
		spoiler_none_count = realm_tag_judgment_stat.spoiler_none_count + EXCLUDED.spoiler_none_count,
		spoiler_minor_count = realm_tag_judgment_stat.spoiler_minor_count + EXCLUDED.spoiler_minor_count,
		spoiler_major_count = realm_tag_judgment_stat.spoiler_major_count + EXCLUDED.spoiler_major_count,
		updated_at = EXCLUDED.updated_at;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_realm_tag_path_sense_adoption()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM public.tag_path_sense AS sense
		WHERE sense.id = NEW.sense_id AND sense.path_id = NEW.path_id
			AND sense.status = 'active' AND sense.sealed_at IS NOT NULL
			AND (sense.scope = 'global' OR (sense.scope = 'realm' AND sense.realm_id = NEW.realm_id))
	) THEN
		RAISE EXCEPTION 'Realm Sense adoption must preserve the Sense authority and Path identity'
			USING ERRCODE = '23514', CONSTRAINT = 'realm_tag_path_sense_authority';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_realm_unit_tag_path_application()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF TG_OP = 'UPDATE' AND (OLD.id, OLD.realm_id, OLD.unit_id, OLD.sense_id,
		OLD.created_by_profile_id, OLD.created_at) IS DISTINCT FROM
		(NEW.id, NEW.realm_id, NEW.unit_id, NEW.sense_id,
		NEW.created_by_profile_id, NEW.created_at) THEN
		RAISE EXCEPTION 'Realm Path Application identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'realm_unit_tag_path_application_identity_immutable';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_realm_application_expression()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	target_realm_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.realm_id ELSE NEW.realm_id END;
	target_unit_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	target_sense_id uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.sense_id ELSE NEW.sense_id END;
	target_expression_id uuid;
BEGIN
	SELECT expression_id INTO target_expression_id FROM public.tag_path_sense WHERE id = target_sense_id;
	IF target_expression_id IS NOT NULL THEN
		PERFORM public.refresh_realm_unit_expression_assertion(
			target_realm_id, target_unit_id, target_expression_id
		);
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_realm_unit_tag_path_application_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_application uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.application_id ELSE NEW.application_id END;
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
	target_realm_id uuid;
	target_unit_id uuid;
	target_expression_id uuid;
	target_path_id uuid;
BEGIN
	PERFORM public.lock_vote_hot_key('realm_path_application:' || key_application::text, 0);
	SELECT score, vote_count, score > 0 AND vote_count > 0
	INTO current_score, current_count, old_accepted
	FROM public.realm_unit_tag_path_application_judgment_stat
	WHERE application_id = key_application;
	current_score := coalesce(current_score, 0);
	current_count := coalesce(current_count, 0);
	old_accepted := coalesce(old_accepted, false);
	IF TG_OP <> 'INSERT' THEN
		IF OLD.fit_vote IS NOT NULL THEN score_delta := score_delta - OLD.fit_vote; count_delta := count_delta - 1; END IF;
		IF OLD.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta - 1;
			IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
			ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
			ELSE major_delta := major_delta - 1;
			END IF;
		END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		IF NEW.fit_vote IS NOT NULL THEN score_delta := score_delta + NEW.fit_vote; count_delta := count_delta + 1; END IF;
		IF NEW.spoiler_level IS NOT NULL THEN
			spoiler_delta := spoiler_delta + 1;
			IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
			ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
			ELSE major_delta := major_delta + 1;
			END IF;
		END IF;
	END IF;
	INSERT INTO public.realm_unit_tag_path_application_judgment_stat(
		application_id, score, vote_count, spoiler_vote_count,
		spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at
	) VALUES (
		key_application, score_delta, count_delta, spoiler_delta,
		none_delta, minor_delta, major_delta, clock_timestamp()
	)
	ON CONFLICT (application_id) DO UPDATE SET
		score = realm_unit_tag_path_application_judgment_stat.score + EXCLUDED.score,
		vote_count = realm_unit_tag_path_application_judgment_stat.vote_count + EXCLUDED.vote_count,
		spoiler_vote_count = realm_unit_tag_path_application_judgment_stat.spoiler_vote_count + EXCLUDED.spoiler_vote_count,
		spoiler_none_count = realm_unit_tag_path_application_judgment_stat.spoiler_none_count + EXCLUDED.spoiler_none_count,
		spoiler_minor_count = realm_unit_tag_path_application_judgment_stat.spoiler_minor_count + EXCLUDED.spoiler_minor_count,
		spoiler_major_count = realm_unit_tag_path_application_judgment_stat.spoiler_major_count + EXCLUDED.spoiler_major_count,
		updated_at = EXCLUDED.updated_at;
	new_accepted := current_score + score_delta > 0 AND current_count + count_delta > 0;
	IF old_accepted <> new_accepted THEN
		SELECT application.realm_id, application.unit_id, sense.expression_id, sense.path_id
		INTO target_realm_id, target_unit_id, target_expression_id, target_path_id
		FROM public.realm_unit_tag_path_application AS application
		JOIN public.tag_path_sense AS sense ON sense.id = application.sense_id
		WHERE application.id = key_application;
		IF target_path_id IS NOT NULL THEN
			INSERT INTO public.realm_tag_path_vote_stat(
				realm_id, path_id, usage_count, updated_at
			) VALUES (
				target_realm_id, target_path_id,
				CASE WHEN new_accepted THEN 1 ELSE -1 END, clock_timestamp()
			)
			ON CONFLICT (realm_id, path_id) DO UPDATE SET
				usage_count = realm_tag_path_vote_stat.usage_count + EXCLUDED.usage_count,
				updated_at = EXCLUDED.updated_at;
			PERFORM public.refresh_realm_unit_expression_assertion(
				target_realm_id, target_unit_id, target_expression_id
			);
		END IF;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_realm_tag_path_application_judgment_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF (OLD.application_id, OLD.profile_id) IS DISTINCT FROM (NEW.application_id, NEW.profile_id) THEN
		RAISE EXCEPTION 'Realm Application judgment identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'realm_tag_path_application_judgment_identity_immutable';
	END IF;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS realm_tag_path_vote_stat_maintain ON public.realm_tag_path_vote;
CREATE TRIGGER realm_tag_path_vote_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.realm_tag_path_vote
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_tag_path_vote_stat();

DROP TRIGGER IF EXISTS realm_unit_tag_expression_assertion_maintain ON public.realm_unit_tag;
CREATE TRIGGER realm_unit_tag_expression_assertion_maintain
AFTER INSERT OR DELETE ON public.realm_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_expression_from_direct();

DROP TRIGGER IF EXISTS realm_tag_judgment_stat_maintain ON public.realm_tag_judgment;
CREATE TRIGGER realm_tag_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.realm_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_tag_judgment_stat();

DROP TRIGGER IF EXISTS realm_tag_path_sense_adoption_guard ON public.realm_tag_path_sense;
CREATE TRIGGER realm_tag_path_sense_adoption_guard
BEFORE INSERT OR UPDATE ON public.realm_tag_path_sense
FOR EACH ROW EXECUTE FUNCTION public.guard_realm_tag_path_sense_adoption();

DROP TRIGGER IF EXISTS realm_unit_tag_path_application_guard ON public.realm_unit_tag_path_application;
CREATE TRIGGER realm_unit_tag_path_application_guard
BEFORE UPDATE ON public.realm_unit_tag_path_application
FOR EACH ROW EXECUTE FUNCTION public.guard_realm_unit_tag_path_application();

DROP TRIGGER IF EXISTS realm_unit_tag_path_application_expression_maintain ON public.realm_unit_tag_path_application;
CREATE TRIGGER realm_unit_tag_path_application_expression_maintain
AFTER INSERT OR DELETE ON public.realm_unit_tag_path_application
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_application_expression();

DROP TRIGGER IF EXISTS realm_unit_tag_path_application_judgment_identity_guard ON public.realm_unit_tag_path_application_judgment;
CREATE TRIGGER realm_unit_tag_path_application_judgment_identity_guard
BEFORE UPDATE ON public.realm_unit_tag_path_application_judgment
FOR EACH ROW EXECUTE FUNCTION public.protect_realm_tag_path_application_judgment_identity();

DROP TRIGGER IF EXISTS realm_unit_tag_path_application_judgment_stat_maintain ON public.realm_unit_tag_path_application_judgment;
CREATE TRIGGER realm_unit_tag_path_application_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.realm_unit_tag_path_application_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_unit_tag_path_application_judgment_stat();
