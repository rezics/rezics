-- Accept only a durably checkpointed, current-generation primary-Path projection.
DO $vndb$
BEGIN
	-- A fresh empty installation has no external pause/resume runner. Hold the
	-- exclusive fence through commit so queued writers observe postcontract_open.
	PERFORM pg_catalog.pg_advisory_xact_lock(71011001::bigint);
	UPDATE public.vndb_v11_cutover_control
	SET
		state = 'postcontract_open',
		transition_epoch = transition_epoch + 1,
		state_changed_at = now(),
		operator = 'vndb-v11-contract',
		reason = 'activate empty installation'
	WHERE id = 1
		AND state = 'precontract_open'
		AND NOT EXISTS (SELECT 1 FROM public.unit LIMIT 1);

	IF NOT EXISTS (
		SELECT 1
		FROM public.vndb_v11_cutover_control
		WHERE id = 1
			AND state IN ('paused', 'postcontract_open')
	) THEN
		RAISE EXCEPTION 'VNDB v11 contract cannot commit with legacy writers open'
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'vndb_v11_cutover_final_state_invalid';
	END IF;

	IF EXISTS (SELECT 1 FROM public.unit LIMIT 1)
		AND NOT EXISTS (
			SELECT 1
			FROM public.vndb_v11_cutover_control AS control
			JOIN public.vndb_v11_cutover_verification_checkpoint AS checkpoint
				ON checkpoint.transition_epoch = control.transition_epoch
				AND checkpoint.relation = 'unit_structure_primary_path_projection'
			WHERE control.id = 1
				AND control.state = 'paused'
				AND checkpoint.relation_proof ~ '^[0-9a-f]{64}$'
				AND checkpoint.completed_at IS NOT NULL
		)
	THEN
		RAISE EXCEPTION 'VNDB v11 current-generation primary-Path projection is not verified'
			USING
				ERRCODE = '55000',
				CONSTRAINT = 'vndb_v11_primary_path_backfill_incomplete';
	END IF;
END;
$vndb$;
