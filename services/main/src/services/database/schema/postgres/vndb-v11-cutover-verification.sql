-- Canonical database enforcement for durable VNDB-v11 cutover evidence.

CREATE OR REPLACE FUNCTION public.vndb_v11_verification_cursor_advanced(
	target_relation text, old_cursor text[], new_cursor text[]
) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	IF cardinality(old_cursor) = 0 THEN
		RETURN cardinality(new_cursor) > 0;
	END IF;
	CASE target_relation
		WHEN 'unit_structure_primary_path_backfill' THEN
			RETURN new_cursor[1]::uuid > old_cursor[1]::uuid;
		WHEN 'unit_structure_primary_path_projection' THEN
			RETURN ROW(new_cursor[1]::uuid, new_cursor[2]::smallint,
				new_cursor[3]::uuid, new_cursor[4]::integer)
				> ROW(old_cursor[1]::uuid, old_cursor[2]::smallint,
					old_cursor[3]::uuid, old_cursor[4]::integer);
		WHEN 'unit_tag_judgment_timestamps',
			'unit_structure_application_judgment_timestamps' THEN
			RETURN ROW(new_cursor[1]::uuid, new_cursor[2]::uuid, new_cursor[3]::uuid)
				> ROW(old_cursor[1]::uuid, old_cursor[2]::uuid, old_cursor[3]::uuid);
		WHEN 'realm_tag_judgment_timestamps' THEN
			RETURN ROW(new_cursor[1]::uuid, new_cursor[2]::uuid,
				new_cursor[3]::uuid, new_cursor[4]::uuid)
				> ROW(old_cursor[1]::uuid, old_cursor[2]::uuid,
					old_cursor[3]::uuid, old_cursor[4]::uuid);
		WHEN 'unit_tag_judgment_stat', 'unit_structure_application_judgment_stat' THEN
			RETURN ROW(new_cursor[1]::uuid, new_cursor[2]::uuid,
				new_cursor[3]::smallint, new_cursor[4]::uuid)
				> ROW(old_cursor[1]::uuid, old_cursor[2]::uuid,
					old_cursor[3]::smallint, old_cursor[4]::uuid);
		WHEN 'realm_tag_judgment_stat' THEN
			RETURN ROW(new_cursor[1]::uuid, new_cursor[2]::uuid, new_cursor[3]::uuid,
				new_cursor[4]::smallint, new_cursor[5]::uuid)
				> ROW(old_cursor[1]::uuid, old_cursor[2]::uuid, old_cursor[3]::uuid,
					old_cursor[4]::smallint, old_cursor[5]::uuid);
		WHEN 'subject_association_judgment_stat' THEN
			RETURN ROW(new_cursor[1]::uuid, new_cursor[2]::smallint, new_cursor[3]::uuid)
				> ROW(old_cursor[1]::uuid, old_cursor[2]::smallint, old_cursor[3]::uuid);
		ELSE
			RETURN false;
	END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_vndb_v11_cutover_verification_checkpoint()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	paused_at timestamp(3) with time zone;
	normal_completion boolean;
	projection_flush boolean;
	unit_tag_absence_flush boolean;
