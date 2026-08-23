-- Content-pack imports are append-only provenance. Unit merges may move only
-- the evidence pointer that identifies the surviving runtime judgment; the
-- imported payload itself remains immutable.

CREATE OR REPLACE FUNCTION public.reject_content_pack_import_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	RAISE EXCEPTION '% history is append-only', TG_TABLE_NAME
		USING ERRCODE = '23514',
			CONSTRAINT = TG_TABLE_NAME || '_immutable';
END;
$$;

CREATE OR REPLACE FUNCTION public.require_content_pack_evidence_merge_operation(
	allowed_phases public.unit_merge_operation_phase[]
)
RETURNS public.unit_merge_operation
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	operation_id_setting text := nullif(
		current_setting('rezics.unit_merge_operation_id', true),
		''
	);
	lease_token_setting text := nullif(
		current_setting('rezics.unit_merge_lease_token', true),
		''
	);
	active_operation_id uuid;
	active_lease_token uuid;
	active_operation public.unit_merge_operation%ROWTYPE;
BEGIN
	IF operation_id_setting IS NULL OR lease_token_setting IS NULL THEN
		RAISE EXCEPTION 'Content-pack evidence may move only inside a leased Unit merge'
			USING ERRCODE = '23514',
				CONSTRAINT = 'content_pack_evidence_merge_context';
	END IF;

	BEGIN
		active_operation_id := operation_id_setting::uuid;
		active_lease_token := lease_token_setting::uuid;
	EXCEPTION
		WHEN invalid_text_representation THEN
			RAISE EXCEPTION 'Content-pack evidence Unit-merge settings must be UUIDs'
				USING ERRCODE = '23514',
					CONSTRAINT = 'content_pack_evidence_merge_context';
	END;

	SELECT operation.*
	INTO active_operation
	FROM public.unit_merge_operation AS operation
	WHERE operation.id = active_operation_id
		AND operation.state = 'processing'::public.unit_merge_operation_state
		AND operation.lease_token = active_lease_token
		AND operation.lease_expires_at > clock_timestamp();

	IF NOT FOUND OR NOT (active_operation.phase = ANY(allowed_phases)) THEN
		RAISE EXCEPTION 'Content-pack evidence Unit-merge context is not active for this phase'
			USING ERRCODE = '23514',
				CONSTRAINT = 'content_pack_evidence_merge_context';
	END IF;

	RETURN active_operation;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_content_pack_unit_tag_evidence_retarget()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	active_operation public.unit_merge_operation%ROWTYPE;
BEGIN
	active_operation := public.require_content_pack_evidence_merge_operation(
		ARRAY[
			'unit_tags'::public.unit_merge_operation_phase,
			'finalize'::public.unit_merge_operation_phase
		]
	);

	IF EXISTS (
		SELECT 1
		FROM old_evidence AS old_row
		FULL JOIN new_evidence AS new_row
			USING (import_id, source_fingerprint)
		WHERE old_row.import_id IS NULL
			OR new_row.import_id IS NULL
			OR (
				to_jsonb(old_row) - 'unit_id'
			) IS DISTINCT FROM (
				to_jsonb(new_row) - 'unit_id'
			)
	) THEN
		RAISE EXCEPTION 'Content-pack UnitTag evidence payload is immutable'
			USING ERRCODE = '23514',
				CONSTRAINT = 'content_pack_unit_tag_evidence_retarget_guard';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM old_evidence AS old_row
		JOIN new_evidence AS new_row
			USING (import_id, source_fingerprint)
		WHERE old_row.unit_id <> active_operation.source_unit_id
			OR new_row.unit_id <> active_operation.target_unit_id
			OR NOT EXISTS (
				SELECT 1
				FROM public.unit_tag_judgment AS source_judgment
				WHERE source_judgment.unit_id = old_row.unit_id
					AND source_judgment.tag_id = old_row.tag_id
					AND source_judgment.profile_id = old_row.profile_id
			)
			OR NOT EXISTS (
				SELECT 1
				FROM public.unit_tag_judgment AS target_judgment
				WHERE target_judgment.unit_id = new_row.unit_id
					AND target_judgment.tag_id = new_row.tag_id
					AND target_judgment.profile_id = new_row.profile_id
			)
	) THEN
		RAISE EXCEPTION 'Content-pack UnitTag evidence retarget does not match the active Unit merge'
			USING ERRCODE = '23514',
				CONSTRAINT = 'content_pack_unit_tag_evidence_retarget_guard';
	END IF;

	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_content_pack_structure_application_evidence_retarget()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	active_operation public.unit_merge_operation%ROWTYPE;
