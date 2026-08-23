-- Install an old-binary-compatible writer fence before the online index stage.
-- The runner changes the singleton state only after external admission is stopped.

CREATE TABLE public.vndb_v11_cutover_control (
	id smallint PRIMARY KEY DEFAULT 1,
	state text NOT NULL DEFAULT 'precontract_open',
	transition_epoch bigint NOT NULL DEFAULT 0,
	state_changed_at timestamp(3) with time zone NOT NULL DEFAULT now(),
	operator text,
	reason text,
	CONSTRAINT vndb_v11_cutover_control_singleton_check CHECK (id = 1),
	CONSTRAINT vndb_v11_cutover_control_state_check CHECK (
		state IN ('precontract_open', 'paused', 'postcontract_open')
	),
	CONSTRAINT vndb_v11_cutover_control_epoch_check CHECK (transition_epoch >= 0),
	CONSTRAINT vndb_v11_cutover_control_audit_check CHECK (
		(
			state = 'precontract_open'
			AND (
				(transition_epoch = 0 AND operator IS NULL AND reason IS NULL)
				OR (
					transition_epoch > 0
					AND operator IS NOT NULL AND btrim(operator) <> ''
					AND reason IS NOT NULL AND btrim(reason) <> ''
				)
			)
		)
		OR (
			state IN ('paused', 'postcontract_open')
			AND operator IS NOT NULL
			AND btrim(operator) <> ''
			AND reason IS NOT NULL
			AND btrim(reason) <> ''
		)
	)
);

INSERT INTO public.vndb_v11_cutover_control (id, state)
VALUES (1, 'precontract_open');

CREATE TABLE public.vndb_v11_cutover_transition (
	transition_epoch bigint PRIMARY KEY,
	previous_state text,
	state text NOT NULL,
	transitioned_at timestamp(3) with time zone NOT NULL,
	operator text,
	reason text,
	CONSTRAINT vndb_v11_cutover_transition_epoch_check CHECK (transition_epoch >= 0),
	CONSTRAINT vndb_v11_cutover_transition_state_check CHECK (
		state IN ('precontract_open', 'paused', 'postcontract_open')
		AND (previous_state IS NULL OR previous_state IN (
			'precontract_open', 'paused', 'postcontract_open'
		))
	),
	CONSTRAINT vndb_v11_cutover_transition_audit_check CHECK (
		(
			transition_epoch = 0
			AND previous_state IS NULL
			AND state = 'precontract_open'
			AND operator IS NULL
			AND reason IS NULL
		)
		OR (
			transition_epoch > 0
			AND previous_state IS NOT NULL
			AND operator IS NOT NULL AND btrim(operator) <> ''
			AND reason IS NOT NULL AND btrim(reason) <> ''
		)
	)
);

INSERT INTO public.vndb_v11_cutover_transition (
	transition_epoch, previous_state, state, transitioned_at, operator, reason
)
SELECT transition_epoch, NULL, state, state_changed_at, NULL, NULL
FROM public.vndb_v11_cutover_control
WHERE id = 1;

CREATE FUNCTION public.protect_vndb_v11_cutover_transition() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS '
BEGIN
	IF TG_OP = ''INSERT'' AND pg_catalog.pg_trigger_depth() > 1 THEN
		RETURN NEW;
	END IF;
	RAISE EXCEPTION ''VNDB v11 cutover transition history is append-only''
		USING
			ERRCODE = ''55000'',
			CONSTRAINT = ''vndb_v11_cutover_transition_immutable'';
END;
';

CREATE TRIGGER vndb_v11_cutover_transition_mutation_protect
BEFORE INSERT OR UPDATE OR DELETE ON public.vndb_v11_cutover_transition
FOR EACH ROW EXECUTE FUNCTION public.protect_vndb_v11_cutover_transition();
CREATE TRIGGER vndb_v11_cutover_transition_truncate_protect
BEFORE TRUNCATE ON public.vndb_v11_cutover_transition
FOR EACH STATEMENT EXECUTE FUNCTION public.protect_vndb_v11_cutover_transition();

CREATE FUNCTION public.enforce_vndb_v11_cutover_write_fence() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS '
DECLARE
	cutover_state text;
BEGIN
	IF current_setting(''transaction_isolation'') <> ''read committed'' THEN
		RAISE EXCEPTION ''VNDB v11 fenced writes require READ COMMITTED isolation''
			USING
				ERRCODE = ''55000'',
				CONSTRAINT = ''vndb_v11_cutover_read_committed_required'';
	END IF;
	PERFORM pg_catalog.pg_advisory_xact_lock_shared(71011001::bigint);
	SELECT state
	INTO cutover_state
	FROM public.vndb_v11_cutover_control
	WHERE id = 1;
	IF NOT FOUND THEN
		RAISE EXCEPTION ''VNDB v11 cutover control row is missing''
			USING
				ERRCODE = ''55000'',
				CONSTRAINT = ''vndb_v11_cutover_control_missing'';
	END IF;
	IF cutover_state = ''paused'' THEN
		RAISE EXCEPTION ''VNDB v11 writes are paused for contract cutover''
			USING
				ERRCODE = ''55000'',
				CONSTRAINT = ''vndb_v11_writers_paused'';
	END IF;
	IF cutover_state = ''postcontract_open'' AND coalesce(
		current_setting(''rezics.vndb_v11_binary_contract'', true)
			= ''vndb-v11-contract-v1'',
		false
	) = false THEN
		RAISE EXCEPTION ''The active binary does not identify the vndb-v11 contract''
			USING
				ERRCODE = ''55000'',
				CONSTRAINT = ''vndb_v11_binary_contract_required'';
	END IF;
	RETURN NULL;
END;
';

CREATE FUNCTION public.enforce_vndb_v11_cutover_control_transition() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS '
DECLARE
	legacy_contract boolean;
	final_contract boolean;
BEGIN
	IF NOT pg_catalog.pg_try_advisory_xact_lock(71011001::bigint) THEN
		RAISE EXCEPTION ''VNDB v11 cutover transition is busy''
			USING
				ERRCODE = ''55P03'',
				CONSTRAINT = ''vndb_v11_cutover_transition_busy'';
	END IF;
	legacy_contract :=
		pg_catalog.to_regclass(''public.unit_tag_vote'') IS NOT NULL
		AND pg_catalog.to_regclass(''public.unit_structure_application_vote'') IS NOT NULL
		AND pg_catalog.to_regclass(''public.realm_tag_vote'') IS NOT NULL
		AND pg_catalog.to_regclass(''public.unit_tag_judgment'') IS NULL
		AND pg_catalog.to_regclass(''public.unit_structure_application_judgment'') IS NULL
		AND pg_catalog.to_regclass(''public.realm_tag_judgment'') IS NULL;
	final_contract :=
		pg_catalog.to_regclass(''public.unit_tag_vote'') IS NULL
		AND pg_catalog.to_regclass(''public.unit_structure_application_vote'') IS NULL
		AND pg_catalog.to_regclass(''public.realm_tag_vote'') IS NULL
		AND pg_catalog.to_regclass(''public.unit_tag_judgment'') IS NOT NULL
		AND pg_catalog.to_regclass(''public.unit_structure_application_judgment'') IS NOT NULL
		AND pg_catalog.to_regclass(''public.realm_tag_judgment'') IS NOT NULL;
	IF NEW IS NOT DISTINCT FROM OLD THEN
		RETURN NEW;
	END IF;
	IF NEW.id IS DISTINCT FROM OLD.id THEN
		RAISE EXCEPTION ''VNDB v11 cutover-control identity is immutable''
			USING
				ERRCODE = ''55000'',
				CONSTRAINT = ''vndb_v11_cutover_control_immutable'';
	END IF;
	IF NOT (
		(
			legacy_contract
			AND (
				(OLD.state = ''precontract_open'' AND NEW.state = ''paused'')
				OR (OLD.state = ''paused'' AND NEW.state = ''precontract_open'')
			)
		)
		OR (
			final_contract
			AND (
				(OLD.state = ''paused'' AND NEW.state = ''postcontract_open'')
				OR (OLD.state = ''postcontract_open'' AND NEW.state = ''paused'')
				OR (OLD.state = ''precontract_open'' AND NEW.state = ''postcontract_open''
					AND NOT EXISTS (SELECT 1 FROM public.unit LIMIT 1))
			)
		)
	) THEN
		RAISE EXCEPTION ''Invalid VNDB v11 cutover transition: % -> %'', OLD.state, NEW.state
			USING
				ERRCODE = ''55000'',
				CONSTRAINT = ''vndb_v11_cutover_transition_invalid'';
	END IF;
	IF NEW.transition_epoch <> OLD.transition_epoch + 1 THEN
		RAISE EXCEPTION ''VNDB v11 cutover transition epoch must increase exactly once''
			USING
				ERRCODE = ''55000'',
				CONSTRAINT = ''vndb_v11_cutover_epoch_invalid'';
	END IF;
	IF NEW.state_changed_at < OLD.state_changed_at THEN
		RAISE EXCEPTION ''VNDB v11 cutover transition time cannot move backwards''
			USING
				ERRCODE = ''55000'',
				CONSTRAINT = ''vndb_v11_cutover_transition_time_invalid'';
	END IF;
	INSERT INTO public.vndb_v11_cutover_transition (
		transition_epoch, previous_state, state, transitioned_at, operator, reason
	) VALUES (
		NEW.transition_epoch, OLD.state, NEW.state, NEW.state_changed_at,
		NEW.operator, NEW.reason
	);
	RETURN NEW;
END;
';

CREATE FUNCTION public.protect_vndb_v11_cutover_control() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS '
BEGIN
	RAISE EXCEPTION ''VNDB v11 cutover-control cardinality is immutable''
		USING
			ERRCODE = ''55000'',
			CONSTRAINT = ''vndb_v11_cutover_control_immutable'';
END;
';