BEGIN
	PERFORM pg_catalog.pg_advisory_xact_lock_shared(71011001::bigint);
	SELECT transition.transitioned_at INTO paused_at
	FROM public.vndb_v11_cutover_transition AS transition
	JOIN public.vndb_v11_cutover_control AS control
		ON control.id = 1 AND control.transition_epoch = transition.transition_epoch
	WHERE transition.transition_epoch = NEW.transition_epoch
		AND transition.state = 'paused' AND control.state = 'paused';
	IF NOT FOUND THEN
		RAISE EXCEPTION 'Verification requires the exact current paused epoch'
			USING ERRCODE = '55000',
				CONSTRAINT = 'vndb_v11_cutover_verification_epoch_not_current_paused';
	END IF;
	IF TG_OP = 'INSERT' THEN
		IF NEW.started_at < paused_at OR cardinality(NEW.cursor) <> 0
			OR cardinality(NEW.accumulator_key) <> 0 OR cardinality(NEW.accumulator) <> 0
			OR NEW.scanned_row_count <> 0 OR NEW.verified_row_count <> 0
			OR NEW.checksum <> repeat('0', 64) OR NEW.relation_proof IS NOT NULL
			OR NEW.completed_at IS NOT NULL
		THEN
			RAISE EXCEPTION 'Verification checkpoints must start empty'
				USING ERRCODE = '55000',
					CONSTRAINT = 'vndb_v11_cutover_verification_checkpoint_initial_invalid';
		END IF;
		RETURN NEW;
	END IF;
	IF OLD.relation_proof IS NOT NULL OR OLD.completed_at IS NOT NULL
		OR NEW.transition_epoch IS DISTINCT FROM OLD.transition_epoch
		OR NEW.relation IS DISTINCT FROM OLD.relation
		OR NEW.verification_contract IS DISTINCT FROM OLD.verification_contract
		OR NEW.started_at IS DISTINCT FROM OLD.started_at OR NEW.updated_at < OLD.updated_at
	THEN
		RAISE EXCEPTION 'Verification checkpoint evidence is immutable'
			USING ERRCODE = '55000',
				CONSTRAINT = 'vndb_v11_cutover_verification_checkpoint_immutable';
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
			RAISE EXCEPTION 'Invalid verification checkpoint advancement'
				USING ERRCODE = '55000',
					CONSTRAINT = 'vndb_v11_cutover_verification_checkpoint_update_invalid';
		END IF;
		RETURN NEW;
	END IF;
	normal_completion := NEW.cursor IS NOT DISTINCT FROM OLD.cursor
		AND NEW.scanned_row_count = OLD.scanned_row_count
		AND NEW.verified_row_count = OLD.verified_row_count
		AND NEW.checksum IS NOT DISTINCT FROM OLD.checksum
		AND cardinality(OLD.accumulator_key) = 0 AND cardinality(OLD.accumulator) = 0
		AND cardinality(NEW.accumulator_key) = 0 AND cardinality(NEW.accumulator) = 0;
	projection_flush := NEW.relation = 'unit_structure_primary_path_projection'
		AND NEW.cursor IS NOT DISTINCT FROM OLD.cursor
		AND NEW.scanned_row_count = OLD.scanned_row_count
		AND NEW.verified_row_count = OLD.verified_row_count + 1
		AND NEW.checksum IS DISTINCT FROM OLD.checksum
		AND cardinality(OLD.accumulator_key) = 1 AND cardinality(OLD.accumulator) = 0
		AND cardinality(NEW.accumulator_key) = 0 AND cardinality(NEW.accumulator) = 0;
	unit_tag_absence_flush := NEW.relation = 'unit_tag_judgment_stat'
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
		OR (NEW.relation = 'unit_structure_primary_path_projection' AND NOT EXISTS (
			SELECT 1 FROM public.vndb_v11_cutover_verification_checkpoint AS prerequisite
			WHERE prerequisite.transition_epoch = NEW.transition_epoch
				AND prerequisite.relation = 'unit_structure_primary_path_backfill'
				AND prerequisite.relation_proof IS NOT NULL
				AND prerequisite.completed_at IS NOT NULL
		))
	THEN
		RAISE EXCEPTION 'Invalid verification checkpoint completion'
			USING ERRCODE = '55000',
				CONSTRAINT = 'vndb_v11_cutover_verification_checkpoint_update_invalid';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_vndb_v11_cutover_verification_checkpoint()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	RAISE EXCEPTION 'Verification checkpoints cannot be deleted or truncated'
		USING ERRCODE = '55000',
			CONSTRAINT = 'vndb_v11_cutover_verification_checkpoint_immutable';
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_vndb_v11_cutover_verification_proof()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
	completed_count integer;
	completed_rows numeric;
	latest_checkpoint timestamp(3) with time zone;