BEGIN
	active_operation := public.require_content_pack_evidence_merge_operation(
		ARRAY[
			'structure_applications'::public.unit_merge_operation_phase,
			'finalize'::public.unit_merge_operation_phase
		]
	);

	IF EXISTS (
		SELECT 1
		FROM old_evidence AS old_row
		FULL JOIN new_evidence AS new_row
			USING (import_id, source_fingerprint)
		WHERE old_row.import_id IS NULL
			OR new_row.import_id IS NULL
			OR (
				to_jsonb(old_row) - 'unit_id'
			) IS DISTINCT FROM (
				to_jsonb(new_row) - 'unit_id'
			)
	) THEN
		RAISE EXCEPTION 'Content-pack Structure-application evidence payload is immutable'
			USING ERRCODE = '23514',
				CONSTRAINT = 'content_pack_structure_application_evidence_retarget_guard';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM old_evidence AS old_row
		JOIN new_evidence AS new_row
			USING (import_id, source_fingerprint)
		WHERE old_row.unit_id <> active_operation.source_unit_id
			OR new_row.unit_id <> active_operation.target_unit_id
			OR NOT EXISTS (
				SELECT 1
				FROM public.unit_structure_application_judgment AS source_judgment
				WHERE source_judgment.unit_id = old_row.unit_id
					AND source_judgment.structure_id = old_row.structure_id
					AND source_judgment.profile_id = old_row.profile_id
			)
			OR NOT EXISTS (
				SELECT 1
				FROM public.unit_structure_application_judgment AS target_judgment
				WHERE target_judgment.unit_id = new_row.unit_id
					AND target_judgment.structure_id = new_row.structure_id
					AND target_judgment.profile_id = new_row.profile_id
			)
	) THEN
		RAISE EXCEPTION 'Content-pack Structure-application evidence retarget does not match the active Unit merge'
			USING ERRCODE = '23514',
				CONSTRAINT = 'content_pack_structure_application_evidence_retarget_guard';
	END IF;

	RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_content_pack_subject_association_evidence_retarget()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
	active_operation public.unit_merge_operation%ROWTYPE;
BEGIN
	active_operation := public.require_content_pack_evidence_merge_operation(
		ARRAY[
			'subject_sources'::public.unit_merge_operation_phase,
			'subject_entities'::public.unit_merge_operation_phase,
			'finalize'::public.unit_merge_operation_phase
		]
	);

	IF EXISTS (
		SELECT 1
		FROM old_evidence AS old_row
		FULL JOIN new_evidence AS new_row
			USING (import_id, source_fingerprint)
		WHERE old_row.import_id IS NULL
			OR new_row.import_id IS NULL
			OR (
				to_jsonb(old_row) - 'association_id'
			) IS DISTINCT FROM (
				to_jsonb(new_row) - 'association_id'
			)
	) THEN
		RAISE EXCEPTION 'Content-pack Subject-association evidence payload is immutable'
			USING ERRCODE = '23514',
				CONSTRAINT = 'content_pack_subject_association_evidence_retarget_guard';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM old_evidence AS old_row
		JOIN new_evidence AS new_row
			USING (import_id, source_fingerprint)
		LEFT JOIN public.subject_association AS source_association
			ON source_association.id = old_row.association_id
		LEFT JOIN public.subject_association AS target_association
			ON target_association.id = new_row.association_id
		WHERE source_association.id IS NULL
			OR target_association.id IS NULL
			OR old_row.association_id = new_row.association_id
			OR NOT (
				(
					active_operation.phase IN (
						'subject_sources'::public.unit_merge_operation_phase,
						'finalize'::public.unit_merge_operation_phase
					)
					AND source_association.unit_id = active_operation.source_unit_id
					AND target_association.unit_id = active_operation.target_unit_id
					AND source_association.entity_id = target_association.entity_id
					AND source_association.role = target_association.role
				)
				OR (
					active_operation.phase IN (
						'subject_entities'::public.unit_merge_operation_phase,
						'finalize'::public.unit_merge_operation_phase
					)
					AND source_association.entity_id = active_operation.source_unit_id
					AND target_association.entity_id = active_operation.target_unit_id
					AND source_association.unit_id = target_association.unit_id
					AND source_association.role = target_association.role
				)
			)
			OR NOT EXISTS (
				SELECT 1
				FROM public.subject_association_judgment AS source_judgment
				WHERE source_judgment.association_id = old_row.association_id
					AND source_judgment.profile_id = old_row.profile_id
			)
			OR NOT EXISTS (
				SELECT 1
				FROM public.subject_association_judgment AS target_judgment
				WHERE target_judgment.association_id = new_row.association_id
					AND target_judgment.profile_id = new_row.profile_id
			)
	) THEN
		RAISE EXCEPTION 'Content-pack Subject-association evidence retarget does not match the active Unit merge'
			USING ERRCODE = '23514',
				CONSTRAINT = 'content_pack_subject_association_evidence_retarget_guard';
	END IF;

	RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS content_pack_import_immutable
