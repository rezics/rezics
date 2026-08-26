-- Realm-local Tag and Tag Path authority. Global and Realm votes remain separate;
-- fallback policy is resolved by readers and never merges aggregate populations.

CREATE OR REPLACE FUNCTION public.lock_vote_hot_key(lock_key text, lock_seed bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
	IF lock_key IS NULL OR lock_seed IS NULL THEN
		RAISE EXCEPTION 'Vote hot key must be non-null'
			USING ERRCODE = '22023', CONSTRAINT = 'vote_hot_key_invalid';
	END IF;
	IF NOT pg_try_advisory_xact_lock(hashtextextended(lock_key, lock_seed)) THEN
		RAISE EXCEPTION 'Vote aggregate key is busy'
			USING ERRCODE = '55P03', CONSTRAINT = 'vote_hot_key_busy';
	END IF;
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
	PERFORM public.lock_vote_hot_key('realm_tag_path_vote:' || key_realm::text || ':' || key_path::text, 0);
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

CREATE OR REPLACE FUNCTION public.maintain_realm_unit_tag_path_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_realm uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.realm_id ELSE NEW.realm_id END;
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_path uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.path_id ELSE NEW.path_id END;
	score_delta bigint := 0;
	count_delta bigint := 0;
	spoiler_delta bigint := 0;
	none_delta bigint := 0;
	minor_delta bigint := 0;
	major_delta bigint := 0;
	old_accepted boolean;
	current_score bigint;
	current_count bigint;
	new_accepted boolean;
BEGIN
	PERFORM public.lock_vote_hot_key('realm_unit_tag_path:' || key_realm::text || ':' || key_unit::text || ':' || key_path::text, 0);
	SELECT score > 0 AND vote_count > 0, score, vote_count
	INTO old_accepted, current_score, current_count
	FROM public.realm_unit_tag_path_judgment_stat
	WHERE realm_id = key_realm AND unit_id = key_unit AND path_id = key_path;
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
	INSERT INTO public.realm_unit_tag_path_judgment_stat(
		realm_id, unit_id, path_id, score, vote_count, spoiler_vote_count,
		spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at
	) VALUES (
		key_realm, key_unit, key_path, score_delta, count_delta, spoiler_delta,
		none_delta, minor_delta, major_delta, clock_timestamp()
	) ON CONFLICT (realm_id, unit_id, path_id) DO UPDATE SET
		score = realm_unit_tag_path_judgment_stat.score + EXCLUDED.score,
		vote_count = realm_unit_tag_path_judgment_stat.vote_count + EXCLUDED.vote_count,
		spoiler_vote_count = realm_unit_tag_path_judgment_stat.spoiler_vote_count + EXCLUDED.spoiler_vote_count,
		spoiler_none_count = realm_unit_tag_path_judgment_stat.spoiler_none_count + EXCLUDED.spoiler_none_count,
		spoiler_minor_count = realm_unit_tag_path_judgment_stat.spoiler_minor_count + EXCLUDED.spoiler_minor_count,
		spoiler_major_count = realm_unit_tag_path_judgment_stat.spoiler_major_count + EXCLUDED.spoiler_major_count,
		updated_at = EXCLUDED.updated_at;
	new_accepted := current_score + score_delta > 0 AND current_count + count_delta > 0;
	IF old_accepted <> new_accepted THEN
		UPDATE public.realm_tag_path_vote_stat
		SET usage_count = usage_count + CASE WHEN new_accepted THEN 1 ELSE -1 END,
			updated_at = clock_timestamp()
		WHERE realm_id = key_realm AND path_id = key_path;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_realm_unit_tag_path_support()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
	IF TG_OP <> 'INSERT' THEN
		DELETE FROM public.realm_unit_tag_path_support
		WHERE realm_id = OLD.realm_id AND unit_id = OLD.unit_id
			AND path_id = OLD.path_id AND profile_id = OLD.profile_id;
	END IF;
	IF TG_OP <> 'DELETE' AND NEW.fit_vote = 1 THEN
		INSERT INTO public.realm_unit_tag_path_support(realm_id, unit_id, tag_id, profile_id, path_id)
		SELECT NEW.realm_id, NEW.unit_id, member.tag_id, NEW.profile_id, NEW.path_id
		FROM public.tag_path_member AS member WHERE member.path_id = NEW.path_id
		ON CONFLICT DO NOTHING;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_realm_unit_effective_tag()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	key_realm uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.realm_id ELSE NEW.realm_id END;
	key_unit uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.unit_id ELSE NEW.unit_id END;
	key_tag uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.tag_id ELSE NEW.tag_id END;
	direct_exists boolean;
	support_count bigint;
BEGIN
	PERFORM public.lock_vote_hot_key('realm_effective_tag:' || key_realm::text || ':' || key_unit::text || ':' || key_tag::text, 0);
	SELECT EXISTS(SELECT 1 FROM public.realm_unit_tag
		WHERE realm_id = key_realm AND unit_id = key_unit AND tag_id = key_tag)
	INTO direct_exists;
	SELECT count(*) FROM public.realm_unit_tag_path_support
	WHERE realm_id = key_realm AND unit_id = key_unit AND tag_id = key_tag
	INTO support_count;
	IF direct_exists OR support_count > 0 THEN
		INSERT INTO public.realm_unit_effective_tag(realm_id, unit_id, tag_id, direct, path_support_count, updated_at)
		VALUES (key_realm, key_unit, key_tag, direct_exists, support_count, clock_timestamp())
		ON CONFLICT (realm_id, unit_id, tag_id) DO UPDATE SET
			direct = EXCLUDED.direct, path_support_count = EXCLUDED.path_support_count,
			updated_at = EXCLUDED.updated_at;
	ELSE
		DELETE FROM public.realm_unit_effective_tag
		WHERE realm_id = key_realm AND unit_id = key_unit AND tag_id = key_tag;
	END IF;
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
	score_delta bigint := 0; count_delta bigint := 0; spoiler_delta bigint := 0;
	none_delta bigint := 0; minor_delta bigint := 0; major_delta bigint := 0;
BEGIN
	PERFORM public.lock_vote_hot_key('realm_tag_stat:' || key_realm::text || ':' || key_unit::text || ':' || key_tag::text, 0);
	IF TG_OP <> 'INSERT' THEN
		IF OLD.fit_vote IS NOT NULL THEN score_delta := score_delta - OLD.fit_vote; count_delta := count_delta - 1; END IF;
		IF OLD.spoiler_level IS NOT NULL THEN spoiler_delta := spoiler_delta - 1;
			IF OLD.spoiler_level = 0 THEN none_delta := none_delta - 1;
			ELSIF OLD.spoiler_level = 1 THEN minor_delta := minor_delta - 1;
			ELSE major_delta := major_delta - 1; END IF; END IF;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		IF NEW.fit_vote IS NOT NULL THEN score_delta := score_delta + NEW.fit_vote; count_delta := count_delta + 1; END IF;
		IF NEW.spoiler_level IS NOT NULL THEN spoiler_delta := spoiler_delta + 1;
			IF NEW.spoiler_level = 0 THEN none_delta := none_delta + 1;
			ELSIF NEW.spoiler_level = 1 THEN minor_delta := minor_delta + 1;
			ELSE major_delta := major_delta + 1; END IF; END IF;
	END IF;
	INSERT INTO public.realm_tag_judgment_stat(
		realm_id, unit_id, tag_id, score, vote_count, spoiler_vote_count,
		spoiler_none_count, spoiler_minor_count, spoiler_major_count, updated_at
	) VALUES (key_realm, key_unit, key_tag, score_delta, count_delta, spoiler_delta,
		none_delta, minor_delta, major_delta, clock_timestamp())
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

CREATE OR REPLACE FUNCTION public.protect_realm_tag_path_judgment_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF (OLD.realm_id, OLD.unit_id, OLD.path_id, OLD.profile_id) IS DISTINCT FROM
		(NEW.realm_id, NEW.unit_id, NEW.path_id, NEW.profile_id) THEN
		RAISE EXCEPTION 'Realm Unit–Tag Path judgment identity is immutable'
			USING ERRCODE = '23514', CONSTRAINT = 'realm_unit_tag_path_judgment_identity_immutable';
	END IF;
	RETURN NEW;
END;
$$;

CREATE TRIGGER realm_tag_path_vote_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.realm_tag_path_vote
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_tag_path_vote_stat();

CREATE TRIGGER realm_unit_tag_path_judgment_identity_guard
BEFORE UPDATE ON public.realm_unit_tag_path_judgment
FOR EACH ROW EXECUTE FUNCTION public.protect_realm_tag_path_judgment_identity();

CREATE TRIGGER realm_unit_tag_path_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.realm_unit_tag_path_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_unit_tag_path_judgment_stat();

CREATE TRIGGER realm_unit_tag_path_support_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.realm_unit_tag_path_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_unit_tag_path_support();

CREATE TRIGGER realm_unit_tag_path_support_effective_maintain
AFTER INSERT OR DELETE ON public.realm_unit_tag_path_support
FOR EACH ROW EXECUTE FUNCTION public.refresh_realm_unit_effective_tag();

CREATE TRIGGER realm_unit_tag_effective_maintain
AFTER INSERT OR DELETE ON public.realm_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.refresh_realm_unit_effective_tag();

CREATE TRIGGER realm_tag_judgment_stat_maintain
AFTER INSERT OR UPDATE OR DELETE ON public.realm_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_tag_judgment_stat();