CREATE TRIGGER vndb_v11_cutover_control_transition
BEFORE UPDATE ON public.vndb_v11_cutover_control
FOR EACH ROW EXECUTE FUNCTION public.enforce_vndb_v11_cutover_control_transition();
CREATE TRIGGER vndb_v11_cutover_control_row_protect
BEFORE INSERT OR DELETE ON public.vndb_v11_cutover_control
FOR EACH ROW EXECUTE FUNCTION public.protect_vndb_v11_cutover_control();
CREATE TRIGGER vndb_v11_cutover_control_truncate_protect
BEFORE TRUNCATE ON public.vndb_v11_cutover_control
FOR EACH STATEMENT EXECUTE FUNCTION public.protect_vndb_v11_cutover_control();

-- Guarded legacy relation inventory (11): unit_tag, realm_unit_tag,
-- profile_unit_tag, unit_tag_vote, unit_structure, unit_structure_vote,
-- unit_structure_application, unit_structure_application_vote,
-- realm_tag_context, realm_tag_vote, unit_merge_operation.
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.unit_tag
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.realm_unit_tag
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.profile_unit_tag
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.unit_tag_vote
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.unit_structure
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.unit_structure_vote
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.unit_structure_application
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.unit_structure_application_vote
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.realm_tag_context
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.realm_tag_vote
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();
CREATE TRIGGER vndb_v11_cutover_write_fence
BEFORE INSERT OR DELETE OR UPDATE OR TRUNCATE ON public.unit_merge_operation
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_vndb_v11_cutover_write_fence();

-- Additive generation headers are constant-default, metadata-only changes on
-- supported PostgreSQL versions. Legacy binaries continue to read/write v1.
ALTER TABLE public.unit_structure
	ADD COLUMN active_projection_version integer DEFAULT 1 NOT NULL;
ALTER TABLE public.unit_structure
	ADD CONSTRAINT unit_structure_active_projection_version_check
	CHECK (active_projection_version > 0) NOT VALID;
ALTER TABLE public.unit_structure_member
	ADD COLUMN projection_version integer DEFAULT 1 NOT NULL;
ALTER TABLE public.unit_structure_member
	ADD CONSTRAINT unit_structure_member_projection_version_check
	CHECK (projection_version > 0) NOT VALID;
ALTER TABLE public.unit_structure_edge
	ADD COLUMN projection_version integer DEFAULT 1 NOT NULL;
ALTER TABLE public.unit_structure_edge
	ADD CONSTRAINT unit_structure_edge_projection_version_check
	CHECK (projection_version > 0) NOT VALID;
ALTER TABLE public.unit_tag_structure_support
	ADD COLUMN projection_version integer DEFAULT 1 NOT NULL;
ALTER TABLE public.unit_tag_structure_support
	ADD CONSTRAINT unit_tag_structure_support_projection_version_check
	CHECK (projection_version > 0) NOT VALID;

CREATE TABLE public.unit_structure_end (
	structure_id uuid NOT NULL,
	projection_version integer DEFAULT 1 NOT NULL,
	final_tag_id uuid NOT NULL,
	CONSTRAINT unit_structure_end_pkey PRIMARY KEY (structure_id, projection_version),
	CONSTRAINT unit_structure_end_structure_projection_tag_key
		UNIQUE (structure_id, projection_version, final_tag_id),
	CONSTRAINT unit_structure_end_structure_id_unit_structure_id_fkey
		FOREIGN KEY (structure_id) REFERENCES public.unit_structure(id) ON DELETE CASCADE,
	CONSTRAINT unit_structure_end_final_tag_id_tag_id_fkey
		FOREIGN KEY (final_tag_id) REFERENCES public.tag(id) ON DELETE RESTRICT,
	CONSTRAINT unit_structure_end_projection_version_check
		CHECK (projection_version > 0)
);
CREATE INDEX unit_structure_end_tag_idx
	ON public.unit_structure_end (final_tag_id, structure_id, projection_version);

CREATE TABLE public.unit_structure_primary_path_candidate (
	structure_id uuid NOT NULL,
	projection_version integer NOT NULL,
	final_tag_id uuid NOT NULL,
	accepted boolean DEFAULT false NOT NULL,
	wilson_lower_bound double precision DEFAULT 0 NOT NULL,
	score bigint DEFAULT 0 NOT NULL,
	vote_count bigint DEFAULT 0 NOT NULL,
	updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT unit_structure_primary_path_candidate_pkey
		PRIMARY KEY (structure_id, projection_version),
	CONSTRAINT unit_structure_primary_path_candidate_end_fkey
		FOREIGN KEY (structure_id, projection_version, final_tag_id)
		REFERENCES public.unit_structure_end
			(structure_id, projection_version, final_tag_id) ON DELETE CASCADE,
	CONSTRAINT unit_structure_primary_path_candidate_projection_version_check
		CHECK (projection_version > 0),
	CONSTRAINT unit_structure_primary_path_candidate_count_check CHECK (vote_count >= 0),
	CONSTRAINT unit_structure_primary_path_candidate_score_check
		CHECK (abs(score) <= vote_count),
	CONSTRAINT unit_structure_primary_path_candidate_parity_check
		CHECK ((vote_count + score) % 2 = 0),
	CONSTRAINT unit_structure_primary_path_candidate_acceptance_check
		CHECK (accepted = (score > 0 AND vote_count > 0)),
	CONSTRAINT unit_structure_primary_path_candidate_wilson_check
		CHECK (wilson_lower_bound BETWEEN 0 AND 1)
);
CREATE INDEX unit_structure_primary_path_candidate_rank_idx
	ON public.unit_structure_primary_path_candidate (
		final_tag_id,
		wilson_lower_bound DESC,
		score DESC,
		vote_count DESC,
		structure_id,
		projection_version
	) WHERE accepted;

CREATE TABLE public.tag_primary_display_path (
	tag_id uuid PRIMARY KEY,
	structure_id uuid NOT NULL,
	structure_projection_version integer NOT NULL,
	created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
	updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT tag_primary_display_path_tag_id_tag_id_fkey
		FOREIGN KEY (tag_id) REFERENCES public.tag(id) ON DELETE CASCADE,
	CONSTRAINT tag_primary_display_path_structure_end_fkey
		FOREIGN KEY (structure_id, structure_projection_version, tag_id)
		REFERENCES public.unit_structure_end
			(structure_id, projection_version, final_tag_id) ON DELETE CASCADE,
	CONSTRAINT tag_primary_display_path_projection_version_check
		CHECK (structure_projection_version > 0)
);
CREATE INDEX tag_primary_display_path_structure_idx
	ON public.tag_primary_display_path
		(structure_id, structure_projection_version, tag_id);

-- Online primary-Path backfill is keyset-driven while legacy writers remain
-- open. Point triggers keep projected rows current; this coalescing queue
-- records only keys that must be rechecked after an online scan passed them.
CREATE TABLE public.vndb_v11_primary_path_dirty_key (
	key_kind text NOT NULL,
	key_id uuid NOT NULL,
	revision bigint DEFAULT 1 NOT NULL,
	updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT vndb_v11_primary_path_dirty_key_pkey PRIMARY KEY (key_kind, key_id),
	CONSTRAINT vndb_v11_primary_path_dirty_key_kind_check
		CHECK (key_kind IN ('structure', 'tag')),
	CONSTRAINT vndb_v11_primary_path_dirty_key_revision_check CHECK (revision > 0)
);

CREATE OR REPLACE FUNCTION public.lock_unit_structure_definition_key(
	target_structure_id uuid
) RETURNS void
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'pg_catalog', 'public'
AS '
BEGIN
	IF current_setting(''transaction_isolation'') <> ''read committed'' THEN
		RAISE EXCEPTION ''VNDB primary-Path maintenance requires READ COMMITTED isolation''
			USING
				ERRCODE = ''55000'',
				CONSTRAINT = ''vndb_v11_cutover_read_committed_required'';
	END IF;
	IF NOT pg_try_advisory_xact_lock(hashtextextended(target_structure_id::text, 71005)) THEN
		RAISE EXCEPTION ''VNDB Structure-definition hot key is busy''
			USING
				ERRCODE = ''55P03'',
				CONSTRAINT = ''vndb_vote_hot_key_busy'';
	END IF;
END;
';

CREATE FUNCTION public.lock_tag_primary_display_path_key(
	target_tag_id uuid
) RETURNS void
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'pg_catalog', 'public'
AS '
BEGIN
	IF current_setting(''transaction_isolation'') <> ''read committed'' THEN
		RAISE EXCEPTION ''VNDB primary-Path maintenance requires READ COMMITTED isolation''
			USING
				ERRCODE = ''55000'',
				CONSTRAINT = ''vndb_v11_cutover_read_committed_required'';
	END IF;
	IF NOT pg_try_advisory_xact_lock(hashtextextended(target_tag_id::text, 71007)) THEN
		RAISE EXCEPTION ''VNDB primary-Path hot key is busy''
			USING
				ERRCODE = ''55P03'',
				CONSTRAINT = ''vndb_vote_hot_key_busy'';
	END IF;
END;
';

CREATE FUNCTION public.protect_vndb_projection() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS '
BEGIN
	IF pg_trigger_depth() > 1
		OR current_setting(''rezics.vndb_projection_refresh'', true) = ''enabled''
	THEN
		IF TG_OP = ''DELETE'' THEN RETURN OLD; END IF;
		RETURN NEW;
	END IF;
	RAISE EXCEPTION ''% is a database-maintained projection'', TG_TABLE_NAME
		USING ERRCODE = ''55000'';
END;
';