ON public.content_pack_import;
CREATE TRIGGER content_pack_import_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.content_pack_import
FOR EACH STATEMENT
EXECUTE FUNCTION public.reject_content_pack_import_evidence_mutation();

DROP TRIGGER IF EXISTS content_pack_tag_evidence_immutable
ON public.content_pack_tag_evidence;
CREATE TRIGGER content_pack_tag_evidence_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.content_pack_tag_evidence
FOR EACH STATEMENT
EXECUTE FUNCTION public.reject_content_pack_import_evidence_mutation();

DROP TRIGGER IF EXISTS content_pack_structure_definition_evidence_immutable
ON public.content_pack_structure_definition_evidence;
CREATE TRIGGER content_pack_structure_definition_evidence_immutable
BEFORE UPDATE OR DELETE OR TRUNCATE ON public.content_pack_structure_definition_evidence
FOR EACH STATEMENT
EXECUTE FUNCTION public.reject_content_pack_import_evidence_mutation();

DROP TRIGGER IF EXISTS content_pack_unit_tag_evidence_delete_guard
ON public.content_pack_unit_tag_evidence;
CREATE TRIGGER content_pack_unit_tag_evidence_delete_guard
BEFORE DELETE OR TRUNCATE ON public.content_pack_unit_tag_evidence
FOR EACH STATEMENT
EXECUTE FUNCTION public.reject_content_pack_import_evidence_mutation();

DROP TRIGGER IF EXISTS content_pack_structure_application_evidence_delete_guard
ON public.content_pack_structure_application_evidence;
CREATE TRIGGER content_pack_structure_application_evidence_delete_guard
BEFORE DELETE OR TRUNCATE ON public.content_pack_structure_application_evidence
FOR EACH STATEMENT
EXECUTE FUNCTION public.reject_content_pack_import_evidence_mutation();

DROP TRIGGER IF EXISTS content_pack_subject_association_evidence_delete_guard
ON public.content_pack_subject_association_evidence;
CREATE TRIGGER content_pack_subject_association_evidence_delete_guard
BEFORE DELETE OR TRUNCATE ON public.content_pack_subject_association_evidence
FOR EACH STATEMENT
EXECUTE FUNCTION public.reject_content_pack_import_evidence_mutation();

DROP TRIGGER IF EXISTS content_pack_unit_tag_evidence_retarget_guard
ON public.content_pack_unit_tag_evidence;
CREATE TRIGGER content_pack_unit_tag_evidence_retarget_guard
AFTER UPDATE ON public.content_pack_unit_tag_evidence
REFERENCING OLD TABLE AS old_evidence NEW TABLE AS new_evidence
FOR EACH STATEMENT
EXECUTE FUNCTION public.guard_content_pack_unit_tag_evidence_retarget();

DROP TRIGGER IF EXISTS content_pack_structure_application_evidence_retarget_guard
ON public.content_pack_structure_application_evidence;
CREATE TRIGGER content_pack_structure_application_evidence_retarget_guard
AFTER UPDATE ON public.content_pack_structure_application_evidence
REFERENCING OLD TABLE AS old_evidence NEW TABLE AS new_evidence
FOR EACH STATEMENT
EXECUTE FUNCTION public.guard_content_pack_structure_application_evidence_retarget();

DROP TRIGGER IF EXISTS content_pack_subject_association_evidence_retarget_guard
ON public.content_pack_subject_association_evidence;
CREATE TRIGGER content_pack_subject_association_evidence_retarget_guard
AFTER UPDATE ON public.content_pack_subject_association_evidence
REFERENCING OLD TABLE AS old_evidence NEW TABLE AS new_evidence
FOR EACH STATEMENT
EXECUTE FUNCTION public.guard_content_pack_subject_association_evidence_retarget();
