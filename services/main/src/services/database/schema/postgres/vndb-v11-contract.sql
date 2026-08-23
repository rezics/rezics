-- Canonical PostgreSQL functions and triggers for the vndb-v11 Phase 0 contract.
-- Tables, columns, constraints, and indexes remain owned by the Drizzle schema.

CREATE OR REPLACE FUNCTION public.enforce_vndb_v11_cutover_write_fence() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	cutover_state text;
BEGIN
	IF current_setting('transaction_isolation') <> 'read committed' THEN
		RAISE EXCEPTION 'VNDB v11 fenced writes require READ COMMITTED isolation'
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'vndb_v11_cutover_read_committed_required';
	END IF;
	PERFORM pg_catalog.pg_advisory_xact_lock_shared(71011001::bigint);
	SELECT state
	INTO cutover_state
	FROM public.vndb_v11_cutover_control
	WHERE id = 1;
	IF NOT FOUND THEN
		RAISE EXCEPTION 'VNDB v11 cutover control row is missing'
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'vndb_v11_cutover_control_missing';
	END IF;
	IF cutover_state = 'paused' THEN
		RAISE EXCEPTION 'VNDB v11 writes are paused for contract cutover'
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'vndb_v11_writers_paused';
	END IF;
	IF cutover_state = 'postcontract_open' AND coalesce(
		current_setting('rezics.vndb_v11_binary_contract', true)
			= 'vndb-v11-contract-v1',
		false
	) = false THEN
		RAISE EXCEPTION 'The active binary does not identify the vndb-v11 contract'
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'vndb_v11_binary_contract_required';
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_vndb_v11_cutover_control_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	legacy_contract boolean;
	final_contract boolean;
BEGIN
	IF NOT pg_catalog.pg_try_advisory_xact_lock(71011001::bigint) THEN
		RAISE EXCEPTION 'VNDB v11 cutover transition is busy'
			USING
				ERRCODE = '55P03',
				CONSTRAINT = 'vndb_v11_cutover_transition_busy';
	END IF;
	legacy_contract :=
		pg_catalog.to_regclass('public.unit_tag_vote') IS NOT NULL
		AND pg_catalog.to_regclass('public.unit_structure_application_vote') IS NOT NULL
		AND pg_catalog.to_regclass('public.realm_tag_vote') IS NOT NULL
		AND pg_catalog.to_regclass('public.unit_tag_judgment') IS NULL
		AND pg_catalog.to_regclass('public.unit_structure_application_judgment') IS NULL
		AND pg_catalog.to_regclass('public.realm_tag_judgment') IS NULL;
	final_contract :=
		pg_catalog.to_regclass('public.unit_tag_vote') IS NULL
		AND pg_catalog.to_regclass('public.unit_structure_application_vote') IS NULL
		AND pg_catalog.to_regclass('public.realm_tag_vote') IS NULL
		AND pg_catalog.to_regclass('public.unit_tag_judgment') IS NOT NULL
		AND pg_catalog.to_regclass('public.unit_structure_application_judgment') IS NOT NULL
		AND pg_catalog.to_regclass('public.realm_tag_judgment') IS NOT NULL;
	IF NEW IS NOT DISTINCT FROM OLD THEN
		RETURN NEW;
	END IF;
	IF NEW.id IS DISTINCT FROM OLD.id THEN
		RAISE EXCEPTION 'VNDB v11 cutover-control identity is immutable'
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'vndb_v11_cutover_control_immutable';
	END IF;
	IF NOT (
		(
			legacy_contract
			AND (
				(OLD.state = 'precontract_open' AND NEW.state = 'paused')
				OR (OLD.state = 'paused' AND NEW.state = 'precontract_open')
			)
		)
		OR (
			final_contract
			AND (
				(OLD.state = 'paused' AND NEW.state = 'postcontract_open')
				OR (OLD.state = 'postcontract_open' AND NEW.state = 'paused')
				OR (OLD.state = 'precontract_open' AND NEW.state = 'postcontract_open'
					AND NOT EXISTS (SELECT 1 FROM public.unit LIMIT 1))
			)
		)
	) THEN
		RAISE EXCEPTION 'Invalid VNDB v11 cutover transition: % -> %', OLD.state, NEW.state
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'vndb_v11_cutover_transition_invalid';
	END IF;
	IF NEW.transition_epoch <> OLD.transition_epoch + 1 THEN
		RAISE EXCEPTION 'VNDB v11 cutover transition epoch must increase exactly once'
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'vndb_v11_cutover_epoch_invalid';
	END IF;
	IF NEW.state_changed_at < OLD.state_changed_at THEN
		RAISE EXCEPTION 'VNDB v11 cutover transition time cannot move backwards'
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'vndb_v11_cutover_transition_time_invalid';
	END IF;
	INSERT INTO public.vndb_v11_cutover_transition (
		transition_epoch, previous_state, state, transitioned_at, operator, reason
	) VALUES (
		NEW.transition_epoch, OLD.state, NEW.state, NEW.state_changed_at,
		NEW.operator, NEW.reason
	);
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_vndb_v11_cutover_control() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	RAISE EXCEPTION 'VNDB v11 cutover-control cardinality is immutable'
		USING
			ERRCODE = '55000',
			CONSTRAINT = 'vndb_v11_cutover_control_immutable';
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_vndb_v11_cutover_transition() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF TG_OP = 'INSERT' AND pg_catalog.pg_trigger_depth() > 1 THEN
		RETURN NEW;
	END IF;
	RAISE EXCEPTION 'VNDB v11 cutover transition history is append-only'
		USING
			ERRCODE = '55000',
			CONSTRAINT = 'vndb_v11_cutover_transition_immutable';
END;
$$;

DROP TRIGGER IF EXISTS vndb_v11_cutover_control_transition
	ON public.vndb_v11_cutover_control;
CREATE TRIGGER vndb_v11_cutover_control_transition
BEFORE UPDATE ON public.vndb_v11_cutover_control
FOR EACH ROW EXECUTE FUNCTION public.enforce_vndb_v11_cutover_control_transition();

DROP TRIGGER IF EXISTS vndb_v11_cutover_control_row_protect
	ON public.vndb_v11_cutover_control;
CREATE TRIGGER vndb_v11_cutover_control_row_protect
BEFORE INSERT OR DELETE ON public.vndb_v11_cutover_control
FOR EACH ROW EXECUTE FUNCTION public.protect_vndb_v11_cutover_control();

DROP TRIGGER IF EXISTS vndb_v11_cutover_control_truncate_protect
	ON public.vndb_v11_cutover_control;
CREATE TRIGGER vndb_v11_cutover_control_truncate_protect
BEFORE TRUNCATE ON public.vndb_v11_cutover_control
FOR EACH STATEMENT EXECUTE FUNCTION public.protect_vndb_v11_cutover_control();

-- The prepare migration installs the same fence on the 11 legacy relation
-- identities. Fresh installs need the final identities guarded explicitly.
DROP TRIGGER IF EXISTS vndb_v11_cutover_write_fence ON public.unit_tag;
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.unit_tag
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();

DROP TRIGGER IF EXISTS vndb_v11_cutover_write_fence ON public.realm_unit_tag;
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.realm_unit_tag
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();

DROP TRIGGER IF EXISTS vndb_v11_cutover_write_fence ON public.profile_unit_tag;
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.profile_unit_tag
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();

DROP TRIGGER IF EXISTS vndb_v11_cutover_write_fence ON public.unit_tag_judgment;
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.unit_tag_judgment
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();

DROP TRIGGER IF EXISTS vndb_v11_cutover_write_fence ON public.unit_structure;
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.unit_structure
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();

DROP TRIGGER IF EXISTS vndb_v11_cutover_write_fence ON public.unit_structure_vote;
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.unit_structure_vote
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();

DROP TRIGGER IF EXISTS vndb_v11_cutover_write_fence
	ON public.unit_structure_application;
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE
ON public.unit_structure_application
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();

DROP TRIGGER IF EXISTS vndb_v11_cutover_write_fence
	ON public.unit_structure_application_judgment;
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE
ON public.unit_structure_application_judgment
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();

DROP TRIGGER IF EXISTS vndb_v11_cutover_write_fence ON public.realm_tag_context;
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.realm_tag_context
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();

DROP TRIGGER IF EXISTS vndb_v11_cutover_write_fence ON public.realm_tag_judgment;
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.realm_tag_judgment
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();

DROP TRIGGER IF EXISTS vndb_v11_cutover_write_fence ON public.unit_merge_operation;
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.unit_merge_operation
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();

DROP TRIGGER IF EXISTS vndb_v11_cutover_write_fence ON public.entity_measurement;
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.entity_measurement
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();

DROP TRIGGER IF EXISTS vndb_v11_cutover_write_fence
	ON public.subject_association_judgment;
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE
ON public.subject_association_judgment
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();

DROP TRIGGER IF EXISTS vndb_v11_cutover_write_fence
	ON public.unit_structure_correction;
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE
ON public.unit_structure_correction
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();

CREATE OR REPLACE VIEW public.current_unit_structure_member
WITH (security_barrier = true) AS
SELECT
	member.structure_id,
	member.projection_version,
	member.ordinal,
	member.member_unit_id
FROM public.unit_structure_member AS member
JOIN public.unit_structure AS structure
	ON structure.id = member.structure_id
	AND structure.active_projection_version = member.projection_version;

CREATE OR REPLACE VIEW public.current_unit_structure_edge
WITH (security_barrier = true) AS
SELECT
	edge.structure_id,
	edge.projection_version,
	edge.ordinal,
	edge.parent_unit_id,
	edge.child_unit_id
FROM public.unit_structure_edge AS edge
JOIN public.unit_structure AS structure
	ON structure.id = edge.structure_id
	AND structure.active_projection_version = edge.projection_version;

CREATE OR REPLACE VIEW public.current_unit_structure_end
WITH (security_barrier = true) AS
SELECT
	structure_end.structure_id,
	structure_end.projection_version,
	structure_end.final_tag_id
FROM public.unit_structure_end AS structure_end
JOIN public.unit_structure AS structure
	ON structure.id = structure_end.structure_id
	AND structure.active_projection_version = structure_end.projection_version;

CREATE OR REPLACE VIEW public.current_unit_structure_primary_path_candidate
WITH (security_barrier = true) AS
SELECT
	candidate.structure_id,
	candidate.projection_version,
	candidate.final_tag_id,
	candidate.accepted,
	candidate.wilson_lower_bound,
	candidate.score,
	candidate.vote_count,
	candidate.updated_at
FROM public.unit_structure_primary_path_candidate AS candidate
JOIN public.unit_structure AS structure
	ON structure.id = candidate.structure_id
	AND structure.active_projection_version = candidate.projection_version;

CREATE OR REPLACE VIEW public.current_unit_tag_structure_support
WITH (security_barrier = true) AS
SELECT
	support.unit_id,
	support.tag_id,
	support.profile_id,
	support.structure_id,
	support.projection_version,
	support.created_at
FROM public.unit_tag_structure_support AS support
JOIN public.unit_structure AS structure
	ON structure.id = support.structure_id
	AND structure.active_projection_version = support.projection_version;

CREATE OR REPLACE VIEW public.current_unit_effective_tag
WITH (security_barrier = true) AS
WITH active_overlay AS (
	SELECT correction.id
	FROM public.unit_structure_correction AS correction
	WHERE correction.write_route = 'overlay'
		AND correction.status IN ('active_overlay', 'compacting', 'route_switching')
)
SELECT
	effective_tag.unit_id,
	effective_tag.tag_id,
	effective_tag.direct,
	effective_tag.structure_support_count,
	effective_tag.created_at,
	effective_tag.updated_at
FROM public.unit_effective_tag AS effective_tag
WHERE NOT EXISTS (
	SELECT 1
	FROM public.unit_structure_correction_tag_projection AS projection
	JOIN active_overlay ON active_overlay.id = projection.job_id
	WHERE projection.unit_id = effective_tag.unit_id
		AND projection.tag_id = effective_tag.tag_id
)
UNION ALL
SELECT
	projection.unit_id,
	projection.tag_id,
	projection.target_direct,
	projection.target_structure_support_count,
	coalesce(effective_tag.created_at, projection.created_at),
	projection.updated_at
FROM public.unit_structure_correction_tag_projection AS projection
JOIN active_overlay ON active_overlay.id = projection.job_id
LEFT JOIN public.unit_effective_tag AS effective_tag
	ON effective_tag.unit_id = projection.unit_id
	AND effective_tag.tag_id = projection.tag_id
WHERE projection.target_present;

CREATE OR REPLACE VIEW public.current_unit_effective_tag_vote
WITH (security_barrier = true) AS
WITH active_overlay AS (
	SELECT correction.id
	FROM public.unit_structure_correction AS correction
	WHERE correction.write_route = 'overlay'
		AND correction.status IN ('active_overlay', 'compacting', 'route_switching')
)
SELECT
	effective_vote.unit_id,
	effective_vote.tag_id,
	effective_vote.profile_id,
	effective_vote.value,
	effective_vote.created_at,
	effective_vote.updated_at
FROM public.unit_effective_tag_vote AS effective_vote
WHERE NOT EXISTS (
	SELECT 1
	FROM public.unit_structure_correction_effective_vote AS projection
	JOIN active_overlay ON active_overlay.id = projection.job_id
	WHERE projection.unit_id = effective_vote.unit_id
		AND projection.tag_id = effective_vote.tag_id
		AND projection.profile_id = effective_vote.profile_id
)
UNION ALL
SELECT
	projection.unit_id,
	projection.tag_id,
	projection.profile_id,
	projection.target_value,
	coalesce(effective_vote.created_at, projection.created_at),
	projection.updated_at
FROM public.unit_structure_correction_effective_vote AS projection
JOIN active_overlay ON active_overlay.id = projection.job_id
LEFT JOIN public.unit_effective_tag_vote AS effective_vote
	ON effective_vote.unit_id = projection.unit_id
	AND effective_vote.tag_id = projection.tag_id
	AND effective_vote.profile_id = projection.profile_id
WHERE projection.target_value IS NOT NULL;

CREATE OR REPLACE VIEW public.current_unit_tag_judgment_stat
WITH (security_barrier = true) AS
WITH active_overlay AS (
	SELECT correction.id
	FROM public.unit_structure_correction AS correction
	WHERE correction.write_route = 'overlay'
		AND correction.status IN ('active_overlay', 'compacting', 'route_switching')
)
SELECT
	stat.unit_id,
	stat.tag_id,
	stat.score,
	stat.vote_count,
	stat.spoiler_vote_count,
	stat.spoiler_none_count,
	stat.spoiler_minor_count,
	stat.spoiler_major_count,
	stat.updated_at
FROM public.unit_tag_judgment_stat AS stat
WHERE NOT EXISTS (
	SELECT 1
	FROM public.unit_structure_correction_tag_projection AS projection
	JOIN active_overlay ON active_overlay.id = projection.job_id
	WHERE projection.unit_id = stat.unit_id
		AND projection.tag_id = stat.tag_id
)
UNION ALL
SELECT
	projection.unit_id,
	projection.tag_id,
	projection.target_score,
	projection.target_vote_count,
	projection.target_spoiler_vote_count,
	projection.target_spoiler_none_count,
	projection.target_spoiler_minor_count,
	projection.target_spoiler_major_count,
	projection.updated_at
FROM public.unit_structure_correction_tag_projection AS projection
JOIN active_overlay ON active_overlay.id = projection.job_id
WHERE projection.target_present;

CREATE OR REPLACE VIEW public.current_tag_primary_display_path
WITH (security_barrier = true) AS
WITH active_overlay AS (
	SELECT correction.id, correction.created_at
	FROM public.unit_structure_correction AS correction
	WHERE correction.write_route = 'overlay'
		AND correction.status IN ('active_overlay', 'compacting', 'route_switching')
)
SELECT
	primary_path.tag_id,
	primary_path.structure_id,
	primary_path.structure_projection_version,
	primary_path.created_at,
	primary_path.updated_at
FROM public.tag_primary_display_path AS primary_path
JOIN public.unit_structure AS selected_structure
	ON selected_structure.id = primary_path.structure_id
	AND selected_structure.active_projection_version =
		primary_path.structure_projection_version
WHERE NOT EXISTS (
	SELECT 1
	FROM public.unit_structure_correction_primary_path AS projection
	JOIN active_overlay ON active_overlay.id = projection.job_id
	WHERE projection.tag_id = primary_path.tag_id
)
UNION ALL
SELECT
	projection.tag_id,
	projection.target_structure_id,
	projection.target_projection_version,
	coalesce(primary_path.created_at, active_overlay.created_at),
	projection.updated_at