BEGIN
	PERFORM pg_catalog.pg_advisory_xact_lock_shared(71011001::bigint);
	IF NOT EXISTS (
		SELECT 1 FROM public.vndb_v11_cutover_transition AS transition
		JOIN public.vndb_v11_cutover_control AS control
			ON control.id = 1 AND control.transition_epoch = transition.transition_epoch
		WHERE transition.transition_epoch = NEW.transition_epoch
			AND transition.state = 'paused' AND control.state = 'paused'
	) THEN
		RAISE EXCEPTION 'Proof requires the exact current paused epoch'
			USING ERRCODE = '55000',
				CONSTRAINT = 'vndb_v11_cutover_verification_epoch_not_current_paused';
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
		RAISE EXCEPTION 'Verification proof is incomplete'
			USING ERRCODE = '55000',
				CONSTRAINT = 'vndb_v11_cutover_verification_proof_incomplete';
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_vndb_v11_cutover_verification_proof()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
BEGIN
	RAISE EXCEPTION 'Verification proofs are immutable'
		USING ERRCODE = '55000',
			CONSTRAINT = 'vndb_v11_cutover_verification_proof_immutable';
END;
$$;

DROP TRIGGER IF EXISTS vndb_v11_cutover_transition_mutation_protect
	ON public.vndb_v11_cutover_transition;
CREATE TRIGGER vndb_v11_cutover_transition_mutation_protect
BEFORE INSERT OR UPDATE OR DELETE ON public.vndb_v11_cutover_transition
FOR EACH ROW EXECUTE FUNCTION public.protect_vndb_v11_cutover_transition();
DROP TRIGGER IF EXISTS vndb_v11_cutover_transition_truncate_protect
	ON public.vndb_v11_cutover_transition;
CREATE TRIGGER vndb_v11_cutover_transition_truncate_protect
BEFORE TRUNCATE ON public.vndb_v11_cutover_transition
FOR EACH STATEMENT EXECUTE FUNCTION public.protect_vndb_v11_cutover_transition();

DROP TRIGGER IF EXISTS vndb_v11_cutover_verification_checkpoint_enforce
	ON public.vndb_v11_cutover_verification_checkpoint;
CREATE TRIGGER vndb_v11_cutover_verification_checkpoint_enforce
BEFORE INSERT OR UPDATE ON public.vndb_v11_cutover_verification_checkpoint
FOR EACH ROW EXECUTE FUNCTION public.enforce_vndb_v11_cutover_verification_checkpoint();
DROP TRIGGER IF EXISTS vndb_v11_cutover_verification_checkpoint_delete_protect
	ON public.vndb_v11_cutover_verification_checkpoint;
CREATE TRIGGER vndb_v11_cutover_verification_checkpoint_delete_protect
BEFORE DELETE ON public.vndb_v11_cutover_verification_checkpoint
FOR EACH STATEMENT EXECUTE FUNCTION public.protect_vndb_v11_cutover_verification_checkpoint();
DROP TRIGGER IF EXISTS vndb_v11_cutover_verification_checkpoint_truncate_protect
	ON public.vndb_v11_cutover_verification_checkpoint;
CREATE TRIGGER vndb_v11_cutover_verification_checkpoint_truncate_protect
BEFORE TRUNCATE ON public.vndb_v11_cutover_verification_checkpoint
FOR EACH STATEMENT EXECUTE FUNCTION public.protect_vndb_v11_cutover_verification_checkpoint();

DROP TRIGGER IF EXISTS vndb_v11_cutover_verification_proof_enforce
	ON public.vndb_v11_cutover_verification_proof;
CREATE TRIGGER vndb_v11_cutover_verification_proof_enforce
BEFORE INSERT ON public.vndb_v11_cutover_verification_proof
FOR EACH ROW EXECUTE FUNCTION public.enforce_vndb_v11_cutover_verification_proof();
DROP TRIGGER IF EXISTS vndb_v11_cutover_verification_proof_mutation_protect
	ON public.vndb_v11_cutover_verification_proof;
CREATE TRIGGER vndb_v11_cutover_verification_proof_mutation_protect
BEFORE UPDATE OR DELETE ON public.vndb_v11_cutover_verification_proof
FOR EACH STATEMENT EXECUTE FUNCTION public.protect_vndb_v11_cutover_verification_proof();
DROP TRIGGER IF EXISTS vndb_v11_cutover_verification_proof_truncate_protect
	ON public.vndb_v11_cutover_verification_proof;
CREATE TRIGGER vndb_v11_cutover_verification_proof_truncate_protect
BEFORE TRUNCATE ON public.vndb_v11_cutover_verification_proof
FOR EACH STATEMENT EXECUTE FUNCTION public.protect_vndb_v11_cutover_verification_proof();