CREATE FUNCTION public.mark_vndb_v11_primary_path_dirty_key(
	target_key_kind text,
	target_key_id uuid
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS '
BEGIN
	IF current_setting(''rezics.vndb_v11_primary_path_recheck'', true) = ''enabled'' THEN
		RETURN;
	END IF;
	IF target_key_kind NOT IN (''structure'', ''tag'') THEN
		RAISE EXCEPTION ''Invalid VNDB v11 primary-Path dirty-key kind: %'', target_key_kind
			USING ERRCODE = ''22023'';
	END IF;
	INSERT INTO public.vndb_v11_primary_path_dirty_key AS dirty (
		key_kind,
		key_id
	)
	VALUES (target_key_kind, target_key_id)
	ON CONFLICT (key_kind, key_id) DO UPDATE SET
		revision = dirty.revision + 1,
		updated_at = now();
END;
';

CREATE FUNCTION public.prepare_unit_structure_end_change() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS '
DECLARE
	target_structure_id uuid;
	target_tag_ids uuid[];
	locked_tag_id uuid;
BEGIN
	IF TG_OP = ''INSERT'' THEN
		target_structure_id := NEW.structure_id;
		target_tag_ids := ARRAY[NEW.final_tag_id];
	ELSIF TG_OP = ''DELETE'' THEN
		target_structure_id := OLD.structure_id;
		target_tag_ids := ARRAY[OLD.final_tag_id];
	ELSE
		IF (NEW.structure_id, NEW.projection_version)
			IS DISTINCT FROM (OLD.structure_id, OLD.projection_version)
		THEN
			RAISE EXCEPTION ''Unit Structure end identity is immutable''
				USING
					ERRCODE = ''55000'',
					CONSTRAINT = ''unit_structure_end_identity_immutable'';
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

	IF TG_OP = ''UPDATE''
		AND NEW.final_tag_id IS DISTINCT FROM OLD.final_tag_id
	THEN
		DELETE FROM public.unit_structure_primary_path_candidate
		WHERE structure_id = OLD.structure_id
			AND projection_version = OLD.projection_version
			AND final_tag_id = OLD.final_tag_id;
		DELETE FROM public.tag_primary_display_path
		WHERE structure_id = OLD.structure_id
			AND structure_projection_version = OLD.projection_version
			AND tag_id = OLD.final_tag_id;
	END IF;

	IF TG_OP = ''DELETE'' THEN RETURN OLD; END IF;
	RETURN NEW;
END;
';

CREATE FUNCTION public.refresh_unit_structure_primary_path_candidate(
	target_structure_id uuid,
	target_projection_version integer
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS '
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
';

CREATE FUNCTION public.refresh_tag_primary_display_path(
	target_tag_id uuid
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS '
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
';

CREATE FUNCTION public.maintain_tag_primary_display_path_from_end() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS '
DECLARE
	target_tag_ids uuid[];
	target_tag_id uuid;
BEGIN
	IF TG_OP = ''INSERT'' THEN
		target_tag_ids := ARRAY[NEW.final_tag_id];
	ELSIF TG_OP = ''DELETE'' THEN
		target_tag_ids := ARRAY[OLD.final_tag_id];
	ELSE
		target_tag_ids := ARRAY[OLD.final_tag_id, NEW.final_tag_id];
	END IF;
	PERFORM public.refresh_unit_structure_primary_path_candidate(
		CASE WHEN TG_OP = ''DELETE'' THEN OLD.structure_id ELSE NEW.structure_id END,
		CASE WHEN TG_OP = ''DELETE'' THEN OLD.projection_version ELSE NEW.projection_version END
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
';

CREATE FUNCTION public.maintain_tag_primary_display_path_from_vote_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS '
DECLARE
	target_structure_ids uuid[];
	target_structure_id uuid;
	target_projection_version integer;
	target_tag_ids uuid[];
	target_tag_id uuid;
BEGIN
	IF TG_OP = ''INSERT'' THEN
		target_structure_ids := ARRAY[NEW.structure_id];
	ELSIF TG_OP = ''DELETE'' THEN
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
	FROM public.unit_structure_end AS structure_end
	JOIN public.unit_structure AS structure
		ON structure.id = structure_end.structure_id
		AND structure.active_projection_version = structure_end.projection_version
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
';

CREATE FUNCTION public.mark_vndb_v11_primary_path_from_end() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS '
DECLARE
	target_structure_ids uuid[];
	target_structure_id uuid;
	target_tag_ids uuid[];
	target_tag_id uuid;
BEGIN
	IF TG_OP = ''INSERT'' THEN
		target_structure_ids := ARRAY[NEW.structure_id];
		target_tag_ids := ARRAY[NEW.final_tag_id];
	ELSIF TG_OP = ''DELETE'' THEN
		target_structure_ids := ARRAY[OLD.structure_id];
		target_tag_ids := ARRAY[OLD.final_tag_id];
	ELSE
		target_structure_ids := ARRAY[OLD.structure_id, NEW.structure_id];
		target_tag_ids := ARRAY[OLD.final_tag_id, NEW.final_tag_id];
	END IF;

	FOR target_structure_id IN
		SELECT DISTINCT candidate.structure_id
		FROM unnest(target_structure_ids) AS candidate(structure_id)
		ORDER BY candidate.structure_id
	LOOP
		PERFORM public.mark_vndb_v11_primary_path_dirty_key(
			''structure'',
			target_structure_id
		);
	END LOOP;
	FOR target_tag_id IN
		SELECT DISTINCT candidate.tag_id
		FROM unnest(target_tag_ids) AS candidate(tag_id)
		ORDER BY candidate.tag_id
	LOOP
		PERFORM public.mark_vndb_v11_primary_path_dirty_key(''tag'', target_tag_id);
	END LOOP;
	RETURN NULL;
END;
';

CREATE FUNCTION public.mark_vndb_v11_primary_path_from_vote_stat()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS '
DECLARE
	target_structure_ids uuid[];
	target_structure_id uuid;
	target_tag_id uuid;
BEGIN
	IF TG_OP = ''INSERT'' THEN
		target_structure_ids := ARRAY[NEW.structure_id];
	ELSIF TG_OP = ''DELETE'' THEN
		target_structure_ids := ARRAY[OLD.structure_id];
	ELSE
		target_structure_ids := ARRAY[OLD.structure_id, NEW.structure_id];
	END IF;

	FOR target_structure_id IN
		SELECT DISTINCT candidate.structure_id
		FROM unnest(target_structure_ids) AS candidate(structure_id)
		ORDER BY candidate.structure_id
	LOOP
		PERFORM public.mark_vndb_v11_primary_path_dirty_key(
			''structure'',
			target_structure_id
		);
	END LOOP;
	FOR target_tag_id IN
		SELECT DISTINCT structure_end.final_tag_id
		FROM public.unit_structure_end AS structure_end
		JOIN public.unit_structure AS structure
			ON structure.id = structure_end.structure_id
			AND structure.active_projection_version = structure_end.projection_version
		WHERE structure_end.structure_id = ANY(target_structure_ids)
		ORDER BY structure_end.final_tag_id
	LOOP
		PERFORM public.mark_vndb_v11_primary_path_dirty_key(''tag'', target_tag_id);
	END LOOP;
	RETURN NULL;
END;
';

-- The online runner calls this O(1) primitive in Structure-id keyset order.
-- The same Structure advisory lock used by legacy definition writes closes the
-- scan/write race; real writer transactions still enqueue their affected keys.
CREATE FUNCTION public.refresh_vndb_v11_primary_path_projection(
	target_structure_id uuid
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS '
DECLARE
	previous_projection_refresh text;
	previous_recheck text;
	target_projection_version integer;
	target_final_tag_id uuid;
BEGIN
	previous_projection_refresh :=
		current_setting(''rezics.vndb_projection_refresh'', true);
	previous_recheck :=
		current_setting(''rezics.vndb_v11_primary_path_recheck'', true);
	PERFORM set_config(''rezics.vndb_projection_refresh'', ''enabled'', true);
	PERFORM set_config(''rezics.vndb_v11_primary_path_recheck'', ''enabled'', true);
	BEGIN
		PERFORM public.lock_unit_structure_definition_key(target_structure_id);
		SELECT
			structure.active_projection_version,
			structure.member_unit_ids[cardinality(structure.member_unit_ids)]
		INTO target_projection_version, target_final_tag_id
		FROM public.unit_structure AS structure
		WHERE structure.id = target_structure_id;

		IF FOUND THEN
			INSERT INTO public.unit_structure_end (
				structure_id,
				projection_version,
				final_tag_id
			)
			VALUES (
				target_structure_id,
				target_projection_version,
				target_final_tag_id
			)
			ON CONFLICT (structure_id, projection_version) DO UPDATE SET
				final_tag_id = excluded.final_tag_id
			WHERE unit_structure_end.final_tag_id IS DISTINCT FROM excluded.final_tag_id;

			IF NOT FOUND THEN
				PERFORM public.refresh_unit_structure_primary_path_candidate(
					target_structure_id,
					target_projection_version
				);
				PERFORM public.refresh_tag_primary_display_path(target_final_tag_id);
			END IF;
		ELSE
			-- Prepare runs only the legacy v1 writer contract. Deletes therefore
			-- have one exact generation key and never fan out over history.
			DELETE FROM public.unit_structure_end
			WHERE structure_id = target_structure_id
				AND projection_version = 1;
		END IF;
	EXCEPTION WHEN OTHERS THEN
		PERFORM set_config(
			''rezics.vndb_projection_refresh'',
			coalesce(previous_projection_refresh, ''''),
			true
		);
		PERFORM set_config(
			''rezics.vndb_v11_primary_path_recheck'',
			coalesce(previous_recheck, ''''),
			true
		);
		RAISE;
	END;
	PERFORM set_config(
		''rezics.vndb_projection_refresh'',
		coalesce(previous_projection_refresh, ''''),
		true
	);
	PERFORM set_config(
		''rezics.vndb_v11_primary_path_recheck'',
		coalesce(previous_recheck, ''''),
		true
	);
END;
';

CREATE FUNCTION public.refresh_vndb_v11_primary_path_dirty_key(
	target_key_kind text,
	target_key_id uuid
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS '
DECLARE
	previous_projection_refresh text;
	previous_recheck text;
BEGIN
	IF target_key_kind = ''structure'' THEN
		PERFORM public.refresh_vndb_v11_primary_path_projection(target_key_id);
		RETURN;
	END IF;
	IF target_key_kind <> ''tag'' THEN
		RAISE EXCEPTION ''Invalid VNDB v11 primary-Path dirty-key kind: %'', target_key_kind
			USING ERRCODE = ''22023'';
	END IF;

	previous_projection_refresh :=
		current_setting(''rezics.vndb_projection_refresh'', true);
	previous_recheck :=
		current_setting(''rezics.vndb_v11_primary_path_recheck'', true);
	PERFORM set_config(''rezics.vndb_projection_refresh'', ''enabled'', true);
	PERFORM set_config(''rezics.vndb_v11_primary_path_recheck'', ''enabled'', true);
	BEGIN
		PERFORM public.refresh_tag_primary_display_path(target_key_id);
	EXCEPTION WHEN OTHERS THEN
		PERFORM set_config(
			''rezics.vndb_projection_refresh'',
			coalesce(previous_projection_refresh, ''''),
			true
		);
		PERFORM set_config(
			''rezics.vndb_v11_primary_path_recheck'',
			coalesce(previous_recheck, ''''),
			true
		);
		RAISE;
	END;
	PERFORM set_config(
		''rezics.vndb_projection_refresh'',
		coalesce(previous_projection_refresh, ''''),
		true
	);
	PERFORM set_config(
		''rezics.vndb_v11_primary_path_recheck'',
		coalesce(previous_recheck, ''''),
		true
	);
END;
';

CREATE FUNCTION public.maintain_vndb_v11_primary_path_from_structure()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS '
DECLARE
	target_structure_ids uuid[];
	target_structure_id uuid;
	target_tag_ids uuid[];
	target_tag_id uuid;
BEGIN
	IF TG_OP = ''UPDATE''
		AND (NEW.id, NEW.member_unit_ids, NEW.active_projection_version)
			IS NOT DISTINCT FROM
			(OLD.id, OLD.member_unit_ids, OLD.active_projection_version)
	THEN
		RETURN NULL;
	END IF;

	IF TG_OP = ''INSERT'' THEN
		target_structure_ids := ARRAY[NEW.id];
		target_tag_ids := ARRAY[
			NEW.member_unit_ids[cardinality(NEW.member_unit_ids)]
		];
	ELSIF TG_OP = ''DELETE'' THEN
		target_structure_ids := ARRAY[OLD.id];
		target_tag_ids := ARRAY[
			OLD.member_unit_ids[cardinality(OLD.member_unit_ids)]
		];
	ELSE
		target_structure_ids := ARRAY[OLD.id, NEW.id];
		target_tag_ids := ARRAY[
			OLD.member_unit_ids[cardinality(OLD.member_unit_ids)],
			NEW.member_unit_ids[cardinality(NEW.member_unit_ids)]
		];
	END IF;

	FOR target_structure_id IN
		SELECT DISTINCT candidate.structure_id
		FROM unnest(target_structure_ids) AS candidate(structure_id)
		ORDER BY candidate.structure_id
	LOOP
		PERFORM public.refresh_vndb_v11_primary_path_projection(target_structure_id);
		PERFORM public.mark_vndb_v11_primary_path_dirty_key(
			''structure'',
			target_structure_id
		);
	END LOOP;
	FOR target_tag_id IN
		SELECT DISTINCT candidate.tag_id
		FROM unnest(target_tag_ids) AS candidate(tag_id)
		ORDER BY candidate.tag_id
	LOOP
		PERFORM public.mark_vndb_v11_primary_path_dirty_key(''tag'', target_tag_id);
	END LOOP;
	RETURN NULL;
END;
';

CREATE TRIGGER unit_structure_primary_path_candidate_immutable
BEFORE INSERT OR DELETE OR UPDATE ON public.unit_structure_primary_path_candidate
FOR EACH ROW EXECUTE FUNCTION public.protect_vndb_projection();

CREATE TRIGGER tag_primary_display_path_immutable
BEFORE INSERT OR DELETE OR UPDATE ON public.tag_primary_display_path
FOR EACH ROW EXECUTE FUNCTION public.protect_vndb_projection();

CREATE TRIGGER unit_structure_end_immutable
BEFORE INSERT OR DELETE OR UPDATE ON public.unit_structure_end
FOR EACH ROW EXECUTE FUNCTION public.protect_vndb_projection();

CREATE TRIGGER unit_structure_end_primary_display_prepare
BEFORE INSERT OR DELETE OR UPDATE ON public.unit_structure_end
FOR EACH ROW EXECUTE FUNCTION public.prepare_unit_structure_end_change();

CREATE TRIGGER unit_structure_end_primary_display_maintain
AFTER INSERT OR DELETE OR UPDATE ON public.unit_structure_end
FOR EACH ROW EXECUTE FUNCTION public.maintain_tag_primary_display_path_from_end();

CREATE TRIGGER unit_structure_end_primary_path_dirty
AFTER INSERT OR DELETE OR UPDATE ON public.unit_structure_end
FOR EACH ROW EXECUTE FUNCTION public.mark_vndb_v11_primary_path_from_end();

CREATE TRIGGER unit_structure_vote_stat_primary_display_maintain
AFTER INSERT OR DELETE OR UPDATE ON public.unit_structure_vote_stat
FOR EACH ROW EXECUTE FUNCTION public.maintain_tag_primary_display_path_from_vote_stat();

CREATE TRIGGER unit_structure_vote_stat_primary_path_dirty
AFTER INSERT OR DELETE OR UPDATE ON public.unit_structure_vote_stat
FOR EACH ROW EXECUTE FUNCTION public.mark_vndb_v11_primary_path_from_vote_stat();

-- PostgreSQL orders same-event triggers by name. This runs after the legacy
-- unit_structure_definition_project trigger has rebuilt v1 members and edges.
CREATE TRIGGER vndb_v11_primary_path_structure_maintain
AFTER INSERT OR DELETE OR UPDATE ON public.unit_structure
FOR EACH ROW EXECUTE FUNCTION public.maintain_vndb_v11_primary_path_from_structure();

CREATE TABLE public.unit_structure_correction_policy (
	id boolean PRIMARY KEY DEFAULT true,
	admission_open boolean DEFAULT true NOT NULL,
	maximum_pending_jobs integer DEFAULT 1024 NOT NULL,
	maximum_staging_jobs integer DEFAULT 8 NOT NULL,
	shard_count integer DEFAULT 256 NOT NULL,
	batch_size integer DEFAULT 1000 NOT NULL,
	lease_seconds integer DEFAULT 30 NOT NULL,
	minimum_headroom_basis_points integer DEFAULT 20000 NOT NULL,
	maximum_staging_bytes bigint DEFAULT 0 NOT NULL,
	estimated_bytes_per_target_support integer DEFAULT 512 NOT NULL,
	updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT unit_structure_correction_policy_singleton_check CHECK (id),
	CONSTRAINT unit_structure_correction_policy_pending_check
		CHECK (maximum_pending_jobs BETWEEN 1 AND 1024),
	CONSTRAINT unit_structure_correction_policy_staging_check
		CHECK (maximum_staging_jobs BETWEEN 1 AND 8),
	CONSTRAINT unit_structure_correction_policy_shard_check CHECK (shard_count = 256),
	CONSTRAINT unit_structure_correction_policy_batch_check
		CHECK (batch_size BETWEEN 1 AND 10000),
	CONSTRAINT unit_structure_correction_policy_lease_check
		CHECK (lease_seconds BETWEEN 5 AND 300),
	CONSTRAINT unit_structure_correction_policy_headroom_check
		CHECK (minimum_headroom_basis_points >= 20000),
	CONSTRAINT unit_structure_correction_policy_storage_check
		CHECK (maximum_staging_bytes >= 0
			AND estimated_bytes_per_target_support BETWEEN 128 AND 4096)
);

CREATE TABLE public.unit_structure_correction (
	id uuid PRIMARY KEY DEFAULT uuidv7(),
	structure_id uuid NOT NULL,
	source_projection_version integer NOT NULL,
	target_projection_version integer NOT NULL,
	source_member_unit_ids uuid[] NOT NULL,
	target_member_unit_ids uuid[] NOT NULL,
	expected_structure_updated_at timestamp(3) with time zone NOT NULL,
	requested_by_profile_id uuid NOT NULL,
	reason text NOT NULL,
	contribution_kind text NOT NULL,
	credited_entity_id uuid,
	contribution_role text,
	status text DEFAULT 'pending' NOT NULL,
	write_route text DEFAULT 'source' NOT NULL,
	expected_application_count bigint,
	expected_positive_judgment_count bigint,
	expected_target_support_count bigint,
	required_staging_bytes bigint,
	preflight_completed_at timestamp(3) with time zone,
	headroom_admitted_at timestamp(3) with time zone,
	available_at timestamp(3) with time zone DEFAULT now() NOT NULL,
	lease_owner text,
	lease_token uuid,
	lease_expires_at timestamp(3) with time zone,
	attempt_count integer DEFAULT 0 NOT NULL,
	failed_from_status text,
	activated_at timestamp(3) with time zone,
	completed_at timestamp(3) with time zone,
	failed_at timestamp(3) with time zone,
	cancelled_at timestamp(3) with time zone,
	last_error_code text,
	last_error_message text,
	created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
	updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT unit_structure_correction_structure_target_version_key
		UNIQUE (structure_id, target_projection_version),
	CONSTRAINT unit_structure_correction_structure_id_unit_structure_id_fkey
		FOREIGN KEY (structure_id) REFERENCES public.unit_structure(id) ON DELETE RESTRICT,
	CONSTRAINT "unit_structure_correction_MxCajkuZuAyU_fkey"
		FOREIGN KEY (requested_by_profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT,
	CONSTRAINT unit_structure_correction_credited_entity_id_entity_id_fkey
		FOREIGN KEY (credited_entity_id) REFERENCES public.entity(id) ON DELETE RESTRICT,
	CONSTRAINT unit_structure_correction_status_check CHECK (
		status IN ('pending', 'preflighting', 'staging', 'reconciling', 'ready',
			'activating', 'active_overlay', 'compacting', 'route_switching',
			'cleaning', 'completed', 'failed', 'cancelled')
	),
	CONSTRAINT unit_structure_correction_write_route_check
		CHECK (write_route IN ('source', 'overlay', 'target')),
	CONSTRAINT unit_structure_correction_version_check
		CHECK (source_projection_version > 0
			AND target_projection_version = source_projection_version + 1),
	CONSTRAINT unit_structure_correction_source_member_count_check
		CHECK (cardinality(source_member_unit_ids) BETWEEN 2 AND 16),
	CONSTRAINT unit_structure_correction_target_member_count_check
		CHECK (cardinality(target_member_unit_ids) BETWEEN 2 AND 16),
	CONSTRAINT unit_structure_correction_reason_check
		CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
	CONSTRAINT unit_structure_correction_contribution_kind_check
		CHECK (contribution_kind IN ('unattributed', 'human', 'ai')),
	CONSTRAINT unit_structure_correction_contribution_role_check
		CHECK (contribution_role IS NULL
			OR contribution_role IN ('creator', 'editor', 'translator', 'researcher')),
	CONSTRAINT unit_structure_correction_contribution_shape_check CHECK (
		(contribution_kind = 'ai' AND credited_entity_id IS NOT NULL
			AND contribution_role IS NOT NULL)
		OR (contribution_kind <> 'ai' AND credited_entity_id IS NULL
			AND contribution_role IS NULL)
	),
	CONSTRAINT unit_structure_correction_lease_shape_check CHECK (
		(lease_owner IS NULL AND lease_token IS NULL AND lease_expires_at IS NULL)
		OR (lease_owner IS NOT NULL AND lease_token IS NOT NULL
			AND lease_expires_at IS NOT NULL)
	),
	CONSTRAINT unit_structure_correction_preflight_count_check CHECK (
		(expected_application_count IS NULL OR expected_application_count >= 0)
		AND (expected_positive_judgment_count IS NULL
			OR expected_positive_judgment_count >= 0)
		AND (expected_target_support_count IS NULL OR expected_target_support_count >= 0)
		AND (required_staging_bytes IS NULL OR required_staging_bytes >= 0)
		AND attempt_count BETWEEN 0 AND 8
	),
	CONSTRAINT unit_structure_correction_preflight_shape_check CHECK (
		(preflight_completed_at IS NULL AND headroom_admitted_at IS NULL
			AND expected_target_support_count IS NULL AND required_staging_bytes IS NULL)
		OR (preflight_completed_at IS NOT NULL AND headroom_admitted_at IS NOT NULL
			AND expected_application_count IS NOT NULL
			AND expected_positive_judgment_count IS NOT NULL
			AND expected_target_support_count IS NOT NULL
			AND required_staging_bytes IS NOT NULL)
	)
);
CREATE UNIQUE INDEX unit_structure_correction_structure_open_idx
	ON public.unit_structure_correction (structure_id)
	WHERE status NOT IN ('completed', 'failed', 'cancelled');
CREATE INDEX unit_structure_correction_queue_idx
	ON public.unit_structure_correction
		(status, available_at, lease_expires_at, created_at, id);
CREATE INDEX unit_structure_correction_route_idx
	ON public.unit_structure_correction (write_route, status, id);

CREATE TABLE public.unit_structure_correction_shard (
	job_id uuid NOT NULL,
	phase text NOT NULL,
	shard integer NOT NULL,
	cursor_unit_id uuid,
	cursor_tag_id uuid,
	cursor_profile_id uuid,
	available_at timestamp(3) with time zone DEFAULT now() NOT NULL,
	lease_owner text,
	lease_token uuid,
	lease_expires_at timestamp(3) with time zone,
	attempt_count integer DEFAULT 0 NOT NULL,
	processed_count bigint DEFAULT 0 NOT NULL,
	completed_at timestamp(3) with time zone,
	last_error_code text,
	last_error_message text,
	updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT unit_structure_correction_shard_pkey PRIMARY KEY (job_id, phase, shard),
	CONSTRAINT "unit_structure_correction_shard_nutdZ1i0dQb8_fkey"
		FOREIGN KEY (job_id) REFERENCES public.unit_structure_correction(id) ON DELETE CASCADE,
	CONSTRAINT unit_structure_correction_shard_phase_check CHECK (
		phase IN ('preflight_application', 'preflight_judgment', 'stage_support',
			'stage_effective_vote', 'verify_target', 'compact_tag_upsert',
			'compact_vote', 'compact_stat', 'compact_tag_delete', 'cleanup_support',
			'cleanup_projection')
	),
	CONSTRAINT unit_structure_correction_shard_number_check CHECK (shard BETWEEN 0 AND 255),
	CONSTRAINT unit_structure_correction_shard_lease_shape_check CHECK (
		(lease_owner IS NULL AND lease_token IS NULL AND lease_expires_at IS NULL)
		OR (lease_owner IS NOT NULL AND lease_token IS NOT NULL
			AND lease_expires_at IS NOT NULL)
	),
	CONSTRAINT unit_structure_correction_shard_count_check
		CHECK (attempt_count >= 0 AND processed_count >= 0)
);
CREATE INDEX unit_structure_correction_shard_claim_idx
	ON public.unit_structure_correction_shard
		(phase, completed_at, available_at, lease_expires_at, job_id, shard);

CREATE TABLE public.unit_structure_correction_tag_reservation (
	tag_id uuid PRIMARY KEY,
	job_id uuid NOT NULL,
	reservation_epoch bigint NOT NULL,
	created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT unit_structure_correction_tag_reservation_tag_id_tag_id_fkey
		FOREIGN KEY (tag_id) REFERENCES public.tag(id) ON DELETE RESTRICT,
	CONSTRAINT "unit_structure_correction_tag_reservation_ik4GxzfYtpGp_fkey"
		FOREIGN KEY (job_id) REFERENCES public.unit_structure_correction(id) ON DELETE CASCADE,
	CONSTRAINT unit_structure_correction_tag_reservation_epoch_check
		CHECK (reservation_epoch > 0)
);
CREATE INDEX unit_structure_correction_tag_reservation_job_idx
	ON public.unit_structure_correction_tag_reservation (job_id, tag_id);

CREATE TABLE public.unit_structure_correction_unit_reservation (
	job_id uuid NOT NULL,
	unit_id uuid NOT NULL,
	created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT unit_structure_correction_unit_reservation_pkey PRIMARY KEY (job_id, unit_id),
	CONSTRAINT "unit_structure_correction_unit_reservation_z7IpMoaZlszj_fkey"
		FOREIGN KEY (job_id) REFERENCES public.unit_structure_correction(id) ON DELETE CASCADE,
	CONSTRAINT unit_structure_correction_unit_reservation_unit_id_unit_id_fkey
		FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT
);
CREATE INDEX unit_structure_correction_unit_reservation_unit_idx
	ON public.unit_structure_correction_unit_reservation (unit_id, job_id);

CREATE TABLE public.unit_structure_correction_effective_vote (
	job_id uuid NOT NULL,
	unit_id uuid NOT NULL,
	tag_id uuid NOT NULL,
	profile_id uuid NOT NULL,
	base_value integer,
	target_value integer,
	base_applied boolean DEFAULT false NOT NULL,
	created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
	updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT unit_structure_correction_effective_vote_pkey
		PRIMARY KEY (job_id, unit_id, tag_id, profile_id),
	CONSTRAINT "unit_structure_correction_effective_vote_sDNm29jOAsrI_fkey"
		FOREIGN KEY (job_id) REFERENCES public.unit_structure_correction(id) ON DELETE CASCADE,
	CONSTRAINT unit_structure_correction_effective_vote_unit_id_unit_id_fkey
		FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT,
	CONSTRAINT unit_structure_correction_effective_vote_tag_id_tag_id_fkey
		FOREIGN KEY (tag_id) REFERENCES public.tag(id) ON DELETE RESTRICT,
	CONSTRAINT "unit_structure_correction_effective_vote_CvGbnne7uvB4_fkey"
		FOREIGN KEY (profile_id) REFERENCES public.profile(id) ON DELETE RESTRICT,
	CONSTRAINT unit_structure_correction_effective_vote_base_check
		CHECK (base_value IS NULL OR base_value IN (-1, 1)),
	CONSTRAINT unit_structure_correction_effective_vote_target_check
		CHECK (target_value IS NULL OR target_value IN (-1, 1)),
	CONSTRAINT unit_structure_correction_effective_vote_changed_check
		CHECK (base_value IS DISTINCT FROM target_value)
);
CREATE INDEX unit_structure_correction_effective_vote_point_idx
	ON public.unit_structure_correction_effective_vote (unit_id, tag_id, job_id, profile_id);
CREATE INDEX unit_structure_correction_effective_vote_compact_idx
	ON public.unit_structure_correction_effective_vote
		(job_id, base_applied, unit_id, tag_id, profile_id);

CREATE TABLE public.unit_structure_correction_tag_projection (
	job_id uuid NOT NULL,
	unit_id uuid NOT NULL,
	tag_id uuid NOT NULL,
	base_present boolean NOT NULL,
	target_present boolean NOT NULL,
	base_direct boolean NOT NULL,
	target_direct boolean NOT NULL,
	base_structure_support_count bigint NOT NULL,
	target_structure_support_count bigint NOT NULL,
	base_score bigint NOT NULL,
	target_score bigint NOT NULL,
	base_vote_count bigint NOT NULL,
	target_vote_count bigint NOT NULL,
	base_spoiler_vote_count bigint NOT NULL,
	target_spoiler_vote_count bigint NOT NULL,
	base_spoiler_none_count bigint NOT NULL,
	target_spoiler_none_count bigint NOT NULL,
	base_spoiler_minor_count bigint NOT NULL,
	target_spoiler_minor_count bigint NOT NULL,
	base_spoiler_major_count bigint NOT NULL,
	target_spoiler_major_count bigint NOT NULL,
	base_applied boolean DEFAULT false NOT NULL,
	created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
	updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT unit_structure_correction_tag_projection_pkey
		PRIMARY KEY (job_id, unit_id, tag_id),
	CONSTRAINT "unit_structure_correction_tag_projection_4eIFnkZLWoJq_fkey"
		FOREIGN KEY (job_id) REFERENCES public.unit_structure_correction(id) ON DELETE CASCADE,
	CONSTRAINT unit_structure_correction_tag_projection_unit_id_unit_id_fkey
		FOREIGN KEY (unit_id) REFERENCES public.unit(id) ON DELETE RESTRICT,
	CONSTRAINT unit_structure_correction_tag_projection_tag_id_tag_id_fkey
		FOREIGN KEY (tag_id) REFERENCES public.tag(id) ON DELETE RESTRICT,
	CONSTRAINT unit_structure_correction_tag_projection_count_check CHECK (
		base_structure_support_count >= 0 AND target_structure_support_count >= 0
		AND base_vote_count >= 0 AND target_vote_count >= 0
		AND base_spoiler_vote_count >= 0 AND target_spoiler_vote_count >= 0
		AND base_spoiler_none_count >= 0 AND target_spoiler_none_count >= 0
		AND base_spoiler_minor_count >= 0 AND target_spoiler_minor_count >= 0
		AND base_spoiler_major_count >= 0 AND target_spoiler_major_count >= 0
	),
	CONSTRAINT unit_structure_correction_tag_projection_score_check
		CHECK (abs(base_score) <= base_vote_count AND abs(target_score) <= target_vote_count),
	CONSTRAINT unit_structure_correction_tag_projection_parity_check CHECK (
		(base_vote_count + base_score) % 2 = 0
		AND (target_vote_count + target_score) % 2 = 0
	),
	CONSTRAINT unit_structure_correction_tag_projection_spoiler_count_check CHECK (
		base_spoiler_vote_count = base_spoiler_none_count
			+ base_spoiler_minor_count + base_spoiler_major_count
		AND target_spoiler_vote_count = target_spoiler_none_count
			+ target_spoiler_minor_count + target_spoiler_major_count
	),
	CONSTRAINT unit_structure_correction_tag_projection_presence_check CHECK (
		base_present = (base_direct OR base_structure_support_count > 0)
		AND target_present = (target_direct OR target_structure_support_count > 0)
	)
);
CREATE INDEX unit_structure_correction_tag_projection_point_idx
	ON public.unit_structure_correction_tag_projection (unit_id, tag_id, job_id);
CREATE INDEX unit_structure_correction_tag_projection_compact_idx
	ON public.unit_structure_correction_tag_projection (job_id, base_applied, unit_id, tag_id);

CREATE TABLE public.unit_structure_correction_primary_path (
	job_id uuid NOT NULL,
	tag_id uuid NOT NULL,
	base_structure_id uuid,
	base_projection_version integer,
	target_structure_id uuid,
	target_projection_version integer,
	base_applied boolean DEFAULT false NOT NULL,
	updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT unit_structure_correction_primary_path_pkey PRIMARY KEY (job_id, tag_id),
	CONSTRAINT "unit_structure_correction_primary_path_z64uys3GJOKw_fkey"
		FOREIGN KEY (job_id) REFERENCES public.unit_structure_correction(id) ON DELETE CASCADE,
	CONSTRAINT unit_structure_correction_primary_path_tag_id_tag_id_fkey
		FOREIGN KEY (tag_id) REFERENCES public.tag(id) ON DELETE RESTRICT,
	CONSTRAINT "unit_structure_correction_primary_path_EBiCbEBSUsA1_fkey"
		FOREIGN KEY (base_structure_id) REFERENCES public.unit_structure(id) ON DELETE RESTRICT,
	CONSTRAINT "unit_structure_correction_primary_path_uYGc1ZfQuFYx_fkey"
		FOREIGN KEY (target_structure_id) REFERENCES public.unit_structure(id) ON DELETE RESTRICT,
	CONSTRAINT unit_structure_correction_primary_path_base_shape_check
		CHECK ((base_structure_id IS NULL) = (base_projection_version IS NULL)),
	CONSTRAINT unit_structure_correction_primary_path_target_shape_check
		CHECK ((target_structure_id IS NULL) = (target_projection_version IS NULL))
);
CREATE INDEX unit_structure_correction_primary_path_point_idx
	ON public.unit_structure_correction_primary_path (tag_id, job_id);

CREATE TABLE public.unit_structure_correction_activation (
	id boolean PRIMARY KEY DEFAULT true,
	job_id uuid CONSTRAINT unit_structure_correction_activation_job_key UNIQUE,
	lease_owner text,
	lease_token uuid,
	lease_expires_at timestamp(3) with time zone,
	routing_epoch bigint DEFAULT 1 NOT NULL,
	updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_structure_correction_activation_PwtGUPGHjX7s_fkey"
		FOREIGN KEY (job_id) REFERENCES public.unit_structure_correction(id) ON DELETE RESTRICT,
	CONSTRAINT unit_structure_correction_activation_singleton_check CHECK (id),
	CONSTRAINT unit_structure_correction_activation_lease_shape_check CHECK (
		(job_id IS NULL AND lease_owner IS NULL AND lease_token IS NULL
			AND lease_expires_at IS NULL)
		OR (job_id IS NOT NULL AND lease_owner IS NOT NULL AND lease_token IS NOT NULL
			AND lease_expires_at IS NOT NULL)
	),
	CONSTRAINT unit_structure_correction_activation_epoch_check CHECK (routing_epoch > 0)
);

INSERT INTO public.unit_structure_correction_policy (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.unit_structure_correction_activation (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

-- Bounded online primary-Path progress is separate from paused-epoch proof.
CREATE TABLE public.vndb_v11_primary_path_backfill_progress (
	id boolean PRIMARY KEY DEFAULT true,
	backfill_contract text NOT NULL DEFAULT 'vndb-v11-primary-path-online-v1',
	cursor uuid,
	processed_row_count bigint NOT NULL DEFAULT 0,
	completed_at timestamp(3) with time zone,
	updated_at timestamp(3) with time zone NOT NULL DEFAULT clock_timestamp(),
	CONSTRAINT vndb_v11_primary_path_backfill_progress_singleton_check CHECK (id),
	CONSTRAINT vndb_v11_primary_path_backfill_progress_contract_check CHECK (
		backfill_contract = 'vndb-v11-primary-path-online-v1'
	),
	CONSTRAINT vndb_v11_primary_path_backfill_progress_count_check CHECK (
		processed_row_count >= 0
	)
);
INSERT INTO public.vndb_v11_primary_path_backfill_progress (id) VALUES (true);

CREATE FUNCTION public.enforce_vndb_v11_primary_path_backfill_progress() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS '
BEGIN
	PERFORM pg_catalog.pg_advisory_xact_lock_shared(71011001::bigint);
	IF NOT EXISTS (
		SELECT 1 FROM public.vndb_v11_cutover_control
		WHERE id = 1 AND state = ''precontract_open''
	) THEN
		RAISE EXCEPTION ''Primary Path backfill requires precontract-open state''
			USING ERRCODE = ''55000'',
				CONSTRAINT = ''vndb_v11_primary_path_backfill_state_invalid'';
	END IF;
	IF OLD.completed_at IS NOT NULL THEN
		RAISE EXCEPTION ''Completed primary Path backfill progress is immutable''
			USING ERRCODE = ''55000'',
				CONSTRAINT = ''vndb_v11_primary_path_backfill_progress_immutable'';
	END IF;
	IF NEW.id IS DISTINCT FROM OLD.id
		OR NEW.backfill_contract IS DISTINCT FROM OLD.backfill_contract
		OR NEW.updated_at < OLD.updated_at
	THEN
		RAISE EXCEPTION ''Primary Path backfill progress identity is immutable''
			USING ERRCODE = ''55000'',
				CONSTRAINT = ''vndb_v11_primary_path_backfill_progress_update_invalid'';
	END IF;
	IF NEW.completed_at IS NULL THEN
		IF NEW.cursor IS NULL OR (OLD.cursor IS NOT NULL AND NEW.cursor <= OLD.cursor)
			OR NEW.processed_row_count <= OLD.processed_row_count
		THEN
			RAISE EXCEPTION ''Primary Path backfill cursor must advance''
				USING ERRCODE = ''55000'',
					CONSTRAINT = ''vndb_v11_primary_path_backfill_progress_update_invalid'';
		END IF;
	ELSIF NEW.cursor IS DISTINCT FROM OLD.cursor
		OR NEW.processed_row_count <> OLD.processed_row_count
		OR NEW.completed_at < OLD.updated_at
	THEN
		RAISE EXCEPTION ''Primary Path backfill completion is invalid''
			USING ERRCODE = ''55000'',
				CONSTRAINT = ''vndb_v11_primary_path_backfill_progress_update_invalid'';
	END IF;
	RETURN NEW;
END;
';

CREATE FUNCTION public.protect_vndb_v11_primary_path_backfill_progress() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS '
BEGIN
	RAISE EXCEPTION ''Primary Path backfill progress cannot be deleted or truncated''
		USING ERRCODE = ''55000'',
			CONSTRAINT = ''vndb_v11_primary_path_backfill_progress_immutable'';
END;
';
CREATE TRIGGER vndb_v11_primary_path_backfill_progress_enforce
BEFORE UPDATE ON public.vndb_v11_primary_path_backfill_progress
FOR EACH ROW EXECUTE FUNCTION public.enforce_vndb_v11_primary_path_backfill_progress();
CREATE TRIGGER vndb_v11_primary_path_backfill_progress_delete_protect
BEFORE DELETE ON public.vndb_v11_primary_path_backfill_progress
FOR EACH STATEMENT EXECUTE FUNCTION public.protect_vndb_v11_primary_path_backfill_progress();
CREATE TRIGGER vndb_v11_primary_path_backfill_progress_truncate_protect
BEFORE TRUNCATE ON public.vndb_v11_primary_path_backfill_progress
FOR EACH STATEMENT EXECUTE FUNCTION public.protect_vndb_v11_primary_path_backfill_progress();

-- Exactly nine bounded scans produce one immutable proof per paused epoch.
CREATE TABLE public.vndb_v11_cutover_verification_checkpoint (
	transition_epoch bigint NOT NULL,
	relation text NOT NULL,
	verification_contract text NOT NULL DEFAULT 'vndb-v11-bounded-verifier-v1',
	cursor text[] NOT NULL DEFAULT ARRAY[]::text[],
	accumulator_key uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
	accumulator text[] NOT NULL DEFAULT ARRAY[]::text[],
	scanned_row_count bigint NOT NULL DEFAULT 0,
	verified_row_count bigint NOT NULL DEFAULT 0,
	checksum text NOT NULL DEFAULT repeat('0', 64),
	relation_proof text,
	started_at timestamp(3) with time zone NOT NULL DEFAULT clock_timestamp(),
	completed_at timestamp(3) with time zone,
	updated_at timestamp(3) with time zone NOT NULL DEFAULT clock_timestamp(),
	CONSTRAINT vndb_v11_cutover_verification_checkpoint_pkey
		PRIMARY KEY (transition_epoch, relation),
	CONSTRAINT vndb_v11_cutover_verification_checkpoint_epoch_fkey
		FOREIGN KEY (transition_epoch)
		REFERENCES public.vndb_v11_cutover_transition (transition_epoch) ON DELETE RESTRICT,
	CONSTRAINT vndb_v11_cutover_verification_checkpoint_epoch_check CHECK (
		transition_epoch > 0
	),
	CONSTRAINT vndb_v11_cutover_verification_checkpoint_relation_check CHECK (relation IN (
		'unit_structure_primary_path_backfill',
		'unit_structure_primary_path_projection',
		'unit_tag_judgment_timestamps',
		'unit_structure_application_judgment_timestamps',
		'realm_tag_judgment_timestamps',
		'unit_tag_judgment_stat',
		'unit_structure_application_judgment_stat',
		'realm_tag_judgment_stat',
		'subject_association_judgment_stat'
	)),
	CONSTRAINT vndb_v11_cutover_verification_checkpoint_contract_check CHECK (
		verification_contract = 'vndb-v11-bounded-verifier-v1'
	),
	CONSTRAINT vndb_v11_cutover_verification_checkpoint_cursor_storage_check CHECK (
		cursor = ARRAY[]::text[] OR (
			array_ndims(cursor) = 1 AND array_lower(cursor, 1) = 1
			AND array_position(cursor, NULL::text) IS NULL
		)
	),
	CONSTRAINT vndb_v11_cutover_verification_checkpoint_cursor_check CHECK (
		cardinality(cursor) = 0 OR cardinality(cursor) = CASE relation
			WHEN 'unit_structure_primary_path_backfill' THEN 1
			WHEN 'unit_structure_primary_path_projection' THEN 4
			WHEN 'unit_tag_judgment_timestamps' THEN 3
			WHEN 'unit_structure_application_judgment_timestamps' THEN 3
			WHEN 'realm_tag_judgment_timestamps' THEN 4
			WHEN 'unit_tag_judgment_stat' THEN 4
			WHEN 'unit_structure_application_judgment_stat' THEN 4
			WHEN 'realm_tag_judgment_stat' THEN 5
			WHEN 'subject_association_judgment_stat' THEN 3
			ELSE -1
		END
	),
	CONSTRAINT vndb_v11_cutover_verification_checkpoint_accumulator_storage_check CHECK (
		(accumulator_key = ARRAY[]::uuid[] OR (
			array_ndims(accumulator_key) = 1 AND array_lower(accumulator_key, 1) = 1
			AND array_position(accumulator_key, NULL::uuid) IS NULL
		)) AND (accumulator = ARRAY[]::text[] OR (
			array_ndims(accumulator) = 1 AND array_lower(accumulator, 1) = 1
			AND array_position(accumulator, NULL::text) IS NULL
		))
	),
	CONSTRAINT vndb_v11_cutover_verification_checkpoint_accumulator_check CHECK (
		(cardinality(accumulator_key) = 0 AND cardinality(accumulator) = 0)
		OR (relation = 'unit_structure_primary_path_projection'
			AND cardinality(accumulator_key) = 1 AND cardinality(accumulator) IN (0, 5))
		OR (relation = 'unit_tag_judgment_stat'
			AND cardinality(accumulator_key) = 2 AND cardinality(accumulator) = 8)
		OR (relation = 'unit_structure_application_judgment_stat'
			AND cardinality(accumulator_key) = 2 AND cardinality(accumulator) = 7)
		OR (relation = 'realm_tag_judgment_stat'
			AND cardinality(accumulator_key) = 3 AND cardinality(accumulator) = 7)
		OR (relation = 'subject_association_judgment_stat'
			AND cardinality(accumulator_key) = 1 AND cardinality(accumulator) = 5)
	),
	CONSTRAINT vndb_v11_cutover_verification_checkpoint_count_check CHECK (
		scanned_row_count >= 0 AND verified_row_count >= 0
		AND verified_row_count <= scanned_row_count
	),
	CONSTRAINT vndb_v11_cutover_verification_checkpoint_checksum_check CHECK (
		checksum ~ '^[0-9a-f]{64}$'
	),
	CONSTRAINT vndb_v11_cutover_verification_checkpoint_completion_check CHECK (
		(relation_proof IS NULL AND completed_at IS NULL)
		OR (relation_proof ~ '^[0-9a-f]{64}$' AND completed_at IS NOT NULL
			AND cardinality(accumulator_key) = 0 AND cardinality(accumulator) = 0)
	),
	CONSTRAINT vndb_v11_cutover_verification_checkpoint_time_check CHECK (
		updated_at >= started_at AND (completed_at IS NULL OR completed_at >= started_at)
	)
);

CREATE FUNCTION public.vndb_v11_verification_cursor_advanced(
	target_relation text, old_cursor text[], new_cursor text[]
) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'pg_catalog', 'public'
AS '
BEGIN
	IF cardinality(old_cursor) = 0 THEN
		RETURN cardinality(new_cursor) > 0;
	END IF;
	CASE target_relation
		WHEN ''unit_structure_primary_path_backfill'' THEN
			RETURN new_cursor[1]::uuid > old_cursor[1]::uuid;
		WHEN ''unit_structure_primary_path_projection'' THEN
			RETURN ROW(new_cursor[1]::uuid, new_cursor[2]::smallint,
				new_cursor[3]::uuid, new_cursor[4]::integer)
				> ROW(old_cursor[1]::uuid, old_cursor[2]::smallint,
					old_cursor[3]::uuid, old_cursor[4]::integer);
		WHEN ''unit_tag_judgment_timestamps'',
			''unit_structure_application_judgment_timestamps'' THEN
			RETURN ROW(new_cursor[1]::uuid, new_cursor[2]::uuid, new_cursor[3]::uuid)
				> ROW(old_cursor[1]::uuid, old_cursor[2]::uuid, old_cursor[3]::uuid);
		WHEN ''realm_tag_judgment_timestamps'' THEN
			RETURN ROW(new_cursor[1]::uuid, new_cursor[2]::uuid,
				new_cursor[3]::uuid, new_cursor[4]::uuid)
				> ROW(old_cursor[1]::uuid, old_cursor[2]::uuid,
					old_cursor[3]::uuid, old_cursor[4]::uuid);
		WHEN ''unit_tag_judgment_stat'', ''unit_structure_application_judgment_stat'' THEN
			RETURN ROW(new_cursor[1]::uuid, new_cursor[2]::uuid,
				new_cursor[3]::smallint, new_cursor[4]::uuid)
				> ROW(old_cursor[1]::uuid, old_cursor[2]::uuid,
					old_cursor[3]::smallint, old_cursor[4]::uuid);
		WHEN ''realm_tag_judgment_stat'' THEN
			RETURN ROW(new_cursor[1]::uuid, new_cursor[2]::uuid, new_cursor[3]::uuid,
				new_cursor[4]::smallint, new_cursor[5]::uuid)
				> ROW(old_cursor[1]::uuid, old_cursor[2]::uuid, old_cursor[3]::uuid,
					old_cursor[4]::smallint, old_cursor[5]::uuid);
		WHEN ''subject_association_judgment_stat'' THEN
			RETURN ROW(new_cursor[1]::uuid, new_cursor[2]::smallint, new_cursor[3]::uuid)
				> ROW(old_cursor[1]::uuid, old_cursor[2]::smallint, old_cursor[3]::uuid);
		ELSE RETURN false;
	END CASE;
END;
';

CREATE FUNCTION public.enforce_vndb_v11_cutover_verification_checkpoint() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS '
DECLARE
	paused_at timestamp(3) with time zone;
	normal_completion boolean;
	projection_flush boolean;
	unit_tag_absence_flush boolean;
BEGIN
	PERFORM pg_catalog.pg_advisory_xact_lock_shared(71011001::bigint);
	SELECT transition.transitioned_at INTO paused_at
	FROM public.vndb_v11_cutover_transition transition
	JOIN public.vndb_v11_cutover_control control
		ON control.id = 1 AND control.transition_epoch = transition.transition_epoch
	WHERE transition.transition_epoch = NEW.transition_epoch
		AND transition.state = ''paused'' AND control.state = ''paused'';
	IF NOT FOUND THEN
		RAISE EXCEPTION ''Verification requires the exact current paused epoch''
			USING ERRCODE = ''55000'',
				CONSTRAINT = ''vndb_v11_cutover_verification_epoch_not_current_paused'';
	END IF;
	IF TG_OP = ''INSERT'' THEN
		IF NEW.started_at < paused_at OR cardinality(NEW.cursor) <> 0
			OR cardinality(NEW.accumulator_key) <> 0 OR cardinality(NEW.accumulator) <> 0
			OR NEW.scanned_row_count <> 0 OR NEW.verified_row_count <> 0
			OR NEW.checksum <> repeat(''0'', 64) OR NEW.relation_proof IS NOT NULL
			OR NEW.completed_at IS NOT NULL
		THEN
			RAISE EXCEPTION ''Verification checkpoints must start empty''
				USING ERRCODE = ''55000'',
					CONSTRAINT = ''vndb_v11_cutover_verification_checkpoint_initial_invalid'';
		END IF;
		RETURN NEW;
	END IF;
	IF OLD.relation_proof IS NOT NULL OR OLD.completed_at IS NOT NULL
		OR NEW.transition_epoch IS DISTINCT FROM OLD.transition_epoch
		OR NEW.relation IS DISTINCT FROM OLD.relation
		OR NEW.verification_contract IS DISTINCT FROM OLD.verification_contract
		OR NEW.started_at IS DISTINCT FROM OLD.started_at OR NEW.updated_at < OLD.updated_at
	THEN
		RAISE EXCEPTION ''Verification checkpoint evidence is immutable''
			USING ERRCODE = ''55000'',
				CONSTRAINT = ''vndb_v11_cutover_verification_checkpoint_immutable'';
	END IF;
	IF NEW.relation_proof IS NULL AND NEW.completed_at IS NULL THEN
		IF NOT public.vndb_v11_verification_cursor_advanced(
			NEW.relation, OLD.cursor, NEW.cursor
		) OR NEW.scanned_row_count <= OLD.scanned_row_count
			OR NEW.verified_row_count < OLD.verified_row_count
			OR (NEW.verified_row_count = OLD.verified_row_count
				AND NEW.checksum IS DISTINCT FROM OLD.checksum)
			OR (NEW.verified_row_count > OLD.verified_row_count
				AND NEW.checksum IS NOT DISTINCT FROM OLD.checksum)
		THEN
			RAISE EXCEPTION ''Invalid verification checkpoint advancement''
				USING ERRCODE = ''55000'',
					CONSTRAINT = ''vndb_v11_cutover_verification_checkpoint_update_invalid'';
		END IF;
		RETURN NEW;
	END IF;
	normal_completion := NEW.cursor IS NOT DISTINCT FROM OLD.cursor
		AND NEW.scanned_row_count = OLD.scanned_row_count
		AND NEW.verified_row_count = OLD.verified_row_count
		AND NEW.checksum IS NOT DISTINCT FROM OLD.checksum
		AND cardinality(OLD.accumulator_key) = 0 AND cardinality(OLD.accumulator) = 0
		AND cardinality(NEW.accumulator_key) = 0 AND cardinality(NEW.accumulator) = 0;
	projection_flush := NEW.relation = ''unit_structure_primary_path_projection''
		AND NEW.cursor IS NOT DISTINCT FROM OLD.cursor
		AND NEW.scanned_row_count = OLD.scanned_row_count
		AND NEW.verified_row_count = OLD.verified_row_count + 1
		AND NEW.checksum IS DISTINCT FROM OLD.checksum
		AND cardinality(OLD.accumulator_key) = 1 AND cardinality(OLD.accumulator) = 0
		AND cardinality(NEW.accumulator_key) = 0 AND cardinality(NEW.accumulator) = 0;
	unit_tag_absence_flush := NEW.relation = ''unit_tag_judgment_stat''
		AND NEW.cursor IS NOT DISTINCT FROM OLD.cursor
		AND NEW.scanned_row_count = OLD.scanned_row_count
		AND NEW.verified_row_count = OLD.verified_row_count + 1
		AND NEW.checksum IS DISTINCT FROM OLD.checksum
		AND cardinality(OLD.accumulator_key) = 2 AND cardinality(OLD.accumulator) = 8
		AND NOT (
			(OLD.accumulator[2]::bigint > 0 OR OLD.accumulator[3]::bigint > 0)
			AND OLD.accumulator[8]::bigint > 0
		)
		AND cardinality(NEW.accumulator_key) = 0 AND cardinality(NEW.accumulator) = 0;
	IF NEW.relation_proof IS NULL OR NEW.completed_at IS NULL
		OR NOT (normal_completion OR projection_flush OR unit_tag_absence_flush)
		OR NEW.completed_at < OLD.updated_at
		OR (NEW.relation = ''unit_structure_primary_path_projection'' AND NOT EXISTS (
			SELECT 1 FROM public.vndb_v11_cutover_verification_checkpoint prerequisite
			WHERE prerequisite.transition_epoch = NEW.transition_epoch
				AND prerequisite.relation = ''unit_structure_primary_path_backfill''
				AND prerequisite.relation_proof IS NOT NULL
				AND prerequisite.completed_at IS NOT NULL
		))
	THEN
		RAISE EXCEPTION ''Invalid verification checkpoint completion''
			USING ERRCODE = ''55000'',
				CONSTRAINT = ''vndb_v11_cutover_verification_checkpoint_update_invalid'';
	END IF;
	RETURN NEW;
END;
';

CREATE FUNCTION public.protect_vndb_v11_cutover_verification_checkpoint() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'pg_catalog', 'public'
AS '
BEGIN
	RAISE EXCEPTION ''Verification checkpoints cannot be deleted or truncated''
		USING ERRCODE = ''55000'',
			CONSTRAINT = ''vndb_v11_cutover_verification_checkpoint_immutable'';
END;
';
CREATE TRIGGER vndb_v11_cutover_verification_checkpoint_enforce
BEFORE INSERT OR UPDATE ON public.vndb_v11_cutover_verification_checkpoint
FOR EACH ROW EXECUTE FUNCTION public.enforce_vndb_v11_cutover_verification_checkpoint();
CREATE TRIGGER vndb_v11_cutover_verification_checkpoint_delete_protect
BEFORE DELETE ON public.vndb_v11_cutover_verification_checkpoint
FOR EACH STATEMENT EXECUTE FUNCTION public.protect_vndb_v11_cutover_verification_checkpoint();
CREATE TRIGGER vndb_v11_cutover_verification_checkpoint_truncate_protect
BEFORE TRUNCATE ON public.vndb_v11_cutover_verification_checkpoint
FOR EACH STATEMENT EXECUTE FUNCTION public.protect_vndb_v11_cutover_verification_checkpoint();

CREATE TABLE public.vndb_v11_cutover_verification_proof (
	transition_epoch bigint PRIMARY KEY,
	verification_contract text NOT NULL,
	relation_count integer NOT NULL,
	verified_row_count bigint NOT NULL,
	proof text NOT NULL,
	verified_by text NOT NULL,
	completed_at timestamp(3) with time zone NOT NULL,
	CONSTRAINT vndb_v11_cutover_verification_proof_epoch_fkey
		FOREIGN KEY (transition_epoch)
		REFERENCES public.vndb_v11_cutover_transition (transition_epoch) ON DELETE RESTRICT,
	CONSTRAINT vndb_v11_cutover_verification_proof_epoch_check CHECK (transition_epoch > 0),
	CONSTRAINT vndb_v11_cutover_verification_proof_contract_check CHECK (
		verification_contract = 'vndb-v11-bounded-verifier-v1'
	),
	CONSTRAINT vndb_v11_cutover_verification_proof_relation_count_check CHECK (
		relation_count = 9
	),
	CONSTRAINT vndb_v11_cutover_verification_proof_row_count_check CHECK (
		verified_row_count >= 0
	),
	CONSTRAINT vndb_v11_cutover_verification_proof_checksum_check CHECK (
		proof ~ '^[0-9a-f]{64}$'
	),
	CONSTRAINT vndb_v11_cutover_verification_proof_operator_check CHECK (
		btrim(verified_by) <> ''
	)
);

CREATE FUNCTION public.enforce_vndb_v11_cutover_verification_proof() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'pg_catalog', 'public'
AS '
DECLARE
	completed_count integer;
	completed_rows numeric;
	latest_checkpoint timestamp(3) with time zone;
BEGIN
	PERFORM pg_catalog.pg_advisory_xact_lock_shared(71011001::bigint);
	IF NOT EXISTS (
		SELECT 1 FROM public.vndb_v11_cutover_transition transition
		JOIN public.vndb_v11_cutover_control control
			ON control.id = 1 AND control.transition_epoch = transition.transition_epoch
		WHERE transition.transition_epoch = NEW.transition_epoch
			AND transition.state = ''paused'' AND control.state = ''paused''
	) THEN
		RAISE EXCEPTION ''Proof requires the exact current paused epoch''
			USING ERRCODE = ''55000'',
				CONSTRAINT = ''vndb_v11_cutover_verification_epoch_not_current_paused'';
	END IF;
	SELECT count(*)::integer, coalesce(sum(verified_row_count), 0::numeric), max(updated_at)
	INTO completed_count, completed_rows, latest_checkpoint
	FROM public.vndb_v11_cutover_verification_checkpoint
	WHERE transition_epoch = NEW.transition_epoch
		AND verification_contract = NEW.verification_contract
		AND relation_proof IS NOT NULL AND completed_at IS NOT NULL
		AND cardinality(accumulator_key) = 0 AND cardinality(accumulator) = 0;
	IF completed_count <> 9 OR NEW.relation_count <> 9
		OR completed_rows <> NEW.verified_row_count::numeric
		OR latest_checkpoint IS NULL OR NEW.completed_at < latest_checkpoint
	THEN
		RAISE EXCEPTION ''Verification proof is incomplete''
			USING ERRCODE = ''55000'',
				CONSTRAINT = ''vndb_v11_cutover_verification_proof_incomplete'';
	END IF;
	RETURN NEW;
END;
';
CREATE FUNCTION public.protect_vndb_v11_cutover_verification_proof() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'pg_catalog', 'public'
AS '
BEGIN
	RAISE EXCEPTION ''Verification proofs are immutable''
		USING ERRCODE = ''55000'',
			CONSTRAINT = ''vndb_v11_cutover_verification_proof_immutable'';
END;
';
CREATE TRIGGER vndb_v11_cutover_verification_proof_enforce
BEFORE INSERT ON public.vndb_v11_cutover_verification_proof
FOR EACH ROW EXECUTE FUNCTION public.enforce_vndb_v11_cutover_verification_proof();
CREATE TRIGGER vndb_v11_cutover_verification_proof_mutation_protect
BEFORE UPDATE OR DELETE ON public.vndb_v11_cutover_verification_proof
FOR EACH STATEMENT EXECUTE FUNCTION public.protect_vndb_v11_cutover_verification_proof();
CREATE TRIGGER vndb_v11_cutover_verification_proof_truncate_protect
BEFORE TRUNCATE ON public.vndb_v11_cutover_verification_proof
FOR EACH STATEMENT EXECUTE FUNCTION public.protect_vndb_v11_cutover_verification_proof();