FROM public.unit_structure_correction_primary_path AS projection
JOIN active_overlay ON active_overlay.id = projection.job_id
JOIN public.unit_structure AS selected_structure
	ON selected_structure.id = projection.target_structure_id
	AND selected_structure.active_projection_version = projection.target_projection_version
LEFT JOIN public.tag_primary_display_path AS primary_path
	ON primary_path.tag_id = projection.tag_id
WHERE projection.target_structure_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.lock_unit_structure_definition_key(
	target_structure_id uuid
) RETURNS void
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF current_setting('transaction_isolation') <> 'read committed' THEN
		RAISE EXCEPTION 'VNDB primary-Path maintenance requires READ COMMITTED isolation'
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'vndb_v11_cutover_read_committed_required';
	END IF;
	IF NOT pg_try_advisory_xact_lock(hashtextextended(target_structure_id::text, 71005)) THEN
		RAISE EXCEPTION 'VNDB Structure-definition hot key is busy'
			USING
				ERRCODE = '55P03',
				CONSTRAINT = 'vndb_vote_hot_key_busy';
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_unit_structure_application_judgment_key(
	target_unit_id uuid,
	target_structure_id uuid
) RETURNS void
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF NOT pg_try_advisory_xact_lock(hashtextextended(
		target_unit_id::text || ':' || target_structure_id::text,
		71004
	)) THEN
		RAISE EXCEPTION 'VNDB Structure-application judgment hot key is busy'
			USING
				ERRCODE = '55P03',
				CONSTRAINT = 'vndb_vote_hot_key_busy';
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_realm_tag_judgment_keys(
	target_realm_ids uuid[],
	target_unit_ids uuid[],
	target_tag_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	hot_key record;
BEGIN
	IF cardinality(target_realm_ids) > 1024
		OR cardinality(target_unit_ids) > 1024
		OR cardinality(target_tag_ids) > 1024
	THEN
		RAISE EXCEPTION 'VNDB Realm judgment hot-key batches cannot exceed 1024 rows'
			USING
				ERRCODE = '54000',
				CONSTRAINT = 'vndb_vote_hot_key_batch_too_large';
	END IF;

	IF target_realm_ids IS NULL
		OR target_unit_ids IS NULL
		OR target_tag_ids IS NULL
		OR cardinality(target_realm_ids) <> cardinality(target_unit_ids)
		OR cardinality(target_realm_ids) <> cardinality(target_tag_ids)
		OR EXISTS (
			SELECT 1
			FROM unnest(target_realm_ids, target_unit_ids, target_tag_ids)
				AS candidate(realm_id, unit_id, tag_id)
			WHERE candidate.realm_id IS NULL
				OR candidate.unit_id IS NULL
				OR candidate.tag_id IS NULL
		)
	THEN
		RAISE EXCEPTION 'VNDB Realm judgment hot-key arrays must be aligned and non-null'
			USING ERRCODE = '22023';
	END IF;

	FOR hot_key IN
		SELECT DISTINCT candidate.realm_id, candidate.unit_id, candidate.tag_id
		FROM unnest(target_realm_ids, target_unit_ids, target_tag_ids)
			AS candidate(realm_id, unit_id, tag_id)
		ORDER BY candidate.realm_id, candidate.unit_id, candidate.tag_id
	LOOP
		IF NOT pg_try_advisory_xact_lock(hashtextextended(
			hot_key.realm_id::text || ':' || hot_key.unit_id::text || ':'
				|| hot_key.tag_id::text,
			71006
		)) THEN
			RAISE EXCEPTION 'VNDB Realm judgment hot key is busy'
				USING
					ERRCODE = '55P03',
					CONSTRAINT = 'vndb_vote_hot_key_busy';
		END IF;
	END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_realm_tag_judgment_key(
	target_realm_id uuid,
	target_unit_id uuid,
	target_tag_id uuid
) RETURNS void
LANGUAGE sql
VOLATILE
SET search_path TO 'pg_catalog', 'public'
AS $$
	SELECT public.lock_realm_tag_judgment_keys(
		ARRAY[target_realm_id],
		ARRAY[target_unit_id],
		ARRAY[target_tag_id]
	)
$$;

CREATE OR REPLACE FUNCTION public.lock_subject_association_judgment_key(
	target_association_id uuid
) RETURNS void
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF NOT pg_try_advisory_xact_lock(hashtextextended(target_association_id::text, 71009)) THEN
		RAISE EXCEPTION 'VNDB subject-association judgment hot key is busy'
			USING
				ERRCODE = '55P03',
				CONSTRAINT = 'vndb_vote_hot_key_busy';
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_vndb_vote_hot_keys(
	target_unit_ids uuid[],
	target_tag_ids uuid[],
	target_profile_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	hot_key record;
BEGIN
	IF cardinality(target_unit_ids) > 1024
		OR cardinality(target_tag_ids) > 1024
		OR cardinality(target_profile_ids) > 1024
	THEN
		RAISE EXCEPTION 'VNDB vote hot-key batches cannot exceed 1024 rows'
			USING
				ERRCODE = '54000',
				CONSTRAINT = 'vndb_vote_hot_key_batch_too_large';
	END IF;

	IF target_unit_ids IS NULL
		OR target_tag_ids IS NULL
		OR target_profile_ids IS NULL
		OR cardinality(target_unit_ids) <> cardinality(target_tag_ids)
		OR cardinality(target_unit_ids) <> cardinality(target_profile_ids)
		OR EXISTS (
			SELECT 1
			FROM unnest(target_unit_ids, target_tag_ids)
				AS candidate(unit_id, tag_id)
			WHERE candidate.unit_id IS NULL OR candidate.tag_id IS NULL
		)
	THEN
		RAISE EXCEPTION 'VNDB vote hot-key arrays must be aligned with non-null Unit and Tag IDs'
			USING ERRCODE = '22023';
	END IF;

	FOR hot_key IN
		SELECT DISTINCT candidate.unit_id, candidate.tag_id
		FROM unnest(target_unit_ids, target_tag_ids)
			AS candidate(unit_id, tag_id)
		ORDER BY candidate.unit_id, candidate.tag_id
	LOOP
		IF NOT pg_try_advisory_xact_lock(hashtextextended(
			hot_key.unit_id::text || ':' || hot_key.tag_id::text,
			71001
		)) THEN
			RAISE EXCEPTION 'VNDB aggregate vote hot key is busy'
				USING
					ERRCODE = '55P03',
					CONSTRAINT = 'vndb_vote_hot_key_busy';
		END IF;
	END LOOP;

	FOR hot_key IN
		SELECT DISTINCT candidate.unit_id, candidate.tag_id, candidate.profile_id
		FROM unnest(target_unit_ids, target_tag_ids, target_profile_ids)
			AS candidate(unit_id, tag_id, profile_id)
		WHERE candidate.profile_id IS NOT NULL
		ORDER BY candidate.unit_id, candidate.tag_id, candidate.profile_id
	LOOP
		IF NOT pg_try_advisory_xact_lock(hashtextextended(
			hot_key.unit_id::text || ':' || hot_key.tag_id::text
				|| ':' || hot_key.profile_id::text,
			71002
		)) THEN
			RAISE EXCEPTION 'VNDB per-Profile vote hot key is busy'
				USING
					ERRCODE = '55P03',
					CONSTRAINT = 'vndb_vote_hot_key_busy';
		END IF;
	END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_unit_effective_tag_key(
	target_unit_id uuid,
	target_tag_id uuid
) RETURNS void
LANGUAGE sql
VOLATILE
SET search_path TO 'pg_catalog', 'public'
AS $$
	SELECT public.lock_vndb_vote_hot_keys(
		ARRAY[target_unit_id],
		ARRAY[target_tag_id],
		ARRAY[NULL::uuid]
	)
$$;

CREATE OR REPLACE FUNCTION public.lock_unit_effective_tag_vote_key(
	target_unit_id uuid,
	target_tag_id uuid,
	target_profile_id uuid
) RETURNS void
LANGUAGE sql
VOLATILE
SET search_path TO 'pg_catalog', 'public'
AS $$
	SELECT public.lock_vndb_vote_hot_keys(
		ARRAY[target_unit_id],
		ARRAY[target_tag_id],
		ARRAY[target_profile_id]
	)
$$;

CREATE OR REPLACE FUNCTION public.prepare_vndb_vote_hot_keys() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	target_profile_ids uuid[];
	target_tag_ids uuid[];
	target_unit_ids uuid[];
BEGIN
	IF TG_OP = 'INSERT' THEN
		target_unit_ids := ARRAY[NEW.unit_id];
		target_tag_ids := ARRAY[NEW.tag_id];
		target_profile_ids := ARRAY[NEW.profile_id];
	ELSIF TG_OP = 'DELETE' THEN
		target_unit_ids := ARRAY[OLD.unit_id];
		target_tag_ids := ARRAY[OLD.tag_id];
		target_profile_ids := ARRAY[OLD.profile_id];
	ELSE
		target_unit_ids := ARRAY[OLD.unit_id, NEW.unit_id];
		target_tag_ids := ARRAY[OLD.tag_id, NEW.tag_id];
		target_profile_ids := ARRAY[OLD.profile_id, NEW.profile_id];
	END IF;
	PERFORM public.lock_vndb_vote_hot_keys(
		target_unit_ids,
		target_tag_ids,
		target_profile_ids
	);
	IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_unit_tag_hot_key() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		PERFORM public.lock_vndb_vote_hot_keys(
			ARRAY[NEW.unit_id], ARRAY[NEW.tag_id], ARRAY[NULL::uuid]
		);
		RETURN NEW;
	END IF;
	PERFORM public.lock_vndb_vote_hot_keys(
		ARRAY[OLD.unit_id], ARRAY[OLD.tag_id], ARRAY[NULL::uuid]
	);
	RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_structure_application_judgment_hot_keys()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	target_profile_ids uuid[];
	target_structure_ids uuid[];
	target_tag_ids uuid[];
	target_unit_ids uuid[];
BEGIN
	IF TG_OP = 'INSERT' THEN
		target_unit_ids := ARRAY[NEW.unit_id];
		target_structure_ids := ARRAY[NEW.structure_id];
		target_profile_ids := ARRAY[NEW.profile_id];
	ELSIF TG_OP = 'DELETE' THEN
		target_unit_ids := ARRAY[OLD.unit_id];
		target_structure_ids := ARRAY[OLD.structure_id];
		target_profile_ids := ARRAY[OLD.profile_id];
	ELSE
		target_unit_ids := ARRAY[OLD.unit_id, NEW.unit_id];
		target_structure_ids := ARRAY[OLD.structure_id, NEW.structure_id];
		target_profile_ids := ARRAY[OLD.profile_id, NEW.profile_id];
	END IF;

	PERFORM public.lock_unit_structure_definition_key(candidate.structure_id)
	FROM (
		SELECT DISTINCT value.structure_id
		FROM unnest(target_structure_ids) AS value(structure_id)
		ORDER BY value.structure_id
	) AS candidate;
	PERFORM public.lock_unit_structure_application_judgment_key(
		candidate.unit_id,
		candidate.structure_id
	)
	FROM (
		SELECT DISTINCT value.unit_id, value.structure_id
		FROM unnest(target_unit_ids, target_structure_ids) AS value(unit_id, structure_id)
		ORDER BY value.unit_id, value.structure_id
	) AS candidate;
	SELECT
		coalesce(array_agg(expanded.unit_id ORDER BY expanded.unit_id, expanded.tag_id, expanded.profile_id), ARRAY[]::uuid[]),
		coalesce(array_agg(expanded.tag_id ORDER BY expanded.unit_id, expanded.tag_id, expanded.profile_id), ARRAY[]::uuid[]),
		coalesce(array_agg(expanded.profile_id ORDER BY expanded.unit_id, expanded.tag_id, expanded.profile_id), ARRAY[]::uuid[])
	INTO target_unit_ids, target_tag_ids, target_profile_ids
	FROM (
		SELECT DISTINCT candidate.unit_id, member.member_unit_id AS tag_id, candidate.profile_id
		FROM unnest(target_unit_ids, target_structure_ids, target_profile_ids)
			AS candidate(unit_id, structure_id, profile_id)
		JOIN public.current_unit_structure_member AS member
			ON member.structure_id = candidate.structure_id
	) AS expanded;
	PERFORM public.lock_vndb_vote_hot_keys(
		target_unit_ids,
		target_tag_ids,
		target_profile_ids
	);
	IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_realm_tag_judgment_hot_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	target_realm_ids uuid[];
	target_tag_ids uuid[];
	target_unit_ids uuid[];
BEGIN
	IF TG_OP = 'INSERT' THEN
		target_realm_ids := ARRAY[NEW.realm_id];
		target_unit_ids := ARRAY[NEW.unit_id];
		target_tag_ids := ARRAY[NEW.tag_id];
	ELSIF TG_OP = 'DELETE' THEN
		target_realm_ids := ARRAY[OLD.realm_id];
		target_unit_ids := ARRAY[OLD.unit_id];
		target_tag_ids := ARRAY[OLD.tag_id];
	ELSE
		target_realm_ids := ARRAY[OLD.realm_id, NEW.realm_id];
		target_unit_ids := ARRAY[OLD.unit_id, NEW.unit_id];
		target_tag_ids := ARRAY[OLD.tag_id, NEW.tag_id];
	END IF;
	PERFORM public.lock_realm_tag_judgment_key(
		candidate.realm_id,
		candidate.unit_id,
		candidate.tag_id
	)
	FROM (
		SELECT DISTINCT value.realm_id, value.unit_id, value.tag_id
		FROM unnest(target_realm_ids, target_unit_ids, target_tag_ids)
			AS value(realm_id, unit_id, tag_id)
		ORDER BY value.realm_id, value.unit_id, value.tag_id
	) AS candidate;
	IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_tag_primary_display_path_key(
	target_tag_id uuid
) RETURNS void
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF current_setting('transaction_isolation') <> 'read committed' THEN
		RAISE EXCEPTION 'VNDB primary-Path maintenance requires READ COMMITTED isolation'
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'vndb_v11_cutover_read_committed_required';
	END IF;
	IF NOT pg_try_advisory_xact_lock(hashtextextended(target_tag_id::text, 71007)) THEN
		RAISE EXCEPTION 'VNDB primary-Path hot key is busy'
			USING
				ERRCODE = '55P03',
				CONSTRAINT = 'vndb_vote_hot_key_busy';
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_realm_tag_judgment_enabled() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	PERFORM 1
	FROM public.realm
	WHERE id = NEW.realm_id
		AND realm_tag_voting_enabled
	FOR SHARE;
	IF NOT FOUND THEN
		RAISE EXCEPTION 'Realm-scoped Tag judgment is not enabled for Realm %', NEW.realm_id
			USING
				ERRCODE = '23514',
				CONSTRAINT = 'realm_tag_judgment_realm_tag_voting_enabled';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_effective_tag_vote(
	target_unit_id uuid,
	target_tag_id uuid,
	target_profile_id uuid
) RETURNS TABLE(fit_score_delta bigint, fit_count_delta bigint)
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	direct_value integer;
	desired_effective_value integer;
	has_structure_support boolean;
	previous_delta_owner text;
	previous_effective_value integer;
BEGIN
	PERFORM public.lock_unit_effective_tag_key(target_unit_id, target_tag_id);
	PERFORM public.lock_unit_effective_tag_vote_key(
		target_unit_id,
		target_tag_id,
		target_profile_id
	);
	SELECT value
	INTO previous_effective_value
	FROM public.unit_effective_tag_vote
	WHERE unit_id = target_unit_id
		AND tag_id = target_tag_id
		AND profile_id = target_profile_id;
	SELECT fit_vote
	INTO direct_value
	FROM public.unit_tag_judgment
	WHERE unit_id = target_unit_id
		AND tag_id = target_tag_id
		AND profile_id = target_profile_id;
	SELECT EXISTS (
		SELECT 1
		FROM public.current_unit_tag_structure_support
		WHERE unit_id = target_unit_id
			AND tag_id = target_tag_id
			AND profile_id = target_profile_id
	)
	INTO has_structure_support;

	desired_effective_value := CASE
		WHEN direct_value IS NOT NULL THEN direct_value
		WHEN has_structure_support THEN 1
		ELSE NULL
	END;
	fit_score_delta := coalesce(desired_effective_value, 0)
		- coalesce(previous_effective_value, 0);
	fit_count_delta := (desired_effective_value IS NOT NULL)::integer
		- (previous_effective_value IS NOT NULL)::integer;
	IF desired_effective_value IS NOT DISTINCT FROM previous_effective_value THEN
		RETURN NEXT;
		RETURN;
	END IF;

	previous_delta_owner := current_setting('rezics.vndb_vote_delta_owner', true);
	PERFORM set_config('rezics.vndb_vote_delta_owner', 'caller', true);
	IF desired_effective_value IS NOT NULL THEN
		INSERT INTO public.unit_effective_tag_vote AS current_vote (
			unit_id,
			tag_id,
			profile_id,
			value
		)
		VALUES (
			target_unit_id,
			target_tag_id,
			target_profile_id,
			desired_effective_value
		)
		ON CONFLICT (unit_id, tag_id, profile_id) DO UPDATE SET
			value = excluded.value,
			updated_at = now()
		WHERE current_vote.value IS DISTINCT FROM excluded.value;
	ELSE
		DELETE FROM public.unit_effective_tag_vote
		WHERE unit_id = target_unit_id
			AND tag_id = target_tag_id
			AND profile_id = target_profile_id;
	END IF;
	PERFORM set_config('rezics.vndb_vote_delta_owner', coalesce(previous_delta_owner, ''), true);
	RETURN NEXT;
	RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_tag_judgment_stat(
	target_unit_id uuid,
	target_tag_id uuid
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	fit_score bigint;
	fit_count bigint;
	spoiler_count bigint;
	none_count bigint;
	minor_count bigint;
	major_count bigint;
BEGIN
	PERFORM public.lock_unit_effective_tag_key(target_unit_id, target_tag_id);
	SELECT coalesce(sum(value), 0)::bigint, count(*)::bigint
	INTO fit_score, fit_count
	FROM public.unit_effective_tag_vote
	WHERE unit_id = target_unit_id
		AND tag_id = target_tag_id;
	SELECT
		count(spoiler_level)::bigint,
		count(*) FILTER (WHERE spoiler_level = 0)::bigint,
		count(*) FILTER (WHERE spoiler_level = 1)::bigint,
		count(*) FILTER (WHERE spoiler_level = 2)::bigint
	INTO spoiler_count, none_count, minor_count, major_count
	FROM public.unit_tag_judgment
	WHERE unit_id = target_unit_id
		AND tag_id = target_tag_id;

	IF (fit_count > 0 OR spoiler_count > 0) AND EXISTS (
		SELECT 1
		FROM public.unit_effective_tag
		WHERE unit_id = target_unit_id
			AND tag_id = target_tag_id
	) THEN
		INSERT INTO public.unit_tag_judgment_stat (
			unit_id,
			tag_id,
			score,
			vote_count,
			spoiler_vote_count,
			spoiler_none_count,
			spoiler_minor_count,
			spoiler_major_count
		)
		VALUES (
			target_unit_id,
			target_tag_id,
			fit_score,
			fit_count,
			spoiler_count,
			none_count,
			minor_count,
			major_count
		)
		ON CONFLICT (unit_id, tag_id) DO UPDATE SET
			score = excluded.score,
			vote_count = excluded.vote_count,
			spoiler_vote_count = excluded.spoiler_vote_count,
			spoiler_none_count = excluded.spoiler_none_count,
			spoiler_minor_count = excluded.spoiler_minor_count,
			spoiler_major_count = excluded.spoiler_major_count,
			updated_at = now();
	ELSE
		DELETE FROM public.unit_tag_judgment_stat
		WHERE unit_id = target_unit_id
			AND tag_id = target_tag_id;
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_unit_tag_judgment_stat_delta(
	target_unit_id uuid,
	target_tag_id uuid,
	fit_score_delta bigint,
	fit_count_delta bigint,
	spoiler_count_delta bigint,
	none_count_delta bigint,
	minor_count_delta bigint,
	major_count_delta bigint,
	require_existing boolean
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF (fit_score_delta, fit_count_delta, spoiler_count_delta, none_count_delta,
		minor_count_delta, major_count_delta)
		IS NOT DISTINCT FROM (0::bigint, 0::bigint, 0::bigint, 0::bigint,
			0::bigint, 0::bigint)
	THEN RETURN;
	END IF;
	PERFORM public.lock_unit_effective_tag_key(target_unit_id, target_tag_id);

	IF require_existing THEN
		UPDATE public.unit_tag_judgment_stat
		SET
			score = score + fit_score_delta,
			vote_count = vote_count + fit_count_delta,
			spoiler_vote_count = spoiler_vote_count + spoiler_count_delta,
			spoiler_none_count = spoiler_none_count + none_count_delta,
			spoiler_minor_count = spoiler_minor_count + minor_count_delta,
			spoiler_major_count = spoiler_major_count + major_count_delta,
			updated_at = now()
		WHERE unit_id = target_unit_id
			AND tag_id = target_tag_id;
		IF NOT FOUND THEN
			IF EXISTS (
				SELECT 1
				FROM public.unit_effective_tag
				WHERE unit_id = target_unit_id
					AND tag_id = target_tag_id
			) THEN
				RAISE EXCEPTION 'missing unit_tag_judgment_stat row for delta: %, %',
					target_unit_id, target_tag_id
					USING
						ERRCODE = '23514',
						CONSTRAINT = 'unit_tag_judgment_stat_missing';
			END IF;
			RETURN;
		END IF;
	ELSE
		IF fit_count_delta < 0 OR spoiler_count_delta < 0
			OR none_count_delta < 0 OR minor_count_delta < 0 OR major_count_delta < 0
		THEN
			RAISE EXCEPTION 'initial Unit Tag judgment-stat deltas cannot decrement'
				USING ERRCODE = '22023';
		END IF;
		IF NOT EXISTS (
			SELECT 1
			FROM public.unit_effective_tag
			WHERE unit_id = target_unit_id
				AND tag_id = target_tag_id
		) THEN
			RAISE EXCEPTION 'missing unit_effective_tag row for judgment-stat delta: %, %',
				target_unit_id, target_tag_id
				USING
					ERRCODE = '23514',
					CONSTRAINT = 'unit_effective_tag_missing';
		END IF;
		INSERT INTO public.unit_tag_judgment_stat (
			unit_id,
			tag_id,
			score,
			vote_count,
			spoiler_vote_count,
			spoiler_none_count,
			spoiler_minor_count,
			spoiler_major_count
		)
		VALUES (
			target_unit_id,
			target_tag_id,
			fit_score_delta,
			fit_count_delta,
			spoiler_count_delta,
			none_count_delta,
			minor_count_delta,
			major_count_delta
		)
		ON CONFLICT (unit_id, tag_id) DO UPDATE SET
			score = public.unit_tag_judgment_stat.score + excluded.score,
			vote_count = public.unit_tag_judgment_stat.vote_count + excluded.vote_count,
			spoiler_vote_count = public.unit_tag_judgment_stat.spoiler_vote_count
				+ excluded.spoiler_vote_count,
			spoiler_none_count = public.unit_tag_judgment_stat.spoiler_none_count
				+ excluded.spoiler_none_count,
			spoiler_minor_count = public.unit_tag_judgment_stat.spoiler_minor_count
				+ excluded.spoiler_minor_count,
			spoiler_major_count = public.unit_tag_judgment_stat.spoiler_major_count
				+ excluded.spoiler_major_count,
			updated_at = now();
	END IF;

	DELETE FROM public.unit_tag_judgment_stat
	WHERE unit_id = target_unit_id
		AND tag_id = target_tag_id
		AND vote_count = 0
		AND spoiler_vote_count = 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_effective_tag_from_direct_judgment() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	fit_count_delta bigint := 0;
	fit_score_delta bigint := 0;
	major_count_delta bigint := 0;
	minor_count_delta bigint := 0;
	none_count_delta bigint := 0;
	spoiler_count_delta bigint := 0;
BEGIN
	IF TG_OP = 'INSERT' THEN
		IF NEW.fit_vote IS NOT NULL THEN
			SELECT delta.fit_score_delta, delta.fit_count_delta
			INTO fit_score_delta, fit_count_delta
			FROM public.refresh_unit_effective_tag_vote(
				NEW.unit_id,
				NEW.tag_id,
				NEW.profile_id
			) AS delta;
		END IF;
		spoiler_count_delta := (NEW.spoiler_level IS NOT NULL)::integer;
		none_count_delta := coalesce((NEW.spoiler_level = 0)::integer, 0);
		minor_count_delta := coalesce((NEW.spoiler_level = 1)::integer, 0);
		major_count_delta := coalesce((NEW.spoiler_level = 2)::integer, 0);
		PERFORM public.apply_unit_tag_judgment_stat_delta(
			NEW.unit_id, NEW.tag_id, fit_score_delta, fit_count_delta,
			spoiler_count_delta, none_count_delta, minor_count_delta,
			major_count_delta, false
		);
	ELSIF TG_OP = 'DELETE' THEN
		IF OLD.fit_vote IS NOT NULL THEN
			SELECT delta.fit_score_delta, delta.fit_count_delta
			INTO fit_score_delta, fit_count_delta
			FROM public.refresh_unit_effective_tag_vote(
				OLD.unit_id,
				OLD.tag_id,
				OLD.profile_id
			) AS delta;
		END IF;
		spoiler_count_delta := -(OLD.spoiler_level IS NOT NULL)::integer;
		none_count_delta := -coalesce((OLD.spoiler_level = 0)::integer, 0);
		minor_count_delta := -coalesce((OLD.spoiler_level = 1)::integer, 0);
		major_count_delta := -coalesce((OLD.spoiler_level = 2)::integer, 0);
		PERFORM public.apply_unit_tag_judgment_stat_delta(
			OLD.unit_id, OLD.tag_id, fit_score_delta, fit_count_delta,
			spoiler_count_delta, none_count_delta, minor_count_delta,
			major_count_delta, true
		);
	ELSE
		IF NEW.fit_vote IS DISTINCT FROM OLD.fit_vote THEN
			SELECT delta.fit_score_delta, delta.fit_count_delta
			INTO fit_score_delta, fit_count_delta
			FROM public.refresh_unit_effective_tag_vote(
				NEW.unit_id,
				NEW.tag_id,
				NEW.profile_id
			) AS delta;
		END IF;
		spoiler_count_delta := (NEW.spoiler_level IS NOT NULL)::integer
			- (OLD.spoiler_level IS NOT NULL)::integer;
		none_count_delta := coalesce((NEW.spoiler_level = 0)::integer, 0)
			- coalesce((OLD.spoiler_level = 0)::integer, 0);
		minor_count_delta := coalesce((NEW.spoiler_level = 1)::integer, 0)
			- coalesce((OLD.spoiler_level = 1)::integer, 0);
		major_count_delta := coalesce((NEW.spoiler_level = 2)::integer, 0)
			- coalesce((OLD.spoiler_level = 2)::integer, 0);
		PERFORM public.apply_unit_tag_judgment_stat_delta(
			NEW.unit_id, NEW.tag_id, fit_score_delta, fit_count_delta,
			spoiler_count_delta, none_count_delta, minor_count_delta,
			major_count_delta, true
		);
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_tag_judgment_stat() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF current_setting('rezics.vndb_vote_delta_owner', true) = 'caller' THEN
		RETURN NULL;
	END IF;
	IF TG_OP = 'UPDATE'
		AND (NEW.unit_id, NEW.tag_id, NEW.value)
			IS NOT DISTINCT FROM (OLD.unit_id, OLD.tag_id, OLD.value)
	THEN RETURN NULL;
	END IF;
	IF TG_OP = 'INSERT' THEN
		PERFORM public.apply_unit_tag_judgment_stat_delta(
			NEW.unit_id, NEW.tag_id, NEW.value, 1,
			0, 0, 0, 0, false
		);
	ELSIF TG_OP = 'DELETE' THEN
		PERFORM public.apply_unit_tag_judgment_stat_delta(
			OLD.unit_id, OLD.tag_id, -OLD.value, -1,
			0, 0, 0, 0, true
		);
	ELSIF (NEW.unit_id, NEW.tag_id)
		IS NOT DISTINCT FROM (OLD.unit_id, OLD.tag_id)
	THEN
		PERFORM public.apply_unit_tag_judgment_stat_delta(
			NEW.unit_id, NEW.tag_id, NEW.value - OLD.value, 0,
			0, 0, 0, 0, true
		);
	ELSE
		PERFORM public.apply_unit_tag_judgment_stat_delta(
			OLD.unit_id, OLD.tag_id, -OLD.value, -1,
			0, 0, 0, 0, true
		);
		PERFORM public.apply_unit_tag_judgment_stat_delta(
			NEW.unit_id, NEW.tag_id, NEW.value, 1,
			0, 0, 0, 0, false
		);
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_effective_tag_from_direct_context()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF TG_OP = 'INSERT' THEN
		INSERT INTO public.unit_effective_tag AS effective_tag (
			unit_id,
			tag_id,
			direct,
			structure_support_count
		)
		VALUES (NEW.unit_id, NEW.tag_id, true, 0)
		ON CONFLICT (unit_id, tag_id) DO UPDATE SET
			direct = true,
			updated_at = now()
		WHERE NOT effective_tag.direct;
		RETURN NULL;
	END IF;

	DELETE FROM public.unit_effective_tag
	WHERE unit_id = OLD.unit_id
		AND tag_id = OLD.tag_id
		AND direct
		AND structure_support_count = 0;
	IF NOT FOUND THEN
		UPDATE public.unit_effective_tag
		SET direct = false, updated_at = now()
		WHERE unit_id = OLD.unit_id
			AND tag_id = OLD.tag_id
			AND direct;
		IF NOT FOUND AND EXISTS (
			SELECT 1 FROM public.unit WHERE id = OLD.unit_id
		) AND EXISTS (
			SELECT 1 FROM public.tag WHERE id = OLD.tag_id
		) THEN
			RAISE EXCEPTION 'missing unit_effective_tag row for direct-source decrement: %, %',
				OLD.unit_id, OLD.tag_id
				USING
					ERRCODE = '23514',
					CONSTRAINT = 'unit_effective_tag_missing';
		END IF;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_effective_tag_from_structure_support()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	effective_tag_deleted boolean := false;
	fit_count_delta bigint := 0;
	fit_score_delta bigint := 0;
	new_is_active boolean := false;
	old_is_active boolean := false;
BEGIN
	IF TG_OP <> 'INSERT' THEN
		SELECT coalesce(
			(SELECT structure.active_projection_version = OLD.projection_version
			 FROM public.unit_structure AS structure
			 WHERE structure.id = OLD.structure_id),
			true
		)
		INTO old_is_active;
	END IF;
	IF TG_OP <> 'DELETE' THEN
		SELECT coalesce(
			(SELECT structure.active_projection_version = NEW.projection_version
			 FROM public.unit_structure AS structure
			 WHERE structure.id = NEW.structure_id),
			false
		)
		INTO new_is_active;
	END IF;
	IF TG_OP = 'UPDATE'
		AND (NEW.unit_id, NEW.tag_id, NEW.profile_id, NEW.structure_id,
			NEW.projection_version)
			IS NOT DISTINCT FROM
			(OLD.unit_id, OLD.tag_id, OLD.profile_id, OLD.structure_id,
				OLD.projection_version)
	THEN RETURN NULL;
	END IF;

	IF old_is_active THEN
		DELETE FROM public.unit_effective_tag
		WHERE unit_id = OLD.unit_id
			AND tag_id = OLD.tag_id
			AND NOT direct
			AND structure_support_count = 1;
		effective_tag_deleted := FOUND;
		IF NOT effective_tag_deleted THEN
			UPDATE public.unit_effective_tag
			SET
				structure_support_count = structure_support_count - 1,
				updated_at = now()
			WHERE unit_id = OLD.unit_id
				AND tag_id = OLD.tag_id
				AND structure_support_count > 0;
			IF NOT FOUND AND EXISTS (
				SELECT 1 FROM public.unit WHERE id = OLD.unit_id
			) AND EXISTS (
				SELECT 1 FROM public.tag WHERE id = OLD.tag_id
			) THEN
				RAISE EXCEPTION 'missing unit_effective_tag row for support decrement: %, %',
					OLD.unit_id, OLD.tag_id
					USING
						ERRCODE = '23514',
						CONSTRAINT = 'unit_effective_tag_missing';
			END IF;
		END IF;
		IF NOT effective_tag_deleted THEN
			SELECT delta.fit_score_delta, delta.fit_count_delta
			INTO fit_score_delta, fit_count_delta
			FROM public.refresh_unit_effective_tag_vote(
				OLD.unit_id,
				OLD.tag_id,
				OLD.profile_id
			) AS delta;
			PERFORM public.apply_unit_tag_judgment_stat_delta(
				OLD.unit_id, OLD.tag_id, fit_score_delta, fit_count_delta,
				0, 0, 0, 0, true
			);
		END IF;
	END IF;

	IF new_is_active THEN
		INSERT INTO public.unit_effective_tag AS effective_tag (
			unit_id,
			tag_id,
			direct,
			structure_support_count
		)
		VALUES (NEW.unit_id, NEW.tag_id, false, 1)
		ON CONFLICT (unit_id, tag_id) DO UPDATE SET
			structure_support_count = effective_tag.structure_support_count + 1,
			updated_at = now();
		SELECT delta.fit_score_delta, delta.fit_count_delta
		INTO fit_score_delta, fit_count_delta
		FROM public.refresh_unit_effective_tag_vote(
			NEW.unit_id,
			NEW.tag_id,
			NEW.profile_id
		) AS delta;
		PERFORM public.apply_unit_tag_judgment_stat_delta(
			NEW.unit_id, NEW.tag_id, fit_score_delta, fit_count_delta,
			0, 0, 0, 0, false
		);
	END IF;
	RETURN NULL;
END;
$$;

-- End effective judgment functions.

CREATE OR REPLACE FUNCTION public.maintain_structure_application_support() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF TG_OP <> 'INSERT'
		AND OLD.fit_vote = 1
		AND (
			TG_OP = 'DELETE'
			OR (NEW.unit_id, NEW.structure_id, NEW.profile_id, NEW.fit_vote)
				IS DISTINCT FROM
				(OLD.unit_id, OLD.structure_id, OLD.profile_id, OLD.fit_vote)
		)
	THEN
		DELETE FROM public.unit_tag_structure_support AS support
		USING public.unit_structure AS structure
		WHERE support.unit_id = OLD.unit_id
			AND support.structure_id = OLD.structure_id
			AND support.profile_id = OLD.profile_id
			AND structure.id = support.structure_id
			AND support.projection_version = structure.active_projection_version;
	END IF;
	IF TG_OP <> 'DELETE'
		AND NEW.fit_vote = 1
		AND (
			TG_OP = 'INSERT'
			OR (NEW.unit_id, NEW.structure_id, NEW.profile_id, NEW.fit_vote)
				IS DISTINCT FROM
				(OLD.unit_id, OLD.structure_id, OLD.profile_id, OLD.fit_vote)
		)
	THEN
		INSERT INTO public.unit_tag_structure_support (
			unit_id,
			tag_id,
			profile_id,
			structure_id,
			projection_version
		)
		SELECT
			NEW.unit_id,
			member.member_unit_id,
			NEW.profile_id,
			NEW.structure_id,
			member.projection_version
		FROM public.current_unit_structure_member AS member
		WHERE member.structure_id = NEW.structure_id
		ON CONFLICT DO NOTHING;
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_structure_application_judgment_stat(
	target_unit_id uuid,
	target_structure_id uuid
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	fit_score bigint;
	fit_count bigint;
	spoiler_count bigint;
	none_count bigint;
	minor_count bigint;
	major_count bigint;
BEGIN
	PERFORM pg_advisory_xact_lock(hashtextextended(
		target_unit_id::text || ':' || target_structure_id::text,
		71004
	));
	IF NOT EXISTS (
		SELECT 1
		FROM public.unit_structure_application
		WHERE unit_id = target_unit_id
			AND structure_id = target_structure_id
	) THEN
		DELETE FROM public.unit_structure_application_judgment_stat
		WHERE unit_id = target_unit_id
			AND structure_id = target_structure_id;
		RETURN;
	END IF;
	SELECT
		coalesce(sum(fit_vote), 0)::bigint,
		count(fit_vote)::bigint,
		count(spoiler_level)::bigint,
		count(*) FILTER (WHERE spoiler_level = 0)::bigint,
		count(*) FILTER (WHERE spoiler_level = 1)::bigint,
		count(*) FILTER (WHERE spoiler_level = 2)::bigint
	INTO
		fit_score,
		fit_count,
		spoiler_count,
		none_count,
		minor_count,
		major_count
	FROM public.unit_structure_application_judgment
	WHERE unit_id = target_unit_id
		AND structure_id = target_structure_id;

	IF fit_count > 0 OR spoiler_count > 0 THEN
		INSERT INTO public.unit_structure_application_judgment_stat (
			unit_id,
			structure_id,
			score,
			vote_count,
			spoiler_vote_count,
			spoiler_none_count,
			spoiler_minor_count,
			spoiler_major_count
		)
		VALUES (
			target_unit_id,
			target_structure_id,
			fit_score,
			fit_count,
			spoiler_count,
			none_count,
			minor_count,
			major_count
		)
		ON CONFLICT (unit_id, structure_id) DO UPDATE SET
			score = excluded.score,
			vote_count = excluded.vote_count,
			spoiler_vote_count = excluded.spoiler_vote_count,
			spoiler_none_count = excluded.spoiler_none_count,
			spoiler_minor_count = excluded.spoiler_minor_count,
			spoiler_major_count = excluded.spoiler_major_count,
			updated_at = now();
	ELSE
		DELETE FROM public.unit_structure_application_judgment_stat
		WHERE unit_id = target_unit_id
			AND structure_id = target_structure_id;
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_unit_structure_application_judgment_stat_delta(
	target_unit_id uuid,
	target_structure_id uuid,
	fit_score_delta bigint,
	fit_count_delta bigint,
	spoiler_count_delta bigint,
	none_count_delta bigint,
	minor_count_delta bigint,
	major_count_delta bigint,
	require_existing boolean
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	changed_rows bigint;
BEGIN
	IF (fit_score_delta, fit_count_delta, spoiler_count_delta, none_count_delta,
		minor_count_delta, major_count_delta)
		IS NOT DISTINCT FROM (0::bigint, 0::bigint, 0::bigint, 0::bigint,
			0::bigint, 0::bigint)
	THEN RETURN;
	END IF;
	PERFORM public.lock_unit_structure_application_judgment_key(
		target_unit_id,
		target_structure_id
	);

	MERGE INTO public.unit_structure_application_judgment_stat AS current_stat
	USING (
		SELECT
			target_unit_id AS unit_id,
			target_structure_id AS structure_id,
			fit_score_delta AS score_delta,
			fit_count_delta AS vote_count_delta,
			spoiler_count_delta AS spoiler_vote_count_delta,
			none_count_delta AS spoiler_none_count_delta,
			minor_count_delta AS spoiler_minor_count_delta,
			major_count_delta AS spoiler_major_count_delta
	) AS delta
	ON current_stat.unit_id = delta.unit_id
		AND current_stat.structure_id = delta.structure_id
	WHEN MATCHED AND current_stat.vote_count + delta.vote_count_delta = 0
		AND current_stat.spoiler_vote_count + delta.spoiler_vote_count_delta = 0
		THEN DELETE
	WHEN MATCHED THEN UPDATE SET
		score = current_stat.score + delta.score_delta,
		vote_count = current_stat.vote_count + delta.vote_count_delta,
		spoiler_vote_count = current_stat.spoiler_vote_count
			+ delta.spoiler_vote_count_delta,
		spoiler_none_count = current_stat.spoiler_none_count
			+ delta.spoiler_none_count_delta,
		spoiler_minor_count = current_stat.spoiler_minor_count
			+ delta.spoiler_minor_count_delta,
		spoiler_major_count = current_stat.spoiler_major_count
			+ delta.spoiler_major_count_delta,
		updated_at = now()
	WHEN NOT MATCHED AND (
		delta.vote_count_delta > 0 OR delta.spoiler_vote_count_delta > 0
	) THEN INSERT (
		unit_id,
		structure_id,
		score,
		vote_count,
		spoiler_vote_count,
		spoiler_none_count,
		spoiler_minor_count,
		spoiler_major_count
	) VALUES (
		delta.unit_id,
		delta.structure_id,
		delta.score_delta,
		delta.vote_count_delta,
		delta.spoiler_vote_count_delta,
		delta.spoiler_none_count_delta,
		delta.spoiler_minor_count_delta,
		delta.spoiler_major_count_delta
	);
	GET DIAGNOSTICS changed_rows = ROW_COUNT;
	IF changed_rows = 0 AND require_existing AND EXISTS (
		SELECT 1
		FROM public.unit_structure_application
		WHERE unit_id = target_unit_id
			AND structure_id = target_structure_id
	) THEN
		RAISE EXCEPTION 'missing unit_structure_application_judgment_stat row for delta: %, %',
			target_unit_id, target_structure_id
			USING
				ERRCODE = '23514',
				CONSTRAINT = 'unit_structure_application_judgment_stat_missing';
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_unit_structure_application_judgment_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF TG_OP = 'UPDATE'
		AND (NEW.unit_id, NEW.structure_id, NEW.fit_vote, NEW.spoiler_level)
			IS NOT DISTINCT FROM
			(OLD.unit_id, OLD.structure_id, OLD.fit_vote, OLD.spoiler_level)
	THEN RETURN NULL;
	END IF;
	IF TG_OP = 'INSERT' THEN
		PERFORM public.apply_unit_structure_application_judgment_stat_delta(
			NEW.unit_id, NEW.structure_id,
			coalesce(NEW.fit_vote, 0), (NEW.fit_vote IS NOT NULL)::integer,
			(NEW.spoiler_level IS NOT NULL)::integer,
			coalesce((NEW.spoiler_level = 0)::integer, 0),
			coalesce((NEW.spoiler_level = 1)::integer, 0),
			coalesce((NEW.spoiler_level = 2)::integer, 0),
			false
		);
	ELSIF TG_OP = 'DELETE' THEN
		PERFORM public.apply_unit_structure_application_judgment_stat_delta(
			OLD.unit_id, OLD.structure_id,
			-coalesce(OLD.fit_vote, 0), -(OLD.fit_vote IS NOT NULL)::integer,
			-(OLD.spoiler_level IS NOT NULL)::integer,
			-coalesce((OLD.spoiler_level = 0)::integer, 0),
			-coalesce((OLD.spoiler_level = 1)::integer, 0),
			-coalesce((OLD.spoiler_level = 2)::integer, 0),
			true
		);
	ELSIF (NEW.unit_id, NEW.structure_id)
		IS NOT DISTINCT FROM (OLD.unit_id, OLD.structure_id)
	THEN
		PERFORM public.apply_unit_structure_application_judgment_stat_delta(
			NEW.unit_id, NEW.structure_id,
			coalesce(NEW.fit_vote, 0) - coalesce(OLD.fit_vote, 0),
			(NEW.fit_vote IS NOT NULL)::integer - (OLD.fit_vote IS NOT NULL)::integer,
			(NEW.spoiler_level IS NOT NULL)::integer
				- (OLD.spoiler_level IS NOT NULL)::integer,
			coalesce((NEW.spoiler_level = 0)::integer, 0)
				- coalesce((OLD.spoiler_level = 0)::integer, 0),
			coalesce((NEW.spoiler_level = 1)::integer, 0)
				- coalesce((OLD.spoiler_level = 1)::integer, 0),
			coalesce((NEW.spoiler_level = 2)::integer, 0)
				- coalesce((OLD.spoiler_level = 2)::integer, 0),
			true
		);
	ELSE
		PERFORM public.apply_unit_structure_application_judgment_stat_delta(
			OLD.unit_id, OLD.structure_id,
			-coalesce(OLD.fit_vote, 0), -(OLD.fit_vote IS NOT NULL)::integer,
			-(OLD.spoiler_level IS NOT NULL)::integer,
			-coalesce((OLD.spoiler_level = 0)::integer, 0),
			-coalesce((OLD.spoiler_level = 1)::integer, 0),
			-coalesce((OLD.spoiler_level = 2)::integer, 0),
			true
		);
		PERFORM public.apply_unit_structure_application_judgment_stat_delta(
			NEW.unit_id, NEW.structure_id,
			coalesce(NEW.fit_vote, 0), (NEW.fit_vote IS NOT NULL)::integer,
			(NEW.spoiler_level IS NOT NULL)::integer,
			coalesce((NEW.spoiler_level = 0)::integer, 0),
			coalesce((NEW.spoiler_level = 1)::integer, 0),
			coalesce((NEW.spoiler_level = 2)::integer, 0),
			false
		);
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_realm_tag_judgment_stat_delta(
	target_realm_id uuid,
	target_unit_id uuid,
	target_tag_id uuid,
	fit_score_delta bigint,
	fit_count_delta bigint,
	spoiler_count_delta bigint,
	none_count_delta bigint,
	minor_count_delta bigint,
	major_count_delta bigint,
	require_existing boolean
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	changed_rows bigint;
BEGIN
	IF (fit_score_delta, fit_count_delta, spoiler_count_delta, none_count_delta,
		minor_count_delta, major_count_delta)
		IS NOT DISTINCT FROM (0::bigint, 0::bigint, 0::bigint, 0::bigint,
			0::bigint, 0::bigint)
	THEN RETURN;
	END IF;
	PERFORM public.lock_realm_tag_judgment_key(
		target_realm_id,
		target_unit_id,
		target_tag_id
	);

	MERGE INTO public.realm_tag_judgment_stat AS current_stat
	USING (
		SELECT
			target_realm_id AS realm_id,
			target_unit_id AS unit_id,
			target_tag_id AS tag_id,
			fit_score_delta AS score_delta,
			fit_count_delta AS vote_count_delta,
			spoiler_count_delta AS spoiler_vote_count_delta,
			none_count_delta AS spoiler_none_count_delta,
			minor_count_delta AS spoiler_minor_count_delta,
			major_count_delta AS spoiler_major_count_delta
	) AS delta
	ON current_stat.realm_id = delta.realm_id
		AND current_stat.unit_id = delta.unit_id
		AND current_stat.tag_id = delta.tag_id
	WHEN MATCHED AND current_stat.vote_count + delta.vote_count_delta = 0
		AND current_stat.spoiler_vote_count + delta.spoiler_vote_count_delta = 0
		THEN DELETE
	WHEN MATCHED THEN UPDATE SET
		score = current_stat.score + delta.score_delta,
		vote_count = current_stat.vote_count + delta.vote_count_delta,
		spoiler_vote_count = current_stat.spoiler_vote_count
			+ delta.spoiler_vote_count_delta,
		spoiler_none_count = current_stat.spoiler_none_count
			+ delta.spoiler_none_count_delta,
		spoiler_minor_count = current_stat.spoiler_minor_count
			+ delta.spoiler_minor_count_delta,
		spoiler_major_count = current_stat.spoiler_major_count
			+ delta.spoiler_major_count_delta,
		updated_at = now()
	WHEN NOT MATCHED AND (
		delta.vote_count_delta > 0 OR delta.spoiler_vote_count_delta > 0
	) THEN INSERT (
		realm_id,
		unit_id,
		tag_id,
		score,
		vote_count,
		spoiler_vote_count,
		spoiler_none_count,
		spoiler_minor_count,
		spoiler_major_count
	) VALUES (
		delta.realm_id,
		delta.unit_id,
		delta.tag_id,
		delta.score_delta,
		delta.vote_count_delta,
		delta.spoiler_vote_count_delta,
		delta.spoiler_none_count_delta,
		delta.spoiler_minor_count_delta,
		delta.spoiler_major_count_delta
	);
	GET DIAGNOSTICS changed_rows = ROW_COUNT;
	IF changed_rows = 0 AND require_existing AND EXISTS (
		SELECT 1
		FROM public.realm_tag_context
		WHERE realm_id = target_realm_id AND tag_id = target_tag_id
	) AND EXISTS (
		SELECT 1 FROM public.realm WHERE id = target_realm_id
	) AND EXISTS (
		SELECT 1 FROM public.unit WHERE id = target_unit_id
	) AND EXISTS (
		SELECT 1 FROM public.tag WHERE id = target_tag_id
	) THEN
		RAISE EXCEPTION 'missing realm_tag_judgment_stat row for delta: %, %, %',
			target_realm_id, target_unit_id, target_tag_id
			USING
				ERRCODE = '23514',
				CONSTRAINT = 'realm_tag_judgment_stat_missing';
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_subject_association_judgment_stat() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF TG_OP = 'UPDATE'
		AND (NEW.association_id, NEW.spoiler_level)
			IS NOT DISTINCT FROM (OLD.association_id, OLD.spoiler_level)
	THEN RETURN NULL;
	END IF;
	IF TG_OP = 'INSERT' THEN
		PERFORM public.apply_subject_association_judgment_stat_delta(
			NEW.association_id, 1,
			(NEW.spoiler_level = 0)::integer,
			(NEW.spoiler_level = 1)::integer,
			(NEW.spoiler_level = 2)::integer,
			false
		);
	ELSIF TG_OP = 'DELETE' THEN
		PERFORM public.apply_subject_association_judgment_stat_delta(
			OLD.association_id, -1,
			-(OLD.spoiler_level = 0)::integer,
			-(OLD.spoiler_level = 1)::integer,
			-(OLD.spoiler_level = 2)::integer,
			true
		);
	ELSIF NEW.association_id IS NOT DISTINCT FROM OLD.association_id THEN
		PERFORM public.apply_subject_association_judgment_stat_delta(
			NEW.association_id, 0,
			(NEW.spoiler_level = 0)::integer - (OLD.spoiler_level = 0)::integer,
			(NEW.spoiler_level = 1)::integer - (OLD.spoiler_level = 1)::integer,
			(NEW.spoiler_level = 2)::integer - (OLD.spoiler_level = 2)::integer,
			true
		);
	ELSE
		PERFORM public.apply_subject_association_judgment_stat_delta(
			OLD.association_id, -1,
			-(OLD.spoiler_level = 0)::integer,
			-(OLD.spoiler_level = 1)::integer,
			-(OLD.spoiler_level = 2)::integer,
			true
		);
		PERFORM public.apply_subject_association_judgment_stat_delta(
			NEW.association_id, 1,
			(NEW.spoiler_level = 0)::integer,
			(NEW.spoiler_level = 1)::integer,
			(NEW.spoiler_level = 2)::integer,
			false
		);
	END IF;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_subject_association_judgment_stat_delta(
	target_association_id uuid,
	spoiler_count_delta bigint,
	none_count_delta bigint,
	minor_count_delta bigint,
	major_count_delta bigint,
	require_existing boolean
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	changed_rows bigint;
BEGIN
	IF (spoiler_count_delta, none_count_delta, minor_count_delta, major_count_delta)
		IS NOT DISTINCT FROM (0::bigint, 0::bigint, 0::bigint, 0::bigint)
	THEN RETURN;
	END IF;
	PERFORM public.lock_subject_association_judgment_key(target_association_id);
	MERGE INTO public.subject_association_judgment_stat AS current_stat
	USING (
		SELECT
			target_association_id AS association_id,
			spoiler_count_delta AS spoiler_vote_count_delta,
			none_count_delta AS spoiler_none_count_delta,
			minor_count_delta AS spoiler_minor_count_delta,
			major_count_delta AS spoiler_major_count_delta
	) AS delta
	ON current_stat.association_id = delta.association_id
	WHEN MATCHED AND current_stat.spoiler_vote_count
		+ delta.spoiler_vote_count_delta = 0 THEN DELETE
	WHEN MATCHED THEN UPDATE SET
		spoiler_vote_count = current_stat.spoiler_vote_count
			+ delta.spoiler_vote_count_delta,
		spoiler_none_count = current_stat.spoiler_none_count
			+ delta.spoiler_none_count_delta,
		spoiler_minor_count = current_stat.spoiler_minor_count
			+ delta.spoiler_minor_count_delta,
		spoiler_major_count = current_stat.spoiler_major_count
			+ delta.spoiler_major_count_delta,
		updated_at = now()
	WHEN NOT MATCHED AND delta.spoiler_vote_count_delta > 0 THEN INSERT (
		association_id,
		spoiler_vote_count,
		spoiler_none_count,
		spoiler_minor_count,
		spoiler_major_count
	) VALUES (
		delta.association_id,
		delta.spoiler_vote_count_delta,
		delta.spoiler_none_count_delta,
		delta.spoiler_minor_count_delta,
		delta.spoiler_major_count_delta
	);
	GET DIAGNOSTICS changed_rows = ROW_COUNT;
	IF changed_rows = 0 AND require_existing AND EXISTS (
		SELECT 1 FROM public.subject_association WHERE id = target_association_id
	) THEN
		RAISE EXCEPTION 'missing subject_association_judgment_stat row for delta: %',
			target_association_id
			USING
				ERRCODE = '23514',
				CONSTRAINT = 'subject_association_judgment_stat_missing';
	END IF;
END;
$$;

-- Replace the legacy subtract/add body above with one exact OLD/NEW delta write.
CREATE OR REPLACE FUNCTION public.maintain_realm_tag_judgment_stat() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF TG_OP = 'UPDATE' AND (
		NEW.realm_id, NEW.unit_id, NEW.tag_id, NEW.fit_vote, NEW.spoiler_level
	) IS NOT DISTINCT FROM (
		OLD.realm_id, OLD.unit_id, OLD.tag_id, OLD.fit_vote, OLD.spoiler_level
	) THEN RETURN NULL;
	END IF;
	IF TG_OP = 'INSERT' THEN
		PERFORM public.apply_realm_tag_judgment_stat_delta(
			NEW.realm_id, NEW.unit_id, NEW.tag_id,
			coalesce(NEW.fit_vote, 0), (NEW.fit_vote IS NOT NULL)::integer,
			(NEW.spoiler_level IS NOT NULL)::integer,
			coalesce((NEW.spoiler_level = 0)::integer, 0),
			coalesce((NEW.spoiler_level = 1)::integer, 0),
			coalesce((NEW.spoiler_level = 2)::integer, 0), false
		);
	ELSIF TG_OP = 'DELETE' THEN
		PERFORM public.apply_realm_tag_judgment_stat_delta(
			OLD.realm_id, OLD.unit_id, OLD.tag_id,
			-coalesce(OLD.fit_vote, 0), -(OLD.fit_vote IS NOT NULL)::integer,
			-(OLD.spoiler_level IS NOT NULL)::integer,
			-coalesce((OLD.spoiler_level = 0)::integer, 0),
			-coalesce((OLD.spoiler_level = 1)::integer, 0),
			-coalesce((OLD.spoiler_level = 2)::integer, 0), true
		);
	ELSIF (NEW.realm_id, NEW.unit_id, NEW.tag_id)
		IS NOT DISTINCT FROM (OLD.realm_id, OLD.unit_id, OLD.tag_id)
	THEN
		PERFORM public.apply_realm_tag_judgment_stat_delta(
			NEW.realm_id, NEW.unit_id, NEW.tag_id,
			coalesce(NEW.fit_vote, 0) - coalesce(OLD.fit_vote, 0),
			(NEW.fit_vote IS NOT NULL)::integer - (OLD.fit_vote IS NOT NULL)::integer,
			(NEW.spoiler_level IS NOT NULL)::integer
				- (OLD.spoiler_level IS NOT NULL)::integer,
			coalesce((NEW.spoiler_level = 0)::integer, 0)
				- coalesce((OLD.spoiler_level = 0)::integer, 0),
			coalesce((NEW.spoiler_level = 1)::integer, 0)
				- coalesce((OLD.spoiler_level = 1)::integer, 0),
			coalesce((NEW.spoiler_level = 2)::integer, 0)
				- coalesce((OLD.spoiler_level = 2)::integer, 0), true
		);
	ELSE
		PERFORM public.apply_realm_tag_judgment_stat_delta(
			OLD.realm_id, OLD.unit_id, OLD.tag_id,
			-coalesce(OLD.fit_vote, 0), -(OLD.fit_vote IS NOT NULL)::integer,
			-(OLD.spoiler_level IS NOT NULL)::integer,
			-coalesce((OLD.spoiler_level = 0)::integer, 0),
			-coalesce((OLD.spoiler_level = 1)::integer, 0),
			-coalesce((OLD.spoiler_level = 2)::integer, 0), true
		);
		PERFORM public.apply_realm_tag_judgment_stat_delta(
			NEW.realm_id, NEW.unit_id, NEW.tag_id,
			coalesce(NEW.fit_vote, 0), (NEW.fit_vote IS NOT NULL)::integer,
			(NEW.spoiler_level IS NOT NULL)::integer,
			coalesce((NEW.spoiler_level = 0)::integer, 0),
			coalesce((NEW.spoiler_level = 1)::integer, 0),
			coalesce((NEW.spoiler_level = 2)::integer, 0), false
		);
	END IF;
	RETURN NULL;
END;
$$;

-- End judgment aggregate functions.

CREATE OR REPLACE FUNCTION public.reject_conflicting_direct_tag_judgment() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	target_fit_vote integer;
	target_profile_id uuid;
	target_tag_id uuid;
	target_unit_id uuid;
BEGIN
	IF TG_OP = 'DELETE' THEN
		target_fit_vote := OLD.fit_vote;
		target_profile_id := OLD.profile_id;
		target_tag_id := OLD.tag_id;
		target_unit_id := OLD.unit_id;
	ELSE
		target_fit_vote := NEW.fit_vote;
		target_profile_id := NEW.profile_id;
		target_tag_id := NEW.tag_id;
		target_unit_id := NEW.unit_id;
	END IF;
	PERFORM public.lock_unit_effective_tag_key(target_unit_id, target_tag_id);
	PERFORM public.lock_unit_effective_tag_vote_key(
		target_unit_id,
		target_tag_id,
		target_profile_id
	);
	IF TG_OP <> 'DELETE' AND target_fit_vote = -1 AND EXISTS (
		SELECT 1
		FROM public.current_unit_tag_structure_support
		WHERE unit_id = target_unit_id
			AND tag_id = target_tag_id
			AND profile_id = target_profile_id
	) THEN
		RAISE EXCEPTION 'A negative direct Tag judgment conflicts with positive structure support'
			USING ERRCODE = '23514';
	END IF;
	IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_conflicting_structure_application_judgment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	target_fit_vote integer;
	target_profile_id uuid;
	target_structure_id uuid;
	target_unit_id uuid;
BEGIN
	IF TG_OP = 'DELETE' THEN
		target_fit_vote := OLD.fit_vote;
		target_profile_id := OLD.profile_id;
		target_structure_id := OLD.structure_id;
		target_unit_id := OLD.unit_id;
	ELSE
		target_fit_vote := NEW.fit_vote;
		target_profile_id := NEW.profile_id;
		target_structure_id := NEW.structure_id;
		target_unit_id := NEW.unit_id;
	END IF;
	PERFORM public.lock_unit_structure_definition_key(target_structure_id);
	PERFORM public.lock_unit_effective_tag_key(
		target_unit_id,
		member.member_unit_id
	)
	FROM public.current_unit_structure_member AS member
	WHERE member.structure_id = target_structure_id
	ORDER BY member.member_unit_id;
	PERFORM public.lock_unit_effective_tag_vote_key(
		target_unit_id,
		member.member_unit_id,
		target_profile_id
	)
	FROM public.current_unit_structure_member AS member
	WHERE member.structure_id = target_structure_id
	ORDER BY member.member_unit_id;
	IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

	IF EXISTS (
		SELECT 1
		FROM public.current_unit_structure_member
		WHERE structure_id = target_structure_id
			AND member_unit_id = target_unit_id
	) THEN
		RAISE EXCEPTION 'A Tag hierarchy path cannot be applied to one of its members'
			USING ERRCODE = '23514';
	END IF;
	IF target_fit_vote = 1 AND EXISTS (
		SELECT 1
		FROM public.current_unit_structure_member AS member
		JOIN public.unit_tag_judgment AS direct_judgment
			ON direct_judgment.unit_id = target_unit_id
			AND direct_judgment.tag_id = member.member_unit_id
			AND direct_judgment.profile_id = target_profile_id
			AND direct_judgment.fit_vote = -1
		WHERE member.structure_id = target_structure_id
	) THEN
		RAISE EXCEPTION 'Positive structure support conflicts with a negative direct Tag judgment'
			USING ERRCODE = '23514';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_unit_structure_definition() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	content_label_registry_ids constant uuid[] := ARRAY[
		'019b76da-a800-7370-8000-000000000001'::uuid,
		'019b76da-a800-7370-8000-000000000002'::uuid,
		'019b76da-a800-7370-8000-000000000003'::uuid,
		'019b76da-a800-7370-8000-000000000004'::uuid
	];
	invalid_member_count integer;
BEGIN
	IF cardinality(NEW.member_unit_ids) <> (
		SELECT count(DISTINCT member_id)
		FROM unnest(NEW.member_unit_ids) AS member_id
	) THEN
		RAISE EXCEPTION 'Unit structure members must be distinct'
			USING ERRCODE = '23514';
	END IF;
	IF NEW.kind = 'tag.hierarchy_path' THEN
		IF NEW.member_unit_ids && content_label_registry_ids THEN
			RAISE EXCEPTION 'Content-label registry Tags cannot be hierarchy path members'
				USING
					ERRCODE = '23514',
					CONSTRAINT = 'content_label_hierarchy_member_rejected';
		END IF;
		SELECT count(*)
		INTO invalid_member_count
		FROM unnest(NEW.member_unit_ids) AS member_id
		LEFT JOIN public.tag ON tag.id = member_id
		LEFT JOIN public.unit ON unit.id = member_id
		WHERE tag.id IS NULL
			OR unit.kind <> 'tag'
			OR unit.status <> 'published'
			OR unit.visibility <> 'public'
			OR unit.moderation_status <> 'approved'
			OR unit.deleted_at IS NOT NULL;
		IF invalid_member_count <> 0 THEN
			RAISE EXCEPTION 'Tag hierarchy paths require active public Tag members'
				USING ERRCODE = '23514';
		END IF;
	ELSE
		RAISE EXCEPTION 'Unsupported Unit structure kind: %', NEW.kind
			USING ERRCODE = '23514';
	END IF;
	IF TG_OP = 'UPDATE' THEN
		PERFORM pg_advisory_xact_lock(hashtextextended(NEW.id::text, 71003));
		PERFORM public.lock_unit_structure_definition_key(NEW.id);
		IF EXISTS (
			SELECT 1
			FROM public.unit_structure_application
			WHERE structure_id = NEW.id
				AND unit_id = ANY(NEW.member_unit_ids)
		) THEN
			RAISE EXCEPTION 'A Tag hierarchy path cannot contain an existing application target'
				USING ERRCODE = '23514';
		END IF;
		IF EXISTS (
			SELECT 1
			FROM public.unit_structure_application_judgment AS application_judgment
			CROSS JOIN unnest(NEW.member_unit_ids) AS member_id
			JOIN public.unit_tag_judgment AS direct_judgment
				ON direct_judgment.unit_id = application_judgment.unit_id
				AND direct_judgment.tag_id = member_id
				AND direct_judgment.profile_id = application_judgment.profile_id
				AND direct_judgment.fit_vote = -1
			WHERE application_judgment.structure_id = NEW.id
				AND application_judgment.fit_vote = 1
		) THEN
			RAISE EXCEPTION 'Administrative Structure correction conflicts with a negative direct Tag judgment'
				USING ERRCODE = '23514';
		END IF;
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.project_unit_structure_definition() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	staged_member_unit_ids uuid[];
BEGIN
	IF TG_OP = 'UPDATE' THEN
		IF (NEW.member_unit_ids, NEW.active_projection_version)
			IS NOT DISTINCT FROM (OLD.member_unit_ids, OLD.active_projection_version)
		THEN RETURN NEW;
		END IF;
		SELECT array_agg(member.member_unit_id ORDER BY member.ordinal)
		INTO staged_member_unit_ids
		FROM public.unit_structure_member AS member
		WHERE member.structure_id = NEW.id
			AND member.projection_version = NEW.active_projection_version;
		IF staged_member_unit_ids IS DISTINCT FROM NEW.member_unit_ids
			OR NOT EXISTS (
				SELECT 1
				FROM public.unit_structure_end AS structure_end
				WHERE structure_end.structure_id = NEW.id
					AND structure_end.projection_version = NEW.active_projection_version
					AND structure_end.final_tag_id =
						NEW.member_unit_ids[cardinality(NEW.member_unit_ids)]
			)
			OR (
				SELECT count(*)
				FROM public.unit_structure_edge AS edge
				WHERE edge.structure_id = NEW.id
					AND edge.projection_version = NEW.active_projection_version
			) <> cardinality(NEW.member_unit_ids) - 1
		THEN
			RAISE EXCEPTION 'The target Structure projection is incomplete: %, %',
				NEW.id, NEW.active_projection_version
				USING
					ERRCODE = '55000',
					CONSTRAINT = 'unit_structure_projection_incomplete';
		END IF;
		RETURN NEW;
	END IF;
	INSERT INTO public.unit_structure_member (
		structure_id,
		projection_version,
		ordinal,
		member_unit_id
	)
	SELECT NEW.id, NEW.active_projection_version, member.ordinality - 1, member.id
	FROM unnest(NEW.member_unit_ids) WITH ORDINALITY AS member(id, ordinality);
	INSERT INTO public.unit_structure_edge (
		structure_id,
		projection_version,
		ordinal,
		parent_unit_id,
		child_unit_id
	)
	SELECT
		NEW.id,
		NEW.active_projection_version,
		member.ordinality - 1,
		member.id,
		NEW.member_unit_ids[member.ordinality + 1]
	FROM unnest(NEW.member_unit_ids) WITH ORDINALITY AS member(id, ordinality)
	WHERE member.ordinality < cardinality(NEW.member_unit_ids);
	INSERT INTO public.unit_structure_end (structure_id, projection_version, final_tag_id)
	VALUES (
		NEW.id,
		NEW.active_projection_version,
		NEW.member_unit_ids[cardinality(NEW.member_unit_ids)]
	);
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_unit_structure_end_change() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	target_structure_id uuid;
	target_tag_ids uuid[];
	locked_tag_id uuid;
BEGIN
	IF TG_OP = 'INSERT' THEN
		target_structure_id := NEW.structure_id;
		target_tag_ids := ARRAY[NEW.final_tag_id];
	ELSIF TG_OP = 'DELETE' THEN
		target_structure_id := OLD.structure_id;
		target_tag_ids := ARRAY[OLD.final_tag_id];
	ELSE
		IF (NEW.structure_id, NEW.projection_version)
			IS DISTINCT FROM (OLD.structure_id, OLD.projection_version)
		THEN
			RAISE EXCEPTION 'Unit Structure end identity is immutable'
				USING
					ERRCODE = '55000',
					CONSTRAINT = 'unit_structure_end_identity_immutable';
		END IF;
		target_structure_id := NEW.structure_id;
		target_tag_ids := ARRAY[OLD.final_tag_id, NEW.final_tag_id];
	END IF;

	PERFORM public.lock_unit_structure_definition_key(target_structure_id);
	FOR locked_tag_id IN
		SELECT DISTINCT candidate.tag_id
		FROM unnest(target_tag_ids) AS candidate(tag_id)
		ORDER BY candidate.tag_id
	LOOP
		PERFORM public.lock_tag_primary_display_path_key(locked_tag_id);
	END LOOP;

	IF TG_OP = 'UPDATE'
		AND NEW.final_tag_id IS DISTINCT FROM OLD.final_tag_id
	THEN
		-- Remove the immediate composite-FK reference before moving its target key.
		DELETE FROM public.unit_structure_primary_path_candidate
		WHERE structure_id = OLD.structure_id
			AND projection_version = OLD.projection_version
			AND final_tag_id = OLD.final_tag_id;
		DELETE FROM public.tag_primary_display_path
		WHERE structure_id = OLD.structure_id
			AND structure_projection_version = OLD.projection_version
			AND tag_id = OLD.final_tag_id;
	END IF;

	IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_unit_structure_primary_path_candidate(
	target_structure_id uuid,
	target_projection_version integer
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	active_final_tag_id uuid;
	active_score bigint;
	active_vote_count bigint;
BEGIN
	PERFORM public.lock_unit_structure_definition_key(target_structure_id);
	SELECT
		structure_end.final_tag_id,
		coalesce(vote_stat.score, 0),
		coalesce(vote_stat.vote_count, 0)
	INTO active_final_tag_id, active_score, active_vote_count
	FROM public.unit_structure AS structure
	JOIN public.unit_structure_end AS structure_end
		ON structure_end.structure_id = structure.id
		AND structure_end.projection_version = structure.active_projection_version
	LEFT JOIN public.unit_structure_vote_stat AS vote_stat
		ON vote_stat.structure_id = structure.id
	WHERE structure.id = target_structure_id
		AND structure.active_projection_version = target_projection_version;

	IF NOT FOUND THEN
		DELETE FROM public.unit_structure_primary_path_candidate
		WHERE structure_id = target_structure_id
			AND projection_version = target_projection_version;
		RETURN;
	END IF;

	INSERT INTO public.unit_structure_primary_path_candidate AS current_candidate (
		structure_id,
		projection_version,
		final_tag_id,
		accepted,
		wilson_lower_bound,
		score,
		vote_count
	)
	VALUES (
		target_structure_id,
		target_projection_version,
		active_final_tag_id,
		active_score > 0 AND active_vote_count > 0,
		CASE
			WHEN active_vote_count = 0 THEN 0::double precision
			ELSE (
				(
					(
						(active_vote_count::numeric + active_score::numeric)
							/ (2 * active_vote_count::numeric)
					)
					+ (1.96 * 1.96) / (2 * active_vote_count::numeric)
					- 1.96 * sqrt(
						(
							(
								(
									(active_vote_count::numeric + active_score::numeric)
										/ (2 * active_vote_count::numeric)
								)
								* (
									1 - (
										(active_vote_count::numeric + active_score::numeric)
											/ (2 * active_vote_count::numeric)
									)
								)
								+ (1.96 * 1.96) / (4 * active_vote_count::numeric)
							)
							/ active_vote_count::numeric
						)
					)
				)
					/ (1 + (1.96 * 1.96) / active_vote_count::numeric)
				)::double precision
		END,
		active_score,
		active_vote_count
	)
	ON CONFLICT (structure_id, projection_version) DO UPDATE SET
		final_tag_id = excluded.final_tag_id,
		accepted = excluded.accepted,
		wilson_lower_bound = excluded.wilson_lower_bound,
		score = excluded.score,
		vote_count = excluded.vote_count,
		updated_at = now()
	WHERE (
		current_candidate.final_tag_id,
		current_candidate.accepted,
		current_candidate.wilson_lower_bound,
		current_candidate.score,
		current_candidate.vote_count
	) IS DISTINCT FROM (
		excluded.final_tag_id,
		excluded.accepted,
		excluded.wilson_lower_bound,
		excluded.score,
		excluded.vote_count
	);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_tag_primary_display_path(
	target_tag_id uuid
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	selected_structure_id uuid;
	selected_projection_version integer;
BEGIN
	PERFORM public.lock_tag_primary_display_path_key(target_tag_id);
	SELECT candidate.structure_id, candidate.projection_version
	INTO selected_structure_id, selected_projection_version
	FROM public.unit_structure_primary_path_candidate AS candidate
	JOIN public.unit_structure AS structure
		ON structure.id = candidate.structure_id
		AND structure.active_projection_version = candidate.projection_version
	WHERE candidate.final_tag_id = target_tag_id
		AND candidate.accepted
	ORDER BY
		candidate.wilson_lower_bound DESC,
		candidate.score DESC,
		candidate.vote_count DESC,
		candidate.structure_id,
		candidate.projection_version
	LIMIT 1;
	IF selected_structure_id IS NULL THEN
		DELETE FROM public.tag_primary_display_path
		WHERE tag_id = target_tag_id;
	ELSE
		INSERT INTO public.tag_primary_display_path (
			tag_id,
			structure_id,
			structure_projection_version
		)
		VALUES (target_tag_id, selected_structure_id, selected_projection_version)
		ON CONFLICT (tag_id) DO UPDATE SET
			structure_id = excluded.structure_id,
			structure_projection_version = excluded.structure_projection_version,
			updated_at = now()
		WHERE (
			tag_primary_display_path.structure_id,
			tag_primary_display_path.structure_projection_version
		) IS DISTINCT FROM (excluded.structure_id, excluded.structure_projection_version);
	END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_tag_primary_display_path_from_end() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	target_tag_ids uuid[];
	target_tag_id uuid;
BEGIN
	IF TG_OP = 'INSERT' THEN
		target_tag_ids := ARRAY[NEW.final_tag_id];
	ELSIF TG_OP = 'DELETE' THEN
		target_tag_ids := ARRAY[OLD.final_tag_id];
	ELSE
		target_tag_ids := ARRAY[OLD.final_tag_id, NEW.final_tag_id];
	END IF;
	PERFORM public.refresh_unit_structure_primary_path_candidate(
		CASE WHEN TG_OP = 'DELETE' THEN OLD.structure_id ELSE NEW.structure_id END,
		CASE WHEN TG_OP = 'DELETE' THEN OLD.projection_version ELSE NEW.projection_version END
	);

	FOR target_tag_id IN
		SELECT DISTINCT candidate.tag_id
		FROM unnest(target_tag_ids) AS candidate(tag_id)
		ORDER BY candidate.tag_id
	LOOP
		PERFORM public.refresh_tag_primary_display_path(target_tag_id);
	END LOOP;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_tag_primary_display_path_from_vote_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	target_structure_ids uuid[];
	target_structure_id uuid;
	target_projection_version integer;
	target_tag_ids uuid[];
	target_tag_id uuid;
BEGIN
	IF TG_OP = 'INSERT' THEN
		target_structure_ids := ARRAY[NEW.structure_id];
	ELSIF TG_OP = 'DELETE' THEN
		target_structure_ids := ARRAY[OLD.structure_id];
	ELSE
		target_structure_ids := ARRAY[OLD.structure_id, NEW.structure_id];
	END IF;

	FOR target_structure_id IN
		SELECT DISTINCT candidate.structure_id
		FROM unnest(target_structure_ids) AS candidate(structure_id)
		ORDER BY candidate.structure_id
	LOOP
		PERFORM public.lock_unit_structure_definition_key(target_structure_id);
	END LOOP;

	SELECT coalesce(
		array_agg(DISTINCT structure_end.final_tag_id ORDER BY structure_end.final_tag_id),
		ARRAY[]::uuid[]
	)
	INTO target_tag_ids
	FROM public.current_unit_structure_end AS structure_end
	WHERE structure_end.structure_id = ANY(target_structure_ids);

	FOR target_structure_id, target_projection_version IN
		SELECT structure.id, structure.active_projection_version
		FROM public.unit_structure AS structure
		WHERE structure.id = ANY(target_structure_ids)
		ORDER BY structure.id
	LOOP
		PERFORM public.refresh_unit_structure_primary_path_candidate(
			target_structure_id,
			target_projection_version
		);
	END LOOP;

	FOR target_tag_id IN
		SELECT candidate.tag_id
		FROM unnest(target_tag_ids) AS candidate(tag_id)
		ORDER BY candidate.tag_id
	LOOP
		PERFORM public.refresh_tag_primary_display_path(target_tag_id);
	END LOOP;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_tag_primary_display_path_from_structure()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	target_tag_ids uuid[];
	target_tag_id uuid;
BEGIN
	IF (NEW.member_unit_ids, NEW.active_projection_version)
		IS NOT DISTINCT FROM (OLD.member_unit_ids, OLD.active_projection_version)
	THEN RETURN NULL;
	END IF;

	PERFORM public.refresh_unit_structure_primary_path_candidate(
		OLD.id,
		OLD.active_projection_version
	);
	IF (NEW.id, NEW.active_projection_version)
		IS DISTINCT FROM (OLD.id, OLD.active_projection_version)
	THEN
		PERFORM public.refresh_unit_structure_primary_path_candidate(
			NEW.id,
			NEW.active_projection_version
		);
	END IF;

	target_tag_ids := ARRAY[
		OLD.member_unit_ids[cardinality(OLD.member_unit_ids)],
		NEW.member_unit_ids[cardinality(NEW.member_unit_ids)]
	];
	FOR target_tag_id IN
		SELECT DISTINCT candidate.tag_id
		FROM unnest(target_tag_ids) AS candidate(tag_id)
		ORDER BY candidate.tag_id
	LOOP
		PERFORM public.refresh_tag_primary_display_path(target_tag_id);
	END LOOP;
	RETURN NULL;
END;
$$;

-- End path projection functions.

CREATE OR REPLACE FUNCTION public.guard_entity_measurement() RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	affected_unit_ids uuid[];
	affected_unit_id uuid;
	active_operation_id text := nullif(
		current_setting('rezics.unit_merge_operation_id', true),
		''
	);
	active_lease_token text := nullif(
		current_setting('rezics.unit_merge_lease_token', true),
		''
	);
	authorized_source_unit_id uuid;
	authorized_target_unit_id uuid;
	authorized_phase public.unit_merge_operation_phase;
	merge_operation_authorized boolean := false;
	valid_merge_mutation boolean := false;
	adds_contextual_measurement boolean := false;
BEGIN
	IF current_setting('transaction_isolation') <> 'read committed' THEN
		RAISE EXCEPTION 'Entity measurement guards require READ COMMITTED isolation'
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'entity_measurement_read_committed_required';
	END IF;

	IF TG_OP = 'INSERT' THEN
		affected_unit_ids := ARRAY[NEW.entity_id, NEW.context_unit_id];
		adds_contextual_measurement := NEW.context_unit_id IS NOT NULL;
	ELSIF TG_OP = 'DELETE' THEN
		affected_unit_ids := ARRAY[OLD.entity_id, OLD.context_unit_id];
	ELSE
		affected_unit_ids := ARRAY[
			OLD.entity_id,
			OLD.context_unit_id,
			NEW.entity_id,
			NEW.context_unit_id
		];
		adds_contextual_measurement := NEW.context_unit_id IS NOT NULL
			AND (
				NEW.entity_id IS DISTINCT FROM OLD.entity_id
				OR OLD.context_unit_id IS NULL
			);
	END IF;

	-- Reject mismatched workers before waiting on endpoint locks while an
	-- UPDATE or DELETE trigger already holds the measurement tuple lock.
	IF EXISTS (
		SELECT 1
		FROM public.unit_merge_operation AS operation
		WHERE operation.state = 'processing'::public.unit_merge_operation_state
			AND operation.phase IN (
				'entity_measurement_preflight'::public.unit_merge_operation_phase,
				'entity_measurement_entities'::public.unit_merge_operation_phase,
				'entity_measurement_contexts'::public.unit_merge_operation_phase
			)
			AND (
				operation.source_unit_id = ANY(affected_unit_ids)
				OR operation.target_unit_id = ANY(affected_unit_ids)
			)
			AND (
				ROW(active_operation_id, active_lease_token)
					IS DISTINCT FROM ROW(operation.id::text, operation.lease_token::text)
				OR operation.lease_expires_at <= clock_timestamp()
			)
	) THEN
		RAISE EXCEPTION 'Entity measurements are frozen while their Unit merge is processing'
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'entity_measurement_merge_frozen';
	END IF;

	-- Lock an authenticated operation before endpoint locks. This matches the
	-- operation-row -> endpoint order used when a processing lease is published.
	SELECT
		operation.source_unit_id,
		operation.target_unit_id,
		operation.phase
	INTO
		authorized_source_unit_id,
		authorized_target_unit_id,
		authorized_phase
	FROM public.unit_merge_operation AS operation
	WHERE operation.state = 'processing'::public.unit_merge_operation_state
		AND operation.phase IN (
			'entity_measurement_preflight'::public.unit_merge_operation_phase,
			'entity_measurement_entities'::public.unit_merge_operation_phase,
			'entity_measurement_contexts'::public.unit_merge_operation_phase
		)
		AND (
			operation.source_unit_id = ANY(affected_unit_ids)
			OR operation.target_unit_id = ANY(affected_unit_ids)
		)
		AND ROW(active_operation_id, active_lease_token)
			IS NOT DISTINCT FROM ROW(operation.id::text, operation.lease_token::text)
		AND operation.lease_expires_at > clock_timestamp()
	LIMIT 1
	FOR SHARE;
	merge_operation_authorized := FOUND;

	IF merge_operation_authorized THEN
		IF TG_OP = 'UPDATE' THEN
			IF authorized_phase = 'entity_measurement_entities'
				AND OLD.entity_id = authorized_source_unit_id
				AND NEW.entity_id = authorized_target_unit_id
				AND NEW.context_unit_id IS NOT DISTINCT FROM OLD.context_unit_id
				AND (to_jsonb(NEW) - ARRAY['entity_id', 'updated_at']::text[])
					IS NOT DISTINCT FROM
					(to_jsonb(OLD) - ARRAY['entity_id', 'updated_at']::text[])
			THEN
				valid_merge_mutation := true;
			ELSIF authorized_phase = 'entity_measurement_contexts'
				AND OLD.context_unit_id = authorized_source_unit_id
				AND NEW.context_unit_id = authorized_target_unit_id
				AND NEW.entity_id = OLD.entity_id
				AND (to_jsonb(NEW) - ARRAY['context_unit_id', 'updated_at']::text[])
					IS NOT DISTINCT FROM
					(to_jsonb(OLD) - ARRAY['context_unit_id', 'updated_at']::text[])
			THEN
				valid_merge_mutation := true;
			END IF;
		ELSIF TG_OP = 'DELETE' THEN
			valid_merge_mutation :=
				(authorized_phase = 'entity_measurement_entities'
					AND OLD.entity_id = authorized_source_unit_id
					AND EXISTS (
						SELECT 1
						FROM public.entity_measurement AS target_measurement
						WHERE target_measurement.entity_id = authorized_target_unit_id
							AND target_measurement.context_unit_id IS NOT DISTINCT FROM OLD.context_unit_id
							AND (
								to_jsonb(target_measurement) - ARRAY['entity_id', 'context_unit_id', 'created_at', 'updated_at']::text[]
							) IS NOT DISTINCT FROM (
								to_jsonb(OLD) - ARRAY['entity_id', 'context_unit_id', 'created_at', 'updated_at']::text[]
							)
					))
				OR (authorized_phase = 'entity_measurement_contexts'
					AND OLD.context_unit_id = authorized_source_unit_id
					AND EXISTS (
						SELECT 1
						FROM public.entity_measurement AS target_measurement
						WHERE target_measurement.entity_id = OLD.entity_id
							AND target_measurement.context_unit_id = authorized_target_unit_id
							AND (
								to_jsonb(target_measurement) - ARRAY['entity_id', 'context_unit_id', 'created_at', 'updated_at']::text[]
							) IS NOT DISTINCT FROM (
								to_jsonb(OLD) - ARRAY['entity_id', 'context_unit_id', 'created_at', 'updated_at']::text[]
							)
					));
		END IF;
		IF NOT valid_merge_mutation THEN
			RAISE EXCEPTION 'The Unit merge lease does not authorize this Entity measurement mutation'
				USING
					ERRCODE = '55000',
					CONSTRAINT = 'entity_measurement_merge_mutation_invalid';
		END IF;
	END IF;

	-- Shared endpoint locks admit independent writes but conflict with the
	-- exclusive, identically-namespaced locks held by Unit merge workers.
	FOR affected_unit_id IN
		SELECT DISTINCT endpoint.unit_id
		FROM unnest(affected_unit_ids) AS endpoint(unit_id)
		WHERE endpoint.unit_id IS NOT NULL
		ORDER BY endpoint.unit_id
	LOOP
		PERFORM pg_advisory_xact_lock_shared(
			hashtextextended('unit-merge:' || affected_unit_id::text, 0)
		);
	END LOOP;

	-- A processing transition that raced the precheck cannot commit before
	-- these shared locks. Recheck committed blockers with a fresh snapshot.
	IF EXISTS (
		SELECT 1
		FROM public.unit_merge_operation AS operation
		WHERE operation.state = 'processing'::public.unit_merge_operation_state
			AND operation.phase IN (
				'entity_measurement_preflight'::public.unit_merge_operation_phase,
				'entity_measurement_entities'::public.unit_merge_operation_phase,
				'entity_measurement_contexts'::public.unit_merge_operation_phase
			)
			AND (
				operation.source_unit_id = ANY(affected_unit_ids)
				OR operation.target_unit_id = ANY(affected_unit_ids)
			)
			AND (
				ROW(active_operation_id, active_lease_token)
					IS DISTINCT FROM ROW(operation.id::text, operation.lease_token::text)
				OR operation.lease_expires_at <= clock_timestamp()
			)
	) THEN
		RAISE EXCEPTION 'Entity measurements are frozen while their Unit merge is processing'
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'entity_measurement_merge_frozen';
	END IF;

	IF TG_OP = 'UPDATE'
		AND (NEW.entity_id, NEW.context_unit_id)
			IS DISTINCT FROM (OLD.entity_id, OLD.context_unit_id)
		AND NOT merge_operation_authorized
	THEN
		RAISE EXCEPTION 'Entity measurement identity is immutable'
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'entity_measurement_identity_immutable';
	END IF;
	IF adds_contextual_measurement THEN
		PERFORM pg_advisory_xact_lock(hashtextextended(NEW.entity_id::text, 71006));
		-- BEFORE INSERT runs before ON CONFLICT selects its UPDATE path.
		IF NOT EXISTS (
			SELECT 1
			FROM public.entity_measurement AS measurement
			WHERE measurement.entity_id = NEW.entity_id
				AND measurement.context_unit_id = NEW.context_unit_id
		) AND EXISTS (
			SELECT 1
			FROM public.entity_measurement AS measurement
			WHERE measurement.entity_id = NEW.entity_id
				AND measurement.context_unit_id IS NOT NULL
			OFFSET 7
			LIMIT 1
		) THEN
			RAISE EXCEPTION 'An Entity may have at most eight contextual measurement sets'
				USING
					ERRCODE = '23514',
					CONSTRAINT = 'entity_measurement_context_limit';
		END IF;
	END IF;
	IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_entity_measurement_merge_freeze() RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	affected_unit_id uuid;
BEGIN
	IF current_setting('transaction_isolation') <> 'read committed' THEN
		RAISE EXCEPTION 'Entity measurement merge publication requires READ COMMITTED isolation'
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'entity_measurement_read_committed_required';
	END IF;
	FOR affected_unit_id IN
		SELECT DISTINCT endpoint.unit_id
		FROM new_operation AS operation
		CROSS JOIN LATERAL unnest(ARRAY[
			operation.source_unit_id,
			operation.target_unit_id
		]) AS endpoint(unit_id)
		WHERE operation.state = 'processing'::public.unit_merge_operation_state
			AND operation.phase IN (
				'entity_measurement_preflight'::public.unit_merge_operation_phase,
				'entity_measurement_entities'::public.unit_merge_operation_phase,
				'entity_measurement_contexts'::public.unit_merge_operation_phase
			)
		ORDER BY endpoint.unit_id
	LOOP
		PERFORM pg_advisory_xact_lock(
			hashtextextended('unit-merge:' || affected_unit_id::text, 0)
		);
	END LOOP;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_entity_measurement_merge_freeze_update() RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	affected_unit_id uuid;
BEGIN
	IF current_setting('transaction_isolation') <> 'read committed' THEN
		RAISE EXCEPTION 'Entity measurement merge publication requires READ COMMITTED isolation'
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'entity_measurement_read_committed_required';
	END IF;
	FOR affected_unit_id IN
		SELECT DISTINCT endpoint.unit_id
		FROM new_operation AS operation
		JOIN old_operation AS previous_operation
			ON previous_operation.id = operation.id
		CROSS JOIN LATERAL unnest(ARRAY[
			operation.source_unit_id,
			operation.target_unit_id
		]) AS endpoint(unit_id)
		WHERE operation.state = 'processing'::public.unit_merge_operation_state
			AND operation.phase IN (
				'entity_measurement_preflight'::public.unit_merge_operation_phase,
				'entity_measurement_entities'::public.unit_merge_operation_phase,
				'entity_measurement_contexts'::public.unit_merge_operation_phase
			)
			AND (
				previous_operation.state IS DISTINCT FROM
					'processing'::public.unit_merge_operation_state
				OR previous_operation.phase NOT IN (
					'entity_measurement_preflight'::public.unit_merge_operation_phase,
					'entity_measurement_entities'::public.unit_merge_operation_phase,
					'entity_measurement_contexts'::public.unit_merge_operation_phase
				)
				OR ROW(
					operation.source_unit_id,
					operation.target_unit_id,
					operation.phase,
					operation.lease_token,
					operation.lease_expires_at
				) IS DISTINCT FROM ROW(
					previous_operation.source_unit_id,
					previous_operation.target_unit_id,
					previous_operation.phase,
					previous_operation.lease_token,
					previous_operation.lease_expires_at
				)
			)
		ORDER BY endpoint.unit_id
	LOOP
		PERFORM pg_advisory_xact_lock(
			hashtextextended('unit-merge:' || affected_unit_id::text, 0)
		);
	END LOOP;
	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_tag_directly_applicable_transition() RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	registry_ids constant uuid[] := ARRAY[
		'019b76da-a800-7370-8000-000000000001'::uuid,
		'019b76da-a800-7370-8000-000000000002'::uuid,
		'019b76da-a800-7370-8000-000000000003'::uuid,
		'019b76da-a800-7370-8000-000000000004'::uuid
	];
BEGIN
	IF NOT OLD.directly_applicable
		OR NEW.directly_applicable
		OR NEW.id = ANY(registry_ids)
	THEN
		RETURN NEW;
	END IF;
	IF current_setting('transaction_isolation') <> 'read committed' THEN
		RAISE EXCEPTION 'Direct Tag applicability guards require READ COMMITTED isolation'
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'tag_directly_applicable_read_committed_required';
	END IF;
	-- The invoking UPDATE already holds the lock that conflicts with the
	-- application-side FOR SHARE before these indexed probes run.
	IF EXISTS (
		SELECT 1 FROM public.unit_tag WHERE tag_id = NEW.id
	) OR EXISTS (
		SELECT 1 FROM public.realm_unit_tag WHERE tag_id = NEW.id
	) OR EXISTS (
		SELECT 1 FROM public.profile_unit_tag WHERE tag_id = NEW.id
	) OR EXISTS (
		SELECT 1 FROM public.realm_tag_judgment WHERE tag_id = NEW.id
	) THEN
		RAISE EXCEPTION 'A directly applied Tag cannot become category-only'
			USING
				ERRCODE = '23514',
				CONSTRAINT = 'tag_directly_applicable_in_use';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_content_label_unit_merge() RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	registry_ids constant uuid[] := ARRAY[
		'019b76da-a800-7370-8000-000000000001'::uuid,
		'019b76da-a800-7370-8000-000000000002'::uuid,
		'019b76da-a800-7370-8000-000000000003'::uuid,
		'019b76da-a800-7370-8000-000000000004'::uuid
	];
BEGIN
	IF TG_OP = 'UPDATE' THEN
		IF ROW(NEW.source_unit_id, NEW.target_unit_id)
			IS NOT DISTINCT FROM ROW(OLD.source_unit_id, OLD.target_unit_id)
		THEN
			RETURN NEW;
		END IF;
	END IF;
	IF NEW.source_unit_id = ANY(registry_ids)
		OR NEW.target_unit_id = ANY(registry_ids)
	THEN
		RAISE EXCEPTION 'Fixed content-label registry Tags cannot participate in Unit merges'
			USING
				ERRCODE = '23514',
				CONSTRAINT = 'content_label_unit_merge_rejected';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_direct_tag_application_policy() RETURNS trigger
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	content_spoiler_ids constant uuid[] := ARRAY[
		'019b76da-a800-7370-8000-000000000001'::uuid,
		'019b76da-a800-7370-8000-000000000002'::uuid,
		'019b76da-a800-7370-8000-000000000003'::uuid
	];
	nsfw_id constant uuid := '019b76da-a800-7370-8000-000000000004'::uuid;
	registry_ids constant uuid[] := content_spoiler_ids || ARRAY[nsfw_id];
	is_directly_applicable boolean;
BEGIN
	IF current_setting('transaction_isolation') <> 'read committed' THEN
		RAISE EXCEPTION 'Direct Tag applicability guards require READ COMMITTED isolation'
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'tag_directly_applicable_read_committed_required';
	END IF;
	SELECT directly_applicable
	INTO is_directly_applicable
	FROM public.tag
	WHERE id = NEW.tag_id
	FOR SHARE;

	IF NOT NEW.tag_id = ANY(registry_ids) THEN
		IF is_directly_applicable = false THEN
			RAISE EXCEPTION 'Tag % cannot be applied directly', NEW.tag_id
				USING
					ERRCODE = '23514',
					CONSTRAINT = 'tag_directly_applicable';
		END IF;
		RETURN NEW;
	END IF;

	IF TG_TABLE_NAME = 'profile_unit_tag' THEN
		RAISE EXCEPTION 'Content labels cannot be private Profile Tags'
			USING
				ERRCODE = '23514',
				CONSTRAINT = 'content_label_private_rejected';
	END IF;
	IF TG_TABLE_NAME = 'unit_tag' THEN
		IF NEW.created_by_profile_id IS NULL THEN
			RAISE EXCEPTION 'Global content-label rows require creator attribution'
				USING
					ERRCODE = '23514',
					CONSTRAINT = 'content_label_creator_required';
		END IF;
		IF NOT NEW.pinned THEN
			RAISE EXCEPTION 'Global content-label rows must be pinned'
				USING
					ERRCODE = '23514',
					CONSTRAINT = 'content_label_pinned';
		END IF;
	END IF;
	IF NEW.tag_id = ANY(content_spoiler_ids) THEN
		IF NOT EXISTS (
			SELECT 1
			FROM public.post
			WHERE id = NEW.unit_id
		) THEN
			RAISE EXCEPTION 'Content-spoiler labels apply only to post-kind Units'
				USING
					ERRCODE = '23514',
					CONSTRAINT = 'content_spoiler_label_post_kind';
		END IF;
	ELSIF NOT EXISTS (
		SELECT 1
		FROM public.unit
		WHERE id = NEW.unit_id
			AND status = 'published'
			AND visibility = 'public'
			AND moderation_status = 'approved'
			AND deleted_at IS NULL
			AND kind NOT IN (
				'slug_namespace',
				'profile',
				'tag',
				'structure',
				'zone',
				'realm',
				'realm_rule'
			)
	) THEN
		RAISE EXCEPTION 'The NSFW display label applies only to active public content Units'
			USING
				ERRCODE = '23514',
				CONSTRAINT = 'nsfw_label_public_content';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_platform_content_label_unit_tag() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	registry_ids constant uuid[] := ARRAY[
		'019b76da-a800-7370-8000-000000000001'::uuid,
		'019b76da-a800-7370-8000-000000000002'::uuid,
		'019b76da-a800-7370-8000-000000000003'::uuid,
		'019b76da-a800-7370-8000-000000000004'::uuid
	];
	official_profile_ids constant uuid[] := ARRAY[
		'019b76da-a800-7200-8000-000000000001'::uuid,
		'019b76da-a800-7200-8000-000000000002'::uuid,
		'019b76da-a800-7200-8000-000000000003'::uuid
	];
	old_is_governed boolean := false;
	new_is_governed boolean := false;
	row_unit_id uuid;
	row_tag_id uuid;
	row_profile_id uuid;
	decision_id uuid;
	required_action text;
BEGIN
	IF TG_OP <> 'INSERT' THEN
		old_is_governed := coalesce(
			OLD.tag_id = ANY(registry_ids)
				AND OLD.created_by_profile_id = ANY(official_profile_ids),
			false
		);
	END IF;
	IF TG_OP <> 'DELETE' THEN
		new_is_governed := coalesce(
			NEW.tag_id = ANY(registry_ids)
				AND NEW.created_by_profile_id = ANY(official_profile_ids),
			false
		);
	END IF;
	IF TG_OP = 'UPDATE'
		AND (old_is_governed OR new_is_governed)
		AND (NEW.unit_id, NEW.tag_id, NEW.created_by_profile_id)
			IS DISTINCT FROM (OLD.unit_id, OLD.tag_id, OLD.created_by_profile_id)
	THEN
		RAISE EXCEPTION 'Platform content-label row identity is immutable'
			USING
				ERRCODE = '23514',
				CONSTRAINT = 'content_label_platform_identity';
	END IF;
	IF NOT old_is_governed AND NOT new_is_governed THEN
		IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
		RETURN NEW;
	END IF;

	IF TG_OP = 'DELETE' THEN
		row_unit_id := OLD.unit_id;
		row_tag_id := OLD.tag_id;
		row_profile_id := OLD.created_by_profile_id;
		required_action := 'content_label.remove';
	ELSE
		row_unit_id := NEW.unit_id;
		row_tag_id := NEW.tag_id;
		row_profile_id := NEW.created_by_profile_id;
		required_action := CASE TG_OP
			WHEN 'INSERT' THEN 'content_label.apply'
			ELSE 'content_label.replace'
		END;
	END IF;

	decision_id := nullif(
		current_setting('rezics.content_label_governance_decision_id', true),
		''
	)::uuid;
	IF decision_id IS NULL OR NOT EXISTS (
		SELECT 1
		FROM public.governance_decision
		WHERE id = decision_id
			AND action = required_action
			AND actor_profile_id = row_profile_id
			AND authority_kind = 'platform'
			AND target_unit_id = row_unit_id
			AND subject_kind = 'content_label'
			AND subject_id = row_tag_id
			AND finalized
	) THEN
		RAISE EXCEPTION 'Platform content-label mutation requires a matching finalized governance decision'
			USING
				ERRCODE = '23514',
				CONSTRAINT = CASE TG_OP
					WHEN 'INSERT' THEN 'content_label_platform_apply'
					WHEN 'DELETE' THEN 'content_label_platform_remove'
					ELSE 'content_label_platform_identity'
				END;
	END IF;
	IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_content_label_judgment() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF NEW.tag_id = ANY(ARRAY[
		'019b76da-a800-7370-8000-000000000001'::uuid,
		'019b76da-a800-7370-8000-000000000002'::uuid,
		'019b76da-a800-7370-8000-000000000003'::uuid,
		'019b76da-a800-7370-8000-000000000004'::uuid
	]) THEN
		RAISE EXCEPTION 'Content-label applicability and spoiler judgments are not permitted'
			USING
				ERRCODE = '23514',
				CONSTRAINT = 'content_label_judgment_rejected';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_unit_tag_judgment_identity() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF (NEW.unit_id, NEW.tag_id, NEW.profile_id)
		IS DISTINCT FROM (OLD.unit_id, OLD.tag_id, OLD.profile_id)
	THEN
		RAISE EXCEPTION 'Unit Tag judgment identity is immutable'
			USING ERRCODE = '55000';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_unit_structure_application_judgment_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF (NEW.unit_id, NEW.structure_id, NEW.profile_id)
		IS DISTINCT FROM (OLD.unit_id, OLD.structure_id, OLD.profile_id)
	THEN
		RAISE EXCEPTION 'Unit Structure application judgment identity is immutable'
			USING ERRCODE = '55000';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_realm_tag_judgment_identity() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF (NEW.realm_id, NEW.unit_id, NEW.tag_id, NEW.profile_id)
		IS DISTINCT FROM (OLD.realm_id, OLD.unit_id, OLD.tag_id, OLD.profile_id)
	THEN
		RAISE EXCEPTION 'Realm Tag judgment identity is immutable'
			USING ERRCODE = '55000';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_subject_association_judgment_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF (NEW.association_id, NEW.profile_id)
		IS DISTINCT FROM (OLD.association_id, OLD.profile_id)
	THEN
		RAISE EXCEPTION 'Subject association judgment identity is immutable'
			USING ERRCODE = '55000';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_vndb_projection() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF pg_trigger_depth() > 1
		OR current_setting('rezics.vndb_projection_refresh', true) = 'enabled'
	THEN
		IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
		RETURN NEW;
	END IF;
	RAISE EXCEPTION '% is a database-maintained projection', TG_TABLE_NAME
		USING ERRCODE = '55000';
END;
$$;

-- End vndb-v11 guard functions.

DROP TRIGGER IF EXISTS unit_effective_tag_vote_hot_key_lock
	ON public.unit_effective_tag_vote;
CREATE TRIGGER unit_effective_tag_vote_hot_key_lock
BEFORE INSERT OR DELETE OR UPDATE ON public.unit_effective_tag_vote
FOR EACH ROW EXECUTE FUNCTION public.prepare_vndb_vote_hot_keys();

DROP TRIGGER IF EXISTS unit_tag_structure_support_hot_key_lock
	ON public.unit_tag_structure_support;
CREATE TRIGGER unit_tag_structure_support_hot_key_lock
BEFORE INSERT OR DELETE OR UPDATE ON public.unit_tag_structure_support
FOR EACH ROW EXECUTE FUNCTION public.prepare_vndb_vote_hot_keys();

DROP TRIGGER IF EXISTS realm_tag_judgment_hot_key_lock
	ON public.realm_tag_judgment;
CREATE TRIGGER realm_tag_judgment_hot_key_lock
BEFORE INSERT OR DELETE OR UPDATE ON public.realm_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.prepare_realm_tag_judgment_hot_key();

DROP TRIGGER IF EXISTS realm_tag_judgment_realm_tag_voting_enabled
	ON public.realm_tag_judgment;
CREATE TRIGGER realm_tag_judgment_realm_tag_voting_enabled
BEFORE INSERT OR UPDATE ON public.realm_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.enforce_realm_tag_judgment_enabled();

DROP TRIGGER IF EXISTS realm_tag_judgment_identity_immutable
	ON public.realm_tag_judgment;
CREATE TRIGGER realm_tag_judgment_identity_immutable
BEFORE UPDATE OF realm_id, unit_id, tag_id, profile_id
ON public.realm_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.protect_realm_tag_judgment_identity();

DROP TRIGGER IF EXISTS realm_tag_judgment_stat_maintain
	ON public.realm_tag_judgment;
CREATE TRIGGER realm_tag_judgment_stat_maintain
AFTER INSERT OR DELETE OR UPDATE ON public.realm_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_realm_tag_judgment_stat();

DROP TRIGGER IF EXISTS unit_structure_application_judgment_hot_key_lock
	ON public.unit_structure_application_judgment;
CREATE TRIGGER unit_structure_application_judgment_hot_key_lock
BEFORE INSERT OR DELETE OR UPDATE ON public.unit_structure_application_judgment
FOR EACH ROW EXECUTE FUNCTION public.prepare_structure_application_judgment_hot_keys();

DROP TRIGGER IF EXISTS unit_structure_application_judgment_stat_maintain
	ON public.unit_structure_application_judgment;
CREATE TRIGGER unit_structure_application_judgment_stat_maintain
AFTER INSERT OR DELETE OR UPDATE ON public.unit_structure_application_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_structure_application_judgment_stat();

DROP TRIGGER IF EXISTS unit_structure_application_judgment_support_maintain
	ON public.unit_structure_application_judgment;
CREATE TRIGGER unit_structure_application_judgment_support_maintain
AFTER INSERT OR DELETE OR UPDATE
ON public.unit_structure_application_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_structure_application_support();

DROP TRIGGER IF EXISTS unit_structure_application_judgment_tag_conflict
	ON public.unit_structure_application_judgment;
CREATE TRIGGER unit_structure_application_judgment_tag_conflict
BEFORE INSERT OR DELETE OR UPDATE OF fit_vote
ON public.unit_structure_application_judgment
FOR EACH ROW EXECUTE FUNCTION public.reject_conflicting_structure_application_judgment();

DROP TRIGGER IF EXISTS unit_structure_application_judgment_identity_immutable
	ON public.unit_structure_application_judgment;
CREATE TRIGGER unit_structure_application_judgment_identity_immutable
BEFORE UPDATE OF unit_id, structure_id, profile_id
ON public.unit_structure_application_judgment
FOR EACH ROW EXECUTE FUNCTION public.protect_unit_structure_application_judgment_identity();

DROP TRIGGER IF EXISTS unit_tag_judgment_hot_key_lock
	ON public.unit_tag_judgment;
CREATE TRIGGER unit_tag_judgment_hot_key_lock
BEFORE INSERT OR DELETE OR UPDATE ON public.unit_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.prepare_vndb_vote_hot_keys();

DROP TRIGGER IF EXISTS unit_tag_judgment_effective_maintain
	ON public.unit_tag_judgment;
CREATE TRIGGER unit_tag_judgment_effective_maintain
AFTER INSERT OR DELETE OR UPDATE ON public.unit_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_effective_tag_from_direct_judgment();

DROP TRIGGER IF EXISTS unit_tag_judgment_structure_conflict
	ON public.unit_tag_judgment;
CREATE TRIGGER unit_tag_judgment_structure_conflict
BEFORE INSERT OR DELETE OR UPDATE OF fit_vote ON public.unit_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.reject_conflicting_direct_tag_judgment();

DROP TRIGGER IF EXISTS unit_tag_judgment_identity_immutable
	ON public.unit_tag_judgment;
CREATE TRIGGER unit_tag_judgment_identity_immutable
BEFORE UPDATE OF unit_id, tag_id, profile_id
ON public.unit_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.protect_unit_tag_judgment_identity();

DROP TRIGGER IF EXISTS unit_tag_judgment_stat_maintain
	ON public.unit_effective_tag_vote;
CREATE TRIGGER unit_tag_judgment_stat_maintain
AFTER INSERT OR DELETE OR UPDATE ON public.unit_effective_tag_vote
FOR EACH ROW EXECUTE FUNCTION public.maintain_unit_tag_judgment_stat();

DROP TRIGGER IF EXISTS unit_structure_definition_prepare
	ON public.unit_structure;
CREATE TRIGGER unit_structure_definition_prepare
BEFORE INSERT OR UPDATE ON public.unit_structure
FOR EACH ROW EXECUTE FUNCTION public.prepare_unit_structure_definition();

DROP TRIGGER IF EXISTS unit_structure_definition_project
	ON public.unit_structure;
CREATE TRIGGER unit_structure_definition_project
AFTER INSERT OR UPDATE ON public.unit_structure
FOR EACH ROW EXECUTE FUNCTION public.project_unit_structure_definition();

DROP TRIGGER IF EXISTS unit_structure_primary_display_maintain
	ON public.unit_structure;
CREATE TRIGGER unit_structure_primary_display_maintain
AFTER UPDATE OF member_unit_ids, active_projection_version ON public.unit_structure
FOR EACH ROW EXECUTE FUNCTION public.maintain_tag_primary_display_path_from_structure();

DROP TRIGGER IF EXISTS unit_structure_end_immutable
	ON public.unit_structure_end;
CREATE TRIGGER unit_structure_end_immutable
BEFORE INSERT OR DELETE OR UPDATE ON public.unit_structure_end
FOR EACH ROW EXECUTE FUNCTION public.protect_vndb_projection();

DROP TRIGGER IF EXISTS unit_structure_end_primary_display_prepare
	ON public.unit_structure_end;
CREATE TRIGGER unit_structure_end_primary_display_prepare
BEFORE INSERT OR DELETE OR UPDATE ON public.unit_structure_end
FOR EACH ROW EXECUTE FUNCTION public.prepare_unit_structure_end_change();

DROP TRIGGER IF EXISTS unit_structure_primary_path_candidate_immutable
	ON public.unit_structure_primary_path_candidate;
CREATE TRIGGER unit_structure_primary_path_candidate_immutable
BEFORE INSERT OR DELETE OR UPDATE ON public.unit_structure_primary_path_candidate
FOR EACH ROW EXECUTE FUNCTION public.protect_vndb_projection();

DROP TRIGGER IF EXISTS tag_primary_display_path_immutable
	ON public.tag_primary_display_path;
CREATE TRIGGER tag_primary_display_path_immutable
BEFORE INSERT OR DELETE OR UPDATE ON public.tag_primary_display_path
FOR EACH ROW EXECUTE FUNCTION public.protect_vndb_projection();

DROP TRIGGER IF EXISTS unit_structure_end_primary_display_maintain
	ON public.unit_structure_end;
CREATE TRIGGER unit_structure_end_primary_display_maintain
AFTER INSERT OR DELETE OR UPDATE ON public.unit_structure_end
FOR EACH ROW EXECUTE FUNCTION public.maintain_tag_primary_display_path_from_end();

DROP TRIGGER IF EXISTS unit_structure_vote_stat_primary_display_maintain
	ON public.unit_structure_vote_stat;
CREATE TRIGGER unit_structure_vote_stat_primary_display_maintain
AFTER INSERT OR DELETE OR UPDATE ON public.unit_structure_vote_stat
FOR EACH ROW EXECUTE FUNCTION public.maintain_tag_primary_display_path_from_vote_stat();

DROP TRIGGER IF EXISTS entity_measurement_guard
	ON public.entity_measurement;
CREATE TRIGGER entity_measurement_guard
BEFORE INSERT OR DELETE OR UPDATE ON public.entity_measurement
FOR EACH ROW EXECUTE FUNCTION public.guard_entity_measurement();

DROP TRIGGER IF EXISTS unit_merge_operation_entity_measurement_freeze_insert_prepare
	ON public.unit_merge_operation;
CREATE TRIGGER unit_merge_operation_entity_measurement_freeze_insert_prepare
AFTER INSERT ON public.unit_merge_operation
REFERENCING NEW TABLE AS new_operation
FOR EACH STATEMENT EXECUTE FUNCTION public.prepare_entity_measurement_merge_freeze();

DROP TRIGGER IF EXISTS unit_merge_operation_entity_measurement_freeze_update_prepare
	ON public.unit_merge_operation;
CREATE TRIGGER unit_merge_operation_entity_measurement_freeze_update_prepare
AFTER UPDATE ON public.unit_merge_operation
REFERENCING OLD TABLE AS old_operation NEW TABLE AS new_operation
FOR EACH STATEMENT EXECUTE FUNCTION public.prepare_entity_measurement_merge_freeze_update();

DROP TRIGGER IF EXISTS unit_merge_operation_content_label_guard
	ON public.unit_merge_operation;
CREATE TRIGGER unit_merge_operation_content_label_guard
BEFORE INSERT OR UPDATE OF source_unit_id, target_unit_id ON public.unit_merge_operation
FOR EACH ROW EXECUTE FUNCTION public.guard_content_label_unit_merge();

DROP TRIGGER IF EXISTS tag_directly_applicable_transition_guard
	ON public.tag;
CREATE TRIGGER tag_directly_applicable_transition_guard
BEFORE UPDATE OF directly_applicable ON public.tag
FOR EACH ROW EXECUTE FUNCTION public.guard_tag_directly_applicable_transition();

DROP TRIGGER IF EXISTS unit_tag_hot_key_lock
	ON public.unit_tag;
CREATE TRIGGER unit_tag_hot_key_lock
BEFORE INSERT OR DELETE ON public.unit_tag
FOR EACH ROW EXECUTE FUNCTION public.prepare_unit_tag_hot_key();

DROP TRIGGER IF EXISTS unit_tag_application_policy_guard
	ON public.unit_tag;
CREATE TRIGGER unit_tag_application_policy_guard
BEFORE INSERT OR UPDATE ON public.unit_tag
FOR EACH ROW EXECUTE FUNCTION public.guard_direct_tag_application_policy();

DROP TRIGGER IF EXISTS realm_unit_tag_application_policy_guard
	ON public.realm_unit_tag;
CREATE TRIGGER realm_unit_tag_application_policy_guard
BEFORE INSERT OR UPDATE ON public.realm_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.guard_direct_tag_application_policy();

DROP TRIGGER IF EXISTS profile_unit_tag_application_policy_guard
	ON public.profile_unit_tag;
CREATE TRIGGER profile_unit_tag_application_policy_guard
BEFORE INSERT OR UPDATE ON public.profile_unit_tag
FOR EACH ROW EXECUTE FUNCTION public.guard_direct_tag_application_policy();

DROP TRIGGER IF EXISTS realm_tag_judgment_application_policy_guard
	ON public.realm_tag_judgment;
CREATE TRIGGER realm_tag_judgment_application_policy_guard
BEFORE INSERT OR UPDATE ON public.realm_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.guard_direct_tag_application_policy();

DROP TRIGGER IF EXISTS unit_tag_platform_content_label_guard
	ON public.unit_tag;
CREATE TRIGGER unit_tag_platform_content_label_guard
BEFORE INSERT OR DELETE OR UPDATE ON public.unit_tag
FOR EACH ROW EXECUTE FUNCTION public.guard_platform_content_label_unit_tag();

DROP TRIGGER IF EXISTS unit_tag_judgment_content_label_reject
	ON public.unit_tag_judgment;
CREATE TRIGGER unit_tag_judgment_content_label_reject
BEFORE INSERT OR UPDATE ON public.unit_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.reject_content_label_judgment();

DROP TRIGGER IF EXISTS realm_tag_judgment_content_label_reject
	ON public.realm_tag_judgment;
CREATE TRIGGER realm_tag_judgment_content_label_reject
BEFORE INSERT OR UPDATE ON public.realm_tag_judgment
FOR EACH ROW EXECUTE FUNCTION public.reject_content_label_judgment();

DROP TRIGGER IF EXISTS subject_association_judgment_stat_maintain
	ON public.subject_association_judgment;
CREATE TRIGGER subject_association_judgment_stat_maintain
AFTER INSERT OR DELETE OR UPDATE ON public.subject_association_judgment
FOR EACH ROW EXECUTE FUNCTION public.maintain_subject_association_judgment_stat();

DROP TRIGGER IF EXISTS subject_association_judgment_identity_immutable
	ON public.subject_association_judgment;
CREATE TRIGGER subject_association_judgment_identity_immutable
BEFORE UPDATE OF association_id, profile_id
ON public.subject_association_judgment
FOR EACH ROW EXECUTE FUNCTION public.protect_subject_association_judgment_identity();
